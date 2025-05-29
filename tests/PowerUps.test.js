const assert = require('assert');

(async () => {
    const { default: ShieldPowerUp } = await import('../js/entities/ShieldPowerUp.js');
    const { default: RapidFirePowerUp } = await import('../js/entities/RapidFirePowerUp.js');
    const { default: SpeedBoostPowerUp } = await import('../js/entities/SpeedBoostPowerUp.js');
    const { SHIELD_DURATION, POWERUP_DURATION } = await import('../js/entities/Player.js');

    const player = { x: 0, y: 0, size: 10, shieldTimer: 0, rapidFireTimer: 0, speedBoostTimer: 0 };

    let pu = new ShieldPowerUp(0, 0, 1);
    pu.update(0.016, player);
    assert.strictEqual(player.shieldTimer, SHIELD_DURATION, 'Shield timer should be set');

    pu = new RapidFirePowerUp(0, 0, 1);
    pu.update(0.016, player);
    assert.strictEqual(player.rapidFireTimer, POWERUP_DURATION, 'Rapid fire timer should be set');

    pu = new SpeedBoostPowerUp(0, 0, 1);
    pu.update(0.016, player);
    assert.strictEqual(player.speedBoostTimer, POWERUP_DURATION, 'Speed boost timer should be set');

    console.log('Power-up tests passed');
})();
