// One prewarmed context and reusable PCM buffers for all four games.
let context, gain, ready = false, lastAt = 0, resuming = false, lastResume = -Infinity;
const buffers = new Map(), listeners = new Set();
let muted = false;
try { muted = localStorage.getItem('wr:arcade:sound:v1') === 'off'; } catch { /* Optional preference. */ }
function prewarm() {
  if (context || typeof window === 'undefined') return;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try {
    context = new C(); gain = context.createGain(); gain.gain.value = .12; gain.connect(context.destination);
    context.addEventListener('statechange', () => { ready = context.state === 'running'; });
    for (const [name, frequency, seconds] of [['correct', 660, .07], ['wrong', 180, .08], ['combo', 980, .12], ['countdown', 440, .1], ['start', 780, .14], ['finish', 880, .28]]) {
      const b = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) { const t = i / context.sampleRate; data[i] = Math.sin(2 * Math.PI * frequency * t * (1 + (name === 'wrong' ? -.2 : .2) * t / seconds)) * Math.min(1, t / .004) * (1 - t / seconds) ** 2; }
      buffers.set(name, b);
    }
  } catch { /* Gameplay remains independent from audio devices. */ }
}
function unlock() {
  const now = performance.now();
  if (!context || ready || muted || resuming || now - lastResume < 1500) return;
  resuming = true; lastResume = now;
  context.resume().catch(() => {}).finally(() => { resuming = false; });
}
if (typeof window !== 'undefined') {
  if (window.requestIdleCallback) window.requestIdleCallback(prewarm, { timeout: 1500 }); else setTimeout(prewarm, 0);
  window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock, { passive: true });
}
function play(name) {
  const now = performance.now();
  if (muted || !ready || document.hidden || now - lastAt < 85 || !buffers.has(name)) return;
  lastAt = now;
  const source = context.createBufferSource(); source.buffer = buffers.get(name); source.connect(gain); source.onended = () => source.disconnect(); source.start();
}
export const arcadeSound = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  isMuted: () => muted,
  setMuted(value) { muted = Boolean(value); try { localStorage.setItem('wr:arcade:sound:v1', muted ? 'off' : 'on'); } catch { /* Optional preference. */ } listeners.forEach((f) => f()); },
  play, playKey: () => play('correct'), playError: () => play('wrong'), playStreak: () => play('combo'), playCountdown: () => play('countdown'), playStart: () => play('start'), playWin: () => play('finish'),
};
