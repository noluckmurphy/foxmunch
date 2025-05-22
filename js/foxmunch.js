import { soundManager } from './sounds.js';
import { normalizeAngle } from './utils.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const message = document.getElementById('message');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Game variables
let keys = {};
let lastTime = 0;
let deltaTime = 0;
let gameRunning = true;
let gamePaused = false;

// Player object
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    color: '#FFA500', // Orange color
    angle: 0,
    vx: 0,
    vy: 0,
    maxSpeed: 4,
    acceleration: 0.2,
    deceleration: 0.05,
    hp: 100,
    acorns: 100,
    bombs: 5,
    lives: 3,
    score: 0,
    meleeCooldown: 0,
    projectileCooldown: 0,
    bombCooldown: 0
};

// Arrays for game objects
let enemies = [];
let obstacles = [];
let projectiles = [];
let bombs = [];
let melees = [];

// Initialize game
function init() {
    lastTime = performance.now();
    spawnObstacles();
    update();
}

// Event listeners
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Game update loop
function update(time) {
    if (!gameRunning) return;
    requestAnimationFrame(update);

    deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    if (gamePaused) return;

    // Update game objects
    updatePlayer();
    updateEnemies();
    updateObstacles();
    updateProjectiles();
    updateMelees();
    updateBombs();

    // Collision detection
    checkCollisions();

    // Draw everything
    draw();

    // Update HUD
    updateHUD();

    // Spawn enemies
    spawnEnemies();

    // Increase score over time
    player.score += deltaTime;
}

