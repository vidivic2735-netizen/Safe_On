const sql = require('mssql');

const config = {
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

async function inspectSchema() {
    try {
        console.log("Connecting to MSSQL...");
        let pool = await sql.connect(config);
        console.log("Connected!");

        const tables = ['IncidentReports', 'IncidentClassifications', 'AccidentMeasures'];
        for (const tableName of tables) {
            console.log(`\nChecking structure of ${tableName}:`);
            try {
                const cols = await pool.request().query(`
                    SELECT c.name, t.name AS data_type, c.max_length, c.is_nullable
                    FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID('${tableName}')
                `);
                if (cols.recordset.length === 0) {
                    console.log(`Table ${tableName} DOES NOT exist.`);
                } else {
                    console.table(cols.recordset);
                }
            } catch (err) {
                console.error(`Error querying ${tableName}:`, err.message);
            }
        }

        await sql.close();
    } catch (err) {
        console.error("Error inspecting schema:", err);
    }
}

inspectSchema();
