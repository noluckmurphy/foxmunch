import Particle from './Particle.js';

export default class Projectile {
    constructor(x, y, vx, vy, size, damage, angle) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.damage = damage;
        this.angle = angle;
        this.initialized = false;
    }

    update(canvas, enemies, player, soundManager, particles) {
        const now = performance.now();
        if (!this.initialized) {
            this.initialized = true;
            this.creationTime = now;
            const angleOffset = (Math.random() - 0.5) * (6 * Math.PI / 180);
            this.angle += angleOffset;
            const baseSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const newSpeed = baseSpeed * 1.7;
            this.initialVx = Math.cos(this.angle) * newSpeed;
            this.initialVy = Math.sin(this.angle) * newSpeed;
            this.vx = this.initialVx;
            this.vy = this.initialVy;
            this.decayRate = Math.random() * 0.19 + 0.01;
        }

        let elapsed = (now - this.creationTime) / 1000;
        let factor = elapsed < 1 ? 1 - this.decayRate * elapsed : 1 - this.decayRate;
        this.vx = this.initialVx * factor;
        this.vy = this.initialVy * factor;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < enemy.size + this.size) {
                if (enemy.type === 'elite' && enemy.shield > 0) {
                    enemy.shield -= this.damage;
                    if (enemy.shield < 0) {
                        enemy.hp += enemy.shield;
                        enemy.shield = 0;
                    }
                } else {
                    enemy.hp -= this.damage;
                }
                if (player) player.shotsHit = (player.shotsHit || 0) + 1;
                if (soundManager) soundManager.play('projectileHit');
                if (enemy.hp <= 0) {
                    if (soundManager) soundManager.play('enemyDeath');
                    let baseScore = 0;
                    if (enemy.type === 'small') baseScore = 10;
                    else if (enemy.type === 'medium') baseScore = 30;
                    else if (enemy.type === 'large') baseScore = 50;
                    else if (enemy.type === 'orbital') baseScore = 5;
                    else if (enemy.type === 'elite') baseScore = 100;
                    if (typeof player.addKillScore === 'function') {
                        player.addKillScore(baseScore);
                    } else {
                        player.score += baseScore;
                    }
                    if (particles) {
                        for (let j = 0; j < 8; j++) {
                            const a = Math.random() * Math.PI * 2;
                            const s = Math.random() * 2 + 1;
                            particles.push(new Particle(enemy.x, enemy.y, Math.cos(a) * s, Math.sin(a) * s, 2, 0.6));
                        }
                    }
                    enemies.splice(i, 1);
                }
                return false;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            return false;
        }

        return true;
    }
}