function updatePlayer() {
    let dx = 0;
    let dy = 0;
    if (keys['arrowup']) dy -= 1;
    if (keys['arrowdown']) dy += 1;
    if (keys['arrowleft']) dx -= 1;
    if (keys['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
        let direction = Math.atan2(dy, dx);
        player.angle = direction;

        // Acceleration
        player.vx += Math.cos(direction) * player.acceleration;
        player.vy += Math.sin(direction) * player.acceleration;

        // Limit speed
        let speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (speed > player.maxSpeed) {
            player.vx *= player.maxSpeed / speed;
            player.vy *= player.maxSpeed / speed;
        }
    } else {
        // Deceleration
        player.vx *= (1 - player.deceleration);
        player.vy *= (1 - player.deceleration);
    }

    player.x += player.vx;
    player.y += player.vy;

    // Keep player within screen bounds
    if (player.x < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = 0;
    if (player.y < 0) player.y = canvas.height;
    if (player.y > canvas.height) player.y = 0;

    // Attacks
    if (keys[' ']) {
        shootProjectile();
    }

    if (keys['f']) {
        performMeleeAttack();
    }

    if (keys['s']) {
        dropBomb();
    }

    // Cooldowns
    if (player.projectileCooldown > 0) player.projectileCooldown -= deltaTime;
    if (player.meleeCooldown > 0) player.meleeCooldown -= deltaTime;
    if (player.bombCooldown > 0) player.bombCooldown -= deltaTime;
}

function updateEnemies() {
    enemies.forEach((enemy, index) => {
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Remove enemies that are off-screen
        if (enemy.x < -enemy.size || enemy.x > canvas.width + enemy.size ||
            enemy.y < -enemy.size || enemy.y > canvas.height + enemy.size) {
            enemies.splice(index, 1);
        }
    });
}

function updateObstacles() {
    // Obstacles are static in this implementation
}

function updateMelees() {
    const currentTime = performance.now() / 1000;
    // Process each melee attack
    for (let i = melees.length - 1; i >= 0; i--) {
        const melee = melees[i];
        // Remove melee if expired
        if (currentTime - melee.startTime > melee.duration) {
            melees.splice(i, 1);
            continue;
        }
        // Check for collision with enemies
        // Iterate backwards to safely remove enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            // If enemy already hit by this melee attack, skip.
            if (melee.alreadyHit.has(enemy)) continue;
            // Compute vector from melee origin to enemy
            const dx = enemy.x - melee.x;
            const dy = enemy.y - melee.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Check if enemy is within the melee range (allow enemy size overlap)
            if (distance <= melee.range + enemy.size) {
                // Compute angle difference between melee angle and vector to enemy
                const angleToEnemy = Math.atan2(dy, dx);
                const angleDiff = Math.abs(normalizeAngle(angleToEnemy - melee.angle));
                // 1/3rd slice means 120° arc (±60° i.e. Math.PI/3)
                if (angleDiff <= Math.PI / 3) {
                    // Enemy is hit: update score based on type and remove enemy
                    if (enemy.type === 'small') player.score += 10;
                    else if (enemy.type === 'medium') player.score += 30;
                    else if (enemy.type === 'large') player.score += 50;
                    melee.alreadyHit.add(enemy);
                    enemies.splice(j, 1);
                }
            }
        }
    }
}

function updateProjectiles() {
    const now = performance.now();
    projectiles.forEach((projectile, pIndex) => {
        // On first update, initialize extra badass projectile properties.
        if (!projectile.initialized) {
            projectile.initialized = true;
            projectile.creationTime = now;
            // Vary the initial direction within a 6° arc (±3° in radians)
            const angleOffset = (Math.random() - 0.5) * (6 * Math.PI / 180);
            projectile.angle += angleOffset;
            // Make initial velocity faster by multiplying by 1.7
            const baseSpeed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
            const newSpeed = baseSpeed * 1.7;
            projectile.initialVx = Math.cos(projectile.angle) * newSpeed;
            projectile.initialVy = Math.sin(projectile.angle) * newSpeed;
            // Set initial velocity to boosted values
            projectile.vx = projectile.initialVx;
            projectile.vy = projectile.initialVy;
            // Determine a random decay rate between 1% and 20% of the initial velocity over 1 second.
            projectile.decayRate = Math.random() * 0.19 + 0.01;
        }

        // Determine elapsed time in seconds.
        let elapsed = (now - projectile.creationTime) / 1000;
        // Calculate decay factor: if decay period (1 sec) hasn't elapsed, decay gradually;
        // otherwise, hold at terminal velocity (initial speed reduced by decayRate).
        let factor = elapsed < 1 ? 1 - projectile.decayRate * elapsed : 1 - projectile.decayRate;
        projectile.vx = projectile.initialVx * factor;
        projectile.vy = projectile.initialVy * factor;

        // Update projectile position.
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Remove projectile if off-screen.
        if (
            projectile.x < 0 || projectile.x > canvas.width ||
            projectile.y < 0 || projectile.y > canvas.height
        ) {
            projectiles.splice(pIndex, 1);
            return;
        }

        // Check collision with enemies (iterating backwards for safe removal).
        for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
            const enemy = enemies[eIndex];
            let dx = enemy.x - projectile.x;
            let dy = enemy.y - projectile.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < enemy.size + projectile.size) {
                enemy.hp -= projectile.damage;
                soundManager.play('projectileHit');
                projectiles.splice(pIndex, 1);

                if (enemy.hp <= 0) {
                    soundManager.play('enemyDeath');
                    // Update score based on enemy type.
                    if (enemy.type === 'small') player.score += 10;
                    else if (enemy.type === 'medium') player.score += 30;
                    else if (enemy.type === 'large') player.score += 50;
                    enemies.splice(eIndex, 1);
                }
                break;
            }
        }
    });
}

