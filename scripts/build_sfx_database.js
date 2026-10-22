const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const SFX_DIR = path.join(__dirname, '..', 'public', 'sfx');

if (!fs.existsSync(SFX_DIR)) {
  fs.mkdirSync(SFX_DIR, { recursive: true });
}

let seed = 20261022;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
}

// Biquad filtre (Lowpass, Highpass, Bandpass)
function applyBiquad(samples, type, freq, q = 1.0) {
  const out = new Float32Array(samples.length);
  const w0 = (2 * Math.PI * Math.max(20, Math.min(SAMPLE_RATE * 0.48, freq))) / SAMPLE_RATE;
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

// 16-bit PCM WAV yazıcı (0ms attack + yumuşak stüdyo limiter)
function finalizeAndWriteWav(filename, rawBuffer, targetPeak = 0.94) {
  const out = new Float32Array(rawBuffer.length);
  let maxAbs = 0.0001;
  for (let i = 0; i < rawBuffer.length; i++) {
    const saturated = Math.tanh(rawBuffer[i] * 1.35);
    out[i] = saturated;
    if (Math.abs(saturated) > maxAbs) maxAbs = Math.abs(saturated);
  }

  const normGain = targetPeak / maxAbs;
  const fadeOutSamples = Math.min(Math.floor(SAMPLE_RATE * 0.014), Math.floor(out.length * 0.18));

  const wavBytes = 44 + out.length * 2;
  const buf = Buffer.alloc(wavBytes);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(wavBytes - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(out.length * 2, 40);

  for (let i = 0; i < out.length; i++) {
    let env = 1.0;
    if (i >= out.length - fadeOutSamples) {
      env = (out.length - 1 - i) / fadeOutSamples;
    }
    const val = Math.max(-1, Math.min(1, out[i] * normGain * env));
    const int16 = val < 0 ? Math.round(val * 32768) : Math.round(val * 32767);
    buf.writeInt16LE(int16, 44 + i * 2);
  }

  const fullPath = path.join(SFX_DIR, filename);
  fs.writeFileSync(fullPath, buf);
  return {
    filename,
    url: `/sfx/${filename}`,
    durationMs: Math.round((out.length / SAMPLE_RATE) * 1000),
    bytes: wavBytes
  };
}

// ============================================================================
// 1A. LAZER / OK FIRLATMA (shoot_1..3.wav)
// Prompt: "Sci-fi neon laser shoot, quick zap, retro arcade synth ping, snappy and energetic"
// Açıklama: Slime'ın lazer kemerini/okunu fırlattığı andaki hızlı, elektronik "ziyuv" veya "pew" sesi.
// ============================================================================
function generateLaserShootSound(variant = 0) {
  const duration = 0.135;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.06;

  let phase1 = 0;
  let phase2 = 0;
  let pingPhase = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Hızlı elektronik "ZİYUV / PEW" frekans düşüşü: 1850 Hz -> 210 Hz
    const laserFreq = (195 + 1680 * Math.exp(-t * 36)) * p;
    // Hafif FM parlaklığı (neon synth harmonikleri)
    const fmMod = Math.sin(2 * Math.PI * laserFreq * 2.0 * t) * 0.35;
    phase1 += (2 * Math.PI * laserFreq) / SAMPLE_RATE;
    phase2 += (2 * Math.PI * laserFreq * 1.5) / SAMPLE_RATE;

    // Parlak testere + sinüs hibrit neon lazer dalgası
    const sawPart = 2 * ((phase1 / (2 * Math.PI)) - Math.floor(0.5 + phase1 / (2 * Math.PI)));
    const sinePart = Math.sin(phase1 + fmMod);
    const subHarm = Math.sin(phase2) * 0.32;
    const laserEnv = Math.min(1, t / 0.0015) * Math.exp(-t * 19);

    // Başlangıçta (0 - 38ms) enerjik "Retro Arcade Synth Ping"
    const pingFreq = (variant % 2 === 0 ? 1480 : 1640) * p;
    pingPhase += (2 * Math.PI * pingFreq) / SAMPLE_RATE;
    const arcadePing = Math.sin(pingPhase) * Math.exp(-t * 65) * 0.48;

    // 0ms Snappy Zap Transient
    const zapClick = Math.sin(2 * Math.PI * 2900 * t) * Math.exp(-t * 190) * 0.42;

    mix[i] = (sinePart * 0.68 + sawPart * 0.32 + subHarm) * laserEnv + arcadePing + zapClick;
  }

  return finalizeAndWriteWav(`shoot_${variant + 1}.wav`, mix, 0.94);
}

// ============================================================================
// 1B. DUVARA / KAYAYA TUTUNMA (attach_1..3.wav)
// Prompt: "Rubber band snap attaching to a metal wall, futuristic electronic thud, short impact"
// Açıklama: Lazerin duvara veya hedefe yapıştığı andaki tok, gergin tutunma sesi.
// ============================================================================
function generateWallAttachSound(variant = 0) {
  const duration = 0.145;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.055;

  let thudPhase = 0;
  let rubberPhase = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) Futuristic Electronic Thud (Tok elektronik darbe: 165 Hz -> 52 Hz)
    const thudFreq = (52 + 125 * Math.exp(-t * 62)) * p;
    thudPhase += (2 * Math.PI * thudFreq) / SAMPLE_RATE;
    const electronicThud = Math.sin(thudPhase) * Math.exp(-t * 32) * 0.88;

    // 2) Metal Wall Short Impact (Metalik duvar rezonansı: 380Hz, 760Hz, 1240Hz)
    const metalImpact =
      (Math.sin(2 * Math.PI * 385 * p * t) * Math.exp(-t * 78) * 0.42 +
        Math.sin(2 * Math.PI * 790 * p * t) * Math.exp(-t * 105) * 0.28 +
        Math.sin(2 * Math.PI * 1320 * p * t) * Math.exp(-t * 145) * 0.18);

    // 3) Rubber Band Snap Tension (Gergin lastik kemer kilitlenme tınısı: 190Hz -> 325Hz -> 270Hz)
    const rubberFreq =
      (265 + 75 * Math.sin(Math.min(1, t / 0.045) * Math.PI) - 45 * Math.exp(-t * 90)) * p;
    rubberPhase += (2 * Math.PI * rubberFreq) / SAMPLE_RATE;
    const rubberEnv = Math.min(1, t / 0.003) * Math.exp(-t * 26);
    const rubberSnap =
      (Math.sin(rubberPhase) + 0.35 * Math.sin(rubberPhase * 2.0)) * rubberEnv * 0.62;

    mix[i] = electronicThud + metalImpact + rubberSnap;
  }

  return finalizeAndWriteWav(`attach_${variant + 1}.wav`, mix, 0.94);
}

