const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Provide a very small localStorage stub for tests running under Node
if (typeof global.localStorage === 'undefined') {
    global.localStorage = (() => {
        let store = {};
        return {
            getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); },
            removeItem(key) { delete store[key]; },
            clear() { store = {}; }
        };
    })();
}

let failed = 0;
process.on('unhandledRejection', err => {
    failed++;
    console.error('Unhandled rejection:', err.message);
});

(async () => {
    const dir = __dirname;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f !== 'runTests.js');
    for (const file of files) {
        console.log(`Running ${file}...`);
        try {
            await import(pathToFileURL(path.join(dir, file)).href);
        } catch (err) {
            failed++;
            console.error(`${file} failed:`, err.message);
        }
    }
    console.log('All tests completed');
    if (failed > 0) {
        console.log(`${failed} test(s) failed`);
        process.exitCode = 1;
    }
})();
