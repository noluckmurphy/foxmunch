/**
 * Fox Munch Multiplayer Server
 *
 * Express serves static files, Socket.IO handles real-time game communication.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RoomManager from './GameRoom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

// Serve static files from the project root
app.use(express.static(projectRoot));

// Serve foxmunch.html as the default page
app.get('/', (req, res) => {
    res.sendFile(join(projectRoot, 'foxmunch.html'));
});

// Room manager
const roomManager = new RoomManager(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new game room
    socket.on('createRoom', ({ playerName }, callback) => {
        const result = roomManager.createRoom(socket, playerName || 'Player');
        console.log(`Room created: ${result.code} by ${playerName}`);
        callback(result);
    });

    // Join an existing room
    socket.on('joinRoom', ({ code, playerName }, callback) => {
        const result = roomManager.joinRoom(code, socket, playerName || 'Player');
        if (result.error) {
            console.log(`Join failed: ${result.error}`);
        } else {
            console.log(`${playerName} joined room ${result.code}`);
        }
        callback(result);
    });

    // Player input
    socket.on('playerInput', (keys) => {
        roomManager.handleInput(socket.id, keys);
    });

    // Pause toggle
    socket.on('togglePause', () => {
        roomManager.handlePause(socket.id);
    });

    // Request new game in same room (after game over)
    socket.on('requestNewGame', () => {
        roomManager.handleNewGame(socket.id);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        roomManager.leaveRoom(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Fox Munch server running at http://localhost:${PORT}`);
});
