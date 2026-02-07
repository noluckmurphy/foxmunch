/**
 * NetworkClient - Socket.IO client wrapper for multiplayer communication.
 */

export default class NetworkClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.roomCode = null;
        this.connected = false;

        // Callbacks
        this._onGameState = null;
        this._onPlayerJoined = null;
        this._onPlayerLeft = null;
        this._onGameOver = null;
        this._onPauseChanged = null;
        this._onNewGameStarted = null;
        this._onDisconnect = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            // Socket.IO is loaded globally via script tag
            if (typeof io === 'undefined') {
                reject(new Error('Socket.IO not loaded'));
                return;
            }

            this.socket = io();

            this.socket.on('connect', () => {
                this.connected = true;
                this._setupListeners();
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                this.connected = false;
                reject(err);
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                if (this._onDisconnect) this._onDisconnect();
            });
        });
    }

    _setupListeners() {
        this.socket.on('gameState', (state) => {
            if (this._onGameState) this._onGameState(state);
        });

        this.socket.on('playerJoined', (data) => {
            if (this._onPlayerJoined) this._onPlayerJoined(data);
        });

        this.socket.on('playerLeft', (data) => {
            if (this._onPlayerLeft) this._onPlayerLeft(data);
        });

        this.socket.on('gameOver', (data) => {
            if (this._onGameOver) this._onGameOver(data);
        });

        this.socket.on('pauseChanged', (data) => {
            if (this._onPauseChanged) this._onPauseChanged(data);
        });

        this.socket.on('newGameStarted', () => {
            if (this._onNewGameStarted) this._onNewGameStarted();
        });
    }

    createRoom(playerName) {
        return new Promise((resolve, reject) => {
            this.socket.emit('createRoom', { playerName }, (result) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    this.playerId = result.playerId;
                    this.roomCode = result.code;
                    resolve(result);
                }
            });
        });
    }

    joinRoom(code, playerName) {
        return new Promise((resolve, reject) => {
            this.socket.emit('joinRoom', { code, playerName }, (result) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    this.playerId = result.playerId;
                    this.roomCode = result.code;
                    resolve(result);
                }
            });
        });
    }

    sendInput(keys) {
        if (this.socket && this.connected) {
            this.socket.volatile.emit('playerInput', keys);
        }
    }

    togglePause() {
        if (this.socket && this.connected) {
            this.socket.emit('togglePause');
        }
    }

    requestNewGame() {
        if (this.socket && this.connected) {
            this.socket.emit('requestNewGame');
        }
    }

    // Event setters
    onGameState(cb) { this._onGameState = cb; }
    onPlayerJoined(cb) { this._onPlayerJoined = cb; }
    onPlayerLeft(cb) { this._onPlayerLeft = cb; }
    onGameOver(cb) { this._onGameOver = cb; }
    onPauseChanged(cb) { this._onPauseChanged = cb; }
    onNewGameStarted(cb) { this._onNewGameStarted = cb; }
    onDisconnect(cb) { this._onDisconnect = cb; }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.playerId = null;
        this.roomCode = null;
    }
}
