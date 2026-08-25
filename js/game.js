/**
 * game.js - Canvas Rendering, Input Handling, Parallax City & Game Loop
 * Integrates logic.js and audio.js
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
} from './logic.js';

import { soundEngine } from './audio.js';

// Virtual internal resolution (16:9)
const V_WIDTH = 960;
const V_HEIGHT = 540;
const GROUND_Y = 460;

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // UI Elements
    this.uiScore = document.getElementById('hud-score');
    this.uiHighscore = document.getElementById('hud-highscore');
    this.uiLivesContainer = document.getElementById('hud-lives');
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

    // Game state
    this.state = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
    this.gameTime = 0;
    this.currentSpeed = GAME_CONFIG.BASE_SPEED;
    this.score = 0;
    this.obstaclesCleared = 0;
    this.spawnTimer = 0;
    this.nextSpawnInterval = GAME_CONFIG.BASE_SPAWN_INTERVAL;
    this.lastFrameTime = performance.now();
    this.screenShake = 0;
    this.screenFlash = 0;

    // Player object
    this.player = {
      x: 120,
      y: GROUND_Y - 56,
      width: 38,
      height: 56,
      vy: 0,
      isGrounded: true,
      jumpsRemaining: 2,
      lives: GAME_CONFIG.INITIAL_LIVES,
      invulnerabilityTimer: 0,
      runFrame: 0,
      hitPadding: { x: 8, y: 6, w: 16, h: 10 },
      trail: [],
    };

    // Obstacle object pool
    this.obstaclePool = [];
    this.activeObstacles = [];
    this.initObstaclePool(20);

    // Particle system pool
    this.particlePool = [];
    this.activeParticles = [];
    this.initParticlePool(100);

    // Floating text popups
    this.floatingTexts = [];

    // Parallax background layers
    this.stars = this.generateStars(60);
    this.distantCity = this.generateBuildings(14, 180, 280, 70, 140);
    this.midCity = this.generateBuildings(18, 120, 220, 50, 100, true);
    this.flyingCars = this.generateFlyingCars(4);

    this.distantScrollX = 0;
    this.midScrollX = 0;
    this.groundScrollX = 0;

    // High scores
    this.highScores = this.loadHighScores();
    this.currentLighting = getDayNightCycle(0);

    this.initEventListeners();
    this.resizeCanvas();
    this.updateHUD();

    // Start rendering animation loop
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ------------------- INITIALIZATION & RESIZING ------------------- */

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
        type: 'SPARK', // 'SPARK' | 'RING'
      });
    }
  }

  generateStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * V_WIDTH,
        y: Math.random() * (GROUND_Y - 160),
        size: Math.random() * 2 + 0.8,
        twinkleSpeed: Math.random() * 3 + 1,
      });
    }
    return stars;
  }

  generateBuildings(count, minHeight, maxHeight, minWidth, maxWidth, withBillboards = false) {
    const buildings = [];
    let currentX = 0;
    const billboardLabels = ['CYBER', 'NEO-2088', 'CLOUD', 'RUN', '404', 'SYNTH', 'CORP', 'AI'];

    for (let i = 0; i < count; i++) {
      const width = minWidth + Math.random() * (maxWidth - minWidth);
      const height = minHeight + Math.random() * (maxHeight - minHeight);
      const hasAntenna = Math.random() > 0.4;
      const hasBillboard = withBillboards && Math.random() > 0.65;
      const billboardText = hasBillboard ? billboardLabels[Math.floor(Math.random() * billboardLabels.length)] : null;

      // Window grid
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
        antennaHeight: 15 + Math.random() * 25,
        hasBillboard,
        billboardText,
        windowGrid,
      });

      currentX += width + (Math.random() * 15 - 5);
    }
    return buildings;
  }

  generateFlyingCars(count) {
    const cars = [];
    for (let i = 0; i < count; i++) {
      cars.push({
        x: Math.random() * V_WIDTH,
        y: 60 + Math.random() * 160,
        speed: (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 80),
        color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
        length: 22 + Math.random() * 14,
      });
    }
    return cars;
  }

  resizeCanvas() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const contWidth = container.clientWidth;
    const contHeight = container.clientHeight;
    const targetAspect = V_WIDTH / V_HEIGHT;
    const windowAspect = contWidth / contHeight;

    let displayW, displayH;
    if (windowAspect > targetAspect) {
      displayH = contHeight;
      displayW = contHeight * targetAspect;
    } else {
      displayW = contWidth;
      displayH = contWidth / targetAspect;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = V_WIDTH * dpr;
    this.canvas.height = V_HEIGHT * dpr;
    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;

    this.scale = dpr;
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 200));

    // Jump Input (Keyboard)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.handleJumpInput();
      }
    });

    // Touch & Mouse Input
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

    // Buttons
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
    this.spawnTimer = 0.5; // Quick initial obstacle
    this.currentSpeed = GAME_CONFIG.BASE_SPEED;

    this.player.y = GROUND_Y - this.player.height;
    this.player.vy = 0;
    this.player.isGrounded = true;
    this.player.jumpsRemaining = 2;
    this.player.lives = GAME_CONFIG.INITIAL_LIVES;
    this.player.invulnerabilityTimer = 0;
    this.player.trail = [];

    this.activeObstacles.forEach(o => o.active = false);
    this.activeObstacles = [];
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

    // Auto focus name input on desktop
    setTimeout(() => {
      if (this.playerNameInput) {
        this.playerNameInput.focus();
        this.playerNameInput.select();
      }
    }, 100);
  }

  /* ------------------- HIGHSCORE PERSISTENCE ------------------- */

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

    if (this.uiLivesContainer) {
      this.uiLivesContainer.innerHTML = '';
      for (let i = 0; i < GAME_CONFIG.INITIAL_LIVES; i++) {
        const heart = document.createElement('span');
        heart.className = `life-icon ${i < this.player.lives ? 'active' : 'lost'}`;
        heart.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        this.uiLivesContainer.appendChild(heart);
      }
    }
  }

  /* ------------------- OBSTACLES & SPAWNING ------------------- */

  spawnObstacle() {
    const obstacle = this.obstaclePool.find(o => !o.active);
    if (!obstacle) return;

    // Pick obstacle type based on elapsed time
    const types = ['BARRIER'];
    if (this.gameTime > 15) types.push('LASER');
    if (this.gameTime > 30) types.push('DRONE');

    const type = types[Math.floor(Math.random() * types.length)];
    obstacle.active = true;
    obstacle.type = type;
    obstacle.cleared = false;
    obstacle.animTimer = 0;
    obstacle.x = V_WIDTH + 50;

    if (type === 'BARRIER') {
      // Ground triangular cyber barrier
      obstacle.width = 34;
      obstacle.height = 42;
      obstacle.y = GROUND_Y - obstacle.height;
      obstacle.hitPadding = { x: 6, y: 6, w: 12, h: 8 };
    } else if (type === 'LASER') {
      // Tall holographic laser barrier
      obstacle.width = 24;
      obstacle.height = 72;
      obstacle.y = GROUND_Y - obstacle.height;
      obstacle.hitPadding = { x: 4, y: 4, w: 8, h: 6 };
    } else if (type === 'DRONE') {
      // Floating cyber drone
      obstacle.width = 36;
      obstacle.height = 30;
      obstacle.baseY = GROUND_Y - 95 - Math.random() * 30;
      obstacle.y = obstacle.baseY;
      obstacle.hitPadding = { x: 4, y: 4, w: 8, h: 8 };
    }

    this.activeObstacles.push(obstacle);
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
      life: 0.8,
      maxLife: 0.8,
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
    // Decay visual shakes/flashes
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 2);
    }

    if (this.state !== 'PLAYING') {
      // Still update lighting and background for lively menu
      this.currentLighting = getDayNightCycle(this.gameTime);
      this.updateBackground(dt, 50);
      return;
    }

    this.gameTime += dt;
    this.currentSpeed = calculateGameSpeed(this.gameTime);
    this.currentLighting = getDayNightCycle(this.gameTime);

    // Update Player Physics
    updatePlayerPhysics(this.player, dt, GROUND_Y);

    // Player running animation frame
    this.player.runFrame = (this.player.runFrame + dt * (this.currentSpeed / 30)) % 8;

    // Player Neon Trail
    if (this.player.trail.length > 8) this.player.trail.shift();
    this.player.trail.push({ x: this.player.x, y: this.player.y });

    // Update Obstacle Spawner
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.nextSpawnInterval = calculateSpawnInterval(this.gameTime);
      this.spawnTimer = this.nextSpawnInterval;
    }

    // Update Active Obstacles
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

      // Despawn off-screen
      if (obs.x + obs.width < -100) {
        obs.active = false;
        this.activeObstacles.splice(i, 1);
      }
    }

    // Update Particles
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

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 35;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Score
    this.score = calculateScore(this.gameTime, this.obstaclesCleared);
    this.updateHUD();

    // Scroll Backgrounds
    this.updateBackground(dt, this.currentSpeed);
  }

  handlePlayerHit(obs) {
    this.player.lives--;
    this.player.invulnerabilityTimer = GAME_CONFIG.INVULNERABILITY_DURATION;
    this.screenShake = 12;
    this.screenFlash = 0.5;

    soundEngine.playHurt();
    this.emitParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 20, '#ff007f');
    this.updateHUD();

    if (this.player.lives <= 0) {
      this.gameOver();
    }
  }

  updateBackground(dt, speed) {
    this.distantScrollX = (this.distantScrollX + speed * 0.12 * dt) % (V_WIDTH * 2);
    this.midScrollX = (this.midScrollX + speed * 0.4 * dt) % (V_WIDTH * 2);
    this.groundScrollX = (this.groundScrollX + speed * dt) % 60;

    // Move flying cars
    this.flyingCars.forEach(car => {
      car.x += car.speed * dt;
      if (car.speed > 0 && car.x > V_WIDTH + 100) car.x = -100;
      if (car.speed < 0 && car.x < -100) car.x = V_WIDTH + 100;
    });
  }

  /* ------------------- RENDERING ------------------- */

  render() {
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);

    // Apply Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Sky & Celestial (Sun / Moon)
    this.renderSky();

    // 2. Distant Parallax City
    this.renderParallaxLayer(this.distantCity, this.distantScrollX, 0.6, 0.4);

    // 3. Flying Cyber-Cars in Sky
    this.renderFlyingCars();

    // 4. Mid-ground Parallax City with Glowing Windows & Neon Billboards
    this.renderParallaxLayer(this.midCity, this.midScrollX, 1.0, 0.85);

    // 5. Cyber-Highway / Runway Ground
    this.renderGround();

    // 6. Active Obstacles
    this.renderObstacles();

    // 7. Player Character
    this.renderPlayer();

    // 8. Particle Effects & Rings
    this.renderParticles();

    // 9. Floating Score Popups
    this.renderFloatingTexts();

    // 10. Damage Screen Flash
    if (this.screenFlash > 0) {
      this.ctx.fillStyle = `rgba(255, 0, 80, ${this.screenFlash * 0.4})`;
      this.ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
    }

    // 11. Subtle Vignette / Cyber Scanlines
    this.renderVignetteAndScanlines();

    this.ctx.restore();
  }

  renderSky() {
    const { skyTop, skyBottom, sunAlpha, moonAlpha, ambient, neonIntensity } = this.currentLighting;

    const grad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(-50, -50, V_WIDTH + 100, V_HEIGHT + 100);

    // Stars (visible as dusk/night approaches)
    if (moonAlpha > 0.1) {
      this.ctx.save();
      this.stars.forEach(star => {
        const twinkle = 0.5 + 0.5 * Math.sin(this.gameTime * star.twinkleSpeed);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${moonAlpha * twinkle * 0.85})`;
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        this.ctx.fill();
      });
      this.ctx.restore();
    }

    // Sun (Descends as time progresses)
    if (sunAlpha > 0.01) {
      const sunX = V_WIDTH * 0.75 - this.gameTime * 3;
      const sunY = 90 + this.gameTime * 2.2;
      this.ctx.save();
      this.ctx.globalAlpha = sunAlpha;

      // Sun halo glow
      const sunGlow = this.ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 70);
      sunGlow.addColorStop(0, 'rgba(255, 240, 180, 0.8)');
      sunGlow.addColorStop(0.5, 'rgba(255, 170, 50, 0.3)');
      sunGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
      this.ctx.fillStyle = sunGlow;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      this.ctx.fill();

      // Sun core
      this.ctx.fillStyle = '#fff4cc';
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Cyberpunk Moon (Rises with neon cyan halo)
    if (moonAlpha > 0.01) {
      const moonX = V_WIDTH * 0.82;
      const moonY = 110 - Math.min(40, (this.gameTime - 45) * 1.5);
      this.ctx.save();
      this.ctx.globalAlpha = moonAlpha;

      // Outer neon ring halo
      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 80);
      moonGlow.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
      moonGlow.addColorStop(0.4, 'rgba(255, 0, 127, 0.25)');
      moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 80, 0, Math.PI * 2);
      this.ctx.fill();

      // Cyber Moon Orb
      this.ctx.fillStyle = '#e6ffff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 18 * neonIntensity;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 28, 0, Math.PI * 2);
      this.ctx.fill();

      // Cyber Moon Grid rings
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  renderParallaxLayer(buildings, scrollX, alpha, scale) {
    const { buildingTint, neonIntensity } = this.currentLighting;
    const totalWidth = buildings.reduce((acc, b) => acc + b.width + 5, 0);

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    // Loop seamless building tiles
    for (let offset = -totalWidth; offset < V_WIDTH + totalWidth; offset += totalWidth) {
      let curX = offset - scrollX;

      buildings.forEach(b => {
        const renderX = curX;
        const renderY = GROUND_Y - b.height * scale;
        const renderW = b.width;
        const renderH = b.height * scale;

        if (renderX + renderW > -50 && renderX < V_WIDTH + 50) {
          // Building silhouette
          this.ctx.fillStyle = buildingTint;
          this.ctx.fillRect(renderX, renderY, renderW, renderH);

          // Roof antenna with beacon
          if (b.hasAntenna) {
            this.ctx.strokeStyle = '#222';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(renderX + renderW / 2, renderY);
            this.ctx.lineTo(renderX + renderW / 2, renderY - b.antennaHeight * scale);
            this.ctx.stroke();

            // Blinking beacon
            const blink = Math.sin(this.gameTime * 4 + b.x) > 0;
            if (blink && neonIntensity > 0.2) {
              this.ctx.fillStyle = '#ff0055';
              this.ctx.shadowColor = '#ff0055';
              this.ctx.shadowBlur = 8 * neonIntensity;
              this.ctx.beginPath();
              this.ctx.arc(renderX + renderW / 2, renderY - b.antennaHeight * scale, 2.5, 0, Math.PI * 2);
              this.ctx.fill();
            }
          }

          // Windows (Glow intensifies as night falls!)
          if (neonIntensity > 0.05 && b.windowGrid) {
            const padX = 6;
            const padY = 8;
            const winW = 4;
            const winH = 5;

            b.windowGrid.forEach((row, rIdx) => {
              row.forEach((win, cIdx) => {
                if (win.lit) {
                  const wx = renderX + padX + cIdx * (winW + 6);
                  const wy = renderY + padY + rIdx * (winH + 8);

                  if (wx + winW < renderX + renderW - 4 && wy + winH < GROUND_Y - 4) {
                    this.ctx.fillStyle = win.color;
                    this.ctx.globalAlpha = alpha * (0.2 + 0.8 * neonIntensity);
                    if (neonIntensity > 0.6) {
                      this.ctx.shadowColor = win.color;
                      this.ctx.shadowBlur = 4 * neonIntensity;
                    }
                    this.ctx.fillRect(wx, wy, winW, winH);
                  }
                }
              });
            });
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = alpha;
          }

          // Holographic Billboard
          if (b.hasBillboard && neonIntensity > 0.25) {
            const bx = renderX + 6;
            const by = renderY + 12;
            const bw = renderW - 12;
            const bh = 22;

            if (bw > 24) {
              this.ctx.strokeStyle = '#ff007f';
              this.ctx.shadowColor = '#00f0ff';
              this.ctx.shadowBlur = 10 * neonIntensity;
              this.ctx.strokeRect(bx, by, bw, bh);

              this.ctx.fillStyle = 'rgba(10, 0, 30, 0.7)';
              this.ctx.fillRect(bx, by, bw, bh);

              this.ctx.fillStyle = '#00f0ff';
              this.ctx.font = 'bold 10px monospace';
              this.ctx.textAlign = 'center';
              this.ctx.fillText(b.billboardText, bx + bw / 2, by + 15);
              this.ctx.shadowBlur = 0;
            }
          }
        }

        curX += b.width + 5;
      });
    }

    this.ctx.restore();
  }

  renderFlyingCars() {
    this.ctx.save();
    this.flyingCars.forEach(car => {
      this.ctx.fillStyle = car.color;
      this.ctx.shadowColor = car.color;
      this.ctx.shadowBlur = 8 * this.currentLighting.neonIntensity;

      // Car body
      this.ctx.fillRect(car.x, car.y, car.length, 3);

      // Light trail
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

  renderGround() {
    const { neonIntensity } = this.currentLighting;

    // Ground block
    const groundGrad = this.ctx.createLinearGradient(0, GROUND_Y, 0, V_HEIGHT);
    groundGrad.addColorStop(0, '#0d0a1a');
    groundGrad.addColorStop(1, '#05030a');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, GROUND_Y, V_WIDTH, V_HEIGHT - GROUND_Y);

    // Glowing Cyberpunk Top Track Line
    this.ctx.save();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12 * Math.max(0.3, neonIntensity);
    this.ctx.beginPath();
    this.ctx.moveTo(0, GROUND_Y);
    this.ctx.lineTo(V_WIDTH, GROUND_Y);
    this.ctx.stroke();

    // Magenta secondary neon edge line
    this.ctx.strokeStyle = '#ff007f';
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowColor = '#ff007f';
    this.ctx.shadowBlur = 8 * neonIntensity;
    this.ctx.beginPath();
    this.ctx.moveTo(0, GROUND_Y + 6);
    this.ctx.lineTo(V_WIDTH, GROUND_Y + 6);
    this.ctx.stroke();
    this.ctx.restore();

    // Moving Cyber-Grid perspective lines
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + 0.3 * neonIntensity})`;
    this.ctx.lineWidth = 1.5;

    for (let x = -60; x < V_WIDTH + 60; x += 40) {
      const lineX = x - this.groundScrollX;
      this.ctx.beginPath();
      this.ctx.moveTo(lineX, GROUND_Y);
      this.ctx.lineTo(lineX - 35, V_HEIGHT);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  renderPlayer() {
    const p = this.player;
    const { neonIntensity } = this.currentLighting;

    // Invulnerability Flashing
    if (p.invulnerabilityTimer > 0) {
      const flash = Math.sin(p.invulnerabilityTimer * 25) > 0;
      if (!flash) return;
    }

    this.ctx.save();
    this.ctx.translate(p.x, p.y);

    // Neon Motion Trail (Cyan/Magenta)
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

    // 1. Cyberpunk Scarf / Trenchcoat Tails (Flapping in the wind)
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

    // 2. Legs & Running Animation Cycle
    const legPhase = p.isGrounded ? this.player.runFrame : 2;
    const l1Offset = Math.sin(legPhase) * 12;
    const l2Offset = Math.sin(legPhase + Math.PI) * 12;

    // Back leg
    this.ctx.fillStyle = '#1e1c2e';
    this.ctx.fillRect(10 + l2Offset, 36, 6, 20);
    // Back neon cyber shoe
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(10 + l2Offset, 52, 10, 4);

    // Front leg
    this.ctx.fillStyle = '#2d2a45';
    this.ctx.fillRect(18 + l1Offset, 36, 6, 20);
    // Front neon cyber shoe
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(18 + l1Offset, 52, 10, 4);

    // 3. Torso / Cyber Jacket
    this.ctx.fillStyle = '#111022';
    this.ctx.fillRect(8, 16, 22, 22);

    // Neon Accent Stripes on jacket
    this.ctx.fillStyle = '#ffe600';
    this.ctx.fillRect(14, 18, 3, 16);

    // 4. Head & Helmet
    this.ctx.fillStyle = '#1f1d36';
    this.ctx.fillRect(12, 2, 18, 14);

    // 5. Glowing Neon Cyber Visor
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.fillRect(20, 6, 12, 5);

    // Visor glow trail
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    this.ctx.fillRect(6, 7, 14, 3);

    // 6. Cyber Jump Thruster Boot Glow
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
        // Ground Triangular Cyber-Spike / Barrier
        this.ctx.translate(obs.x, obs.y);

        this.ctx.fillStyle = '#161226';
        this.ctx.beginPath();
        this.ctx.moveTo(obs.width / 2, 0);
        this.ctx.lineTo(obs.width, obs.height);
        this.ctx.lineTo(0, obs.height);
        this.ctx.closePath();
        this.ctx.fill();

        // Neon Yellow Hazard Edge
        this.ctx.strokeStyle = '#ffe600';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#ffe600';
        this.ctx.shadowBlur = 10 * Math.max(0.4, neonIntensity);
        this.ctx.stroke();

        // Warning core pulse
        this.ctx.fillStyle = '#ff0055';
        this.ctx.beginPath();
        this.ctx.arc(obs.width / 2, obs.height * 0.65, 4, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (obs.type === 'LASER') {
        // Tall Holographic Laser Gate
        this.ctx.translate(obs.x, obs.y);

        // Base & Top Emitters
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, obs.width, 8);
        this.ctx.fillRect(0, obs.height - 8, obs.width, 8);

        // Glowing Laser Beam Core
        const pulse = 0.8 + 0.2 * Math.sin(obs.animTimer * 12);
        this.ctx.fillStyle = '#ff007f';
        this.ctx.shadowColor = '#ff007f';
        this.ctx.shadowBlur = 16 * pulse;
        this.ctx.fillRect(obs.width / 2 - 3, 8, 6, obs.height - 16);

        // Center white core
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(obs.width / 2 - 1, 8, 2, obs.height - 16);

      } else if (obs.type === 'DRONE') {
        // Floating Cyber Drone
        this.ctx.translate(obs.x, obs.y);

        // Drone Chassis
        this.ctx.fillStyle = '#1c1b29';
        this.ctx.beginPath();
        this.ctx.ellipse(obs.width / 2, obs.height / 2, obs.width / 2, obs.height / 2.5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Cyan Scanning Eye
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(obs.width / 2, obs.height / 2, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Twin Rotor Blades / Energy Rings
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
      this.ctx.font = 'bold 16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
    });
    this.ctx.restore();
  }

  renderVignetteAndScanlines() {
    // Subtle CRT scanline overlay
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let y = 0; y < V_HEIGHT; y += 4) {
      this.ctx.fillRect(0, y, V_WIDTH, 1.5);
    }

    // Vignette
    const vignette = this.ctx.createRadialGradient(
      V_WIDTH / 2, V_HEIGHT / 2, V_WIDTH * 0.35,
      V_WIDTH / 2, V_HEIGHT / 2, V_WIDTH * 0.65
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
    this.ctx.restore();
  }
}

// Instantiate game after DOM loads
window.addEventListener('DOMContentLoaded', () => {
  window.cloudRunnerGame = new Game();
});
