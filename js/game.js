import { soundManager } from './sounds.js';
import Player from "./entities/Player.js";
import EliteEnemy from "./entities/EliteEnemy.js";
import Enemy, { spawnDeathParticles } from "./entities/Enemy.js";
import SquareEnemy from "./entities/SquareEnemy.js";
import ChargingEnemy from "./entities/ChargingEnemy.js";
import Projectile from "./entities/Projectile.js";
import Bomb from "./entities/Bomb.js";
import Melee from "./entities/Melee.js";
import Particle from "./entities/Particle.js";
import FloatingText from "./entities/FloatingText.js";
import ShieldPowerUp from "./entities/ShieldPowerUp.js";
import RapidFirePowerUp from "./entities/RapidFirePowerUp.js";
import SpeedBoostPowerUp from "./entities/SpeedBoostPowerUp.js";
import Star from "./entities/Star.js";
import { inputManager } from './InputManager.js';
import { isClearOfObstacles } from './spawnUtils.js';
import WorldBonus from './WorldBonus.js';
import Bonfire from './entities/Bonfire.js';


const canvas = typeof document !== 'undefined' ? document.getElementById('gameCanvas') : { getContext: () => null };
const ctx = canvas.getContext ? canvas.getContext('2d') : null;
const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null;
const message = typeof document !== 'undefined' ? document.getElementById('message') : null;
const newGameButton = typeof document !== 'undefined' ? document.getElementById('newGameButton') : null;
const pauseOverlay = document.getElementById('pauseOverlay');
const volumeSlider = typeof document !== 'undefined' ? document.getElementById('volumeSlider') : null;
const gamepadIndicator = typeof document !== 'undefined' ? document.getElementById('gamepadIndicator') : null;
const settingsScreen = typeof document !== 'undefined' ? document.getElementById('settingsScreen') : null;
let settingsInputs = null;

if (volumeSlider) {
    soundManager.setVolume(parseFloat(volumeSlider.value));
    volumeSlider.addEventListener('input', () => {
        soundManager.setVolume(parseFloat(volumeSlider.value));
    });
}

if (typeof window !== 'undefined') {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    if (settingsScreen) {
        settingsInputs = {
            axisX: document.getElementById('axisX'),
            axisY: document.getElementById('axisY'),
            shoot: document.getElementById('shootButton'),
            melee: document.getElementById('meleeButton'),
            bomb: document.getElementById('bombButton'),
            pause: document.getElementById('pauseButton'),
            settings: document.getElementById('settingsButton'),
            save: document.getElementById('saveSettings')
        };
        const cfg = inputManager.getConfig();
        settingsInputs.axisX.value = cfg.axisX;
        settingsInputs.axisY.value = cfg.axisY;
        settingsInputs.shoot.value = cfg.shoot;
        settingsInputs.melee.value = cfg.melee;
        settingsInputs.bomb.value = cfg.bomb;
        settingsInputs.pause.value = cfg.pause;
        settingsInputs.settings.value = cfg.settings;
        settingsInputs.save.addEventListener('click', () => {
            inputManager.setConfig({
                axisX: parseInt(settingsInputs.axisX.value, 10) || 0,
                axisY: parseInt(settingsInputs.axisY.value, 10) || 1,
                shoot: parseInt(settingsInputs.shoot.value, 10) || 0,
                melee: parseInt(settingsInputs.melee.value, 10) || 2,
                bomb: parseInt(settingsInputs.bomb.value, 10) || 1,
                pause: parseInt(settingsInputs.pause.value, 10) || 9,
                settings: parseInt(settingsInputs.settings.value, 10) || 8,
            });
            settingsScreen.style.display = 'none';
        });
    }

    if (newGameButton) {
        newGameButton.addEventListener('click', startNewGame);
    }
}

// Game variables
let lastTime = 0;
let deltaTime = 0;
let gameRunning = true;
let gamePaused = false;
let highScore = 0;

let prevPauseKey = false;
let prevSettingsKey = false;

let shakeDuration = 0;
let shakeIntensity = 0;
function triggerScreenShake(intensity = 5, duration = 200) {
    shakeIntensity = intensity;
    shakeDuration = duration;
}
if (typeof window !== "undefined") window.triggerScreenShake = triggerScreenShake;

function loadHighScore() {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('highScore');
        if (stored !== null) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && isFinite(parsed)) {
                return parsed;
            } else {
                // Remove invalid value
                localStorage.removeItem('highScore');
            }
        }
    }
    return 0;
}

function updateHighScore(score) {
    // Ensure both score and highScore are valid numbers
    if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) return;
    if (typeof highScore !== 'number' || isNaN(highScore) || !isFinite(highScore)) highScore = 0;
    if (score > highScore) {
        highScore = score;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('highScore', Math.floor(highScore));
        }
    }
}

// Player object
const player = new Player(canvas.width / 2, canvas.height / 2);
player.setMessageCallback(pushComboMessage);
// Arrays for game objects
let enemies = [];
let obstacles = [];
let scenery = [];
let projectiles = [];
let bombs = [];
let melees = [];
let particles = [];
let messages = [];
let enemyProjectiles = [];
let stars = [];
let powerUps = [];
let bonfires = [];
let nextEliteSpawn = performance.now() / 1000 + 60 + Math.random() * 120;
let gameStartTime = performance.now() / 1000;

// World bonus roulette system
const worldBonus = new WorldBonus();

// Wind bonus constants
const WIND_PUSH_RADIUS = 200;
const WIND_PUSH_FORCE = 3;

