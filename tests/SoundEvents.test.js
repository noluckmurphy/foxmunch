const assert = require('assert');

(async () => {
    const { default: GameSimulation } = await import('../server/GameSimulation.js');
    const { default: Enemy } = await import('../js/entities/Enemy.js');
    const { default: Projectile } = await import('../js/entities/Projectile.js');
    const { default: EnemyProjectile } = await import('../js/entities/EnemyProjectile.js');
    const { default: Melee } = await import('../js/entities/Melee.js');
    const { default: Bomb } = await import('../js/entities/Bomb.js');
    const { soundManager, SOUND_EVENT_NAMES } = await import('../js/sounds.js');

    function createSimWithPlayer() {
        const sim = new GameSimulation(400, 400);
        sim.obstacles = [];
        sim.scenery = [];
        sim.enemies = [];
        sim.addPlayer('p1', 'Tester');
        const player = sim.players.get('p1').player;
        player.x = 200;
        player.y = 200;
        player.vx = 0;
        player.vy = 0;
        player.angle = 0;
        player.invulnerableUntil = 0;
        player.shieldTimer = 0;
        return { sim, player };
    }

    function makeEnemy(x, y, hp = 5, damage = 10) {
        return new Enemy(x, y, 10, hp, 0, damage, 'small', 0, 0);
    }

    // --- Player actions emit the original gameplay sounds ---
    {
        const { sim, player } = createSimWithPlayer();

        sim.soundEvents = [];
        sim.playerShoot(player);
        const shootSounds = sim.soundEvents.filter((n) =>
            n === 'projectileShoot' || n === 'criticalProjectileShoot'
        );
        assert.strictEqual(shootSounds.length, 1, 'Shooting should emit a projectile shoot sound');

        sim.soundEvents = [];
        sim.playerMelee(player);
        assert.ok(sim.soundEvents.includes('meleeAttack'), 'Melee should emit meleeAttack');

        sim.soundEvents = [];
        sim.playerBomb(player);
        assert.ok(
            sim.soundEvents.includes('bombDrop'),
            'Bomb drop should emit bombDrop (and criticalBombDrop when crit)'
        );
        assert.ok(
            sim.soundEvents.includes('bombDrop') || sim.soundEvents.includes('criticalBombDrop'),
            'Bomb drop should emit at least one bomb sound'
        );
    }

    // --- Projectile hit + enemy death ---
    {
        const { sim, player } = createSimWithPlayer();
        sim.soundEvents = [];
        const enemy = makeEnemy(player.x, player.y, 1);
        sim.enemies.push(enemy);
        const proj = new Projectile(player.x, player.y, 0, 0, 5, 10, 0);
        proj.ownerId = player.id;
        sim.projectiles.push(proj);
        sim.updateProjectiles();
        assert.ok(sim.soundEvents.includes('projectileHit'), 'Projectile hit should emit projectileHit');
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Killing an enemy with a projectile should emit enemyDeath');
    }

    // --- Melee kill ---
    {
        const { sim, player } = createSimWithPlayer();
        sim.soundEvents = [];
        sim.enemies.push(makeEnemy(player.x + 10, player.y, 1));
        const melee = new Melee(player.x, player.y, 0, 50, 1, false);
        melee.ownerId = player.id;
        sim.melees.push(melee);
        sim.updateMelees();
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Melee kill should emit enemyDeath');
    }

    // --- Bomb kill ---
    {
        const { sim, player } = createSimWithPlayer();
        sim.soundEvents = [];
        sim.enemies.push(makeEnemy(player.x, player.y, 1));
        const bomb = new Bomb(player.x, player.y, false);
        bomb.ownerId = player.id;
        bomb.startTime = performance.now() - 150;
        sim.bombs.push(bomb);
        sim.updateBombs();
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Bomb kill should emit enemyDeath');
    }

    // --- Collision, player hurt, life lost ---
    {
        const { sim, player } = createSimWithPlayer();
        sim.soundEvents = [];
        player.hp = 5;
        player.lives = 2;
        player.invulnerableUntil = 0;
        sim.enemies.push(makeEnemy(player.x + 8, player.y, 100, 10));
        sim.checkCollisions();
        assert.ok(sim.soundEvents.includes('collision'), 'Player-enemy overlap should emit collision');
        assert.ok(sim.soundEvents.includes('playerHurt'), 'Damage should emit playerHurt');
        assert.ok(sim.soundEvents.includes('lifeLost'), 'Dropping to 0 HP with lives remaining should emit lifeLost');
    }

    // --- Fire DOT / leftover 0-HP kill path ---
    {
        const { sim } = createSimWithPlayer();
        sim.soundEvents = [];
        const enemy = makeEnemy(50, 50, 0);
        sim.enemies.push(enemy);
        sim.updateEnemies();
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Enemies dying from DOT/HP<=0 should emit enemyDeath');
        assert.strictEqual(sim.enemies.length, 0, 'Dead enemy should be removed');
    }

    // --- Friendly-fire enemy projectile kill ---
    {
        const { sim } = createSimWithPlayer();
        sim.soundEvents = [];
        sim.enemies.push(makeEnemy(80, 80, 1));
        sim.enemyProjectiles.push(new EnemyProjectile(80, 80, 0, 0, 5, 10));
        sim.updateEnemyProjectiles(1 / 30);
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Friendly-fire kill should emit enemyDeath');
    }

    // --- Collision kill emits enemyDeath ---
    {
        const { sim, player } = createSimWithPlayer();
        sim.soundEvents = [];
        player.hp = 100;
        player.invulnerableUntil = 0;
        sim.enemies.push(makeEnemy(player.x + 8, player.y, 1, 1));
        sim.checkCollisions();
        assert.ok(sim.soundEvents.includes('enemyDeath'), 'Killing an enemy by collision should emit enemyDeath');
    }

    // --- Game over sound is collected and serialized ---
    {
        const { sim, player } = createSimWithPlayer();
        player.alive = false;
        player.lives = 0;
        sim.soundEvents = [];
        sim.endGame();
        assert.ok(sim.soundEvents.includes('gameOver'), 'endGame should emit gameOver');
        const state = sim.serialize();
        assert.ok(Array.isArray(state.soundEvents), 'serialize() should include soundEvents');
        assert.ok(state.soundEvents.includes('gameOver'), 'serialized state should include gameOver');
    }

    // --- Client playback helper uses the same names the server emits ---
    {
        const played = [];
        const originalPlay = soundManager.play.bind(soundManager);
        soundManager.play = (name) => { played.push(name); };

        const required = [
            'projectileShoot', 'projectileHit', 'meleeAttack', 'bombDrop',
            'collision', 'playerHurt', 'enemyDeath', 'lifeLost', 'gameOver'
        ];
        for (const name of required) {
            assert.ok(SOUND_EVENT_NAMES.includes(name), `${name} must be a valid sound event`);
            assert.ok(soundManager.sounds[name], `${name} must be registered on soundManager`);
        }

        soundManager.playSoundEvents(required);
        assert.deepStrictEqual(played, required, 'Client should play every original gameplay sound from received events');

        soundManager.play = originalPlay;
    }

    console.log('SoundEvents tests passed');
})();
