const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from workspace root
app.use(express.static(__dirname));

// DB Configuration
const dbConfig = {
    user: 'sa',
    password: 'aquas3erp',
    server: '14.43.220.172',
    port: 17433,
    database: 'SafetyManagement',
    connectionTimeout: 2000, // 2 seconds
    requestTimeout: 2000,    // 2 seconds
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 2000  // tedious connection timeout
    }
};

let activePool = null;
let dbOffline = false;
let lastConnectAttempt = 0;
const RECONNECT_COOLDOWN = 30000; // 30 seconds

async function getPool() {
    if (activePool) {
        if (activePool.connected) {
            return activePool;
        }
        try {
            await activePool.close();
        } catch (err) {}
        activePool = null;
    }

    const now = Date.now();
    if (dbOffline && (now - lastConnectAttempt < RECONNECT_COOLDOWN)) {
        throw new Error('Database is offline (cooldown active). Skipping connection to prevent delays.');
    }

    lastConnectAttempt = now;
    try {
        console.log('Attempting to connect to database...');
        activePool = await sql.connect(dbConfig);
        dbOffline = false;
        console.log('Connected to MSSQL Database successfully.');
        return activePool;
    } catch (err) {
        dbOffline = true;
        console.error('Database connection failed:', err.message);
        throw err;
    }
}

// Initial connection attempt (does not crash on failure)
getPool()
    .catch(() => console.log('Initial Database offline. Fallback modes enabled.'));

// Helper: MD5 Hashing (Uppercase 32 chars)
function md5Hash(text) {
    return crypto.createHash('md5').update(text).digest('hex').toUpperCase();
}

// Helper: Save Base64 Image to File
function saveBase64Image(fileData, prefix) {
    if (!fileData) return null;
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }

        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const uniqueName = `${prefix}_${Date.now()}_${crypto.randomUUID().substring(0, 8)}.png`;
        const filePath = path.join(uploadsDir, uniqueName);

        fs.writeFileSync(filePath, base64Data, 'base64');
        return `/uploads/${uniqueName}`;
    } catch (err) {
        console.error('Error saving base64 image:', err);
        return null;
    }
}

// Redirect root to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Login Endpoint
app.post('/api/login', async (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({ success: false, message: '아이디와 비밀번호를 모두 입력해 주세요.' });
    }

    const trimmedId = userId.trim();
    const lowerId = trimmedId.toLowerCase();

    // Mock bypass list (fallback)
    const isMockUser = (lowerId === 'testuser@tesc.ocm' || lowerId === 'testuser@test.com');
    const isValidMockPassword = (lowerId === 'testuser@tesc.ocm' && password === '1234') || 
                                (lowerId === 'testuser@test.com' && password === '12345678');

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.VarChar, trimmedId)
            .query('SELECT USER_ID, USER_NM, PASSWORD, USE_YN, LOCK_YN, BP_NM FROM ZU010 WHERE USER_ID = @userId');

        if (result.recordset.length === 0) {
            // Fallback to mock bypass if DB connected but user not found
            if (isMockUser && isValidMockPassword) {
                console.log(`User ${trimmedId} not found in ZU010. Logging in using mock bypass fallback.`);
                return res.json({
                    success: true,
                    message: '로그인에 성공했습니다. (임시 로컬 로그인)',
                    user: {
                        userId: lowerId,
                        userName: '테스트 유저',
                        companyName: '테스트 회사'
                    }
                });
            }
            return res.status(401).json({ success: false, message: '존재하지 않는 사용자 아이디입니다.' });
        }

        const user = result.recordset[0];

        if (user.USE_YN !== 'Y') {
            return res.status(403).json({ success: false, message: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
        }

        if (user.LOCK_YN === 'Y') {
            return res.status(403).json({ success: false, message: '잠긴 계정입니다. 관리자에게 문의하세요.' });
        }

        const hashedInputPassword = md5Hash(password);
        if (user.PASSWORD !== hashedInputPassword) {
            return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
        }

        console.log(`User ${trimmedId} authenticated successfully via Database.`);
        return res.json({
            success: true,
            message: '로그인에 성공했습니다.',
            user: {
                userId: user.USER_ID,
                userName: user.USER_NM,
                companyName: user.BP_NM
            }
        });

    } catch (err) {
        console.error('Database connection or query failed during login:', err.message);
        // Fallback to mock login if DB fails
        if (isMockUser && isValidMockPassword) {
            console.log(`Database is offline. Logging in ${trimmedId} using mock bypass fallback.`);
            return res.json({
                success: true,
                message: '로그인에 성공했습니다. (오프라인 모드)',
                user: {
                    userId: lowerId,
                    userName: '테스트 유저',
                    companyName: '테스트 회사'
                }
            });
        }
        return res.status(500).json({ success: false, message: '데이터베이스 연결 실패 및 로그인 오류가 발생했습니다.' });
    }
});

// API: Signup Endpoint
app.post('/api/signup', async (req, res) => {
    const { companyName, signupId, signupPwd, managerName, managerPhone, bizRegisterNo } = req.body;

    if (!signupId || !signupPwd || !managerName || !managerPhone || !companyName) {
        return res.status(400).json({ success: false, message: '필수 항목(*)을 모두 입력해 주세요.' });
    }

    try {
        const pool = await getPool();
        
        // Check if USER_ID already exists
        const checkResult = await pool.request()
            .input('userId', sql.VarChar, signupId.trim())
            .query('SELECT 1 FROM ZU010 WHERE USER_ID = @userId');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ success: false, message: '이미 가입된 아이디(이메일)입니다.' });
        }

        const hashedPassword = md5Hash(signupPwd);

        // Insert new user to ZU010
        await pool.request()
            .input('userId', sql.VarChar, signupId.trim())
            .input('userNm', sql.NVarChar, managerName.trim())
            .input('password', sql.VarChar, hashedPassword)
            .input('bpRgstNo', sql.VarChar, bizRegisterNo ? bizRegisterNo.trim() : null)
            .input('telNo', sql.VarChar, managerPhone.trim())
            .input('bpNm', sql.NVarChar, companyName.trim())
            .input('email', sql.VarChar, signupId.trim())
            .query(`
                INSERT INTO ZU010 (
                    USER_ID, USER_NM, PASSWORD, B5001, B5301, B2001, B5701, H2101, USE_YN, 
                    EXPIRE_DT, LOCK_YN, INSRT_USER_ID, INSRT_DT, UPDT_USER_ID, UPDT_DT, 
                    BP_RGST_NO, TEL_NO, BP_NM, E_MAIL, SIGN_IMG, SERVICE_TYPE
                ) VALUES (
                    @userId, @userNm, @password, 'MST0000', 'AA', 'ABC', '', '', 'Y',
                    '2999-12-31', 'N', 'System', GETDATE(), 'System', GETDATE(),
                    @bpRgstNo, @telNo, @bpNm, @email, NULL, NULL
                )
            `);

        return res.status(201).json({ success: true, message: '회원가입이 성공적으로 완료되었습니다.' });

    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ success: false, message: '회원가입 처리 중 서버 오류가 발생했습니다.' });
    }
});

