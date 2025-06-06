const assert = require('assert');

(async () => {
    const { default: Player } = await import('../js/entities/Player.js');
    const { default: Projectile } = await import('../js/entities/Projectile.js');
    const { default: Melee } = await import('../js/entities/Melee.js');
    const { default: Bomb } = await import('../js/entities/Bomb.js');
    const { PLAYER_DEFAULTS } = await import('../js/config.js');

    const player = new Player(0, 0);
    const projectiles = [];
    const melees = [];
    const bombs = [];

    assert.strictEqual(player.acorns, PLAYER_DEFAULTS.acorns, 'Player acorn default');
    assert.strictEqual(player.bombs, PLAYER_DEFAULTS.bombs, 'Player bomb default');
    assert.strictEqual(player.lives, PLAYER_DEFAULTS.lives, 'Player lives default');

    // Test shootProjectile
    player.shootProjectile(projectiles, null);
    assert.strictEqual(projectiles.length, 1, 'shootProjectile should add a projectile');
    assert.ok(projectiles[0] instanceof Projectile, 'Projectile should be instance of Projectile');
    assert.strictEqual(
        player.acorns,
        PLAYER_DEFAULTS.acorns - 1,
        'Acorn count should decrease'
    );
    assert.strictEqual(player.shotsFired, 1, 'shotsFired should increment');
    const cooldownAfterShoot = player.projectileCooldown;
    player.shootProjectile(projectiles, null);
    assert.strictEqual(projectiles.length, 1, 'Should not fire while on cooldown');
    assert.strictEqual(player.projectileCooldown, cooldownAfterShoot, 'Cooldown should not change when firing too soon');
    assert.strictEqual(player.shotsFired, 1, 'shotsFired should not increment when on cooldown');

    // Reset cooldown for next tests
    player.projectileCooldown = 0;

    // Test performMeleeAttack
    player.performMeleeAttack(melees, null);
    assert.strictEqual(melees.length, 1, 'performMeleeAttack should add a melee attack');
    assert.ok(melees[0] instanceof Melee, 'Melee attack should be instance of Melee');
    const meleeCooldown = player.meleeCooldown;
    player.performMeleeAttack(melees, null);
    assert.strictEqual(melees.length, 1, 'Should not attack while on cooldown');
    assert.strictEqual(player.meleeCooldown, meleeCooldown, 'Cooldown should not change when attacking too soon');

    // Reset cooldown
    player.meleeCooldown = 0;

    // Test dropBomb
    player.dropBomb(bombs, null);
    assert.strictEqual(bombs.length, 1, 'dropBomb should add a bomb');
    assert.ok(bombs[0] instanceof Bomb, 'Bomb should be instance of Bomb');
    assert.strictEqual(
        player.bombs,
        PLAYER_DEFAULTS.bombs - 1,
        'Bomb count should decrease'
    );
    const bombCooldown = player.bombCooldown;
    player.dropBomb(bombs, null);
    assert.strictEqual(bombs.length, 1, 'Should not drop bomb while on cooldown');
    assert.strictEqual(player.bombCooldown, bombCooldown, 'Cooldown should not change when dropping too soon');

    console.log('Player tests passed');
})();
