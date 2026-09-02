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
  DISC_SCORE_BONUS: 10,       // Bonus score per collected disc
  SCORE_PER_SECOND: 10,       // Passive score per second alive

  INITIAL_LIVES: 3,
  MAX_LIVES: 5,               // Maximum life cap including extra lives
  DISCS_PER_EXTRA_LIFE: 20,   // Discs needed to earn +1 extra life
  INVULNERABILITY_DURATION: 1.8, // Seconds of invulnerability after damage
  DAY_NIGHT_DURATION: 90,        // Seconds for complete Noon -> Night cycle

  GRAVITY: 1850,              // Pixels/s^2
  JUMP_FORCE: -680,           // Initial jump velocity (px/s)
  DOUBLE_JUMP_FORCE: -580,    // Double jump velocity (px/s)
  MAX_FALL_SPEED: 1000,       // Terminal fall velocity

  MAX_PLATFORM_HEIGHT: 95,    // Max platform elevation above ground (px)
  MIN_PLATFORM_HEIGHT: 45,    // Min platform elevation above ground (px)

  // Slide mechanics
  NORMAL_PLAYER_HEIGHT: 56,   // Normal standing player height
  SLIDE_PLAYER_HEIGHT: 28,    // Low profile slide height (50% reduction)
  SLIDE_DURATION: 0.65,       // Max slide duration in seconds

  // Power-Ups
  POWERUP_TYPES: {
    SHIELD: 'SHIELD',
    MAGNET: 'MAGNET',
    OVERDRIVE: 'OVERDRIVE',
  },
  POWERUP_DURATIONS: {
    SHIELD: Infinity,         // Lasts until hit
    MAGNET: 8.0,              // 8.0 seconds
    OVERDRIVE: 4.5,           // 4.5 seconds
  },
  MAGNET_RADIUS: 220,         // Attraction radius in pixels
  MAGNET_PULL_SPEED: 520,     // Speed at which magnet pulls discs (px/s)
  OVERDRIVE_SPEED_BOOST: 140, // Bonus scrolling speed during overdrive
  OVERDRIVE_SCORE_MULTIPLIER: 2, // Score multiplier during overdrive

  // Air Combo
  AIR_COMBO_MIN_DISCS: 2,     // Minimum airborne discs to trigger combo
  MAX_AIR_COMBO_MULTIPLIER: 3.0,
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
  const aw = Math.max(1, a.width - (padA.w || 0));
  const ah = Math.max(1, a.height - (padA.h || 0));

  const bx = b.x + (padB.x || 0);
  const by = b.y + (padB.y || 0);
  const bw = Math.max(1, b.width - (padB.w || 0));
  const bh = Math.max(1, b.height - (padB.h || 0));

  return (
    ax < bx + bw &&
    ax + aw > bx &&
    ay < by + bh &&
    ay + ah > by
  );
}

/**
 * Updates disc collection state and handles extra-life granting.
 *
 * @param {number} currentDiscs - Current disc counter (0 to 19)
 * @param {number} currentLives - Current lives (1 to 5)
 * @param {number} [maxLives=5] - Maximum allowed lives
 * @param {number} [discsPerLife=20] - Number of discs required for +1 life
 * @returns {Object} { discs: number, lives: number, earnedExtraLife: boolean }
 */
export function updateDiscCollection(
  currentDiscs,
  currentLives,
  maxLives = GAME_CONFIG.MAX_LIVES,
  discsPerLife = GAME_CONFIG.DISCS_PER_EXTRA_LIFE
) {
  const safeDiscs = Math.max(0, currentDiscs || 0) + 1;
  const safeLives = Math.max(0, currentLives || 0);

  if (safeDiscs >= discsPerLife) {
    const newLives = Math.min(maxLives, safeLives + 1);
    return {
      discs: 0,
      lives: newLives,
      earnedExtraLife: true,
    };
  }

  return {
    discs: safeDiscs,
    lives: safeLives,
    earnedExtraLife: false,
  };
}

