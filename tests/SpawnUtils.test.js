const assert = require('assert');

(async () => {
    const { isClearOfObstacles } = await import('../js/spawnUtils.js');
    const obstacles = [{ x: 0, y: 0, size: 10 }];

    assert.strictEqual(isClearOfObstacles(0, 0, 0, 0, obstacles), false, 'point inside obstacle is not clear');
    assert.strictEqual(isClearOfObstacles(20, 0, 0, 5, obstacles), true, 'point beyond buffer is clear');
    assert.strictEqual(isClearOfObstacles(14, 0, 0, 5, obstacles), false, 'point within buffer is not clear');
    console.log('Spawn utils tests passed');
})();
