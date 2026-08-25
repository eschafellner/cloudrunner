/**
 * logic.js - Pure, DOM-free game logic for "Cloud Runner"
 * Fully testable in isolation without DOM/Canvas dependencies.
 */

// Default configuration constants
export const GAME_CONFIG = {
  BASE_SPEED: 360,
  MAX_SPEED: 780,
  SPEED_STEP_INTERVAL: 12,    // Seconds per difficulty tier
  SPEED_STEP_BOOST: 35,       // Speed increment per tier
  SPEED_RAMP_DURATION: 90,    // Time to reach max continuous speed

  BASE_SPAWN_INTERVAL: 2.2,   // Initial spawn delay in seconds
  MIN_SPAWN_INTERVAL: 0.95,   // Fastest spawn delay
  OBSTACLE_CLEAR_BONUS: 25,   // Bonus score per obstacle passed
  SCORE_PER_SECOND: 10,       // Passive score per second alive

  INITIAL_LIVES: 3,
  INVULNERABILITY_DURATION: 1.8, // Seconds of invulnerability after damage
  DAY_NIGHT_DURATION: 90,        // Seconds for complete Noon -> Night cycle

  GRAVITY: 1850,              // Pixels/s^2
  JUMP_FORCE: -680,           // Initial jump velocity (px/s)
  DOUBLE_JUMP_FORCE: -580,    // Double jump velocity (px/s)
  MAX_FALL_SPEED: 1000,       // Terminal fall velocity
};

/**
 * Checks Axis-Aligned Bounding Box (AABB) collision between two rectangles.
 * Supports optional hitbox padding/insets for precise, forgiving gameplay.
 *
 * @param {Object} a - { x, y, width, height, hitPadding?: { x, y, w, h } }
 * @param {Object} b - { x, y, width, height, hitPadding?: { x, y, w, h } }
 * @returns {boolean} True if bounding boxes overlap
 */
export function checkCollision(a, b) {
  if (!a || !b) return false;

  const padA = a.hitPadding || { x: 0, y: 0, w: 0, h: 0 };
  const padB = b.hitPadding || { x: 0, y: 0, w: 0, h: 0 };

  const ax = a.x + (padA.x || 0);
  const ay = a.y + (padA.y || 0);
  const aw = Math.max(1, a.width - (padA.w || 0) - (padA.x || 0));
  const ah = Math.max(1, a.height - (padA.h || 0) - (padA.y || 0));

  const bx = b.x + (padB.x || 0);
  const by = b.y + (padB.y || 0);
  const bw = Math.max(1, b.width - (padB.w || 0) - (padB.x || 0));
  const bh = Math.max(1, b.height - (padB.h || 0) - (padB.y || 0));

  return (
    ax < bx + bw &&
    ax + aw > bx &&
    ay < by + bh &&
    ay + ah > by
  );
}

/**
 * Calculates current game scrolling speed based on elapsed time.
 * Increases in discrete steps (every 10-15s) with smooth ramping, capped at maxSpeed.
 *
 * @param {number} elapsedSeconds - Total active gameplay time in seconds
 * @param {Object} [config] - Speed configuration overrides
 * @returns {number} Current speed in pixels/second
 */
export function calculateGameSpeed(elapsedSeconds, config = {}) {
  const baseSpeed = config.baseSpeed ?? GAME_CONFIG.BASE_SPEED;
  const maxSpeed = config.maxSpeed ?? GAME_CONFIG.MAX_SPEED;
  const stepInterval = config.stepInterval ?? GAME_CONFIG.SPEED_STEP_INTERVAL;
  const stepBoost = config.stepBoost ?? GAME_CONFIG.SPEED_STEP_BOOST;
  const rampDuration = config.rampDuration ?? GAME_CONFIG.SPEED_RAMP_DURATION;

  if (elapsedSeconds <= 0) return baseSpeed;

  const stepCount = Math.floor(elapsedSeconds / stepInterval);
  const steppedIncrease = stepCount * stepBoost;

  const continuousRatio = Math.min(1, elapsedSeconds / rampDuration);
  const continuousIncrease = continuousRatio * (maxSpeed - baseSpeed) * 0.4;

  const calculated = baseSpeed + steppedIncrease + continuousIncrease;
  return Math.min(maxSpeed, Math.round(calculated * 10) / 10);
}

/**
 * Calculates dynamic obstacle spawn interval based on elapsed time.
 * Spawn interval decreases as speed increases, ensuring fair spacing.
 *
 * @param {number} elapsedSeconds - Total active gameplay time in seconds
 * @param {Object} [config] - Spawn configuration overrides
 * @returns {number} Next spawn interval in seconds
 */
