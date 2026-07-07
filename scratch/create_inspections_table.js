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

async function createTable() {
    try {
        console.log("Connecting to database...");
        let pool = await sql.connect(dbConfig);
        console.log("Connected. Creating DailyInspections table if not exists...");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DailyInspections' AND xtype='U')
            BEGIN
                CREATE TABLE DailyInspections (
                    InspectionID INT IDENTITY(1,1) PRIMARY KEY,
                    CompanyBranch NVARCHAR(100) NOT NULL,
                    InspectionType VARCHAR(50) NOT NULL, -- 'SITE' or 'EQUIPMENT'
                    EquipmentName NVARCHAR(150),
                    InspectionDate VARCHAR(10) NOT NULL,
                    Inspector NVARCHAR(100) NOT NULL,
                    Check1Result VARCHAR(20) NOT NULL, -- 'GOOD', 'ACTION_REQUIRED', 'NA'
                    Check2Result VARCHAR(20) NOT NULL,
                    Check3Result VARCHAR(20) NOT NULL,
                    IssueDescription NVARCHAR(MAX),
                    ActionRequired NVARCHAR(MAX),
                    BeforePhotoPath NVARCHAR(500),
                    ManagerID NVARCHAR(100),
                    DueDate VARCHAR(10),
                    SignatureData NVARCHAR(MAX), -- Base64 encoded signature
                    Status VARCHAR(20) NOT NULL, -- 'DRAFT' or 'SUBMITTED'
                    RegDateTime DATETIME DEFAULT GETDATE()
                );
                PRINT 'Table DailyInspections created successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Table DailyInspections already exists.';
            END
        `);

        await sql.close();
        console.log("Done!");
    } catch (err) {
        console.error("Database operation failed:", err);
    }
}

createTable();
