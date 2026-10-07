import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCollision,
  calculateGameSpeed,
  calculateSpawnInterval,
  calculateScore,
  validatePlayerName,
  updateHighScores,
  getDayNightCycle,
  interpolateColor,
  hexToRgb,
  updatePlayerPhysics,
  triggerPlayerJump,
  updateDiscCollection,
  calculateMaxJumpHeight,
  calculateMaxJumpDistance,
  calculateSafeChasmWidth,
  checkPlatformLanding,
  checkPlayerInChasm,
  triggerPlayerSlide,
  cancelPlayerSlide,
  updatePlayerSlide,
  createPowerUpState,
  applyPowerUp,
  updatePowerUpTimers,
  calculateMagnetAttraction,
  calculateAirComboMultiplier,
  calculateAirComboBonus,
  triggerPlayerFastFall,
  getInitialMetaState,
  migrateMetaState,
  bankDiscs,
  buyShopSkin,
  buyShopTrail,
  buyUpgrade,
  checkAchievements,
  SKIN_CATALOG,
  TRAIL_CATALOG,
  UPGRADE_CATALOG,
  GAME_CONFIG,
} from '../js/logic.js';

describe('Logic Module - checkCollision()', () => {
  it('should detect direct overlapping rectangles', () => {
    const a = { x: 50, y: 100, width: 40, height: 40 };
    const b = { x: 70, y: 110, width: 40, height: 40 };
    assert.equal(checkCollision(a, b), true);
  });

  it('should return false for separated rectangles (X axis)', () => {
    const a = { x: 0, y: 100, width: 30, height: 30 };
    const b = { x: 100, y: 100, width: 30, height: 30 };
    assert.equal(checkCollision(a, b), false);
  });

  it('should return false for separated rectangles (Y axis)', () => {
    const a = { x: 50, y: 50, width: 30, height: 30 };
    const b = { x: 50, y: 150, width: 30, height: 30 };
    assert.equal(checkCollision(a, b), false);
  });

  it('should return false when rectangles touch edges exactly without overlap', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 50, y: 0, width: 50, height: 50 };
    assert.equal(checkCollision(a, b), false);
  });

  it('should respect hitbox padding/insets', () => {
    const a = { x: 0, y: 0, width: 50, height: 50, hitPadding: { x: 10, y: 10, w: 20, h: 20 } }; // effective rect: [10, 10, 30, 30] -> max X is 40
    const b = { x: 42, y: 10, width: 20, height: 20 };
    assert.equal(checkCollision(a, b), false);
  });

  it('should handle null or invalid inputs safely', () => {
    assert.equal(checkCollision(null, { x: 0, y: 0, width: 10, height: 10 }), false);
    assert.equal(checkCollision(undefined, undefined), false);
  });
});

describe('Logic Module - Collectible Discs & Extra Life System', () => {
  it('should increment disc count by 1 normally', () => {
    const res = updateDiscCollection(5, 3);
    assert.equal(res.discs, 6);
    assert.equal(res.lives, 3);
    assert.equal(res.earnedExtraLife, false);
  });

  it('should award +1 life and reset discs to 0 when reaching 20 discs', () => {
    const res = updateDiscCollection(19, 3);
    assert.equal(res.discs, 0);
    assert.equal(res.lives, 4);
    assert.equal(res.earnedExtraLife, true);
  });

  it('should cap lives at MAX_LIVES (5) when reaching 20 discs', () => {
    const res = updateDiscCollection(19, 5, 5, 20);
    assert.equal(res.discs, 0);
    assert.equal(res.lives, 5);
    assert.equal(res.earnedExtraLife, true);
  });

  it('should handle overflow safely if discs already >= 20', () => {
    const res = updateDiscCollection(20, 2);
    assert.equal(res.discs, 0);
    assert.equal(res.lives, 3);
    assert.equal(res.earnedExtraLife, true);
  });

  it('should handle negative or undefined values safely', () => {
    const res = updateDiscCollection(undefined, undefined);
    assert.equal(res.discs, 1);
    assert.equal(res.lives, 0);
  });
});

