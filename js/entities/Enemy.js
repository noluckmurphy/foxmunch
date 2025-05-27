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
