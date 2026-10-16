// Gelişmiş Web Audio API Ses Sentezleyici (Jöle Kıkırdaması, Duvar Boing/Sevinç Sesi, Gerçekçi Kemer "ÇAT!" Sesi)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.lastGiggleTime = 0;
    this.noiseBuffer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Kulak tırmalamayan dengeli ses için Compressor + Master Gain
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      compressor.knee.setValueAtTime(20, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(6, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      // "ÇAT!" kırbaç/kemer kopma sesi için Beyaz Gürültü (White Noise) tamponu hazırla
      const bufferSize = this.ctx.sampleRate * 0.25;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
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
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.muted;
  }

  // 1) Hareket ederken tatlı, yumuşak jöle baloncuk / kıkırdama sesi (Pentatonik notalarla)
  playCuteGiggle(speedRatio = 0.5) {
    if (this.muted) return;
    this.init();
    const now = performance.now();
    // Çok sık çalıp kafa ütülememesi için 2.4 saniye doğal aralık
    if (now - this.lastGiggleTime < 2400) return;
    this.lastGiggleTime = now;

    const t = this.ctx.currentTime;
    // Neşeli pentatonik frekanslar (C5, D5, E5, G5, A5)
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    const f1 = notes[Math.floor(Math.random() * notes.length)];
    const f2 = f1 * 1.25;

    // 3 küçük heceli tatlı "hih-hi-hi!" baloncuk efekti
    [0, 0.075, 0.15].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const startFreq = idx % 2 === 0 ? f1 : f2;
      osc.frequency.setValueAtTime(startFreq * 0.9, t + offset);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.18, t + offset + 0.055);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, t + offset);

      gain.gain.setValueAtTime(0.001, t + offset);
      gain.gain.linearRampToValueAtTime(0.06 * (0.7 + speedRatio * 0.3), t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.065);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + offset);
      osc.stop(t + offset + 0.07);
    });
  }

  // 2) Duvara çarpıp yeni kemer kazanınca: Jölemsi "BOİNG!" + Tatlı Sevinç Sesi
  playWallAttachScream() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Katman A: Jölemsi Bas Sekme ("Boing!")
    const bounceOsc = this.ctx.createOscillator();
    const bounceGain = this.ctx.createGain();
    bounceOsc.type = 'sine';
    bounceOsc.frequency.setValueAtTime(130, t);
    bounceOsc.frequency.exponentialRampToValueAtTime(290, t + 0.09);
    bounceOsc.frequency.exponentialRampToValueAtTime(165, t + 0.22);

    bounceGain.gain.setValueAtTime(0.22, t);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    bounceOsc.connect(bounceGain);
    bounceGain.connect(this.masterGain);
    bounceOsc.start(t);
    bounceOsc.stop(t + 0.25);

    // Katman B: Tatlı Sevinç Çığlığı ("Yaaay / Huuu!") - Formant filtreli
    const voiceOsc = this.ctx.createOscillator();
    const formant = this.ctx.createBiquadFilter();
    const voiceGain = this.ctx.createGain();

    voiceOsc.type = 'triangle';
    voiceOsc.frequency.setValueAtTime(440, t + 0.02);
    voiceOsc.frequency.exponentialRampToValueAtTime(784, t + 0.14); // G5
    voiceOsc.frequency.exponentialRampToValueAtTime(659.25, t + 0.24); // E5

    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1150, t + 0.02);
    formant.Q.setValueAtTime(2.5, t + 0.02);

    voiceGain.gain.setValueAtTime(0.001, t + 0.02);
    voiceGain.gain.linearRampToValueAtTime(0.18, t + 0.05);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    voiceOsc.connect(formant);
    formant.connect(voiceGain);
    voiceGain.connect(this.masterGain);
    voiceOsc.start(t + 0.02);
    voiceOsc.stop(t + 0.26);
  }

  // 3) Kemer koptuğunda tatmin edici gerçekçi "ÇAT / ŞLAK!" sesi
  playBandSnap() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Katman A: Kırbaç / Kemer "ÇAT!" Darbesi (Filtrelenmiş White Noise Burst)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, t);
      filter.frequency.exponentialRampToValueAtTime(650, t + 0.075);
      filter.Q.setValueAtTime(1.8, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + 0.085);
    }

    // Katman B: Elastik Geri Tepme Tınısı ("Twang!")
    const twangOsc = this.ctx.createOscillator();
    const twangGain = this.ctx.createGain();

    twangOsc.type = 'triangle';
    twangOsc.frequency.setValueAtTime(360, t);
    twangOsc.frequency.exponentialRampToValueAtTime(95, t + 0.14);

    twangGain.gain.setValueAtTime(0.28, t);
    twangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    twangOsc.connect(twangGain);
    twangGain.connect(this.masterGain);
    twangOsc.start(t);
    twangOsc.stop(t + 0.16);
  }

  // 4) Slime Oku Fırlatma Sesi ("Fiyuu / Plop!")
  playArrowShoot() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.14);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // 5) Oyuncu elendiğinde tatlı balon patlama / düşüş sesi
  playDeathPop() {
    if (this.muted) return;
    this.init();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.28);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.31);
  }
}

window.soundManager = new SoundManager();
