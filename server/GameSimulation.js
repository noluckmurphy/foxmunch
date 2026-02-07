/**
 * GameSimulation - Server-side game simulation.
 *
 * Extracts all game logic from the original game.js into a class that
 * can run headlessly on a Node.js server with multiple players.
 */

import Player from '../js/entities/Player.js';
import Enemy, { spawnDeathParticles } from '../js/entities/Enemy.js';
import EliteEnemy from '../js/entities/EliteEnemy.js';
import SquareEnemy from '../js/entities/SquareEnemy.js';
import ChargingEnemy from '../js/entities/ChargingEnemy.js';
import Projectile from '../js/entities/Projectile.js';
import EnemyProjectile from '../js/entities/EnemyProjectile.js';
import Bomb from '../js/entities/Bomb.js';
import Melee from '../js/entities/Melee.js';
import Particle from '../js/entities/Particle.js';
import FloatingText from '../js/entities/FloatingText.js';
import Star from '../js/entities/Star.js';
import ShieldPowerUp from '../js/entities/ShieldPowerUp.js';
import RapidFirePowerUp from '../js/entities/RapidFirePowerUp.js';
import SpeedBoostPowerUp from '../js/entities/SpeedBoostPowerUp.js';
import Bonfire from '../js/entities/Bonfire.js';
import WorldBonus from '../js/WorldBonus.js';
import { isClearOfObstacles } from '../js/spawnUtils.js';
import { normalizeAngle } from '../js/utils.js';
import { PLAYER_DEFAULTS, BOMB_DEFAULTS, PLAYER_COLORS, WORLD_WIDTH, WORLD_HEIGHT } from '../js/config.js';

export default class GameSimulation {
    constructor(worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT) {
        this.width = worldWidth;
        this.height = worldHeight;

        // Fake canvas object for entity methods that expect canvas.width/height
        this.bounds = { width: worldWidth, height: worldHeight };

        // Players map: id -> { player, input, colorIndex }
        this.players = new Map();
        this.nextColorIndex = 0;

        // Entity arrays
        this.enemies = [];
        this.obstacles = [];
        this.scenery = [];
        this.projectiles = [];
        this.bombs = [];
        this.melees = [];
        this.particles = [];
        this.messages = [];
        this.enemyProjectiles = [];
        this.stars = [];
        this.powerUps = [];
        this.bonfires = [];

        // World bonus
        this.worldBonus = new WorldBonus();

        // Difficulty scaling
        this.baseSpawnChance = 0.02;
        this.spawnChanceGrowth = 0.00004;
        this.maxSpawnChance = 0.08;
        this.breatherInterval = 45;
        this.breatherDuration = 5;

        // Game state
        this.gameRunning = true;
        this.gamePaused = false;
        this.gameStartTime = performance.now() / 1000;
        this.nextEliteSpawn = performance.now() / 1000 + 60 + Math.random() * 120;
        this.gameOverData = null;

        // Wind bonus constants
        this.WIND_PUSH_RADIUS = 200;
        this.WIND_PUSH_FORCE = 3;

        // Earth bonus constants
        this.EARTH_SHRAPNEL_RADIUS = 100;
        this.EARTH_SHRAPNEL_DAMAGE = 15;
        this.EARTH_RESPAWN_MIN_DIST = 400;

        // Initialize world
        this.spawnObstacles();
        this.spawnScenery();
    }

    // ----------------------------------------------------------------
    // Player management
    // ----------------------------------------------------------------

