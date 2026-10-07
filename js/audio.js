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
    this.musicFilter = null;
    this.duckingGain = null;
    this.bassGain = null;
    this.padGain = null;
    this.leadGain = null;
    this.drumGain = null;
    this.delayNode = null;
    this.delayFeedbackGain = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Music scheduler state
    this.isPlayingMusic = false;
    this.baseTempo = 120;
    this.tempo = 120; // BPM (dynamically scales with game speed: 118 - 138 BPM)
    this.stepDuration = 60 / this.tempo / 4; // 16th note in seconds
    this.currentStep = 0;
    this.totalSteps = 256; // 16-bar 16th-note loop (~31 seconds of music)
    this.nextNoteTime = 0;
    this.musicTimer = null;

    // Dynamics state
    this.isLowHealth = false;
    this.isOverdrive = false;

    // Synthwave Chord Pads (root frequencies in Hz for Dm, Bb, C, Am/F)
    this.padChords = [
      [146.83, 174.61, 220.00], // Bar 1-4: Dm (D3, F3, A3)
      [116.54, 146.83, 174.61], // Bar 5-8: Bb (Bb2, D3, F3)
      [130.81, 164.81, 196.00], // Bar 9-12: C (C3, E3, G3)
      [110.00, 130.81, 164.81], // Bar 13-16: Am (A2, C3, E3)
    ];

    // Bass note progression (Root frequencies in Hz for each of the 16 bars)
    this.bassNotes = [
      73.42, 73.42, 73.42, 73.42,   // Bars 1-4: D2
      58.27, 58.27, 58.27, 58.27,   // Bars 5-8: Bb1
      65.41, 65.41, 65.41, 65.41,   // Bars 9-12: C2
      55.00, 55.00, 87.31, 65.41,   // Bars 13-16: A1 / F2 / C2
    ];

    // 256-step (16 bars x 16 steps) Synthwave Lead Melody & Arp Pattern
    this.leadPattern = this.buildLeadPattern();

    this.loadMutePreference();
  }

  buildLeadPattern() {
    const p = new Array(256).fill(0);
    // Section 1 (Bars 1-4 / Steps 0-63): Atmospheric Intro / Chimes
    p[16] = 587.33; // D5
    p[24] = 698.46; // F5
    p[32] = 880.00; // A5
    p[40] = 783.99; // G5
    p[48] = 698.46; // F5
    p[56] = 587.33; // D5

    // Section 2 (Bars 5-8 / Steps 64-127): Main Driving Synthwave Theme
    // Bar 5 (Steps 64-79): Dm Hook
    p[64] = 293.66; p[66] = 349.23; p[68] = 440.00; p[72] = 523.25; p[74] = 440.00; p[76] = 349.23;
    // Bar 6 (Steps 80-95): Bb Hook
    p[80] = 233.08; p[82] = 293.66; p[84] = 349.23; p[88] = 466.16; p[90] = 349.23; p[92] = 293.66;
    // Bar 7 (Steps 96-111): C Hook
    p[96] = 261.63; p[98] = 329.63; p[100] = 392.00; p[104] = 523.25; p[106] = 392.00; p[108] = 329.63;
    // Bar 8 (Steps 112-127): Turnaround
    p[112] = 440.00; p[114] = 392.00; p[116] = 349.23; p[120] = 329.63; p[122] = 293.66; p[124] = 349.23;

    // Section 3 (Bars 9-12 / Steps 128-191): Energetic 16th Arpeggiator Run
    // Bar 9 (Steps 128-143): Dm Arp
    const dArp = [587.33, 698.46, 880.00, 1046.50];
    for (let i = 0; i < 16; i++) p[128 + i] = dArp[i % 4];
    // Bar 10 (Steps 144-159): Bb Arp
    const bbArp = [466.16, 587.33, 698.46, 932.33];
    for (let i = 0; i < 16; i++) p[144 + i] = bbArp[i % 4];
    // Bar 11 (Steps 160-175): C Arp
    const cArp = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < 16; i++) p[160 + i] = cArp[i % 4];
    // Bar 12 (Steps 176-191): Am Arp / Cascade
    const amArp = [440.00, 523.25, 659.25, 880.00];
    for (let i = 0; i < 16; i++) p[176 + i] = amArp[i % 4];

    // Section 4 (Bars 13-16 / Steps 192-255): Climax & High Lead
    // Bar 13 (Steps 192-207)
    p[192] = 587.33; p[196] = 698.46; p[200] = 880.00; p[204] = 1046.50;
    // Bar 14 (Steps 208-223)
    p[208] = 932.33; p[212] = 880.00; p[216] = 698.46; p[220] = 587.33;
    // Bar 15 (Steps 224-239)
    p[224] = 659.25; p[228] = 783.99; p[232] = 880.00; p[236] = 1046.50;
    // Bar 16 (Steps 240-255): Final High Peak resolve
    p[240] = 1174.66; p[244] = 1046.50; p[248] = 880.00; p[252] = 698.46;

    return p;
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
   * Initializes the AudioContext on first user interaction with full stereo routing graph.
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

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music Master Filter (Lowpass, used for low-health danger muffling)
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
      this.musicFilter.connect(this.masterGain);

      // Music Master Gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.musicGain.connect(this.musicFilter);

      // Drum Bus (bypasses ducking)
      this.drumGain = this.ctx.createGain();
      this.drumGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.drumGain.connect(this.musicGain);

      // Sidechain Ducking Gain Node (ducks bass & pads on kick hits)
      this.duckingGain = this.ctx.createGain();
      this.duckingGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.duckingGain.connect(this.musicGain);

      // Bass Bus (routed into ducking)
      this.bassGain = this.ctx.createGain();
      this.bassGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.bassGain.connect(this.duckingGain);

      // Pad Bus (routed into ducking)
      this.padGain = this.ctx.createGain();
      this.padGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.padGain.connect(this.duckingGain);

      // Lead Bus (direct into music master)
      this.leadGain = this.ctx.createGain();
      this.leadGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.leadGain.connect(this.musicGain);

      // Stereo Ping-Pong / Feedback Delay for Lead
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.18, this.ctx.currentTime);

      this.delayFeedbackGain = this.ctx.createGain();
      this.delayFeedbackGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(3200, this.ctx.currentTime);

      // Connect delay loop: Lead -> Delay -> Filter -> Feedback -> Delay
      this.leadGain.connect(this.delayNode);
      this.delayNode.connect(delayFilter);
      delayFilter.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);
      delayFilter.connect(this.musicGain);

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

  /**
   * Plays slide sound (friction / futuristic whoosh)
   */
  playSlide() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

      oscGain.gain.setValueAtTime(0.22, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.24);

      // Filtered friction noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.22);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(now);
    } catch {}
  }

  /**
   * Plays power-up pickup chime (sparkling ascending cyber chord)
   */
  playPowerUp() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [349.23, 440.00, 523.25, 659.25, 880.00]; // F4, A4, C5, E5, A5
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.045;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {}
  }

  /**
   * Plays shield shatter/absorption sound (electric discharge)
   */
  playShieldBreak() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;

      // Resonant frequency sweep
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.35);

      // Glassy noise burst
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2500, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.28);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(now);
    } catch {}
  }

  /**
   * Plays air combo reward chime (crisp double high chime)
   */
  playCombo() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [1318.51, 1760.00]; // E6, A6
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + i * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.15);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.2);
      });
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
      this.currentStep = (this.currentStep + 1) % this.totalSteps;
    }

    this.musicTimer = setTimeout(() => this.scheduleMusicLoop(), 35);
  }

  /**
   * Updates dynamic audio parameters based on runtime game state.
   */
  updateMusicDynamics({ speed = 360, minSpeed = 360, maxSpeed = 780, lives = 3, isOverdrive = false } = {}) {
    const ratio = Math.max(0, Math.min(1, (speed - minSpeed) / Math.max(1, maxSpeed - minSpeed)));
    this.setSpeedRatio(ratio);
    this.setLowHealth(lives === 1);
    this.setOverdrive(isOverdrive);
  }

  /**
   * Scales music BPM dynamically with game speed (from 118 BPM to 138 BPM).
   */
  setSpeedRatio(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const targetTempo = Math.round(118 + clamped * 20);
    if (this.tempo !== targetTempo) {
      this.tempo = targetTempo;
      this.stepDuration = 60 / this.tempo / 4;
    }
  }

  /**
   * Applies an adrenaline lowpass filter to the music and triggers heartbeat when on 1 life.
   */
  setLowHealth(isLow) {
    if (this.isLowHealth === isLow) return;
    this.isLowHealth = isLow;
    if (!this.ctx || !this.musicFilter) return;

    const now = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(now);
    if (isLow) {
      this.musicFilter.frequency.setTargetAtTime(680, now, 0.2);
      this.musicFilter.Q.setTargetAtTime(3.2, now, 0.2);
    } else {
      this.musicFilter.frequency.setTargetAtTime(20000, now, 0.25);
      this.musicFilter.Q.setTargetAtTime(0.7, now, 0.25);
    }
  }

  /**
   * Sets overdrive sound mode (hyper-drive bass).
   */
  setOverdrive(isOverdrive) {
    this.isOverdrive = isOverdrive;
  }

  /**
   * Plays all musical parts scheduled for a single 16th note step.
   */
  playMusicStep(time, step) {
    if (!this.ctx || this.isMuted) return;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const isIntro = bar < 4;

    // 1. Synthwave Kick Drum & Sidechain Ducking
    // Intro has kick on beats 0 & 8; main sections have four-on-the-floor (0, 4, 8, 12)
    const kickHit = isIntro ? (stepInBar === 0 || stepInBar === 8) : (stepInBar % 4 === 0);
    if (kickHit) {
      this.playKick(time);
    }

    // 2. Cyberpunk Snare / Clap
    // Regular beats on 4 & 12; Turnaround roll on bar 15
    if (!isIntro && (stepInBar === 4 || stepInBar === 12)) {
      this.playSnare(time, 0.35);
    } else if (bar === 15 && stepInBar >= 10 && stepInBar % 2 === 0) {
      // Snare build roll at the end of the 16-bar progression
      this.playSnare(time, 0.2 + (stepInBar - 10) * 0.05);
    }

    // 3. Hi-Hats
    // 16th groove with offbeat open hats during high-energy sections (bars 8-15)
    if (step % 2 === 0) {
      const isOpen = (bar >= 8) && (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14);
      const vel = isOpen ? 0.09 : (stepInBar % 4 === 2 ? 0.06 : 0.035);
      this.playHiHat(time, vel, isOpen);
    }

    // 4. Warm Polyphonic Pad Chords (triggered at step 0 of each 4-bar block)
    if (step % 64 === 0) {
      const chordIndex = Math.floor(step / 64) % this.padChords.length;
      const chordFreqs = this.padChords[chordIndex];
      this.playPadChord(time, chordFreqs, this.stepDuration * 60);
    }

    // 5. Dual-Detuned Rolling Synthwave Bassline
    // Standard: 8th note pump; Overdrive: 16th note hyper-drive
    const playBass = this.isOverdrive || (step % 2 === 0);
    if (playBass) {
      const root = this.bassNotes[bar] || 73.42;
      // Octave bounce on offbeats
      const freq = (stepInBar % 4 === 2) ? root * 1.5 : root;
      const dur = this.stepDuration * (this.isOverdrive ? 1.1 : 1.7);
      this.playBassNote(time, freq, dur);
    }

    // 6. Neon Melody Lead (Dual-Oscillator with Stereo Delay)
    const leadFreq = this.leadPattern[step];
    if (leadFreq > 0) {
      const isShortArp = (bar >= 8 && bar < 12);
      const dur = this.stepDuration * (isShortArp ? 1.2 : 2.4);
      this.playLeadNote(time, leadFreq, dur);
    }

    // 7. Low-Health Adrenalin Heartbeat Pulse
    if (this.isLowHealth && stepInBar % 8 === 0) {
      this.playHeartbeat(time);
    }
  }

  playKick(time) {
    // Punchy pitch drop oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.10);

    gain.gain.setValueAtTime(0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.drumGain || this.musicGain);

    osc.start(time);
    osc.stop(time + 0.14);

    // Punch transient click
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(400, time);
    click.frequency.exponentialRampToValueAtTime(50, time + 0.02);
    clickGain.gain.setValueAtTime(0.35, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    click.connect(clickGain);
    clickGain.connect(this.drumGain || this.musicGain);

    click.start(time);
    click.stop(time + 0.02);

    // Sidechain Ducking Pump on Bass & Pads
    if (this.duckingGain) {
      this.duckingGain.gain.cancelScheduledValues(time);
      this.duckingGain.gain.setValueAtTime(0.35, time);
      this.duckingGain.gain.exponentialRampToValueAtTime(1.0, time + 0.13);
    }
  }

  playSnare(time, vol = 0.35) {
    // Noise snap
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1100, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain || this.musicGain);

    noise.start(time);

    // Tonal body drop
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(190, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(80, time + 0.07);
    bodyGain.gain.setValueAtTime(vol * 0.7, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.drumGain || this.musicGain);

    bodyOsc.start(time);
    bodyOsc.stop(time + 0.08);
  }

  playHiHat(time, vol = 0.05, isOpen = false) {
    const dur = isOpen ? 0.12 : 0.04;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8500, time);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isOpen ? 6500 : 7500, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain || this.musicGain);

    osc.start(time);
    osc.stop(time + dur);
  }

  playBassNote(time, freq, duration) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Dual detuned sawtooth oscillators
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-7, time); // -7 Cents

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(7, time); // +7 Cents

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.8, time);
    filter.frequency.setValueAtTime(this.isOverdrive ? 1800 : 950, time);
    filter.frequency.exponentialRampToValueAtTime(110, time + duration * 0.9);

    const vol = this.isOverdrive ? 0.38 : 0.30;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassGain || this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  playPadChord(time, freqs, duration) {
    if (!freqs || !freqs.length) return;
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.07, time + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.padGain || this.musicGain);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  playLeadNote(time, freq, duration) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-5, time);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(5, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + duration);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.leadGain || this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  playHeartbeat(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);

    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);

    osc.start(time);
    osc.stop(time + 0.14);
  }
}

export const soundEngine = new SoundEngine();
