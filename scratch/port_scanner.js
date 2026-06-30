const http = require('http');

const host = '14.43.220.172';
const ports = [80, 443, 3000, 3001, 5000, 8080, 8081, 17433, 17590];

function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: host,
            port: port,
            path: '/api/login',
            method: 'POST',
            timeout: 3000
        }, (res) => {
            console.log(`Port ${port}: Status ${res.statusCode}`);
            resolve(true);
        });

        req.on('error', (err) => {
            // console.log(`Port ${port} error: ${err.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.write(JSON.stringify({ userId: 'test', password: 'test' }));
        req.end();
    });
}

async function run() {
    console.log(`Scanning ports on ${host}...`);
    for (const port of ports) {
        await checkPort(port);
    }
    console.log('Scan complete.');
}

run();
