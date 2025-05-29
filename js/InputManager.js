class InputManager {
    constructor() {
        this.keys = {};
        this.gamepadConnected = false;
        this.gamepadConfig = {
            axisX: 0,
            axisY: 1,
            shoot: 0,
            melee: 2,
            bomb: 1,
            pause: 9,
            settings: 8,
        };

        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('gamepadConfig');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    Object.assign(this.gamepadConfig, parsed);
                } catch (_) {}
            }
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', e => {
                this.keys[e.key.toLowerCase()] = true;
            });
            window.addEventListener('keyup', e => {
                this.keys[e.key.toLowerCase()] = false;
            });
            window.addEventListener('gamepadconnected', () => {
                this.gamepadConnected = true;
            });
            window.addEventListener('gamepaddisconnected', () => {
                this.gamepadConnected = false;
            });
        }
    }

    pollGamepads() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
        const [gp] = navigator.getGamepads();
        if (!gp) {
            this.gamepadConnected = false;
            return;
        }
        this.gamepadConnected = true;
        const { axisX, axisY, shoot, melee, bomb, pause, settings } = this.gamepadConfig;
        const dead = 0.3;
        const ax = gp.axes[axisX] || 0;
        const ay = gp.axes[axisY] || 0;
        this.keys['arrowleft'] = ax < -dead;
        this.keys['arrowright'] = ax > dead;
        this.keys['arrowup'] = ay < -dead;
        this.keys['arrowdown'] = ay > dead;

        const btn = i => gp.buttons[i] && gp.buttons[i].pressed;
        this.keys[' '] = btn(shoot);
        this.keys['f'] = btn(melee);
        this.keys['s'] = btn(bomb);
        this.keys['p'] = btn(pause);
        this.keys['`'] = btn(settings);

        if (typeof document !== 'undefined') {
            const ind = document.getElementById('gamepadIndicator');
            if (ind) ind.style.display = this.gamepadConnected ? 'block' : 'none';
        }
    }

    isPressed(key) {
        return !!this.keys[key.toLowerCase()];
    }

    saveConfig() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('gamepadConfig', JSON.stringify(this.gamepadConfig));
        }
    }

    setConfig(cfg) {
        Object.assign(this.gamepadConfig, cfg);
        this.saveConfig();
    }

    getConfig() {
        return { ...this.gamepadConfig };
    }
}

export const inputManager = new InputManager();