    addPlayer(id, name) {
        const colorIndex = this.nextColorIndex % PLAYER_COLORS.length;
        this.nextColorIndex++;
        const color = PLAYER_COLORS[colorIndex];

        const player = new Player(
            this.width / 2 + (Math.random() - 0.5) * 100,
            this.height / 2 + (Math.random() - 0.5) * 100,
            id, name, color
        );
        player.setMessageCallback((combo, x, y) => {
            this.messages.push(new FloatingText(x, y - 30, `x${combo}!`, 1));
        });

        this.players.set(id, {
            player,
            input: { up: false, down: false, left: false, right: false, shoot: false, melee: false, bomb: false },
            colorIndex
        });

        return { colorIndex, color };
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setPlayerInput(id, keys) {
        const entry = this.players.get(id);
        if (entry) {
            entry.input = keys;
        }
    }

    getAlivePlayers() {
        const alive = [];
        for (const [, entry] of this.players) {
            if (entry.player.alive && entry.player.lives > 0) {
                alive.push(entry.player);
            }
        }
        return alive;
    }

    getAllPlayers() {
        const all = [];
        for (const [, entry] of this.players) {
            all.push(entry.player);
        }
        return all;
    }

    // ----------------------------------------------------------------
    // Main tick
    // ----------------------------------------------------------------

    tick(deltaTime) {
        if (!this.gameRunning) return;
        if (this.gamePaused) return;

        // World Bonus state machine
        const bonusEvent = this.worldBonus.update(deltaTime);
        if (bonusEvent.event === 'bonusActivated') {
            this.activateWorldBonus(bonusEvent.bonus);
        }
        if (bonusEvent.event === 'bonusEnded') {
            this.deactivateWorldBonus(bonusEvent.bonus);
        }

        // If roulette is spinning or revealing, pause gameplay
        if (this.worldBonus.isPausing) return;

        // Update all entities
        this.updatePlayers(deltaTime);
        this.updateEnemies();
        this.updateProjectiles();
        this.updateMelees();
        this.updateBombs();
        this.updateEnemyProjectiles(deltaTime);
        this.updateParticles(deltaTime);
        this.updateStars(deltaTime);
        this.updatePowerUps(deltaTime);
        this.updateMessages(deltaTime);
        this.updateBonfires(deltaTime);
        this.updateScenery();

        // Apply active world bonus effects
        if (this.worldBonus.isBonusActive) {
            this.applyWorldBonusEffects();
        }

        // Collision detection
        this.checkCollisions();

        // Spawning
        this.spawnEnemies();
        this.spawnStars();
        this.spawnPowerUps();

        // Passive score for alive players
        for (const [, entry] of this.players) {
            if (entry.player.alive && entry.player.lives > 0) {
                entry.player.score += deltaTime;
            }
        }

        // Check game over
        if (this.isGameOver()) {
            this.endGame();
        }
    }

    // ----------------------------------------------------------------
    // Player update
    // ----------------------------------------------------------------

    updatePlayers(deltaTime) {
        for (const [, entry] of this.players) {
            const { player, input } = entry;
            if (!player.alive || player.lives <= 0) continue;

            this.updateSinglePlayer(player, input, deltaTime);
        }
    }

    updateSinglePlayer(player, input, deltaTime) {
        let dx = 0;
        let dy = 0;
        if (input.up) dy -= 1;
        if (input.down) dy += 1;
        if (input.left) dx -= 1;
        if (input.right) dx += 1;

        const speedMult = player.speedBoostTimer > 0 ? 1.5 : 1;
        if (dx !== 0 || dy !== 0) {
            const direction = Math.atan2(dy, dx);
            player.angle = direction;
            player.vx += Math.cos(direction) * player.acceleration * speedMult;
            player.vy += Math.sin(direction) * player.acceleration * speedMult;
            const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
            if (speed > player.maxSpeed * speedMult) {
                player.vx *= player.maxSpeed * speedMult / speed;
                player.vy *= player.maxSpeed * speedMult / speed;
            }
        } else {
            player.vx *= (1 - player.deceleration);
            player.vy *= (1 - player.deceleration);
        }

        player.x += player.vx;
        player.y += player.vy;

        // Wrap around screen edges
        if (player.x < 0) player.x = this.width;
        if (player.x > this.width) player.x = 0;
        if (player.y < 0) player.y = this.height;
        if (player.y > this.height) player.y = 0;

        // Actions
        if (input.shoot) {
            this.playerShoot(player);
        }
        if (input.melee) {
            this.playerMelee(player);
        }
        if (input.bomb) {
            this.playerBomb(player);
        }

        // Update timers
        if (player.projectileCooldown > 0) player.projectileCooldown -= deltaTime;
        if (player.meleeCooldown > 0) player.meleeCooldown -= deltaTime;
        if (player.bombCooldown > 0) player.bombCooldown -= deltaTime;
        if (player.shieldTimer > 0) player.shieldTimer -= deltaTime;
        if (player.rapidFireTimer > 0) player.rapidFireTimer -= deltaTime;
        if (player.speedBoostTimer > 0) player.speedBoostTimer -= deltaTime;
    }

    playerShoot(player) {
        if (player.projectileCooldown <= 0 && player.acorns > 0) {
            const isCritical = Math.random() < (1 / 15);
            const baseSpeed = 7;
            const projectileSpeed = isCritical ? baseSpeed * 2 : baseSpeed;
            const baseSize = 5;
            const projectileSize = isCritical ? baseSize * 2 : baseSize;
            const damage = isCritical ? 9 : 3;

            const projectile = new Projectile(
                player.x, player.y,
                Math.cos(player.angle) * projectileSpeed,
                Math.sin(player.angle) * projectileSpeed,
                projectileSize, damage, player.angle
            );
            projectile.ownerId = player.id;
            this.projectiles.push(projectile);

            const rate = player.rapidFireTimer > 0 ? 2 : 1;
            player.projectileCooldown = 0.05 / rate;
            player.acorns--;
            player.shotsFired++;
        }
    }

    playerMelee(player) {
        if (player.meleeCooldown <= 0) {
            const isCritical = Math.random() < player.getMeleeCritChance();
            const melee = new Melee(player.x, player.y, player.angle, 50, 0.05, isCritical);
            melee.ownerId = player.id;
            this.melees.push(melee);
            if (isCritical) player.meleeHitStreak = 0;
            player.meleeCooldown = 0.5;
        }
    }

    playerBomb(player) {
        if (player.bombCooldown <= 0 && player.bombs > 0) {
            const isCritical = Math.random() < (1 / 6);
            const bomb = new Bomb(
                player.x - Math.cos(player.angle) * player.size,
                player.y - Math.sin(player.angle) * player.size,
                isCritical
            );
            bomb.ownerId = player.id;
            this.bombs.push(bomb);
            player.bombCooldown = 3;
            player.bombs--;
        }
    }

    // ----------------------------------------------------------------
    // Entity updates
    // ----------------------------------------------------------------

    updateEnemies() {
        const alivePlayers = this.getAlivePlayers();
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            // Pass alive players array for ChargingEnemy targeting
            if (!enemy.update(this.bounds, this.enemyProjectiles, alivePlayers, 1 / 30)) {
                this.enemies.splice(i, 1);
                continue;
            }
            // Check if fire DOT killed this enemy
            if (enemy.hp <= 0) {
                const baseScore = this.getEnemyScore(enemy);
                // Award score to all alive players equally (team co-op)
                for (const p of alivePlayers) {
                    if (typeof p.addKillScore === 'function') {
                        p.addKillScore(baseScore);
                    }
                }
                if (enemy instanceof SquareEnemy) {
                    SquareEnemy.split(enemy, this.enemies);
                }
                spawnDeathParticles(enemy, this.particles);
                this.enemies.splice(i, 1);
            }
        }
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            // We handle collision manually here instead of using the Projectile's built-in update
            // because the original Projectile.update does collision inside itself
            const owner = this.getPlayerById(proj.ownerId);

            if (!proj.update(this.bounds, this.enemies, owner, null, this.particles)) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    updateMelees() {
        for (let i = this.melees.length - 1; i >= 0; i--) {
            const melee = this.melees[i];
            const owner = this.getPlayerById(melee.ownerId);
            if (!melee.update(this.enemies, owner, this.particles, null)) {
                this.melees.splice(i, 1);
            }
        }
    }

    updateBombs() {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            const owner = this.getPlayerById(bomb.ownerId);
            if (!bomb.update(this.enemies, owner, this.particles, null, null)) {
                this.bombs.splice(i, 1);
            }
        }
    }

