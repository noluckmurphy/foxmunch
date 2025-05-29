const assert = require('assert');

(async () => {
    // Mock a minimal window object for the InputManager
    global.window = {
        listeners: {},
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        }
    };

    const { inputManager } = await import('../js/InputManager.js');

    // Simulate keydown and keyup events
    window.listeners.keydown({ key: 'A' });
    assert.strictEqual(inputManager.isPressed('a'), true, 'Key should be registered as pressed');
    assert.strictEqual(inputManager.isPressed('A'), true, 'isPressed should be case insensitive');

    window.listeners.keyup({ key: 'A' });
    assert.strictEqual(inputManager.isPressed('a'), false, 'Key should be registered as released');

    // Mock a gamepad and poll it
    Object.defineProperty(global, 'navigator', { value: {
        getGamepads() {
            return [{
                axes: [0.5, -0.6],
                buttons: [
                    { pressed: true },  // shoot
                    { pressed: false }, // bomb
                    { pressed: true },  // melee
                    { pressed: false },
                    { pressed: false },
                    { pressed: false },
                    { pressed: false },
                    { pressed: false },
                    { pressed: true },  // settings
                    { pressed: true }   // pause
                ]
            }];
        }
    }, configurable: true });
    inputManager.pollGamepads();
    assert.strictEqual(inputManager.isPressed('arrowright'), true, 'Axis X > 0 should press right');
    assert.strictEqual(inputManager.isPressed('arrowup'), true, 'Axis Y < 0 should press up');
    assert.strictEqual(inputManager.isPressed(' '), true, 'Button mapping should press shoot');
    assert.strictEqual(inputManager.isPressed('f'), true, 'Button mapping should press melee');
    assert.strictEqual(inputManager.isPressed('p'), true, 'Pause button should press p');
    assert.strictEqual(inputManager.isPressed('`'), true, 'Settings button should press backtick');

    console.log('InputManager tests passed');
})();
