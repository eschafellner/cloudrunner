/**
 * game.js - Canvas Rendering, Input Handling, Parallax City & Game Loop
 * Integrates logic.js and audio.js
 * Features: Collectible Discs, Platforms, Chasms, Dynamic Day-Night Cycle & Mobile Portrait Mode.
 */

import {
  GAME_CONFIG,
  checkCollision,
  calculateGameSpeed,
  calculateSpawnInterval,
  calculateScore,
  validatePlayerName,
  updateHighScores,
  getDayNightCycle,
  updatePlayerPhysics,
  triggerPlayerJump,
  updateDiscCollection,
  calculateSafeChasmWidth,
  checkPlayerInChasm,
} from './logic.js';

import { soundEngine } from './audio.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // UI Elements
    this.uiScore = document.getElementById('hud-score');
    this.uiHighscore = document.getElementById('hud-highscore');
    this.uiLivesContainer = document.getElementById('hud-lives');
    this.uiDiscs = document.getElementById('hud-discs');
    this.uiMuteBtn = document.getElementById('mute-btn');
    this.startOverlay = document.getElementById('start-overlay');
    this.gameOverOverlay = document.getElementById('gameover-overlay');
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.saveScoreBtn = document.getElementById('save-score-btn');
    this.playerNameInput = document.getElementById('player-name-input');
    this.finalScoreEl = document.getElementById('final-score');
    this.highscoreListEl = document.getElementById('highscore-list');
    this.mobileJumpBtn = document.getElementById('mobile-jump-btn');

    // Responsive virtual resolution
    this.vWidth = 960;
    this.vHeight = 540;
    this.groundY = 460;
    this.isPortrait = false;
    this.scale = 1;

    // Game state
    this.state = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
    this.gameTime = 0;
    this.currentSpeed = GAME_CONFIG.BASE_SPEED;
    this.score = 0;
    this.obstaclesCleared = 0;
    this.discs = 0;
    this.totalDiscsCollected = 0;
    this.spawnTimer = 0;
    this.nextSpawnInterval = GAME_CONFIG.BASE_SPAWN_INTERVAL;
    this.lastFrameTime = performance.now();
    this.screenShake = 0;
    this.screenFlash = 0;

    // Player object
    this.player = {
      x: 120,
      y: this.groundY - 56,
      width: 38,
      height: 56,
      vy: 0,
      isGrounded: true,
      currentPlatform: null,
      jumpsRemaining: 2,
      lives: GAME_CONFIG.INITIAL_LIVES,
      invulnerabilityTimer: 0,
      runFrame: 0,
      hitPadding: { x: 6, y: 4, w: 12, h: 8 },
      trail: [],
    };

    // Obstacle pool
    this.obstaclePool = [];
    this.activeObstacles = [];
    this.initObstaclePool(20);

    // Disc pool
    this.discPool = [];
    this.activeDiscs = [];
    this.initDiscPool(30);

    // Platform pool
    this.platformPool = [];
    this.activePlatforms = [];
    this.initPlatformPool(10);

    // Chasm pool
    this.chasmPool = [];
    this.activeChasms = [];
    this.initChasmPool(10);

    // Particle system pool
    this.particlePool = [];
    this.activeParticles = [];
    this.initParticlePool(120);

    // Floating text popups
    this.floatingTexts = [];

    // Pre-rendered Parallax background layers (Offscreen Canvases)
    this.stars = this.generateStars(80);
    this.distantLayer = this.createCityLayerTexture(16, 260, 380, 80, 160, '#120f24', false);
    this.midLayer = this.createCityLayerTexture(20, 180, 300, 60, 130, '#090714', true);
    this.flyingCars = this.generateFlyingCars(5);

    this.distantScrollX = 0;
    this.midScrollX = 0;
    this.groundScrollX = 0;

    // High scores & lighting
    this.highScores = this.loadHighScores();
    this.currentLighting = getDayNightCycle(0);

    this.initEventListeners();
    this.resizeCanvas();
    this.updateHUD();

    // Start rendering animation loop
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ------------------- OBJECT POOLS & INITIALIZATION ------------------- */

  initObstaclePool(size) {
    for (let i = 0; i < size; i++) {
      this.obstaclePool.push({
        active: false,
        x: 0,
        y: 0,
        width: 30,
        height: 40,
        type: 'BARRIER', // 'BARRIER' | 'LASER' | 'DRONE'
        cleared: false,
        animTimer: 0,
        hitPadding: { x: 4, y: 4, w: 8, h: 8 },
      });
    }
  }

  initDiscPool(size) {
    for (let i = 0; i < size; i++) {
      this.discPool.push({
        active: false,
        x: 0,
        y: 0,
        width: 26,
        height: 26,
        animTimer: 0,
        sparkleOffset: Math.random() * Math.PI * 2,
        hitPadding: { x: 2, y: 2, w: 4, h: 4 },
      });
    }
  }

  initPlatformPool(size) {
    for (let i = 0; i < size; i++) {
      this.platformPool.push({
        active: false,
        x: 0,
        y: 0,
        width: 180,
        height: 18,
        elevation: 60,
      });
    }
  }

  initChasmPool(size) {
    for (let i = 0; i < size; i++) {
      this.chasmPool.push({
        active: false,
        x: 0,
        width: 120,
      });
    }
  }

  initParticlePool(size) {
    for (let i = 0; i < size; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        life: 0,
        maxLife: 1,
        color: '#00f0ff',
        type: 'SPARK', // 'SPARK' | 'RING' | 'DISC_SPARKLE'
      });
    }
  }

  generateStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * 1200,
        y: Math.random() * 700,
        size: Math.random() * 2 + 0.8,
        twinkleSpeed: Math.random() * 3 + 1,
      });
    }
    return stars;
  }

  generateFlyingCars(count) {
    const cars = [];
    for (let i = 0; i < count; i++) {
      cars.push({
        x: Math.random() * 1000,
        y: 60 + Math.random() * 220,
        speed: (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 80),
        color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
        length: 22 + Math.random() * 14,
      });
    }
    return cars;
  }

  createCityLayerTexture(count, minHeight, maxHeight, minWidth, maxWidth, baseColor, withBillboards = false) {
    const buildings = [];
    let currentX = 0;
    const billboardLabels = ['CYBER', 'NEO-2088', 'CLOUD', 'RUN', '404', 'SYNTH', 'CORP', 'AI', 'MATRIX'];

    for (let i = 0; i < count; i++) {
      const width = Math.round(minWidth + Math.random() * (maxWidth - minWidth));
      const height = Math.round(minHeight + Math.random() * (maxHeight - minHeight));
      const hasAntenna = Math.random() > 0.35;
      const antennaHeight = Math.round(20 + Math.random() * 35);
      const hasBillboard = withBillboards && Math.random() > 0.6;
      const billboardText = hasBillboard ? billboardLabels[Math.floor(Math.random() * billboardLabels.length)] : null;

      const rows = Math.floor(height / 18);
      const cols = Math.floor(width / 14);
      const windowGrid = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          row.push({
            lit: Math.random() > 0.45,
            color: Math.random() > 0.6 ? '#ffe600' : (Math.random() > 0.5 ? '#00f0ff' : '#ff007f'),
          });
        }
        windowGrid.push(row);
      }

      buildings.push({
        x: currentX,
        width,
        height,
        hasAntenna,
        antennaHeight,
        hasBillboard,
        billboardText,
        windowGrid,
      });

      currentX += width + 6;
    }

    const totalWidth = currentX;
    const totalHeight = maxHeight + 60;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = totalWidth;
    baseCanvas.height = totalHeight;
    const bCtx = baseCanvas.getContext('2d');

    const neonCanvas = document.createElement('canvas');
    neonCanvas.width = totalWidth;
    neonCanvas.height = totalHeight;
    const nCtx = neonCanvas.getContext('2d');

    buildings.forEach(b => {
      const bx = b.x;
      const by = totalHeight - b.height;

      bCtx.fillStyle = baseColor;
      bCtx.fillRect(bx, by, b.width, b.height);

      if (b.hasAntenna) {
        bCtx.strokeStyle = '#221f33';
        bCtx.lineWidth = 2;
        bCtx.beginPath();
        bCtx.moveTo(bx + b.width / 2, by);
        bCtx.lineTo(bx + b.width / 2, by - b.antennaHeight);
        bCtx.stroke();

        nCtx.fillStyle = '#ff0055';
        nCtx.beginPath();
        nCtx.arc(bx + b.width / 2, by - b.antennaHeight, 3, 0, Math.PI * 2);
        nCtx.fill();
      }

      const padX = 6;
      const padY = 8;
      const winW = 4;
      const winH = 5;

      b.windowGrid.forEach((row, rIdx) => {
        row.forEach((win, cIdx) => {
          const wx = bx + padX + cIdx * (winW + 6);
          const wy = by + padY + rIdx * (winH + 8);

          if (wx + winW < bx + b.width - 4 && wy + winH < totalHeight - 4) {
            if (win.lit) {
              nCtx.fillStyle = win.color;
              nCtx.fillRect(wx, wy, winW, winH);
            } else {
              bCtx.fillStyle = 'rgba(255, 255, 255, 0.04)';
              bCtx.fillRect(wx, wy, winW, winH);
            }
          }
        });
      });

      if (b.hasBillboard) {
        const hbx = bx + 6;
        const hby = by + 14;
        const hbw = b.width - 12;
        const hbh = 22;

        if (hbw > 24) {
          nCtx.strokeStyle = '#ff007f';
          nCtx.lineWidth = 1.5;
          nCtx.strokeRect(hbx, hby, hbw, hbh);

          nCtx.fillStyle = 'rgba(10, 0, 30, 0.75)';
          nCtx.fillRect(hbx, hby, hbw, hbh);

          nCtx.fillStyle = '#00f0ff';
          nCtx.font = 'bold 10px monospace';
          nCtx.textAlign = 'center';
          nCtx.fillText(b.billboardText, hbx + hbw / 2, hby + 15);
        }
      }
    });

    return {
      baseCanvas,
      neonCanvas,
      width: totalWidth,
      height: totalHeight,
    };
  }

  /* ------------------- RESPONSIVE VIEWPORT ------------------- */

  resizeCanvas() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const contWidth = container.clientWidth;
    const contHeight = container.clientHeight;

    this.isPortrait = contWidth < contHeight;

    if (this.isPortrait) {
      this.vWidth = 540;
      this.vHeight = Math.max(760, Math.min(1080, Math.round(540 * (contHeight / contWidth))));
      this.groundY = this.vHeight - 160;
      this.player.x = 75;
    } else {
      this.vWidth = 960;
      this.vHeight = 540;
      this.groundY = 460;
      this.player.x = 120;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.vWidth * dpr;
    this.canvas.height = this.vHeight * dpr;

    const scaleX = contWidth / this.vWidth;
    const scaleY = contHeight / this.vHeight;
    const fitScale = Math.min(scaleX, scaleY);

    const displayW = Math.round(this.vWidth * fitScale);
    const displayH = Math.round(this.vHeight * fitScale);

    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;

    this.scale = dpr;

    if (this.player.isGrounded && !this.player.currentPlatform) {
      this.player.y = this.groundY - this.player.height;
    }
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 200));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.handleJumpInput();
      }
    });

    const triggerJump = (e) => {
      if (e.target && (e.target.closest('#gameover-overlay') || e.target.closest('#mute-btn') || e.target.closest('input') || e.target.closest('button'))) {
        return;
      }
      e.preventDefault();
      this.handleJumpInput();
    };

    this.canvas.addEventListener('touchstart', triggerJump, { passive: false });
    this.canvas.addEventListener('mousedown', triggerJump);

    if (this.mobileJumpBtn) {
      this.mobileJumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleJumpInput();
      }, { passive: false });
      this.mobileJumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleJumpInput();
      });
    }

    if (this.startBtn) {
      this.startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startGame();
      });
    }

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetGame();
      });
    }

    if (this.saveScoreBtn) {
      this.saveScoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentScore();
      });
    }

    if (this.playerNameInput) {
      this.playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.saveCurrentScore();
        }
      });
    }

    if (this.uiMuteBtn) {
      this.uiMuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const muted = soundEngine.toggleMute();
        this.updateMuteIcon(muted);
      });
      this.updateMuteIcon(soundEngine.isMuted);
    }
  }

  updateMuteIcon(isMuted) {
    if (!this.uiMuteBtn) return;
    this.uiMuteBtn.innerHTML = isMuted
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
  }

  /* ------------------- GAME CONTROL & INPUT ------------------- */

  handleJumpInput() {
    soundEngine.init();

    if (this.state === 'START') {
      this.startGame();
      return;
    }

    if (this.state === 'GAMEOVER') {
      return;
    }

    if (this.state === 'PLAYING') {
      const jumpResult = triggerPlayerJump(this.player);
      if (jumpResult === 'JUMP') {
        soundEngine.playJump();
        this.emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height, 8, '#00f0ff');
      } else if (jumpResult === 'DOUBLE_JUMP') {
        soundEngine.playDoubleJump();
        this.emitDoubleJumpRing(this.player.x + this.player.width / 2, this.player.y + this.player.height);
        this.addFloatingText(this.player.x, this.player.y - 15, '2x JUMP!', '#00f0ff');
      }
    }
  }

  startGame() {
    soundEngine.init();
    soundEngine.startMusic();

    this.state = 'PLAYING';
    this.startOverlay.classList.add('hidden');
    this.gameOverOverlay.classList.add('hidden');
    this.gameTime = 0;
    this.score = 0;
    this.obstaclesCleared = 0;
    this.discs = 0;
    this.totalDiscsCollected = 0;
    this.spawnTimer = 0.6;
    this.currentSpeed = GAME_CONFIG.BASE_SPEED;
    this.screenShake = 0;
    this.screenFlash = 0;

    this.player.y = this.groundY - this.player.height;
    this.player.vy = 0;
    this.player.isGrounded = true;
    this.player.currentPlatform = null;
    this.player.jumpsRemaining = 2;
    this.player.lives = GAME_CONFIG.INITIAL_LIVES;
    this.player.invulnerabilityTimer = 0;
    this.player.trail = [];

    this.activeObstacles.forEach(o => o.active = false);
    this.activeObstacles = [];
    this.activeDiscs.forEach(d => d.active = false);
    this.activeDiscs = [];
    this.activePlatforms.forEach(p => p.active = false);
    this.activePlatforms = [];
    this.activeChasms.forEach(c => c.active = false);
    this.activeChasms = [];
    this.activeParticles.forEach(p => p.active = false);
    this.activeParticles = [];
    this.floatingTexts = [];

    this.updateHUD();
  }

  resetGame() {
    this.startGame();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    soundEngine.stopMusic();
    soundEngine.playGameOver();

    this.screenShake = 15;
    this.screenFlash = 0.6;

    if (this.finalScoreEl) {
      this.finalScoreEl.textContent = this.score;
    }

    this.renderHighscoreList();
    this.gameOverOverlay.classList.remove('hidden');

    setTimeout(() => {
      if (this.playerNameInput) {
        this.playerNameInput.focus();
        this.playerNameInput.select();
      }
    }, 100);
  }

  /* ------------------- HIGHSCORES ------------------- */

  loadHighScores() {
    try {
      const saved = localStorage.getItem('cloudrunner_highscores');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [
      { name: 'CYBER_VIPER', score: 1250, date: '2088-01-01' },
      { name: 'NEON_RUNNER', score: 850, date: '2088-01-01' },
      { name: 'SYNTH_GHOST', score: 450, date: '2088-01-01' },
    ];
  }

  saveCurrentScore() {
    const rawName = this.playerNameInput ? this.playerNameInput.value : 'RUNNER';
    const validName = validatePlayerName(rawName);

    this.highScores = updateHighScores(this.highScores, {
      name: validName,
      score: this.score,
      date: new Date().toISOString().slice(0, 10),
    });

    try {
      localStorage.setItem('cloudrunner_highscores', JSON.stringify(this.highScores));
    } catch {}

    this.renderHighscoreList();
    this.updateHUD();

    if (this.saveScoreBtn) {
      this.saveScoreBtn.textContent = 'GESPEICHERT!';
      this.saveScoreBtn.disabled = true;
      setTimeout(() => {
        if (this.saveScoreBtn) {
          this.saveScoreBtn.textContent = 'SPEICHERN';
          this.saveScoreBtn.disabled = false;
        }
      }, 2000);
    }
  }

  renderHighscoreList() {
    if (!this.highscoreListEl) return;
    this.highscoreListEl.innerHTML = '';

    this.highScores.slice(0, 5).forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'highscore-item';
      li.innerHTML = `
        <span class="rank">#${idx + 1}</span>
        <span class="name">${entry.name}</span>
        <span class="score">${entry.score} PTS</span>
      `;
      this.highscoreListEl.appendChild(li);
    });
  }

  getHighestScore() {
    if (!this.highScores || this.highScores.length === 0) return 0;
    return this.highScores[0].score;
  }

  updateHUD() {
    if (this.uiScore) this.uiScore.textContent = this.score;
    if (this.uiHighscore) this.uiHighscore.textContent = Math.max(this.score, this.getHighestScore());
    if (this.uiDiscs) this.uiDiscs.textContent = `${this.discs}/20`;

    // Render up to MAX_LIVES (5) dynamically
    if (this.uiLivesContainer) {
      this.uiLivesContainer.innerHTML = '';
      const totalSlots = Math.max(GAME_CONFIG.INITIAL_LIVES, Math.min(GAME_CONFIG.MAX_LIVES, this.player.lives));
      for (let i = 0; i < totalSlots; i++) {
        const heart = document.createElement('span');
        heart.className = `life-icon ${i < this.player.lives ? 'active' : 'lost'}`;
        heart.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        this.uiLivesContainer.appendChild(heart);
      }
    }
  }

  /* ------------------- UNIFIED SPAWNING SYSTEM ------------------- */

  spawnDisc(x, y) {
    const disc = this.discPool.find(d => !d.active);
    if (!disc) return;
    disc.active = true;
    disc.x = x;
    disc.y = y;
    disc.animTimer = Math.random() * 5;
    this.activeDiscs.push(disc);
  }

  spawnDiscGroup(startX, baseY, pattern = 'ROW', count = 3) {
    const discSpacing = 32;
    const safeCount = Math.min(5, Math.max(1, count));

    if (pattern === 'ROW') {
      for (let i = 0; i < safeCount; i++) {
        this.spawnDisc(startX + i * discSpacing, baseY);
      }
    } else if (pattern === 'VERTICAL') {
      for (let i = 0; i < safeCount; i++) {
        this.spawnDisc(startX, baseY - i * discSpacing);
      }
    } else if (pattern === 'ARC') {
      for (let i = 0; i < safeCount; i++) {
        const arcY = baseY - Math.sin((i / (safeCount - 1)) * Math.PI) * 45;
        this.spawnDisc(startX + i * discSpacing, arcY);
      }
    }
  }

  spawnSegment() {
    const spawnX = this.vWidth + 60;
    const rand = Math.random();

    // Segment 1: Platform segment with Discs on top
    if (rand < 0.28) {
      const platform = this.platformPool.find(p => !p.active);
      if (platform) {
        platform.active = true;
        platform.x = spawnX;
        platform.width = 160 + Math.random() * 100;
        platform.height = 16;
        platform.elevation = 50 + Math.random() * 40; // 50-90px
        platform.y = this.groundY - platform.elevation;
        this.activePlatforms.push(platform);

        // Discs on top of platform
        const discCount = Math.min(4, Math.floor(platform.width / 45));
        this.spawnDiscGroup(platform.x + 20, platform.y - 32, 'ROW', discCount);

        // Ground hazard underneath if platform is high enough
        if (platform.elevation > 65 && Math.random() > 0.4) {
          const obs = this.obstaclePool.find(o => !o.active);
          if (obs) {
            obs.active = true;
            obs.type = 'BARRIER';
            obs.cleared = false;
            obs.width = 34;
            obs.height = 42;
            obs.x = platform.x + platform.width / 2 - 17;
            obs.y = this.groundY - obs.height;
            obs.hitPadding = { x: 6, y: 6, w: 12, h: 8 };
            this.activeObstacles.push(obs);
          }
        }
      }
    }
    // Segment 2: Chasm (Abgrund) segment
    else if (rand < 0.50 && this.gameTime > 10) {
      const chasm = this.chasmPool.find(c => !c.active);
      if (chasm) {
        const safeWidth = calculateSafeChasmWidth(this.currentSpeed);
        chasm.active = true;
        chasm.x = spawnX;
        chasm.width = safeWidth;
        this.activeChasms.push(chasm);

        // Floating Discs over the chasm (reward for jump)
        this.spawnDiscGroup(chasm.x + 10, this.groundY - 55, 'ARC', 3);

        // Optional crossing platform high above wide chasms
        if (safeWidth > 130 && Math.random() > 0.5) {
          const plat = this.platformPool.find(p => !p.active);
          if (plat) {
            plat.active = true;
            plat.x = chasm.x - 20;
            plat.width = chasm.width + 50;
            plat.height = 16;
            plat.elevation = 65;
            plat.y = this.groundY - plat.elevation;
            this.activePlatforms.push(plat);
          }
        }
      }
    }
    // Segment 3: Collectible Disc Trail / Cluster
    else if (rand < 0.70) {
      const formations = ['ROW', 'ARC', 'VERTICAL'];
      const form = formations[Math.floor(Math.random() * formations.length)];
      const count = 3 + Math.floor(Math.random() * 3); // 3 to 5
      const baseY = form === 'ROW' ? this.groundY - 30 : this.groundY - 35;
      this.spawnDiscGroup(spawnX, baseY, form, count);
    }
    // Segment 4: Standard Obstacle with optional Disc Arc
    else {
      const obstacle = this.obstaclePool.find(o => !o.active);
      if (obstacle) {
        const types = ['BARRIER'];
        if (this.gameTime > 15) types.push('LASER');
        if (this.gameTime > 30) types.push('DRONE');

        const type = types[Math.floor(Math.random() * types.length)];
        obstacle.active = true;
        obstacle.type = type;
        obstacle.cleared = false;
        obstacle.animTimer = 0;
        obstacle.x = spawnX;

        if (type === 'BARRIER') {
          obstacle.width = 34;
          obstacle.height = 42;
          obstacle.y = this.groundY - obstacle.height;
          obstacle.hitPadding = { x: 6, y: 6, w: 12, h: 8 };
        } else if (type === 'LASER') {
          obstacle.width = 24;
          obstacle.height = 72;
          obstacle.y = this.groundY - obstacle.height;
          obstacle.hitPadding = { x: 4, y: 4, w: 8, h: 6 };
        } else if (type === 'DRONE') {
          obstacle.width = 36;
          obstacle.height = 30;
          obstacle.baseY = this.groundY - 105 - Math.random() * 25;
          obstacle.y = obstacle.baseY;
          obstacle.hitPadding = { x: 4, y: 4, w: 8, h: 8 };
        }

        this.activeObstacles.push(obstacle);

        // Overhead Discs rewarding a clean jump
        if (Math.random() > 0.4) {
          this.spawnDiscGroup(obstacle.x - 30, this.groundY - obstacle.height - 35, 'ARC', 3);
        }
      }
    }
  }

  /* ------------------- PARTICLE SYSTEM ------------------- */

  emitParticles(x, y, count, color, type = 'SPARK') {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(item => !item.active);
      if (!p) break;

      p.active = true;
      p.x = x;
      p.y = y;
      p.color = color;
      p.type = type;
      p.size = 2 + Math.random() * 3;
      p.maxLife = 0.3 + Math.random() * 0.4;
      p.life = p.maxLife;

      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;

      this.activeParticles.push(p);
    }
  }

  emitDoubleJumpRing(x, y) {
    const p = this.particlePool.find(item => !item.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.color = '#00f0ff';
    p.type = 'RING';
    p.size = 8;
    p.maxLife = 0.35;
    p.life = p.maxLife;
    p.vx = 0;
    p.vy = 0;
    this.activeParticles.push(p);
  }

  addFloatingText(x, y, text, color = '#ffe600') {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.85,
      maxLife: 0.85,
    });
  }

  /* ------------------- GAME LOOP & UPDATES ------------------- */

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 2);
    }

    if (this.state !== 'PLAYING') {
      this.currentLighting = getDayNightCycle(this.gameTime);
      this.updateBackground(dt, 50);
      return;
    }

    this.gameTime += dt;
    this.currentSpeed = calculateGameSpeed(this.gameTime);
    this.currentLighting = getDayNightCycle(this.gameTime);

    // Update Player Physics with Platforms and Chasms
    updatePlayerPhysics(this.player, dt, this.groundY, this.activePlatforms, this.activeChasms);

    // Check if player fell into a chasm
    if (this.activeChasms.length > 0) {
      for (const chasm of this.activeChasms) {
        if (checkPlayerInChasm(this.player, chasm, this.groundY)) {
          this.handlePlayerHit(null, true);
          // Safe respawn bounce
          this.player.y = this.groundY - this.player.height;
          this.player.vy = -200;
          this.player.isGrounded = false;
          break;
        }
      }
    }

    // Player running animation
    this.player.runFrame = (this.player.runFrame + dt * (this.currentSpeed / 30)) % 8;

    // Player Neon Trail
    if (this.player.trail.length > 8) this.player.trail.shift();
    this.player.trail.push({ x: this.player.x, y: this.player.y });

    // Spawner Timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSegment();
      this.nextSpawnInterval = calculateSpawnInterval(this.gameTime);
      this.spawnTimer = this.nextSpawnInterval;
    }

    // 1. Update Platforms
    for (let i = this.activePlatforms.length - 1; i >= 0; i--) {
      const plat = this.activePlatforms[i];
      plat.x -= this.currentSpeed * dt;
      if (plat.x + plat.width < -150) {
        plat.active = false;
        this.activePlatforms.splice(i, 1);
      }
    }

    // 2. Update Chasms
    for (let i = this.activeChasms.length - 1; i >= 0; i--) {
      const chasm = this.activeChasms[i];
      chasm.x -= this.currentSpeed * dt;
      if (chasm.x + chasm.width < -150) {
        chasm.active = false;
        this.activeChasms.splice(i, 1);
      }
    }

    // 3. Update Discs & Check Collection
    for (let i = this.activeDiscs.length - 1; i >= 0; i--) {
      const disc = this.activeDiscs[i];
      disc.x -= this.currentSpeed * dt;
      disc.animTimer += dt;

      if (checkCollision(this.player, disc)) {
        this.collectDisc(disc, i);
        continue;
      }

      if (disc.x + disc.width < -100) {
        disc.active = false;
        this.activeDiscs.splice(i, 1);
      }
    }

    // 4. Update Obstacles & Check Collision
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      obs.x -= this.currentSpeed * dt;
      obs.animTimer += dt;

      if (obs.type === 'DRONE') {
        obs.y = obs.baseY + Math.sin(obs.animTimer * 4) * 14;
      }

      // Check obstacle cleared for bonus points
      if (!obs.cleared && obs.x + obs.width < this.player.x) {
        obs.cleared = true;
        this.obstaclesCleared++;
        this.addFloatingText(obs.x + 10, obs.y - 10, `+${GAME_CONFIG.OBSTACLE_CLEAR_BONUS}`, '#ffe600');

        if (this.obstaclesCleared % 10 === 0) {
          soundEngine.playMilestone();
          this.addFloatingText(this.player.x + 30, this.player.y - 30, 'STREAK x10!', '#ff007f');
        }
      }

      // Check Collision with Player
      if (this.player.invulnerabilityTimer <= 0 && checkCollision(this.player, obs)) {
        this.handlePlayerHit(obs);
      }

      if (obs.x + obs.width < -100) {
        obs.active = false;
        this.activeObstacles.splice(i, 1);
      }
    }

    // 5. Update Particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'RING') {
        p.size += dt * 70;
      }
    }

    // 6. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 35;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 7. Update Score & HUD
    this.score = calculateScore(this.gameTime, this.obstaclesCleared, this.totalDiscsCollected);
    this.updateHUD();

    // 8. Scroll Backgrounds
    this.updateBackground(dt, this.currentSpeed);
  }

  collectDisc(disc, index) {
    disc.active = false;
    this.activeDiscs.splice(index, 1);
    this.totalDiscsCollected++;

    soundEngine.playDiscPickup();
    this.emitParticles(disc.x + disc.width / 2, disc.y + disc.height / 2, 10, '#ffe600');

    // Update disc counter & handle extra life (cap 5)
    const result = updateDiscCollection(this.discs, this.player.lives, GAME_CONFIG.MAX_LIVES, GAME_CONFIG.DISCS_PER_EXTRA_LIFE);
    this.discs = result.discs;
    this.player.lives = result.lives;

    if (result.earnedExtraLife) {
      soundEngine.playExtraLife();
      this.addFloatingText(this.player.x, this.player.y - 30, '★ EXTRA LIFE! ★', '#ff007f');
      this.emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 25, '#00f0ff');
    } else {
      this.addFloatingText(disc.x, disc.y - 10, '+1 DISC', '#ffe600');
    }

    this.updateHUD();
  }

  handlePlayerHit(obs, isChasm = false) {
    this.player.lives--;
    this.player.invulnerabilityTimer = GAME_CONFIG.INVULNERABILITY_DURATION;
    this.screenShake = 14;
    this.screenFlash = 0.55;

    soundEngine.playHurt();
    this.emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 20, '#ff007f');
    this.updateHUD();

    if (this.player.lives <= 0) {
      this.gameOver();
    }
  }

  updateBackground(dt, speed) {
    this.distantScrollX = (this.distantScrollX + speed * 0.12 * dt) % this.distantLayer.width;
    this.midScrollX = (this.midScrollX + speed * 0.40 * dt) % this.midLayer.width;
    this.groundScrollX = (this.groundScrollX + speed * dt) % 60;

    this.flyingCars.forEach(car => {
      car.x += car.speed * dt;
      if (car.speed > 0 && car.x > this.vWidth + 100) car.x = -100;
      if (car.speed < 0 && car.x < -100) car.x = this.vWidth + 100;
    });
  }

  /* ------------------- RENDERING ------------------- */

  render() {
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);

    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Sky & Celestial
    this.renderSky();

    // 2. Distant Parallax City
    this.renderParallaxLayer(this.distantLayer, this.distantScrollX, 0.65, 0.4);

    // 3. Flying Cyber-Cars
    this.renderFlyingCars();

    // 4. Mid-ground Parallax City
    this.renderParallaxLayer(this.midLayer, this.midScrollX, 1.0, 1.0);

    // 5. Cyber-Highway Ground & Chasms
    this.renderGroundAndChasms();

    // 6. Platforms
    this.renderPlatforms();

    // 7. Collectible Discs
    this.renderDiscs();

    // 8. Obstacles
    this.renderObstacles();

    // 9. Player
    this.renderPlayer();

    // 10. Particles & Floating Texts
    this.renderParticles();
    this.renderFloatingTexts();

    // 11. Damage Screen Flash
    if (this.screenFlash > 0) {
      this.ctx.fillStyle = `rgba(255, 0, 80, ${this.screenFlash * 0.4})`;
      this.ctx.fillRect(0, 0, this.vWidth, this.vHeight);
    }

    // 12. Vignette & Scanlines
    this.renderVignetteAndScanlines();

    this.ctx.restore();
  }

  renderSky() {
    const { skyTop, skyBottom, sunAlpha, moonAlpha, neonIntensity } = this.currentLighting;

    const grad = this.ctx.createLinearGradient(0, 0, 0, this.groundY);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(-50, -50, this.vWidth + 100, this.vHeight + 100);

    if (moonAlpha > 0.1) {
      this.ctx.save();
      this.stars.forEach(star => {
        if (star.x <= this.vWidth && star.y < this.groundY - 100) {
          const twinkle = 0.5 + 0.5 * Math.sin(this.gameTime * star.twinkleSpeed);
          this.ctx.fillStyle = `rgba(255, 255, 255, ${moonAlpha * twinkle * 0.85})`;
          this.ctx.beginPath();
          this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });
      this.ctx.restore();
    }

    if (sunAlpha > 0.01) {
      const sunX = this.vWidth * 0.78 - this.gameTime * 2.5;
      const sunY = this.vHeight * 0.16 + this.gameTime * 1.8;
      this.ctx.save();
      this.ctx.globalAlpha = sunAlpha;

      const sunGlow = this.ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 70);
      sunGlow.addColorStop(0, 'rgba(255, 240, 180, 0.8)');
      sunGlow.addColorStop(0.5, 'rgba(255, 170, 50, 0.3)');
      sunGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
      this.ctx.fillStyle = sunGlow;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#fff4cc';
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    if (moonAlpha > 0.01) {
      const moonX = this.vWidth * 0.82;
      const moonY = this.vHeight * 0.18 - Math.min(30, (this.gameTime - 45) * 1.2);
      this.ctx.save();
      this.ctx.globalAlpha = moonAlpha;

      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 80);
      moonGlow.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
      moonGlow.addColorStop(0.4, 'rgba(255, 0, 127, 0.25)');
      moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 80, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#e6ffff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 18 * neonIntensity;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 28, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  renderParallaxLayer(layer, scrollX, alpha, neonWeight) {
    const { neonIntensity } = this.currentLighting;
    const y = this.groundY - layer.height;

    this.ctx.save();
    let startX = -(scrollX % layer.width);

    while (startX < this.vWidth) {
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(layer.baseCanvas, startX, y);

      if (neonIntensity > 0.05) {
        this.ctx.globalAlpha = alpha * (0.15 + 0.85 * neonIntensity) * neonWeight;
        this.ctx.drawImage(layer.neonCanvas, startX, y);
      }

      startX += layer.width;
    }

    this.ctx.restore();
  }

  renderFlyingCars() {
    this.ctx.save();
    this.flyingCars.forEach(car => {
      this.ctx.fillStyle = car.color;
      this.ctx.shadowColor = car.color;
      this.ctx.shadowBlur = 8 * this.currentLighting.neonIntensity;

      this.ctx.fillRect(car.x, car.y, car.length, 3);

      const trailGrad = this.ctx.createLinearGradient(
        car.x, car.y,
        car.speed > 0 ? car.x - 30 : car.x + car.length + 30, car.y
      );
      trailGrad.addColorStop(0, car.color);
      trailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = trailGrad;
      this.ctx.fillRect(car.speed > 0 ? car.x - 30 : car.x + car.length, car.y, 30, 2);
    });
    this.ctx.restore();
  }

  renderGroundAndChasms() {
    const { neonIntensity } = this.currentLighting;

    // 1. Draw Full Ground Base
    const groundGrad = this.ctx.createLinearGradient(0, this.groundY, 0, this.vHeight);
    groundGrad.addColorStop(0, '#0d0a1a');
    groundGrad.addColorStop(1, '#05030a');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, this.groundY, this.vWidth, this.vHeight - this.groundY);

    // 2. Draw Active Chasms (Deep Abyss Voids)
    this.activeChasms.forEach(chasm => {
      this.ctx.save();
      // Cut out the void
      const voidGrad = this.ctx.createLinearGradient(0, this.groundY, 0, this.vHeight);
      voidGrad.addColorStop(0, 'rgba(3, 2, 8, 0.95)');
      voidGrad.addColorStop(0.5, 'rgba(10, 0, 20, 0.98)');
      voidGrad.addColorStop(1, '#000000');
      this.ctx.fillStyle = voidGrad;
      this.ctx.fillRect(chasm.x, this.groundY - 2, chasm.width, this.vHeight - this.groundY + 10);

      // Abyss Bottom Laser/Warning Glow
      const abyssGlow = this.ctx.createLinearGradient(0, this.vHeight - 40, 0, this.vHeight);
      abyssGlow.addColorStop(0, 'rgba(255, 0, 127, 0)');
      abyssGlow.addColorStop(1, 'rgba(255, 0, 127, 0.5)');
      this.ctx.fillStyle = abyssGlow;
      this.ctx.fillRect(chasm.x, this.vHeight - 40, chasm.width, 40);

      // Warning hazard stripes on left & right edge
      this.ctx.fillStyle = '#ffe600';
      this.ctx.fillRect(chasm.x - 4, this.groundY, 4, 12);
      this.ctx.fillRect(chasm.x + chasm.width, this.groundY, 4, 12);

      this.ctx.strokeStyle = '#ff0055';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(chasm.x, this.groundY);
      this.ctx.lineTo(chasm.x, this.groundY + 30);
      this.ctx.moveTo(chasm.x + chasm.width, this.groundY);
      this.ctx.lineTo(chasm.x + chasm.width, this.groundY + 30);
      this.ctx.stroke();

      this.ctx.restore();
    });

    // 3. Glowing Neon Top Track Line (segmented across chasms)
    this.ctx.save();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12 * Math.max(0.3, neonIntensity);

    // Magenta secondary line
    const mgStroke = () => {
      this.ctx.strokeStyle = '#ff007f';
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowColor = '#ff007f';
      this.ctx.shadowBlur = 8 * neonIntensity;
    };

    let curX = 0;
    const sortedChasms = [...this.activeChasms].sort((a, b) => a.x - b.x);

    sortedChasms.forEach(chasm => {
      if (chasm.x > curX) {
        this.ctx.beginPath();
        this.ctx.moveTo(curX, this.groundY);
        this.ctx.lineTo(chasm.x, this.groundY);
        this.ctx.stroke();
      }
      curX = Math.max(curX, chasm.x + chasm.width);
    });

    if (curX < this.vWidth) {
      this.ctx.beginPath();
      this.ctx.moveTo(curX, this.groundY);
      this.ctx.lineTo(this.vWidth, this.groundY);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Moving Cyber-Grid perspective lines (only on solid ground)
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + 0.3 * neonIntensity})`;
    this.ctx.lineWidth = 1.5;

    for (let x = -60; x < this.vWidth + 60; x += 40) {
      const lineX = x - this.groundScrollX;
      // Skip if line is inside a chasm
      const inChasm = this.activeChasms.some(c => lineX >= c.x - 10 && lineX <= c.x + c.width + 10);
      if (!inChasm) {
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, this.groundY);
        this.ctx.lineTo(lineX - 35, this.vHeight);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  renderPlatforms() {
    const { neonIntensity } = this.currentLighting;

    this.activePlatforms.forEach(plat => {
      this.ctx.save();
      this.ctx.translate(plat.x, plat.y);

      // Platform Body (High-tech carbon chassis)
      this.ctx.fillStyle = '#141026';
      this.ctx.fillRect(0, 0, plat.width, plat.height);

      // Neon Top Deck Line
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10 * Math.max(0.4, neonIntensity);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(plat.width, 0);
      this.ctx.stroke();

      // Neon Bottom Thruster Glow
      this.ctx.fillStyle = '#ff007f';
      this.ctx.shadowColor = '#ff007f';
      this.ctx.shadowBlur = 12 * Math.max(0.4, neonIntensity);
      const thrusterW = 18;
      this.ctx.fillRect(15, plat.height - 3, thrusterW, 3);
      this.ctx.fillRect(plat.width - 15 - thrusterW, plat.height - 3, thrusterW, 3);

      // Tech Deco Stripes
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.fillRect(plat.width / 2 - 15, 4, 30, 2);
      this.ctx.fillRect(plat.width / 2 - 25, 9, 50, 2);

      this.ctx.restore();
    });
  }

  renderDiscs() {
    this.activeDiscs.forEach(disc => {
      this.ctx.save();
      this.ctx.translate(disc.x + disc.width / 2, disc.y + disc.height / 2);

      const r = disc.width / 2;
      const angle = disc.animTimer * 3 + disc.sparkleOffset;

      // 1. Outer Neon Cyan/Pink Halo
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.stroke();

      // 2. Metallic Chrome / Rainbow Reflective Body
      const hue = Math.floor((disc.animTimer * 100 + disc.sparkleOffset * 50) % 360);
      const discGrad = this.ctx.createLinearGradient(
        -r * Math.cos(angle), -r * Math.sin(angle),
        r * Math.cos(angle), r * Math.sin(angle)
      );
      discGrad.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
      discGrad.addColorStop(0.3, '#ffffff');
      discGrad.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 90%, 65%)`);
      discGrad.addColorStop(0.7, '#e0f7fa');
      discGrad.addColorStop(1, `hsl(${(hue + 240) % 360}, 90%, 65%)`);

      this.ctx.fillStyle = discGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
      this.ctx.fill();

      // 3. Compact Disc Data Ring Tracks
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      this.ctx.stroke();

      // 4. Center Hole (Transparent/Dark Core)
      this.ctx.fillStyle = '#0a0818';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#ffe600';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // 5. Sparkle Glint / Specular Flare
      const glintX = Math.cos(angle) * (r * 0.55);
      const glintY = Math.sin(angle) * (r * 0.55);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.arc(glintX, glintY, 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  renderPlayer() {
    const p = this.player;
    const { neonIntensity } = this.currentLighting;

    if (p.invulnerabilityTimer > 0) {
      const flash = Math.sin(p.invulnerabilityTimer * 25) > 0;
      if (!flash) return;
    }

    this.ctx.save();
    this.ctx.translate(p.x, p.y);

    // Neon Motion Trail
    if (p.trail.length > 2) {
      this.ctx.save();
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        const alpha = (i / p.trail.length) * 0.3;
        this.ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
        this.ctx.fillRect(t.x - p.x, t.y - p.y + 10, p.width, p.height - 15);
      }
      this.ctx.restore();
    }

    // Scarf / Trenchcoat Tails
    this.ctx.fillStyle = '#ff007f';
    this.ctx.shadowColor = '#ff007f';
    this.ctx.shadowBlur = 6 * neonIntensity;
    const flap = Math.sin(this.player.runFrame * 3) * 6;
    this.ctx.beginPath();
    this.ctx.moveTo(8, 26);
    this.ctx.lineTo(-18, 30 + flap);
    this.ctx.lineTo(-24, 42 + flap);
    this.ctx.lineTo(6, 38);
    this.ctx.closePath();
    this.ctx.fill();

    // Legs & Running Animation
    const legPhase = p.isGrounded ? this.player.runFrame : 2;
    const l1Offset = Math.sin(legPhase) * 12;
    const l2Offset = Math.sin(legPhase + Math.PI) * 12;

    // Back leg
    this.ctx.fillStyle = '#1e1c2e';
    this.ctx.fillRect(10 + l2Offset, 36, 6, 20);
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(10 + l2Offset, 52, 10, 4);

    // Front leg
    this.ctx.fillStyle = '#2d2a45';
    this.ctx.fillRect(18 + l1Offset, 36, 6, 20);
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(18 + l1Offset, 52, 10, 4);

    // Torso / Cyber Jacket
    this.ctx.fillStyle = '#111022';
    this.ctx.fillRect(8, 16, 22, 22);

    this.ctx.fillStyle = '#ffe600';
    this.ctx.fillRect(14, 18, 3, 16);

    // Head & Helmet
    this.ctx.fillStyle = '#1f1d36';
    this.ctx.fillRect(12, 2, 18, 14);

    // Glowing Neon Cyber Visor
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.fillRect(20, 6, 12, 5);

    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    this.ctx.fillRect(6, 7, 14, 3);

    // Jump Thruster Boot Glow
    if (!p.isGrounded) {
      this.ctx.fillStyle = '#ff007f';
      this.ctx.shadowColor = '#ff007f';
      this.ctx.shadowBlur = 14;
      this.ctx.beginPath();
      this.ctx.arc(14 + l1Offset, 56, 4, 0, Math.PI * 2);
      this.ctx.arc(14 + l2Offset, 56, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  renderObstacles() {
    const { neonIntensity } = this.currentLighting;

    this.activeObstacles.forEach(obs => {
      this.ctx.save();

      if (obs.type === 'BARRIER') {
        this.ctx.translate(obs.x, obs.y);

        this.ctx.fillStyle = '#161226';
        this.ctx.beginPath();
        this.ctx.moveTo(obs.width / 2, 0);
        this.ctx.lineTo(obs.width, obs.height);
        this.ctx.lineTo(0, obs.height);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffe600';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#ffe600';
        this.ctx.shadowBlur = 10 * Math.max(0.4, neonIntensity);
        this.ctx.stroke();

        this.ctx.fillStyle = '#ff0055';
        this.ctx.beginPath();
        this.ctx.arc(obs.width / 2, obs.height * 0.65, 4, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (obs.type === 'LASER') {
        this.ctx.translate(obs.x, obs.y);

        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, obs.width, 8);
        this.ctx.fillRect(0, obs.height - 8, obs.width, 8);

        const pulse = 0.8 + 0.2 * Math.sin(obs.animTimer * 12);
        this.ctx.fillStyle = '#ff007f';
        this.ctx.shadowColor = '#ff007f';
        this.ctx.shadowBlur = 16 * pulse;
        this.ctx.fillRect(obs.width / 2 - 3, 8, 6, obs.height - 16);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(obs.width / 2 - 1, 8, 2, obs.height - 16);

      } else if (obs.type === 'DRONE') {
        this.ctx.translate(obs.x, obs.y);

        this.ctx.fillStyle = '#1c1b29';
        this.ctx.beginPath();
        this.ctx.ellipse(obs.width / 2, obs.height / 2, obs.width / 2, obs.height / 2.5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(obs.width / 2, obs.height / 2, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(4, 4, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.ellipse(obs.width - 4, 4, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  renderParticles() {
    this.activeParticles.forEach(p => {
      this.ctx.save();
      const alpha = p.life / p.maxLife;

      if (p.type === 'SPARK') {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 6;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.type === 'RING') {
        this.ctx.strokeStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 10;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  renderFloatingTexts() {
    this.ctx.save();
    this.floatingTexts.forEach(ft => {
      const alpha = ft.life / ft.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = ft.color;
      this.ctx.shadowColor = ft.color;
      this.ctx.shadowBlur = 8;
      this.ctx.font = 'bold 15px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
    });
    this.ctx.restore();
  }

  renderVignetteAndScanlines() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let y = 0; y < this.vHeight; y += 4) {
      this.ctx.fillRect(0, y, this.vWidth, 1.5);
    }

    const vignette = this.ctx.createRadialGradient(
      this.vWidth / 2, this.vHeight / 2, this.vWidth * 0.35,
      this.vWidth / 2, this.vHeight / 2, this.vWidth * 0.65
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, this.vWidth, this.vHeight);
    this.ctx.restore();
  }
}

// Instantiate game after DOM loads
window.addEventListener('DOMContentLoaded', () => {
  window.cloudRunnerGame = new Game();
});