// API: Save Incident Report
app.post('/api/incidents', async (req, res) => {
    const { 
        companyBranch, 
        incidentType, 
        occurrenceDateTime, 
        location, 
        equipmentName, 
        incidentTitle, 
        incidentContent, 
        attachmentPath1, 
        attachmentPath2, 
        remarks, 
        regUserID 
    } = req.body;

    if (!companyBranch || !incidentType || !occurrenceDateTime || !location || !equipmentName || !incidentTitle || !incidentContent) {
        return res.status(400).json({ success: false, message: '필수 입력 항목이 누락되었습니다.' });
    }

    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            const result = await request
                .input('companyBranch', sql.NVarChar(100), companyBranch)
                .input('incidentType', sql.VarChar(20), incidentType)
                .input('occurrenceDateTime', sql.DateTime, new Date(occurrenceDateTime.replace(' ', 'T')))
                .input('location', sql.NVarChar(255), location)
                .input('equipmentName', sql.NVarChar(150), equipmentName)
                .input('incidentTitle', sql.NVarChar(200), incidentTitle)
                .input('incidentContent', sql.NVarChar(sql.MAX), incidentContent)
                .input('attachmentPath1', sql.NVarChar(500), attachmentPath1 || null)
                .input('attachmentPath2', sql.NVarChar(500), attachmentPath2 || null)
                .input('remarks', sql.NVarChar(1000), remarks || null)
                .input('regUserID', sql.VarChar(50), regUserID || 'System')
                .query(`
                    INSERT INTO IncidentReports (
                        CompanyBranch, IncidentType, OccurrenceDateTime, Location, EquipmentName, 
                        IncidentTitle, IncidentContent, AttachmentPath1, AttachmentPath2, Remarks, 
                        RegUserID, RegDateTime
                    ) OUTPUT INSERTED.IncidentID
                    VALUES (
                        @companyBranch, @incidentType, @occurrenceDateTime, @location, @equipmentName,
                        @incidentTitle, @incidentContent, @attachmentPath1, @attachmentPath2, @remarks,
                        @regUserID, GETDATE()
                    )
                `);

            const incidentId = result.recordset[0].IncidentID;

            // Also create a default Classification record for this incident
            const classRequest = new sql.Request(transaction);
            await classRequest
                .input('incidentId', sql.Int, incidentId)
                .input('regUserID', sql.VarChar(50), regUserID || 'System')
                .query(`
                    INSERT INTO IncidentClassifications (
                        IncidentID, InternalAccidentType, InternalCompAmount, ActualAbsenceDays,
                        ExternalReportType, ComWelAccidentNo, ComWelApprovalStatus, ComWelApprovalDate,
                        LaborMinistryStatus, LaborMinistryReportDate, ClassificationStatus, RegUserID, RegDateTime
                    ) VALUES (
                        @incidentId, 'NOT_APPLIED', 0, 0,
                        'NOT_REQUIRED', NULL, 'NOT_SUBMITTED', NULL,
                        'NOT_REPORTED', NULL, 'UNCLASSIFIED', @regUserID, GETDATE()
                    )
                `);

            await transaction.commit();
            return res.status(201).json({ success: true, message: '사고 보고가 성공적으로 등록되었습니다.', incidentId });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error('Incident insert error:', err);
        return res.status(500).json({ success: false, message: '사고 보고 등록 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Incident Reports (with search & filters, joined with classifications & measures)
app.get('/api/incidents', async (req, res) => {
    const { startDate, endDate, keyword } = req.query;

    try {
        const pool = await getPool();
        const request = pool.request();

        let query = `
            SELECT 
                r.IncidentID, r.CompanyBranch, r.IncidentType, r.OccurrenceDateTime, r.Location, 
                r.EquipmentName, r.IncidentTitle, r.IncidentContent, r.AttachmentPath1, r.AttachmentPath2, 
                r.Remarks, r.RegUserID, r.RegDateTime,
                c.ClassificationID, c.CausalFactorCode, c.AccidentTypeCode, c.InternalAccidentType,
                c.InternalCompAmount, c.ActualAbsenceDays, c.ExternalReportType, c.ComWelAccidentNo,
                c.ComWelApprovalStatus, c.ComWelApprovalDate, c.LaborMinistryStatus, c.LaborMinistryReportDate,
                c.ClassificationStatus,
                m.MeasureID, m.HazardFactors, m.CurrentMeasure, m.ProposedMeasure, m.ManagerID,
                m.DueDate, m.CompletionDate, m.ActionContent, m.BeforePhotoPath, m.AfterPhotoPath,
                m.MeasureStatus
            FROM IncidentReports r
            LEFT JOIN IncidentClassifications c ON r.IncidentID = c.IncidentID
            LEFT JOIN AccidentMeasures m ON r.IncidentID = m.IncidentID
            WHERE 1 = 1
        `;

        if (startDate) {
            request.input('startDate', sql.DateTime, new Date(startDate + 'T00:00:00'))
            query += ' AND r.OccurrenceDateTime >= @startDate';
        }
        if (endDate) {
            request.input('endDate', sql.DateTime, new Date(endDate + 'T23:59:59'))
            query += ' AND r.OccurrenceDateTime <= @endDate';
        }
        if (keyword) {
            request.input('keyword', sql.NVarChar, `%${keyword}%`);
            query += ' AND (r.EquipmentName LIKE @keyword OR r.IncidentTitle LIKE @keyword OR r.IncidentContent LIKE @keyword)';
        }

        query += ' ORDER BY r.OccurrenceDateTime DESC, r.IncidentID DESC';

        const result = await request.query(query);
        return res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Fetch incidents error:', err);
        return res.status(500).json({ success: false, message: '사고 목록을 조회하는 중 서버 오류가 발생했습니다.' });
    }
});

// API: Ask Gemini about a specific Incident
app.post('/api/gemini/ask', async (req, res) => {
    const { incidentId, question } = req.body;

    if (!incidentId || !question) {
        return res.status(400).json({ success: false, message: '사고 ID와 질문은 필수 항목입니다.' });
    }

    try {
        let incident = null;
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('incidentId', sql.Int, incidentId)
                .query('SELECT * FROM Incidents WHERE IncidentID = @incidentId');
            if (result.recordset.length > 0) {
                incident = result.recordset[0];
            }
        } catch (dbErr) {
            console.error('Gemini DB query failed, checking fallback data:', dbErr.message);
        }

        // Fallback mock accident if DB is offline or not found
        if (!incident) {
            incident = {
                IncidentID: incidentId,
                IncidentTitle: '협착사고',
                IncidentType: 'INJURY',
                EquipmentName: '지게차A',
                IncidentDescription: '작업자가 지게차 후진 중 적재물에 밀려 다리가 지게차 바퀴와 프레임 사이에 끼임.',
                Location: '제1공장 출하장',
                OccurDateTime: new Date().toISOString()
            };
        }

        const prompt = `당신은 대한민국 산업안전보건법 및 안전보건공단(KOSHA) 가이드를 완벽히 숙지한 전문 안전 관리 AI 조언자입니다.
다음 사고 개요를 분석하고 사용자의 질문에 답해 주세요.

[사고 개요]
- 사고 ID: ${incident.IncidentID}
- 사고 제목: ${incident.IncidentTitle}
- 사고 종류: ${incident.IncidentType} (DEATH: 사망, INJURY: 부상, NEAR_MISS: 아차사고, PROPERTY: 물적피해)
- 장비명: ${incident.EquipmentName || '없음'}
- 사고 위치: ${incident.Location || '알 수 없음'}
- 사고 일시: ${incident.OccurDateTime}
- 사고 상황 설명: ${incident.IncidentDescription}

[사용자 질문]
${question}

[답변 가이드]
- 질문에 대하여 법적 기준(산업안전보건법 등)과 실질적인 기술적 예방대책을 포함하여 신뢰성 있고 구체적으로 성실히 답변해 주세요.
- 한국어로 명확하고 전문적인 톤으로 작성해 주세요. Markdown 서식을 적극적으로 활용하여 가독성을 높여주세요.`;

        // Check if API key is configured
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt
                });
                return res.json({ success: true, answer: response.text });
            } catch (geminiErr) {
                console.error('Gemini API call failed, falling back to simulated response:', geminiErr.message);
            }
        }

        // Rich Simulated Fallback Response (if key not set or failed)
        let simulatedAnswer = `### 🤖 [시뮬레이션 모드] AI 안전 전문가 분석 결과

> ⚠️ **알림**: 환경변수 \`GEMINI_API_KEY\`가 구성되지 않아 시뮬레이션 데이터로 안전 분석 가이드를 대체 제공합니다.

제안하신 질문("**${question}**") 및 등록된 사고 사례("**${incident.EquipmentName || '장비'} 관련 ${incident.IncidentTitle}**)에 대한 KOSHA 가이드라인 분석 의견은 다음과 같습니다:

#### 1. 사고 원인 분석
- **설비적 요인:** ${incident.EquipmentName || '장비'} 사용 중 후방 경보 장치(경광등, 후진 벨)의 정상 작동 여부 불량 또는 사각지대 존재.
- **인적/관리적 요인:** 신호수 배치 미흡 및 작업 반경 내 일반 작업자의 출입 통제 프로세스 부재.

#### 2. 관련 법규 및 기준 (산업안전보건기준에 관한 규칙)
- **제38조 (사전조사 및 작업계획서의 작성 등):** 지게차 등 차량계 하역운반기계를 사용하는 경우, 작업계획서를 작성하고 그 계획에 따라 작업을 시행해야 합니다.
- **제39조 (작업지휘자 등의 지정):** 작업 반경 내 작업자 접촉 위험 방지를 위한 유도자(신호수) 배치가 필수적입니다.
- **제179조 (전조등 및 후미등):** 하역운반기계는 적절한 조명 및 경보장치를 상시 유지해야 합니다.

#### 3. 동종 재해 재발방지대책
- **지게차 후방 카메라 및 스마트 감지 센서 설치:** 인공지능 기반의 사람 인식 센서를 도입하여 반경 3m 내 보행자 접근 시 지게차가 강제 감속/정지하도록 보완.
- **작업구역 구획 및 전용 통로 설치:** 지게차 전용 이동로와 보행자 통로를 물리적 펜스로 구획하여 동선 혼재 방지.
- **신호수 배치 및 안전 교육:** 차량 하역 작업 시 반드시 안전 조끼를 착용한 전문 신호수를 배치하고 작업 지휘를 보장함.
`;
        return res.json({ success: true, answer: simulatedAnswer });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'AI 질문 처리 중 서버 오류가 발생했습니다.' });
    }
});

