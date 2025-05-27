const assert = require('assert');

(async () => {
    const { default: Player } = await import('../js/entities/Player.js');

    let gameOver;
    try {
        const mod = await import('../js/game.js');
        gameOver = mod.gameOver || mod.default || mod;
    } catch (err) {
        throw err;
    }

    assert.strictEqual(typeof gameOver, 'function', 'gameOver should be a function');

    const player = new Player(0, 0);
    player.score = 100;
    localStorage.clear();

    gameOver(player);
    assert.strictEqual(localStorage.getItem('highScore'), '100', 'High score should be saved');

    player.score = 50;
    gameOver(player);
    assert.strictEqual(localStorage.getItem('highScore'), '100', 'High score should persist when score is lower');

    console.log('High score persistence tests passed');
})();
