const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const SFX_DIR = path.join(__dirname, '..', 'public', 'sfx');

if (!fs.existsSync(SFX_DIR)) {
  fs.mkdirSync(SFX_DIR, { recursive: true });
}

// Deterministik ama zengin dokulu rastgele sayı üreteci
let seed = 133742;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
}

// Biquad filtre yardımcı fonksiyonu (Offline yüksek hassasiyetli DSP)
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
    // bandpass
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

// Karplus-Strong Fiziksel Tel / Halat / Yay Kirişi Modeli (Gerçekçi Akustik Kiriş ve Kopan Halat Fiziği)
function karplusStrongString(durationSec, baseFreq, tensionDropRatio = 1.0, damping = 0.992, brightness = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const out = new Float32Array(numSamples);
  const initPeriod = Math.max(8, Math.floor(SAMPLE_RATE / baseFreq));
  const ring = new Float32Array(initPeriod * 4);

  // Başlangıç darbesi: keskin fiziksel kiriş çekme / kopma enerjisi
  for (let i = 0; i < initPeriod; i++) {
    const window = Math.sin((i / initPeriod) * Math.PI);
    ring[i] = (rand() * 0.75 + Math.sin((i / initPeriod) * Math.PI * 2) * 0.25) * window;
  }

  let readIdx = 0;
  let prevSample = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = i / numSamples;
    const currentFreq = baseFreq * (1 - progress * (1 - tensionDropRatio));
    const period = Math.max(8, Math.min(ring.length - 2, Math.floor(SAMPLE_RATE / currentFreq)));

    const cur = ring[readIdx % period];
    const next = ring[(readIdx + 1) % period];
    const filtered = (cur * (1 - brightness) + next * brightness) * damping;
    // All-pass / DC blocker
    const shaped = filtered - prevSample * 0.02;
    prevSample = filtered;

    ring[readIdx % period] = shaped;
    out[i] = cur;
    readIdx++;
  }
  return out;
}

// Yumuşak Stüdyo Mastering Limiter & 0ms Attack Normalizer
function finalizeAndWriteWav(filename, rawBuffer, targetPeak = 0.94) {
  // İlk 0.5ms'den itibaren tam senkron başlaması için baştaki boşluğu sıfırla
  const out = new Float32Array(rawBuffer.length);
  let maxAbs = 0.0001;
  for (let i = 0; i < rawBuffer.length; i++) {
    // Analog tape soft-clipping (tok ve gerçekçi doygunluk)
    const x = rawBuffer[i];
    const saturated = Math.tanh(x * 1.45);
    out[i] = saturated;
    if (Math.abs(saturated) > maxAbs) maxAbs = Math.abs(saturated);
  }

  const normGain = targetPeak / maxAbs;
  const fadeOutSamples = Math.min(Math.floor(SAMPLE_RATE * 0.012), Math.floor(out.length * 0.15));

  const wavBytes = 44 + out.length * 2;
  const buf = Buffer.alloc(wavBytes);

  // RIFF WAVE Header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(wavBytes - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20);  // PCM format = 1
  buf.writeUInt16LE(1, 22);  // Mono = 1
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
// 1. TUTUNMA SESLERİ (attach_1.wav, attach_2.wav, attach_3.wav)
// 0ms Gecikmesiz Tok Kaya/Zemin Darbesi + Vakumlu Vantuz Mühürlemesi + Gergin Halat Kilitlenmesi
// ============================================================================
function generateAttachSound(variant = 0) {
  const duration = 0.165;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.065;

  // Katman 1: 0.0ms Anında Fiziksel Darbe & Kaya Gövde Rezonansı (Modal Impact)
  const modalFreqs = [64 * p, 108 * p, 172 * p, 265 * p];
  const modalDecays = [32, 48, 72, 110];
  const modalWeights = [0.75, 0.50, 0.30, 0.18];

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let modalSum = 0;
    for (let m = 0; m < modalFreqs.length; m++) {
      // Çarpma anında çok hafif akustik basınç sıkışması
      const f = modalFreqs[m] * (1 + 0.35 * Math.exp(-t * 95));
      modalSum += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * modalDecays[m]) * modalWeights[m];
    }

    // 0-9ms sert temas ve vantuz vakum mühürleme klik darbesi (Contact Transient)
    const clickEnv = Math.exp(-t * 210);
    const suctionSeal =
      t >= 0.008 && t <= 0.055
        ? Math.sin(2 * Math.PI * (240 * p + (t - 0.008) * 6200) * (t - 0.008)) *
          Math.exp(-(t - 0.008) * 68) *
          0.55
        : 0;

    mix[i] += modalSum + rand() * clickEnv * 0.65 + suctionSeal;
  }

  // Katman 2: Karplus-Strong Gergin Halat/Kemer Kancalanma Tınısı
  const rope = karplusStrongString(duration, 142 * p, 1.18, 0.985, 0.42);
  const ropeFiltered = applyBiquad(rope, 'bandpass', 480 * p, 1.8);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const ropeEnv = Math.min(1, t / 0.006) * Math.exp(-t * 24);
    mix[i] += ropeFiltered[i] * ropeEnv * 0.75;
  }

  // Katman 3: Ağır Organik Yüzey Vakum Doku Filtresi
  const noise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    noise[i] = rand() * Math.exp(-t * 52);
  }
  const wetImpact = applyBiquad(noise, 'bandpass', 780 * p, 2.1);
  for (let i = 0; i < len; i++) {
    mix[i] += wetImpact[i] * 0.65;
  }

  return finalizeAndWriteWav(`attach_${variant + 1}.wav`, mix, 0.95);
}