// API: Analyze Safety Inspection Details with BizPro AI
app.post('/api/gemini/analyze-inspection', async (req, res) => {
    const { inspectionId } = req.body;

    if (!inspectionId) {
        return res.status(400).json({ success: false, message: '점검 ID는 필수 항목입니다.' });
    }

    try {
        let inspection = null;
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('inspectionId', sql.VarChar(36), inspectionId)
                .query(`
                    SELECT 
                        m.inspection_id AS InspectionID,
                        CASE m.site_id 
                            WHEN 'SEOUL' THEN '서울 본사 공장'
                            WHEN 'BUSAN' THEN '부산 지사 공장'
                            WHEN 'INCHEON' THEN '인천 물류 센터'
                            ELSE m.site_id
                        END AS CompanyBranch,
                        CASE m.inspection_type
                            WHEN 'FIELD' THEN 'SITE'
                            WHEN 'EQUIP' THEN 'EQUIPMENT'
                            ELSE m.inspection_type
                        END AS InspectionType,
                        m.equipment_id AS EquipmentName,
                        CONVERT(varchar(10), m.inspection_date, 120) AS InspectionDate,
                        m.inspector_id AS Inspector,
                        CASE d1.result_status
                            WHEN 'PASS' THEN 'GOOD'
                            WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                            ELSE d1.result_status
                        END AS Check1Result,
                        CASE d2.result_status
                            WHEN 'PASS' THEN 'GOOD'
                            WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                            ELSE d2.result_status
                        END AS Check2Result,
                        CASE d3.result_status
                            WHEN 'PASS' THEN 'GOOD'
                            WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                            ELSE d3.result_status
                        END AS Check3Result,
                        nc.issue_description AS IssueDescription,
                        nc.action_required AS ActionRequired,
                        nc.before_img_path AS BeforePhotoPath,
                        nc.manager_id AS ManagerID,
                        CONVERT(varchar(10), nc.due_date, 120) AS DueDate,
                        m.signature_path AS SignatureData,
                        CASE m.has_signature
                            WHEN 1 THEN 'SUBMITTED'
                            ELSE 'DRAFT'
                        END AS Status,
                        m.created_at AS RegDateTime
                    FROM Safety_Inspection_Master m
                    LEFT JOIN Safety_Inspection_Details d1 ON m.inspection_id = d1.inspection_id AND d1.item_code = 'ITEM_01'
                    LEFT JOIN Safety_Inspection_Details d2 ON m.inspection_id = d2.inspection_id AND d2.item_code = 'ITEM_02'
                    LEFT JOIN Safety_Inspection_Details d3 ON m.inspection_id = d3.inspection_id AND d3.item_code = 'ITEM_03'
                    LEFT JOIN Safety_Non_Compliance nc ON m.inspection_id = nc.inspection_id AND nc.detail_id = d3.detail_id
                    WHERE m.inspection_id = @inspectionId
                `);
            if (result.recordset.length > 0) {
                inspection = result.recordset[0];
            }
        } catch (dbErr) {
            console.error('Gemini Inspection DB query failed, checking fallback data:', dbErr.message);
        }

        // Fallback mock inspection if DB is offline or not found
        if (!inspection) {
            inspection = {
                InspectionID: inspectionId,
                CompanyBranch: '제1공장',
                InspectionType: 'SITE',
                EquipmentName: '조립 라인 B',
                InspectionDate: new Date().toISOString().split('T')[0],
                Inspector: '김안전',
                Check1Result: 'GOOD',
                Check2Result: 'ACTION_REQUIRED',
                Check3Result: 'GOOD',
                IssueDescription: '분전함 주변에 이동식 적재 대차가 배치되어 있어 비상시 접근이 차단됨.',
                ActionRequired: '이동식 대차를 적치 구역으로 이동시키고 분전함 전면 1m 내 황색 구획선 도색 조치.',
                ManagerID: '이조치 주임',
                DueDate: new Date().toISOString().split('T')[0]
            };
        }

        const prompt = `당신은 대한민국 안전보건공단(KOSHA) 가이드 및 산업안전보건법을 숙지한 전문 안전 관리 AI인 "비즈프로 AI"입니다.
다음 안전 점검 내역을 분석하여, 안전 관점에서 [위험한 내용], [부족한 부분], [잘 된 부분]을 분류하고 각각 간략하게 정리해 주세요.

[안전 점검 정보]
- 점검 ID: ${inspection.InspectionID}
- 사업장: ${inspection.CompanyBranch}
- 점검 유형: ${inspection.InspectionType} (SITE: 현장 점검, EQUIPMENT: 장비 점검)
- 점검 장비: ${inspection.EquipmentName || '없음'}
- 점검 일자: ${inspection.InspectionDate}
- 점검자: ${inspection.Inspector}

[체크리스트 결과]
1. 방호장치 정상 작동 여부: ${inspection.Check1Result === 'GOOD' ? '양호' : '조치필요'}
2. 전기 분전함 전면 적재물 및 외함 접지 상태: ${inspection.Check2Result === 'GOOD' ? '양호' : '조치필요'}
3. 현장 내 통로 및 비상구 주위 상태: ${inspection.Check3Result === 'GOOD' ? '양호' : '조치필요'}

${inspection.Check1Result === 'ACTION_REQUIRED' || inspection.Check2Result === 'ACTION_REQUIRED' || inspection.Check3Result === 'ACTION_REQUIRED' ? `
[부적합 조치사항]
- 위험 요인 설명: ${inspection.IssueDescription || '없음'}
- 조치 요구사항: ${inspection.ActionRequired || '없음'}
- 조치 담당자: ${inspection.ManagerID || '없음'}
- 조치 기한: ${inspection.DueDate || '없음'}
` : ''}

[답변 형식 가이드]
- 다음 세 가지 항목을 명확히 구분하여 작성해 주세요. 한국어로 마크다운 스타일을 사용해 간결하게 응답해 주세요.
- **[위험한 내용]**:
- **[부족한 부분]**:
- **[잘 된 부분]**:`;

        // Check if API key is configured
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt
                });
                return res.json({ success: true, answer: response.text });
            } catch (geminiErr) {
                console.error('Gemini API call failed, falling back to simulated response:', geminiErr.message);
            }
        }

        // Rich Simulated Fallback Response (if key not set or failed)
        let simulatedAnswer = `### ✨ 비즈프로 AI 안전 점검 분석 보고서

> 💡 **알림**: 환경변수에 \`GEMINI_API_KEY\`가 설정되지 않아 시뮬레이션 데이터로 안전 분석 결과를 제시합니다.

**점검 일지 (No.${inspection.InspectionID})**에 대한 비즈프로 AI 분석 의견입니다:

#### 1. 🚨 **위험한 내용**
${inspection.Check1Result === 'ACTION_REQUIRED' || inspection.Check2Result === 'ACTION_REQUIRED' || inspection.Check3Result === 'ACTION_REQUIRED' ? `
- **부적합 사항 감지**: 일부 점검 항목에서 조치필요 판정이 확인되었습니다.
- **위험 요인**: ${inspection.IssueDescription || '구체적인 위험 요인이 등록되지 않았으나 안전 확인이 요구됩니다.'}
- **위험 요약**: 방호장치 결함 시 설비 말림 위험, 분전함 적재물 적치 시 과열로 인한 화재 및 누전/감전 위험, 통로 적치물 시 긴급 대피 차단 및 전도 리스크가 존재합니다.
` : `
- **직접적인 물리 위험 없음**: 주요 3대 위험 요소(방호장치, 분전함, 대피로)가 모두 '양호'로 판정되어 직접적이고 시급한 위험 요인은 관찰되지 않습니다.
`}

#### 2. ⚠️ **부족한 부분**
${inspection.Check1Result === 'ACTION_REQUIRED' || inspection.Check2Result === 'ACTION_REQUIRED' || inspection.Check3Result === 'ACTION_REQUIRED' ? `
- **이행 지연 리스크**: 담당자(${inspection.ManagerID || '미정'}) 및 조치 기한(${inspection.DueDate || '미정'}) 내에 실질적인 작업 및 이동 조치(${inspection.ActionRequired || '미입력'})가 완료되는지 지속적 팔로우업이 필요합니다.
- **안전 표지 부재**: 임시 차단 구역이나 경고 표지가 누락되었을 수 있어 신속히 보완해야 합니다.
` : `
- **장기적인 잠재 위해 관리**: 정기적인 법적 안전 보건 교육의 적정성 검토 및 작업자 개개인의 안전 보호구 착용 실태 점검 등 무형적 안전 활동에 대한 보완이 권장됩니다.
`}

#### 3. ✅ **잘 된 부분**
- **체크리스트 양호 요인**:
${inspection.Check1Result === 'GOOD' ? '  - **방호장치 정상**: 기계 설비의 위험 부분에 방호막/방호장치가 완전하게 설치되어 작동하고 있습니다.\n' : ''}${inspection.Check2Result === 'GOOD' ? '  - **전기 안전 수칙 준수**: 전기 판넬 및 분전함 전면 공간이 상시 개방되어 양호하게 통제되고 있습니다.\n' : ''}${inspection.Check3Result === 'GOOD' ? '  - **비상 통로 확보**: 통행 및 대피 통로에 장애물이 없고 정리가 잘 되어 있습니다.\n' : ''}- **예방 점검 수행**: 점검자 **${inspection.Inspector}**님이 점검일자 **${inspection.InspectionDate}**에 점검 활동을 성실히 이행 및 기록 관리하였습니다.
`;
        return res.json({ success: true, answer: simulatedAnswer });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'AI 점검 분석 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Incident Classification by ID