export function calculateSpawnInterval(elapsedSeconds, config = {}) {
  const baseInterval = config.baseInterval ?? GAME_CONFIG.BASE_SPAWN_INTERVAL;
  const minInterval = config.minInterval ?? GAME_CONFIG.MIN_SPAWN_INTERVAL;
  const rampDuration = config.rampDuration ?? GAME_CONFIG.SPEED_RAMP_DURATION;

  if (elapsedSeconds <= 0) return baseInterval;

  const progress = Math.min(1, elapsedSeconds / rampDuration);
  const interval = baseInterval - (progress * (baseInterval - minInterval));
  return Math.max(minInterval, Math.round(interval * 100) / 100);
}

/**
 * Calculates the current score.
 *
 * @param {number} elapsedSeconds - Survival time in seconds
 * @param {number} obstaclesCleared - Total obstacles successfully jumped over
 * @param {Object} [config] - Score weights
 * @returns {number} Integer score
 */
export function calculateScore(elapsedSeconds, obstaclesCleared = 0, config = {}) {
  const scorePerSec = config.scorePerSecond ?? GAME_CONFIG.SCORE_PER_SECOND;
  const bonusPerObstacle = config.obstacleBonus ?? GAME_CONFIG.OBSTACLE_CLEAR_BONUS;

  const timeScore = Math.max(0, elapsedSeconds) * scorePerSec;
  const obstacleScore = Math.max(0, obstaclesCleared) * bonusPerObstacle;
  return Math.floor(timeScore + obstacleScore);
}

/**
 * Sanitizes and validates player name for high score entries.
 *
 * @param {string} rawName - User entered string
 * @param {number} [maxLength=15] - Maximum character limit
 * @param {string} [defaultName="RUNNER"] - Fallback if name is empty
 * @returns {string} Sanitized name
 */
