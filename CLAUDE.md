# CLAUDE.md — Fox Munch

## Project Overview

Fox Munch is an online multiplayer co-op survival shooter (up to 4 players). It uses a **server-authoritative architecture** with Express.js and Socket.IO. Players control foxes in an Asteroids-style arena, fighting waves of enemies that scale in difficulty. The game features a roulette-based world bonus system, power-ups, combo scoring, and gamepad support.

All game logic runs on the server. Clients are rendering-only — they send input and receive serialized game state each tick.

## Directory Structure

```
foxmunch/
├── foxmunch.html              # Main HTML entry point (title screen, canvas, HUD, settings UI)
├── style.css                  # All game styling (HUD, overlays, title screen, controls legend)
├── package.json               # ES modules project; express + socket.io dependencies
├── CLAUDE.md                  # This file
├── README.md                  # Brief project description
├── .gitignore                 # Ignores node_modules/ and .cursor/
│
├── js/                        # Client-side code
│   ├── game.js                # Main client: rendering, networking, UI, input polling (~1,184 lines)
│   ├── network.js             # Socket.IO client wrapper (connect, createRoom, joinRoom, sendInput)
│   ├── config.js              # Game constants (world size, player defaults, colors, tick rate)
│   ├── InputManager.js        # Keyboard & gamepad input with configurable controls
│   ├── utils.js               # Helper: normalizeAngle()
│   ├── sounds.js              # Sound manager with volume control
│   ├── WorldBonus.js          # Roulette wheel state machine (countdown → spin → reveal → active)
│   ├── spawnUtils.js          # Collision checking: isClearOfObstacles()
│   └── entities/              # Game entity classes (17 total)
│       ├── Player.js           # Movement, shooting, melee, bombs, power-ups, combo scoring
│       ├── Enemy.js            # Base enemy class
│       ├── SquareEnemy.js      # Splits into smaller squares on death
│       ├── ChargingEnemy.js    # Charges at nearest player
│       ├── EliteEnemy.js       # High-HP enemy with shield + orbitals
│       ├── Orbital.js          # Satellite enemies orbiting elites
│       ├── Projectile.js       # Player acorn projectiles (velocity decay)
│       ├── EnemyProjectile.js  # Enemy projectiles
│       ├── Bomb.js             # Expanding radius AoE with ring effect
│       ├── Melee.js            # Radial sweep melee attack
│       ├── ShieldPowerUp.js    # 5s hit invulnerability
│       ├── RapidFirePowerUp.js # 2x fire rate for 5s
│       ├── SpeedBoostPowerUp.js# 1.5x speed for 5s
│       ├── Star.js             # Collectible pickup
│       ├── Particle.js         # Visual particle effects
│       ├── FloatingText.js     # Damage/combo notification text
│       └── Bonfire.js          # Fire world bonus: animated flames, area damage
│
├── server/                    # Server-side code
│   ├── index.js               # Express + Socket.IO server entry point (port 3000)
│   ├── GameRoom.js            # Room management, player tracking, game loop (30 Hz)
│   └── GameSimulation.js      # All game simulation logic (~1,188 lines)
│
├── tests/                     # Unit tests (16 test files)
│   ├── runTests.js            # Custom test runner (Node.js assert + dynamic import)
│   ├── Player.test.js
│   ├── Projectile.test.js
│   ├── Bomb.test.js
│   ├── Melee.test.js
│   ├── Enemy.test.js
│   ├── SquareEnemy.test.js
│   ├── ChargingEnemy.test.js
│   ├── Star.test.js
│   ├── PowerUps.test.js
│   ├── InputManager.test.js
│   ├── SpawnUtils.test.js
│   ├── AccuracyCounters.test.js
│   ├── ComboBonus.test.js
│   ├── SoundManager.test.js
│   ├── HighScorePersistence.test.js
│   └── normalizeAngle.test.js
│
└── assets/
    └── sounds/                # 11 MP3 sound effects (bg music, shots, hits, death, game over)
```

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Start the server (serves on http://localhost:3000)
npm start

# Run tests
node tests/runTests.js
```

There is no build step. The project uses ES modules (`"type": "module"` in package.json) served directly to the browser. No bundler, transpiler, or linter is configured.

## Architecture

### Server-Authoritative Multiplayer

- **Server** (`server/GameSimulation.js`): Owns all game state. Runs the game loop at 30 Hz via `setInterval`. Processes player input, updates entities, detects collisions, handles spawning, and serializes full state each tick.
- **Client** (`js/game.js`): Sends input to server each frame via `network.sendInput()`. Receives serialized game state via Socket.IO `gameState` event. Renders everything from that state snapshot. Also plays sound events sent from the server.
- **Rooms** (`server/GameRoom.js`): Players join rooms via 4-letter codes. Max 4 players per room. Rooms are cleaned up when all players disconnect.

### Communication Protocol (Socket.IO)

**Client → Server:**
| Event | Payload |
|---|---|
| `createRoom` | `{playerName, rouletteConfig}` |
| `joinRoom` | `{code, playerName}` |
| `playerInput` | `{up, down, left, right, shoot, melee, bomb}` |
| `togglePause` | none |
| `requestNewGame` | none |
| `updateRouletteConfig` | `{countdownDuration, weights: [5 numbers]}` |

**Server → Client:**
| Event | Payload |
|---|---|
| `gameState` | Full serialized `GameSimulation` state |
| `playerJoined` | `{playerId, name, color, playerCount}` |
| `playerLeft` | `{playerId, playerCount}` |
| `gameOver` | `{teamScore, playerScores: [{name, score, accuracy}]}` |
| `pauseChanged` | `{paused, pausedBy}` |
| `newGameStarted` | none |

### Entity Pattern

All game entities follow the same lifecycle:
1. **Instantiation** — Created with position and initial parameters
2. **`update(deltaTime)`** — Called each server tick; returns `true` if still alive
3. **`serialize()`** — Returns plain object for network transmission
4. **Client rendering** — `game.js` draws each entity type from serialized data
5. **Removal** — Filtered out when `update()` returns `false` or HP ≤ 0

Entity classes are in `js/entities/`. They are used on both server (simulation) and client (rendering reference), but **authoritative state lives on the server only**.

### World Bonus Roulette

The `WorldBonus` class (`js/WorldBonus.js`) is a state machine with 4 phases:
- **countdown** (90s default) → **spinning** (3.5s, wheel animation) → **reveal** (3s, display result) → **active** (15s effect)

Five possible outcomes: Wind, Earth, Freeze, Fire, Boss. Weights are configurable from the pause menu and persist in localStorage.

## Key Configuration Values

Defined in `js/config.js`:

| Constant | Value |
|---|---|
| `WORLD_WIDTH` | 1920 |
| `WORLD_HEIGHT` | 1080 |
| `SERVER_TICK_RATE` | 30 (Hz) |
| `MAX_PLAYERS` | 4 |
| `PLAYER_DEFAULTS.hp` | 100 |
| `PLAYER_DEFAULTS.acorns` | 200 |
| `PLAYER_DEFAULTS.bombs` | 5 |
| `PLAYER_DEFAULTS.lives` | 3 |
| `PLAYER_DEFAULTS.maxSpeed` | 4 |
| `PLAYER_COLORS` | Orange, Blue, Green, Purple |

## Testing

Tests use Node.js built-in `assert` module with a custom runner (`tests/runTests.js`). No external test framework.

**Run all tests:**
```bash
node tests/runTests.js
```

The runner provides a `localStorage` stub for Node.js, dynamically imports all `*.test.js` files, and exits with code 1 if any fail.

**Test structure:** Each test file is a self-contained async IIFE that imports the module under test, creates instances, calls methods, and uses `assert.strictEqual()` / `assert.ok()`.

**Coverage areas:** Player actions, projectile behavior, bomb/melee mechanics, enemy types, power-ups, input handling, spawn collision checking, accuracy counters, combo scoring, sound playback, high score persistence, utility functions.

## Conventions and Patterns

### Code Style
- **ES modules** throughout (`import`/`export`), both client and server
- **Class-based** entity design — each game object is its own class file in `js/entities/`
- **No TypeScript, no linter, no formatter** configured
- **Canvas rendering** — all visuals are drawn procedurally on a `<canvas>` element (no image assets)
- **Vanilla JavaScript** — no frontend framework; DOM manipulation is direct

### File Organization
- One entity class per file in `js/entities/`
- Server logic split into three files: entry point (`index.js`), room management (`GameRoom.js`), game simulation (`GameSimulation.js`)
- Client modules in `js/` root handle cross-cutting concerns (config, input, network, sound, utils)

### Naming
- PascalCase for class names and their file names (e.g., `SquareEnemy.js` → `class SquareEnemy`)
- camelCase for variables, functions, and methods
- Test files named `<Module>.test.js` matching the module they test

### Game State
- All authoritative state is in `GameSimulation` on the server
- Client state is minimal: `playerId`, `roomCode`, HUD display values, high score in `localStorage`
- Entity arrays on the server: `enemies`, `projectiles`, `bombs`, `melees`, `particles`, `messages`, `enemyProjectiles`, `stars`, `powerUps`, `bonfires`, `obstacles`, `scenery`
- Players stored in a `Map<id, {player, input, colorIndex}>`

### Adding New Features
- **New entity type**: Create a class in `js/entities/`, add spawn logic in `GameSimulation.js`, add `serialize()` method, add rendering in `game.js` draw function, add to the appropriate entity array
- **New server event**: Add handler in `server/index.js`, implement in `GameRoom.js`, emit from `GameSimulation.js` or `GameRoom.js`
- **New test**: Create `tests/<Module>.test.js` following the existing IIFE + assert pattern; it will be auto-discovered by `runTests.js`
- **New sound**: Add MP3 to `assets/sounds/`, register in `js/sounds.js`, emit sound name from server in `GameSimulation.js` via `soundEvents` array

### Dependencies
- **express** `^4.21.0` — HTTP server, static file serving
- **socket.io** `^4.7.5` — Real-time WebSocket communication
- No other runtime dependencies. No dev dependencies configured.