// ============================================================================
// 2A. RAKİBİN LAZER KEMERİNİ KESME (slice_1..2.wav)
// Prompt: "High-pitched digital slice, energy beam cut, sharp sci-fi swish, bright glass shatter synth effect"
// Açıklama: Rakibin lazer kemerinin içinden hızla geçerken/keserken çıkan cam kırılması + lazer kesiği karışımı.
// ============================================================================
function generateEnemySliceSound(variant = 0) {
  const duration = 0.185;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + variant * 0.07;

  // 1) Sharp Sci-Fi Swish (Yüksek hızlı enerji bıçağı savrulması)
  const swishRaw = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, t / 0.008) * Math.exp(-t * 28);
    swishRaw[i] = rand() * env;
  }
  const swishBand = applyBiquad(swishRaw, 'bandpass', 2650 * p, 2.2);

  // 2) Bright Glass Shatter Synth Effect (Kristal/Cam kırılması yüksek frekanslı synth parçacıkları)
  const shardTimes = [0.002, 0.014, 0.027, 0.042, 0.058, 0.076];
  const shardFreqs = [2450, 3280, 4120, 2890, 4850, 3720];

  let slicePhase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Energy Beam Cut (Keskin dijital lazer kesiği: 2800 Hz -> 540 Hz)
    const beamFreq = (520 + 2350 * Math.exp(-t * 48)) * p;
    slicePhase += (2 * Math.PI * beamFreq) / SAMPLE_RATE;
    const digitalSlice =
      (Math.sin(slicePhase) + 0.45 * Math.sin(slicePhase * 2.4)) * Math.exp(-t * 26) * 0.72;

    // Cam kırılması kristal synth çınlamaları
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

  return finalizeAndWriteWav(`slice_${variant + 1}.wav`, mix, 0.95);
}

