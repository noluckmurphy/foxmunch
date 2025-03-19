class SoundManager {
    constructor() {
        this.sounds = {
            projectileShoot: new Audio('../assets/sounds/projectile_shoot.mp3'),
            criticalProjectileShoot: new Audio('../assets/sounds/critical_projectile_shoot.mp3'),
            projectileHit: new Audio('../assets/sounds/projectile_hit.mp3'),
            meleeAttack: new Audio('../assets/sounds/melee_attack.mp3'),
            collision: new Audio('../assets/sounds/collision.mp3'),
            bombDrop: new Audio('../assets/sounds/bomb_drop.mp3'),
            criticalBombDrop: new Audio('../assets/sounds/critical_bomb_drop.mp3'),
            playerHurt: new Audio('../assets/sounds/player_hurt.mp3'),
            enemyDeath: new Audio('../assets/sounds/enemy_death.mp3'),
            lifeLost: new Audio('../assets/sounds/life_lost.mp3'), 
            gameOver: new Audio('../assets/sounds/game_over.mp3'), 
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
            sound.play().catch(e => console.log("Error playing sound:", e));
        }
    }
}

export const soundManager = new SoundManager();