describe('Logic Module - Platform Physics & Reachability', () => {
  it('should calculate realistic max single-jump height', () => {
    const height = calculateMaxJumpHeight(-680, 1850);
    // H = (680^2) / (2 * 1850) = 462400 / 3700 = 124.97px
    assert.ok(height > 120 && height < 130);
  });

  it('should calculate jump distance proportional to speed', () => {
    const distBase = calculateMaxJumpDistance(360, -680, 1850);
    const distFast = calculateMaxJumpDistance(720, -680, 1850);
    assert.ok(distFast > distBase * 1.95);
  });

  it('should detect player landing on top of platform when falling', () => {
    const platform = { x: 100, y: 350, width: 120, height: 16 };
    const player = {
      x: 120,
      y: 300, // Bottom is at 356 (intersecting top at 350)
      width: 38,
      height: 56,
      vy: 150, // Falling down
    };
    const prevY = 290; // Prev bottom was 346 (above platform)

    const landed = checkPlatformLanding(player, prevY, platform);
    assert.equal(landed, true);
  });

  it('should reject landing if player is moving upward (jumping through from below)', () => {
    const platform = { x: 100, y: 350, width: 120, height: 16 };
    const player = {
      x: 120,
      y: 300,
      width: 38,
      height: 56,
      vy: -300, // Moving upward
    };
    const prevY = 310;

    const landed = checkPlatformLanding(player, prevY, platform);
    assert.equal(landed, false);
  });

  it('should reject landing if horizontally outside platform bounds', () => {
    const platform = { x: 200, y: 350, width: 100, height: 16 };
    const player = {
      x: 50, // Left of platform
      y: 300,
      width: 38,
      height: 56,
      vy: 200,
    };
    const prevY = 290;

    const landed = checkPlatformLanding(player, prevY, platform);
    assert.equal(landed, false);
  });

  it('should land player on platform and allow walking off the edge', () => {
    const platform = { x: 100, y: 380, width: 100, height: 16 };
    const groundY = 460;
    const player = {
      x: 120,
      y: 320,
      vy: 50,
      width: 38,
      height: 56,
      isGrounded: false,
      jumpsRemaining: 0,
      currentPlatform: null,
    };

    // Step 1: Lands on platform
    updatePlayerPhysics(player, 0.05, groundY, [platform], []);
    assert.equal(player.isGrounded, true);
    assert.equal(player.y, platform.y - player.height); // 380 - 56 = 324
    assert.equal(player.currentPlatform, platform);
    assert.equal(player.jumpsRemaining, 2);

    // Step 2: Player walks off right edge (x moves beyond platform)
    player.x = 220;
    updatePlayerPhysics(player, 0.05, groundY, [platform], []);
    assert.equal(player.isGrounded, false);
    assert.equal(player.currentPlatform, null);
  });
});

describe('Logic Module - Chasms & Jump Balancing', () => {
  it('should derive fair chasm widths within jumpable limits', () => {
    const widthSlow = calculateSafeChasmWidth(360);
    const widthFast = calculateSafeChasmWidth(780);

    assert.ok(widthSlow >= 75 && widthSlow <= 150);
    assert.ok(widthFast >= widthSlow && widthFast <= 185);
  });

  it('should detect when player falls into a chasm', () => {
    const chasm = { x: 100, width: 120 };
    const groundY = 460;
    const playerIn = {
      x: 130,
      y: 430, // Bottom at 486 (> groundY + 15)
      width: 38,
      height: 56,
    };
    const playerAbove = {
      x: 130,
      y: 360, // Bottom at 416 (above ground level)
      width: 38,
      height: 56,
    };
    const playerOutside = {
      x: 20, // Not over chasm
      y: 430,
      width: 38,
      height: 56,
    };

    assert.equal(checkPlayerInChasm(playerIn, chasm, groundY), true);
    assert.equal(checkPlayerInChasm(playerAbove, chasm, groundY), false);
    assert.equal(checkPlayerInChasm(playerOutside, chasm, groundY), false);
  });
});

describe('Logic Module - calculateGameSpeed() & Difficulty Curve', () => {
  it('should return base speed at t = 0', () => {
    const speed = calculateGameSpeed(0);
    assert.equal(speed, GAME_CONFIG.BASE_SPEED);
  });

  it('should increase speed over time with stepped and continuous curve', () => {
    const s0 = calculateGameSpeed(0);
    const s15 = calculateGameSpeed(15);
    const s30 = calculateGameSpeed(30);
    const s60 = calculateGameSpeed(60);

    assert.ok(s15 > s0, 'Speed at 15s should be greater than initial');
    assert.ok(s30 > s15, 'Speed at 30s should be greater than at 15s');
    assert.ok(s60 > s30, 'Speed at 60s should be greater than at 30s');
  });

  it('should cap at max speed for high elapsed time', () => {
    const speedLong = calculateGameSpeed(600);
    assert.equal(speedLong, GAME_CONFIG.MAX_SPEED);
  });

  it('should handle negative elapsed time safely', () => {
    const speed = calculateGameSpeed(-5);
    assert.equal(speed, GAME_CONFIG.BASE_SPEED);
  });
});

