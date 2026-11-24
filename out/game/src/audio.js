// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOn = false;
let sirenTimer = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { ctx = null; }
}

export function resumeAudio() {
  initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
}

function noiseBurst(dur, vol, lowpass) {
  if (!ctx) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) { /* ignore */ }
}

export function playGunshot() { noiseBurst(0.18, 0.5, 900); tone(160, 0.12, 'square', 0.2, 50); }
export function playPickup() { tone(660, 0.12, 'sine', 0.18); setTimeout(() => tone(990, 0.2, 'sine', 0.18), 90); }
export function playClick() { tone(520, 0.06, 'square', 0.1); }
export function playCrash() { noiseBurst(0.3, 0.4, 500); }
export function playHorn() { tone(370, 0.25, 'sawtooth', 0.12); tone(466, 0.25, 'sawtooth', 0.1); }
export function playMission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 120)); }
export function playBusted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.15), i * 160)); }

export function startEngine() {
  if (!ctx || engineOsc) return;
  try {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start();
  } catch (e) { engineOsc = null; }
}
export function setEngine(speed01, on) {
  if (!engineOsc || !engineGain) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.05 : 0.0, t, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.1);
}
export function stopEngine() {
  if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; engineGain = null; }
}

export function startSiren() {
  if (!ctx || sirenOn) return;
  sirenOn = true;
  let hi = true;
  sirenTimer = setInterval(() => {
    if (!sirenOn) return;
    tone(hi ? 880 : 660, 0.42, 'sine', 0.05);
    hi = !hi;
  }, 420);
}
export function stopSiren() {
  sirenOn = false;
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}
