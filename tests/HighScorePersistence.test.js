const assert = require('assert');

(async () => {
    const { default: Player } = await import('../js/entities/Player.js');

    let highScore = 0;
    function updateHighScore(score) {
        if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) return;
        if (typeof highScore !== 'number' || isNaN(highScore) || !isFinite(highScore)) highScore = 0;
        if (score > highScore) {
            highScore = score;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('highScore', Math.floor(highScore));
            }
        }
    }

    const player = new Player(0, 0);
    player.score = 100;
    localStorage.clear();

    updateHighScore(player.score);
    assert.strictEqual(localStorage.getItem('highScore'), '100', 'High score should be saved');

    player.score = 50;
    updateHighScore(player.score);
    assert.strictEqual(localStorage.getItem('highScore'), '100', 'High score should persist when score is lower');

    console.log('High score persistence tests passed');
})();
