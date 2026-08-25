/**
 * audio.js - Web Audio API Synthesizer & Music Engine for "Cloud Runner"
 * 100% procedural sound synthesis (no external audio files required).
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Music scheduler state
    this.isPlayingMusic = false;
    this.tempo = 124; // BPM
    this.stepDuration = 60 / this.tempo / 4; // 16th note in seconds (~0.121s)
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.musicTimer = null;

    // Synthwave bass / lead note frequencies (Cyberpunk D minor / F / C / Bb progression)
    // Scale: D, F, G, A, C, D
    this.bassNotes = [
      73.42, 73.42, 73.42, 73.42,   // D2
      65.41, 65.41, 65.41, 65.41,   // C2
      58.27, 58.27, 58.27, 58.27,   // Bb1
      65.41, 65.41, 87.31, 87.31,   // C2 / F2
    ];

    this.leadPattern = [
      // Bar 1 (D minor)
      293.66, 0, 349.23, 0, 440.00, 0, 523.25, 440.00, 349.23, 0, 293.66, 0, 349.23, 440.00, 0, 0,
      // Bar 2 (C Major)
      261.63, 0, 329.63, 0, 392.00, 0, 523.25, 392.00, 329.63, 0, 261.63, 0, 329.63, 392.00, 0, 0,
      // Bar 3 (Bb Major)
      233.08, 0, 293.66, 0, 349.23, 0, 466.16, 349.23, 293.66, 0, 233.08, 0, 293.66, 349.23, 0, 0,
      // Bar 4 (A minor / Turnaround)
      220.00, 0, 261.63, 0, 329.63, 0, 440.00, 0, 392.00, 349.23, 329.63, 293.66, 261.63, 246.94, 220.00, 0
    ];

    this.loadMutePreference();
  }

  loadMutePreference() {
    try {
      const saved = localStorage.getItem('cloudrunner_muted');
      if (saved !== null) {
        this.isMuted = JSON.parse(saved);
      }
    } catch {
      this.isMuted = false;
    }
  }

  saveMutePreference() {
    try {
      localStorage.setItem('cloudrunner_muted', JSON.stringify(this.isMuted));
    } catch {}
  }

  /**
   * Initializes the AudioContext on first user interaction.
   */
  init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.saveMutePreference();

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, now, 0.05);
    }
    return this.isMuted;
  }

  setMute(mute) {
    if (this.isMuted === mute) return;
    this.toggleMute();
  }

  /* ------------------- SFX SYNTHESIZERS ------------------- */

  /**
   * Plays a jump sound (retro rising pitch chirp)
   */
  playJump() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  /**
   * Plays a double jump sound (higher octave sparkly double chirp)
   */
  playDoubleJump() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      osc.frequency.setValueAtTime(700, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  /**
   * Plays collision / hurt sound (punchy impact + noise distortion)
   */
  playHurt() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;

      // Punchy pitch drop oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.25);

      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.28);

      // Noise burst for impact texture
      const bufferSize = this.ctx.sampleRate * 0.18;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.18);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      whiteNoise.start(now);
    } catch {}
  }

  /**
   * Plays a milestone/bonus sound (cyber bell chime)
   */
  playMilestone() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + index * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {}
  }

  /**
   * Plays disc collectible pickup sound (sparkling cyber chime)
   */
  playDiscPickup() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, now); // C6
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08); // G6

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }

  /**
   * Plays extra life reward sound (triumphant power-up fanfare)
   */
  playExtraLife() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + index * 0.07;

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    } catch {}
  }

  /**
   * Plays Game Over sound (dystopian descending drone)
   */
  playGameOver() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(146.83, now); // D3
      osc1.frequency.exponentialRampToValueAtTime(36.71, now + 1.2); // D1

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(155.56, now); // Eb3 (dissonance)
      osc2.frequency.exponentialRampToValueAtTime(38.89, now + 1.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 1.2);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    } catch {}
  }

  /* ------------------- SYNTHWAVE MUSIC ENGINE ------------------- */

  /**
   * Starts looping Cyberpunk Synthwave background track.
   */
  startMusic() {
    if (!this.isInitialized) this.init();
    if (this.isPlayingMusic || !this.ctx) return;

    this.isPlayingMusic = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduleMusicLoop();
  }

  /**
   * Stops background music.
   */
  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /**
   * Music scheduler using look-ahead timing to avoid audio jitter.
   */
  scheduleMusicLoop() {
    if (!this.isPlayingMusic || !this.ctx) return;

    const scheduleAheadTime = 0.15; // Schedule notes up to 150ms in advance
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playMusicStep(this.nextNoteTime, this.currentStep);
      this.nextNoteTime += this.stepDuration;
      this.currentStep = (this.currentStep + 1) % 64; // 64-step 4-bar loop
    }

    this.musicTimer = setTimeout(() => this.scheduleMusicLoop(), 40);
  }

  /**
   * Plays elements of the music pattern for a single 16th note step.
   */
  playMusicStep(time, step) {
    if (!this.ctx || this.isMuted) return;

    // 1. Synthwave Kick Drum (every 4 steps: 0, 4, 8, 12, ...)
    if (step % 4 === 0) {
      this.playKick(time);
    }

    // 2. Cyberpunk Snare / Clap (on beats 4, 12, 20, ...)
    if (step % 8 === 4) {
      this.playSnare(time);
    }

    // 3. Hi-hat (every 2 steps or 16th notes with velocity variation)
    if (step % 2 === 0) {
      this.playHiHat(time, step % 4 === 2 ? 0.08 : 0.03);
    }

    // 4. Synthwave Rolling 16th-note Bassline (8th note pump)
    if (step % 2 === 0) {
      const barIndex = Math.floor(step / 16);
      const bassFreq = this.bassNotes[barIndex] || 73.42;
      this.playBassNote(time, bassFreq, this.stepDuration * 1.6);
    }

    // 5. Neon Melody Lead
    const leadFreq = this.leadPattern[step];
    if (leadFreq > 0) {
      this.playLeadNote(time, leadFreq, this.stepDuration * 1.8);
    }
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.09);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  playSnare(time) {
    // Noise snap
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
  }

  playHiHat(time, vol = 0.05) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  playBassNote(time, freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + duration);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  playLeadNote(time, freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }
}

export const soundEngine = new SoundEngine();
