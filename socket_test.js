const net = require('net');

console.log('Sending HTTP GET request to 14.43.220.172:17433...');
const client = net.createConnection({ port: 17433, host: '14.43.220.172' }, () => {
  console.log('Connected to 17433. Sending HTTP request...');
  client.write('GET / HTTP/1.1\r\nHost: 14.43.220.172\r\nConnection: close\r\n\r\n');
});

client.on('data', (data) => {
  console.log('RECEIVED RESPONSE FROM 17433:');
  console.log(data.toString('utf-8'));
  client.end();
});

client.on('error', (err) => {
  console.error('Socket error:', err.message);
});

client.on('end', () => {
  console.log('Connection closed.');
});
