export default class EnemyProjectile {
    constructor(x, y, vx, vy, size, damage) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.damage = damage;
    }

    update(canvas) {
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