// Earth bonus constants
const EARTH_SHRAPNEL_RADIUS = 100;
const EARTH_SHRAPNEL_DAMAGE = 15;
const EARTH_RESPAWN_MIN_DIST = 400;

// Difficulty scaling configuration
const baseSpawnChance = 0.02;
const spawnChanceGrowth = 0.00004; // increase per second
const maxSpawnChance = 0.08;
const breatherInterval = 45; // seconds between breathers
const breatherDuration = 5;  // seconds each breather lasts



function pushComboMessage(combo, x, y) {
    messages.push(new FloatingText(x, y - 30, `x${combo}!`, 1));
}

// Initialize game
function init() {
    lastTime = performance.now();
    player.shotsFired = 0;
    player.shotsHit = 0;
    highScore = loadHighScore();
    player.score = 0;
    spawnObstacles();
    spawnScenery();
    update(performance.now()); // Pass current time to update
}

// Input is handled by the InputManager

// Game update loop
function update(time) {
    if (!gameRunning) return;
    requestAnimationFrame(update);

    deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    inputManager.pollGamepads();

    const pausePressed = inputManager.isPressed('p');
    if (pausePressed && !prevPauseKey) {
        gamePaused = !gamePaused;
        if (pauseOverlay) pauseOverlay.style.display = gamePaused ? 'flex' : 'none';
    }
    prevPauseKey = pausePressed;

    const settingsPressed = inputManager.isPressed('`');
    if (settingsPressed && !prevSettingsKey && settingsScreen) {
        settingsScreen.style.display = settingsScreen.style.display === 'block' ? 'none' : 'block';
    }
    prevSettingsKey = settingsPressed;

    if (gamePaused) return;

    // --- World Bonus state machine ---
    const bonusEvent = worldBonus.update(deltaTime);

    if (bonusEvent.event === 'bonusActivated') {
        activateWorldBonus(bonusEvent.bonus);
    }
    if (bonusEvent.event === 'bonusEnded') {
        deactivateWorldBonus(bonusEvent.bonus);
    }

    // If the roulette is spinning or revealing, pause gameplay but keep drawing
    if (worldBonus.isPausing) {
        // Still draw the frozen scene + overlay
        draw();
        updateHUD();
        return;
    }

    // Update game objects
    updatePlayer();
    updateEnemies();
    updateObstacles();
    updateScenery();
    updateProjectiles();
    updateMelees();
    updateBombs();
    updateEnemyProjectiles();
    updateParticles();
    updateStars();
    updatePowerUps();
    updateMessages();
    updateBonfires();

    // Apply active world bonus effects each frame
    if (worldBonus.isBonusActive) {
        applyWorldBonusEffects();
    }

    // Collision detection
    checkCollisions();

    // Draw everything
    draw();

    // Update HUD
    updateHUD();

    // Spawn enemies
    spawnEnemies();
    spawnStars();
    spawnPowerUps();

    // Increase score over time
    player.score += deltaTime;
}

function updatePlayer() {
    player.update(inputManager, deltaTime, canvas, projectiles, melees, bombs, soundManager);
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.update(canvas, enemyProjectiles, player, deltaTime)) {
            enemies.splice(i, 1);
            continue;
        }
        // Check if fire DOT killed this enemy
        if (enemy.hp <= 0) {
            let baseScore = 0;
            if (enemy.type === 'small' || enemy.type === 'square_small') baseScore = 10;
            else if (enemy.type === 'medium' || enemy.type === 'square_medium') baseScore = 30;
            else if (enemy.type === 'large' || enemy.type === 'square_large') baseScore = 50;
            else if (enemy.type === 'orbital') baseScore = 5;
            else if (enemy.type === 'elite') baseScore = 100;
            if (typeof player.addKillScore === 'function') {
                player.addKillScore(baseScore);
            } else {
                player.score += baseScore;
            }
            if (enemy instanceof SquareEnemy) {
                SquareEnemy.split(enemy, enemies);
            }
            if (soundManager) soundManager.play('enemyDeath');
            spawnDeathParticles(enemy, particles);
            enemies.splice(i, 1);
        }
    }
}

function updateObstacles() {
    // Obstacles are static in this implementation
}

function updateScenery() {
    scenery.forEach((obj) => {
        // Parallax movement in response to player motion
        obj.x -= player.vx * 0.2;
        obj.y -= player.vy * 0.2;

        // Slow personal drift
        obj.x += obj.vx;
        obj.y += obj.vy;

        // Oscillate size to make scenery feel alive
        obj.scalePhase += obj.scaleSpeed;
        obj.size = obj.baseSize + Math.sin(obj.scalePhase) * obj.scaleRange;

        // Wrap around screen edges
        if (obj.x < 0) obj.x += canvas.width;
        if (obj.x > canvas.width) obj.x -= canvas.width;
        if (obj.y < 0) obj.y += canvas.height;
        if (obj.y > canvas.height) obj.y -= canvas.height;
    });
}

function updateMelees() {
    for (let i = melees.length - 1; i >= 0; i--) {
        if (!melees[i].update(enemies, player, particles, soundManager)) {
            melees.splice(i, 1);
        }
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i].update(canvas, enemies, player, soundManager, particles)) {
            projectiles.splice(i, 1);
        }
    }
}

function updateBombs() {
    for (let i = bombs.length - 1; i >= 0; i--) {
        if (!bombs[i].update(enemies, player, particles, () => triggerScreenShake(8, 150), soundManager)) {
            bombs.splice(i, 1);
        }
    }
}

