/**
 * Fox Munch - Client
 *
 * This file handles:
 *   - Title screen (start new game / join game)
 *   - Connecting to the server via Socket.IO
 *   - Sending player inputs to the server
 *   - Receiving game state from the server
 *   - Rendering the game from received state
 *   - HUD, pause overlay, game over screen
 */

import { soundManager } from './sounds.js';
import { inputManager } from './InputManager.js';
import NetworkClient from './network.js';
import { PLAYER_COLORS, PLAYER_COLOR_NAMES, WORLD_WIDTH, WORLD_HEIGHT } from './config.js';

// ----------------------------------------------------------------
// DOM elements
// ----------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const messageEl = document.getElementById('message');
const newGameButton = document.getElementById('newGameButton');
const pauseOverlay = document.getElementById('pauseOverlay');
const volumeSlider = document.getElementById('volumeSlider');
const gamepadIndicator = document.getElementById('gamepadIndicator');
const settingsScreen = document.getElementById('settingsScreen');
const titleScreen = document.getElementById('titleScreen');
const controlsLegend = document.getElementById('controlsLegend');

// Title screen elements
const startGameBtn = document.getElementById('startGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const playerNameInput = document.getElementById('playerNameInput');
const joinCodeInput = document.getElementById('joinCodeInput');
const titleError = document.getElementById('titleError');
const titleStatus = document.getElementById('titleStatus');

// ----------------------------------------------------------------
// Network client
// ----------------------------------------------------------------
const network = new NetworkClient();

// ----------------------------------------------------------------
// Game state
// ----------------------------------------------------------------
let currentState = null;  // Latest game state from server
let localPlayerId = null;
let roomCode = null;
let gameActive = false;
let gamePaused = false;
let gameOverData = null;

// Screen shake
let shakeDuration = 0;
let shakeIntensity = 0;

// Previous frame key states for edge detection
let prevPauseKey = false;
let prevSettingsKey = false;

// Scaling: the game world is WORLD_WIDTH x WORLD_HEIGHT, scaled to fit the viewport
let scaleX = 1;
let scaleY = 1;

// High score (local persistence)
let highScore = 0;
if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('highScore');
    if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && isFinite(parsed)) highScore = parsed;
    }
}

// ----------------------------------------------------------------
// Volume setup
// ----------------------------------------------------------------
if (volumeSlider) {
    soundManager.setVolume(parseFloat(volumeSlider.value));
    volumeSlider.addEventListener('input', () => {
        soundManager.setVolume(parseFloat(volumeSlider.value));
    });
}

// ----------------------------------------------------------------
// Settings screen (gamepad config)
// ----------------------------------------------------------------
let settingsInputs = null;
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

// ----------------------------------------------------------------
// Canvas sizing
// ----------------------------------------------------------------
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    scaleX = canvas.width / WORLD_WIDTH;
    scaleY = canvas.height / WORLD_HEIGHT;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ----------------------------------------------------------------
// Splash screen
// ----------------------------------------------------------------
function showSplashScreen() {
    canvas.style.display = 'none';
    hud.style.display = 'none';
    if (titleScreen) titleScreen.style.display = 'none';
    if (controlsLegend) controlsLegend.style.display = 'none';

    const splashScreen = document.createElement('div');
    splashScreen.id = 'splashScreen';
    document.body.appendChild(splashScreen);

    const splashText = document.createElement('h1');
    splashText.id = 'splashText';
    splashText.innerText = 'Fox Munch by FRM';
    splashScreen.appendChild(splashText);

    splashScreen.style.position = 'absolute';
    splashScreen.style.top = '0';
    splashScreen.style.left = '0';
    splashScreen.style.width = '100%';
    splashScreen.style.height = '100%';
    splashScreen.style.display = 'flex';
    splashScreen.style.justifyContent = 'center';
    splashScreen.style.alignItems = 'center';
    splashScreen.style.backgroundColor = '#ff6600';
    splashScreen.style.zIndex = '1000';

    splashText.style.color = 'white';
    splashText.style.fontFamily = 'Impact, sans-serif';
    splashText.style.fontSize = '100px';
    splashText.style.animation = 'fadeInOut 4s';

    const styleSheet = document.styleSheets[0];
    styleSheet.insertRule(`
        @keyframes fadeInOut {
            0% { opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { opacity: 0; }
        }
    `, styleSheet.cssRules.length);

    setTimeout(() => {
        splashScreen.remove();
        showTitleScreen();
    }, 4000);
}

