const { Connection } = require('tedious');

const config = {
    server: '14.43.220.172',
    authentication: {
        type: 'default',
        options: {
            userName: 'sa',
            password: 'aquas3erp'
        }
    },
    options: {
        port: 17433,
        database: 'SafetyManagement',
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 5000,
        debug: {
            packet: true,
            data: true,
            payload: true,
            token: true
        }
    }
};

console.log("Creating connection...");
const connection = new Connection(config);

connection.connect((err) => {
    if (err) {
        console.error('Connection callback error:', err);
    } else {
        console.log('Connected successfully via connect()!');
    }
});

connection.on('connect', (err) => {
    if (err) {
        console.error('Connection failed:', err);
    } else {
        console.log('Connected successfully!');
    }
    process.exit(0);
});

connection.on('errorMessage', (err) => {
    console.log('SQL Error Message:', err.message);
});

connection.on('infoMessage', (info) => {
    console.log('SQL Info Message:', info.message);
});

connection.on('debug', (message) => {
    console.log('DEBUG:', message);
});
