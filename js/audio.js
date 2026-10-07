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
    this.isMuted = false;
    this.isInitialized = false;

    // Music scheduler state (rock-solid 124 BPM rhythm)
    this.isPlayingMusic = false;
    this.tempo = 124; // Fixed driving BPM for rhythmic tightness
    this.stepDuration = 60 / this.tempo / 4; // 16th note in seconds (~0.121s)
    this.currentStep = 0;
    this.totalSteps = 128; // 8-bar 16th-note loop (~15.5 seconds)
    this.nextNoteTime = 0;
    this.musicTimer = null;

    // Dynamics state
    this.isLowHealth = false;
    this.isOverdrive = false;

    // Bass note progression (Root frequencies in Hz for the 8 bars: Dm, C, Bb, C, Dm, C, Bb, F)
    this.bassNotes = [
      73.42, 65.41, 58.27, 65.41,   // Bars 1-4: D2, C2, Bb1, C2
      73.42, 65.41, 58.27, 87.31,   // Bars 5-8: D2, C2, Bb1, F2
    ];

    // 128-step Synthwave Lead Melody
    // Bars 1-4: Iconic, driving, syncopated theme from original
    // Bars 5-8: High-octave energetic response with identical driving syncopation
    this.leadPattern = [
      // Bar 1 (D minor)
      293.66, 0, 349.23, 0, 440.00, 0, 523.25, 440.00, 349.23, 0, 293.66, 0, 349.23, 440.00, 0, 0,
      // Bar 2 (C Major)
      261.63, 0, 329.63, 0, 392.00, 0, 523.25, 392.00, 329.63, 0, 261.63, 0, 329.63, 392.00, 0, 0,
      // Bar 3 (Bb Major)
      233.08, 0, 293.66, 0, 349.23, 0, 466.16, 349.23, 293.66, 0, 233.08, 0, 293.66, 349.23, 0, 0,
      // Bar 4 (Turnaround / Cascade)
      220.00, 0, 261.63, 0, 329.63, 0, 440.00, 0, 392.00, 349.23, 329.63, 293.66, 261.63, 246.94, 220.00, 0,

      // Bar 5 (D minor high energy)
      587.33, 0, 698.46, 0, 880.00, 0, 1046.50, 880.00, 698.46, 0, 587.33, 0, 698.46, 880.00, 0, 0,
      // Bar 6 (C Major high energy)
      523.25, 0, 659.25, 0, 783.99, 0, 1046.50, 783.99, 659.25, 0, 523.25, 0, 659.25, 783.99, 0, 0,
      // Bar 7 (Bb Major high energy)
      466.16, 0, 587.33, 0, 698.46, 0, 932.33, 698.46, 587.33, 0, 466.16, 0, 587.33, 698.46, 0, 0,
      // Bar 8 (Turnaround high resolve back to Bar 1)
      440.00, 0, 523.25, 0, 659.25, 0, 880.00, 0, 783.99, 698.46, 659.25, 587.33, 523.25, 493.88, 440.00, 0
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
   * Initializes the AudioContext on first user interaction with clean, low-latency node graph.
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
      this.musicGain.gain.setValueAtTime(0.38, this.ctx.currentTime);
      this.musicGain.connect(this.musicFilter);

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
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
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
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      whiteNoise.start(now);
    } catch {}
  }

  /**
   * Plays collectible disc pickup sound (bright arcade bell)
   */
  playDisc() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  /**
   * Plays life up fanfaronade (uplifting arpeggio)
   */
  playLifeUp() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.16);
      });
    } catch {}
  }

  /**
   * Plays slide sound (whoosh friction sweep)
   */
  playSlide() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
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
   * Music scheduler using look-ahead timing for rock-solid zero-jitter rhythm.
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
   * Updates dynamic audio parameters based on runtime game state (state flags only, no tempo wobble).
   */
  updateMusicDynamics({ lives = 3, isOverdrive = false } = {}) {
    this.setLowHealth(lives === 1);
    this.setOverdrive(isOverdrive);
  }

  /**
   * Applies an adrenaline lowpass filter to the music when on 1 life.
   */
  setLowHealth(isLow) {
    if (this.isLowHealth === isLow) return;
    this.isLowHealth = isLow;
    if (!this.ctx || !this.musicFilter) return;

    const now = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(now);
    if (isLow) {
      this.musicFilter.frequency.setTargetAtTime(900, now, 0.2);
      this.musicFilter.Q.setTargetAtTime(2.2, now, 0.2);
    } else {
      this.musicFilter.frequency.setTargetAtTime(20000, now, 0.25);
      this.musicFilter.Q.setTargetAtTime(0.7, now, 0.25);
    }
  }

  /**
   * Sets overdrive sound mode (16th-note hyper-drive bass).
   */
  setOverdrive(isOverdrive) {
    this.isOverdrive = isOverdrive;
  }

  /**
   * Plays all musical parts scheduled for a single 16th note step.
   * Rock-solid, driving, punchy rhythm on EVERY bar from step 0.
   */
  playMusicStep(time, step) {
    if (!this.ctx || this.isMuted) return;

    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);

    // 1. Synthwave Kick Drum (Driving four-on-the-floor: beats 0, 4, 8, 12 of EVERY bar)
    if (stepInBar % 4 === 0) {
      this.playKick(time);
    }

    // 2. Cyberpunk Snare / Clap (Beats 4 & 12 of EVERY bar)
    if (stepInBar % 8 === 4) {
      this.playSnare(time);
    }

    // 3. Hi-Hat groove (every 8th note / 2 steps, with offbeat accents)
    if (step % 2 === 0) {
      const isOffbeat = (stepInBar % 4 === 2);
      this.playHiHat(time, isOffbeat ? 0.08 : 0.035);
    }

    // 4. Rolling Synthwave Bassline (8th notes normally, 16th notes during Overdrive)
    const playBass = this.isOverdrive || (step % 2 === 0);
    if (playBass) {
      const root = this.bassNotes[bar % this.bassNotes.length] || 73.42;
      const dur = this.stepDuration * (this.isOverdrive ? 1.0 : 1.6);
      this.playBassNote(time, root, dur);
    }

    // 5. Neon Melody Lead (Driving syncopated melody from the original)
    const leadFreq = this.leadPattern[step % this.leadPattern.length];
    if (leadFreq > 0) {
      this.playLeadNote(time, leadFreq, this.stepDuration * 1.8);
    }

    // 6. Low-Health Adrenaline Heartbeat Pulse
    if (this.isLowHealth && stepInBar % 8 === 0) {
      this.playHeartbeat(time);
    }
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.09);

    gain.gain.setValueAtTime(0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.12);

    // Punch transient click
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(320, time);
    click.frequency.exponentialRampToValueAtTime(50, time + 0.02);
    clickGain.gain.setValueAtTime(0.3, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    click.connect(clickGain);
    clickGain.connect(this.musicGain);

    click.start(time);
    click.stop(time + 0.02);
  }

  playSnare(time, vol = 0.35) {
    // Crisp noise snap
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
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
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);

    // Tonal body pop
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(180, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(80, time + 0.06);
    bodyGain.gain.setValueAtTime(vol * 0.6, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.musicGain);

    bodyOsc.start(time);
    bodyOsc.stop(time + 0.07);
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
    filter.Q.setValueAtTime(3.2, time);
    filter.frequency.setValueAtTime(this.isOverdrive ? 1500 : 850, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + duration * 0.85);

    const vol = this.isOverdrive ? 0.36 : 0.30;
    gain.gain.setValueAtTime(vol, time);
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

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.frequency.exponentialRampToValueAtTime(1100, time + duration);

    gain.gain.setValueAtTime(0.20, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
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