    updateEnemyProjectiles(deltaTime) {
        const alivePlayers = this.getAlivePlayers();
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            if (!p.update(this.bounds)) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Check collision with all alive players
            let hit = false;
            for (const player of alivePlayers) {
                if (player.earthBonusActive && player.hidingInObstacle) continue;
                const dx = player.x - p.x;
                const dy = player.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < p.size + player.size) {
                    if ((!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) && player.shieldTimer <= 0) {
                        player.hp -= p.damage;
                        player.invulnerableUntil = performance.now() + 120;
                        if (player.hp <= 0) {
                            player.lives--;
                            if (player.lives > 0) {
                                this.respawnPlayer(player);
                            } else {
                                player.alive = false;
                            }
                        }
                    }
                    hit = true;
                    break;
                }
            }
            if (hit) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Check collision with enemies (friendly fire)
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                const edx = enemy.x - p.x;
                const edy = enemy.y - p.y;
                const eDist = Math.sqrt(edx * edx + edy * edy);
                if (eDist < p.size + enemy.size) {
                    if (enemy.type === 'elite' && enemy.shield > 0) {
                        enemy.shield -= p.damage;
                        if (enemy.shield < 0) { enemy.hp += enemy.shield; enemy.shield = 0; }
                    } else {
                        enemy.hp -= p.damage;
                    }
                    if (enemy.hp <= 0) {
                        const baseScore = this.getEnemyScore(enemy);
                        for (const pl of alivePlayers) {
                            if (typeof pl.addKillScore === 'function') pl.addKillScore(baseScore);
                        }
                        if (enemy instanceof SquareEnemy) SquareEnemy.split(enemy, this.enemies);
                        spawnDeathParticles(enemy, this.particles);
                        this.enemies.splice(j, 1);
                    }
                    this.enemyProjectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (!this.particles[i].update(deltaTime)) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateStars(deltaTime) {
        const alivePlayers = this.getAlivePlayers();
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            star.life -= deltaTime;
            // Check collision with all alive players
            for (const player of alivePlayers) {
                const dx = player.x - star.x;
                const dy = player.y - star.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < star.size + player.size) {
                    player.acorns = Math.min(player.acorns + 10, 100);
                    star.life = 0;
                    break;
                }
            }
            if (star.life <= 0) {
                this.stars.splice(i, 1);
            }
        }
    }

    updatePowerUps(deltaTime) {
        const alivePlayers = this.getAlivePlayers();
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.life -= deltaTime;
            // Check collision with all alive players
            for (const player of alivePlayers) {
                const dx = player.x - pu.x;
                const dy = player.y - pu.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < pu.size + player.size) {
                    if (pu instanceof ShieldPowerUp) {
                        player.shieldTimer = 5;
                    } else if (pu instanceof RapidFirePowerUp) {
                        player.rapidFireTimer = 5;
                    } else if (pu instanceof SpeedBoostPowerUp) {
                        player.speedBoostTimer = 5;
                    }
                    pu.life = 0;
                    break;
                }
            }
            if (pu.life <= 0) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    updateMessages(deltaTime) {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (!this.messages[i].update(deltaTime)) {
                this.messages.splice(i, 1);
            }
        }
    }

    updateBonfires(deltaTime) {
        for (let i = this.bonfires.length - 1; i >= 0; i--) {
            this.bonfires[i].update(deltaTime, this.enemies, this.particles);
        }
    }

    updateScenery() {
        // Average velocity of all alive players for parallax
        const alivePlayers = this.getAlivePlayers();
        let avgVx = 0, avgVy = 0;
        if (alivePlayers.length > 0) {
            for (const p of alivePlayers) { avgVx += p.vx; avgVy += p.vy; }
            avgVx /= alivePlayers.length;
            avgVy /= alivePlayers.length;
        }

        for (const obj of this.scenery) {
            obj.x -= avgVx * 0.2;
            obj.y -= avgVy * 0.2;
            obj.x += obj.vx;
            obj.y += obj.vy;
            obj.scalePhase += obj.scaleSpeed;
            obj.size = obj.baseSize + Math.sin(obj.scalePhase) * obj.scaleRange;
            if (obj.x < 0) obj.x += this.width;
            if (obj.x > this.width) obj.x -= this.width;
            if (obj.y < 0) obj.y += this.height;
            if (obj.y > this.height) obj.y -= this.height;
        }
    }

    // ----------------------------------------------------------------
    // Collision detection
    // ----------------------------------------------------------------

    checkCollisions() {
        const now = performance.now();
        const alivePlayers = this.getAlivePlayers();

        for (const player of alivePlayers) {
            // Player-enemy collisions
            const isPlayerHiding = player.earthBonusActive && player.hidingInObstacle;
            for (let index = this.enemies.length - 1; index >= 0; index--) {
                if (isPlayerHiding) break;
                const enemy = this.enemies[index];
                let dx = player.x - enemy.x;
                let dy = player.y - enemy.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < enemy.size + player.size) {
                    let normalX = dx / distance;
                    let normalY = dy / distance;
                    let dot = player.vx * normalX + player.vy * normalY;
                    player.vx = player.vx - 2 * dot * normalX;
                    player.vy = player.vy - 2 * dot * normalY;
                    let overlap = (enemy.size + player.size) - distance;
                    player.x += normalX * overlap;
                    player.y += normalY * overlap;

                    if ((!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) && player.shieldTimer <= 0) {
                        player.hp -= enemy.damage;
                        enemy.hp -= enemy.damage;
                        player.invulnerableUntil = performance.now() + 120;

                        if (enemy.hp <= 0) {
                            if (enemy instanceof SquareEnemy) SquareEnemy.split(enemy, this.enemies);
                            spawnDeathParticles(enemy, this.particles);
                            this.enemies.splice(index, 1);
                        }
                        if (player.hp <= 0) {
                            player.lives--;
                            if (player.lives > 0) {
                                this.respawnPlayer(player);
                            } else {
                                player.alive = false;
                            }
                        }
                    }
                }
            }

            // Player-obstacle collisions
            if (player.earthBonusActive) {
                let insideAny = null;
                for (const obstacle of this.obstacles) {
                    const dx = player.x - obstacle.x;
                    const dy = player.y - obstacle.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < obstacle.size) {
                        insideAny = obstacle;
                        break;
                    }
                }
                if (insideAny && !player.hidingInObstacle) {
                    player.hidingInObstacle = insideAny;
                } else if (player.hidingInObstacle && insideAny !== player.hidingInObstacle) {
                    this.earthExplodeObstacle(player.hidingInObstacle, player);
                    player.hidingInObstacle = insideAny || null;
                } else if (!insideAny && player.hidingInObstacle) {
                    this.earthExplodeObstacle(player.hidingInObstacle, player);
                    player.hidingInObstacle = null;
                }
            } else {
                for (const obstacle of this.obstacles) {
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
                            player.invulnerableUntil = now + 120;
                            if (player.hp <= 0) {
                                player.lives--;
                                if (player.lives > 0) {
                                    this.respawnPlayer(player);
                                } else {
                                    player.alive = false;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ----------------------------------------------------------------
    // World Bonus
    // ----------------------------------------------------------------

    activateWorldBonus(bonusId) {
        const alivePlayers = this.getAlivePlayers();
        switch (bonusId) {
            case 'wind':
                for (const p of alivePlayers) p.windBonusActive = true;
                break;
            case 'earth':
                for (const p of alivePlayers) { p.earthBonusActive = true; p.hidingInObstacle = null; }
                break;
            case 'freeze':
                for (const p of alivePlayers) p.freezeBonusActive = true;
                this.applyFreezeToEnemies();
                break;
            case 'fire':
                for (const p of alivePlayers) { p.fireBonusActive = true; p.fireImmune = true; }
                this.applyFireDOTToEnemies();
                this.spawnBonfires();
                break;
            case 'boss': {
                const elite = this.createEliteEnemy(this.enemyScale());
                this.enemies.push(elite);
                elite.createOrbitals(this.enemies, this.enemyProjectiles);
                break;
            }
        }
    }

    deactivateWorldBonus(bonusId) {
        const allPlayers = this.getAllPlayers();
        switch (bonusId) {
            case 'wind':
                for (const p of allPlayers) p.windBonusActive = false;
                break;
            case 'earth':
                for (const p of allPlayers) { p.earthBonusActive = false; p.hidingInObstacle = null; }
                break;
            case 'freeze':
                for (const p of allPlayers) p.freezeBonusActive = false;
                for (const enemy of this.enemies) { enemy.speedMultiplier = 1; enemy.frozen = false; }
                break;
            case 'fire':
                for (const p of allPlayers) { p.fireBonusActive = false; p.fireImmune = false; }
                for (const enemy of this.enemies) enemy.fireDOT = 0;
                this.bonfires = [];
                break;
        }
    }

    applyWorldBonusEffects() {
        const bonus = this.worldBonus.activeBonus;
        if (bonus === 'wind') this.applyWindPush();
        if (bonus === 'freeze') {
            for (const enemy of this.enemies) {
                if (enemy.speedMultiplier === 1 && !enemy.frozen) {
                    enemy.speedMultiplier = 0.1;
                    if (Math.random() < 0.3) enemy.frozen = true;
                }
            }
        }
        if (bonus === 'fire') {
            for (const enemy of this.enemies) {
                if (enemy.fireDOT === 0) enemy.fireDOT = 1.5;
            }
        }
    }

    applyWindPush() {
        const alivePlayers = this.getAlivePlayers();
        for (const enemy of this.enemies) {
            // Push away from nearest player
            let nearestDist = Infinity;
            let nearestPlayer = null;
            for (const p of alivePlayers) {
                const dist = Math.sqrt((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2);
                if (dist < nearestDist) { nearestDist = dist; nearestPlayer = p; }
            }
            if (nearestPlayer && nearestDist < this.WIND_PUSH_RADIUS && nearestDist > 0) {
                const dx = enemy.x - nearestPlayer.x;
                const dy = enemy.y - nearestPlayer.y;
                const proximity = 1 - nearestDist / this.WIND_PUSH_RADIUS;
                enemy.x += (dx / nearestDist) * this.WIND_PUSH_FORCE * proximity;
                enemy.y += (dy / nearestDist) * this.WIND_PUSH_FORCE * proximity;
            }
        }

        // Wind particles around each alive player
        for (const player of alivePlayers) {
            if (Math.random() < 0.5) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * this.WIND_PUSH_RADIUS * 0.9;
                const px = player.x + Math.cos(angle) * r;
                const py = player.y + Math.sin(angle) * r;
                const speed = 1 + Math.random() * 2;
                this.particles.push(new Particle(
                    px, py,
                    Math.cos(angle + 0.5) * speed,
                    Math.sin(angle + 0.5) * speed,
                    1.5, 0.5 + Math.random() * 0.3,
                    'rgba(200, 230, 255, 0.6)'
                ));
            }
        }
    }

    applyFreezeToEnemies() {
        for (const enemy of this.enemies) {
            enemy.speedMultiplier = 0.1;
            if (Math.random() < 0.3) enemy.frozen = true;
        }
    }

    applyFireDOTToEnemies() {
        for (const enemy of this.enemies) {
            enemy.fireDOT = 1.5;
        }
    }

    spawnBonfires() {
        const count = 5 + Math.floor(Math.random() * 4);
        const alivePlayers = this.getAlivePlayers();
        for (let i = 0; i < count; i++) {
            let x, y, attempts = 0;
            do {
                x = Math.random() * this.width;
                y = Math.random() * this.height;
                attempts++;
            } while (
                attempts < 20 &&
                alivePlayers.some(p => Math.hypot(x - p.x, y - p.y) < 150)
            );
            this.bonfires.push(new Bonfire(x, y, 80, 10));
        }
    }

    earthExplodeObstacle(obstacle, player) {
        const count = 12 + Math.floor(Math.random() * 9);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const colors = ['#8B4513', '#A0522D', '#D2691E', '#CD853F', '#6B3A2A'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(
                obstacle.x, obstacle.y,
                Math.cos(angle) * speed, Math.sin(angle) * speed,
                2 + Math.random() * 3, 0.6 + Math.random() * 0.4, color
            ));
        }
        for (const enemy of this.enemies) {
            const dx = enemy.x - obstacle.x;
            const dy = enemy.y - obstacle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.EARTH_SHRAPNEL_RADIUS + enemy.size) {
                enemy.hp -= this.EARTH_SHRAPNEL_DAMAGE;
            }
        }
        const idx = this.obstacles.indexOf(obstacle);
        if (idx !== -1) this.obstacles.splice(idx, 1);

        let newObs, attempts = 0;
        do {
            newObs = { x: Math.random() * this.width, y: Math.random() * this.height, size: Math.random() * 20 + 10 };
            attempts++;
        } while (attempts < 50 && Math.hypot(newObs.x - player.x, newObs.y - player.y) < this.EARTH_RESPAWN_MIN_DIST);
        this.obstacles.push(newObs);
    }

    // ----------------------------------------------------------------
    // Respawn / Game over
    // ----------------------------------------------------------------

    respawnPlayer(player) {
        player.hp = 100;
        player.acorns = 100;
        player.bombs = 5;
        player.x = this.width / 2 + (Math.random() - 0.5) * 100;
        player.y = this.height / 2 + (Math.random() - 0.5) * 100;
        player.vx = 0;
        player.vy = 0;
        player.comboMultiplier = 1;
        player.lastKillTime = 0;
        player.hidingInObstacle = null;
        player.invulnerableUntil = performance.now() + 3000; // 3 sec invulnerability on respawn
    }

    isGameOver() {
        if (this.players.size === 0) return false;
        for (const [, entry] of this.players) {
            if (entry.player.alive && entry.player.lives > 0) return false;
        }
        return true;
    }

    endGame() {
        this.gameRunning = false;
        if (this.worldBonus.activeBonus) {
            this.deactivateWorldBonus(this.worldBonus.activeBonus);
        }
        this.worldBonus.reset();
        this.bonfires = [];

        const playerScores = [];
        let teamScore = 0;
        for (const [id, entry] of this.players) {
            const p = entry.player;
            const accuracy = p.shotsFired ? p.shotsHit / p.shotsFired : 0;
            const bonus = Math.floor(accuracy * 100);
            p.score += bonus;
            teamScore += p.score;
            playerScores.push({
                id, name: p.name, color: p.color,
                score: Math.floor(p.score),
                accuracy: Math.floor(accuracy * 100)
            });
        }

        this.gameOverData = { playerScores, teamScore: Math.floor(teamScore) };
    }

    // ----------------------------------------------------------------
    // Spawning
    // ----------------------------------------------------------------

    difficultyElapsed() {
        return performance.now() / 1000 - this.gameStartTime;
    }

    currentSpawnChance() {
        const elapsed = this.difficultyElapsed();
        let chance = this.baseSpawnChance + elapsed * this.spawnChanceGrowth;
        if (chance > this.maxSpawnChance) chance = this.maxSpawnChance;
        const cyclePos = elapsed % this.breatherInterval;
        if (cyclePos < this.breatherDuration) chance *= 0.3;
        return chance;
    }

    enemyScale() {
        return 1 + this.difficultyElapsed() / 120;
    }

    spawnEnemies() {
        const now = performance.now() / 1000;
        if (now >= this.nextEliteSpawn) {
            const elite = this.createEliteEnemy(this.enemyScale());
            this.enemies.push(elite);
            elite.createOrbitals(this.enemies, this.enemyProjectiles);
            this.nextEliteSpawn = now + 60 + Math.random() * 120;
        }
        if (Math.random() < this.currentSpawnChance()) {
            let rand = Math.random();
            let enemy;
            if (rand < 0.4) enemy = this.createEnemy('small', this.enemyScale());
            else if (rand < 0.65) enemy = this.createEnemy('medium', this.enemyScale());
            else if (rand < 0.8) enemy = this.createEnemy('large', this.enemyScale());
            else if (rand < 0.9) enemy = this.createSquareEnemy('large', this.enemyScale());
            else enemy = this.createChargingEnemy(this.enemyScale());
            this.enemies.push(enemy);
        }
    }

    spawnStars() {
        if (Math.random() < 0.01) {
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * this.width;
                const y = Math.random() * this.height;
                if (isClearOfObstacles(x, y, 8, 3, this.obstacles)) {
                    this.stars.push(new Star(x, y));
                    break;
                }
            }
        }
    }

    spawnPowerUps() {
        if (Math.random() < 0.003) {
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * this.width;
                const y = Math.random() * this.height;
                if (isClearOfObstacles(x, y, 8, 3, this.obstacles)) {
                    const r = Math.random();
                    if (r < 0.33) this.powerUps.push(new ShieldPowerUp(x, y));
                    else if (r < 0.66) this.powerUps.push(new RapidFirePowerUp(x, y));
                    else this.powerUps.push(new SpeedBoostPowerUp(x, y));
                    break;
                }
            }
        }
    }

    spawnObstacles() {
        for (let i = 0; i < 50; i++) {
            let obstacle, attempts = 0;
            do {
                obstacle = {
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 20 + 10
                };
                attempts++;
            } while (
                attempts < 20 &&
                Math.hypot(obstacle.x - this.width / 2, obstacle.y - this.height / 2) < obstacle.size + 25
            );
            this.obstacles.push(obstacle);
        }
    }

    spawnScenery() {
        for (let i = 0; i < 25; i++) {
            const baseSize = Math.random() * 15 + 5;
            this.scenery.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.1,
                vy: (Math.random() - 0.5) * 0.1,
                baseSize, size: baseSize,
                scaleRange: baseSize * 0.25,
                scaleSpeed: Math.random() * 0.02 + 0.01,
                scalePhase: Math.random() * Math.PI * 2,
                type: Math.random() < 0.6 ? 'tree' : 'rock'
            });
        }
    }

    // ----------------------------------------------------------------
    // Enemy creation helpers
    // ----------------------------------------------------------------

    getRandomSpawnPoint(size) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch (side) {
            case 0: x = Math.random() * this.width; y = -size; break;
            case 1: x = this.width + size; y = Math.random() * this.height; break;
            case 2: x = Math.random() * this.width; y = this.height + size; break;
            case 3: x = -size; y = Math.random() * this.height; break;
        }
        return { x, y };
    }

    getAngleTowardPlayers(x, y) {
        const alivePlayers = this.getAlivePlayers();
        if (alivePlayers.length === 0) return Math.random() * Math.PI * 2;
        // Target a random alive player
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        return Math.atan2(target.y - y, target.x - x);
    }

    createEnemy(type, scale = 1) {
        let size, hp, speed, damage;
        switch (type) {
            case 'small': size = 10; hp = 4; speed = 2 + Math.random(); damage = 3; break;
            case 'medium': size = 30; hp = 12; speed = 1 + Math.random(); damage = 11; break;
            case 'large': size = 70; hp = 26; speed = 0.5 + Math.random(); damage = 25; break;
        }
        hp = Math.ceil(hp * scale);
        damage = Math.ceil(damage * scale);
        speed *= 1 + (scale - 1) * 0.5;

        const { x, y } = this.getRandomSpawnPoint(size);
        const angle = this.getAngleTowardPlayers(x, y);
        return new Enemy(x, y, size, hp, speed, damage, type, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    createSquareEnemy(stage = 'large', scale = 1) {
        const stats = { large: { size: 50, speed: 0.8 }, medium: { size: 30, speed: 1.2 }, small: { size: 18, speed: 1.8 } }[stage];
        let speed = stats.speed;
        speed *= 1 + (scale - 1) * 0.5;

        const { x, y } = this.getRandomSpawnPoint(stats.size);
        const angle = this.getAngleTowardPlayers(x, y);
        return new SquareEnemy(x, y, stage, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    createChargingEnemy(scale = 1) {
        let speed = 1 + Math.random();
        speed *= 1 + (scale - 1) * 0.5;

        const { x, y } = this.getRandomSpawnPoint(25);
        const angle = this.getAngleTowardPlayers(x, y);
        return new ChargingEnemy(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    createEliteEnemy(scale = 1) {
        let speed = 0.5 + Math.random();
        const { x, y } = this.getRandomSpawnPoint(84);
        const angle = this.getAngleTowardPlayers(x, y);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const elite = new EliteEnemy(x, y, vx, vy);
        elite.hp = Math.ceil(elite.hp * scale);
        elite.damage = Math.ceil(elite.damage * scale);
        elite.vx *= 1 + (scale - 1) * 0.5;
        elite.vy *= 1 + (scale - 1) * 0.5;
        elite.speed = Math.sqrt(elite.vx * elite.vx + elite.vy * elite.vy);
        return elite;
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    getPlayerById(id) {
        const entry = this.players.get(id);
        return entry ? entry.player : null;
    }

    getEnemyScore(enemy) {
        if (enemy.type === 'small' || enemy.type === 'square_small') return 10;
        if (enemy.type === 'medium' || enemy.type === 'square_medium') return 30;
        if (enemy.type === 'large' || enemy.type === 'square_large') return 50;
        if (enemy.type === 'orbital') return 5;
        if (enemy.type === 'elite') return 100;
        return 0;
    }

    // ----------------------------------------------------------------
    // Serialization
    // ----------------------------------------------------------------

    serialize() {
        const players = [];
        let teamScore = 0;
        for (const [id, entry] of this.players) {
            const p = entry.player;
            teamScore += p.score;
            players.push({
                id, name: p.name, color: p.color,
                x: p.x, y: p.y, angle: p.angle, size: p.size,
                vx: p.vx, vy: p.vy,
                hp: p.hp, lives: p.lives, acorns: p.acorns, bombs: p.bombs,
                score: Math.floor(p.score), comboMultiplier: p.comboMultiplier,
                alive: p.alive,
                shieldTimer: p.shieldTimer, rapidFireTimer: p.rapidFireTimer,
                speedBoostTimer: p.speedBoostTimer,
                windBonusActive: p.windBonusActive, earthBonusActive: p.earthBonusActive,
                freezeBonusActive: p.freezeBonusActive, fireBonusActive: p.fireBonusActive,
                fireImmune: p.fireImmune,
                hidingInObstacle: p.hidingInObstacle ? true : false,
                invulnerable: p.invulnerableUntil ? performance.now() < p.invulnerableUntil : false,
                shotsFired: p.shotsFired, shotsHit: p.shotsHit,
                meleeHitStreak: p.meleeHitStreak
            });
        }

        return {
            players,
            teamScore: Math.floor(teamScore),
            enemies: this.enemies.map(e => ({
                type: e.type, x: e.x, y: e.y, size: e.size,
                hp: e.hp, shape: e.shape,
                frozen: e.frozen, fireDOT: e.fireDOT,
                shield: e.shield || 0, shieldMax: e.shieldMax || 0,
                vx: e.vx, vy: e.vy
            })),
            projectiles: this.projectiles.map(p => ({
                x: p.x, y: p.y, size: p.size, angle: p.angle, ownerId: p.ownerId
            })),
            enemyProjectiles: this.enemyProjectiles.map(p => ({
                x: p.x, y: p.y, size: p.size
            })),
            bombs: this.bombs.map(b => ({
                x: b.x, y: b.y, currentRadius: b.currentRadius,
                opacity: b.opacity, ringRadius: b.ringRadius, ringOpacity: b.ringOpacity,
                ownerId: b.ownerId
            })),
            melees: this.melees.map(m => {
                const progress = (performance.now() / 1000 - m.startTime) / m.duration;
                return {
                    x: m.x, y: m.y, angle: m.angle, range: m.range,
                    progress: Math.min(Math.max(progress, 0), 1),
                    isCritical: m.isCritical, ownerId: m.ownerId
                };
            }),
            particles: this.particles.map(p => ({
                x: p.x, y: p.y, size: p.size, color: p.color, life: p.life
            })),
            stars: this.stars.map(s => ({ x: s.x, y: s.y, size: s.size })),
            powerUps: this.powerUps.map(p => ({
                x: p.x, y: p.y, size: p.size,
                type: p instanceof ShieldPowerUp ? 'shield'
                    : p instanceof RapidFirePowerUp ? 'rapidFire'
                    : 'speedBoost'
            })),
            bonfires: this.bonfires.map(b => ({
                x: b.x, y: b.y, radius: b.radius, size: b.size, time: b.time
            })),
            obstacles: this.obstacles.map(o => ({ x: o.x, y: o.y, size: o.size })),
            scenery: this.scenery.map(s => ({
                x: s.x, y: s.y, size: s.size, type: s.type
            })),
            messages: this.messages.map(m => ({
                x: m.x, y: m.y, text: m.text, life: m.life, duration: m.duration
            })),
            worldBonus: {
                phase: this.worldBonus.phase,
                countdownTimer: this.worldBonus.countdownTimer,
                activeBonus: this.worldBonus.activeBonus,
                bonusTimer: this.worldBonus.bonusTimer,
                spinElapsed: this.worldBonus.spinElapsed,
                spinTotalRotation: this.worldBonus.spinTotalRotation,
                spinCurrentAngle: this.worldBonus.spinCurrentAngle,
                selectedIndex: this.worldBonus.selectedIndex,
                revealElapsed: this.worldBonus.revealElapsed
            },
            worldWidth: this.width,
            worldHeight: this.height,
            gameRunning: this.gameRunning,
            gamePaused: this.gamePaused,
            gameOverData: this.gameOverData
        };
    }
}
