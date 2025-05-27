const assert = require('assert');

(async () => {
    const { default: Player } = await import('../js/entities/Player.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');
    const { default: Projectile } = await import('../js/entities/Projectile.js');

    const canvas = { width: 100, height: 100 };
    const player = new Player(0, 0);
    const projectiles = [];
    const enemies = [new Enemy(0, 0, 5, 1, 0, 1, 'small', 0, 0)];

    player.shootProjectile(projectiles, null);
    assert.strictEqual(
        player.shotsFired,
        1,
        'shotsFired counter should increment when a projectile is fired'
    );

    projectiles[0].update(canvas, enemies, player, null);
    assert.strictEqual(
        player.shotsHit,
        1,
        'shotsHit counter should increment when a projectile hits'
    );

    console.log('Accuracy counter tests passed');
})();