describe('Logic Module - calculateSpawnInterval()', () => {
  it('should start at BASE_SPAWN_INTERVAL at t = 0', () => {
    assert.equal(calculateSpawnInterval(0), GAME_CONFIG.BASE_SPAWN_INTERVAL);
  });

  it('should decrease interval as time progresses', () => {
    const i0 = calculateSpawnInterval(0);
    const i45 = calculateSpawnInterval(45);
    const i90 = calculateSpawnInterval(90);

    assert.ok(i45 < i0, 'Spawn interval should decrease over time');
    assert.ok(i90 < i45, 'Spawn interval should continue decreasing');
  });

  it('should never drop below MIN_SPAWN_INTERVAL', () => {
    const iFar = calculateSpawnInterval(500);
    assert.equal(iFar, GAME_CONFIG.MIN_SPAWN_INTERVAL);
  });
});

describe('Logic Module - calculateScore()', () => {
  it('should calculate time-based score, obstacle bonus and disc bonus', () => {
    const score = calculateScore(10, 3, 5); // 10s * 10 + 3 * 25 + 5 * 10 = 100 + 75 + 50 = 225
    assert.equal(score, 225);
  });

  it('should return 0 for t = 0 and 0 obstacles/discs', () => {
    assert.equal(calculateScore(0, 0, 0), 0);
  });

  it('should handle negative inputs by clamping to 0', () => {
    assert.equal(calculateScore(-5, -2, -1), 0);
  });
});

describe('Logic Module - validatePlayerName()', () => {
  it('should trim whitespace from names', () => {
    assert.equal(validatePlayerName('   CYBER_PUNK   '), 'CYBER_PUNK');
  });

  it('should sanitize HTML/dangerous characters', () => {
    assert.equal(validatePlayerName('<b>NEO</b>'), 'bNEO/b');
  });

  it('should truncate names longer than maxLength', () => {
    assert.equal(validatePlayerName('VERY_LONG_NAME_BEYOND_LIMIT', 10), 'VERY_LONG_');
  });

  it('should return default name for empty strings or invalid types', () => {
    assert.equal(validatePlayerName(''), 'RUNNER');
    assert.equal(validatePlayerName('    '), 'RUNNER');
    assert.equal(validatePlayerName(null), 'RUNNER');
    assert.equal(validatePlayerName(123), 'RUNNER');
  });
});

describe('Logic Module - updateHighScores()', () => {
  it('should insert entry into empty list', () => {
    const list = updateHighScores([], { name: 'NEO', score: 500 });
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'NEO');
    assert.equal(list[0].score, 500);
  });

  it('should sort entries descending by score', () => {
    const initial = [
      { name: 'TRINITY', score: 400 },
      { name: 'CYPHER', score: 150 },
    ];
    const updated = updateHighScores(initial, { name: 'NEO', score: 800 });
    assert.equal(updated[0].name, 'NEO');
    assert.equal(updated[0].score, 800);
    assert.equal(updated[1].name, 'TRINITY');
    assert.equal(updated[2].name, 'CYPHER');
  });

  it('should truncate list to maxEntries (default 10)', () => {
    const initial = Array.from({ length: 10 }, (_, i) => ({
      name: `RUNNER_${i}`,
      score: (10 - i) * 100,
    }));
    const updated = updateHighScores(initial, { name: 'CHAMP', score: 1500 });
    assert.equal(updated.length, 10);
    assert.equal(updated[0].name, 'CHAMP');
    assert.equal(updated[9].name, 'RUNNER_8');
  });

  it('should ignore invalid or non-numeric new entries gracefully', () => {
    const initial = [{ name: 'NEO', score: 500 }];
    const updated = updateHighScores(initial, { name: 'BAD', score: NaN });
    assert.equal(updated.length, 1);
    assert.equal(updated[0].score, 500);
  });
});

