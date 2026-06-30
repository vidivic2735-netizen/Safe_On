const sql = require('mssql');

const dbConfig = {
    user: 'sa',
    password: 'aquas3erp',
    server: '14.43.220.172',
    port: 17433,
    database: 'SafetyManagement',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function verify() {
    try {
        console.log("Connecting to database to check DailyInspections table...");
        let pool = await sql.connect(dbConfig);
        console.log("Connected successfully!");
        
        let result = await pool.request().query("SELECT TOP 5 * FROM DailyInspections ORDER BY InspectionID DESC");
        console.log("Latest Daily Safety Inspections in Database:");
        console.table(result.recordset);
        
        await sql.close();
    } catch (err) {
        console.error("Verification failed:", err);
    }
}

verify();