// ============================================================================
// 2B. KENDİ KEMERİNİ SAĞ TIK İLE KOPARMA (snap_1..3.wav)
// Prompt: "Electric wire snap, short high-voltage zap, bright spark sound, 8-bit arcade"
// Açıklama: Oyuncunun kendi kemerini sağ tık ile iptal edip kaçarken çıkan hızlı elektrikli kopma sesi.
// ============================================================================
function generateElectricWireSnapSound(variant = 0) {
  const duration = 0.13;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.06;

  // 8-bit parlak kıvılcım frekans adımları (Bright spark 8-bit arcade arpeggio)
  const sparkNotes = [1650, 2750, 1980, 3300, 2200, 3850];
  let wirePhase = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) Electric Wire Snap (Gergin elektrik teli kopuşu: 1120 Hz -> 240 Hz + yüksek voltaj FM cızırtısı)
    const wireFreq = (240 + 920 * Math.exp(-t * 44)) * p;
    const hvBuzz = Math.sin(2 * Math.PI * 185 * t) * 2.2;
    wirePhase += (2 * Math.PI * wireFreq) / SAMPLE_RATE;
    const wireSnap = Math.sin(wirePhase + hvBuzz) * Math.exp(-t * 28) * 0.75;

    // 2) 8-Bit Arcade Bright Spark (Kuantize kare/pulse kıvılcım atlamaları)
    const stepIdx = Math.min(sparkNotes.length - 1, Math.floor(t / 0.016));
    const sparkFreq = sparkNotes[stepIdx] * p;
    const rawSq = Math.sin(2 * Math.PI * sparkFreq * t) >= 0 ? 0.8 : -0.8;
    const sparkEnv = Math.exp(-t * 34);

    // 3) Kısa yüksek voltaj kıvılcım çıtırtısı
    const sparkCrackle = rand() * Math.exp(-t * 75) * 0.35;

    mix[i] = wireSnap + rawSq * sparkEnv * 0.42 + sparkCrackle;
  }

  return finalizeAndWriteWav(`snap_${variant + 1}.wav`, mix, 0.94);
}

// ============================================================================
// 3. ÇARPIŞMA VE SLIME DOKUSU (hit_1..2.wav)
// Prompt: "Squishy slime bounce, rubbery wet thud, cute arcade jump sound, cartoon boing, soft impact"
// Açıklama: Slime'ların duvarlara veya birbirlerine çarptıklarında çıkan jölemsi, esnek ve eğlenceli sekme sesi.
// ============================================================================
function generateSquishyBounceSound(variant = 0) {
  const duration = 0.165;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + variant * 0.08;

  let boingPhase = 0;
  let squishPhase = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) Cute Arcade Jump & Cartoon Boing (Yumuşak esnek "boing" frekans eğrisi: 155Hz -> 395Hz + jöle titremesi)
    const wobble = Math.sin(2 * Math.PI * 26 * t) * 28 * Math.exp(-t * 14);
    const boingFreq = (165 + 230 * (1 - Math.exp(-t * 36)) + wobble) * p;
    boingPhase += (2 * Math.PI * boingFreq) / SAMPLE_RATE;
    const boingEnv = Math.min(1, t / 0.004) * Math.exp(-t * 17);
    const cartoonBoing =
      (Math.sin(boingPhase) * 0.82 + Math.sin(boingPhase * 2) * 0.18) * boingEnv;

    // 2) Rubbery Wet Squish (Tatlı ıslak jöle dokusu: 620Hz -> 1280Hz -> 480Hz)
    const squishFreq = (520 + 680 * Math.sin(Math.min(1, t / 0.065) * Math.PI)) * p;
    squishPhase += (2 * Math.PI * squishFreq) / SAMPLE_RATE;
    const wetSquish = Math.sin(squishPhase) * Math.exp(-t * 32) * 0.34;

    // 3) Soft Impact (Yumuşak alt gövde dokunuşu, sertlik içermez)
    const softThud = Math.sin(2 * Math.PI * 110 * p * t) * Math.exp(-t * 45) * 0.45;

    mix[i] = cartoonBoing * 0.78 + wetSquish + softThud;
  }

  return finalizeAndWriteWav(`hit_${variant + 1}.wav`, mix, 0.9);
}

