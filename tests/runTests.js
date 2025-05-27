const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
    const dir = __dirname;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'));
    for (const file of files) {
        if (file === 'runTests.js') continue;
        console.log(`Running ${file}...`);
        await import(pathToFileURL(path.join(dir, file)).href);
    }
    console.log('All tests completed');
})();