function updateEnemyProjectiles() {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        if (!p.update(canvas)) {
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Check collision with player (skip if hiding in obstacle)
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < p.size + player.size && !(player.earthBonusActive && player.hidingInObstacle)) {
            if ((!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) && player.shieldTimer <= 0) {
                player.hp -= p.damage;
                soundManager.play('playerHurt');
                triggerScreenShake(5, 200);
                player.invulnerableUntil = performance.now() + 120;
                if (player.hp <= 0) {
                    player.lives--;
                    if (player.lives > 0) {
                        respawnPlayer();
                    } else {
                        gameOver();
                    }
                }
            }
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Check collision with other enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const enemyDx = enemy.x - p.x;
            const enemyDy = enemy.y - p.y;
            const enemyDistance = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
            if (enemyDistance < p.size + enemy.size) {
                if (enemy.type === 'elite' && enemy.shield > 0) {
                    enemy.shield -= p.damage;
                    if (enemy.shield < 0) {
                        enemy.hp += enemy.shield;
                        enemy.shield = 0;
                    }
                } else {
                    enemy.hp -= p.damage;
                }
                if (enemy.hp <= 0) {
                    let baseScore = 0;
                    if (enemy.type === 'small' || enemy.type === 'square_small') baseScore = 10;
                    else if (enemy.type === 'medium' || enemy.type === 'square_medium') baseScore = 30;
                    else if (enemy.type === 'large' || enemy.type === 'square_large') baseScore = 50;
                    else if (enemy.type === 'orbital') baseScore = 5;
                    else if (enemy.type === 'elite') baseScore = 100;
                    if (typeof player.addKillScore === 'function') {
                        player.addKillScore(baseScore);
                    } else {
                        player.score += baseScore;
                    }
                    if (enemy instanceof SquareEnemy) {
                        SquareEnemy.split(enemy, enemies);
                    }
                    if (soundManager) soundManager.play('enemyDeath');
                    spawnDeathParticles(enemy, particles);
                    enemies.splice(j, 1);
                }
                enemyProjectiles.splice(i, 1);
                break;
            }
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        if (!particles[i].update(deltaTime)) {
            particles.splice(i, 1);
        }
    }
}

function updateStars() {
    for (let i = stars.length - 1; i >= 0; i--) {
        if (!stars[i].update(deltaTime, player)) {
            stars.splice(i, 1);
        }
    }
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        if (!powerUps[i].update(deltaTime, player)) {
            powerUps.splice(i, 1);
        }
    }
}

function updateMessages() {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!messages[i].update(deltaTime)) {
            messages.splice(i, 1);
        }
    }
}

function updateBonfires() {
    for (let i = bonfires.length - 1; i >= 0; i--) {
        bonfires[i].update(deltaTime, enemies, particles);
    }
}

/* ------------------------------------------------------------------ */
/*  World Bonus activation / deactivation / per-frame effects          */
/* ------------------------------------------------------------------ */

function activateWorldBonus(bonusId) {
    switch (bonusId) {
        case 'wind':
            player.windBonusActive = true;
            break;
        case 'earth':
            player.earthBonusActive = true;
            player.hidingInObstacle = null;
            break;
        case 'freeze':
            player.freezeBonusActive = true;
            // Apply freeze to all current enemies
            applyFreezeToEnemies();
            break;
        case 'fire':
            player.fireBonusActive = true;
            player.fireImmune = true;
            // Set passive DOT on all current enemies
            applyFireDOTToEnemies();
            // Spawn bonfires
            spawnBonfires();
            break;
        case 'boss':
            // Spawn a boss enemy
            const elite = createEliteEnemy(enemyScale());
            enemies.push(elite);
            elite.createOrbitals(enemies, enemyProjectiles);
            break;
    }
}

function deactivateWorldBonus(bonusId) {
    switch (bonusId) {
        case 'wind':
            player.windBonusActive = false;
            break;
        case 'earth':
            player.earthBonusActive = false;
            player.hidingInObstacle = null;
            break;
        case 'freeze':
            player.freezeBonusActive = false;
            // Restore all enemy speeds
            for (const enemy of enemies) {
                enemy.speedMultiplier = 1;
                enemy.frozen = false;
            }
            break;
        case 'fire':
            player.fireBonusActive = false;
            player.fireImmune = false;
            // Remove passive DOT from all enemies
            for (const enemy of enemies) {
                enemy.fireDOT = 0;
            }
            // Remove all bonfires
            bonfires = [];
            break;
    }
}

function applyWorldBonusEffects() {
    const bonus = worldBonus.activeBonus;

    if (bonus === 'wind') {
        applyWindPush();
    }
    // Earth effects are handled in checkCollisions
    // Freeze: ensure newly spawned enemies are also frozen
    if (bonus === 'freeze') {
        for (const enemy of enemies) {
            if (enemy.speedMultiplier === 1 && !enemy.frozen) {
                // Newly spawned enemy during freeze
                enemy.speedMultiplier = 0.1;
                if (Math.random() < 0.3) enemy.frozen = true;
            }
        }
    }
    // Fire: ensure newly spawned enemies get DOT
    if (bonus === 'fire') {
        for (const enemy of enemies) {
            if (enemy.fireDOT === 0) {
                enemy.fireDOT = 1.5; // 1.5 damage per second passive
            }
        }
    }
}

