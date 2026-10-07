'use strict';

/**
 * High-Performance Web Audio API Mechanical Keyboard Synthesizer
 * Provides authentic, crisp "tách tách" mechanical switch sounds, pleasant error feedback,
 * and game event sound effects with zero external audio assets.
 */

let audioCtx = null;
let isMuted = false;
let masterVolume = 0.65;
let currentSwitchProfile = 'blue'; // 'blue' (Clicky Tách Tách) | 'thock' (Holy Panda / Warm) | 'linear' (Red Smooth)

// Pre-allocated noise buffer for zero-garbage-collection instantaneous key clicks
let precomputedNoiseBuffer = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function getNoiseBuffer(ctx) {
  if (precomputedNoiseBuffer && precomputedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return precomputedNoiseBuffer;
  }
  const bufferSize = Math.floor(ctx.sampleRate * 0.06); // 60ms noise buffer
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  precomputedNoiseBuffer = buffer;
  return buffer;
}

// Generates pseudo-random deterministic pitch jitter per key so typing sounds organic
function getCharPitchMultiplier(keyOrChar = '') {
  if (!keyOrChar) return 1.0;
  let hash = 0;
  const str = String(keyOrChar);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Jitter within range [0.93, 1.07]
  const normalized = (Math.abs(hash) % 100) / 100;
  return 0.93 + normalized * 0.14;
}

export const typingSound = {
  isMuted() {
    return isMuted;
  },

  setMuted(muted) {
    isMuted = Boolean(muted);
    return isMuted;
  },

  toggleMute() {
    isMuted = !isMuted;
    return isMuted;
  },

  getVolume() {
    return masterVolume;
  },

  setVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, Number(vol) || 0.65));
    return masterVolume;
  },

  getSwitchProfile() {
    return currentSwitchProfile;
  },

  setSwitchProfile(profile) {
    if (['blue', 'thock', 'linear'].includes(profile)) {
      currentSwitchProfile = profile;
    }
    return currentSwitchProfile;
  },

  /**
   * 1. Authentic Mechanical Keyboard Keypress Sound ("Tách Tách")
   * Downstroke tactile click + body clack + plate bottom-out resonance
   */
  playKey(keyOrChar = '', isSpecial = false) {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const jitter = getCharPitchMultiplier(keyOrChar);
      const isSpace = keyOrChar === ' ' || keyOrChar === 'Space';
      const isEnter = keyOrChar === '\n' || keyOrChar === 'Enter';
      const isBackspace = keyOrChar === 'Backspace';

      // ── A. TACTILE CLICK / SNAP TRANSIENT ("Tách") ──
      if (currentSwitchProfile === 'blue' || isSpecial) {
        const noiseBuf = getNoiseBuffer(ctx);
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuf;

        const clickFilter = ctx.createBiquadFilter();
        clickFilter.type = 'bandpass';
        // Sharp tactile snap frequency
        const clickFreq = (isSpace ? 2800 : isEnter ? 3200 : 3800) * jitter;
        clickFilter.frequency.setValueAtTime(clickFreq, now);
        clickFilter.Q.setValueAtTime(5.5, now);

        const clickGain = ctx.createGain();
        const baseClickVol = 0.18 * masterVolume;
        clickGain.gain.setValueAtTime(baseClickVol, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

        noiseSource.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + 0.015);
      }

      // ── B. KEYCAP & SWITCH BODY BOTTOM-OUT ("Clack / Thock") ──
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const lowFilter = ctx.createBiquadFilter();

      let baseFreq = 520;
      let decayTime = 0.032;
      let bodyVol = 0.12 * masterVolume;

      if (currentSwitchProfile === 'thock') {
        // Deep, creamy Holy Panda thock
        baseFreq = 340;
        decayTime = 0.045;
        bodyVol = 0.16 * masterVolume;
        osc.type = 'triangle';
        lowFilter.type = 'lowpass';
        lowFilter.frequency.setValueAtTime(1200, now);
      } else if (currentSwitchProfile === 'linear') {
        // Soft smooth linear tap
        baseFreq = 420;
        decayTime = 0.026;
        bodyVol = 0.09 * masterVolume;
        osc.type = 'sine';
        lowFilter.type = 'lowpass';
        lowFilter.frequency.setValueAtTime(1400, now);
      } else {
        // Crisp Blue Switch clack
        baseFreq = 480;
        decayTime = 0.03;
        bodyVol = 0.11 * masterVolume;
        osc.type = 'triangle';
        lowFilter.type = 'bandpass';
        lowFilter.frequency.setValueAtTime(650, now);
        lowFilter.Q.setValueAtTime(1.8, now);
      }

      // Stabilized key adjustments
      if (isSpace) {
        baseFreq = 240;
        decayTime = 0.052;
        bodyVol *= 1.35;
      } else if (isEnter) {
        baseFreq = 310;
        decayTime = 0.042;
        bodyVol *= 1.2;
      } else if (isBackspace) {
        baseFreq = 390;
        decayTime = 0.025;
      }

      const fundamentalFreq = Math.max(120, baseFreq * jitter);
      osc.frequency.setValueAtTime(fundamentalFreq, now);
      // Subtle fast pitch sweep on bottom-out
      osc.frequency.exponentialRampToValueAtTime(fundamentalFreq * 0.7, now + decayTime);

      oscGain.gain.setValueAtTime(bodyVol, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

      osc.connect(lowFilter);
      lowFilter.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + decayTime + 0.005);
    } catch {
      // Best-effort audio synthesis
    }
  },

  /**
   * 2. Gentle & Pleasant Mechanical Error Sound ("Tiếng Sai")
   * Soft, distinct muted wooden thud / switch blocker (non-jarring, clear feedback)
   */
  playError() {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Soft lowpass muted tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      // Descending pleasant hollow wood tap
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.065);

      const errVol = 0.14 * masterVolume;
      gain.gain.setValueAtTime(errVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);

      // Muted tactile snap
      const noiseBuf = getNoiseBuffer(ctx);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf;

      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.setValueAtTime(1600, now);
      clickFilter.Q.setValueAtTime(3.0, now);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.08 * masterVolume, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noiseSource.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.025);
    } catch {
      // Best-effort audio synthesis
    }
  },

  /**
   * 3. Countdown Beep Chime
   */
  playCountdown() {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5

      gain.gain.setValueAtTime(0.12 * masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Audio fallback
    }
  },

  /**
   * 4. Match Start Uplifting Chime
   */
  playStart() {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: G5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.12 * masterVolume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2: C6
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.08);
      gain2.gain.setValueAtTime(0.15 * masterVolume, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);
    } catch {
      // Audio fallback
    }
  },

  /**
   * 5. Victory Fanfare Chime
   */
  playWin() {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.15 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.15 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.2 }, // G5
        { freq: 1046.5, time: 0.38, dur: 0.55 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        gain.gain.setValueAtTime(0.12 * masterVolume, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } catch {
      // Audio fallback
    }
  },

  /**
   * 6. Fast typing streak / combo pop
   */
  playStreak() {
    if (isMuted || masterVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.07 * masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Audio fallback
    }
  },
};

export default typingSound;