// ============================================================================
// 2. KEMER KIRILMA / KOPMA SESLERİ (snap_1.wav, snap_2.wav, snap_3.wav)
// 0ms Gecikmesiz Yüksek Gerilimli Halat/Yay Kırılması ("ÇAT-ŞLAK!") + Fiziksel Tel Boşalması
// ============================================================================
function generateSnapSound(variant = 0) {
  const duration = 0.195;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.07;

  // Katman 1: 0.0ms Süpersonik Kamçı / Gergin Lif Kırılma Çatlaması (Whip-Crack Impulse)
  const crackNoise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // İlk 14ms içinde keskin kırılma patlaması ve 22ms'de ikinci lif kopuşu
    const primaryCrack = Math.exp(-t * 165);
    const secondaryFiber = t > 0.014 ? Math.exp(-(t - 0.014) * 140) * 0.55 : 0;
    crackNoise[i] = rand() * (primaryCrack + secondaryFiber);
  }
  const highCrack = applyBiquad(crackNoise, 'bandpass', 2450 * p, 1.5);
  const midSnapBody = applyBiquad(crackNoise, 'bandpass', 920 * p, 1.9);

  // Katman 2: Karplus-Strong Kopan Gergin Tel / Halat Fiziği (Gerilim hızla düşer: tensionDropRatio = 0.36)
  const brokenString1 = karplusStrongString(duration, 330 * p, 0.34, 0.991, 0.38);
  const brokenString2 = karplusStrongString(duration, 475 * p, 0.38, 0.989, 0.45);

  // Katman 3: Hava Yarma / Geri Tepme Savrulması (Recoil Air Whip)
  const whipNoise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const whipEnv = Math.sin(Math.min(1, t / 0.09) * Math.PI) * Math.exp(-t * 20);
    whipNoise[i] = rand() * whipEnv;
  }
  const whipFiltered = applyBiquad(whipNoise, 'bandpass', 1280 * p, 2.2);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Tok gövde kopma darbesi (Wood/Kevlar Snap Thump)
    const bodySnap =
      Math.sin(2 * Math.PI * (195 * p * Math.exp(-t * 28)) * t) * Math.exp(-t * 42) * 0.72;

    const strEnv = Math.exp(-t * 16);
    mix[i] =
      highCrack[i] * 0.95 +
      midSnapBody[i] * 0.85 +
      bodySnap +
      (brokenString1[i] * 0.65 + brokenString2[i] * 0.45) * strEnv +
      whipFiltered[i] * 0.55;
  }

  return finalizeAndWriteWav(`snap_${variant + 1}.wav`, mix, 0.96);
}

// ============================================================================
// 3. ATEŞ / OK FIRLATMA SESLERİ (shoot_1.wav, shoot_2.wav, shoot_3.wav)
// 0ms Gecikmesiz Taktiksel Arbalet / Basınçlı Fırlatıcı ("TOK-ŞLAK!") + Aerodinamik Ok Hava Yarma ("FŞŞT!")
// ============================================================================
function generateShootSound(variant = 0) {
  const duration = 0.16;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + (variant - 1) * 0.055;

  // Katman 1: 0.0ms Mekanik/Pnömatik Tetik ve Yay Kirişi Boşalması (Crossbow / Slingshot Thwack)
  const bowString = karplusStrongString(duration, 185 * p, 0.72, 0.986, 0.48);
  const bowBody = applyBiquad(bowString, 'lowpass', 1350 * p, 1.4);

  // Katman 2: Aerodinamik Ok Hava Yarma (Doppler Air Whoosh)
  const airRaw = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // İlk 4ms'de hemen yükselen, 110ms boyunca havayı yaran gerçekçi mermi/ok rüzgarı
    const attack = Math.min(1, t / 0.005);
    const decay = Math.exp(-t * 24);
    airRaw[i] = rand() * attack * decay;
  }
  const airWhooshHigh = applyBiquad(airRaw, 'bandpass', 1950 * p, 1.8);
  const airWhooshMid = applyBiquad(airRaw, 'bandpass', 820 * p, 1.5);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Tok basınçlı namlu/gövde darbesi (0ms'de başlar!)
    const chamberPunch =
      Math.sin(2 * Math.PI * (128 * p + 140 * Math.exp(-t * 85)) * t) *
      Math.exp(-t * 46) *
      0.88;

    // 0-6ms keskin kiriş/namlu çıkış klik darbesi
    const muzzleTransient = rand() * Math.exp(-t * 260) * 0.6;

    mix[i] =
      chamberPunch +
      muzzleTransient +
      bowBody[i] * Math.exp(-t * 22) * 0.75 +
      airWhooshHigh[i] * 0.72 +
      airWhooshMid[i] * 0.65;
  }

  return finalizeAndWriteWav(`shoot_${variant + 1}.wav`, mix, 0.95);
}