describe('Logic Module - Day-to-Night Lighting Cycle', () => {
  it('should correctly parse hex to rgb and interpolate colors', () => {
    const rgb = hexToRgb('#ff0000');
    assert.deepEqual(rgb, { r: 255, g: 0, b: 0 });

    const mixed = interpolateColor('#000000', '#ffffff', 0.5);
    assert.equal(mixed, 'rgb(128, 128, 128)');
  });

  it('should start at Noon with neon intensity 0 and full ambient light at t = 0', () => {
    const cycle = getDayNightCycle(0);
    assert.equal(cycle.progress, 0);
    assert.equal(cycle.neonIntensity, 0);
    assert.equal(cycle.ambient, 1.0);
    assert.equal(cycle.sunAlpha, 1.0);
    assert.equal(cycle.moonAlpha, 0.0);
    assert.equal(cycle.isNight, false);
  });

  it('should interpolate smoothly at midway (t = 45s)', () => {
    const cycle = getDayNightCycle(45);
    assert.ok(cycle.progress > 0.4 && cycle.progress < 0.6);
    assert.ok(cycle.neonIntensity > 0 && cycle.neonIntensity < 1);
    assert.ok(cycle.ambient < 1.0 && cycle.ambient > 0.4);
  });

  it('should reach full Cyberpunk Night at t = 90s', () => {
    const cycle = getDayNightCycle(90);
    assert.equal(cycle.progress, 1);
    assert.equal(cycle.neonIntensity, 1.0);
    assert.equal(cycle.ambient, 0.35);
    assert.equal(cycle.sunAlpha, 0.0);
    assert.equal(cycle.moonAlpha, 1.0);
    assert.equal(cycle.isNight, true);
  });

  it('should remain clamped at Night for t > 90s', () => {
    const cycle = getDayNightCycle(180);
    assert.equal(cycle.progress, 1);
    assert.equal(cycle.neonIntensity, 1.0);
    assert.equal(cycle.isNight, true);
  });
});

describe('Logic Module - Player Physics & Jump Logic', () => {
  it('should initiate a jump when grounded', () => {
    const player = {
      y: 300,
      vy: 0,
      width: 32,
      height: 48,
      isGrounded: true,
      jumpsRemaining: 2,
    };
    const action = triggerPlayerJump(player);
    assert.equal(action, 'JUMP');
    assert.equal(player.vy, GAME_CONFIG.JUMP_FORCE);
    assert.equal(player.isGrounded, false);
    assert.equal(player.jumpsRemaining, 1);
  });

  it('should allow double jump when in mid-air with 1 jump remaining', () => {
    const player = {
      y: 200,
      vy: -100,
      width: 32,
      height: 48,
      isGrounded: false,
      jumpsRemaining: 1,
    };
    const action = triggerPlayerJump(player);
    assert.equal(action, 'DOUBLE_JUMP');
    assert.equal(player.vy, GAME_CONFIG.DOUBLE_JUMP_FORCE);
    assert.equal(player.jumpsRemaining, 0);
  });

  it('should reject jump when no jumps remaining', () => {
    const player = {
      y: 200,
      vy: 50,
      width: 32,
      height: 48,
      isGrounded: false,
      jumpsRemaining: 0,
    };
    const action = triggerPlayerJump(player);
    assert.equal(action, null);
    assert.equal(player.vy, 50);
  });

  it('should apply gravity and land on groundY properly', () => {
    const groundY = 400;
    const player = {
      y: 350,
      vy: 100,
      width: 32,
      height: 48,
      isGrounded: false,
      jumpsRemaining: 0,
      invulnerabilityTimer: 1.0,
    };

    const dt = 0.05; // 50ms
    updatePlayerPhysics(player, dt, groundY, [], []);

    assert.equal(player.y, groundY - player.height); // 400 - 48 = 352
    assert.equal(player.vy, 0);
    assert.equal(player.isGrounded, true);
    assert.equal(player.jumpsRemaining, 2);
    assert.ok(player.invulnerabilityTimer < 1.0, 'Invulnerability timer should tick down');
  });
});

