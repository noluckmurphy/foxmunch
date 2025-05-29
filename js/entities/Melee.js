import { normalizeAngle } from '../utils.js';
import Particle from './Particle.js';
import { spawnDeathParticles } from './Enemy.js';
import SquareEnemy from './SquareEnemy.js';

export default class Melee {
    constructor(x, y, angle, range = 50, duration = 0.05, isCritical = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.range = isCritical ? range * 3 : range;
        this.duration = duration;
        this.startTime = performance.now() / 1000;
        this.alreadyHit = new Set();
        this.isCritical = isCritical;
        this.hasRegisteredHit = false;
    }

    update(enemies, player, particles) {
        const currentTime = performance.now() / 1000;
        if (currentTime - this.startTime > this.duration) {
            if (!this.hasRegisteredHit && player && typeof player.registerMeleeMiss === 'function') {
                player.registerMeleeMiss();
            }
            return false;
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (this.alreadyHit.has(enemy)) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= this.range + enemy.size) {
                const angleToEnemy = Math.atan2(dy, dx);
                const angleDiff = Math.abs(normalizeAngle(angleToEnemy - this.angle));
                if (angleDiff <= Math.PI / 3) {
                    if (enemy.type === 'elite' && enemy.shield > 0) {
                        enemy.shield -= 10;
                        if (enemy.shield < 0) {
                            enemy.hp += enemy.shield;
                            enemy.shield = 0;
                        }
                        this.alreadyHit.add(enemy);
                    } else {
                        let baseScore = 0;
                        if (enemy.type === 'small' || enemy.type === 'square_small') baseScore = 10;
                        else if (enemy.type === 'medium' || enemy.type === 'square_medium') baseScore = 30;
                        else if (enemy.type === 'large' || enemy.type === 'square_large') baseScore = 50;
                        else if (enemy.type === 'orbital') baseScore = 5;
                        else if (enemy.type === 'elite') baseScore = 100;
                        if (typeof player.addKillScore === 'function') {
                            player.addKillScore(baseScore);
                        } else {
                            player.score += baseScore;
                        }
                    }
                    if (enemy.type === 'large' && typeof player.bombs === 'number') {
                        if (Math.random() < 0.15 && player.bombs < 5) {
                            player.bombs += 1;
                        }
                    }
                    if (enemy instanceof SquareEnemy) {
                        SquareEnemy.split(enemy, enemies);
                    }
                    spawnDeathParticles(enemy, particles);
                    this.alreadyHit.add(enemy);
                    enemies.splice(i, 1);
                    if (!this.hasRegisteredHit && player && typeof player.registerMeleeHit === 'function') {
                        player.registerMeleeHit(this.isCritical);
                        this.hasRegisteredHit = true;
                    }
                }
            }
        }
        return true;
    }
}
