const sql = require('mssql');

const baseConfig = {
    user: 'sa',
    password: 'aquas3erp',
    server: '14.43.220.172',
    port: 17433,
    database: 'SafetyManagement',
    connectionTimeout: 10000,
    requestTimeout: 10000
};

const variations = [
    {
        name: "Encrypt: true, trust: true",
        options: { encrypt: true, trustServerCertificate: true }
    },
    {
        name: "Encrypt: false, trust: true",
        options: { encrypt: false, trustServerCertificate: true }
    },
    {
        name: "Encrypt: true, trust: false",
        options: { encrypt: true, trustServerCertificate: false }
    },
    {
        name: "Encrypt: false, trust: false",
        options: { encrypt: false, trustServerCertificate: false }
    }
];

async function run() {
    for (const variation of variations) {
        console.log(`\nTesting configuration: ${variation.name}...`);
        const config = {
            ...baseConfig,
            options: variation.options
        };
        try {
            const pool = await sql.connect(config);
            console.log(`SUCCESS! Connected with config: ${variation.name}`);
            const result = await pool.request().query('SELECT @@VERSION as version');
            console.log('Version:', result.recordset[0].version);
            await sql.close();
            return;
        } catch (err) {
            console.log(`FAILED with error:`, err.message);
        }
    }
}

run();