function updateBombs() {
    const now = performance.now();
    bombs.forEach(bomb => {
        const elapsed = now - bomb.startTime;
        if (elapsed < bomb.durationExpand) {
            // Expanding phase: animate radius from 0 to maxRadius
            bomb.currentRadius = (elapsed / bomb.durationExpand) * bomb.maxRadius;
            bomb.opacity = 1;
        } else if (elapsed < bomb.durationExpand + bomb.durationFade) {
            // Fade out phase: maintain maxRadius but reduce opacity to 0
            bomb.currentRadius = bomb.maxRadius;
            bomb.opacity = 1 - ((elapsed - bomb.durationExpand) / bomb.durationFade);
        } else {
            bomb.done = true;
        }
        // Added bomb collision check: damage enemy if within bomb radius and not hit before.
        enemies.forEach((enemy, index) => {
            const dx = enemy.x - bomb.x;
            const dy = enemy.y - bomb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < bomb.currentRadius + enemy.size && !bomb.hitEnemies.has(enemy)) {
                enemy.hp -= bomb.damage;
                bomb.hitEnemies.add(enemy);
                if (enemy.hp <= 0) {
                    if (enemy.type === 'small') player.score += 10;
                    else if (enemy.type === 'medium') player.score += 30;
                    else if (enemy.type === 'large') player.score += 50;
                    enemies.splice(index, 1);
                }
            }
        });
    });
    // Remove completed bombs
    bombs = bombs.filter(bomb => !bomb.done);
}

