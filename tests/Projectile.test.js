const assert = require('assert');

(async () => {
    const { default: Projectile } = await import('../js/entities/Projectile.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');

    const canvas = { width: 100, height: 100 };
    const player = { score: 0 };
    const enemy = new Enemy(0, 0, 10, 5, 0, 1, 'small', 0, 0);
    const enemies = [enemy];
    // Use zero starting velocity so the projectile begins inside the enemy
    const projectile = new Projectile(0, 0, 0, 0, 5, 10, 0);

    const result = projectile.update(canvas, enemies, player, null);
    assert.strictEqual(result, false, 'Projectile should be removed after hit');
    assert.strictEqual(enemies.length, 0, 'Enemy should be removed when killed');
    assert.strictEqual(player.score, 10, 'Score should increase by 10 for small enemy');

    console.log('Projectile tests passed');
})();
