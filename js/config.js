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
    radius: { normal: 150, critical: 300 },
    damage: { normal: 40, critical: 200 }
};

// Multiplayer configuration
export const PLAYER_COLORS = ['#FFA500', '#4A90D9', '#50C878', '#9B59B6'];
export const PLAYER_COLOR_NAMES = ['Orange', 'Blue', 'Green', 'Purple'];
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const SERVER_TICK_RATE = 30;
export const MAX_PLAYERS = 4;