describe('Logic Module - Cyber-Slide Mechanics', () => {
  it('should trigger slide when player is grounded', () => {
    const player = {
      y: 404, // groundY (460) - normalHeight (56)
      height: 56,
      isGrounded: true,
      isSliding: false,
    };

    const success = triggerPlayerSlide(player);
    assert.equal(success, true);
    assert.equal(player.isSliding, true);
    assert.equal(player.height, GAME_CONFIG.SLIDE_PLAYER_HEIGHT); // 28
    assert.equal(player.slideTimer, GAME_CONFIG.SLIDE_DURATION);
    // Y position should have moved down so bottom (feet) stays at 460
    assert.equal(player.y, 404 + (56 - 28)); // 432
    assert.equal(player.y + player.height, 460);
  });

  it('should reject slide when player is in mid-air or already sliding', () => {
    const airPlayer = {
      y: 200,
      height: 56,
      isGrounded: false,
      isSliding: false,
    };
    assert.equal(triggerPlayerSlide(airPlayer), false);

    const slidingPlayer = {
      y: 432,
      height: 28,
      isGrounded: true,
      isSliding: true,
    };
    assert.equal(triggerPlayerSlide(slidingPlayer), false);
  });

  it('should restore standing height when slide expires or is cancelled', () => {
    const player = {
      y: 432,
      height: 28,
      isGrounded: true,
      isSliding: true,
      slideTimer: 0.1,
    };

    // Update with dt that exceeds slideTimer
    updatePlayerSlide(player, 0.15);
    assert.equal(player.isSliding, false);
    assert.equal(player.height, GAME_CONFIG.NORMAL_PLAYER_HEIGHT);
    assert.equal(player.y, 404);
    assert.equal(player.y + player.height, 460);
  });

  it('should automatically cancel slide when player jumps', () => {
    const player = {
      y: 432,
      height: 28,
      isGrounded: true,
      isSliding: true,
      slideTimer: 0.4,
      jumpsRemaining: 2,
    };

    const action = triggerPlayerJump(player);
    assert.equal(action, 'JUMP');
    assert.equal(player.isSliding, false);
    assert.equal(player.height, GAME_CONFIG.NORMAL_PLAYER_HEIGHT);
    assert.equal(player.isGrounded, false);
  });
});

describe('Logic Module - Power-Up System', () => {
  it('should create initial empty power-up state', () => {
    const state = createPowerUpState();
    assert.equal(state.shield, false);
    assert.equal(state.magnetTimer, 0);
    assert.equal(state.overdriveTimer, 0);
  });

  it('should activate shield, magnet and overdrive properly', () => {
    const state = createPowerUpState();
    applyPowerUp(state, GAME_CONFIG.POWERUP_TYPES.SHIELD);
    assert.equal(state.shield, true);

    applyPowerUp(state, GAME_CONFIG.POWERUP_TYPES.MAGNET);
    assert.equal(state.magnetTimer, GAME_CONFIG.POWERUP_DURATIONS.MAGNET);

    applyPowerUp(state, GAME_CONFIG.POWERUP_TYPES.OVERDRIVE);
    assert.equal(state.overdriveTimer, GAME_CONFIG.POWERUP_DURATIONS.OVERDRIVE);
  });

  it('should decrement power-up timers over time', () => {
    const state = {
      shield: true,
      magnetTimer: 5.0,
      overdriveTimer: 2.0,
    };

    updatePowerUpTimers(state, 1.5);
    assert.equal(state.shield, true); // Shield has no timer
    assert.equal(Math.round(state.magnetTimer * 10) / 10, 3.5);
    assert.equal(Math.round(state.overdriveTimer * 10) / 10, 0.5);

    updatePowerUpTimers(state, 1.0);
    assert.equal(state.overdriveTimer, 0); // Clamped at 0
  });

  it('should calculate magnetic pull vector towards player within radius', () => {
    const player = { x: 100, y: 300, width: 38, height: 56 };
    const discNear = { x: 200, y: 300, width: 26, height: 26 };
    const discFar = { x: 600, y: 300, width: 26, height: 26 };

    const attractionNear = calculateMagnetAttraction(player, discNear, 0.016);
    assert.equal(attractionNear.attracted, true);
    assert.ok(attractionNear.dx < 0, 'Disc should be pulled left toward player');

    const attractionFar = calculateMagnetAttraction(player, discFar, 0.016);
    assert.equal(attractionFar.attracted, false);
    assert.equal(attractionFar.dx, 0);
  });
});

