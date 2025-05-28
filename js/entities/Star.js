export default class Star {
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
                if (typeof player.acorns === 'number') {
                    player.acorns = Math.min(player.acorns + 10, 100);
                }
                this.life = 0;
            }
        }
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        const points = 5;
        for (let i = 0; i < points; i++) {
            const outerAngle = (i * 2 * Math.PI) / points - Math.PI / 2;
            const innerAngle = outerAngle + Math.PI / points;
            const outerX = this.x + Math.cos(outerAngle) * this.size;
            const outerY = this.y + Math.sin(outerAngle) * this.size;
            const innerX = this.x + Math.cos(innerAngle) * (this.size / 2);
            const innerY = this.y + Math.sin(innerAngle) * (this.size / 2);
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