function applyWindPush() {
    for (const enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < WIND_PUSH_RADIUS && dist > 0) {
            const proximity = 1 - dist / WIND_PUSH_RADIUS;
            const pushX = (dx / dist) * WIND_PUSH_FORCE * proximity;
            const pushY = (dy / dist) * WIND_PUSH_FORCE * proximity;
            enemy.x += pushX;
            enemy.y += pushY;
        }
    }

    // Wind particles
    if (Math.random() < 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * WIND_PUSH_RADIUS * 0.9;
        const px = player.x + Math.cos(angle) * r;
        const py = player.y + Math.sin(angle) * r;
        const speed = 1 + Math.random() * 2;
        // Particles swirl outward
        particles.push(new Particle(
            px, py,
            Math.cos(angle + 0.5) * speed,
            Math.sin(angle + 0.5) * speed,
            1.5,
            0.5 + Math.random() * 0.3,
            'rgba(200, 230, 255, 0.6)'
        ));
    }
}

function applyFreezeToEnemies() {
    for (const enemy of enemies) {
        enemy.speedMultiplier = 0.1;
        if (Math.random() < 0.3) {
            enemy.frozen = true;
        }
    }
}

function applyFireDOTToEnemies() {
    for (const enemy of enemies) {
        enemy.fireDOT = 1.5; // 1.5 damage per second passive
    }
}

function spawnBonfires() {
    const count = 5 + Math.floor(Math.random() * 4); // 5-8
    for (let i = 0; i < count; i++) {
        let x, y;
        let attempts = 0;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
            attempts++;
        } while (
            attempts < 20 &&
            Math.hypot(x - player.x, y - player.y) < 150 // not too close to player
        );
        bonfires.push(new Bonfire(x, y, 80, 10));
    }
}

function earthExplodeObstacle(obstacle) {
    // Spawn shrapnel particles
    const count = 12 + Math.floor(Math.random() * 9); // 12-20
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        const colors = ['#8B4513', '#A0522D', '#D2691E', '#CD853F', '#6B3A2A'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(
            obstacle.x, obstacle.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            2 + Math.random() * 3,
            0.6 + Math.random() * 0.4,
            color
        ));
    }

    // Damage nearby enemies
    for (const enemy of enemies) {
        const dx = enemy.x - obstacle.x;
        const dy = enemy.y - obstacle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < EARTH_SHRAPNEL_RADIUS + enemy.size) {
            enemy.hp -= EARTH_SHRAPNEL_DAMAGE;
        }
    }

    // Screen shake (rumble)
    triggerScreenShake(10, 300);

    // Remove this obstacle
    const idx = obstacles.indexOf(obstacle);
    if (idx !== -1) obstacles.splice(idx, 1);

    // Spawn a new obstacle far from the player
    let newObs;
    let attempts = 0;
    do {
        newObs = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 20 + 10
        };
        attempts++;
    } while (
        attempts < 50 &&
        Math.hypot(newObs.x - player.x, newObs.y - player.y) < EARTH_RESPAWN_MIN_DIST
    );
    obstacles.push(newObs);
}

function checkCollisions() {
    const now = performance.now();

    // Player and enemies - bounce and damage on impact
    // Skip enemy collisions if player is hiding in an obstacle (Earth bonus)
    const isPlayerHiding = player.earthBonusActive && player.hidingInObstacle;
    for (let index = enemies.length - 1; index >= 0; index--) {
        if (isPlayerHiding) break; // invulnerable while hidden

        const enemy = enemies[index];
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemy.size + player.size) {
            // Calculate collision normal (from enemy to player)
            let normalX = dx / distance;
            let normalY = dy / distance;

            // Reflect player's velocity similar to obstacle bounce: v' = v - 2*(v · n)*n
            let dot = player.vx * normalX + player.vy * normalY;
            player.vx = player.vx - 2 * dot * normalX;
            player.vy = player.vy - 2 * dot * normalY;

            // Push player out of collision overlap
            let overlap = (enemy.size + player.size) - distance;
            player.x += normalX * overlap;
            player.y += normalY * overlap;

            // Apply damage only if the player is not invulnerable
            if ((!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) && player.shieldTimer <= 0) {
            // Both player and enemy receive damage equal to enemy.damage
            player.hp -= enemy.damage;
            enemy.hp -= enemy.damage;

            soundManager.play('playerHurt');
            triggerScreenShake(5, 200);

            // Set brief invulnerability (120ms)
            player.invulnerableUntil = performance.now() + 120;

            // Remove enemy if its health drops to 0 or below
            if (enemy.hp <= 0) {
                if (enemy instanceof SquareEnemy) {
                    SquareEnemy.split(enemy, enemies);
                }
                soundManager.play('enemyDeath');
                spawnDeathParticles(enemy, particles);
                enemies.splice(index, 1);
            }

            // Check player's health and respawn or end game if necessary
            if (player.hp <= 0) {
                player.lives--;
                if (player.lives > 0) {
                respawnPlayer();
                } else {
                gameOver();
                }
            }
            }
        }
    }

    // Player and obstacles - Bounce on collision (or hide during Earth bonus)
    if (player.earthBonusActive) {
        // Earth bonus: player can hide inside obstacles
        let insideAny = null;
        for (const obstacle of obstacles) {
            const dx = player.x - obstacle.x;
            const dy = player.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < obstacle.size) {
                insideAny = obstacle;
                break;
            }
        }

        if (insideAny && !player.hidingInObstacle) {
            // Just entered an obstacle – start hiding
            player.hidingInObstacle = insideAny;
        } else if (player.hidingInObstacle && insideAny !== player.hidingInObstacle) {
            // Exited the obstacle we were hiding in – explode it
            earthExplodeObstacle(player.hidingInObstacle);
            player.hidingInObstacle = insideAny || null; // might have entered another
        } else if (!insideAny && player.hidingInObstacle) {
            // Fully exited
            earthExplodeObstacle(player.hidingInObstacle);
            player.hidingInObstacle = null;
        }
    } else {
        // Normal obstacle collision
        obstacles.forEach((obstacle) => {
            let dx = player.x - obstacle.x;
            let dy = player.y - obstacle.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < obstacle.size + player.size) {
                let normalX = dx / distance;
                let normalY = dy / distance;

                let dot = player.vx * normalX + player.vy * normalY;
                player.vx = player.vx - 2 * dot * normalX;
                player.vy = player.vy - 2 * dot * normalY;

                let overlap = (obstacle.size + player.size) - distance;
                player.x += normalX * overlap;
                player.y += normalY * overlap;

                if ((!player.invulnerableUntil || now >= player.invulnerableUntil) && player.shieldTimer <= 0) {
                    player.hp -= 1;
                    soundManager.play('collision');
                    triggerScreenShake(5, 200);
                    player.invulnerableUntil = now + 120;

                    if (player.hp <= 0) {
                        player.lives--;
                        if (player.lives > 0) {
                            respawnPlayer();
                        } else {
                            gameOver();
                        }
                    }
                }
            }
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let offsetX = 0;
    let offsetY = 0;
    if (shakeDuration > 0) {
        offsetX = (Math.random() - 0.5) * shakeIntensity;
        offsetY = (Math.random() - 0.5) * shakeIntensity;
        shakeDuration -= deltaTime * 1000;
        if (shakeDuration < 0) shakeDuration = 0;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);

    drawEnvironment();
    drawObstacles();
    drawBonfireEntities();
    drawWindAura();
    drawPlayer();
    drawProjectiles();
    drawEnemyProjectiles();
    drawMelees();
    drawBombs();
    drawStars();
    drawPowerUps();
    drawParticles();
    drawEnemies();
    drawMessages();

    // Freeze blue hue overlay (drawn on top of everything in the game scene)
    if (player.freezeBonusActive) {
        ctx.fillStyle = 'rgba(0, 80, 200, 0.15)';
        ctx.fillRect(-offsetX, -offsetY, canvas.width, canvas.height);
    }

    ctx.restore();

    // Roulette overlay (drawn outside the shake transform)
    worldBonus.draw(ctx, canvas);
}

function drawEnvironment() {
    scenery.forEach((obj) => {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 77, 0, 0.3)';
        ctx.fillStyle = 'rgba(0, 153, 0, 0.3)';
        if (obj.type === 'tree') {
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y - obj.size);
            ctx.lineTo(obj.x - obj.size, obj.y + obj.size);
            ctx.lineTo(obj.x + obj.size, obj.y + obj.size);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    });

    // Background is solid but occasionally emit subtle particles
    if (Math.random() < 0.02) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 1;
        const vy = -0.5 - Math.random() * 0.5;
        const life = 2 + Math.random() * 2;
        particles.push(new Particle(x, y, 0, vy, size, life, 'rgba(255,255,255,0.5)'));
    }
}