describe('Logic Module - Air-Combo System', () => {
  it('should return 1.0x multiplier and 0 bonus for less than 2 airborne discs', () => {
    assert.equal(calculateAirComboMultiplier(0), 1.0);
    assert.equal(calculateAirComboMultiplier(1), 1.0);
    assert.equal(calculateAirComboBonus(0), 0);
    assert.equal(calculateAirComboBonus(1), 0);
  });

  it('should scale combo multiplier progressively with airborne discs', () => {
    assert.equal(calculateAirComboMultiplier(2), 1.5);
    assert.equal(calculateAirComboMultiplier(3), 2.0);
    assert.equal(calculateAirComboMultiplier(4), 2.5);
    assert.equal(calculateAirComboMultiplier(5), 3.0);
    assert.equal(calculateAirComboMultiplier(10), 3.0); // Capped at 3.0
  });

  it('should calculate correct bonus points for combo chains', () => {
    // 3 discs @ 10pts each * (2.0 - 1.0) = 30 bonus points
    const bonus3 = calculateAirComboBonus(3, 10);
    assert.equal(bonus3, 30);

    // 4 discs @ 10pts each * (2.5 - 1.0) = 60 bonus points
    const bonus4 = calculateAirComboBonus(4, 10);
    assert.equal(bonus4, 60);
  });
});

describe('Logic Module - Fast-Fall Mechanics', () => {
  it('should apply fast-fall when player is airborne', () => {
    const player = { isGrounded: false, vy: -200 };
    const success = triggerPlayerFastFall(player);
    assert.equal(success, true);
    assert.equal(player.vy, GAME_CONFIG.FAST_FALL_VELOCITY);
    assert.equal(player.isFastFalling, true);
  });

  it('should reject fast-fall when player is already grounded', () => {
    const player = { isGrounded: true, vy: 0 };
    const success = triggerPlayerFastFall(player);
    assert.equal(success, false);
    assert.equal(player.vy, 0);
  });

  it('should not reduce velocity if already falling faster than fastFallVelocity', () => {
    const player = { isGrounded: false, vy: 950 };
    const success = triggerPlayerFastFall(player, 850);
    assert.equal(success, false);
    assert.equal(player.vy, 950);
  });
});