app.get('/api/incidents/:id/classification', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('incidentId', sql.VarChar(36), id)
            .query('SELECT * FROM IncidentClassifications WHERE IncidentID = @incidentId');
        
        if (result.recordset.length === 0) {
            return res.json({ success: true, data: null }); // success true with null data is expected when not yet classified
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error('Get classification error:', err);
        return res.status(500).json({ success: false, message: '데이터 조회 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Incident Measures by ID
app.get('/api/incidents/:id/measures', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('incidentId', sql.VarChar(36), id)
            .query('SELECT * FROM AccidentMeasures WHERE IncidentID = @incidentId');
        
        if (result.recordset.length === 0) {
            return res.json({ success: true, data: null }); // success true with null data is expected when no measure is set yet
        }
        return res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error('Get measures error:', err);
        return res.status(500).json({ success: false, message: '데이터 조회 중 서버 오류가 발생했습니다.' });
    }
});

// API: Save/Update Incident Classification (Screen 2)
app.post('/api/classifications', async (req, res) => {
    const {
        incidentId,
        causalFactorCode,
        accidentTypeCode,
        internalAccidentType,
        internalCompAmount,
        actualAbsenceDays,
        externalReportType,
        comWelAccidentNo,
        comWelApprovalStatus,
        comWelApprovalDate,
        laborMinistryStatus,
        laborMinistryReportDate,
        userId
    } = req.body;

    if (!incidentId) {
        return res.status(400).json({ success: false, message: '사고 ID는 필수 항목입니다.' });
    }

    try {
        const pool = await getPool();
        const request = pool.request()
            .input('incidentId', sql.Int, incidentId)
            .input('causalFactorCode', sql.VarChar(20), causalFactorCode || null)
            .input('accidentTypeCode', sql.VarChar(20), accidentTypeCode || null)
            .input('internalAccidentType', sql.VarChar(20), internalAccidentType || 'NOT_APPLIED')
            .input('internalCompAmount', sql.Decimal(18, 0), internalCompAmount || 0)
            .input('actualAbsenceDays', sql.Int, actualAbsenceDays || 0)
            .input('externalReportType', sql.VarChar(20), externalReportType || 'NOT_REQUIRED')
            .input('comWelAccidentNo', sql.NVarChar(50), comWelAccidentNo || null)
            .input('comWelApprovalStatus', sql.VarChar(20), comWelApprovalStatus || 'NOT_SUBMITTED')
            .input('comWelApprovalDate', sql.Date, comWelApprovalDate ? new Date(comWelApprovalDate) : null)
            .input('laborMinistryStatus', sql.VarChar(20), laborMinistryStatus || 'NOT_REPORTED')
            .input('laborMinistryReportDate', sql.Date, laborMinistryReportDate ? new Date(laborMinistryReportDate) : null)
            .input('userId', sql.VarChar(50), userId || 'System');

        // Check if Classification record exists
        const checkResult = await request.query('SELECT 1 FROM IncidentClassifications WHERE IncidentID = @incidentId');

        if (checkResult.recordset.length > 0) {
            await request.query(`
                UPDATE IncidentClassifications
                SET CausalFactorCode = @causalFactorCode,
                    AccidentTypeCode = @accidentTypeCode,
                    InternalAccidentType = @internalAccidentType,
                    InternalCompAmount = @internalCompAmount,
                    ActualAbsenceDays = @actualAbsenceDays,
                    ExternalReportType = @externalReportType,
                    ComWelAccidentNo = @comWelAccidentNo,
                    ComWelApprovalStatus = @comWelApprovalStatus,
                    ComWelApprovalDate = @comWelApprovalDate,
                    LaborMinistryStatus = @laborMinistryStatus,
                    LaborMinistryReportDate = @laborMinistryReportDate,
                    ClassificationStatus = 'COMPLETED',
                    ModUserID = @userId,
                    ModDateTime = GETDATE()
                WHERE IncidentID = @incidentId
            `);
        } else {
            await request.query(`
                INSERT INTO IncidentClassifications (
                    IncidentID, CausalFactorCode, AccidentTypeCode, InternalAccidentType,
                    InternalCompAmount, ActualAbsenceDays, ExternalReportType, ComWelAccidentNo,
                    ComWelApprovalStatus, ComWelApprovalDate, LaborMinistryStatus, LaborMinistryReportDate,
                    ClassificationStatus, RegUserID, RegDateTime
                ) VALUES (
                    @incidentId, @causalFactorCode, @accidentTypeCode, @internalAccidentType,
                    @internalCompAmount, @actualAbsenceDays, @externalReportType, @comWelAccidentNo,
                    @comWelApprovalStatus, @comWelApprovalDate, @laborMinistryStatus, @laborMinistryReportDate,
                    'COMPLETED', @userId, GETDATE()
                )
            `);
        }

        return res.json({ success: true, message: '분류 및 산재 정보가 정상 저장되었습니다.' });

    } catch (err) {
        console.error('Classification save error:', err);
        return res.status(500).json({ success: false, message: '분류 저장 중 서버 오류가 발생했습니다.' });
    }
});

// API: Save/Update Accident Measure and Action Completion (Screen 3)
app.post('/api/measures', async (req, res) => {
    const {
        incidentId,
        hazardFactors,
        currentMeasure,
        proposedMeasure,
        managerId,
        dueDate,
        completionDate,
        actionContent,
        beforePhotoPath,
        afterPhotoPath,
        measureStatus,
        userId
    } = req.body;

    if (!incidentId || !hazardFactors || !proposedMeasure || !managerId || !dueDate) {
        return res.status(400).json({ success: false, message: '필수 안전 대책 항목이 누락되었습니다.' });
    }

    try {
        const pool = await getPool();
        const request = pool.request()
            .input('incidentId', sql.Int, incidentId)
            .input('hazardFactors', sql.NVarChar(sql.MAX), hazardFactors)
            .input('currentMeasure', sql.NVarChar(sql.MAX), currentMeasure || null)
            .input('proposedMeasure', sql.NVarChar(sql.MAX), proposedMeasure)
            .input('managerId', sql.VarChar(50), managerId)
            .input('dueDate', sql.Date, new Date(dueDate))
            .input('completionDate', sql.Date, completionDate ? new Date(completionDate) : null)
            .input('actionContent', sql.NVarChar(sql.MAX), actionContent || null)
            .input('beforePhotoPath', sql.NVarChar(500), beforePhotoPath || null)
            .input('afterPhotoPath', sql.NVarChar(500), afterPhotoPath || null)
            .input('measureStatus', sql.VarChar(20), measureStatus || 'PROGRESS')
            .input('userId', sql.VarChar(50), userId || 'System');

        const checkResult = await request.query('SELECT 1 FROM AccidentMeasures WHERE IncidentID = @incidentId');

        if (checkResult.recordset.length > 0) {
            await request.query(`
                UPDATE AccidentMeasures
                SET HazardFactors = @hazardFactors,
                    CurrentMeasure = @currentMeasure,
                    ProposedMeasure = @proposedMeasure,
                    ManagerID = @managerId,
                    DueDate = @dueDate,
                    CompletionDate = @completionDate,
                    ActionContent = @actionContent,
                    BeforePhotoPath = @beforePhotoPath,
                    AfterPhotoPath = @afterPhotoPath,
                    MeasureStatus = @measureStatus,
                    ModUserID = @userId,
                    ModDateTime = GETDATE()
                WHERE IncidentID = @incidentId
            `);
        } else {
            await request.query(`
                INSERT INTO AccidentMeasures (
                    IncidentID, HazardFactors, CurrentMeasure, ProposedMeasure, ManagerID, DueDate,
                    CompletionDate, ActionContent, BeforePhotoPath, AfterPhotoPath, MeasureStatus,
                    RegUserID, RegDateTime
                ) VALUES (
                    @incidentId, @hazardFactors, @currentMeasure, @proposedMeasure, @managerId, @dueDate,
                    @completionDate, @actionContent, @beforePhotoPath, @afterPhotoPath, @measureStatus,
                    @userId, GETDATE()
                )
            `);
        }

        return res.json({ success: true, message: '안전 대책 및 이행 조치가 정상 등록되었습니다.' });

    } catch (err) {
        console.error('Accident measures save error:', err);
        return res.status(500).json({ success: false, message: '대책 저장 중 서버 오류가 발생했습니다.' });
    }
});

// API: Save Daily Safety Inspection (Screen 4)
app.post('/api/inspections', async (req, res) => {
    const {
        companyBranch,
        inspectionType,
        equipmentName,
        inspectionDate,
        inspector,
        check1Result,
        check2Result,
        check3Result,
        issueDescription,
        actionRequired,
        beforePhotoPath,
        managerId,
        dueDate,
        signatureData,
        status
    } = req.body;

    const hasLegacyResults = (check1Result !== undefined && check2Result !== undefined && check3Result !== undefined);
    const hasDynamicResults = (req.body.checkResults && Array.isArray(req.body.checkResults));

    if (!companyBranch || !inspectionType || !inspectionDate || !inspector || (!hasLegacyResults && !hasDynamicResults) || !status) {
        return res.status(400).json({ success: false, message: '필수 입력 항목이 누락되었습니다.' });
    }

    try {
        const pool = await getPool();

        // 1. Process signature base64 -> save as file if present
        let sigPath = null;
        let hasSig = 0;
        if (signatureData) {
            sigPath = saveBase64Image(signatureData, 'sig');
            if (sigPath) {
                hasSig = 1;
            }
        }

        // 2. Map branch to site_id
        let siteId = 'SEOUL';
        if (companyBranch === '서울 본사 공장') siteId = 'SEOUL';
        else if (companyBranch === '부산 지사 공장') siteId = 'BUSAN';
        else if (companyBranch === '인천 물류 센터') siteId = 'INCHEON';
        else siteId = companyBranch.substring(0, 20); // fallback

        // Map inspectionType to MASTER constraint: 'FIELD' or 'EQUIP'
        let mappedType = 'FIELD';
        if (inspectionType === 'EQUIPMENT') mappedType = 'EQUIP';
        else if (inspectionType === 'SITE') mappedType = 'FIELD';
        else mappedType = inspectionType.substring(0, 20);

        // Truncate other inputs to match database lengths safely (preventing multi-byte truncation errors)
        const inspectorId = inspector ? inspector.split(/[\s\(]/)[0].substring(0, 6) : 'System';
        const equipId = equipmentName ? equipmentName.substring(0, 36) : null;

        // Generate UUID
        const inspectionId = crypto.randomUUID();
        const parsedInspDate = inspectionDate ? new Date(inspectionDate) : new Date();

        // 3. Database Transaction
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // A. Insert into Safety_Inspection_Master
            const masterRequest = new sql.Request(transaction);
            await masterRequest
                .input('inspectionId', sql.VarChar(36), inspectionId)
                .input('siteId', sql.VarChar(20), siteId)
                .input('inspectionDate', sql.Date, parsedInspDate)
                .input('inspectorId', sql.NVarChar(20), inspectorId)
                .input('inspectionType', sql.VarChar(20), mappedType)
                .input('equipmentId', sql.NVarChar(36), equipId)
                .input('hasSignature', sql.Bit, hasSig)
                .input('signaturePath', sql.VarChar(255), sigPath)
                .query(`
                    INSERT INTO Safety_Inspection_Master (
                        inspection_id, site_id, inspection_date, inspector_id, inspection_type,
                        equipment_id, has_signature, signature_path, created_at
                    ) VALUES (
                        @inspectionId, @siteId, @inspectionDate, @inspectorId, @inspectionType,
                        @equipmentId, @hasSignature, @signaturePath, GETDATE()
                    )
                `);

            // B. Insert into Safety_Inspection_Details for each item
            // Map check results to DETAILS constraint: 'PASS', 'FAIL', or 'NA'
            const mapResultStatus = (res) => {
                if (res === 'GOOD' || res === 'PASS') return 'PASS';
                if (res === 'ACTION_REQUIRED' || res === 'FAIL') return 'FAIL';
                return 'NA';
            };

            let results = [];
            if (hasDynamicResults) {
                results = req.body.checkResults.map(r => ({
                    itemCode: r.itemCode,
                    resultStatus: mapResultStatus(r.resultStatus)
                }));
            } else {
                results = [
                    { itemCode: 'ITEM_01', resultStatus: mapResultStatus(check1Result) },
                    { itemCode: 'ITEM_02', resultStatus: mapResultStatus(check2Result) },
                    { itemCode: 'ITEM_03', resultStatus: mapResultStatus(check3Result) }
                ];
            }

            let failedDetails = [];

            for (const r of results) {
                const detailRequest = new sql.Request(transaction);
                const detailResult = await detailRequest
                    .input('inspectionId', sql.VarChar(36), inspectionId)
                    .input('itemCode', sql.VarChar(10), r.itemCode)
                    .input('resultStatus', sql.VarChar(10), r.resultStatus)
                    .query(`
                        INSERT INTO Safety_Inspection_Details (inspection_id, item_code, result_status)
                        OUTPUT INSERTED.detail_id
                        VALUES (@inspectionId, @itemCode, @resultStatus)
                    `);
                
                if (r.resultStatus === 'FAIL') {
                    failedDetails.push({
                        detailId: detailResult.recordset[0].detail_id,
                        itemCode: r.itemCode
                    });
                }
            }

            // C. Insert into Safety_Non_Compliance if any item failed
            if (failedDetails.length > 0) {
                const firstFail = failedDetails[0];
                const ncId = crypto.randomUUID();
                const mId = managerId ? managerId.split(/[\s\(]/)[0].substring(0, 6) : 'System';
                const beforeImg = beforePhotoPath ? beforePhotoPath.substring(0, 255) : null;
                const parsedDueDate = dueDate ? new Date(dueDate) : new Date();
                const ncRequest = new sql.Request(transaction);

                await ncRequest
                    .input('ncId', sql.VarChar(36), ncId)
                    .input('inspectionId', sql.VarChar(36), inspectionId)
                    .input('detailId', sql.BigInt, firstFail.detailId)
                    .input('issueDescription', sql.NVarChar(sql.MAX), issueDescription || '')
                    .input('actionRequired', sql.NVarChar(sql.MAX), actionRequired || '')
                    .input('managerId', sql.NVarChar(20), mId)
                    .input('dueDate', sql.Date, parsedDueDate)
                    .input('actionStatus', sql.VarChar(10), 'OPEN')
                    .input('beforeImgPath', sql.VarChar(255), beforeImg)
                    .query(`
                        INSERT INTO Safety_Non_Compliance (
                            nc_id, inspection_id, detail_id, issue_description, action_required,
                            manager_id, due_date, action_status, before_img_path, after_img_path, closed_at
                        ) VALUES (
                            @ncId, @inspectionId, @detailId, @issueDescription, @actionRequired,
                            @managerId, @dueDate, @actionStatus, @beforeImgPath, NULL, NULL
                        )
                    `);
            }

            await transaction.commit();
            return res.status(201).json({ success: true, message: '안전점검 일지가 성공적으로 등록되었습니다.' });

        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }

    } catch (err) {
        console.error('Inspection save error:', err);
        return res.status(500).json({ success: false, message: '안전점검 일지 저장 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Daily Safety Inspections
app.get('/api/inspections', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                m.inspection_id AS InspectionID,
                CASE m.site_id 
                    WHEN 'SEOUL' THEN '서울 본사 공장'
                    WHEN 'BUSAN' THEN '부산 지사 공장'
                    WHEN 'INCHEON' THEN '인천 물류 센터'
                    ELSE m.site_id
                END AS CompanyBranch,
                CASE m.inspection_type
                    WHEN 'FIELD' THEN 'SITE'
                    WHEN 'EQUIP' THEN 'EQUIPMENT'
                    ELSE m.inspection_type
                END AS InspectionType,
                m.equipment_id AS EquipmentName,
                CONVERT(varchar(10), m.inspection_date, 120) AS InspectionDate,
                m.inspector_id AS Inspector,
                CASE d1.result_status
                    WHEN 'PASS' THEN 'GOOD'
                    WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                    ELSE d1.result_status
                END AS Check1Result,
                CASE d2.result_status
                    WHEN 'PASS' THEN 'GOOD'
                    WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                    ELSE d2.result_status
                END AS Check2Result,
                CASE d3.result_status
                    WHEN 'PASS' THEN 'GOOD'
                    WHEN 'FAIL' THEN 'ACTION_REQUIRED'
                    ELSE d3.result_status
                END AS Check3Result,
                (SELECT COUNT(*) FROM Safety_Inspection_Details d WHERE d.inspection_id = m.inspection_id AND d.result_status = 'PASS') AS PassCount,
                (SELECT COUNT(*) FROM Safety_Inspection_Details d WHERE d.inspection_id = m.inspection_id AND d.result_status = 'FAIL') AS FailCount,
                (SELECT COUNT(*) FROM Safety_Inspection_Details d WHERE d.inspection_id = m.inspection_id) AS TotalCount,
                nc.issue_description AS IssueDescription,
                nc.action_required AS ActionRequired,
                nc.before_img_path AS BeforePhotoPath,
                nc.manager_id AS ManagerID,
                CONVERT(varchar(10), nc.due_date, 120) AS DueDate,
                m.signature_path AS SignatureData,
                CASE m.has_signature
                    WHEN 1 THEN 'SUBMITTED'
                    ELSE 'DRAFT'
                END AS Status,
                m.created_at AS RegDateTime
            FROM Safety_Inspection_Master m
            LEFT JOIN Safety_Inspection_Details d1 ON m.inspection_id = d1.inspection_id AND d1.item_code = 'ITEM_01'
            LEFT JOIN Safety_Inspection_Details d2 ON m.inspection_id = d2.inspection_id AND d2.item_code = 'ITEM_02'
            LEFT JOIN Safety_Inspection_Details d3 ON m.inspection_id = d3.inspection_id AND d3.item_code = 'ITEM_03'
            LEFT JOIN Safety_Non_Compliance nc ON m.inspection_id = nc.inspection_id AND nc.detail_id = d3.detail_id
            ORDER BY m.created_at DESC
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Fetch inspections error:', err);
        return res.status(500).json({ success: false, message: '안전점검 이력을 조회하는 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Inspection Details (dynamic items lookup)
app.get('/api/inspections/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('inspectionId', sql.VarChar(36), id)
            .query(`
                SELECT 
                    d.detail_id AS DetailID,
                    d.item_code AS ItemCode,
                    d.result_status AS ResultStatus,
                    c.item_text AS ItemText
                FROM Safety_Inspection_Details d
                LEFT JOIN Safety_Inspection_Master m ON d.inspection_id = m.inspection_id
                LEFT JOIN ChecklistItems c ON (
                    CASE c.company_branch 
                        WHEN '서울 본사 공장' THEN 'SEOUL'
                        WHEN '부산 지사 공장' THEN 'BUSAN'
                        WHEN '인천 물류 센터' THEN 'INCHEON'
                        ELSE c.company_branch
                    END
                ) = m.site_id AND d.item_code = c.item_code
                WHERE d.inspection_id = @inspectionId
            `);
        // If no ChecklistItems match, supply standard fallbacks
        const data = result.recordset.map(row => {
            if (!row.ItemText) {
                if (row.ItemCode === 'ITEM_01') row.ItemText = '기계·설비의 방호장치(비상정지장치 등) 작동 상태가 정상인가?';
                else if (row.ItemCode === 'ITEM_02') row.ItemText = '전기 분전함 전면에 적재물이 없고 외함 접지가 양호한가?';
                else if (row.ItemCode === 'ITEM_03') row.ItemText = '현장 내 통로가 확보되어 있고 비상구 주위 유해요인이 없는가?';
                else row.ItemText = `점검 항목 (${row.ItemCode})`;
            }
            return row;
        });
        return res.json({ success: true, data });
    } catch (err) {
        console.error('Fetch inspection details error:', err);
        return res.status(500).json({ success: false, message: '점검 세부 내역을 조회하는 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Equipments
app.get('/api/equipments', async (req, res) => {
    const { companyBranch } = req.query;
    try {
        const pool = await getPool();
        let query = 'SELECT equipment_id, equipment_name, equipment_type, company_branch FROM EquipmentMaster';
        let request = pool.request();
        if (companyBranch) {
            query += ' WHERE company_branch = @companyBranch';
            request.input('companyBranch', sql.NVarChar(100), companyBranch);
        }
        const result = await request.query(query);
        return res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Fetch equipments error:', err);
        return res.status(500).json({ success: false, message: '장비 목록을 조회하는 중 서버 오류가 발생했습니다.' });
    }
});

// API: Add Equipment
app.post('/api/equipments', async (req, res) => {
    const { equipmentName, equipmentType, companyBranch } = req.body;
    if (!equipmentName || !companyBranch) {
        return res.status(400).json({ success: false, message: '장비명과 사업장명은 필수입니다.' });
    }
    try {
        const pool = await getPool();
        const equipmentId = crypto.randomUUID();
        await pool.request()
            .input('equipmentId', sql.VarChar(36), equipmentId)
            .input('equipmentName', sql.NVarChar(150), equipmentName)
            .input('equipmentType', sql.VarChar(50), equipmentType || 'OTHER')
            .input('companyBranch', sql.NVarChar(100), companyBranch)
            .query('INSERT INTO EquipmentMaster (equipment_id, equipment_name, equipment_type, company_branch) VALUES (@equipmentId, @equipmentName, @equipmentType, @companyBranch)');
        return res.status(201).json({ success: true, message: '장비가 성공적으로 등록되었습니다.' });
    } catch (err) {
        console.error('Add equipment error:', err);
        return res.status(500).json({ success: false, message: '장비 등록 중 서버 오류가 발생했습니다.' });
    }
});

// API: Delete Equipment
app.delete('/api/equipments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('equipmentId', sql.VarChar(36), id)
            .query('DELETE FROM EquipmentMaster WHERE equipment_id = @equipmentId');
        return res.json({ success: true, message: '장비가 성공적으로 삭제되었습니다.' });
    } catch (err) {
        console.error('Delete equipment error:', err);
        return res.status(500).json({ success: false, message: '장비 삭제 중 서버 오류가 발생했습니다.' });
    }
});

// API: Get Checklist Items
app.get('/api/checklist-items', async (req, res) => {
    const { companyBranch } = req.query;
    try {
        const pool = await getPool();
        let query = 'SELECT item_id, company_branch, item_code, item_text, response_type FROM ChecklistItems';
        let request = pool.request();
        if (companyBranch) {
            query += ' WHERE company_branch = @companyBranch';
            request.input('companyBranch', sql.NVarChar(100), companyBranch);
        }
        query += ' ORDER BY item_code ASC';
        const result = await request.query(query);
        return res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Fetch checklist items error:', err);
        return res.status(500).json({ success: false, message: '체크리스트 항목을 조회하는 중 서버 오류가 발생했습니다.' });
    }
});

// API: Add Checklist Item
app.post('/api/checklist-items', async (req, res) => {
    const { companyBranch, itemCode, itemText, responseType } = req.body;
    if (!companyBranch || !itemCode || !itemText) {
        return res.status(400).json({ success: false, message: '사업장명, 항목코드, 항목내용은 필수입니다.' });
    }
    try {
        const pool = await getPool();
        const itemId = crypto.randomUUID();
        await pool.request()
            .input('itemId', sql.VarChar(36), itemId)
            .input('companyBranch', sql.NVarChar(100), companyBranch)
            .input('itemCode', sql.VarChar(10), itemCode)
            .input('itemText', sql.NVarChar(500), itemText)
            .input('responseType', sql.VarChar(20), responseType || 'YN')
            .query('INSERT INTO ChecklistItems (item_id, company_branch, item_code, item_text, response_type) VALUES (@itemId, @companyBranch, @itemCode, @itemText, @responseType)');
        return res.status(201).json({ success: true, message: '체크리스트 항목이 성공적으로 등록되었습니다.' });
    } catch (err) {
        console.error('Add checklist item error:', err);
        return res.status(500).json({ success: false, message: '체크리스트 항목 등록 중 서버 오류가 발생했습니다.' });
    }
});

// API: Delete Checklist Item
app.delete('/api/checklist-items/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('itemId', sql.VarChar(36), id)
            .query('DELETE FROM ChecklistItems WHERE item_id = @itemId');
        return res.json({ success: true, message: '체크리스트 항목이 성공적으로 삭제되었습니다.' });
    } catch (err) {
        console.error('Delete checklist item error:', err);
        return res.status(500).json({ success: false, message: '체크리스트 항목 삭제 중 서버 오류가 발생했습니다.' });
    }
});


// API: Base64 File Upload
app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;

    if (!fileName || !fileData) {
        return res.status(400).json({ success: false, message: '파일명과 파일 데이터를 모두 전송해야 합니다.' });
    }

    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }

        const base64Data = fileData.replace(/^data:.*?;base64,/, "");
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, base64Data, 'base64');
        return res.json({ success: true, fileUrl: `/uploads/${fileName}` });
    } catch (err) {
        console.error('File upload error:', err);
        return res.status(500).json({ success: false, message: '파일 업로드 중 서버 오류가 발생했습니다.' });
    }
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
