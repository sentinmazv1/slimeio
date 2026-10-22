// Slime.io v4.0 - Sıfır Gecikmeli (0ms Zero-Latency) WAV Ses Veritabanı & Karplus-Strong Fiziksel Modelleme Ses Motoru
// Tüm sesler (/sfx/*.wav veritabanı + bellekte önceden pişirilmiş PCM AudioBuffer) 0.0ms attack ile anında tetiklenir.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.muted = false;
    this.lastMoveSquishTime = 0;
    this.lastSoundTimes = {};
    this.bank = {
      attach: [],
      snap: [],
      shoot: [],
      hit: [],
      kill: [],
      powerup: [],
      ui: [],
      move: []
    };
    this.variantCursor = {
      attach: 0,
      snap: 0,
      shoot: 0,
      hit: 0,
      kill: 0,
      powerup: 0,
      ui: 0,
      move: 0
    };
    this.dbLoaded = false;
    this.dbLoading = false;
    this._rngSeed = 987654321;

    // İlk kullanıcı etkileşiminde ses motorunu ve WAV veritabanını önceden ısıt (Lobby dahil)
    this._setupEarlyUnlock();
  }

  _setupEarlyUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.init();
    };
    ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach((ev) => {
      window.addEventListener(ev, unlock, { once: true, passive: true, capture: true });
    });
  }

  _rand() {
    this._rngSeed = (this._rngSeed * 1664525 + 1013904223) >>> 0;
    return (this._rngSeed / 0xffffffff) * 2 - 1;
  }

  _canTrigger(key, minIntervalMs = 24) {
    const now = performance.now();
    const prev = this.lastSoundTimes[key] || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastSoundTimes[key] = now;
    return true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      } catch (_e) {
        this.ctx = new AudioCtx();
      }

      // Stüdyo tipi hızlı limiter/kompresör (0.5ms attack ile transient'leri ezmeden tok tutar)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.0005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.09, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.94, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // 1) Anında (0ms) çalışması için bellekte fiziksel modelleme PCM tamponlarını hemen oluştur
      this._buildInstantMemoryBank();

      // 2) Arka planda /sfx/sfx_db.json ve /sfx/*.wav veritabanını yükleyip gerçek WAV dosyalarıyla senkronize et
      this._loadWavDatabase();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Biquad DSP filtresi (Pre-baked PCM üretimi için)
  _applyBiquad(samples, sr, type, freq, q = 1.0) {
    const out = new Float32Array(samples.length);
    const w0 = (2 * Math.PI * Math.max(20, Math.min(sr * 0.48, freq))) / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Math.max(0.1, q));

    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    }

    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;

    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      out[i] = y0;
    }
    return out;
  }

  // Karplus-Strong Fiziksel Yay Kirişi / Gergin Halat Modeli
  _karplusStrong(sr, durationSec, baseFreq, tensionDropRatio = 1.0, damping = 0.991, brightness = 0.45) {
    const numSamples = Math.floor(sr * durationSec);
    const out = new Float32Array(numSamples);
    const initPeriod = Math.max(8, Math.floor(sr / baseFreq));
    const ring = new Float32Array(initPeriod * 4);

    for (let i = 0; i < initPeriod; i++) {
      const win = Math.sin((i / initPeriod) * Math.PI);
      ring[i] = (this._rand() * 0.75 + Math.sin((i / initPeriod) * Math.PI * 2) * 0.25) * win;
    }

    let readIdx = 0;
    let prevSample = 0;
    for (let i = 0; i < numSamples; i++) {
      const progress = i / numSamples;
      const currentFreq = baseFreq * (1 - progress * (1 - tensionDropRatio));
      const period = Math.max(8, Math.min(ring.length - 2, Math.floor(sr / currentFreq)));

      const cur = ring[readIdx % period];
      const next = ring[(readIdx + 1) % period];
      const filtered = (cur * (1 - brightness) + next * brightness) * damping;
      const shaped = filtered - prevSample * 0.02;
      prevSample = filtered;

      ring[readIdx % period] = shaped;
      out[i] = cur;
      readIdx++;
    }
    return out;
  }

  _toAudioBuffer(rawSamples, sr, targetPeak = 0.95) {
    const buf = this.ctx.createBuffer(1, rawSamples.length, sr);
    const chan = buf.getChannelData(0);
    let maxAbs = 0.0001;
    for (let i = 0; i < rawSamples.length; i++) {
      const sat = Math.tanh(rawSamples[i] * 1.45);
      chan[i] = sat;
      if (Math.abs(sat) > maxAbs) maxAbs = Math.abs(sat);
    }
    const norm = targetPeak / maxAbs;
    const fadeLen = Math.min(Math.floor(sr * 0.012), Math.floor(rawSamples.length * 0.15));
    for (let i = 0; i < rawSamples.length; i++) {
      const env = i >= rawSamples.length - fadeLen ? (rawSamples.length - 1 - i) / fadeLen : 1.0;
      chan[i] = Math.max(-1, Math.min(1, chan[i] * norm * env));
    }
    return buf;
  }

  _buildInstantMemoryBank() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;

    // 1. TUTUNMA (Attach): Modal Kaya Darbesi + Vakum Mühürlemesi + Karplus-Strong Halat Gerilmesi
    for (let v = 0; v < 3; v++) {
      const dur = 0.165;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.065;
      const modalFreqs = [64 * p, 108 * p, 172 * p, 265 * p];
      const modalDecays = [32, 48, 72, 110];
      const modalWeights = [0.75, 0.50, 0.30, 0.18];

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let modalSum = 0;
        for (let m = 0; m < modalFreqs.length; m++) {
          const f = modalFreqs[m] * (1 + 0.35 * Math.exp(-t * 95));
          modalSum += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * modalDecays[m]) * modalWeights[m];
        }
        const clickEnv = Math.exp(-t * 210);
        const suctionSeal =
          t >= 0.008 && t <= 0.055
            ? Math.sin(2 * Math.PI * (240 * p + (t - 0.008) * 6200) * (t - 0.008)) *
              Math.exp(-(t - 0.008) * 68) *
              0.55
            : 0;
        mix[i] += modalSum + this._rand() * clickEnv * 0.65 + suctionSeal;
      }

      const rope = this._karplusStrong(sr, dur, 142 * p, 1.18, 0.985, 0.42);
      const ropeFiltered = this._applyBiquad(rope, sr, 'bandpass', 480 * p, 1.8);
      const noise = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        noise[i] = this._rand() * Math.exp(-(i / sr) * 52);
      }
      const wetImpact = this._applyBiquad(noise, sr, 'bandpass', 780 * p, 2.1);

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const ropeEnv = Math.min(1, t / 0.006) * Math.exp(-t * 24);
        mix[i] += ropeFiltered[i] * ropeEnv * 0.75 + wetImpact[i] * 0.65;
      }
      this.bank.attach.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 2. KEMER KIRILMA (Snap): 0ms Kamçı Şaklaması + Karplus-Strong Kopan Gergin Tel + Hava Savrulması
    for (let v = 0; v < 3; v++) {
      const dur = 0.195;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.07;

      const crackNoise = new Float32Array(len);
      const whipNoise = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const primaryCrack = Math.exp(-t * 165);
        const secondaryFiber = t > 0.014 ? Math.exp(-(t - 0.014) * 140) * 0.55 : 0;
        crackNoise[i] = this._rand() * (primaryCrack + secondaryFiber);
        whipNoise[i] = this._rand() * Math.sin(Math.min(1, t / 0.09) * Math.PI) * Math.exp(-t * 20);
      }
      const highCrack = this._applyBiquad(crackNoise, sr, 'bandpass', 2450 * p, 1.5);
      const midSnapBody = this._applyBiquad(crackNoise, sr, 'bandpass', 920 * p, 1.9);
      const whipFiltered = this._applyBiquad(whipNoise, sr, 'bandpass', 1280 * p, 2.2);

      const brokenString1 = this._karplusStrong(sr, dur, 330 * p, 0.34, 0.991, 0.38);
      const brokenString2 = this._karplusStrong(sr, dur, 475 * p, 0.38, 0.989, 0.45);

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const bodySnap = Math.sin(2 * Math.PI * (195 * p * Math.exp(-t * 28)) * t) * Math.exp(-t * 42) * 0.72;
        const strEnv = Math.exp(-t * 16);
        mix[i] =
          highCrack[i] * 0.95 +
          midSnapBody[i] * 0.85 +
          bodySnap +
          (brokenString1[i] * 0.65 + brokenString2[i] * 0.45) * strEnv +
          whipFiltered[i] * 0.55;
      }
      this.bank.snap.push(this._toAudioBuffer(mix, sr, 0.96));
    }

    // 3. ATEŞ / OK FIRLATMA (Shoot): 0ms Taktiksel Arbalet/Basınçlı Yay Kirişi + Doppler Hava Yarma Whoosh
    for (let v = 0; v < 3; v++) {
      const dur = 0.16;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.055;

      const bowString = this._karplusStrong(sr, dur, 185 * p, 0.72, 0.986, 0.48);
      const bowBody = this._applyBiquad(bowString, sr, 'lowpass', 1350 * p, 1.4);

      const airRaw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        airRaw[i] = this._rand() * Math.min(1, t / 0.005) * Math.exp(-t * 24);
      }
      const airHigh = this._applyBiquad(airRaw, sr, 'bandpass', 1950 * p, 1.8);
      const airMid = this._applyBiquad(airRaw, sr, 'bandpass', 820 * p, 1.5);

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const chamberPunch =
          Math.sin(2 * Math.PI * (128 * p + 140 * Math.exp(-t * 85)) * t) * Math.exp(-t * 46) * 0.88;
        const muzzleTransient = this._rand() * Math.exp(-t * 260) * 0.6;
        mix[i] =
          chamberPunch +
          muzzleTransient +
          bowBody[i] * Math.exp(-t * 22) * 0.75 +
          airHigh[i] * 0.72 +
          airMid[i] * 0.65;
      }
      this.bank.shoot.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 4. İSABET (Hit): Tok Hedef Darbesi
    for (let v = 0; v < 2; v++) {
      const dur = 0.13;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + v * 0.08;
      const noise = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        noise[i] = this._rand() * Math.exp(-(i / sr) * 48);
      }
      const thwack = this._applyBiquad(noise, sr, 'bandpass', 1050 * p, 1.7);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const heavyThud = Math.sin(2 * Math.PI * (92 * p + 110 * Math.exp(-t * 90)) * t) * Math.exp(-t * 42) * 0.9;
        mix[i] = heavyThud + thwack[i] * 0.8;
      }
      this.bank.hit.push(this._toAudioBuffer(mix, sr, 0.92));
    }

    // 5. ÖLÜM / ELEME (Kill)
    {
      const dur = 0.28;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const shatter = new Float32Array(len);
      for (let i = 0; i < len; i++) shatter[i] = this._rand() * Math.exp(-(i / sr) * 22);
      const shatterBand = this._applyBiquad(shatter, sr, 'bandpass', 1420, 1.6);
      const chord = this._karplusStrong(sr, dur, 220, 0.85, 0.993, 0.55);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const subDrop = Math.sin(2 * Math.PI * (76 + 130 * Math.exp(-t * 35)) * t) * Math.exp(-t * 15) * 0.85;
        mix[i] = subDrop + shatterBand[i] * 0.7 + chord[i] * Math.exp(-t * 12) * 0.5;
      }
      this.bank.kill.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 6. POWERUP
    {
      const dur = 0.24;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const s1 = this._karplusStrong(sr, dur, 330, 1.0, 0.994, 0.6);
      const s2 = this._karplusStrong(sr, dur, 440, 1.0, 0.994, 0.6);
      const s3 = this._karplusStrong(sr, dur, 660, 1.0, 0.995, 0.65);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        mix[i] += s1[i] * Math.exp(-t * 14) * 0.5;
        if (t >= 0.045) {
          const i2 = i - Math.floor(0.045 * sr);
          mix[i] += s2[i2] * Math.exp(-(t - 0.045) * 14) * 0.55;
        }
        if (t >= 0.09) {
          const i3 = i - Math.floor(0.09 * sr);
          mix[i] += s3[i3] * Math.exp(-(t - 0.09) * 12) * 0.65;
        }
      }
      this.bank.powerup.push(this._toAudioBuffer(mix, sr, 0.9));
    }

    // 7. UI CLICK
    {
      const dur = 0.045;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        mix[i] =
          Math.sin(2 * Math.PI * 520 * Math.exp(-t * 45) * t) * Math.exp(-t * 95) +
          this._rand() * Math.exp(-t * 220) * 0.4;
      }
      this.bank.ui.push(this._toAudioBuffer(mix, sr, 0.8));
    }

    // 8. HAFİF HAREKET RÜZGARI (Move)
    {
      const dur = 0.085;
      const len = Math.floor(sr * dur);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        raw[i] = this._rand() * Math.sin((t / dur) * Math.PI);
      }
      const filtered = this._applyBiquad(raw, sr, 'bandpass', 420, 2.2);
      this.bank.move.push(this._toAudioBuffer(filtered, sr, 0.35));
    }
  }

  // Sunucudaki /sfx/sfx_db.json ve /sfx/*.wav ses veritabanını indirip AudioBuffer olarak decode eder
  async _loadWavDatabase() {
    if (this.dbLoaded || this.dbLoading || !this.ctx || typeof fetch !== 'function') return;
    this.dbLoading = true;
    try {
      const res = await fetch('/sfx/sfx_db.json?v=4.0');
      if (!res.ok) throw new Error('SFX DB fetch failed');
      const manifest = await res.json();
      if (!manifest || !manifest.sounds) return;

      const categories = Object.keys(manifest.sounds);
      for (const cat of categories) {
        const items = manifest.sounds[cat];
        if (!Array.isArray(items) || items.length === 0) continue;
        const decodedList = [];
        for (const item of items) {
          if (!item || !item.url) continue;
          try {
            const wavRes = await fetch(`${item.url}?v=4.0`);
            if (!wavRes.ok) continue;
            const arrayBuf = await wavRes.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            if (audioBuf) decodedList.push(audioBuf);
          } catch (_err) {
            // Tekil dosya hatasında bellekteki tampon korunur
          }
        }
        if (decodedList.length > 0) {
          this.bank[cat] = decodedList;
        }
      }
      this.dbLoaded = true;
    } catch (_e) {
      // Çevrimdışı veya ağ hatası durumunda _buildInstantMemoryBank tamponları kesintisiz çalışmaya devam eder
    } finally {
      this.dbLoading = false;
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.94, this.ctx.currentTime);
    }
    return this.muted;
  }

  getDistanceScale(worldX, worldY, camX, camY) {
    if (
      typeof worldX !== 'number' ||
      typeof worldY !== 'number' ||
      typeof camX !== 'number' ||
      typeof camY !== 'number'
    ) {
      return 1.0;
    }
    const dist = Math.hypot(worldX - camX, worldY - camY);
    if (dist <= 480) return 1.0;
    if (dist >= 1280) return 0;
    const norm = 1 - (dist - 480) / (1280 - 480);
    return norm * norm;
  }

  // Sıfır gecikmeli (0.0ms) tek-düğüm (Single-Node) AudioBuffer oynatıcı
  _playFromBank(category, gainScale = 1.0, worldX = null, camX = null, rateSpread = 0.07) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || gainScale <= 0.015) return;

    const list = this.bank[category];
    if (!list || list.length === 0) return;

    // Sıradaki varyantı seç (Round-robin + hafif pitch değişimi ile doğal çeşitlilik)
    const idx = (this.variantCursor[category] || 0) % list.length;
    this.variantCursor[category] = idx + 1;
    const buffer = list[idx];
    if (!buffer) return;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const rate = 1.0 + (Math.random() - 0.5) * rateSpread;
    src.playbackRate.setValueAtTime(rate, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(Math.min(1.25, gainScale), now);

    src.connect(gainNode);

    if (
      typeof this.ctx.createStereoPanner === 'function' &&
      typeof worldX === 'number' &&
      typeof camX === 'number'
    ) {
      const panner = this.ctx.createStereoPanner();
      const panVal = Math.max(-0.78, Math.min(0.78, (worldX - camX) / 720));
      panner.pan.setValueAtTime(panVal, now);
      gainNode.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gainNode.connect(this.masterGain);
    }

    // Tam 0.0ms'de (şimdi) başlat!
    src.start(now);
  }

  // 1) Hızlı süzülürken hafif aerodinamik hareket sesi
  playCuteGiggle(speedRatio = 0.5) {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastMoveSquishTime < 3600) return;
    this.lastMoveSquishTime = now;
    this._playFromBank('move', 0.18 * (0.6 + speedRatio * 0.4), null, null, 0.12);
  }

  // 2) TUTUNMA SESİ (Duvara/Kayaya Çarpıp Kemer Bağlama - attach_1..3.wav)
  playWallAttachScream(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('wallAttach', 22)) return;
    this._playFromBank('attach', 0.96 * scale, worldX, camX, 0.08);
  }

  // 3) KEMER KIRILMA / KOPMA SESİ (Yüksek Gerilimli Halat/Yay Kopması - snap_1..3.wav)
  playBandSnap(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('bandSnap', 20)) return;
    this._playFromBank('snap', 1.02 * scale, worldX, camX, 0.09);
  }

  // 4) ATEŞ / OK FIRLATMA SESİ (Taktiksel Arbalet / Yay Fırlatma + Hava Yarma - shoot_1..3.wav)
  playArrowShoot(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('arrowShoot', 20)) return;
    this._playFromBank('shoot', 0.98 * scale, worldX, camX, 0.07);
  }

  // 5) OKUN DUVARA VEYA HEDEFE ÇARPMA SESİ (hit_1..2.wav)
  playSlimeSplat(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('slimeSplat', 22)) return;
    this._playFromBank('hit', 0.88 * scale, worldX, camX, 0.09);
  }

  // 6) Oyuncu Elendiğinde (kill_1.wav)
  playDeathPop() {
    if (this.muted) return;
    this._playFromBank('kill', 1.0, null, null, 0.06);
  }

  // 7) Arayüz / Bildirim Sesi (ui_click.wav)
  playUiPop() {
    if (this.muted) return;
    this._playFromBank('ui', 0.65, null, null, 0.05);
  }

  // 8) Güçlendirme Kutusu (Power-Up) Alındığında (powerup_1.wav)
  playPowerupPickup(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02) return;
    this._playFromBank('powerup', 0.9 * scale, worldX, camX, 0.04);
  }
}

window.soundManager = new SoundManager();
