// Slime.io v5.0 - Sci-Fi Neon Arcade & Squishy Slime Sıfır Gecikmeli (0ms) WAV Ses Motoru
// 1. Kemer/Ok Fırlatma & Tutunma: Sci-fi neon laser shoot ("ziyuv/pew") + Rubber band snap on metal wall thud
// 2. Kemer Kesme & Koparma: High-pitched digital slice + glass shatter (Rakip kesimi) & 8-bit electric wire spark snap (Kendi kemerini iptal)
// 3. Çarpışma & Slime Dokusu: Squishy slime bounce, rubbery wet thud, cute cartoon boing
// 4. Patlama & Yok Olma: Retro 8-bit arcade explosion + Water balloon laser pop & digital confetti
// 5. Seviye Atlama & UI: Glowing neon arcade level-up chime ("çing!") + Futuristic holographic UI click

class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.muted = false;
    this.lastMoveSquishTime = 0;
    this.lastSoundTimes = {};
    this.bank = {
      shoot: [],
      attach: [],
      slice: [],
      snap: [],
      hit: [],
      kill: [],
      powerup: [],
      ui: [],
      move: []
    };
    this.variantCursor = {
      shoot: 0,
      attach: 0,
      slice: 0,
      snap: 0,
      hit: 0,
      kill: 0,
      powerup: 0,
      ui: 0,
      move: 0
    };
    this.dbLoaded = false;
    this.dbLoading = false;
    this._rngSeed = 20261022;

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

  _canTrigger(key, minIntervalMs = 22) {
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

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.0005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.085, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.94, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // 1) Anında (0.0ms) yanıt için bellekte WAV-eşleniği PCM tamponlarını oluştur
      this._buildInstantMemoryBank();

      // 2) Sunucudan /sfx/sfx_db.json ve /sfx/*.wav dosyalarını yükle
      this._loadWavDatabase();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

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

  _toAudioBuffer(rawSamples, sr, targetPeak = 0.94) {
    const buf = this.ctx.createBuffer(1, rawSamples.length, sr);
    const chan = buf.getChannelData(0);
    let maxAbs = 0.0001;
    for (let i = 0; i < rawSamples.length; i++) {
      const sat = Math.tanh(rawSamples[i] * 1.35);
      chan[i] = sat;
      if (Math.abs(sat) > maxAbs) maxAbs = Math.abs(sat);
    }
    const norm = targetPeak / maxAbs;
    const fadeLen = Math.min(Math.floor(sr * 0.014), Math.floor(rawSamples.length * 0.18));
    for (let i = 0; i < rawSamples.length; i++) {
      const env = i >= rawSamples.length - fadeLen ? (rawSamples.length - 1 - i) / fadeLen : 1.0;
      chan[i] = Math.max(-1, Math.min(1, chan[i] * norm * env));
    }
    return buf;
  }

  _buildInstantMemoryBank() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;

    // 1A. LAZER / OK FIRLATMA (Shoot): Sci-fi neon laser shoot, quick zap ("ziyuv / pew") + retro arcade synth ping
    for (let v = 0; v < 3; v++) {
      const dur = 0.135;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.06;
      let phase1 = 0, phase2 = 0, pingPhase = 0;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const laserFreq = (195 + 1680 * Math.exp(-t * 36)) * p;
        const fmMod = Math.sin(2 * Math.PI * laserFreq * 2.0 * t) * 0.35;
        phase1 += (2 * Math.PI * laserFreq) / sr;
        phase2 += (2 * Math.PI * laserFreq * 1.5) / sr;

        const sawPart = 2 * ((phase1 / (2 * Math.PI)) - Math.floor(0.5 + phase1 / (2 * Math.PI)));
        const sinePart = Math.sin(phase1 + fmMod);
        const subHarm = Math.sin(phase2) * 0.32;
        const laserEnv = Math.min(1, t / 0.0015) * Math.exp(-t * 19);

        const pingFreq = (v % 2 === 0 ? 1480 : 1640) * p;
        pingPhase += (2 * Math.PI * pingFreq) / sr;
        const arcadePing = Math.sin(pingPhase) * Math.exp(-t * 65) * 0.48;
        const zapClick = Math.sin(2 * Math.PI * 2900 * t) * Math.exp(-t * 190) * 0.42;

        mix[i] = (sinePart * 0.68 + sawPart * 0.32 + subHarm) * laserEnv + arcadePing + zapClick;
      }
      this.bank.shoot.push(this._toAudioBuffer(mix, sr, 0.94));
    }

    // 1B. DUVARA TUTUNMA (Attach): Rubber band snap attaching to a metal wall, futuristic electronic thud
    for (let v = 0; v < 3; v++) {
      const dur = 0.145;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.055;
      let thudPhase = 0, rubberPhase = 0;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const thudFreq = (52 + 125 * Math.exp(-t * 62)) * p;
        thudPhase += (2 * Math.PI * thudFreq) / sr;
        const electronicThud = Math.sin(thudPhase) * Math.exp(-t * 32) * 0.88;

        const metalImpact =
          Math.sin(2 * Math.PI * 385 * p * t) * Math.exp(-t * 78) * 0.42 +
          Math.sin(2 * Math.PI * 790 * p * t) * Math.exp(-t * 105) * 0.28 +
          Math.sin(2 * Math.PI * 1320 * p * t) * Math.exp(-t * 145) * 0.18;

        const rubberFreq = (265 + 75 * Math.sin(Math.min(1, t / 0.045) * Math.PI) - 45 * Math.exp(-t * 90)) * p;
        rubberPhase += (2 * Math.PI * rubberFreq) / sr;
        const rubberEnv = Math.min(1, t / 0.003) * Math.exp(-t * 26);
        const rubberSnap = (Math.sin(rubberPhase) + 0.35 * Math.sin(rubberPhase * 2.0)) * rubberEnv * 0.62;

        mix[i] = electronicThud + metalImpact + rubberSnap;
      }
      this.bank.attach.push(this._toAudioBuffer(mix, sr, 0.94));
    }

    // 2A. RAKİP KEMERİNİ KESME (Slice): High-pitched digital slice, energy beam cut, sharp sci-fi swish, bright glass shatter
    for (let v = 0; v < 2; v++) {
      const dur = 0.185;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + v * 0.07;

      const swishRaw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        swishRaw[i] = this._rand() * Math.min(1, t / 0.008) * Math.exp(-t * 28);
      }
      const swishBand = this._applyBiquad(swishRaw, sr, 'bandpass', 2650 * p, 2.2);
      const shardTimes = [0.002, 0.014, 0.027, 0.042, 0.058, 0.076];
      const shardFreqs = [2450, 3280, 4120, 2890, 4850, 3720];

      let slicePhase = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const beamFreq = (520 + 2350 * Math.exp(-t * 48)) * p;
        slicePhase += (2 * Math.PI * beamFreq) / sr;
        const digitalSlice = (Math.sin(slicePhase) + 0.45 * Math.sin(slicePhase * 2.4)) * Math.exp(-t * 26) * 0.72;

        let glassShards = 0;
        for (let s = 0; s < shardTimes.length; s++) {
          const dt = t - shardTimes[s];
          if (dt >= 0) {
            const sf = shardFreqs[s] * p;
            glassShards +=
              (Math.sin(2 * Math.PI * sf * dt) + 0.4 * Math.sin(2 * Math.PI * sf * 1.414 * dt)) *
              Math.exp(-dt * 58) *
              0.26;
          }
        }
        mix[i] = digitalSlice + swishBand[i] * 0.85 + glassShards;
      }
      this.bank.slice.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 2B. KENDİ KEMERİNİ KOPARMA (Snap): Electric wire snap, short high-voltage zap, bright spark sound, 8-bit arcade
    for (let v = 0; v < 3; v++) {
      const dur = 0.13;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + (v - 1) * 0.06;
      const sparkNotes = [1650, 2750, 1980, 3300, 2200, 3850];
      let wirePhase = 0;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const wireFreq = (240 + 920 * Math.exp(-t * 44)) * p;
        const hvBuzz = Math.sin(2 * Math.PI * 185 * t) * 2.2;
        wirePhase += (2 * Math.PI * wireFreq) / sr;
        const wireSnap = Math.sin(wirePhase + hvBuzz) * Math.exp(-t * 28) * 0.75;

        const stepIdx = Math.min(sparkNotes.length - 1, Math.floor(t / 0.016));
        const sparkFreq = sparkNotes[stepIdx] * p;
        const rawSq = Math.sin(2 * Math.PI * sparkFreq * t) >= 0 ? 0.8 : -0.8;
        const sparkEnv = Math.exp(-t * 34);
        const sparkCrackle = this._rand() * Math.exp(-t * 75) * 0.35;

        mix[i] = wireSnap + rawSq * sparkEnv * 0.42 + sparkCrackle;
      }
      this.bank.snap.push(this._toAudioBuffer(mix, sr, 0.94));
    }

    // 3. ÇARPIŞMA VE SLIME DOKUSU (Hit / Bounce): Squishy slime bounce, rubbery wet thud, cute cartoon boing
    for (let v = 0; v < 2; v++) {
      const dur = 0.165;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const p = 1.0 + v * 0.08;
      let boingPhase = 0, squishPhase = 0;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const wobble = Math.sin(2 * Math.PI * 26 * t) * 28 * Math.exp(-t * 14);
        const boingFreq = (165 + 230 * (1 - Math.exp(-t * 36)) + wobble) * p;
        boingPhase += (2 * Math.PI * boingFreq) / sr;
        const boingEnv = Math.min(1, t / 0.004) * Math.exp(-t * 17);
        const cartoonBoing = (Math.sin(boingPhase) * 0.82 + Math.sin(boingPhase * 2) * 0.18) * boingEnv;

        const squishFreq = (520 + 680 * Math.sin(Math.min(1, t / 0.065) * Math.PI)) * p;
        squishPhase += (2 * Math.PI * squishFreq) / sr;
        const wetSquish = Math.sin(squishPhase) * Math.exp(-t * 32) * 0.34;
        const softThud = Math.sin(2 * Math.PI * 110 * p * t) * Math.exp(-t * 45) * 0.45;

        mix[i] = cartoonBoing * 0.78 + wetSquish + softThud;
      }
      this.bank.hit.push(this._toAudioBuffer(mix, sr, 0.9));
    }

    // 4A. PATLAMA 1: Retro arcade explosion, 8-bit digital boom, pixelated burst
    {
      const dur = 0.29;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const defeatNotes = [587.33, 493.88, 392.0, 293.66, 220.0, 146.83, 98.0];
      let boomPhase = 0, heldNoise = 0, holdCounter = 0;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const holdPeriod = Math.max(4, Math.floor(6 + t * 28));
        if (holdCounter <= 0) {
          heldNoise = this._rand();
          holdCounter = holdPeriod;
        }
        holdCounter--;
        const pixelCrunch = heldNoise * Math.exp(-t * 16) * 0.52;

        const boomFreq = 42 + 145 * Math.exp(-t * 24);
        boomPhase += (2 * Math.PI * boomFreq) / sr;
        const digitalBoom = Math.tanh(Math.sin(boomPhase) * 1.8) * Math.exp(-t * 11) * 0.78;

        const stepIdx = Math.min(defeatNotes.length - 1, Math.floor(t / 0.036));
        const sqWave = Math.sin(2 * Math.PI * defeatNotes[stepIdx] * t) >= 0 ? 0.7 : -0.7;
        mix[i] = digitalBoom + pixelCrunch + sqWave * Math.exp(-t * 9) * 0.36;
      }
      this.bank.kill.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 4B. PATLAMA 2: Popping a large water balloon with a laser, synth bass drop, digital confetti
    {
      const dur = 0.28;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      let popPhase = 0, bassPhase = 0;
      const confettiNotes = [1567.98, 2093.0, 2637.02, 3135.96];

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const popFreq = t < 0.028 ? 320 + (t / 0.028) * 520 : 165 + 675 * Math.exp(-(t - 0.028) * 55);
        popPhase += (2 * Math.PI * popFreq) / sr;
        const balloonPop = Math.sin(popPhase) * Math.exp(-t * 24) * 0.85;

        const bassFreq = 38 + 112 * Math.exp(-t * 18);
        bassPhase += (2 * Math.PI * bassFreq) / sr;
        const bassDrop = Math.sin(bassPhase) * Math.exp(-t * 10) * 0.75;

        let confetti = 0;
        for (let c = 0; c < confettiNotes.length; c++) {
          const startT = 0.035 + c * 0.032;
          if (t >= startT) {
            const dt = t - startT;
            confetti += Math.sin(2 * Math.PI * confettiNotes[c] * dt) * Math.exp(-dt * 28) * 0.26;
          }
        }
        mix[i] = balloonPop + bassDrop + confetti;
      }
      this.bank.kill.push(this._toAudioBuffer(mix, sr, 0.95));
    }

    // 5A. SEVİYE ATLAMA & EŞYA KUŞANMA (Powerup / Level Up): Arcade level up chime, glowing neon power up sound
    {
      const dur = 0.34;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      const notes = [
        { f: 523.25, start: 0.0, decay: 18, gain: 0.45 },
        { f: 659.25, start: 0.042, decay: 18, gain: 0.48 },
        { f: 783.99, start: 0.084, decay: 16, gain: 0.52 },
        { f: 987.77, start: 0.126, decay: 14, gain: 0.58 },
        { f: 1046.5, start: 0.165, decay: 9, gain: 0.75 },
        { f: 2093.0, start: 0.165, decay: 12, gain: 0.42 }
      ];
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let sum = 0;
        for (let n = 0; n < notes.length; n++) {
          const note = notes[n];
          if (t >= note.start) {
            const dt = t - note.start;
            const env = Math.min(1, dt / 0.003) * Math.exp(-dt * note.decay);
            const sig =
              Math.sin(2 * Math.PI * note.f * dt) * 0.65 +
              Math.sin(2 * Math.PI * note.f * 1.004 * dt) * 0.35 +
              Math.sin(2 * Math.PI * note.f * 2.0 * dt) * 0.22;
            sum += sig * env * note.gain;
          }
        }
        mix[i] = sum;
      }
      this.bank.powerup.push(this._toAudioBuffer(mix, sr, 0.92));
    }

    // 5B. FÜTÜRİSTİK ARAYÜZ TIKLAMA (UI): Sleek digital button press, short holographic beep
    {
      const dur = 0.038;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      let phase = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = t < 0.012 ? 1420 : 2180;
        phase += (2 * Math.PI * freq) / sr;
        const env = Math.min(1, t / 0.0015) * Math.exp(-t * 95);
        mix[i] = (Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2) * env;
      }
      this.bank.ui.push(this._toAudioBuffer(mix, sr, 0.82));
    }

    // HAREKET JÖLE ESNEMESİ (Move)
    {
      const dur = 0.075;
      const len = Math.floor(sr * dur);
      const mix = new Float32Array(len);
      let phase = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = 260 + 120 * Math.sin((t / dur) * Math.PI);
        phase += (2 * Math.PI * f) / sr;
        mix[i] = Math.sin(phase) * Math.sin((t / dur) * Math.PI) * 0.35;
      }
      this.bank.move.push(this._toAudioBuffer(mix, sr, 0.42));
    }
  }

  async _loadWavDatabase() {
    if (this.dbLoaded || this.dbLoading || !this.ctx || typeof fetch !== 'function') return;
    this.dbLoading = true;
    try {
      const res = await fetch('/sfx/sfx_db.json?v=5.0');
      if (!res.ok) throw new Error('SFX DB fetch failed');
      const manifest = await res.json();
      if (!manifest || !manifest.sounds) return;

      const categories = Object.keys(manifest.sounds);
      for (const cat of categories) {
        const items = manifest.sounds[cat];
        if (!Array.isArray(items) || !items.length) continue;
        const decodedList = [];
        for (const item of items) {
          if (!item || !item.url) continue;
          try {
            const wavRes = await fetch(`${item.url}?v=5.0`);
            if (!wavRes.ok) continue;
            const arrayBuf = await wavRes.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            if (audioBuf) decodedList.push(audioBuf);
          } catch (_err) {}
        }
        if (decodedList.length > 0) {
          this.bank[cat] = decodedList;
        }
      }
      this.dbLoaded = true;
    } catch (_e) {
      // Çevrimdışıysa bellekteki _buildInstantMemoryBank tamponları kesintisiz çalışır
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

  _playFromBank(category, gainScale = 1.0, worldX = null, camX = null, rateSpread = 0.06) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || gainScale <= 0.015) return;

    const list = this.bank[category];
    if (!list || list.length === 0) return;

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

    src.start(now);
  }

  // Hızlı salınırken tatlı jöle esneme sesi
  playCuteGiggle(speedRatio = 0.5) {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastMoveSquishTime < 3600) return;
    this.lastMoveSquishTime = now;
    this._playFromBank('move', 0.22 * (0.6 + speedRatio * 0.4), null, null, 0.1);
  }

  // 1A. LAZER / OK FIRLATMA ("Ziyuv / Pew" Sci-fi Neon Laser + Arcade Synth Ping)
  playArrowShoot(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('arrowShoot', 20)) return;
    this._playFromBank('shoot', 0.96 * scale, worldX, camX, 0.06);
  }

  // 1B. DUVARA / KAYAYA TUTUNMA (Rubber band snap on metal wall + Futuristic electronic thud)
  playWallAttachScream(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('wallAttach', 22)) return;
    this._playFromBank('attach', 0.96 * scale, worldX, camX, 0.06);
  }

  // 2A. RAKİBİN KEMERİNİ KESME (High-pitched digital slice + energy beam cut + bright glass shatter)
  playEnemyBeltSlice(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('enemySlice', 20)) return;
    this._playFromBank('slice', 1.04 * scale, worldX, camX, 0.06);
  }

  // 2B. KENDİ KEMERİNİ SAĞ TIK İLE KOPARMA (Electric wire snap + high-voltage 8-bit spark zap)
  playBandSnap(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('bandSnap', 20)) return;
    this._playFromBank('snap', 0.98 * scale, worldX, camX, 0.07);
  }

  // 3. ÇARPIŞMA VE SLIME DOKUSU (Squishy slime bounce, rubbery wet thud, cute cartoon boing)
  playSlimeSplat(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('slimeSplat', 22)) return;
    this._playFromBank('hit', 0.92 * scale, worldX, camX, 0.08);
  }

  playSlimeBounce(worldX, worldY, camX, camY) {
    this.playSlimeSplat(worldX, worldY, camX, camY);
  }

  // 4. PATLAMA VE YOK OLMA (Retro 8-bit digital boom & Water balloon laser pop + digital confetti)
  playDeathPop() {
    if (this.muted) return;
    this._playFromBank('kill', 1.0, null, null, 0.04);
  }

  // 5A. SEVİYE ATLAMA, EŞYA SATIN ALMA / KUŞANMA & POWER-UP (Glowing neon arcade level-up chime "çing!")
  playPowerupPickup(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02) return;
    this._playFromBank('powerup', 0.92 * scale, worldX, camX, 0.03);
  }

  // 5B. FÜTÜRİSTİK HOLOGRAFİK ARAYÜZ TIKLAMA (Sleek digital button press, short holographic beep)
  playUiPop() {
    if (this.muted) return;
    this._playFromBank('ui', 0.72, null, null, 0.04);
  }
}

window.soundManager = new SoundManager();
