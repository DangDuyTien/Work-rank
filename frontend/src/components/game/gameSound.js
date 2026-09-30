// Web Audio API lightweight synthesizer for Capital Board game sound effects
class SoundController {
  constructor() {
    this.audioCtx = null;
    this.muted = localStorage.getItem('capital_board_sound_muted') === 'true';
  }

  init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('capital_board_sound_muted', String(this.muted));
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, volume = 0.2) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be blocked prior to user interaction
    }
  }

  // Dice roll rattle
  playDiceRoll() {
    if (this.muted) return;
    const notes = [220, 330, 440, 260, 380, 520];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.06, 0.12);
      }, idx * 45);
    });
  }

  // Coin sound for rent / bonus / purchase
  playCoin() {
    if (this.muted) return;
    this.playTone(987.77, 'sine', 0.1, 0.2); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'sine', 0.2, 0.25); // E6
    }, 80);
  }

  // Buy property sound
  playBuy() {
    if (this.muted) return;
    this.playTone(523.25, 'triangle', 0.1, 0.2); // C5
    setTimeout(() => {
      this.playTone(659.25, 'triangle', 0.15, 0.22); // E5
      setTimeout(() => {
        this.playTone(783.99, 'triangle', 0.25, 0.25); // G5
      }, 90);
    }, 90);
  }

  // Pay rent / tax (warning tone)
  playTax() {
    if (this.muted) return;
    this.playTone(392.00, 'sawtooth', 0.12, 0.15);
    setTimeout(() => {
      this.playTone(311.13, 'sawtooth', 0.2, 0.15);
    }, 110);
  }

  // Chance card draw
  playChance() {
    if (this.muted) return;
    const arpeggio = [440, 554.37, 659.25, 880];
    arpeggio.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.12, 0.18);
      }, idx * 60);
    });
  }

  // Victory fanfare
  playVictory() {
    if (this.muted) return;
    const melody = [
      { f: 523.25, d: 0.15, delay: 0 },
      { f: 659.25, d: 0.15, delay: 150 },
      { f: 783.99, d: 0.15, delay: 300 },
      { f: 1046.50, d: 0.45, delay: 450 },
    ];
    melody.forEach((item) => {
      setTimeout(() => {
        this.playTone(item.f, 'triangle', item.d, 0.3);
      }, item.delay);
    });
  }

  // Turn prompt ding
  playTurn() {
    if (this.muted) return;
    this.playTone(880, 'sine', 0.08, 0.15);
  }
}

export const gameSound = new SoundController();
export default gameSound;
