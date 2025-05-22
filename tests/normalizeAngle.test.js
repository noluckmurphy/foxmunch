const assert = require('assert');

(async () => {
    const { normalizeAngle } = await import('../js/utils.js');

    assert.strictEqual(normalizeAngle(2 * Math.PI), 0, '2π should normalize to 0');
    assert.strictEqual(normalizeAngle(-3 * Math.PI), -Math.PI, '-3π should normalize to -π');

    console.log('All tests passed');
})();
