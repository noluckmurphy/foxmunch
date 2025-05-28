const assert = require('assert');

(async () => {
    const { default: Star } = await import('../js/entities/Star.js');
    const player = { x: 0, y: 0, size: 10, acorns: 0 };
    const star = new Star(0, 0, 5);
    const stillActive = star.update(0.016, player);
    assert.strictEqual(player.acorns, 10, 'Player should gain acorns on pickup');
    assert.strictEqual(stillActive, false, 'Star should expire after being collected');
    console.log('Star tests passed');
})();
