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

async function checkInsertedData() {
    try {
        console.log("Connecting to MSSQL...");
        let pool = await sql.connect(config);
        console.log("Connected successfully!");
        
        console.log("\n--- IncidentReports (Latest 3) ---");
        let reports = await pool.request().query(`
            SELECT TOP 3 IncidentID, CompanyBranch, IncidentType, OccurrenceDateTime, Location, EquipmentName, IncidentTitle, RegUserID, RegDateTime
            FROM IncidentReports
            ORDER BY IncidentID DESC
        `);
        console.table(reports.recordset);
        
        console.log("\n--- IncidentClassifications (Latest 3) ---");
        let classifications = await pool.request().query(`
            SELECT TOP 3 ClassificationID, IncidentID, InternalAccidentType, InternalCompAmount, ActualAbsenceDays, ExternalReportType, ComWelAccidentNo, ClassificationStatus, ModUserID
            FROM IncidentClassifications
            ORDER BY ClassificationID DESC
        `);
        console.table(classifications.recordset);

        console.log("\n--- AccidentMeasures (Latest 3) ---");
        let measures = await pool.request().query(`
            SELECT TOP 3 MeasureID, IncidentID, HazardFactors, ProposedMeasure, ManagerID, DueDate, CompletionDate, MeasureStatus, ModUserID
            FROM AccidentMeasures
            ORDER BY MeasureID DESC
        `);
        console.table(measures.recordset);

        console.log("\n--- DailyInspections (Latest 3) ---");
        let inspections = await pool.request().query(`
            SELECT TOP 3 InspectionID, CompanyBranch, InspectionType, EquipmentName, InspectionDate, Inspector, Check3Result, IssueDescription, Status
            FROM DailyInspections
            ORDER BY InspectionID DESC
        `);
        console.table(inspections.recordset);
        
        await sql.close();
    } catch (err) {
        console.error("Failed querying tables:", err);
    }
}

checkInsertedData();

