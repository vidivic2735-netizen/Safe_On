const fs = require('fs');
const path = require('path');

function checkSyntax(filePath) {
    console.log("Checking syntax of:", filePath);
    const html = fs.readFileSync(filePath, 'utf8');
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 1;
    const vm = require('vm');
    while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1];
        try {
            new vm.Script(scriptContent, { filename: 'dashboard.html' });
            console.log(`Script block ${index}: Syntax OK`);
        } catch (err) {
            console.error(`Script block ${index}: Syntax ERROR!`);
            console.error(err.stack);
        }
        index++;
    }
}

checkSyntax(path.join(__dirname, '..', 'dashboard.html'));
checkSyntax(path.join(__dirname, '..', 'dist', 'dashboard.html'));
