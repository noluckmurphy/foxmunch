const assert = require('assert');

(async () => {
    const { default: ChargingEnemy } = await import('../js/entities/ChargingEnemy.js');
    const canvas = { width: 200, height: 200 };
    const enemy = new ChargingEnemy(0, 0, 1, 0, 50);
    const farPlayer = { x: 150, y: 150 };
    const nearPlayer = { x: 10, y: 0 };
    const before = enemy.vx;
    enemy.update(canvas, null, farPlayer);
    assert.strictEqual(enemy.vx, before, 'Speed should stay same when far');
    enemy.update(canvas, null, nearPlayer);
    assert.notStrictEqual(enemy.vx, before, 'Speed should change when charging');
    console.log('ChargingEnemy tests passed');
})();
