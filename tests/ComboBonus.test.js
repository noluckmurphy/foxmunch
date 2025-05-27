const assert = require('assert');

(async () => {
    const { default: Player } = await import('../js/entities/Player.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');
    const { default: Projectile } = await import('../js/entities/Projectile.js');

    const canvas = { width: 100, height: 100 };
    const player = new Player(0, 0);
    const enemies = [
        new Enemy(0, 0, 5, 5, 0, 1, 'small', 0, 0),
        new Enemy(0, 0, 5, 5, 0, 1, 'small', 0, 0)
    ];

    let p1 = new Projectile(0, 0, 0, 0, 1, 10, 0);
    p1.update(canvas, enemies, player, null);
    const scoreAfterFirst = player.score;

    let p2 = new Projectile(0, 0, 0, 0, 1, 10, 0);
    p2.update(canvas, enemies, player, null);
    const scoreAfterSecond = player.score;

    assert.ok(
        scoreAfterSecond > scoreAfterFirst + 10,
        'Combo bonus should be applied for quick consecutive kills'
    );

    console.log('Combo bonus tests passed');
})();