/**
 * Calculates theoretical maximum single-jump height from jump force and gravity.
 * Formula: H = v_0^2 / (2 * g)
 *
 * @param {number} [jumpForce] - Initial jump velocity in px/s (negative)
 * @param {number} [gravity] - Gravity in px/s^2
 * @returns {number} Maximum height in pixels
 */
export function calculateMaxJumpHeight(
  jumpForce = GAME_CONFIG.JUMP_FORCE,
  gravity = GAME_CONFIG.GRAVITY
) {
  const v0 = Math.abs(jumpForce);
  return (v0 * v0) / (2 * gravity);
}

/**
 * Calculates theoretical maximum single-jump horizontal distance at a given speed.
 * Formula: T_air = 2 * v_0 / g, D = speed * T_air
 *
 * @param {number} speed - Horizontal velocity in px/s
 * @param {number} [jumpForce] - Jump velocity in px/s
 * @param {number} [gravity] - Gravity in px/s^2
 * @returns {number} Distance in pixels
 */
export function calculateMaxJumpDistance(
  speed,
  jumpForce = GAME_CONFIG.JUMP_FORCE,
  gravity = GAME_CONFIG.GRAVITY
) {
  const v0 = Math.abs(jumpForce);
  const airTime = (2 * v0) / gravity;
  return Math.max(0, speed * airTime);
}

/**
 * Derives a fair, jumpable chasm width dynamically from current speed and jump physics.
 *
 * @param {number} speed - Current running speed in px/s
 * @param {number} [maxRatio=0.55] - Safe ratio of max jump distance
 * @returns {number} Fair chasm width in pixels
 */
export function calculateSafeChasmWidth(speed, maxRatio = 0.55) {
  const maxDistance = calculateMaxJumpDistance(speed);
  const safeWidth = Math.round(maxDistance * maxRatio);
  return Math.max(75, Math.min(185, safeWidth));
}

/**
 * Checks if a falling player lands on top of a platform (one-way platform physics).
 *
 * @param {Object} player - { x, y, width, height, vy }
 * @param {number} prevY - Player Y position in the previous frame
 * @param {Object} platform - { x, y, width, height }
 * @returns {boolean} True if player should land on the platform
 */
export function checkPlatformLanding(player, prevY, platform) {
  if (!player || !platform || player.vy < 0) return false;

  const playerLeft = player.x + (player.hitPadding?.x || 6);
  const playerRight = player.x + player.width - (player.hitPadding?.w ? player.hitPadding.w - (player.hitPadding.x || 0) : 6);

  const platLeft = platform.x;
  const platRight = platform.x + platform.width;

  // Check horizontal overlap
  const isHorizontallyOverlapping = playerRight > platLeft && playerLeft < platRight;
  if (!isHorizontallyOverlapping) return false;

  const prevBottom = prevY + player.height;
  const currentBottom = player.y + player.height;
  const platTop = platform.y;

  // Player bottom was above/near platform top and is now crossing or landing on it
  const crossedTop = prevBottom <= platTop + 14 && currentBottom >= platTop - 2;
  return crossedTop;
}

/**
 * Checks if the player has fallen into a chasm (gap in the ground).
 *
 * @param {Object} player - { x, y, width, height }
 * @param {Object} chasm - { x, width }
 * @param {number} groundY - Baseline ground level Y coordinate
 * @returns {boolean} True if player is falling through the gap
 */
