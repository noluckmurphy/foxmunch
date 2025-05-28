const assert = require('assert');

(async () => {
    const { soundManager } = await import('../js/sounds.js');

    // set volume and ensure all sounds updated
    soundManager.setVolume(0.3);
    const sounds = Object.values(soundManager.sounds);
    assert.ok(sounds.length > 0, 'SoundManager should have sounds');
    for (const snd of sounds) {
        assert.strictEqual(snd.volume, 0.3, 'Volume should be set on sound objects');
    }

    console.log('SoundManager tests passed');
})();
