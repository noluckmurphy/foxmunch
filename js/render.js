export function drawPlayer(ctx, player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.beginPath();
    ctx.moveTo(player.size, 0); // Tip of the triangle (pointing right)
    ctx.lineTo(-player.size, -player.size * 0.75); // Top left
    ctx.lineTo(-player.size, player.size * 0.75); // Bottom left
    ctx.closePath();
    ctx.fillStyle = 'orange';
    ctx.fill();
    ctx.restore();
}

export function drawEnemies(ctx, enemies) {
    enemies.forEach((enemy) => {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();
    });
}

export function drawObstacles(ctx, obstacles) {
    obstacles.forEach((obstacle) => {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
    });
}

export function drawProjectiles(ctx, projectiles) {
    projectiles.forEach((projectile) => {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -projectile.size);
        ctx.lineTo(projectile.size, projectile.size);
        ctx.lineTo(-projectile.size, projectile.size);
        ctx.closePath();
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.restore();
    });
}

export function drawBombs(ctx, bombs) {
    bombs.forEach((bomb) => {
        drawBomb(ctx, bomb);
    });
}

function drawBomb(ctx, bomb) {
    ctx.save();
    ctx.globalAlpha = bomb.opacity;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.restore();
}

