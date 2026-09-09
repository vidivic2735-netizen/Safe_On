const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

const itemsToCopy = [
    'about.html',
    'contact.html',
    'dashboard.html',
    'index.html',
    'login.html',
    'risk.html',
    'safety.html',
    '_redirects',
    'css',
    'js',
    'images'
];

itemsToCopy.forEach(item => {
    const src = path.join(rootDir, item);
    const dest = path.join(distDir, item);
    if (fs.existsSync(src)) {
        copyRecursiveSync(src, dest);
        console.log(`Copied ${item} -> dist/${item}`);
    }
});

console.log('Build completed successfully.');