// ----------------------------------------------------------------
// Title screen
// ----------------------------------------------------------------
function showTitleScreen() {
    canvas.style.display = 'none';
    hud.style.display = 'none';
    if (messageEl) messageEl.innerHTML = '';
    if (newGameButton) newGameButton.style.display = 'none';
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    if (controlsLegend) controlsLegend.style.display = 'none';

    if (titleScreen) {
        titleScreen.style.display = 'flex';
    }
    if (titleError) titleError.innerText = '';
    if (titleStatus) titleStatus.innerText = '';

    gameActive = false;
    gameOverData = null;
    currentState = null;
}

async function handleStartGame() {
    const name = (playerNameInput ? playerNameInput.value.trim() : '') || 'Player';
    if (titleError) titleError.innerText = '';
    if (titleStatus) titleStatus.innerText = 'Connecting...';
    if (startGameBtn) startGameBtn.disabled = true;
    if (joinGameBtn) joinGameBtn.disabled = true;

    try {
        if (!network.connected) {
            await network.connect();
        }
        const result = await network.createRoom(name);
        roomCode = result.code;
        localPlayerId = result.playerId;
        setupNetworkCallbacks();
        transitionToGame();
    } catch (err) {
        if (titleError) titleError.innerText = err.message || 'Failed to connect';
        if (titleStatus) titleStatus.innerText = '';
    } finally {
        if (startGameBtn) startGameBtn.disabled = false;
        if (joinGameBtn) joinGameBtn.disabled = false;
    }
}

async function handleJoinGame() {
    const name = (playerNameInput ? playerNameInput.value.trim() : '') || 'Player';
    const code = (joinCodeInput ? joinCodeInput.value.trim() : '');
    if (!code) {
        if (titleError) titleError.innerText = 'Please enter a room code';
        return;
    }
    if (titleError) titleError.innerText = '';
    if (titleStatus) titleStatus.innerText = 'Joining...';
    if (startGameBtn) startGameBtn.disabled = true;
    if (joinGameBtn) joinGameBtn.disabled = true;

    try {
        if (!network.connected) {
            await network.connect();
        }
        const result = await network.joinRoom(code, name);
        roomCode = result.code;
        localPlayerId = result.playerId;
        setupNetworkCallbacks();
        transitionToGame();
    } catch (err) {
        if (titleError) titleError.innerText = err.message || 'Failed to join';
        if (titleStatus) titleStatus.innerText = '';
    } finally {
        if (startGameBtn) startGameBtn.disabled = false;
        if (joinGameBtn) joinGameBtn.disabled = false;
    }
}

function setupNetworkCallbacks() {
    network.onGameState((state) => {
        currentState = state;
    });

    network.onPlayerJoined((data) => {
        // Could show a notification
    });

    network.onPlayerLeft((data) => {
        // Could show a notification
    });

    network.onGameOver((data) => {
        gameOverData = data;
        gameActive = false;
        // Update local high score
        if (data.teamScore > highScore) {
            highScore = data.teamScore;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('highScore', Math.floor(highScore));
            }
        }
    });

    network.onPauseChanged((data) => {
        gamePaused = data.paused;
    });

    network.onDisconnect(() => {
        gameActive = false;
        showTitleScreen();
        if (titleError) titleError.innerText = 'Disconnected from server';
    });
}

function transitionToGame() {
    if (titleScreen) titleScreen.style.display = 'none';
    canvas.style.display = 'block';
    hud.style.display = 'block';
    if (controlsLegend) controlsLegend.style.display = 'block';
    if (messageEl) messageEl.innerHTML = '';
    if (newGameButton) newGameButton.style.display = 'none';

    gameActive = true;
    gamePaused = false;
    gameOverData = null;

    // Start render loop
    requestAnimationFrame(renderLoop);
}

