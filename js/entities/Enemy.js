import Particle from './Particle.js';

export default class Enemy {
    constructor(x, y, size, hp, speed, damage, type, vx, vy) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.hp = hp;
        this.speed = speed;
        this.damage = damage;
        this.type = type;
        this.vx = vx;
        this.vy = vy;
    }

    update(canvas, _enemyProjectiles = null) {
        this.x += this.vx;
        this.y += this.vy;
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
            count = 18;
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
