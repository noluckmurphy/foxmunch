import Particle from './Particle.js';

/**
 * Bonfire – spawned during the Fire world bonus.
 *
 * Enemies within `radius` take damage-over-time proportional to proximity
 * (maximum at the centre, falling off linearly to zero at the edge).
 * The player is immune.
 */
export default class Bonfire {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} radius   – damage zone radius (default 80)
     * @param {number} maxDOT   – damage per second at the centre (default 10)
     */
    constructor(x, y, radius = 80, maxDOT = 10) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.maxDOT = maxDOT;
        this.size = 14; // visual core size
        this.time = 0;  // running clock for animation
    }

    /**
     * @param {number} dt – deltaTime in seconds
     * @param {Array} enemies
     * @param {Array} particles – push fire particles here
     * @returns {boolean} always true (removed externally when bonus ends)
     */
    update(dt, enemies, particles) {
        this.time += dt;

        // Apply DOT to nearby enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dx = e.x - this.x;
            const dy = e.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius + e.size) {
                const proximity = Math.max(0, 1 - dist / this.radius);
                e.hp -= this.maxDOT * proximity * dt;
            }
        }

        // Emit fire particles occasionally
        if (particles && Math.random() < 0.4) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1.5 + 0.5;
            const pSize = Math.random() * 3 + 2;
            const life = 0.4 + Math.random() * 0.4;
            const colors = ['#ff4500', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * this.size,
                this.y + (Math.random() - 0.5) * this.size,
                Math.cos(angle) * speed * 0.3,
                -speed, // fire goes up
                pSize,
                life,
                color
            ));
        }

        return true;
    }

    draw(ctx) {
        ctx.save();

        // Outer glow / damage radius indicator
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, 'rgba(255, 100, 0, 0.18)');
        grad.addColorStop(0.5, 'rgba(255, 60, 0, 0.07)');
        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Animated flame core
        const flicker = Math.sin(this.time * 10) * 3;
        const coreSize = this.size + flicker;

        // Inner bright core
        const coreGrad = ctx.createRadialGradient(
            this.x, this.y - 4, 0,
            this.x, this.y - 4, coreSize * 1.5
        );
        coreGrad.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
        coreGrad.addColorStop(0.3, 'rgba(255, 160, 0, 0.7)');
        coreGrad.addColorStop(0.7, 'rgba(255, 60, 0, 0.4)');
        coreGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 4, coreSize * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Flame tongues (3 dancing flame shapes)
        for (let i = 0; i < 3; i++) {
            const offset = Math.sin(this.time * 8 + i * 2.1) * 5;
            const tongueH = coreSize * (1.2 + 0.3 * Math.sin(this.time * 12 + i));
            ctx.beginPath();
            ctx.moveTo(this.x - 5 + i * 5 + offset, this.y);
            ctx.quadraticCurveTo(
                this.x - 3 + i * 5 + offset * 0.5, this.y - tongueH,
                this.x + i * 5 + offset, this.y - tongueH * 0.6
            );
            ctx.quadraticCurveTo(
                this.x + 3 + i * 5 + offset * 0.5, this.y - tongueH,
                this.x + 5 + i * 5 + offset, this.y
            );
            ctx.closePath();
            ctx.fillStyle = `rgba(255, ${100 + i * 40}, 0, ${0.5 - i * 0.1})`;
            ctx.fill();
        }

        ctx.restore();
    }
}