// ----------------------------------------------------------------
// Button event listeners
// ----------------------------------------------------------------
if (startGameBtn) startGameBtn.addEventListener('click', handleStartGame);
if (joinGameBtn) joinGameBtn.addEventListener('click', handleJoinGame);

// Also allow Enter key in the join code input
if (joinCodeInput) {
    joinCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoinGame();
    });
}
if (playerNameInput) {
    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStartGame();
    });
}

// New game button (shown on game over)
if (newGameButton) {
    newGameButton.addEventListener('click', () => {
        showTitleScreen();
    });
}

// ----------------------------------------------------------------
// Render loop
// ----------------------------------------------------------------
function renderLoop() {
    if (!gameActive && !gameOverData) return;

    requestAnimationFrame(renderLoop);

    // Poll gamepad
    inputManager.pollGamepads();

    // Handle pause key
    const pausePressed = inputManager.isPressed('p');
    if (pausePressed && !prevPauseKey) {
        network.togglePause();
    }
    prevPauseKey = pausePressed;

    // Handle settings key
    const settingsPressed = inputManager.isPressed('`');
    if (settingsPressed && !prevSettingsKey && settingsScreen) {
        settingsScreen.style.display = settingsScreen.style.display === 'block' ? 'none' : 'block';
    }
    prevSettingsKey = settingsPressed;

    // Send input to server
    if (gameActive && !gamePaused) {
        const keys = {
            up: inputManager.isPressed('arrowup'),
            down: inputManager.isPressed('arrowdown'),
            left: inputManager.isPressed('arrowleft'),
            right: inputManager.isPressed('arrowright'),
            shoot: inputManager.isPressed(' '),
            melee: inputManager.isPressed('f'),
            bomb: inputManager.isPressed('s')
        };
        network.sendInput(keys);
    }

    // Render
    if (currentState) {
        draw(currentState);
        updateHUD(currentState);
        updatePauseOverlay(currentState);
    }

    // Game over UI
    if (gameOverData && currentState) {
        showGameOver(gameOverData);
    }
}

