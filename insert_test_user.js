const sql = require('mssql');
const crypto = require('crypto');

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

function md5Hash(text) {
    return crypto.createHash('md5').update(text).digest('hex').toUpperCase();
}

async function insertUser() {
    try {
        console.log("Connecting to MSSQL...");
        let pool = await sql.connect(dbConfig);
        console.log("Connected successfully!");

        const userId = 'testuser@test.com';
        const passwordText = '12345678'; // Default password for testing
        const hashedPassword = md5Hash(passwordText);
        const userName = '테스트 유저';
        const companyName = '테스트 회사';

        // Check if user already exists
        const checkResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query('SELECT 1 FROM ZU010 WHERE USER_ID = @userId');

        if (checkResult.recordset.length > 0) {
            console.log(`User ${userId} already exists in DB. Updating password to '${passwordText}' and enabling...`);
            await pool.request()
                .input('userId', sql.VarChar, userId)
                .input('password', sql.VarChar, hashedPassword)
                .input('userNm', sql.NVarChar, userName)
                .input('bpNm', sql.NVarChar, companyName)
                .query(`
                    UPDATE ZU010
                    SET PASSWORD = @password,
                        USER_NM = @userNm,
                        BP_NM = @bpNm,
                        USE_YN = 'Y',
                        LOCK_YN = 'N',
                        UPDT_USER_ID = 'System',
                        UPDT_DT = GETDATE()
                    WHERE USER_ID = @userId
                `);
            console.log("User updated successfully.");
        } else {
            console.log(`User ${userId} does not exist. Inserting...`);
            await pool.request()
                .input('userId', sql.VarChar, userId)
                .input('userNm', sql.NVarChar, userName)
                .input('password', sql.VarChar, hashedPassword)
                .input('bpNm', sql.NVarChar, companyName)
                .query(`
                    INSERT INTO ZU010 (
                        USER_ID, USER_NM, PASSWORD, B5001, B5301, B2001, B5701, H2101, USE_YN, 
                        EXPIRE_DT, LOCK_YN, INSRT_USER_ID, INSRT_DT, UPDT_USER_ID, UPDT_DT, 
                        BP_RGST_NO, TEL_NO, BP_NM, E_MAIL, SIGN_IMG, SERVICE_TYPE
                    ) VALUES (
                        @userId, @userNm, @password, 'MST0000', 'AA', 'ABC', '', '', 'Y',
                        '2999-12-31', 'N', 'System', GETDATE(), 'System', GETDATE(),
                        NULL, '010-0000-0000', @bpNm, @userId, NULL, NULL
                    )
                `);
            console.log("User inserted successfully.");
        }

        await sql.close();
    } catch (err) {
        console.error("Database operation failed:", err);
    }
}

insertUser();
