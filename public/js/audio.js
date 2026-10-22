// Slime.io v3.0 - Gerçekçi Fiziksel Modelleme (Physical Modeling) Web Audio Ses Motoru
// Tutunma (Vakumlu Vantuz & Gergin Halat), Kemer Kırılma (Yüksek Gerilimli Kamçı/Elastik Kopuş) ve Ateş (Basınçlı Yay + Hava Yarma Whoosh) Sentezi
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.muted = false;
    this.lastMoveSquishTime = 0;
    this.lastSoundTimes = {};
    this.pinkNoiseBuffer = null;
    this.whiteNoiseBuffer = null;
    this.saturationCurve = null;
  }

  _canTrigger(key, minIntervalMs = 45) {
    const now = performance.now();
    const prev = this.lastSoundTimes[key] || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastSoundTimes[key] = now;
    return true;
  }

  _makeSaturationCurve(amount = 24) {
    const nSamples = 1024;
    const curve = new Float32Array(nSamples);
    const k = typeof amount === 'number' ? amount : 24;
    for (let i = 0; i < nSamples; i++) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Tok ve patlamayan stüdyo tipi dinamik kompresör
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.88, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.saturationCurve = this._makeSaturationCurve(28);

      const sr = this.ctx.sampleRate;
      const bufferSize = Math.floor(sr * 0.45);

      // 1) Pembe Gürültü Tamponu (Organik ıslak jel, vantuz vakumu ve su şapırtısı için)
      this.pinkNoiseBuffer = this.ctx.createBuffer(1, bufferSize, sr);
      const pinkData = this.pinkNoiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.992 * b0 + white * 0.11;
        b1 = 0.965 * b1 + white * 0.17;
        b2 = 0.840 * b2 + white * 0.34;
        pinkData[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2) * 0.95));
      }

      // 2) Beyaz Gürültü Tamponu (Keskin kemer kırılma şaklaması ve ok hava yarma sesi için)
      this.whiteNoiseBuffer = this.ctx.createBuffer(1, bufferSize, sr);
      const whiteData = this.whiteNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        whiteData[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.88, this.ctx.currentTime);
    }
    return this.muted;
  }

  // Kameraya olan mesafeye göre doğal ses sönümlemesi
  getDistanceScale(worldX, worldY, camX, camY) {
    if (typeof worldX !== 'number' || typeof worldY !== 'number' || typeof camX !== 'number' || typeof camY !== 'number') {
      return 1.0;
    }
    const dist = Math.hypot(worldX - camX, worldY - camY);
    if (dist <= 460) return 1.0;
    if (dist >= 1250) return 0;
    const norm = 1 - (dist - 460) / (1250 - 460);
    return norm * norm;
  }

  // Stereo panlama (Sağdan/soldan gelen kemer kırılma ve atışların yönünü hissettirir)
  _createOutputBus(worldX, camX) {
    if (!this.ctx) return null;
    if (typeof this.ctx.createStereoPanner === 'function' && typeof worldX === 'number' && typeof camX === 'number') {
      const panner = this.ctx.createStereoPanner();
      const panVal = Math.max(-0.78, Math.min(0.78, (worldX - camX) / 720));
      panner.pan.setValueAtTime(panVal, this.ctx.currentTime);
      panner.connect(this.masterGain);
      return panner;
    }
    return this.masterGain;
  }

  // Yardımcı: Organik Rezonanslı Baloncuk / Vakum Damlası
  _spawnBubble(startFreq, endFreq, durationSec, peakGain, delaySec = 0, outNode = null) {
    if (!this.ctx || peakGain <= 0.001) return;
    const dest = outNode || this.masterGain;
    const t = this.ctx.currentTime + delaySec;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), t + durationSec);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(startFreq, endFreq) * 1.85, t);
    filter.Q.setValueAtTime(4.8, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + durationSec * 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + durationSec + 0.012);
  }

  // Yardımcı: Filtrelenmiş Islak/Hava Gürültü Darbesi
  _spawnNoiseBurst({
    useWhite = false,
    filterType = 'bandpass',
    startFreq = 800,
    endFreq = 400,
    q = 3.0,
    durationSec = 0.08,
    attackRatio = 0.12,
    peakGain = 0.2,
    delaySec = 0,
    outNode = null
  }) {
    if (!this.ctx || peakGain <= 0.001) return;
    const buf = useWhite ? this.whiteNoiseBuffer : this.pinkNoiseBuffer;
    if (!buf) return;
    const dest = outNode || this.masterGain;
    const t = this.ctx.currentTime + delaySec;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // Her seferinde farklı örnek noktasından başlat ki robotik/aynı duyulmasın
    const maxOffset = Math.max(0, buf.duration - durationSec - 0.02);
    const offset = Math.random() * maxOffset;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(30, startFreq), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + durationSec);
    filter.Q.setValueAtTime(q, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + Math.max(0.002, durationSec * attackRatio));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.start(t, offset, durationSec + 0.015);
    src.stop(t + durationSec + 0.018);
  }

  // 1) Hızlı süzülürken hafif jel hareket sesi
  playCuteGiggle(speedRatio = 0.5) {
    if (this.muted) return;
    this.init();
    const now = performance.now();
    if (now - this.lastMoveSquishTime < 3400) return;
    this.lastMoveSquishTime = now;

    const base = 160 + Math.random() * 40;
    const vol = 0.055 * (0.65 + speedRatio * 0.35);
    this._spawnBubble(base, base * 2.05, 0.07, vol, 0);
    this._spawnBubble(base * 1.25, base * 2.4, 0.06, vol * 0.8, 0.06);
  }

  // 2) TUTUNMA SESİ (Duvara/Kayaya Çarpıp Kemer Bağlama):
  // Tok Fiziksel Kaya Darbesi + Güçlü Vantuz Vakum Yapışması ("ŞLUP-TAK!") + Gerilen Elastik Kemer Sesi
  playWallAttachScream(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('wallAttach', 45)) return;
    this.init();

    const t = this.ctx.currentTime;
    const bus = this._createOutputBus(worldX, camX);
    const pitchVar = 0.94 + Math.random() * 0.12;

    // KATMAN A: Tok Kaya/Duvar Çarpma Gövde Darbesi (Sub-Bass Punch + Warm Saturation)
    const punchOsc = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const punchGain = this.ctx.createGain();

    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(148 * pitchVar, t);
    punchOsc.frequency.exponentialRampToValueAtTime(44 * pitchVar, t + 0.085);

    shaper.curve = this.saturationCurve;
    shaper.oversample = '2x';

    punchGain.gain.setValueAtTime(0.001, t);
    punchGain.gain.linearRampToValueAtTime(0.36 * scale, t + 0.005);
    punchGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.095);

    punchOsc.connect(shaper);
    shaper.connect(punchGain);
    punchGain.connect(bus);
    punchOsc.start(t);
    punchOsc.stop(t + 0.10);

    // KATMAN B: Gerçekçi Vantuz Vakum Kilitlenmesi ("ŞLUP-POP!")
    // Önce aşağı doğru vakum emişi, hemen ardından yukarı doğru keskin vantuz mühürleme sesi
    this._spawnBubble(320 * pitchVar, 115 * pitchVar, 0.038, 0.24 * scale, 0, bus);
    this._spawnBubble(175 * pitchVar, 860 * pitchVar, 0.068, 0.34 * scale, 0.024, bus);
    this._spawnBubble(340 * pitchVar, 1180 * pitchVar, 0.048, 0.20 * scale, 0.062, bus);

    // KATMAN C: Kemer Halatının Gerilme / Kancalanma Sesi (Elastic Tether Tension Stretch)
    const ropeOsc = this.ctx.createOscillator();
    const ropeFilter = this.ctx.createBiquadFilter();
    const ropeGain = this.ctx.createGain();

    ropeOsc.type = 'sawtooth';
    ropeOsc.frequency.setValueAtTime(115 * pitchVar, t + 0.015);
    ropeOsc.frequency.exponentialRampToValueAtTime(285 * pitchVar, t + 0.095);
    ropeOsc.frequency.exponentialRampToValueAtTime(190 * pitchVar, t + 0.165);

    ropeFilter.type = 'bandpass';
    ropeFilter.frequency.setValueAtTime(520, t + 0.015);
    ropeFilter.frequency.exponentialRampToValueAtTime(1150, t + 0.11);
    ropeFilter.Q.setValueAtTime(4.5, t + 0.015);

    ropeGain.gain.setValueAtTime(0.0001, t + 0.015);
    ropeGain.gain.linearRampToValueAtTime(0.16 * scale, t + 0.045);
    ropeGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.17);

    ropeOsc.connect(ropeFilter);
    ropeFilter.connect(ropeGain);
    ropeGain.connect(bus);
    ropeOsc.start(t + 0.015);
    ropeOsc.stop(t + 0.18);

    // KATMAN D: Islak Jel Yüzey Şapırtısı (Wet Suction Transient)
    this._spawnNoiseBurst({
      useWhite: false,
      filterType: 'bandpass',
      startFreq: 520 * pitchVar,
      endFreq: 1850 * pitchVar,
      q: 3.4,
      durationSec: 0.07,
      attackRatio: 0.08,
      peakGain: 0.25 * scale,
      delaySec: 0.004,
      outNode: bus
    });
  }

  // 3) KEMER KIRILMA / KOPMA SESİ:
  // Yüksek Gerilimli Elastik Halat Kırılması ("ÇAT / ŞLAK!") + Kamçı Geri Tepmesi ("VİİÜÜ-BOİNG!") + Jel Parçalanması
  playBandSnap(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('bandSnap', 38)) return;
    this.init();

    const t = this.ctx.currentTime;
    const bus = this._createOutputBus(worldX, camX);
    const pitchVar = 0.93 + Math.random() * 0.14;

    // KATMAN A: Keskin Kırılma / Kamçı Çatlaması Transient ("ÇAT! / ŞLAK!")
    // Gerilmiş yayın/kemerin koptuğu ilk 22 milisaniyelik yüksek enerjili kırılma darbesi
    const snapClickOsc = this.ctx.createOscillator();
    const snapClickGain = this.ctx.createGain();
    snapClickOsc.type = 'triangle';
    snapClickOsc.frequency.setValueAtTime(1450 * pitchVar, t);
    snapClickOsc.frequency.exponentialRampToValueAtTime(135 * pitchVar, t + 0.028);

    snapClickGain.gain.setValueAtTime(0.42 * scale, t);
    snapClickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

    snapClickOsc.connect(snapClickGain);
    snapClickGain.connect(bus);
    snapClickOsc.start(t);
    snapClickOsc.stop(t + 0.035);

    // Yüksek frekanslı kamçı şaklaması (Whip-Crack White Noise Impulse)
    this._spawnNoiseBurst({
      useWhite: true,
      filterType: 'bandpass',
      startFreq: 3200 * pitchVar,
      endFreq: 950 * pitchVar,
      q: 2.2,
      durationSec: 0.042,
      attackRatio: 0.04,
      peakGain: 0.38 * scale,
      delaySec: 0,
      outNode: bus
    });

    // KATMAN B: Kopan Kemerin Havayı Yararak Geri Tepmesi (Dual-Detuned Elastic Recoil Twang)
    const twang1 = this.ctx.createOscillator();
    const twang2 = this.ctx.createOscillator();
    const twangFilter = this.ctx.createBiquadFilter();
    const twangShaper = this.ctx.createWaveShaper();
    const twangGain = this.ctx.createGain();

    twang1.type = 'sawtooth';
    twang2.type = 'triangle';

    twang1.frequency.setValueAtTime(540 * pitchVar, t + 0.006);
    twang1.frequency.exponentialRampToValueAtTime(84 * pitchVar, t + 0.19);

    twang2.frequency.setValueAtTime(760 * pitchVar, t + 0.006);
    twang2.frequency.exponentialRampToValueAtTime(118 * pitchVar, t + 0.17);

    // Kopan lastiğin titreşimli (vibrato) salınımı
    const vibLfo = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vibLfo.type = 'sine';
    vibLfo.frequency.setValueAtTime(38, t);
    vibGain.gain.setValueAtTime(28, t);
    vibLfo.connect(vibGain);
    vibGain.connect(twang1.frequency);
    vibGain.connect(twang2.frequency);

    twangFilter.type = 'lowpass';
    twangFilter.frequency.setValueAtTime(2900 * pitchVar, t + 0.006);
    twangFilter.frequency.exponentialRampToValueAtTime(210 * pitchVar, t + 0.19);
    twangFilter.Q.setValueAtTime(5.2, t + 0.006);

    twangShaper.curve = this.saturationCurve;

    twangGain.gain.setValueAtTime(0.001, t);
    twangGain.gain.linearRampToValueAtTime(0.32 * scale, t + 0.012);
    twangGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.20);

    twang1.connect(twangFilter);
    twang2.connect(twangFilter);
    twangFilter.connect(twangShaper);
    twangShaper.connect(twangGain);
    twangGain.connect(bus);

    twang1.start(t + 0.006);
    twang2.start(t + 0.006);
    vibLfo.start(t + 0.006);
    twang1.stop(t + 0.21);
    twang2.stop(t + 0.21);
    vibLfo.stop(t + 0.21);

    // KATMAN C: Kopan Kemerden Etrafa Saçılan Islak Jel Damlaları
    this._spawnNoiseBurst({
      useWhite: false,
      filterType: 'bandpass',
      startFreq: 1650 * pitchVar,
      endFreq: 420 * pitchVar,
      q: 3.0,
      durationSec: 0.085,
      attackRatio: 0.1,
      peakGain: 0.28 * scale,
      delaySec: 0.012,
      outNode: bus
    });
    this._spawnBubble(390 * pitchVar, 780 * pitchVar, 0.048, 0.18 * scale, 0.028, bus);
    this._spawnBubble(280 * pitchVar, 610 * pitchVar, 0.045, 0.14 * scale, 0.065, bus);
  }

  // 4) ATEŞ / OK FIRLATMA SESİ:
  // Basınçlı Yay/Sapan Boşalması ("TOK-PÜF!") + Aerodinamik Hava Yarma ("FŞŞŞT!") + Plazma Jel Çıkışı
  playArrowShoot(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('arrowShoot', 38)) return;
    this.init();

    const t = this.ctx.currentTime;
    const bus = this._createOutputBus(worldX, camX);
    const pitchVar = 0.95 + Math.random() * 0.10;

    // KATMAN A: Basınçlı Namlu / Yay İtiş Darbesi (Pneumatic Launch Thump)
    const thumpOsc = this.ctx.createOscillator();
    const thumpShaper = this.ctx.createWaveShaper();
    const thumpGain = this.ctx.createGain();

    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(245 * pitchVar, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(52 * pitchVar, t + 0.068);

    thumpShaper.curve = this.saturationCurve;

    thumpGain.gain.setValueAtTime(0.001, t);
    thumpGain.gain.linearRampToValueAtTime(0.38 * scale, t + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);

    thumpOsc.connect(thumpShaper);
    thumpShaper.connect(thumpGain);
    thumpGain.connect(bus);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.08);

    // KATMAN B: Gergin Kemer Yayının Fırlatma Tınısı (Bowstring Release Snap)
    const bowOsc = this.ctx.createOscillator();
    const bowFilter = this.ctx.createBiquadFilter();
    const bowGain = this.ctx.createGain();

    bowOsc.type = 'triangle';
    bowOsc.frequency.setValueAtTime(590 * pitchVar, t);
    bowOsc.frequency.exponentialRampToValueAtTime(145 * pitchVar, t + 0.052);

    bowFilter.type = 'lowpass';
    bowFilter.frequency.setValueAtTime(2200, t);
    bowFilter.frequency.exponentialRampToValueAtTime(480, t + 0.055);
    bowFilter.Q.setValueAtTime(3.8, t);

    bowGain.gain.setValueAtTime(0.28 * scale, t);
    bowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.058);

    bowOsc.connect(bowFilter);
    bowFilter.connect(bowGain);
    bowGain.connect(bus);
    bowOsc.start(t);
    bowOsc.stop(t + 0.062);

    // KATMAN C: Yüksek Hızlı Okun Havayı Yarma Sesi (High-Velocity Air Whoosh "FŞŞŞT!")
    const whooshSrc = this.ctx.createBufferSource();
    whooshSrc.buffer = this.whiteNoiseBuffer;
    const maxOffset = Math.max(0, this.whiteNoiseBuffer.duration - 0.14);
    const whooshFilter = this.ctx.createBiquadFilter();
    const whooshGain = this.ctx.createGain();

    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(620 * pitchVar, t + 0.004);
    whooshFilter.frequency.exponentialRampToValueAtTime(2850 * pitchVar, t + 0.048);
    whooshFilter.frequency.exponentialRampToValueAtTime(740 * pitchVar, t + 0.125);
    whooshFilter.Q.setValueAtTime(2.6, t + 0.004);

    whooshGain.gain.setValueAtTime(0.0001, t + 0.004);
    whooshGain.gain.linearRampToValueAtTime(0.30 * scale, t + 0.026);
    whooshGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);

    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(bus);
    whooshSrc.start(t + 0.004, Math.random() * maxOffset, 0.135);
    whooshSrc.stop(t + 0.14);

    // KATMAN D: Basınçlı Slime Mermi Çıkış Patlaması ("Plop-Zing!")
    this._spawnBubble(260 * pitchVar, 890 * pitchVar, 0.058, 0.25 * scale, 0.006, bus);
  }

  // 5) OKUN DUVARA VEYA HEDEFE ÇARPMA SESİ:
  // Ağır Islak Jel Çarpma Darbesi ("ŞLAP-TOK!")
  playSlimeSplat(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('slimeSplat', 40)) return;
    this.init();

    const t = this.ctx.currentTime;
    const bus = this._createOutputBus(worldX, camX);
    const r = 0.88 + Math.random() * 0.24;

    // Çarpma tok darbesi
    const hitOsc = this.ctx.createOscillator();
    const hitGain = this.ctx.createGain();
    hitOsc.type = 'triangle';
    hitOsc.frequency.setValueAtTime(165 * r, t);
    hitOsc.frequency.exponentialRampToValueAtTime(46 * r, t + 0.065);

    hitGain.gain.setValueAtTime(0.24 * scale, t);
    hitGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    hitOsc.connect(hitGain);
    hitGain.connect(bus);
    hitOsc.start(t);
    hitOsc.stop(t + 0.075);

    // Islak şapırtı ve sıçrayan damlalar
    this._spawnNoiseBurst({
      useWhite: false,
      filterType: 'bandpass',
      startFreq: 1250 * r,
      endFreq: 310 * r,
      q: 2.8,
      durationSec: 0.08,
      attackRatio: 0.08,
      peakGain: 0.24 * scale,
      delaySec: 0,
      outNode: bus
    });
    this._spawnBubble(220 * r, 540 * r, 0.055, 0.16 * scale, 0.012, bus);
    this._spawnBubble(340 * r, 720 * r, 0.045, 0.12 * scale, 0.042, bus);
  }

  // 6) Oyuncu Elendiğinde: Güçlü Jel Patlaması + Bas Düşüşü + Saçılan Baloncuklar
  playDeathPop() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Derin gövde patlama ve sönme bası
    const subOsc = this.ctx.createOscillator();
    const subShaper = this.ctx.createWaveShaper();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(260, t);
    subOsc.frequency.exponentialRampToValueAtTime(42, t + 0.32);

    subShaper.curve = this.saturationCurve;
    subGain.gain.setValueAtTime(0.36, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    subOsc.connect(subShaper);
    subShaper.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.35);

    // İlk patlama şapırtısı
    this._spawnNoiseBurst({
      useWhite: true,
      filterType: 'bandpass',
      startFreq: 1900,
      endFreq: 340,
      q: 2.4,
      durationSec: 0.15,
      attackRatio: 0.06,
      peakGain: 0.28,
      delaySec: 0
    });

    // Ardışık patlayan 5 organik slime parçacığı
    const bubbleSteps = [
      { f1: 190, f2: 490, delay: 0.0, gain: 0.22 },
      { f1: 240, f2: 610, delay: 0.045, gain: 0.20 },
      { f1: 205, f2: 540, delay: 0.095, gain: 0.18 },
      { f1: 310, f2: 740, delay: 0.145, gain: 0.16 },
      { f1: 370, f2: 880, delay: 0.195, gain: 0.14 }
    ];
    for (const b of bubbleSteps) {
      this._spawnBubble(b.f1, b.f2, 0.07, b.gain, b.delay);
    }
  }

  // 7) Arayüz / Bildirim Sesi
  playUiPop() {
    if (this.muted) return;
    this.init();
    this._spawnBubble(310, 660, 0.06, 0.15, 0);
    this._spawnBubble(450, 910, 0.05, 0.11, 0.045);
  }

  // 8) Güçlendirme Kutusu (Power-Up) Alındığında: Parlak Enerji + Jel Yükselişi
  playPowerupPickup(worldX, worldY, camX, camY) {
    if (this.muted) return;
    this.init();
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02) return;
    const bus = this._createOutputBus(worldX, camX);

    const notes = [
      { f1: 320, f2: 660, delay: 0.0, gain: 0.20 * scale },
      { f1: 440, f2: 920, delay: 0.055, gain: 0.22 * scale },
      { f1: 580, f2: 1240, delay: 0.11, gain: 0.25 * scale }
    ];
    for (const n of notes) {
      this._spawnBubble(n.f1, n.f2, 0.08, n.gain, n.delay, bus);
    }
    this._spawnNoiseBurst({
      useWhite: false,
      filterType: 'bandpass',
      startFreq: 560,
      endFreq: 1420,
      q: 3.2,
      durationSec: 0.08,
      attackRatio: 0.15,
      peakGain: 0.16 * scale,
      delaySec: 0.02,
      outNode: bus
    });
  }
}

window.soundManager = new SoundManager();
