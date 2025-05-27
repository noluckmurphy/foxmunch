const assert = require('assert');

(async () => {
    const { default: Enemy } = await import('../js/entities/Enemy.js');

    const canvas = { width: 100, height: 100 };
    const enemy = new Enemy(50, 50, 10, 10, 1, 1, 'small', 1, 1);

    // Update should move the enemy and stay within bounds
    let result = enemy.update(canvas);
    assert.strictEqual(enemy.x, 51, 'Enemy x should increase by vx');
    assert.strictEqual(enemy.y, 51, 'Enemy y should increase by vy');
    assert.strictEqual(result, true, 'Enemy should remain active inside canvas');

    // Force enemy outside of bounds
    enemy.x = canvas.width + enemy.size + 1;
    result = enemy.update(canvas);
    assert.strictEqual(result, false, 'Enemy should be inactive when leaving canvas');

    console.log('Enemy tests passed');
})();