describe('Logic Module - Metaprogression, Shop & Achievements', () => {
  it('should return valid initial meta state and safely migrate corrupted input', () => {
    const initial = getInitialMetaState();
    assert.equal(initial.version, 2);
    assert.equal(initial.bankedDiscs, 0);
    assert.equal(initial.selectedSkin, 'DEFAULT');

    const migratedNull = migrateMetaState(null);
    assert.equal(migratedNull.version, 2);
    assert.equal(migratedNull.selectedSkin, 'DEFAULT');

    const migratedPartial = migrateMetaState({ bankedDiscs: 45, selectedSkin: 'INVALID' });
    assert.equal(migratedPartial.bankedDiscs, 45);
    assert.equal(migratedPartial.selectedSkin, 'DEFAULT');
  });

  it('should bank discs cumulatively into meta state', () => {
    let state = getInitialMetaState();
    state = bankDiscs(state, 25);
    assert.equal(state.bankedDiscs, 25);
    assert.equal(state.stats.totalDiscsBanked, 25);

    state = bankDiscs(state, 15);
    assert.equal(state.bankedDiscs, 40);
    assert.equal(state.stats.totalDiscsBanked, 40);
  });

  it('should handle shop purchases for skins and check disc balance', () => {
    let state = getInitialMetaState();
    state = bankDiscs(state, 70);

    // Buy Shinobi (costs 60)
    const resultSuccess = buyShopSkin(state, 'SHINOBI');
    assert.equal(resultSuccess.success, true);
    assert.equal(resultSuccess.metaState.selectedSkin, 'SHINOBI');
    assert.equal(resultSuccess.metaState.bankedDiscs, 10);
    assert.ok(resultSuccess.metaState.unlockedSkins.includes('SHINOBI'));

    // Try buying Outrun (costs 120, only 10 left)
    const resultFail = buyShopSkin(resultSuccess.metaState, 'OUTRUN');
    assert.equal(resultFail.success, false);
    assert.equal(resultFail.metaState.bankedDiscs, 10);
    assert.equal(resultFail.metaState.selectedSkin, 'SHINOBI');
  });

  it('should handle shop purchases for trails', () => {
    let state = getInitialMetaState();
    state = bankDiscs(state, 60);

    const result = buyShopTrail(state, 'MATRIX');
    assert.equal(result.success, true);
    assert.equal(result.metaState.selectedTrail, 'MATRIX');
    assert.equal(result.metaState.bankedDiscs, 10);
  });

  it('should upgrade perks up to maxLevel and deduct escalating costs', () => {
    let state = getInitialMetaState();
    state = bankDiscs(state, 300);

    // Upgrade magnetDuration: costs are 40, 80, 150
    const upg1 = buyUpgrade(state, 'magnetDuration');
    assert.equal(upg1.success, true);
    assert.equal(upg1.metaState.upgrades.magnetDuration, 1);
    assert.equal(upg1.metaState.bankedDiscs, 260);

    const upg2 = buyUpgrade(upg1.metaState, 'magnetDuration');
    assert.equal(upg2.success, true);
    assert.equal(upg2.metaState.upgrades.magnetDuration, 2);
    assert.equal(upg2.metaState.bankedDiscs, 180);

    const upg3 = buyUpgrade(upg2.metaState, 'magnetDuration');
    assert.equal(upg3.success, true);
    assert.equal(upg3.metaState.upgrades.magnetDuration, 3);
    assert.equal(upg3.metaState.bankedDiscs, 30);

    // Level 3 is max
    const upg4 = buyUpgrade(upg3.metaState, 'magnetDuration');
    assert.equal(upg4.success, false);
    assert.equal(upg4.metaState.upgrades.magnetDuration, 3);
  });

  it('should check achievements and return newly unlocked milestones', () => {
    const state = getInitialMetaState();
    state.bankedDiscs = 120; // Satisfies DISC_COLLECTOR

    const runStats = {
      obstaclesCleared: 5,
      doubleJumps: 25,
      maxAirCombo: 3.0,
      gameTime: 95,
      score: 800,
      hitsTaken: 0,
      overdriveKills: 4,
      currentSpeed: GAME_CONFIG.MAX_SPEED,
    };

    const res = checkAchievements(state, runStats);
    assert.ok(res.newlyUnlocked.includes('FIRST_BLOOD'));
    assert.ok(res.newlyUnlocked.includes('DOUBLE_JUMP_ROOKIE'));
    assert.ok(res.newlyUnlocked.includes('AIR_ACROBAT'));
    assert.ok(res.newlyUnlocked.includes('NIGHT_RUNNER'));
    assert.ok(res.newlyUnlocked.includes('DISC_COLLECTOR'));
    assert.ok(res.newlyUnlocked.includes('UNTOUCHABLE'));
    assert.ok(res.newlyUnlocked.includes('OVERDRIVE_RAMPAGE'));
    assert.ok(res.newlyUnlocked.includes('SPEED_DEMON'));
    assert.equal(res.metaState.achievements.FIRST_BLOOD, true);

    // Running again with same stats should yield empty newlyUnlocked
    const res2 = checkAchievements(res.metaState, runStats);
    assert.equal(res2.newlyUnlocked.length, 0);
  });
});


import { stepParticle, PARTICLE_PHYSICS } from '../js/logic.js';

describe('Logic Module - Particle Physics', () => {
  const make = (type, extra = {}) => ({ type, x: 0, y: 0, vx: 100, vy: 0, size: 4, life: 1, maxLife: 1, ...extra });

  it('should move SPARK particles linearly and expire', () => {
    const p = make('SPARK', { life: 0.2 });
    assert.equal(stepParticle(p, 0.1), true);
    assert.equal(p.x, 10);
    assert.equal(stepParticle(p, 0.2), false);
  });

  it('should apply gravity to SHARD particles', () => {
    const p = make('SHARD');
    stepParticle(p, 0.1);
    assert.ok(p.vy > 0);
    assert.ok(PARTICLE_PHYSICS.SHARD.gravity > 0);
  });

  it('should slow down DUST particles through drag and never reverse direction', () => {
    const p = make('DUST');
    stepParticle(p, 0.1);
    assert.ok(p.vx < 100 && p.vx > 0);
    stepParticle(p, 5);
    assert.equal(p.life <= 0, true);
    const q = make('DUST', { life: 10 });
    stepParticle(q, 1);
    assert.ok(q.vx >= 0);
  });

  it('should grow RING particles and handle invalid input safely', () => {
    const p = make('RING');
    stepParticle(p, 0.1);
    assert.ok(p.size > 4);
    assert.equal(stepParticle(null, 0.1), false);
    assert.equal(stepParticle(make('SPARK'), 0), true);
  });
});
