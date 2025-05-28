import Particle from './Particle.js';
import { spawnDeathParticles } from './Enemy.js';

export default class Bomb {
    constructor(x, y, critical = false) {
        this.x = x;
        this.y = y;
        this.startTime = performance.now();
        this.durationExpand = 200;
        this.durationFade = 500;
        this.maxRadius = critical ? 200 : 100;
        this.currentRadius = 0;
        this.opacity = 1;
        this.done = false;
        this.damage = critical ? 100 : 20;
        this.hitEnemies = new Set();

        // Visual effect properties for a fading outer ring during the explosion
        this.ringRadius = 0;
        this.ringOpacity = 0;
        this.ringMaxRadius = this.maxRadius + 30;
    }


    update(enemies, player, particles, screenShakeCallback = null) {
        const now = performance.now();
        const elapsed = now - this.startTime;
        if (elapsed < this.durationExpand) {
            this.currentRadius = (elapsed / this.durationExpand) * this.maxRadius;
            this.opacity = 1;
            this.ringOpacity = 0;
        } else if (elapsed < this.durationExpand + this.durationFade) {
            this.currentRadius = this.maxRadius;
            this.opacity = 1 - ((elapsed - this.durationExpand) / this.durationFade);
            const progress = (elapsed - this.durationExpand) / this.durationFade;
            this.ringRadius = this.maxRadius + (this.ringMaxRadius - this.maxRadius) * progress;
            this.ringOpacity = 1 - progress;
        } else {
            this.done = true;
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < this.currentRadius + enemy.size && !this.hitEnemies.has(enemy)) {
                enemy.hp -= this.damage;
                this.hitEnemies.add(enemy);
                if (screenShakeCallback) screenShakeCallback();
                if (enemy.hp <= 0) {
                    let baseScore = 0;
                    if (enemy.type === 'small') baseScore = 10;
                    else if (enemy.type === 'medium') baseScore = 30;
                    else if (enemy.type === 'large') baseScore = 50;
                    if (typeof player.addKillScore === 'function') {
                        player.addKillScore(baseScore);
                    } else {
                        player.score += baseScore;
                    }
                    spawnDeathParticles(enemy, particles);
                    enemies.splice(i, 1);
                }
            }
        }

        return !this.done;
    }
}
