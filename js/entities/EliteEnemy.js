import Enemy from './Enemy.js';
import Orbital from './Orbital.js';

export default class EliteEnemy extends Enemy {
    constructor(x, y, vx, vy) {
        const size = 84; // 20% larger than large enemy size 70
        const hp = 52; // double large enemy hp (26)
        const speed = Math.sqrt(vx * vx + vy * vy);
        const damage = 30;
        super(x, y, size, hp, speed, damage, 'elite', vx, vy);
        this.shieldMax = 40;
        this.shield = this.shieldMax;
        this.orbitals = [];
    }

    createOrbitals(enemyList, enemyProjectiles) {
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const orb = new Orbital(this, angle);
            this.orbitals.push(orb);
            enemyList.push(orb);
        }
    }

    update(canvas) {
        return super.update(canvas);
    }
}