// ============================================================================
// 4. İSABET / SAPLANMA SESLERİ (hit_1.wav, hit_2.wav)
// Tok Hedef Darbesi + Organik Saplanma
// ============================================================================
function generateHitSound(variant = 0) {
  const duration = 0.13;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  const p = 1.0 + variant * 0.08;

  const noise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    noise[i] = rand() * Math.exp(-t * 48);
  }
  const thwack = applyBiquad(noise, 'bandpass', 1050 * p, 1.7);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const heavyThud =
      Math.sin(2 * Math.PI * (92 * p + 110 * Math.exp(-t * 90)) * t) *
      Math.exp(-t * 42) *
      0.9;
    mix[i] = heavyThud + thwack[i] * 0.8;
  }

  return finalizeAndWriteWav(`hit_${variant + 1}.wav`, mix, 0.92);
}

// ============================================================================
// 5. RAKİP ELEME / ÖLÜM SESİ (kill_1.wav) & POWERUP / UI SESLERİ
// ============================================================================
function generateKillSound() {
  const duration = 0.28;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  const shatterNoise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    shatterNoise[i] = rand() * Math.exp(-t * 22);
  }
  const shatterBand = applyBiquad(shatterNoise, 'bandpass', 1420, 1.6);

  const chordString = karplusStrongString(duration, 220, 0.85, 0.993, 0.55);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const subDrop =
      Math.sin(2 * Math.PI * (76 + 130 * Math.exp(-t * 35)) * t) * Math.exp(-t * 15) * 0.85;
    mix[i] = subDrop + shatterBand[i] * 0.7 + chordString[i] * Math.exp(-t * 12) * 0.5;
  }

  return finalizeAndWriteWav('kill_1.wav', mix, 0.95);
}

function generatePowerupSound() {
  const duration = 0.24;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);

  const s1 = karplusStrongString(duration, 330, 1.0, 0.994, 0.6);
  const s2 = karplusStrongString(duration, 440, 1.0, 0.994, 0.6);
  const s3 = karplusStrongString(duration, 660, 1.0, 0.995, 0.65);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    mix[i] += s1[i] * Math.exp(-t * 14) * 0.5;
    if (t >= 0.045) {
      const i2 = i - Math.floor(0.045 * SAMPLE_RATE);
      mix[i] += s2[i2] * Math.exp(-(t - 0.045) * 14) * 0.55;
    }
    if (t >= 0.09) {
      const i3 = i - Math.floor(0.09 * SAMPLE_RATE);
      mix[i] += s3[i3] * Math.exp(-(t - 0.09) * 12) * 0.65;
    }
  }

  return finalizeAndWriteWav('powerup_1.wav', mix, 0.9);
}

function generateUiClickSound() {
  const duration = 0.045;
  const len = Math.floor(SAMPLE_RATE * duration);
  const mix = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const click = Math.sin(2 * Math.PI * 520 * Math.exp(-t * 45) * t) * Math.exp(-t * 95);
    const snap = rand() * Math.exp(-t * 220) * 0.4;
    mix[i] = click + snap;
  }
  return finalizeAndWriteWav('ui_click.wav', mix, 0.8);
}

const manifest = {
  version: '4.0',
  sampleRate: SAMPLE_RATE,
  generatedAt: new Date().toISOString(),
  sounds: {
    attach: [generateAttachSound(0), generateAttachSound(1), generateAttachSound(2)],
    snap: [generateSnapSound(0), generateSnapSound(1), generateSnapSound(2)],
    shoot: [generateShootSound(0), generateShootSound(1), generateShootSound(2)],
    hit: [generateHitSound(0), generateHitSound(1)],
    kill: [generateKillSound()],
    powerup: [generatePowerupSound()],
    ui: [generateUiClickSound()]
  }
};

fs.writeFileSync(path.join(SFX_DIR, 'sfx_db.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('[SFX-DB] 13 gerçekçi akustik WAV ses dosyası ve sfx_db.json oluşturuldu!');
