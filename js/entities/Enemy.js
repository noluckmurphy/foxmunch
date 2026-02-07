import Particle from './Particle.js';

export default class Enemy {
    constructor(x, y, size, hp, speed, damage, type, vx, vy, shape = 'circle') {
        this.x = x;
        this.y = y;
        this.size = size;
        this.hp = hp;
        this.speed = speed;
        this.damage = damage;
        this.type = type;
        this.vx = vx;
        this.vy = vy;
        this.shape = shape;

        // World bonus support
        this.speedMultiplier = 1;   // Freeze bonus sets this low
        this.frozen = false;        // Freeze bonus can fully stop an enemy
        this.fireDOT = 0;          // Fire bonus passive damage per second
        this.baseVx = vx;          // store original velocities for restore
        this.baseVy = vy;
    }

    update(canvas, _enemyProjectiles = null, _player = null, dt = 0) {
        // Apply fire DOT (passive burn on all enemies during Fire bonus)
        if (this.fireDOT > 0 && dt > 0) {
            this.hp -= this.fireDOT * dt;
        }

        // Movement with freeze / slow support
        if (this.frozen) {
            // completely stopped – don't move
        } else {
            this.x += this.vx * this.speedMultiplier;
            this.y += this.vy * this.speedMultiplier;
        }
        if (
            this.x < -this.size ||
            this.x > canvas.width + this.size ||
            this.y < -this.size ||
            this.y > canvas.height + this.size
        ) {
            return false;
        }
        return true;
    }
}

export function spawnDeathParticles(enemy, particles) {
    if (!particles) return;
    let count;
    switch (enemy.type) {
        case 'small':
            count = 8;
            break;
        case 'medium':
            count = 12;
            break;
        case 'large':
        case 'square_large':
            count = 18;
            break;
        case 'square_medium':
        case 'medium':
            count = 12;
            break;
        case 'square_small':
        case 'small':
            count = 8;
            break;
        default:
            count = 8;
    }
    for (let j = 0; j < count; j++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 3 + 1;
        particles.push(new Particle(enemy.x, enemy.y, Math.cos(a) * s, Math.sin(a) * s, 2, 0.6));
    }
}
