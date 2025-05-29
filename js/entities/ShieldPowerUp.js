import { SHIELD_DURATION } from "./Player.js";
export default class ShieldPowerUp {
    constructor(x, y, life = 5 + Math.random() * 3) {
        this.x = x;
        this.y = y;
        this.size = 8;
        this.life = life;
    }

    update(deltaTime, player) {
        this.life -= deltaTime;
        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.size + player.size) {
                if (typeof player.shieldTimer === 'number') {
                    player.shieldTimer = SHIELD_DURATION;
                }
                this.life = 0;
            }
        }
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.font = `${this.size * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', this.x, this.y);
        ctx.restore();
    }
}
