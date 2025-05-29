export function isClearOfObstacles(x, y, radius = 0, buffer = 0, obsArr = []) {
    for (const o of obsArr) {
        const dist = Math.hypot(x - o.x, y - o.y);
        if (dist < o.size + radius + buffer) return false;
    }
    return true;
}
