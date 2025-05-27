import Projectile from './Projectile.js';
import Bomb from './Bomb.js';
import Melee from './Melee.js';

export default class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 20;
        this.color = '#FFA500';
        this.angle = 0;
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 4;
        this.acceleration = 0.2;
        this.deceleration = 0.05;
        this.hp = 100;
        this.acorns = 100;
        this.bombs = 5;
        this.lives = 3;
        this.score = 0;
        this.lastKillTime = 0;
        this.comboMultiplier = 1;
        this.meleeCooldown = 0;
        this.projectileCooldown = 0;
        this.bombCooldown = 0;
    }

    update(input, deltaTime, canvas, projectiles, melees, bombs, soundManager) {
        let dx = 0;
        let dy = 0;
        if (input.isPressed('arrowup')) dy -= 1;
        if (input.isPressed('arrowdown')) dy += 1;
        if (input.isPressed('arrowleft')) dx -= 1;
        if (input.isPressed('arrowright')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const direction = Math.atan2(dy, dx);
            this.angle = direction;

            this.vx += Math.cos(direction) * this.acceleration;
            this.vy += Math.sin(direction) * this.acceleration;

            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > this.maxSpeed) {
                this.vx *= this.maxSpeed / speed;
                this.vy *= this.maxSpeed / speed;
            }
        } else {
            this.vx *= (1 - this.deceleration);
            this.vy *= (1 - this.deceleration);
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        if (input.isPressed(' ')) {
            this.shootProjectile(projectiles, soundManager);
        }
        if (input.isPressed('f')) {
            this.performMeleeAttack(melees, soundManager);
        }
        if (input.isPressed('s')) {
            this.dropBomb(bombs, soundManager);
        }

        if (this.projectileCooldown > 0) this.projectileCooldown -= deltaTime;
        if (this.meleeCooldown > 0) this.meleeCooldown -= deltaTime;
        if (this.bombCooldown > 0) this.bombCooldown -= deltaTime;
    }

    shootProjectile(projectiles, soundManager) {
        if (this.projectileCooldown <= 0 && this.acorns > 0) {
            const isCritical = Math.random() < (1 / 15);
            const baseSpeed = 7;
            const projectileSpeed = isCritical ? baseSpeed * 2 : baseSpeed;
            const baseSize = 5;
            const projectileSize = isCritical ? baseSize * 2 : baseSize;
            const damage = isCritical ? 9 : 3;

            const projectile = new Projectile(
                this.x + Math.cos(this.angle) * this.size,
                this.y + Math.sin(this.angle) * this.size,
                Math.cos(this.angle) * projectileSpeed,
                Math.sin(this.angle) * projectileSpeed,
                projectileSize,
                damage,
                this.angle
            );
            projectiles.push(projectile);
            if (soundManager)
                soundManager.play(isCritical ? 'criticalProjectileShoot' : 'projectileShoot');
            this.projectileCooldown = 0.05;
            this.acorns--;
        }
    }

    performMeleeAttack(melees, soundManager) {
        if (this.meleeCooldown <= 0) {
            melees.push(new Melee(this.x, this.y, this.angle));
            if (soundManager) soundManager.play('meleeAttack');
            this.meleeCooldown = 0.5;
        }
    }

    dropBomb(bombs, soundManager) {
        if (this.bombCooldown <= 0 && this.bombs > 0) {
            const isCritical = Math.random() < (1 / 6);
            bombs.push(
                new Bomb(
                    this.x - Math.cos(this.angle) * this.size,
                    this.y - Math.sin(this.angle) * this.size,
                    isCritical
                )
            );
            if (soundManager) {
                if (isCritical) soundManager.play('criticalBombDrop');
                soundManager.play('bombDrop');
            }
            this.bombCooldown = 3;
            this.bombs--;
        }
    }

    addKillScore(baseScore) {
        const now = performance.now() / 1000;
        if (now - this.lastKillTime <= 3) {
            this.comboMultiplier += 1;
        } else {
            this.comboMultiplier = 1;
        }
        this.lastKillTime = now;
        this.score += baseScore * this.comboMultiplier;
    }
}
