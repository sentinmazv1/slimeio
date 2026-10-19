// Slime.io v2.4 - Organik Sıvı/Jöle (Slime) Web Audio Ses Motoru (Mesafe Duyarlı & Gerçekçi Baloncuk/Squish Sentezi)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.lastMoveSquishTime = 0;
    this.lastSoundTimes = {};
    this.noiseBuffer = null;
  }

  _canTrigger(key, minIntervalMs = 55) {
    const now = performance.now();
    const prev = this.lastSoundTimes[key] || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastSoundTimes[key] = now;
    return true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      compressor.knee.setValueAtTime(24, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      // Yumuşak pembe/beyaz gürültü tamponu (su/slime şapırtısı ve elastik kopuş için)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.12;
        b1 = 0.96 * b1 + white * 0.18;
        b2 = 0.85 * b2 + white * 0.35;
        data[i] = Math.max(-1, Math.min(1, b0 + b1 + b2));
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
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime);
    }
    return this.muted;
  }

  // Kameraya olan mesafeye göre sesi doğal şekilde kıs (uzaktaki bot savaşları kafa ütülemesin)
  getDistanceScale(worldX, worldY, camX, camY) {
    if (typeof worldX !== 'number' || typeof worldY !== 'number' || typeof camX !== 'number' || typeof camY !== 'number') {
      return 1.0;
    }
    const dist = Math.hypot(worldX - camX, worldY - camY);
    if (dist <= 450) return 1.0;
    if (dist >= 1180) return 0;
    const norm = 1 - (dist - 450) / (1180 - 450);
    return norm * norm;
  }

  // Yardımcı: Gerçekçi Sıvı Damlacığı / Slime Baloncuğu ("Blup / Plop!")
  _spawnBubble(startFreq, endFreq, durationSec, peakGain, delaySec = 0) {
    if (!this.ctx || peakGain <= 0.001) return;
    const t = this.ctx.currentTime + delaySec;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + durationSec);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(endFreq * 1.6, t);
    filter.Q.setValueAtTime(4.2, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + durationSec * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + durationSec + 0.01);
  }

  // Yardımcı: Islak Jöle Şapırtısı ("Squish / Splat")
  _spawnWetSquish(startCutoff, endCutoff, durationSec, peakGain, delaySec = 0) {
    if (!this.ctx || !this.noiseBuffer || peakGain <= 0.001) return;
    const t = this.ctx.currentTime + delaySec;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startCutoff, t);
    filter.frequency.exponentialRampToValueAtTime(endCutoff, t + durationSec);
    filter.Q.setValueAtTime(3.2, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + durationSec * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(t);
    src.stop(t + durationSec + 0.01);
  }

  // 1) Hızlı süzülürken yumuşak, doğal jel hareket sesi ("Glup-blup")
  playCuteGiggle(speedRatio = 0.5) {
    if (this.muted) return;
    this.init();
    const now = performance.now();
    if (now - this.lastMoveSquishTime < 3400) return;
    this.lastMoveSquishTime = now;

    const base = 155 + Math.random() * 45;
    const vol = 0.055 * (0.65 + speedRatio * 0.35);
    this._spawnBubble(base, base * 2.05, 0.075, vol, 0);
    this._spawnBubble(base * 1.25, base * 2.45, 0.065, vol * 0.8, 0.065);
  }

  // 2) Kayaya / Duvara Yapışma ve Yeni Kemer Kazanma: Islak Vakum + Jöle Sekme ("Squish-Plop-Boing!")
  playWallAttachScream(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('wallAttach', 55)) return;
    this.init();

    const t = this.ctx.currentTime;

    // Katman A: Yumuşak Jöle Gövde Sekmesi (Wobbly Sub-Boing)
    const bodyOsc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const bodyGain = this.ctx.createGain();

    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(115, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(235, t + 0.075);
    bodyOsc.frequency.exponentialRampToValueAtTime(145, t + 0.22);

    // Jöle titreşimi (Wobble LFO)
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(22, t);
    lfoGain.gain.setValueAtTime(18, t);
    lfo.connect(bodyOsc.frequency);

    bodyGain.gain.setValueAtTime(0.001, t);
    bodyGain.gain.linearRampToValueAtTime(0.22 * scale, t + 0.02);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.masterGain);

    bodyOsc.start(t);
    lfo.start(t);
    bodyOsc.stop(t + 0.25);
    lfo.stop(t + 0.25);

    // Katman B: Islak Slime Vakum Baloncukları ("Plop-Blup!")
    this._spawnWetSquish(420, 980, 0.08, 0.18 * scale, 0);
    this._spawnBubble(190, 520, 0.085, 0.22 * scale, 0.015);
    this._spawnBubble(280, 680, 0.075, 0.16 * scale, 0.07);
  }

  // 3) Slime Kemeri Koptuğunda: Elastik Jel Kopuşu + Sıvı Sıçraması ("Boing-Şlak!")
  playBandSnap(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('bandSnap', 50)) return;
    this.init();

    const t = this.ctx.currentTime;

    // Katman A: Elastik Jel Yay Boşalması
    const elasticOsc = this.ctx.createOscillator();
    const elasticGain = this.ctx.createGain();
    elasticOsc.type = 'sine';
    elasticOsc.frequency.setValueAtTime(340, t);
    elasticOsc.frequency.exponentialRampToValueAtTime(88, t + 0.15);

    elasticGain.gain.setValueAtTime(0.24 * scale, t);
    elasticGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    elasticOsc.connect(elasticGain);
    elasticGain.connect(this.masterGain);
    elasticOsc.start(t);
    elasticOsc.stop(t + 0.17);

    // Katman B: Islak Şapırtı ve Damla Sıçraması
    this._spawnWetSquish(1350, 380, 0.065, 0.26 * scale, 0);
    this._spawnBubble(260, 590, 0.06, 0.15 * scale, 0.025);
  }

  // 4) Slime Oku Fırlatma: Basınçlı Jel Fırlatma ("Püt-Plop!")
  playArrowShoot(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('arrowShoot', 45)) return;
    this.init();

    this._spawnWetSquish(850, 340, 0.055, 0.18 * scale, 0);
    this._spawnBubble(185, 590, 0.09, 0.22 * scale, 0.005);
    this._spawnBubble(310, 740, 0.055, 0.11 * scale, 0.05);
  }

  // 5) Slime Oku Duvara veya Hedefe Çarptığında: Islak Jöle Yapışması ("Şlap!")
  playSlimeSplat(worldX, worldY, camX, camY) {
    if (this.muted) return;
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02 || !this._canTrigger('slimeSplat', 45)) return;
    this.init();

    const r = 0.85 + Math.random() * 0.3;
    this._spawnWetSquish(680 * r, 240, 0.07, 0.15 * scale, 0);
    this._spawnBubble(210 * r, 460 * r, 0.06, 0.12 * scale, 0.015);
  }

  // 6) Oyuncu Elendiğinde: Çoklu Slime Baloncuk Patlaması ("Bloop-Blup-Plop-Pop!")
  playDeathPop() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Gövde sönme sesi
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(240, t);
    subOsc.frequency.exponentialRampToValueAtTime(55, t + 0.28);
    subGain.gain.setValueAtTime(0.24, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.31);

    // Ardışık patlayan 5 eğlenceli slime baloncuğu
    const bubbleSteps = [
      { f1: 180, f2: 460, delay: 0.0, gain: 0.2 },
      { f1: 230, f2: 580, delay: 0.045, gain: 0.18 },
      { f1: 195, f2: 520, delay: 0.095, gain: 0.16 },
      { f1: 290, f2: 710, delay: 0.145, gain: 0.15 },
      { f1: 340, f2: 820, delay: 0.195, gain: 0.12 }
    ];
    for (const b of bubbleSteps) {
      this._spawnBubble(b.f1, b.f2, 0.07, b.gain, b.delay);
    }
    this._spawnWetSquish(720, 260, 0.14, 0.2, 0.01);
  }

  // 7) Arayüz / Bildirim / Tur Sonu Tatlı Su Damlası Sesi
  playUiPop() {
    if (this.muted) return;
    this.init();
    this._spawnBubble(290, 620, 0.065, 0.14, 0);
    this._spawnBubble(420, 840, 0.055, 0.1, 0.05);
  }

  // 8) Güçlendirme Kutusu (Power-Up) Alındığında: Neşeli Yükselen Kristal-Jöle Melodisi ("Blup-Bling-Pop!")
  playPowerupPickup(worldX, worldY, camX, camY) {
    if (this.muted) return;
    this.init();
    const scale = this.getDistanceScale(worldX, worldY, camX, camY);
    if (scale <= 0.02) return;

    const notes = [
      { f1: 310, f2: 640, delay: 0.0, gain: 0.18 * scale },
      { f1: 420, f2: 880, delay: 0.055, gain: 0.2 * scale },
      { f1: 560, f2: 1180, delay: 0.11, gain: 0.22 * scale }
    ];
    for (const n of notes) {
      this._spawnBubble(n.f1, n.f2, 0.08, n.gain, n.delay);
    }
    this._spawnWetSquish(520, 1280, 0.075, 0.14 * scale, 0.02);
  }
}

window.soundManager = new SoundManager();

