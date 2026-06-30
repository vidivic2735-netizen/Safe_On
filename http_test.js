const http = require('http');

const paths = [
  '/',
  '/swagger',
  '/swagger/index.html',
  '/swagger/v1/swagger.json',
  '/api',
  '/api/values'
];

function testPath(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: '14.43.220.172',
      port: 17590,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`PATH: ${path} | STATUS: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log(`DATA (first 200 chars):`, data.substring(0, 200));
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`PATH: ${path} | ERROR: ${err.message}`);
      resolve();
    });

    req.on('timeout', () => {
      console.log(`PATH: ${path} | TIMEOUT`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  for (const path of paths) {
    await testPath(path);
  }
}

runTests();
