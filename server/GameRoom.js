/**
 * GameRoom - Manages multiplayer game rooms with text code system.
 *
 * Each room has a unique 4-character code, a GameSimulation instance,
 * and a game loop running at the server tick rate.
 */

import GameSimulation from './GameSimulation.js';
import { SERVER_TICK_RATE, MAX_PLAYERS, PLAYER_COLORS } from '../js/config.js';

// Room codes: letters only, case-insensitive (normalized to lowercase)
const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz';

function generateCode(existingCodes) {
    let code;
    let attempts = 0;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        attempts++;
    } while (existingCodes.has(code) && attempts < 1000);
    return code;
}

export default class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // code -> room
    }

    createRoom(socket, playerName, options = {}) {
        const code = generateCode(new Set(this.rooms.keys()));
        const rouletteConfig = options.rouletteConfig || null;
        const simulation = new GameSimulation(undefined, undefined, rouletteConfig);

        const room = {
            code,
            simulation,
            rouletteConfig,
            sockets: new Map(), // socketId -> { socket, playerId }
            loop: null,
            lastTickTime: performance.now()
        };

        // Add host player
        const { colorIndex, color } = simulation.addPlayer(socket.id, playerName);

        room.sockets.set(socket.id, { socket, playerId: socket.id, playerName });
        socket.join(code);

        this.rooms.set(code, room);

        // Start game loop
        this.startGameLoop(room);

        return { code, playerId: socket.id, colorIndex, color };
    }

    joinRoom(code, socket, playerName) {
        const normalizedCode = code.toLowerCase().trim().replace(/[^a-z]/g, '');
        if (normalizedCode.length !== 4) {
            return { error: 'Invalid room code. Use 4 letters.' };
        }
        const room = this.rooms.get(normalizedCode);

        if (!room) {
            return { error: 'Room not found. Check the code and try again.' };
        }

        if (room.sockets.size >= MAX_PLAYERS) {
            return { error: 'Room is full (max 4 players).' };
        }

        if (!room.simulation.gameRunning) {
            // Game has ended: allow rejoin so players can stay in room and use Play Again
            const colorIndex = room.sockets.size % PLAYER_COLORS.length;
            const color = PLAYER_COLORS[colorIndex];
            room.sockets.set(socket.id, { socket, playerId: socket.id, playerName });
            socket.join(normalizedCode);
            this.io.to(socket.id).emit('gameState', room.simulation.serialize());
            return {
                code: normalizedCode,
                playerId: socket.id,
                colorIndex,
                color,
                playerCount: room.sockets.size,
                gameEnded: true,
                gameOverData: room.simulation.gameOverData
            };
        }

        // Add player to simulation
        const { colorIndex, color } = room.simulation.addPlayer(socket.id, playerName);

        room.sockets.set(socket.id, { socket, playerId: socket.id, playerName });
        socket.join(normalizedCode);

        // Notify existing players
        socket.to(normalizedCode).emit('playerJoined', {
            playerId: socket.id,
            name: playerName,
            color,
            playerCount: room.sockets.size
        });

        return {
            code: normalizedCode,
            playerId: socket.id,
            colorIndex,
            color,
            playerCount: room.sockets.size
        };
    }

    leaveRoom(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                const entry = room.sockets.get(socketId);
                room.sockets.delete(socketId);
                room.simulation.removePlayer(socketId);

                // Notify remaining players
                this.io.to(code).emit('playerLeft', {
                    playerId: socketId,
                    playerCount: room.sockets.size
                });

                // If room is empty, clean up
                if (room.sockets.size === 0) {
                    this.destroyRoom(code);
                }

                return code;
            }
        }
        return null;
    }

    handleInput(socketId, keys) {
        for (const [, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                room.simulation.setPlayerInput(socketId, keys);
                return;
            }
        }
    }

    handlePause(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                room.simulation.gamePaused = !room.simulation.gamePaused;
                this.io.to(code).emit('pauseChanged', {
                    paused: room.simulation.gamePaused,
                    pausedBy: socketId
                });
                return;
            }
        }
    }

    handleUpdateRouletteConfig(socketId, config) {
        for (const [, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                room.rouletteConfig = config || null;
                room.simulation.setRouletteConfig(config || {});
                return;
            }
        }
    }

    handleNewGame(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                if (room.simulation.gameRunning) return;
                // Stop old loop
                if (room.loop) clearInterval(room.loop);

                // Create new simulation, re-add all players (keep roulette config)
                room.simulation = new GameSimulation(undefined, undefined, room.rouletteConfig);
                room.lastTickTime = performance.now();

                for (const [sid, entry] of room.sockets) {
                    room.simulation.addPlayer(sid, entry.playerName || 'Player');
                }

                // Restart loop
                this.startGameLoop(room);

                this.io.to(code).emit('newGameStarted');
                return;
            }
        }
    }

    startGameLoop(room) {
        const tickInterval = 1000 / SERVER_TICK_RATE;
        room.lastTickTime = performance.now();

        room.loop = setInterval(() => {
            const now = performance.now();
            const deltaTime = (now - room.lastTickTime) / 1000;
            room.lastTickTime = now;

            room.simulation.tick(deltaTime);

            const state = room.simulation.serialize();
            this.io.to(room.code).emit('gameState', state);

            // If game over, send final event and stop loop
            if (room.simulation.gameOverData) {
                this.io.to(room.code).emit('gameOver', room.simulation.gameOverData);
                clearInterval(room.loop);
                room.loop = null;
            }
        }, tickInterval);
    }

    destroyRoom(code) {
        const room = this.rooms.get(code);
        if (room) {
            if (room.loop) clearInterval(room.loop);
            this.rooms.delete(code);
        }
    }

    getRoomForSocket(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.sockets.has(socketId)) {
                return { code, room };
            }
        }
        return null;
    }
}
