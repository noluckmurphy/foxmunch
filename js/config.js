export const PLAYER_DEFAULTS = {
    size: 20,
    color: '#FFA500',
    maxSpeed: 4,
    acceleration: 0.2,
    deceleration: 0.05,
    hp: 100,
    acorns: 200,
    bombs: 5,
    lives: 3
};

export const BOMB_DEFAULTS = {
    durationExpand: 200,
    durationFade: 500,
    radius: { normal: 100, critical: 200 },
    damage: { normal: 20, critical: 100 }
};
