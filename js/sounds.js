class SoundManager {
    constructor() {
        const AudioCtor = typeof Audio !== 'undefined' ? Audio : function () { return { play() {}, load() {} }; };
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
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0; // Reset sound to start
            const res = sound.play();
            if (res && typeof res.catch === 'function') {
                res.catch(e => console.log("Error playing sound:", e));
            }
        }
    }
}

export const soundManager = new SoundManager();
