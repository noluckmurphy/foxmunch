const assert = require('assert');

(async () => {
    const { default: Melee } = await import('../js/entities/Melee.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');

    const player = { score: 0 };
    const enemy = new Enemy(20, 0, 5, 5, 0, 1, 'small', 0, 0);
    const enemies = [enemy];
    const melee = new Melee(0, 0, 0, 50, 1);
    // Make sure the melee attack started slightly in the past
    melee.startTime = performance.now() / 1000 - 0.1;

    const result = melee.update(enemies, player);
    assert.strictEqual(result, true, 'Melee should still be active');
    assert.strictEqual(enemies.length, 0, 'Enemy should be removed by melee');
    assert.strictEqual(player.score, 10, 'Score should reflect melee kill');

    // Expire the melee attack
    melee.startTime = performance.now() / 1000 - 2;
    assert.strictEqual(melee.update([], player), false, 'Melee should expire after duration');

    // Test bomb drop chance for large enemy
    const originalRandom = Math.random;
    Math.random = () => 0.1; // ensure drop
    const bigEnemy = new Enemy(20, 0, 5, 5, 0, 1, 'large', 0, 0);
    const enemies2 = [bigEnemy];
    const player2 = { score: 0, bombs: 0 };
    const melee2 = new Melee(0, 0, 0, 50, 1);
    melee2.startTime = performance.now() / 1000 - 0.1;
    melee2.update(enemies2, player2);
    Math.random = originalRandom;
    assert.strictEqual(player2.bombs, 1, 'Large enemy should drop a bomb');

    console.log('Melee tests passed');
})();