// ----------------------------------------------------------------
// Drawing - renders from server state
// ----------------------------------------------------------------
function draw(state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Screen shake
    let offsetX = 0;
    let offsetY = 0;
    if (shakeDuration > 0) {
        offsetX = (Math.random() - 0.5) * shakeIntensity;
        offsetY = (Math.random() - 0.5) * shakeIntensity;
        shakeDuration -= 16; // ~1 frame at 60fps
        if (shakeDuration < 0) shakeDuration = 0;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Scale world coordinates to viewport
    ctx.scale(scaleX, scaleY);

    drawEnvironment(state);
    drawObstacles(state);
    drawBonfireEntities(state);
    drawWindAuras(state);
    drawPlayers(state);
    drawProjectiles(state);
    drawEnemyProjectiles(state);
    drawMelees(state);
    drawBombs(state);
    drawStars(state);
    drawPowerUps(state);
    drawParticles(state);
    drawEnemies(state);
    drawMessages(state);

    // Freeze blue hue overlay
    const localPlayer = state.players.find(p => p.id === localPlayerId);
    if (localPlayer && localPlayer.freezeBonusActive) {
        ctx.fillStyle = 'rgba(0, 80, 200, 0.15)';
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    ctx.restore();

    // World bonus roulette overlay (drawn outside the shake/scale transform)
    drawWorldBonusOverlay(state.worldBonus);
}

// ----------------------------------------------------------------
// Environment / Scenery
// ----------------------------------------------------------------
function drawEnvironment(state) {
    if (!state.scenery) return;
    for (const obj of state.scenery) {
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
    }
}

function drawObstacles(state) {
    if (!state.obstacles) return;
    for (const obstacle of state.obstacles) {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'darkred';
        ctx.stroke();
    }
}

// ----------------------------------------------------------------
// Players
// ----------------------------------------------------------------
function drawPlayers(state) {
    if (!state.players) return;
    for (const p of state.players) {
        if (!p.alive && p.lives <= 0) continue; // Don't draw fully dead players

        const isHiding = p.earthBonusActive && p.hidingInObstacle;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Fire immunity aura
        if (p.fireImmune) {
            ctx.save();
            ctx.rotate(-p.angle);
            const glowSize = p.size * 2.5 + Math.sin(performance.now() / 200) * 5;
            const grad = ctx.createRadialGradient(0, 0, p.size * 0.5, 0, 0, glowSize);
            grad.addColorStop(0, 'rgba(255, 120, 0, 0.25)');
            grad.addColorStop(0.6, 'rgba(255, 60, 0, 0.1)');
            grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Speed boost emoji
        if (p.speedBoostTimer > 0) {
            ctx.font = `${p.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u{1F525}', -p.size * 1.4, 0);
        }

        // Triangle body
        ctx.beginPath();
        ctx.moveTo(p.size, 0);
        ctx.lineTo(-p.size, -p.size * 0.75);
        ctx.lineTo(-p.size, p.size * 0.75);
        ctx.closePath();

        let alpha = 1;
        if (p.invulnerable) {
            alpha = 0.5 + 0.5 * Math.sin(performance.now() / 60);
        }
        if (isHiding) alpha *= 0.35;

        ctx.fillStyle = p.rapidFireTimer > 0 ? 'yellow' : p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Rapid fire flash
        if (p.rapidFireTimer > 0) {
            const flash = p.size * 0.4 * (1 + Math.sin(performance.now() / 50));
            ctx.beginPath();
            ctx.arc(p.size + flash * 0.5, 0, flash, 0, Math.PI * 2);
            ctx.fillStyle = 'red';
            ctx.fill();
        }

        // Shield glow
        if (p.shieldTimer > 0) {
            ctx.lineWidth = 3 + Math.sin(performance.now() / 100) * 1;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        // Name label above player
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.name, p.x, p.y - p.size - 8);

        // Local player indicator
        if (p.id === localPlayerId) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeText(p.name, p.x, p.y - p.size - 8);
        }
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// Enemies
// ----------------------------------------------------------------
function drawEnemies(state) {
    if (!state.enemies) return;
    for (const enemy of state.enemies) {
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
                ctx.lineWidth = 10 * (enemy.shield / (enemy.shieldMax || 40));
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
    }
}

// ----------------------------------------------------------------
// Projectiles
// ----------------------------------------------------------------
function drawProjectiles(state) {
    if (!state.projectiles) return;
    for (const proj of state.projectiles) {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -proj.size);
        ctx.lineTo(proj.size, proj.size);
        ctx.lineTo(-proj.size, proj.size);
        ctx.closePath();
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.restore();
    }
}

function drawEnemyProjectiles(state) {
    if (!state.enemyProjectiles) return;
    for (const p of state.enemyProjectiles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'pink';
        ctx.fill();
    }
}

// ----------------------------------------------------------------
// Melees
// ----------------------------------------------------------------
function drawMelees(state) {
    if (!state.melees) return;
    for (const melee of state.melees) {
        const progress = melee.progress;
        if (progress < 0 || progress > 1) continue;
        const currentRadius = melee.range * progress;
        ctx.save();
        ctx.translate(melee.x, melee.y);
        const startAngle = melee.angle - Math.PI / 3;
        const endAngle = melee.angle + Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, currentRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fill();
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// Bombs
// ----------------------------------------------------------------
function drawBombs(state) {
    if (!state.bombs) return;
    for (const bomb of state.bombs) {
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
}

// ----------------------------------------------------------------
// Stars / Power-ups
// ----------------------------------------------------------------
function drawStars(state) {
    if (!state.stars) return;
    for (const star of state.stars) {
        ctx.save();
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        const points = 5;
        for (let i = 0; i < points; i++) {
            const outerAngle = (i * 2 * Math.PI) / points - Math.PI / 2;
            const innerAngle = outerAngle + Math.PI / points;
            const outerX = star.x + Math.cos(outerAngle) * star.size;
            const outerY = star.y + Math.sin(outerAngle) * star.size;
            const innerX = star.x + Math.cos(innerAngle) * (star.size / 2);
            const innerY = star.y + Math.sin(innerAngle) * (star.size / 2);
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

function drawPowerUps(state) {
    if (!state.powerUps) return;
    for (const pu of state.powerUps) {
        ctx.save();
        ctx.font = `${pu.size * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (pu.type === 'shield') ctx.fillText('\u{1F6E1}\uFE0F', pu.x, pu.y);
        else if (pu.type === 'rapidFire') ctx.fillText('\u{1F52B}', pu.x, pu.y);
        else ctx.fillText('\u{1F3CE}\uFE0F', pu.x, pu.y);
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// Particles / Messages
// ----------------------------------------------------------------
function drawParticles(state) {
    if (!state.particles) return;
    for (const p of state.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawMessages(state) {
    if (!state.messages) return;
    for (const m of state.messages) {
        const alpha = Math.max(m.life / m.duration, 0);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(m.text, m.x, m.y);
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// Bonfires
// ----------------------------------------------------------------
function drawBonfireEntities(state) {
    if (!state.bonfires) return;
    for (const b of state.bonfires) {
        ctx.save();
        // Outer glow
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
        grad.addColorStop(0, 'rgba(255, 100, 0, 0.18)');
        grad.addColorStop(0.5, 'rgba(255, 60, 0, 0.07)');
        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Animated flame core
        const flicker = Math.sin(b.time * 10) * 3;
        const coreSize = b.size + flicker;
        const coreGrad = ctx.createRadialGradient(b.x, b.y - 4, 0, b.x, b.y - 4, coreSize * 1.5);
        coreGrad.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
        coreGrad.addColorStop(0.3, 'rgba(255, 160, 0, 0.7)');
        coreGrad.addColorStop(0.7, 'rgba(255, 60, 0, 0.4)');
        coreGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y - 4, coreSize * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Flame tongues
        for (let i = 0; i < 3; i++) {
            const offset = Math.sin(b.time * 8 + i * 2.1) * 5;
            const tongueH = coreSize * (1.2 + 0.3 * Math.sin(b.time * 12 + i));
            ctx.beginPath();
            ctx.moveTo(b.x - 5 + i * 5 + offset, b.y);
            ctx.quadraticCurveTo(b.x - 3 + i * 5 + offset * 0.5, b.y - tongueH, b.x + i * 5 + offset, b.y - tongueH * 0.6);
            ctx.quadraticCurveTo(b.x + 3 + i * 5 + offset * 0.5, b.y - tongueH, b.x + 5 + i * 5 + offset, b.y);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, ${100 + i * 40}, 0, ${0.5 - i * 0.1})`;
            ctx.fill();
        }
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// Wind aura
// ----------------------------------------------------------------
function drawWindAuras(state) {
    if (!state.players) return;
    const WIND_PUSH_RADIUS = 200;
    for (const p of state.players) {
        if (!p.windBonusActive || !p.alive) continue;
        ctx.save();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, WIND_PUSH_RADIUS);
        grad.addColorStop(0, 'rgba(200, 230, 255, 0.0)');
        grad.addColorStop(0.5, 'rgba(200, 230, 255, 0.08)');
        grad.addColorStop(0.85, 'rgba(180, 220, 255, 0.15)');
        grad.addColorStop(1, 'rgba(180, 220, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, WIND_PUSH_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        const now = performance.now() / 1000;
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.25)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const baseAngle = (i / 6) * Math.PI * 2 + now * 1.5;
            ctx.beginPath();
            for (let t = 0; t < 1; t += 0.02) {
                const r = WIND_PUSH_RADIUS * t;
                const a = baseAngle + t * 2;
                const x = p.x + Math.cos(a) * r;
                const y = p.y + Math.sin(a) * r;
                if (t === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
}

// ----------------------------------------------------------------
// World Bonus roulette overlay
// ----------------------------------------------------------------
const BONUS_TYPES = [
    { id: 'wind', label: 'Wind', color: '#7ec8e3', icon: '\u{1F32C}\uFE0F' },
    { id: 'earth', label: 'Earth', color: '#a0785a', icon: '\u{1FAA8}' },
    { id: 'freeze', label: 'Freeze', color: '#4466cc', icon: '\u2744\uFE0F' },
    { id: 'fire', label: 'Fire', color: '#e85d26', icon: '\u{1F525}' },
    { id: 'boss', label: 'Boss', color: '#6b2fa0', icon: '\u{1F480}' },
];
const WEDGE_ANGLE = (Math.PI * 2) / BONUS_TYPES.length;

function drawWorldBonusOverlay(wb) {
    if (!wb || (wb.phase !== 'spinning' && wb.phase !== 'reveal')) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.25;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(cx, cy);

    const angle = wb.spinCurrentAngle;

    ctx.save();
    ctx.rotate(angle);

    for (let i = 0; i < BONUS_TYPES.length; i++) {
        const startA = i * WEDGE_ANGLE;
        const endA = startA + WEDGE_ANGLE;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startA, endA);
        ctx.closePath();
        ctx.fillStyle = BONUS_TYPES[i].color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.stroke();

        const midAngle = startA + WEDGE_ANGLE / 2;
        const labelR = radius * 0.62;
        ctx.save();
        ctx.translate(Math.cos(midAngle) * labelR, Math.sin(midAngle) * labelR);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(radius * 0.12)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(BONUS_TYPES[i].label, 0, -radius * 0.06);
        ctx.font = `${Math.floor(radius * 0.18)}px Arial`;
        ctx.fillText(BONUS_TYPES[i].icon, 0, radius * 0.08);
        ctx.restore();
    }

    ctx.restore(); // un-rotate

    // Pointer
    const pSize = radius * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, -radius - pSize * 1.5);
    ctx.lineTo(-pSize, -radius - pSize * 3);
    ctx.lineTo(pSize, -radius - pSize * 3);
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Reveal text
    if (wb.phase === 'reveal' && wb.selectedIndex >= 0) {
        const bonus = BONUS_TYPES[wb.selectedIndex];
        const pulse = 1 + 0.05 * Math.sin(performance.now() / 200);
        ctx.save();
        ctx.scale(pulse, pulse);
        ctx.font = `bold ${Math.floor(radius * 0.28)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.shadowColor = bonus.color;
        ctx.shadowBlur = 30;
        ctx.fillText(`${bonus.icon} ${bonus.label} ${bonus.icon}`, 0, radius + radius * 0.4);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'white';
    ctx.stroke();

    ctx.restore();
}

// ----------------------------------------------------------------
// HUD
// ----------------------------------------------------------------
function updateHUD(state) {
    if (!hud) return;

    const safe = v => (typeof v === 'number' && isFinite(v) && !isNaN(v)) ? Math.floor(v) : 0;
    const localPlayer = state.players.find(p => p.id === localPlayerId);

    // Build player stats rows
    let playersHtml = '';
    for (const p of state.players) {
        const isLocal = p.id === localPlayerId;
        const healthPct = Math.max(0, Math.min(safe(p.hp), 100));
        const acornPct = Math.max(0, Math.min(safe(p.acorns), 100));
        const bombPct = Math.max(0, Math.min(safe(p.bombs * 20), 100));
        const nameStyle = `color: ${p.color}; font-weight: ${isLocal ? 'bold' : 'normal'}`;
        const statusIcon = p.alive && p.lives > 0 ? '' : ' [dead]';

        playersHtml += `
            <div class="hud-player ${isLocal ? 'hud-player-local' : ''}">
                <div style="${nameStyle}">${p.name}${statusIcon}${isLocal ? ' (you)' : ''}</div>
                <div class="hud-row"><span class="hud-label">HP: ${safe(p.hp)}</span><div class="hud-bar"><div class="hud-fill" style="width:${healthPct}%;background:${p.color}"></div></div></div>
                <div class="hud-row"><span class="hud-label">Lives: ${safe(p.lives)}</span></div>
                <div class="hud-row"><span class="hud-label">Score: ${safe(p.score)}</span></div>
            </div>
        `;
    }

    // World bonus status
    const wb = state.worldBonus;
    let bonusLine = '';
    if (wb.phase === 'countdown') {
        bonusLine = `<div class="hud-bonus-timer">Next Bonus: ${safe(wb.countdownTimer)}s</div>`;
    } else if (wb.phase === 'spinning' || wb.phase === 'reveal') {
        bonusLine = `<div class="hud-bonus-timer hud-bonus-active">Roulette!</div>`;
    } else if (wb.activeBonus && wb.activeBonus !== 'boss') {
        const bonusNames = { wind: '\u{1F32C}\uFE0F Wind', earth: '\u{1FAA8} Earth', freeze: '\u2744\uFE0F Freeze', fire: '\u{1F525} Fire' };
        const label = bonusNames[wb.activeBonus] || wb.activeBonus;
        bonusLine = `<div class="hud-bonus-timer hud-bonus-active">${label}: ${safe(wb.bonusTimer)}s</div>`;
    }

    // Room code for local player
    const localStats = localPlayer ? `
        <div class="hud-row"><span class="hud-label">Acorns: ${safe(localPlayer.acorns)}</span><div class="hud-bar"><div class="hud-fill" style="width:${Math.max(0, Math.min(safe(localPlayer.acorns), 100))}%"></div></div></div>
        <div class="hud-row"><span class="hud-label">Bombs: ${safe(localPlayer.bombs)}</span><div class="hud-bar"><div class="hud-fill" style="width:${Math.max(0, Math.min(safe(localPlayer.bombs * 20), 100))}%"></div></div></div>
        <div>Accuracy: ${localPlayer.shotsFired ? Math.floor((localPlayer.shotsHit / localPlayer.shotsFired) * 100) : 0}%</div>
        <div>Combo: x${safe(localPlayer.comboMultiplier)}</div>
    ` : '';

    hud.innerHTML = `
        <div class="hud-team-score">Team Score: ${safe(state.teamScore)}</div>
        <div class="hud-room-code">Room: ${roomCode ? roomCode.toUpperCase() : '---'}</div>
        <div class="hud-player-count">${state.players.length}/4 Players</div>
        <hr style="border-color: rgba(255,255,255,0.2); margin: 5px 0;">
        ${localStats}
        ${bonusLine}
        <hr style="border-color: rgba(255,255,255,0.2); margin: 5px 0;">
        ${playersHtml}
        <div>High Score: ${safe(highScore)}</div>
    `;
}

// ----------------------------------------------------------------
// Pause overlay
// ----------------------------------------------------------------
function updatePauseOverlay(state) {
    if (!pauseOverlay) return;

    if (state.gamePaused) {
        let playersHtml = '';
        for (const p of state.players) {
            playersHtml += `<div style="color: ${p.color}; margin: 4px 0;">${p.name}${p.id === localPlayerId ? ' (you)' : ''}</div>`;
        }

        pauseOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 64px; margin-bottom: 20px;">Paused</div>
                <div style="font-size: 28px; margin-bottom: 10px;">Room Code</div>
                <div style="font-size: 48px; font-family: monospace; letter-spacing: 8px; margin-bottom: 20px; color: #FFA500;">${roomCode ? roomCode.toUpperCase() : '---'}</div>
                <div style="font-size: 16px; margin-bottom: 15px; color: #ccc;">Share this code with friends to let them join!</div>
                <div style="font-size: 20px; margin-bottom: 8px;">Players:</div>
                ${playersHtml}
                <div style="font-size: 14px; margin-top: 15px; color: #999;">Press P to resume</div>
            </div>
        `;
        pauseOverlay.style.display = 'flex';
    } else {
        pauseOverlay.style.display = 'none';
    }
}

// ----------------------------------------------------------------
// Game over screen
// ----------------------------------------------------------------
function showGameOver(data) {
    if (!messageEl) return;

    let msg = `Game Over<br/>Team Score: ${data.teamScore}`;
    for (const ps of data.playerScores) {
        msg += `<br/><span style="color: ${ps.color}">${ps.name}</span>: ${ps.score} (${ps.accuracy}% accuracy)`;
    }
    if (data.teamScore > highScore) {
        msg += '<br/>New High Score!';
    }
    messageEl.innerHTML = msg;
    if (newGameButton) newGameButton.style.display = 'block';
}

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
showSplashScreen();
