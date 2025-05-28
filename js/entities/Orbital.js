import Enemy from './Enemy.js';
import EnemyProjectile from './EnemyProjectile.js';

export default class Orbital extends Enemy {
    constructor(parent, angle) {
        super(parent.x, parent.y, 10, 3, 0, 1, 'orbital', 0, 0);
        this.parent = parent;
        this.angle = angle;
        this.radius = parent.size + 20;
        this.rotationSpeed = 0.03;
        this.shotCooldown = 0.5; // seconds
        this.lastShot = performance.now() / 1000;
    }

    update(canvas, enemyProjectiles) {
        this.angle += this.rotationSpeed;
        this.x = this.parent.x + Math.cos(this.angle) * this.radius;
        this.y = this.parent.y + Math.sin(this.angle) * this.radius;

        const now = performance.now() / 1000;
        if (enemyProjectiles && now - this.lastShot > this.shotCooldown) {
            const count = 8;
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2;
                const speed = 2;
                enemyProjectiles.push(new EnemyProjectile(
                    this.x,
                    this.y,
                    Math.cos(a) * speed,
                    Math.sin(a) * speed,
                    3,
                    3
                ));
            }
            this.lastShot = now;
        }
        return this.hp > 0 && this.parent.hp > 0;
    }
}
