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

    update(canvas, enemyProjectiles, player) {
        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.chargeRadius) {
                const angle = Math.atan2(dy, dx);
                this.vx = Math.cos(angle) * this.chargeSpeed;
                this.vy = Math.sin(angle) * this.chargeSpeed;
            }
        }
        return super.update(canvas, enemyProjectiles);
    }
}
