class SoundManager {
    constructor() {
        const AudioCtor = typeof Audio !== 'undefined' ? Audio : function () { return { play() {}, load() {}, volume: 1 }; };
        this.sounds = {
            projectileShoot: new AudioCtor('../assets/sounds/projectile_shoot.mp3'),
            criticalProjectileShoot: new AudioCtor('../assets/sounds/critical_projectile_shoot.mp3'),
            projectileHit: new AudioCtor('../assets/sounds/projectile_hit.mp3'),
            meleeAttack: new AudioCtor('../assets/sounds/melee_attack.mp3'),
            collision: new AudioCtor('../assets/sounds/collision.mp3'),
            bombDrop: new AudioCtor('../assets/sounds/bomb_drop.mp3'),
            criticalBombDrop: new AudioCtor('../assets/sounds/critical_bomb_drop.mp3'),
            playerHurt: new AudioCtor('../assets/sounds/player_hurt.mp3'),
            enemyDeath: new AudioCtor('../assets/sounds/enemy_death.mp3'),
            lifeLost: new AudioCtor('../assets/sounds/life_lost.mp3'),
            gameOver: new AudioCtor('../assets/sounds/game_over.mp3'),
        };

        // Pre-load all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.load();
        });

        this.volume = 1;
    }

    setVolume(level) {
        this.volume = Math.max(0, Math.min(level, 1));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (!sound) return;
        // Use a clone so the same sound can play overlapping (e.g. multiple enemy deaths)
        // and so we don't rely on resetting one element which can be ignored by the browser
        const clone = typeof sound.cloneNode === 'function' ? sound.cloneNode() : sound;
        clone.volume = this.volume;
        clone.currentTime = 0;
        const res = clone.play();
        if (res && typeof res.catch === 'function') {
            res.catch(() => {});
        }
    }
}

export const soundManager = new SoundManager();