function drawPlayer() {
    // If hiding in an obstacle during Earth bonus, draw player semi-transparent behind obstacle
    const isHiding = player.earthBonusActive && player.hidingInObstacle;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Fire immunity aura (drawn behind player, in unrotated space would be better but
    // a simple glow around origin works fine)
    if (player.fireImmune) {
        ctx.save();
        ctx.rotate(-player.angle); // undo rotation for circular glow
        const glowSize = player.size * 2.5 + Math.sin(performance.now() / 200) * 5;
        const grad = ctx.createRadialGradient(0, 0, player.size * 0.5, 0, 0, glowSize);
        grad.addColorStop(0, 'rgba(255, 120, 0, 0.25)');
        grad.addColorStop(0.6, 'rgba(255, 60, 0, 0.1)');
        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (player.speedBoostTimer > 0) {
        ctx.font = `${player.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', -player.size * 1.4, 0);
    }
    ctx.beginPath();
    // Draw an isosceles triangle rotated 90 degrees so the tip points right
    ctx.moveTo(player.size, 0); // Tip of the triangle (pointing right)
    ctx.lineTo(-player.size, -player.size * 0.75); // Top left
    ctx.lineTo(-player.size, player.size * 0.75); // Bottom left
    ctx.closePath();
    let alpha = 1;
    if (player.invulnerableUntil && performance.now() < player.invulnerableUntil) {
        alpha = 0.5 + 0.5 * Math.sin(performance.now() / 60);
    }
    if (isHiding) {
        alpha *= 0.35; // very faint when hiding in obstacle
    }
    ctx.fillStyle = player.rapidFireTimer > 0 ? 'yellow' : 'orange';
    ctx.globalAlpha = alpha;
    ctx.fill();
    if (player.rapidFireTimer > 0) {
        const flash = player.size * 0.4 * (1 + Math.sin(performance.now() / 50));
        ctx.beginPath();
        ctx.arc(player.size + flash * 0.5, 0, flash, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
    }
    if (player.shieldTimer > 0) {
        ctx.lineWidth = 3 + Math.sin(performance.now() / 100) * 1;
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawEnemies() {
    enemies.forEach((enemy) => {
        // Determine fill color based on freeze/fire state
        let baseFill = 'black';
        if (enemy.type === 'orbital') baseFill = 'gray';

        if (enemy.frozen) {
            baseFill = enemy.type === 'orbital' ? '#88aacc' : '#4477aa';
        }

        if (enemy.type === 'orbital') {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.fillStyle = baseFill;
            ctx.fill();
            // Frozen ice crystal overlay
            if (enemy.frozen) {
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } else if (enemy.type === 'elite') {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.fillStyle = enemy.frozen ? '#335588' : 'black';
            ctx.fill();
            if (enemy.shield > 0) {
                ctx.beginPath();
                ctx.lineWidth = 10 * (enemy.shield / enemy.shieldMax);
                ctx.strokeStyle = 'pink';
                ctx.arc(enemy.x, enemy.y, enemy.size + 5, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (enemy.frozen) {
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, enemy.size + 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            if (enemy.shape === 'square') {
                ctx.rect(enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2);
            } else if (enemy.shape === 'triangle') {
                ctx.moveTo(enemy.x, enemy.y - enemy.size);
                ctx.lineTo(enemy.x + enemy.size, enemy.y + enemy.size);
                ctx.lineTo(enemy.x - enemy.size, enemy.y + enemy.size);
                ctx.closePath();
            } else {
                ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            }
            ctx.fillStyle = baseFill;
            ctx.fill();
            if (enemy.frozen) {
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    });
}

function drawObstacles() {
    obstacles.forEach((obstacle) => {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'darkred';
        ctx.stroke();
    });
}

function drawProjectiles() {
    projectiles.forEach((projectile) => {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -projectile.size);
        ctx.lineTo(projectile.size, projectile.size);
        ctx.lineTo(-projectile.size, projectile.size);
        ctx.closePath();
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.restore();
    });
}

function drawMelees() {
    melees.forEach((melee) => {
        const progress = (performance.now() / 1000 - melee.startTime) / melee.duration;
        // Animate the arc radius (optional expansion effect)
        const currentRadius = melee.range * progress;
        ctx.save();
        ctx.translate(melee.x, melee.y);
        // Start and end angles for a 120° arc centered on melee.angle
        const startAngle = melee.angle - Math.PI / 3;
        const endAngle = melee.angle + Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, currentRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // semi-transparent yellow
        ctx.fill();
        ctx.restore();
    });
}

function drawBombs() {
    bombs.forEach((bomb) => {
        drawBomb(ctx, bomb);
    });
}

function drawEnemyProjectiles() {
    enemyProjectiles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'pink';
        ctx.fill();
    });
}

function drawStars() {
    stars.forEach(star => star.draw(ctx));
}

function drawPowerUps() {
    powerUps.forEach(p => p.draw(ctx));
}

function drawBomb(ctx, bomb) {
    ctx.save();
    ctx.globalAlpha = bomb.opacity;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    if (bomb.ringOpacity > 0) {
        ctx.globalAlpha = bomb.ringOpacity;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, bomb.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }
    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => p.draw(ctx));
}

function drawMessages() {
    messages.forEach(m => m.draw(ctx));
}

function drawBonfireEntities() {
    bonfires.forEach(b => b.draw(ctx));
}

function drawWindAura() {
    if (!player.windBonusActive) return;
    ctx.save();
    const grad = ctx.createRadialGradient(
        player.x, player.y, 0,
        player.x, player.y, WIND_PUSH_RADIUS
    );
    grad.addColorStop(0, 'rgba(200, 230, 255, 0.0)');
    grad.addColorStop(0.5, 'rgba(200, 230, 255, 0.08)');
    grad.addColorStop(0.85, 'rgba(180, 220, 255, 0.15)');
    grad.addColorStop(1, 'rgba(180, 220, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, WIND_PUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Animated swirl lines
    const now = performance.now() / 1000;
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
        const baseAngle = (i / 6) * Math.PI * 2 + now * 1.5;
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
            const r = WIND_PUSH_RADIUS * t;
            const a = baseAngle + t * 2;
            const x = player.x + Math.cos(a) * r;
            const y = player.y + Math.sin(a) * r;
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

function updateHUD() {
    // Guard against NaN values in HUD
    const safe = v => (typeof v === 'number' && isFinite(v) && !isNaN(v)) ? Math.floor(v) : 0;
    const healthPct = Math.max(0, Math.min(safe(player.hp), 100));
    const acornPct = Math.max(0, Math.min(safe(player.acorns), 100));
    const bombPct = Math.max(0, Math.min(safe(player.bombs * 20), 100)); // 5 bombs = 100%

    // World bonus status line
    let bonusLine = '';
    if (worldBonus.phase === 'countdown') {
        bonusLine = `<div class="hud-bonus-timer">Next Bonus: ${safe(worldBonus.countdownTimer)}s</div>`;
    } else if (worldBonus.phase === 'spinning' || worldBonus.phase === 'reveal') {
        bonusLine = `<div class="hud-bonus-timer hud-bonus-active">Roulette!</div>`;
    } else if (worldBonus.isBonusActive) {
        const bonusNames = { wind: '🌬️ Wind', earth: '🪨 Earth', freeze: '❄️ Freeze', fire: '🔥 Fire' };
        const label = bonusNames[worldBonus.activeBonus] || worldBonus.activeBonus;
        bonusLine = `<div class="hud-bonus-timer hud-bonus-active">${label}: ${safe(worldBonus.bonusTimer)}s</div>`;
    }

    hud.innerHTML = `
        <div>Lives: ${safe(player.lives)}</div>
        <div class="hud-row"><span class="hud-label">Health: ${safe(player.hp)}</span><div class="hud-bar"><div class="hud-fill" style="width:${healthPct}%"></div></div></div>
        <div class="hud-row"><span class="hud-label">Acorns: ${safe(player.acorns)}</span><div class="hud-bar"><div class="hud-fill" style="width:${acornPct}%"></div></div></div>
        <div class="hud-row"><span class="hud-label">Bombs: ${safe(player.bombs)}</span><div class="hud-bar"><div class="hud-fill" style="width:${bombPct}%"></div></div></div>
        <div>Score: ${safe(player.score)}</div>
        <div>Accuracy: ${player.shotsFired ? Math.floor((player.shotsHit / player.shotsFired) * 100) : 0}%</div>
        <div>Combo: x${safe(player.comboMultiplier)}</div>
        <div>High Score: ${safe(highScore)}</div>
        ${bonusLine}
    `;
}

function difficultyElapsed() {
    return performance.now() / 1000 - gameStartTime;
}

function currentSpawnChance() {
    const elapsed = difficultyElapsed();
    let chance = baseSpawnChance + elapsed * spawnChanceGrowth;
    if (chance > maxSpawnChance) chance = maxSpawnChance;
    const cyclePos = elapsed % breatherInterval;
    if (cyclePos < breatherDuration) {
        chance *= 0.3; // brief breather
    }
    return chance;
}

function enemyScale() {
    return 1 + difficultyElapsed() / 120;
}

function spawnEnemies() {
    const now = performance.now() / 1000;
    if (now >= nextEliteSpawn) {
        const elite = createEliteEnemy(enemyScale());
        enemies.push(elite);
        elite.createOrbitals(enemies, enemyProjectiles);
        nextEliteSpawn = now + 60 + Math.random() * 120;
    }
    if (Math.random() < currentSpawnChance()) {
        let rand = Math.random();
        let enemy;
        if (rand < 0.4) enemy = createEnemy('small', enemyScale());
        else if (rand < 0.65) enemy = createEnemy('medium', enemyScale());
        else if (rand < 0.8) enemy = createEnemy('large', enemyScale());
        else if (rand < 0.9) enemy = createSquareEnemy('large', enemyScale());
        else enemy = createChargingEnemy(enemyScale());

        enemies.push(enemy);
    }
}


function spawnStars() {
    if (Math.random() < 0.01) {
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            if (isClearOfObstacles(x, y, 8, 3)) {
                stars.push(new Star(x, y));
                break;
            }
        }
    }
}

function spawnPowerUps() {
    if (Math.random() < 0.003) {
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            if (isClearOfObstacles(x, y, 8, 3)) {
                const r = Math.random();
                if (r < 0.33) powerUps.push(new ShieldPowerUp(x, y));
                else if (r < 0.66) powerUps.push(new RapidFirePowerUp(x, y));
                else powerUps.push(new SpeedBoostPowerUp(x, y));
                break;
            }
        }
    }
}

function spawnObstacles() {
    // Randomly place obstacles
    for (let i = 0; i < 50; i++) {
        let obstacle;
        let attempts = 0;
        do {
            obstacle = {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 20 + 10
            };
            attempts++;
        } while (
            attempts < 20 &&
            Math.hypot(obstacle.x - canvas.width / 2, obstacle.y - canvas.height / 2) <
                obstacle.size + player.size + 5
        );
        obstacles.push(obstacle);
    }
}

function spawnScenery() {
    for (let i = 0; i < 25; i++) {
        const baseSize = Math.random() * 15 + 5;
        scenery.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.1, // slow drift
            vy: (Math.random() - 0.5) * 0.1,
            baseSize,
            size: baseSize,
            scaleRange: baseSize * 0.25,
            scaleSpeed: Math.random() * 0.02 + 0.01,
            scalePhase: Math.random() * Math.PI * 2,
            type: Math.random() < 0.6 ? 'tree' : 'rock'
        });
    }
}

function createEnemy(type, scale = 1) {
    let size, hp, speed, damage;
    switch (type) {
        case 'small':
            size = 10;
            hp = 4;
            speed = 2 + Math.random();
            damage = 3;
            break;
        case 'medium':
            size = 30;
            hp = 12;
            speed = 1 + Math.random();
            damage = 11;
            break;
        case 'large':
            size = 70;
            hp = 26;
            speed = 0.5 + Math.random();
            damage = 25;
            break;
    }

    // Scale stats based on current difficulty
    hp = Math.ceil(hp * scale);
    damage = Math.ceil(damage * scale);
    speed *= 1 + (scale - 1) * 0.5;

    // Random side to spawn from
    let side = Math.floor(Math.random() * 4);
    let x, y;

    switch (side) {
        case 0: // Top
            x = Math.random() * canvas.width;
            y = -size;
            break;
        case 1: // Right
            x = canvas.width + size;
            y = Math.random() * canvas.height;
            break;
        case 2: // Bottom
            x = Math.random() * canvas.width;
            y = canvas.height + size;
            break;
        case 3: // Left
            x = -size;
            y = Math.random() * canvas.height;
            break;
    }

    let angle = Math.atan2(player.y - y, player.x - x);
    return new Enemy(x, y, size, hp, speed, damage, type, Math.cos(angle) * speed, Math.sin(angle) * speed);
}

function createSquareEnemy(stage = 'large', scale = 1) {
    const tmp = { large: { size: 50, hp: 16, speed: 0.8, damage: 12 },
                    medium: { size: 30, hp: 8, speed: 1.2, damage: 6 },
                    small: { size: 18, hp: 3, speed: 1.8, damage: 3 } }[stage];
    let { size, hp, speed, damage } = tmp;
    hp = Math.ceil(hp * scale);
    damage = Math.ceil(damage * scale);
    speed *= 1 + (scale - 1) * 0.5;

    let side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -size; break;
        case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
        case 3: x = -size; y = Math.random() * canvas.height; break;
    }
    const angle = Math.atan2(player.y - y, player.x - x);
    return new SquareEnemy(x, y, stage, Math.cos(angle) * speed, Math.sin(angle) * speed);
}

function createChargingEnemy(scale = 1) {
    const size = 25;
    let hp = 10;
    let speed = 1 + Math.random();
    let damage = 8;

    hp = Math.ceil(hp * scale);
    damage = Math.ceil(damage * scale);
    speed *= 1 + (scale - 1) * 0.5;

    let side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -size; break;
        case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
        case 3: x = -size; y = Math.random() * canvas.height; break;
    }
    const angle = Math.atan2(player.y - y, player.x - x);
    return new ChargingEnemy(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
}

function createEliteEnemy(scale = 1) {
    let size = 84;
    let hp = 52;
    let speed = 0.5 + Math.random();
    let damage = 30;

    let side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -size; break;
        case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
        case 3: x = -size; y = Math.random() * canvas.height; break;
    }

    const angle = Math.atan2(player.y - y, player.x - x);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const elite = new EliteEnemy(x, y, vx, vy);

    elite.hp = Math.ceil(elite.hp * scale);
    elite.damage = Math.ceil(elite.damage * scale);
    elite.vx *= 1 + (scale - 1) * 0.5;
    elite.vy *= 1 + (scale - 1) * 0.5;
    elite.speed = Math.sqrt(elite.vx * elite.vx + elite.vy * elite.vy);
    return elite;
}

function respawnPlayer() {
    soundManager.play('lifeLost');
    player.hp = 100;
    player.acorns = 100;
    player.bombs = 5;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.comboMultiplier = 1;
    player.lastKillTime = 0;
    player.hidingInObstacle = null; // clear earth hiding on respawn
    if (message) message.innerText = 'You Died';
    gamePaused = true;
    setTimeout(() => {
        if (message) message.innerText = '';
        gamePaused = false;
    }, 3000);
}

function gameOver(p = player) {
    gameRunning = false;
    // Clean up any active world bonus
    if (worldBonus.activeBonus) {
        deactivateWorldBonus(worldBonus.activeBonus);
    }
    worldBonus.reset();
    bonfires = [];
    const accuracy = p.shotsFired ? p.shotsHit / p.shotsFired : 0;
    const bonus = Math.floor(accuracy * 100);
    p.score += bonus;
    const isNewHighScore = p.score > highScore;
    updateHighScore(p.score);
    if (message) {
        let msg = `Game Over <br/> Score: ${Math.floor(p.score)} <br/> Accuracy: ${(accuracy * 100).toFixed(0)}%`;
        if (isNewHighScore) msg += ' <br/> ✨ New High Score! ✨';
        message.innerHTML = msg;
    }
    if (newGameButton) newGameButton.style.display = 'block';
    soundManager.play('gameOver');
    p.comboMultiplier = 1;
    p.lastKillTime = 0;
}

function startNewGame() {
    enemies = [];
    obstacles = [];
    scenery = [];
    projectiles = [];
    bombs = [];
    melees = [];
    particles = [];
    messages = [];
    enemyProjectiles = [];
    stars = [];
    powerUps = [];
    bonfires = [];
    player.hp = 100;
    player.acorns = 100;
    player.bombs = 5;
    player.lives = 3;
    player.score = 0;
    player.vx = 0;
    player.vy = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.comboMultiplier = 1;
    player.lastKillTime = 0;
    player.shotsFired = 0;
    player.shotsHit = 0;
    player.shieldTimer = 0;
    player.rapidFireTimer = 0;
    player.speedBoostTimer = 0;
    // Reset world bonus player flags
    player.windBonusActive = false;
    player.earthBonusActive = false;
    player.hidingInObstacle = null;
    player.freezeBonusActive = false;
    player.fireBonusActive = false;
    player.fireImmune = false;
    // Reset world bonus state machine
    worldBonus.reset();
    gameRunning = true;
    gamePaused = false;
    nextEliteSpawn = performance.now() / 1000 + 60 + Math.random() * 120;
    gameStartTime = performance.now() / 1000;
    if (message) message.innerHTML = '';
    if (newGameButton) newGameButton.style.display = 'none';
    spawnObstacles();
    spawnScenery();
    update(performance.now());
}

// Splash screen implementation
function showSplashScreen() {
// Hide game elements
canvas.style.display = 'none';
hud.style.display = 'none';
message.style.display = 'none';

// Create splash screen div
const splashScreen = document.createElement('div');
splashScreen.id = 'splashScreen';
document.body.appendChild(splashScreen);

// Create h1 element for the title
const splashText = document.createElement('h1');
splashText.id = 'splashText';
splashText.innerText = 'Fox Munch by FRM';
splashScreen.appendChild(splashText);

// Style splash screen
splashScreen.style.position = 'absolute';
splashScreen.style.top = '0';
splashScreen.style.left = '0';
splashScreen.style.width = '100%';
splashScreen.style.height = '100%';
splashScreen.style.display = 'flex';
splashScreen.style.justifyContent = 'center';
splashScreen.style.alignItems = 'center';
splashScreen.style.backgroundColor = '#ff6600'; // #ff6600 is used specifically for the splash screen
splashScreen.style.zIndex = '1000'; // Ensure it is on top

// Style splash text
splashText.style.color = 'white';
splashText.style.fontFamily = 'Impact, sans-serif';
splashText.style.fontSize = '100px';
splashText.style.animation = 'fadeInOut 4s';

// Add keyframes for animation
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
    @keyframes fadeInOut {
        0% { opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
    }
`, styleSheet.cssRules.length);

// Start the game after 4 seconds
setTimeout(() => {
    splashScreen.remove();
    canvas.style.display = 'block';
    hud.style.display = 'block';
    message.style.display = 'block';
    init(); // Start the game
}, 4000);
}

if (typeof document !== 'undefined') {
    showSplashScreen();
}

export { gameOver };
