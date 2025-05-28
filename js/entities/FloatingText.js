export default class FloatingText {
    constructor(x, y, text, duration = 1) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.duration = duration;
        this.life = duration;
    }

    update(deltaTime) {
        this.y -= 20 * deltaTime; // move upward slightly
        this.life -= deltaTime;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = Math.max(this.life / this.duration, 0);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}
