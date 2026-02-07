import Enemy from './Enemy.js';

export default class ChargingEnemy extends Enemy {
    constructor(x, y, vx, vy, chargeRadius = 150) {
        const size = 25;
        const hp = 10;
        const damage = 8;
        const speed = Math.sqrt(vx * vx + vy * vy);
        super(x, y, size, hp, speed, damage, 'charging', vx, vy, 'triangle');
        this.chargeRadius = chargeRadius;
        this.baseSpeed = speed;
        this.chargeSpeed = speed * 2.5;
    }

    update(canvas, enemyProjectiles, player, dt = 0) {
        // player can be a single player or an array of players
        const targets = Array.isArray(player) ? player : (player ? [player] : []);
        if (!this.frozen && targets.length > 0) {
            // Find nearest alive player
            let nearest = null;
            let nearestDist = Infinity;
            for (const p of targets) {
                if (p.alive === false) continue;
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = p;
                }
            }
            if (nearest && nearestDist < this.chargeRadius) {
                const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                this.vx = Math.cos(angle) * this.chargeSpeed;
                this.vy = Math.sin(angle) * this.chargeSpeed;
            }
        }
        return super.update(canvas, enemyProjectiles, player, dt);
    }
}