// ============================================================================
// 4. PATLAMA VE YOK OLMA (kill_1.wav & kill_2.wav)
// Prompt 1: "Retro arcade explosion, 8-bit digital boom, pixelated burst, short energetic crunch, sci-fi defeat sound"
// Prompt 2: "Popping a large water balloon with a laser, synth bass drop, funny pop, digital confetti sound"
// ============================================================================
function generateRetroExplosionKillSound() {
  const duration = 0.29;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  // 8-bit sci-fi defeat pitch steps
  const defeatNotes = [587.33, 493.88, 392.0, 293.66, 220.0, 146.83, 98.0];
  let boomPhase = 0;
  let heldNoise = 0;
  let holdCounter = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) Pixelated 8-bit Noise Burst (Sample & Hold bitcrushed crunch)
    const holdPeriod = Math.max(4, Math.floor(6 + t * 28));
    if (holdCounter <= 0) {
      heldNoise = rand();
      holdCounter = holdPeriod;
    }
    holdCounter--;
    const pixelCrunch = heldNoise * Math.exp(-t * 16) * 0.52;

    // 2) 8-Bit Digital Boom (180 Hz -> 42 Hz punchy synth sub drop)
    const boomFreq = 42 + 145 * Math.exp(-t * 24);
    boomPhase += (2 * Math.PI * boomFreq) / SAMPLE_RATE;
    const digitalBoom = Math.tanh(Math.sin(boomPhase) * 1.8) * Math.exp(-t * 11) * 0.78;

    // 3) Sci-Fi Arcade Defeat Arpeggio
    const stepIdx = Math.min(defeatNotes.length - 1, Math.floor(t / 0.036));
    const noteFreq = defeatNotes[stepIdx];
    const sqWave = Math.sin(2 * Math.PI * noteFreq * t) >= 0 ? 0.7 : -0.7;
    const noteEnv = Math.exp(-t * 9);

    mix[i] = digitalBoom + pixelCrunch + sqWave * noteEnv * 0.36;
  }

  return finalizeAndWriteWav('kill_1.wav', mix, 0.95);
}

function generateWaterBalloonLaserPopKillSound() {
  const duration = 0.28;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  let popPhase = 0;
  let bassPhase = 0;
  const confettiNotes = [1567.98, 2093.0, 2637.02, 3135.96]; // G6, C7, E7, G7 dijital konfeti

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) Laser Pop + Large Water Balloon Funny Pop (240Hz -> 780Hz -> 160Hz sulu balon patlaması)
    const popFreq =
      t < 0.028
        ? 320 + (t / 0.028) * 520
        : 165 + 675 * Math.exp(-(t - 0.028) * 55);
    popPhase += (2 * Math.PI * popFreq) / SAMPLE_RATE;
    const balloonPop = Math.sin(popPhase) * Math.exp(-t * 24) * 0.85;

    // 2) Synth Bass Drop (145 Hz -> 38 Hz tok elektronik bas düşüşü)
    const bassFreq = 38 + 112 * Math.exp(-t * 18);
    bassPhase += (2 * Math.PI * bassFreq) / SAMPLE_RATE;
    const bassDrop = Math.sin(bassPhase) * Math.exp(-t * 10) * 0.75;

    // 3) Digital Confetti Sound (Neşeli parıltılı konfeti kristalleri: 45ms - 250ms)
    let confetti = 0;
    for (let c = 0; c < confettiNotes.length; c++) {
      const startT = 0.035 + c * 0.032;
      if (t >= startT) {
        const dt = t - startT;
        confetti +=
          Math.sin(2 * Math.PI * confettiNotes[c] * dt) * Math.exp(-dt * 28) * 0.26;
      }
    }

    mix[i] = balloonPop + bassDrop + confetti;
  }

  return finalizeAndWriteWav('kill_2.wav', mix, 0.95);
}

