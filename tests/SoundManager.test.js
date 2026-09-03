const assert = require('assert');

(async () => {
    const { soundManager, SOUND_EVENT_NAMES } = await import('../js/sounds.js');

    // set volume and ensure all sounds updated
    soundManager.setVolume(0.3);
    const sounds = Object.values(soundManager.sounds);
    assert.ok(sounds.length > 0, 'SoundManager should have sounds');
    for (const snd of sounds) {
        assert.strictEqual(snd.volume, 0.3, 'Volume should be set on sound objects');
    }

    assert.ok(SOUND_EVENT_NAMES.includes('enemyDeath'), 'SOUND_EVENT_NAMES should list enemyDeath');
    assert.ok(SOUND_EVENT_NAMES.includes('gameOver'), 'SOUND_EVENT_NAMES should list gameOver');

    const played = [];
    const originalPlay = soundManager.play.bind(soundManager);
    soundManager.play = (name) => { played.push(name); };

    soundManager.playSoundEvents(['projectileShoot', 'unknownSound', 'enemyDeath']);
    assert.deepStrictEqual(
        played,
        ['projectileShoot', 'unknownSound', 'enemyDeath'],
        'playSoundEvents should forward each named event to play()'
    );

    played.length = 0;
    soundManager.playSoundEvents(null);
    soundManager.playSoundEvents(undefined);
    assert.deepStrictEqual(played, [], 'playSoundEvents should ignore non-arrays');

    soundManager.play = originalPlay;

    console.log('SoundManager tests passed');
})();