export function validatePlayerName(rawName, maxLength = 15, defaultName = "RUNNER") {
  if (typeof rawName !== "string") return defaultName;
  const cleaned = rawName.replace(/[<>'"&]/g, "").trim();
  if (cleaned.length === 0) return defaultName;
  return cleaned.slice(0, maxLength);
}

/**
 * Updates high score table with a new score entry.
 * Keeps entries sorted descending, sliced to maxEntries.
 *
 * @param {Array<Object>} currentScores - Array of { name: string, score: number, date?: string }
 * @param {Object} newEntry - { name: string, score: number, date?: string }
 * @param {number} [maxEntries=10] - Maximum list size
 * @returns {Array<Object>} Updated, sorted and trimmed score list
 */
export function updateHighScores(currentScores, newEntry, maxEntries = 10) {
  const scores = Array.isArray(currentScores) ? [...currentScores] : [];
  
  if (newEntry && typeof newEntry.score === "number" && !isNaN(newEntry.score)) {
    const validEntry = {
      name: validatePlayerName(newEntry.name),
      score: Math.max(0, Math.floor(newEntry.score)),
      date: newEntry.date || new Date().toISOString().slice(0, 10),
    };
    scores.push(validEntry);
  }

  // Sort descending by score; ties sorted by date/original order
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, maxEntries);
}

/**
 * Utility: Parses HEX color to RGB object
 */
export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Utility: Converts RGB object to CSS rgb string
 */
export function rgbToString(rgb) {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

/**
 * Utility: Linearly interpolates between two RGB colors
 */
export function interpolateColor(hexA, hexB, t) {
  const c1 = hexToRgb(hexA);
  const c2 = hexToRgb(hexB);
  const clampedT = Math.max(0, Math.min(1, t));
  return rgbToString({
    r: c1.r + (c2.r - c1.r) * clampedT,
    g: c1.g + (c2.g - c1.g) * clampedT,
    b: c1.b + (c2.b - c1.b) * clampedT,
  });
}

/**
 * Keyframe colors for Day -> Dusk -> Night lighting cycle
 */
export const LIGHTING_KEYFRAMES = [
  {
    timeRatio: 0.0, // 0s: Noon
    phase: "NOON",
    skyTop: "#3a88e9",
    skyBottom: "#89c4f4",
    ambient: 1.0,
    neonIntensity: 0.0,
    sunAlpha: 1.0,
    moonAlpha: 0.0,
    buildingTint: "#4b6584",
    hazeColor: "rgba(255, 245, 220, 0.15)",
  },
  {
    timeRatio: 0.35, // ~31s: Late Afternoon
    phase: "AFTERNOON",
    skyTop: "#4834d4",
    skyBottom: "#f0932b",
    ambient: 0.85,
    neonIntensity: 0.2,
    sunAlpha: 0.8,
    moonAlpha: 0.1,
    buildingTint: "#303a52",
    hazeColor: "rgba(240, 147, 43, 0.2)",
  },
  {
    timeRatio: 0.70, // ~63s: Sunset / Twilight
    phase: "DUSK",
    skyTop: "#1e1335",
    skyBottom: "#eb2f96",
    ambient: 0.55,
    neonIntensity: 0.65,
    sunAlpha: 0.2,
    moonAlpha: 0.6,
    buildingTint: "#191024",
    hazeColor: "rgba(235, 47, 150, 0.25)",
  },
  {
    timeRatio: 1.0, // 90s+: Deep Cyberpunk Night
    phase: "NIGHT",
    skyTop: "#050515",
    skyBottom: "#1f0c38",
    ambient: 0.35,
    neonIntensity: 1.0,
    sunAlpha: 0.0,
    moonAlpha: 1.0,
    buildingTint: "#0a0614",
    hazeColor: "rgba(0, 240, 255, 0.15)",
  },
];

/**
 * Computes the continuous Day-to-Night lighting cycle based on game time.
 * Transitions smoothly from Noon (t=0) to Cyberpunk Night (t >= 90s).
 *
 * @param {number} elapsedSeconds - Total gameplay time in seconds
 * @param {number} [duration=90] - Total transition time to full night
 * @returns {Object} Interpolated lighting parameters
 */
export function getDayNightCycle(elapsedSeconds, duration = GAME_CONFIG.DAY_NIGHT_DURATION) {
  const safeTime = Math.max(0, elapsedSeconds);
  const progress = Math.min(1, safeTime / duration);

  // Find surrounding keyframes
  let prevFrame = LIGHTING_KEYFRAMES[0];
  let nextFrame = LIGHTING_KEYFRAMES[LIGHTING_KEYFRAMES.length - 1];

  for (let i = 0; i < LIGHTING_KEYFRAMES.length - 1; i++) {
    if (progress >= LIGHTING_KEYFRAMES[i].timeRatio && progress <= LIGHTING_KEYFRAMES[i + 1].timeRatio) {
      prevFrame = LIGHTING_KEYFRAMES[i];
      nextFrame = LIGHTING_KEYFRAMES[i + 1];
      break;
    }
  }

  const range = nextFrame.timeRatio - prevFrame.timeRatio;
  const segmentT = range === 0 ? 0 : (progress - prevFrame.timeRatio) / range;

  // Linear interpolation helper for numbers
  const lerp = (a, b, t) => a + (b - a) * t;

  return {
    progress,
    elapsedSeconds: safeTime,
    phase: progress >= 0.85 ? "NIGHT" : prevFrame.phase,
    skyTop: interpolateColor(prevFrame.skyTop, nextFrame.skyTop, segmentT),
    skyBottom: interpolateColor(prevFrame.skyBottom, nextFrame.skyBottom, segmentT),
    ambient: lerp(prevFrame.ambient, nextFrame.ambient, segmentT),
    neonIntensity: lerp(prevFrame.neonIntensity, nextFrame.neonIntensity, segmentT),
    sunAlpha: lerp(prevFrame.sunAlpha, nextFrame.sunAlpha, segmentT),
    moonAlpha: lerp(prevFrame.moonAlpha, nextFrame.moonAlpha, segmentT),
    buildingTint: interpolateColor(prevFrame.buildingTint, nextFrame.buildingTint, segmentT),
    isNight: progress >= 0.95,
  };
}

/**
 * Updates player physics for a single frame.
 *
 * @param {Object} player - Player state object { y, vy, isGrounded, jumpsRemaining, height, ... }
 * @param {number} dt - Delta time in seconds
 * @param {number} groundY - Baseline ground level Y coordinate
 * @param {Object} [config] - Physics overrides
 * @returns {Object} Updated player reference
 */
export function updatePlayerPhysics(player, dt, groundY, config = {}) {
  const gravity = config.gravity ?? GAME_CONFIG.GRAVITY;
  const maxFallSpeed = config.maxFallSpeed ?? GAME_CONFIG.MAX_FALL_SPEED;

  if (!player.isGrounded) {
    player.vy = Math.min(maxFallSpeed, player.vy + gravity * dt);
    player.y += player.vy * dt;
  }

  // Ground collision check
  const playerBottom = player.y + player.height;
  if (playerBottom >= groundY) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.isGrounded = true;
    player.jumpsRemaining = 2; // Reset jump + double jump
  } else {
    player.isGrounded = false;
  }

  // Update invulnerability timer if active
  if (player.invulnerabilityTimer > 0) {
    player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt);
  }

  return player;
}

/**
 * Triggers a jump or double jump if player has jumps remaining.
 *
 * @param {Object} player - Player state object
 * @param {Object} [config] - Physics overrides
 * @returns {string|null} "JUMP", "DOUBLE_JUMP", or null if jump failed
 */
export function triggerPlayerJump(player, config = {}) {
  const jumpForce = config.jumpForce ?? GAME_CONFIG.JUMP_FORCE;
  const doubleJumpForce = config.doubleJumpForce ?? GAME_CONFIG.DOUBLE_JUMP_FORCE;

  if (player.isGrounded || player.jumpsRemaining === 2) {
    player.vy = jumpForce;
    player.isGrounded = false;
    player.jumpsRemaining = 1;
    return "JUMP";
  } else if (player.jumpsRemaining === 1) {
    player.vy = doubleJumpForce;
    player.jumpsRemaining = 0;
    return "DOUBLE_JUMP";
  }
  return null;
}