// ============================================================================
// 5A. SEVİYE ATLAMA, EŞYA KUŞANMA & POWER-UP (powerup_1.wav)
// Prompt: "Arcade level up chime, glowing neon power up sound, bright synth melody, short magical burst"
// Açıklama: Slime mağazadan yeni bir eşya aldığında veya seviye yükselttiğinde çalan motive edici "çing!" sesi.
// ============================================================================
function generateArcadeLevelUpChime() {
  const duration = 0.34;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  // Parlak neon yükselen akor melodisi: C5 -> E5 -> G5 -> B5 -> C6 ("ÇİNG!")
  const notes = [
    { f: 523.25, start: 0.0, decay: 18, gain: 0.45 },
    { f: 659.25, start: 0.042, decay: 18, gain: 0.48 },
    { f: 783.99, start: 0.084, decay: 16, gain: 0.52 },
    { f: 987.77, start: 0.126, decay: 14, gain: 0.58 },
    { f: 1046.5, start: 0.165, decay: 9, gain: 0.75 },
    { f: 2093.0, start: 0.165, decay: 12, gain: 0.42 } // Parıltılı "Çing!" üst oktav
  ];

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let sum = 0;
    for (let n = 0; n < notes.length; n++) {
      const note = notes[n];
      if (t >= note.start) {
        const dt = t - note.start;
        const env = Math.min(1, dt / 0.003) * Math.exp(-dt * note.decay);
        // Glowing neon synth (detuned dual oscillator + bell harmonic)
        const sig =
          Math.sin(2 * Math.PI * note.f * dt) * 0.65 +
          Math.sin(2 * Math.PI * note.f * 1.004 * dt) * 0.35 +
          Math.sin(2 * Math.PI * note.f * 2.0 * dt) * 0.22;
        sum += sig * env * note.gain;
      }
    }
    mix[i] = sum;
  }

  return finalizeAndWriteWav('powerup_1.wav', mix, 0.92);
}

// ============================================================================
// 5B. FÜTÜRİSTİK ARAYÜZ TIKLAMA (ui_click.wav)
// Prompt: "Futuristic UI click, sleek digital button press, short holographic beep"
// Açıklama: Lobide veya mağazada menüler arası geçiş yaparken duyulacak temiz, modern tıklama sesleri.
// ============================================================================
function generateFuturisticUiClick() {
  const duration = 0.038;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Sleek holographic beep: 1420 Hz -> 2180 Hz pürüzsüz kristal bip
    const freq = t < 0.012 ? 1420 : 2180;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = Math.min(1, t / 0.0015) * Math.exp(-t * 95);
    mix[i] = (Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2) * env;
  }

  return finalizeAndWriteWav('ui_click.wav', mix, 0.82);
}

function generateMoveSound() {
  const duration = 0.075;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const f = 260 + 120 * Math.sin((t / duration) * Math.PI);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    mix[i] = Math.sin(phase) * Math.sin((t / duration) * Math.PI) * 0.35;
  }
  return finalizeAndWriteWav('move_1.wav', mix, 0.42);
}

function buildDatabase() {
  const db = {
    version: '5.0.0',
    generatedAt: new Date().toISOString(),
    sampleRate: SAMPLE_RATE,
    sounds: {
      shoot: [generateLaserShootSound(0), generateLaserShootSound(1), generateLaserShootSound(2)],
      attach: [generateWallAttachSound(0), generateWallAttachSound(1), generateWallAttachSound(2)],
      slice: [generateEnemySliceSound(0), generateEnemySliceSound(1)],
      snap: [generateElectricWireSnapSound(0), generateElectricWireSnapSound(1), generateElectricWireSnapSound(2)],
      hit: [generateSquishyBounceSound(0), generateSquishyBounceSound(1)],
      kill: [generateRetroExplosionKillSound(), generateWaterBalloonLaserPopKillSound()],
      powerup: [generateArcadeLevelUpChime()],
      ui: [generateFuturisticUiClick()],
      move: [generateMoveSound()]
    }
  };

  const manifestPath = path.join(SFX_DIR, 'sfx_db.json');
  fs.writeFileSync(manifestPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('[SFX DB v5.0] 15 Özel Sci-Fi Arcade & Slime WAV ses dosyası başarıyla üretildi:', manifestPath);
}

buildDatabase();
