import { normalizeAngle } from '../utils.js';
import Particle from './Particle.js';

export default class Melee {
    constructor(x, y, angle, range = 50, duration = 0.05) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.range = range;
        this.duration = duration;
        this.startTime = performance.now() / 1000;
        this.alreadyHit = new Set();
    }

    update(enemies, player, particles) {
        const currentTime = performance.now() / 1000;
        if (currentTime - this.startTime > this.duration) {
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
                        if (enemy.type === 'small') baseScore = 10;
                        else if (enemy.type === 'medium') baseScore = 30;
                        else if (enemy.type === 'large') baseScore = 50;
                        else if (enemy.type === 'orbital') baseScore = 5;
                        else if (enemy.type === 'elite') baseScore = 100;
                        if (typeof player.addKillScore === 'function') {
                            player.addKillScore(baseScore);
                        } else {
                            player.score += baseScore;
                        }
                        if (particles) {
                            for (let j = 0; j < 6; j++) {
                                const a = Math.random() * Math.PI * 2;
                                const s = Math.random() * 2 + 1;
                                particles.push(new Particle(enemy.x, enemy.y, Math.cos(a) * s, Math.sin(a) * s, 2, 0.5));
                            }
                        }
                        this.alreadyHit.add(enemy);
                        enemies.splice(i, 1);
                    }
                }
            }
        }
        return true;
    }
}