export function checkPlayerInChasm(player, chasm, groundY) {
  if (!player || !chasm) return false;

  const playerCenterX = player.x + player.width / 2;
  const isOverChasm = playerCenterX >= chasm.x && playerCenterX <= chasm.x + chasm.width;
  const isBelowGround = (player.y + player.height) > groundY + 15;

  return isOverChasm && isBelowGround;
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
 * @param {number} [discsCollected=0] - Total discs collected
 * @param {Object} [config] - Score weights
 * @returns {number} Integer score
 */
export function calculateScore(elapsedSeconds, obstaclesCleared = 0, discsCollected = 0, config = {}) {
  const scorePerSec = config.scorePerSecond ?? GAME_CONFIG.SCORE_PER_SECOND;
  const bonusPerObstacle = config.obstacleBonus ?? GAME_CONFIG.OBSTACLE_CLEAR_BONUS;
  const bonusPerDisc = config.discBonus ?? GAME_CONFIG.DISC_SCORE_BONUS;

  const timeScore = Math.max(0, elapsedSeconds) * scorePerSec;
  const obstacleScore = Math.max(0, obstaclesCleared) * bonusPerObstacle;
  const discScore = Math.max(0, discsCollected) * bonusPerDisc;
  return Math.floor(timeScore + obstacleScore + discScore);
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
 *
 * @param {number} elapsedSeconds - Total gameplay time in seconds
 * @param {number} [duration=90] - Total transition time to full night
 * @returns {Object} Interpolated lighting parameters
 */
export function getDayNightCycle(elapsedSeconds, duration = GAME_CONFIG.DAY_NIGHT_DURATION) {
  const safeTime = Math.max(0, elapsedSeconds);
  const progress = Math.min(1, safeTime / duration);

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
 * Supports ground baseline and active elevated platforms.
 *
 * @param {Object} player - Player state object
 * @param {number} dt - Delta time in seconds
 * @param {number} groundY - Baseline ground level Y coordinate
 * @param {Array<Object>} [platforms=[]] - List of active platforms
 * @param {Array<Object>} [chasms=[]] - List of active chasms
 * @param {Object} [config] - Physics overrides
 * @returns {Object} Updated player reference
 */
export function updatePlayerPhysics(player, dt, groundY, platforms = [], chasms = [], config = {}) {
  const gravity = config.gravity ?? GAME_CONFIG.GRAVITY;
  const maxFallSpeed = config.maxFallSpeed ?? GAME_CONFIG.MAX_FALL_SPEED;
  const prevY = player.y;

  // Apply gravity if not grounded
  if (!player.isGrounded) {
    player.vy = Math.min(maxFallSpeed, player.vy + gravity * dt);
    player.y += player.vy * dt;
  }

  let landedOnPlatform = false;

  // Check landing on active platforms
  if (platforms && platforms.length > 0) {
    for (const plat of platforms) {
      if (checkPlatformLanding(player, prevY, plat)) {
        player.y = plat.y - player.height;
        player.vy = 0;
        player.isGrounded = true;
        player.currentPlatform = plat;
        player.jumpsRemaining = 2;
        landedOnPlatform = true;
        break;
      }
    }
  }

  // If standing on a platform, check if walked off the edge
  if (player.isGrounded && player.currentPlatform) {
    const plat = player.currentPlatform;
    const playerLeft = player.x + (player.hitPadding?.x || 6);
    const playerRight = player.x + player.width - 6;
    if (playerRight < plat.x || playerLeft > plat.x + plat.width || !platforms.includes(plat)) {
      player.isGrounded = false;
      player.currentPlatform = null;
    }
  }

  // Ground collision check if not on a platform
  if (!landedOnPlatform && !player.currentPlatform) {
    const playerBottom = player.y + player.height;

    // Check if player is over an active chasm
    let overChasm = false;
    if (chasms && chasms.length > 0) {
      const playerCenterX = player.x + player.width / 2;
      for (const chasm of chasms) {
        if (playerCenterX >= chasm.x && playerCenterX <= chasm.x + chasm.width) {
          overChasm = true;
          break;
        }
      }
    }

    if (!overChasm && playerBottom >= groundY) {
      player.y = groundY - player.height;
      player.vy = 0;
      player.isGrounded = true;
      player.jumpsRemaining = 2;
    } else if (overChasm) {
      // Over chasm: player falls through ground
      player.isGrounded = false;
    }
  }

  // Update invulnerability timer if active
  if (player.invulnerabilityTimer > 0) {
    player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt);
  }

  return player;
}

/**
 * Triggers a jump or double jump if player has jumps remaining.
 * Automatically cancels an active slide when jumping.
 *
 * @param {Object} player - Player state object
 * @param {Object} [config] - Physics overrides
 * @returns {string|null} "JUMP", "DOUBLE_JUMP", or null if jump failed
 */
export function triggerPlayerJump(player, config = {}) {
  if (!player) return null;

  if (player.isSliding) {
    cancelPlayerSlide(player, config);
  }

  const jumpForce = config.jumpForce ?? GAME_CONFIG.JUMP_FORCE;
  const doubleJumpForce = config.doubleJumpForce ?? GAME_CONFIG.DOUBLE_JUMP_FORCE;

  if (player.isGrounded || player.jumpsRemaining === 2) {
    player.vy = jumpForce;
    player.isGrounded = false;
    player.currentPlatform = null;
    player.jumpsRemaining = 1;
    return "JUMP";
  } else if (player.jumpsRemaining === 1) {
    player.vy = doubleJumpForce;
    player.isGrounded = false;
    player.currentPlatform = null;
    player.jumpsRemaining = 0;
    return "DOUBLE_JUMP";
  }
  return null;
}

/**
 * Initiates a slide if player is grounded and not currently sliding.
 * Reduces player hitbox height and adjusts Y position to keep feet on ground.
 *
 * @param {Object} player - Player state object
 * @param {Object} [config] - Optional overrides
 * @returns {boolean} True if slide was successfully initiated
 */
export function triggerPlayerSlide(player, config = {}) {
  if (!player || !player.isGrounded || player.isSliding) return false;

  const normalHeight = config.normalHeight ?? GAME_CONFIG.NORMAL_PLAYER_HEIGHT;
  const slideHeight = config.slideHeight ?? GAME_CONFIG.SLIDE_PLAYER_HEIGHT;
  const slideDuration = config.slideDuration ?? GAME_CONFIG.SLIDE_DURATION;

  player.isSliding = true;
  player.slideTimer = slideDuration;
  player.height = slideHeight;
  player.y += (normalHeight - slideHeight);

  return true;
}

/**
 * Cancels an active slide, restoring player to normal standing height.
 *
 * @param {Object} player - Player state object
 * @param {Object} [config] - Optional overrides
 * @returns {boolean} True if slide was cancelled
 */
export function cancelPlayerSlide(player, config = {}) {
  if (!player || !player.isSliding) return false;

  const normalHeight = config.normalHeight ?? GAME_CONFIG.NORMAL_PLAYER_HEIGHT;
  const slideHeight = config.slideHeight ?? GAME_CONFIG.SLIDE_PLAYER_HEIGHT;

  player.isSliding = false;
  player.slideTimer = 0;
  player.y -= (normalHeight - slideHeight);
  player.height = normalHeight;

  return true;
}

/**
 * Updates player slide timer and automatically restores standing height when time expires.
 *
 * @param {Object} player - Player state object
 * @param {number} dt - Delta time in seconds
 * @param {Object} [config] - Optional overrides
 * @returns {Object} Updated player object
 */
export function updatePlayerSlide(player, dt, config = {}) {
  if (!player || !player.isSliding) return player;

  player.slideTimer = Math.max(0, player.slideTimer - dt);
  if (player.slideTimer <= 0) {
    cancelPlayerSlide(player, config);
  }

  return player;
}

/**
 * Creates an empty active power-ups state object.
 *
 * @returns {Object} { shield: boolean, magnetTimer: number, overdriveTimer: number }
 */
export function createPowerUpState() {
  return {
    shield: false,
    magnetTimer: 0,
    overdriveTimer: 0,
  };
}

/**
 * Activates or refreshes a power-up in the power-up state.
 *
 * @param {Object} state - Current power-up state
 * @param {string} type - 'SHIELD' | 'MAGNET' | 'OVERDRIVE'
 * @param {Object} [config] - Optional duration overrides
 * @returns {Object} Updated state
 */
export function applyPowerUp(state, type, config = {}) {
  if (!state) return state;

  const magnetDuration = config.magnetDuration ?? GAME_CONFIG.POWERUP_DURATIONS.MAGNET;
  const overdriveDuration = config.overdriveDuration ?? GAME_CONFIG.POWERUP_DURATIONS.OVERDRIVE;

  if (type === GAME_CONFIG.POWERUP_TYPES.SHIELD) {
    state.shield = true;
  } else if (type === GAME_CONFIG.POWERUP_TYPES.MAGNET) {
    state.magnetTimer = magnetDuration;
  } else if (type === GAME_CONFIG.POWERUP_TYPES.OVERDRIVE) {
    state.overdriveTimer = overdriveDuration;
  }

  return state;
}

/**
 * Updates power-up countdown timers.
 *
 * @param {Object} state - Current power-up state
 * @param {number} dt - Delta time in seconds
 * @returns {Object} Updated state
 */
export function updatePowerUpTimers(state, dt) {
  if (!state) return state;

  if (state.magnetTimer > 0) {
    state.magnetTimer = Math.max(0, state.magnetTimer - dt);
  }
  if (state.overdriveTimer > 0) {
    state.overdriveTimer = Math.max(0, state.overdriveTimer - dt);
  }

  return state;
}

/**
 * Calculates vector and movement for a disc attracted to player via magnet.
 *
 * @param {Object} player - { x, y, width, height }
 * @param {Object} disc - { x, y, width, height }
 * @param {number} dt - Delta time in seconds
 * @param {Object} [config] - Optional magnet settings
 * @returns {Object} { attracted: boolean, dx: number, dy: number, distance: number }
 */
export function calculateMagnetAttraction(player, disc, dt, config = {}) {
  if (!player || !disc) return { attracted: false, dx: 0, dy: 0, distance: Infinity };

  const radius = config.magnetRadius ?? GAME_CONFIG.MAGNET_RADIUS;
  const pullSpeed = config.pullSpeed ?? GAME_CONFIG.MAGNET_PULL_SPEED;

  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  const dxCenter = disc.x + disc.width / 2;
  const dyCenter = disc.y + disc.height / 2;

  const diffX = px - dxCenter;
  const diffY = py - dyCenter;
  const dist = Math.hypot(diffX, diffY);

  if (dist > 0 && dist <= radius) {
    const step = Math.min(dist, pullSpeed * dt);
    const nx = diffX / dist;
    const ny = diffY / dist;
    return {
      attracted: true,
      dx: nx * step,
      dy: ny * step,
      distance: dist,
    };
  }

  return {
    attracted: false,
    dx: 0,
    dy: 0,
    distance: dist,
  };
}

/**
 * Calculates air-combo multiplier based on consecutive airborne discs collected.
 *
 * @param {number} airDiscsCount - Consecutive airborne discs collected without touching ground
 * @returns {number} Multiplier (1.0 to 3.0)
 */
export function calculateAirComboMultiplier(airDiscsCount) {
  if (!airDiscsCount || airDiscsCount < GAME_CONFIG.AIR_COMBO_MIN_DISCS) {
    return 1.0;
  }
  const multiplier = 1.0 + (airDiscsCount - 1) * 0.5;
  return Math.min(GAME_CONFIG.MAX_AIR_COMBO_MULTIPLIER, Math.round(multiplier * 10) / 10);
}

/**
 * Calculates bonus points awarded when landing an air combo.
 *
 * @param {number} airDiscsCount - Discs collected in air
 * @param {number} [discBonus] - Points per disc
 * @returns {number} Bonus score
 */
export function calculateAirComboBonus(airDiscsCount, discBonus = GAME_CONFIG.DISC_SCORE_BONUS) {
  if (!airDiscsCount || airDiscsCount < GAME_CONFIG.AIR_COMBO_MIN_DISCS) {
    return 0;
  }
  const mult = calculateAirComboMultiplier(airDiscsCount);
  return Math.floor(airDiscsCount * discBonus * (mult - 1.0));
}