function checkCollisions() {
    const now = performance.now();

    // Player and enemies - bounce and damage on impact
    enemies.forEach((enemy, index) => {
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
            if (!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) {
            // Both player and enemy receive damage equal to enemy.damage
            player.hp -= enemy.damage;
            enemy.hp -= enemy.damage;

            soundManager.play('playerHurt');

            // Set brief invulnerability (120ms)
            player.invulnerableUntil = performance.now() + 120;

            // Remove enemy if its health drops to 0 or below
            if (enemy.hp <= 0) {
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
    });

    // Player and obstacles - Bounce on collision with brief invulnerability
    obstacles.forEach((obstacle) => {
        let dx = player.x - obstacle.x;
        let dy = player.y - obstacle.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < obstacle.size + player.size) {
            // Bounce: compute the collision normal (direction from obstacle to player)
            let normalX = dx / distance;
            let normalY = dy / distance;

            // Reflect the player's velocity vector: v' = v - 2*(v · n)*n
            let dot = player.vx * normalX + player.vy * normalY;
            player.vx = player.vx - 2 * dot * normalX;
            player.vy = player.vy - 2 * dot * normalY;

            // Push the player out of collision to avoid sticking
            let overlap = (obstacle.size + player.size) - distance;
            player.x += normalX * overlap;
            player.y += normalY * overlap;

            // Apply damage only if enough time has passed since the last collision
            if (!player.invulnerableUntil || now >= player.invulnerableUntil) {
                player.hp -= 1;
                soundManager.play('collision');
                player.invulnerableUntil = now + 120; // 120ms invulnerability period

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

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw environment
    drawEnvironment();

    // Draw obstacles
    drawObstacles();

    // Draw player
    drawPlayer();

    // Draw projectiles
    drawProjectiles();

    // Draw melees
    drawMelees();

    // Draw bombs
    drawBombs();

    // Draw enemies
    drawEnemies();
}

function drawEnvironment() {
    // Since the background is a solid color, we don't need to draw anything extra
    // Optionally, you can draw trees and lakes here
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.beginPath();
    // Draw an isosceles triangle rotated 90 degrees so the tip points right
    ctx.moveTo(player.size, 0); // Tip of the triangle (pointing right)
    ctx.lineTo(-player.size, -player.size * 0.75); // Top left
    ctx.lineTo(-player.size, player.size * 0.75); // Bottom left
    ctx.closePath();
    ctx.fillStyle = 'orange';
    ctx.fill();
    ctx.restore();
}

function drawEnemies() {
    enemies.forEach((enemy) => {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();
    });
}

function drawObstacles() {
    obstacles.forEach((obstacle) => {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
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

function drawBomb(ctx, bomb) {
    ctx.save();
    ctx.globalAlpha = bomb.opacity;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.restore();
}

function updateHUD() {
    hud.innerHTML = `
        Lives: ${player.lives} <br>
        Health: ${Math.max(0, Math.floor(player.hp))} <br>
        Acorns: ${player.acorns} <br>
        Bombs: ${player.bombs} <br>
        Score: ${Math.floor(player.score)}
    `;
}

function spawnEnemies() {
    // Spawn logic based on proportions
    if (Math.random() < 0.02) {
        let rand = Math.random();
        let type;
        if (rand < 0.5) type = 'small';
        else if (rand < 0.8) type = 'medium';
        else type = 'large';

        let enemy = createEnemy(type);
        enemies.push(enemy);
    }
}

function spawnObstacles() {
    // Randomly place obstacles
    for (let i = 0; i < 50; i++) {
        let obstacle = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 20 + 10
        };
        obstacles.push(obstacle);
    }
}

function createEnemy(type) {
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
    return {
        x: x,
        y: y,
        size: size,
        hp: hp,
        speed: speed,
        damage: damage,
        type: type,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
    };
}

function shootProjectile() {
    if (player.projectileCooldown <= 0 && player.acorns > 0) {
        // Determine if this projectile is critical (approx. 1 in 15 chance)
        const isCritical = Math.random() < (1 / 15);
        const baseSpeed = 7;
        const projectileSpeed = isCritical ? baseSpeed * 2 : baseSpeed;
        const baseSize = 5;
        const projectileSize = isCritical ? baseSize * 2 : baseSize;
        const damage = isCritical ? 9 : 3;
        
        const projectile = {
            x: player.x + Math.cos(player.angle) * player.size,
            y: player.y + Math.sin(player.angle) * player.size,
            vx: Math.cos(player.angle) * projectileSpeed,
            vy: Math.sin(player.angle) * projectileSpeed,
            size: projectileSize,
            damage: damage,
            angle: player.angle
        };
        projectiles.push(projectile);
        soundManager.play(isCritical ? 'criticalProjectileShoot' : 'projectileShoot');
        player.projectileCooldown = 0.05; // 50 milliseconds
        player.acorns--;
    }
}

function performMeleeAttack() {
    // Only allow new melee attack if cooldown is 0
    if (player.meleeCooldown <= 0) {
        // Create a melee attack entity at player's current position and angle
        melees.push({
            x: player.x,
            y: player.y,
            angle: player.angle,
            range: 50,             // melee range (radius)
            duration: 0.05,        // duration in seconds (50ms)
            startTime: performance.now() / 1000,
            alreadyHit: new Set()
        });
        soundManager.play('meleeAttack');
        player.meleeCooldown = 0.5; // 500 milliseconds
    }
}

function dropBomb() {
    if (player.bombCooldown <= 0 && player.bombs > 0) {
        // Generate a critical hit boolean (true with a probability of 1/8)
        const isCritical = Math.random() < (1 / 6);
        bombs.push({
            x: player.x - Math.cos(player.angle) * player.size,
            y: player.y - Math.sin(player.angle) * player.size,
            startTime: performance.now(),
            durationExpand: 200,
            durationFade: 500,
            maxRadius: isCritical ? 200 : 100,
            currentRadius: 0,
            opacity: 1,
            done: false,
            damage: isCritical ? 100 : 20, // double damage for critical bombs
            hitEnemies: new Set()    // track enemies already damaged by this bomb
        });
        // Play different sound effects based on whether it's a critical bomb
        if(isCritical) {
            soundManager.play('criticalBombDrop');
            soundManager.play('bombDrop');
        } else {
            soundManager.play('bombDrop');
        }
        player.bombCooldown = 3; // 3 seconds
        player.bombs--;
    }
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
    message.innerText = 'You Died';
    gamePaused = true;
    setTimeout(() => {
        message.innerText = '';
        gamePaused = false;
    }, 3000);
}

function gameOver() {
    gameRunning = false;
    message.innerText = 'Game Over';
    soundManager.play('gameOver');
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

showSplashScreen();