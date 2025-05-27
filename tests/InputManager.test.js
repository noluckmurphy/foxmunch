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

    console.log('InputManager tests passed');
})();
