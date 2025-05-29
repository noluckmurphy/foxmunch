const assert = require('assert');

(async () => {
    const { default: SquareEnemy } = await import('../js/entities/SquareEnemy.js');

    const enemies = [];
    const large = new SquareEnemy(0, 0, 'large');
    SquareEnemy.split(large, enemies);
    assert.strictEqual(enemies.length, 2, 'Large square should split into two');
    assert.ok(enemies[0] instanceof SquareEnemy, 'Children should be SquareEnemy');
    assert.strictEqual(enemies[0].stage, 'medium', 'Children should be medium');

    enemies.length = 0;
    const medium = new SquareEnemy(0, 0, 'medium');
    SquareEnemy.split(medium, enemies);
    assert.strictEqual(enemies.length, 2, 'Medium square should split into two');
    assert.strictEqual(enemies[0].stage, 'small', 'Grandchildren should be small');

    enemies.length = 0;
    const small = new SquareEnemy(0, 0, 'small');
    SquareEnemy.split(small, enemies);
    assert.strictEqual(enemies.length, 0, 'Small squares should not split');

    console.log('SquareEnemy tests passed');
})();
