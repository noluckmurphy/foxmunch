const assert = require('assert');

(async () => {
    const { default: Bomb } = await import('../js/entities/Bomb.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');

    const player = { score: 0 };
    const enemy = new Enemy(30, 0, 5, 10, 0, 1, 'small', 0, 0);
    const enemies = [enemy];
    const bomb = new Bomb(0, 0);

    // Pretend the bomb has been active for 100ms so it has a radius
    bomb.startTime = performance.now() - 100;

    const result = bomb.update(enemies, player);
    assert.strictEqual(result, true, 'Bomb should still be active early on');
    assert.strictEqual(enemies.length, 0, 'Enemy should be destroyed by bomb');
    assert.strictEqual(player.score, 10, 'Player score should reflect enemy kill');

    console.log('Bomb tests passed');
})();
