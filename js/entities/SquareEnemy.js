import Enemy from './Enemy.js';

const STATS = {
    large: { size: 50, hp: 16, speed: 0.8, damage: 12 },
    medium: { size: 30, hp: 8, speed: 1.2, damage: 6 },
    small: { size: 18, hp: 3, speed: 1.8, damage: 3 }
};

export default class SquareEnemy extends Enemy {
    constructor(x, y, stage = 'large', vx = 0, vy = 0) {
        const s = STATS[stage];
        super(x, y, s.size, s.hp, Math.sqrt(vx * vx + vy * vy) || s.speed, s.damage, `square_${stage}`, vx, vy, 'square');
        this.stage = stage;
    }

    static split(enemy, enemies) {
        if (!(enemy instanceof SquareEnemy)) return;
        if (enemy.stage === 'large') {
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                enemies.push(new SquareEnemy(enemy.x, enemy.y, 'medium', Math.cos(a), Math.sin(a)));
            }
        } else if (enemy.stage === 'medium') {
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                enemies.push(new SquareEnemy(enemy.x, enemy.y, 'small', Math.cos(a), Math.sin(a)));
            }
        }
    }
}
