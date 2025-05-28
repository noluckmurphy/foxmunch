import { soundManager } from './sounds.js';
import Player from "./entities/Player.js";
import Enemy from "./entities/Enemy.js";
import Projectile from "./entities/Projectile.js";
import Bomb from "./entities/Bomb.js";
import Melee from "./entities/Melee.js";
import Particle from "./entities/Particle.js";
import { inputManager } from './InputManager.js';

const canvas = typeof document !== 'undefined' ? document.getElementById('gameCanvas') : { width: 800, height: 600, getContext: () => null };
const ctx = canvas.getContext ? canvas.getContext('2d') : null;
const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null;
const message = typeof document !== 'undefined' ? document.getElementById('message') : null;

if (typeof window !== 'undefined') {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Game variables
let lastTime = 0;
let deltaTime = 0;
let gameRunning = true;
let gamePaused = false;
let highScore = 0;

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
// Arrays for game objects
let enemies = [];
let obstacles = [];
let projectiles = [];
let bombs = [];
let melees = [];
let particles = [];

// Initialize game
function init() {
    lastTime = performance.now();
    player.shotsFired = 0;
    player.shotsHit = 0;
    highScore = loadHighScore();
    player.score = 0;
    spawnObstacles();
    update(performance.now()); // Pass current time to update
}

// Input is handled by the InputManager

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
    updateParticles();

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
    player.update(inputManager, deltaTime, canvas, projectiles, melees, bombs, soundManager);
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i].update(canvas)) {
            enemies.splice(i, 1);
        }
    }
}

function updateObstacles() {
    // Obstacles are static in this implementation
}

function updateMelees() {
    for (let i = melees.length - 1; i >= 0; i--) {
        if (!melees[i].update(enemies, player, particles)) {
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
        if (!bombs[i].update(enemies, player, particles, () => triggerScreenShake(8, 150))) {
            bombs.splice(i, 1);
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

function checkCollisions() {
    const now = performance.now();

    // Player and enemies - bounce and damage on impact
    for (let index = enemies.length - 1; index >= 0; index--) {
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
            if (!player.invulnerableUntil || performance.now() >= player.invulnerableUntil) {
            // Both player and enemy receive damage equal to enemy.damage
            player.hp -= enemy.damage;
            enemy.hp -= enemy.damage;

            soundManager.play('playerHurt');
            triggerScreenShake(5, 200);

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
    }

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
                triggerScreenShake(5, 200);
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
    drawPlayer();
    drawProjectiles();
    drawMelees();
    drawBombs();
    drawParticles();
    drawEnemies();

    ctx.restore();
}

function drawEnvironment() {
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
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
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
    ctx.fillStyle = 'orange';
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
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

function updateHUD() {
    // Guard against NaN values in HUD
    const safe = v => (typeof v === 'number' && isFinite(v) && !isNaN(v)) ? Math.floor(v) : 0;
    hud.innerHTML = `
        Lives: ${safe(player.lives)} <br>
        Health: ${safe(player.hp)} <br>
        Acorns: ${safe(player.acorns)} <br>
        Bombs: ${safe(player.bombs)} <br>
        Score: ${safe(player.score)} <br>
        Accuracy: ${player.shotsFired ? Math.floor((player.shotsHit / player.shotsFired) * 100) : 0}% <br>
        Combo: x${safe(player.comboMultiplier)} <br>
        High Score: ${safe(highScore)}
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
    return new Enemy(x, y, size, hp, speed, damage, type, Math.cos(angle) * speed, Math.sin(angle) * speed);
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
    if (message) message.innerText = 'You Died';
    gamePaused = true;
    setTimeout(() => {
        if (message) message.innerText = '';
        gamePaused = false;
    }, 3000);
}

function gameOver(p = player) {
    gameRunning = false;
    const accuracy = p.shotsFired ? p.shotsHit / p.shotsFired : 0;
    const bonus = Math.floor(accuracy * 100);
    p.score += bonus;
    updateHighScore(p.score);
    if (message) message.innerText = `Game Over - Accuracy: ${(accuracy * 100).toFixed(0)}%`;
    soundManager.play('gameOver');
    p.comboMultiplier = 1;
    p.lastKillTime = 0;
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
