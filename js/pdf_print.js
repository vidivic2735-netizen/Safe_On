// PDF Print helper functions
const getVal = (id, fallback = '') => {
  const el = document.getElementById(id);
  return el ? (el.value || fallback) : fallback;
};

const getChecked = (id) => {
  const el = document.getElementById(id);
  return el ? el.checked : false;
};

function printAccidentReport(selectedIncident, companyName) {
  if (!selectedIncident) {
    alert('출력할 사고를 선택해 주세요.');
    return;
  }

  const branch = selectedIncident.CompanyBranch || companyName;
  const location = getVal('compAccidentLocation', selectedIncident.Location || '');
  const dateTime = getVal('compAccidentDateTime', selectedIncident.OccurrenceDateTime || '');
  const product = getVal('compReportProduct', selectedIncident.ReportProduct || '');
  const process = getVal('compReportDeptProcess', selectedIncident.ReportDeptProcess || '');

  const fatalCount = getVal('compReportCasualtyFatal', selectedIncident.ReportCasualtyFatal || '0');
  const injuredCount = getVal('compReportCasualtyInjured', selectedIncident.ReportCasualtyInjured || '0');
  const workType = getVal('compReportWorkShiftType', selectedIncident.ReportWorkShiftType || '단독');
  const workCount = getVal('compReportWorkShiftCount', selectedIncident.ReportWorkShiftCount || '');

  const typeCode = getVal('compAccidentTypeCode', selectedIncident.AccidentTypeCode || '');
  const causeObject = getVal('compReportCauseObject', selectedIncident.ReportCauseObject || '');

  const who = getVal('compHexaWho', selectedIncident.HexaWho || '');
  const when = getVal('compHexaWhen', selectedIncident.HexaWhen || '');
  const where = getVal('compHexaWhere', selectedIncident.HexaWhere || '');
  const what = getVal('compHexaWhat', selectedIncident.HexaWhat || '');
  const how = getVal('compHexaHow', selectedIncident.HexaHow || '');
  const why = getVal('compHexaWhy', selectedIncident.HexaWhy || '');

  const name = getVal('compVictimName', selectedIncident.VictimName || '');
  const rrn = getVal('compVictimRrn', selectedIncident.VictimRrn || '');
  const entryDate = getVal('compVictimEntryDate', selectedIncident.VictimEntryDate || '');
  const workDuration = getVal('compVictimSameWorkDuration', selectedIncident.VictimSameWorkDuration || '');
  const empType = getVal('compVictimEmploymentType', selectedIncident.VictimEmploymentType || '상용');
  const occurTimeType = getVal('compReportOccurTimeType', selectedIncident.ReportOccurTimeType || '정규작업');
  const workShift = getVal('compVictimWorkShift', selectedIncident.VictimWorkShift || '정상');
  const laborLossType = getVal('compReportLaborLossType', selectedIncident.ReportLaborLossType || '부상');

  const absenceDays = getVal('compAbsenceDays', selectedIncident.ActualAbsenceDays || '0');
  const restrictedDays = getVal('compReportRestrictedWorkDays', selectedIncident.ReportRestrictedWorkDays || '0');
  const position = getVal('compReportVictimPosition', selectedIncident.ReportVictimPosition || '');

  const injuryType = getVal('compInjuryType', selectedIncident.InjuryType || '');
  const injuryPart = getVal('compInjuryPart', selectedIncident.InjuryPart || '');
  const harmObject = getVal('compReportHarmObject', selectedIncident.ReportHarmObject || '');

  const regularWork = getVal('compReportRegularWork', selectedIncident.ReportRegularWork || '');
  const accidentWork = getVal('compReportAccidentWork', selectedIncident.ReportAccidentWork || '');

  const investigationDate = getVal('compReportInvestigationDate', selectedIncident.ReportInvestigationDate || '');
  const supervisor = getVal('compReportSupervisor', selectedIncident.ReportSupervisor || '');
  const preventPlan = getVal('compPreventPlan', selectedIncident.PreventPlan || '');

  const photo1 = selectedIncident.AttachmentPath1 || selectedIncident.photoPath || '';
  const situation = getVal('compAccidentSituation', selectedIncident.AccidentSituation || '');
  const cause = getVal('compAccidentCause', selectedIncident.AccidentCause || '');

  const formatDate = (str) => {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const formattedDateTime = dateTime ? dateTime.replace('T', ' ') : '';

  const listItemsHtml = preventPlan
    ? preventPlan.split('\n').map(line => '<li>' + line + '</li>').join('')
    : '<li>LOTO(Lock Out Tag Out) 미실시 방지 조치 및 안전 센서 인터록 관리 철저</li><li>신규 근로자 및 일용직 대상 작업 시작 전 TBM 시 위해요인 교육 의무화</li>';

  const photoHtml = photo1
    ? `<img src="${photo1}" class="photo-img" />`
    : '<div style="height: 180px; display:flex; align-items:center; justify-content:center; border: 1px dashed #ccc; margin-bottom:8px; color:#aaa;">현장 사진 없음</div>';

  const reportWindow = window.open('', '_blank', 'width=900,height=950');
  reportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <title>사고경위보고서 - ${name || ''}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        body {
          font-family: 'Noto Sans KR', sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          background: #fff;
          font-size: 12px;
        }
        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: white;
          page-break-after: always;
        }
        .page:last-child {
          page-break-after: avoid;
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 26px;
          font-weight: 700;
          text-align: center;
          margin: 0;
          flex: 1;
          letter-spacing: 2px;
          text-decoration: underline;
          text-underline-offset: 6px;
        }
        .approval-table {
          border-collapse: collapse;
          font-size: 10px;
        }
        .approval-table th, .approval-table td {
          border: 1px solid #000;
          text-align: center;
          padding: 3px;
        }
        .approval-table th {
          background-color: #f2f2f2;
          width: 50px;
          font-weight: 500;
        }
        .approval-table td {
          height: 45px;
          vertical-align: middle;
        }
        table.form-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        table.form-table th, table.form-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: left;
          vertical-align: middle;
        }
        table.form-table th {
          background-color: #f2f2f2;
          font-weight: 600;
          width: 110px;
          text-align: center;
        }
        .text-center {
          text-align: center !important;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          margin: 8px 0 4px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .section-title::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 14px;
          background-color: #0284c7;
        }
        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .hexa-grid {
          display: grid;
          grid-template-columns: 80px 1fr;
          border: 1px solid #000;
          border-bottom: none;
        }
        .hexa-label {
          background-color: #f8fafc;
          font-weight: 600;
          text-align: center;
          padding: 4px 6px;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hexa-value {
          padding: 4px 6px;
          border-bottom: 1px solid #000;
          line-height: 1.5;
        }
        .footer-logo {
          margin-top: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 1px;
        }
        .footer-logo img {
          height: 24px;
        }
        .photo-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 10px;
        }
        .photo-box {
          border: 1px solid #000;
          padding: 10px;
          text-align: center;
          background: #fafafa;
        }
        .photo-img {
          max-width: 100%;
          max-height: 180px;
          border: 1px solid #ccc;
          margin-bottom: 8px;
        }
        .bullet-list {
          margin: 0;
          padding-left: 20px;
          line-height: 1.6;
        }
        @media print {
          body {
            padding: 0;
          }
          .page {
            border: none;
            margin: 0;
            padding: 10mm;
            width: auto;
            min-height: auto;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <!-- Page 1 -->
      <div class="page">
        <div class="header-section" style="display: block; margin-bottom: 20px;">
          <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
            <table class="approval-table">
              <tr>
                <th rowspan="2" style="width:20px; writing-mode: vertical-rl; text-orientation: upright; padding: 5px 2px;">결재</th>
                <th>담당</th>
                <th>검토</th>
                <th>검토</th>
                <th>대리</th>
                <th>사장</th>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </table>
          </div>
          <h1 style="text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 2px; text-decoration: underline; text-underline-offset: 6px; margin: 10px 0;">
            사 고 경 위 보 고 서 <span style="font-size:16px; font-weight:500;">(인사사고관련)</span>
          </h1>
        </div>

        <table class="form-table">
          <tr>
            <th>사고장소</th>
            <td>${location}</td>
            <th>발생일시</th>
            <td>${formattedDateTime}</td>
          </tr>
          <tr>
            <th>생산품</th>
            <td>${product}</td>
            <th>발생(부서/공정)</th>
            <td>${process}</td>
          </tr>
          <tr>
            <th>인적피해</th>
            <td>사망 ( ${fatalCount} )명, 부상 ( ${injuredCount} )명</td>
            <th>작업형태</th>
            <td>
              ${workType === '단독' ? '☑' : '☐'} 단독,
              ${workType === '복수' ? '☑' : '☐'} 복수 (${workCount || 0}명)
            </td>
          </tr>
          <tr>
            <th>발생형태</th>
            <td>${typeCode}</td>
            <th>기인물(원인물)</th>
            <td>${causeObject}</td>
          </tr>
        </table>

        <div class="section-title">재해발생과정 및 원인 (6하원칙)</div>
        <div class="hexa-grid">
          <div class="hexa-label">누가</div>
          <div class="hexa-value">${who || '-'}</div>
          <div class="hexa-label">언제</div>
          <div class="hexa-value">${when || '-'}</div>
          <div class="hexa-label">어디서</div>
          <div class="hexa-value">${where || '-'}</div>
          <div class="hexa-label">무엇을</div>
          <div class="hexa-value">${what || '-'}</div>
          <div class="hexa-label">어떻게</div>
          <div class="hexa-value">${how || '-'}</div>
          <div class="hexa-label">왜</div>
          <div class="hexa-value">${why || '-'}</div>
        </div>

        <div class="section-title">재해자 상세 정보</div>
        <table class="form-table">
          <tr>
            <th>성명</th>
            <td>${name}</td>
            <th>주민번호</th>
            <td>${rrn || '******-*******'}</td>
            <th>입사일</th>
            <td>${formatDate(entryDate)}</td>
            <th>근속기간</th>
            <td>${workDuration}</td>
          </tr>
          <tr>
            <th>고용형태</th>
            <td colspan="3">
              <div class="checkbox-group">
                <span class="checkbox-item">${empType === '상용' ? '☑' : '☐'} 상용</span>
                <span class="checkbox-item">${empType === '임시' ? '☑' : '☐'} 임시</span>
                <span class="checkbox-item">${empType === '일용' ? '☑' : '☐'} 일용</span>
                <span class="checkbox-item">${(empType !== '상용' && empType !== '임시' && empType !== '일용') ? '☑' : '☐'} 기타</span>
              </div>
            </td>
            <th>발생시점</th>
            <td colspan="3">
              <div class="checkbox-group">
                <span class="checkbox-item">${occurTimeType === '정규작업' ? '☑' : '☐'} 정규작업</span>
                <span class="checkbox-item">${occurTimeType === '식사휴식' ? '☑' : '☐'} 식사휴식</span>
                <span class="checkbox-item">${occurTimeType === '작업전' ? '☑' : '☐'} 작업전</span>
                <span class="checkbox-item">${occurTimeType === '출퇴근' ? '☑' : '☐'} 출퇴근</span>
              </div>
            </td>
          </tr>
          <tr>
            <th>근무형태</th>
            <td colspan="3">
              <div class="checkbox-group">
                <span class="checkbox-item">${workShift === '정상' ? '☑' : '☐'} 정상</span>
                <span class="checkbox-item">${workShift === '2교대' ? '☑' : '☐'} 2교대</span>
                <span class="checkbox-item">${workShift === '3교대' ? '☑' : '☐'} 3교대</span>
                <span class="checkbox-item">${(workShift !== '정상' && workShift !== '2교대' && workShift !== '3교대') ? '☑' : '☐'} 기타</span>
              </div>
            </td>
            <th>근로손실</th>
            <td colspan="3">
              <div class="checkbox-group">
                <span class="checkbox-item">${laborLossType === '사망' ? '☑' : '☐'} 사망</span>
                <span class="checkbox-item">${laborLossType === '부상' ? '☑' : '☐'} 부상</span>
                <span class="checkbox-item">휴업일수 ( ${absenceDays} )일</span>
                <span class="checkbox-item">제한일수 ( ${restrictedDays} )일</span>
              </div>
            </td>
          </tr>
          <tr>
            <th>직위</th>
            <td>${position}</td>
            <th>상해종류</th>
            <td>${injuryType}</td>
            <th>상해부위</th>
            <td>${injuryPart}</td>
            <th>가해물</th>
            <td>${harmObject}</td>
          </tr>
          <tr>
            <th>평상시 작업</th>
            <td colspan="3">${regularWork || '-'}</td>
            <th>재해당시 작업</th>
            <td colspan="3">${accidentWork || '-'}</td>
          </tr>
        </table>

        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ccc; padding-top: 8px;">
          <div>조사일시 : ${formatDate(investigationDate) || formatDate(new Date())}</div>
          <div>관리감독자(사고경위조사자) : ${supervisor || '김안전'} (인)</div>
        </div>

        <div class="footer-logo">
          <span style="font-size: 16px; color:#1e3a8a;">🏢</span>
          <span>${branch}</span>
        </div>
      </div>

      <!-- Page 2 -->
      <div class="page">
        <div class="section-title" style="font-size:16px;">재해발생원인 (재해발생 공정 및 설비 사진 첨부)</div>
        <div class="photo-container">
          <div class="photo-box">
            <div style="font-weight: 600; margin-bottom: 8px;">&lt;사고 장소 및 위치 사진&gt;</div>
            ${photoHtml}
            <div style="font-size:11px; color:#666;">사고 현장 전경 및 관련 설비</div>
          </div>
          <div class="photo-box">
            <div style="font-weight: 600; margin-bottom: 8px;">&lt;상세 작업 상황 도해/사진&gt;</div>
            <div style="height: 180px; display:flex; align-items:center; justify-content:center; border: 1px dashed #ccc; margin-bottom:8px; color:#aaa;">상세 사진 없음</div>
            <div style="font-size:11px; color:#666;">작업 시 위해 요인 및 불안전 행동 지점</div>
          </div>
        </div>

        <div class="section-title">부연 설명 및 사고 상황분석</div>
        <table class="form-table">
          <tr>
            <th>상황 설명</th>
            <td>${situation || '특이 사항 없음'}</td>
          </tr>
          <tr>
            <th>사고 원인</th>
            <td>${cause || '불안전한 상태 및 행동적 요인 확인 필요'}</td>
          </tr>
        </table>

        <div class="section-title" style="font-size:16px;">재발방지대책 (근원적인 대책)</div>
        <div style="border: 1px solid #000; padding: 15px 20px; min-height: 150px; background:#fff;">
          <ul class="bullet-list" style="color: #c2410c; font-weight: 600;">
            ${listItemsHtml}
          </ul>
        </div>

        <div class="footer-logo" style="margin-top: 50px;">
          <span style="font-size: 16px; color:#1e3a8a;">🏢</span>
          <span>${branch}</span>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  reportWindow.document.close();
}

function printGovReport(selectedIncident, companyName) {
  if (!selectedIncident) {
    alert('출력할 사고를 선택해 주세요.');
    return;
  }

  const branch = companyName;
  const companyNo = getVal('compGovCompanyNo', selectedIncident.GovCompanyNo || '');
  const bizNo = getVal('compGovBizNo', selectedIncident.GovBizNo || '');
  const empCount = getVal('compGovEmpCount', selectedIncident.GovEmpCount || '');
  const industryType = getVal('compGovIndustryType', selectedIncident.GovIndustryType || '');
  const location = getVal('compGovLocation', selectedIncident.GovLocation || '');

  const subName = getVal('compGovSubcontractorName', selectedIncident.GovSubcontractorName || '');
  const subNo = getVal('compGovSubcontractorNo', selectedIncident.GovSubcontractorNo || '');
  const dispName = getVal('compGovDispatcherName', selectedIncident.GovDispatcherName || '');
  const dispNo = getVal('compGovDispatcherNo', selectedIncident.GovDispatcherNo || '');

  const client = getVal('compGovConstructionClient', selectedIncident.GovConstructionClient || '');
  const priName = getVal('compGovConstructionPrimaryName', selectedIncident.GovConstructionPrimaryName || '');
  const priNo = getVal('compGovConstructionPrimaryNo', selectedIncident.GovConstructionPrimaryNo || '');
  const constName = getVal('compGovConstructionName', selectedIncident.GovConstructionName || '');
  const constType = getVal('compGovConstructionType', selectedIncident.GovConstructionType || '');
  const constRatio = getVal('compGovConstructionRatio', selectedIncident.GovConstructionRatio || '');
  const constAmount = getVal('compGovConstructionAmount', selectedIncident.GovConstructionAmount || '');

  const name = getVal('compVictimName', selectedIncident.VictimName || '');
  const rrn = getVal('compVictimRrn', selectedIncident.VictimRrn || '');
  const address = getVal('compVictimAddress', selectedIncident.VictimAddress || '');
  const phone = getVal('compVictimPhone', selectedIncident.VictimPhone || '');
  const nationality = getVal('compVictimNationality', selectedIncident.VictimNationality || '');
  const visa = getVal('compVictimVisa', selectedIncident.VictimVisa || '');
  const occupation = getVal('compVictimOccupation', selectedIncident.VictimOccupation || '');
  const entryDate = getVal('compVictimEntryDate', selectedIncident.VictimEntryDate || '');
  const workDuration = getVal('compVictimSameWorkDuration', selectedIncident.VictimSameWorkDuration || '');

  const empType = getVal('compVictimEmploymentType', selectedIncident.VictimEmploymentType || '상용');
  const workShift = getVal('compVictimWorkShift', selectedIncident.VictimWorkShift || '정상');
  const injuryType = getVal('compInjuryType', selectedIncident.InjuryType || '');
  const injuryPart = getVal('compInjuryPart', selectedIncident.InjuryPart || '');
  const absenceDays = getVal('compGovAbsenceDays', selectedIncident.GovAbsenceDays || '');
  const isFatal = getChecked('compGovIsFatal');

  const dateTime = getVal('compAccidentDateTime', selectedIncident.AccidentDateTime || '');
  const accidentLocation = getVal('compAccidentLocation', selectedIncident.AccidentLocation || '');
  const workType = getVal('compAccidentWorkType', selectedIncident.AccidentWorkType || '');
  const situation = getVal('compAccidentSituation', selectedIncident.AccidentSituation || '');
  const cause = getVal('compAccidentCause', selectedIncident.AccidentCause || '');
  const preventPlan = getVal('compPreventPlan', selectedIncident.PreventPlan || '');

  const reqTech = getChecked('compGovRequestTechSupport');
  const agreePrivacy = getChecked('compGovAgreePrivacy');
  const writerName = getVal('compGovWriterName', selectedIncident.GovWriterName || '');
  const writerPhone = getVal('compGovWriterPhone', selectedIncident.GovWriterPhone || '');
  const writeDate = getVal('compGovWriteDate', selectedIncident.GovWriteDate || '');

  const formatDate = (str) => {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  // Extract date components
  let dateObj = dateTime ? new Date(dateTime) : null;
  let year = dateObj ? dateObj.getFullYear() : '';
  let month = dateObj ? dateObj.getMonth() + 1 : '';
  let date = dateObj ? dateObj.getDate() : '';
  let dayOfWeek = dateObj ? ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()] : '';
  let hour = dateObj ? dateObj.getHours() : '';
  let minute = dateObj ? dateObj.getMinutes() : '';

  const reportWindow = window.open('', '_blank', 'width=900,height=950');
  reportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <title>산업재해조사표 - ${name || ''}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        body {
          font-family: 'Noto Sans KR', sans-serif;
          margin: 0;
          padding: 20px;
          color: #000;
          background: #fff;
          font-size: 11px;
          line-height: 1.4;
        }
        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 8mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: white;
        }
        .title-container {
          text-align: center;
          margin-bottom: 10px;
          position: relative;
        }
        .law-info {
          font-size: 10px;
          text-align: left;
          font-weight: 500;
          margin-bottom: 5px;
        }
        h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 5px 0;
          letter-spacing: 3px;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 5px;
          font-size: 9.5px;
        }
        .meta-table td {
          border: 1px solid #000;
          padding: 4px;
          text-align: center;
        }
        .meta-table td.label {
          background-color: #f2f2f2;
          font-weight: 600;
          width: 12%;
        }
        .section-desc {
          font-size: 9.5px;
          margin-bottom: 5px;
          color: #555;
        }
        table.gov-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
        }
        table.gov-table th, table.gov-table td {
          border: 1px solid #000;
          padding: 5px 6px;
          vertical-align: middle;
        }
        table.gov-table td.label-col {
          background-color: #f2f2f2;
          font-weight: 600;
          text-align: center;
          font-size: 10px;
        }
        table.gov-table td.section-label {
          background-color: #e6e6e6;
          font-weight: 700;
          text-align: center;
          font-size: 12px;
          width: 60px;
        }
        .sub-label {
          font-size: 9px;
          font-weight: normal;
          color: #444;
          display: block;
        }
        .checkbox-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .footer-sig-section {
          margin-top: 15px;
          border: 1px solid #000;
          padding: 10px 15px;
        }
        .footer-sig-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        @media print {
          body {
            padding: 0;
          }
          .page {
            border: none;
            margin: 0;
            padding: 8mm;
            width: auto;
            min-height: auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="law-info">■ 산업안전보건법 시행규칙 [별지 제30호서식] &lt;개정 2025. 5. 30.&gt;</div>
        <div class="title-container">
          <h1>산 업 재 해 조 사 표</h1>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">접수번호</td>
            <td style="width: 21%;">-</td>
            <td class="label">접수일자</td>
            <td style="width: 21%;">-</td>
            <td class="label">처리일자</td>
            <td style="width: 21%;">-</td>
            <td class="label">처리기간</td>
            <td style="width: 8%;">14일</td>
          </tr>
        </table>
        
        <div class="section-desc">※ 뒤쪽의 작성방법을 읽고 작성하시기 바라며, [ ]에는 해당하는 곳에 √ 또는 ☑ 표시를 합니다. (앞쪽)</div>

        <table class="gov-table">
          <!-- I. 사업장 정보 -->
          <tr>
            <td class="section-label" rowspan="7">Ⅰ.<br>사 업 장<br>정 보</td>
            <td class="label-col" style="width:140px;">① 산재관리번호<br><span class="sub-label">(사업개시번호)</span></td>
            <td style="width:250px;">${companyNo}</td>
            <td class="label-col" style="width:120px;">사업자등록번호</td>
            <td>${bizNo}</td>
          </tr>
          <tr>
            <td class="label-col">② 사업장명</td>
            <td>${branch}</td>
            <td class="label-col">③ 근로자 수</td>
            <td>${empCount ? empCount + ' 명' : ''}</td>
          </tr>
          <tr>
            <td class="label-col">④ 업종</td>
            <td>${industryType}</td>
            <td class="label-col">소재지</td>
            <td>${location}</td>
          </tr>
          <tr>
            <td class="label-col">⑤ 사내수급인 소속<br><span class="sub-label">(건설업 제외)</span></td>
            <td colspan="3">
              원도급인 사업장명: ${subName || '공란'} &nbsp;&nbsp;&nbsp;&nbsp; 
              원도급 산재관리번호: ${subNo || '공란'}
            </td>
          </tr>
          <tr>
            <td class="label-col">⑥ 파견근로자 정보</td>
            <td colspan="3">
              파견사업주 사업장명: ${dispName || '공란'} &nbsp;&nbsp;&nbsp;&nbsp; 
              파견 산재관리번호: ${dispNo || '공란'}
            </td>
          </tr>
          <tr>
            <td class="label-col" rowspan="2">건설업만 작성</td>
            <td colspan="3">
              발주자 구분: [ ${client ? '☑ ' + client : '☐ 민간  ☐ 국가·지방자치단체  ☐ 공공기관'} ] &nbsp;&nbsp;&nbsp;&nbsp;
              원수급 사업장명: ${priName || '공란'} &nbsp;&nbsp;&nbsp;&nbsp;
              원수급 산재관리번호: ${priNo || '공란'}
            </td>
          </tr>
          <tr>
            <td colspan="3">
              공사현장 명: ${constName || '공란'} &nbsp;&nbsp;&nbsp;&nbsp;
              공사종류: ${constType || '공란'} &nbsp;&nbsp;&nbsp;&nbsp;
              공정률: ${constRatio ? constRatio + '%' : ''} &nbsp;&nbsp;&nbsp;&nbsp;
              공사금액: ${constAmount ? constAmount + ' 백만원' : ''}
            </td>
          </tr>

          <!-- II. 재해자 정보 -->
          <tr>
            <td class="section-label" rowspan="6">Ⅱ.<br>재 해 자<br>정 보</td>
            <td class="label-col">성명</td>
            <td>${name}</td>
            <td class="label-col">주민등록번호<br><span class="sub-label">(앞 7자리)</span></td>
            <td>${rrn || '******-*'}******</td>
          </tr>
          <tr>
            <td class="label-col">주소</td>
            <td colspan="3">${address}</td>
          </tr>
          <tr>
            <td class="label-col">국적 / 체류자격</td>
            <td>${nationality} ${visa ? '/ ' + visa : ''}</td>
            <td class="label-col">휴대전화 / 직업</td>
            <td>${phone} ${occupation ? '/ ' + occupation : ''}</td>
          </tr>
          <tr>
            <td class="label-col">입사일</td>
            <td>${formatDate(entryDate)}</td>
            <td class="label-col">동종업무 근속기간</td>
            <td>${workDuration}</td>
          </tr>
          <tr>
            <td class="label-col">⑬ 고용형태</td>
            <td>
              <div class="checkbox-row">
                <span>[ ${empType === '상용' ? '☑' : ' '} ] 상용</span>
                <span>[ ${empType === '임시' ? '☑' : ' '} ] 임시</span>
                <span>[ ${empType === '일용' ? '☑' : ' '} ] 일용</span>
                <span>[ ${(empType !== '상용' && empType !== '임시' && empType !== '일용') ? '☑' : ' '} ] 기타</span>
              </div>
            </td>
            <td class="label-col">⑭ 근무형태</td>
            <td>
              <div class="checkbox-row">
                <span>[ ${workShift === '정상' ? '☑' : ' '} ] 정상</span>
                <span>[ ${workShift === '2교대' ? '☑' : ' '} ] 2교대</span>
                <span>[ ${workShift === '3교대' ? '☑' : ' '} ] 3교대</span>
                <span>[ ${(workShift !== '정상' && workShift !== '2교대' && workShift !== '3교대') ? '☑' : ' '} ] 기타</span>
              </div>
            </td>
          </tr>
          <tr>
            <td class="label-col">⑮ 상해종류 / 상해부위</td>
            <td>${injuryType} / ${injuryPart}</td>
            <td class="label-col">휴업예상일수 / 사망여부</td>
            <td>휴업일수 [ ${absenceDays || '0'} ] 일 &nbsp;&nbsp;&nbsp;&nbsp; 사망여부: [ ${isFatal ? '☑ 사망  ☐ 생존' : '☐ 사망  ☑ 생존'} ]</td>
          </tr>

          <!-- III. 재해발생 개요 및 원인 -->
          <tr>
            <td class="section-label" rowspan="4">Ⅲ.<br>재해발생<br>개요 및<br>원인</td>
            <td class="label-col" rowspan="3">⑱ 재해발생개요</td>
            <td colspan="3">
              발생일시: ${year ? year + '년' : ''} ${month ? month + '월' : ''} ${date ? date + '일' : ''} ${dayOfWeek ? dayOfWeek + '요일' : ''} ${hour ? hour + '시' : ''} ${minute ? minute + '분' : ''}
            </td>
          </tr>
          <tr>
            <td colspan="3">발생장소: ${accidentLocation}</td>
          </tr>
          <tr>
            <td colspan="3">
              재해관련 작업유형: ${workType}<br>
              <div style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
                <strong>당시 상황:</strong> ${situation}
              </div>
            </td>
          </tr>
          <tr>
            <td class="label-col">⑲ 재해발생원인</td>
            <td colspan="3">${cause}</td>
          </tr>

          <!-- IV. 재발방지계획 -->
          <tr>
            <td class="section-label">Ⅳ.<br>재발방지<br>계획</td>
            <td class="label-col">⑳ 재발방지계획</td>
            <td colspan="3" style="line-height: 1.5; min-height: 80px; vertical-align: top;">
              ${preventPlan ? preventPlan.replace(/\n/g, '<br>') : '인터록 방호장치 점검 및 LOTO 절차 준수 교육 실시.'}
            </td>
          </tr>
        </table>

        <div class="footer-sig-section">
          <div class="footer-sig-row">
            <span>☑ 안전보건공단 즉시 기술지원 서비스 요청: [ ${reqTech ? 'V' : ' '} ] 신청 &nbsp;&nbsp;&nbsp;&nbsp; [ ${!reqTech ? 'V' : ' '} ] 미신청</span>
            <span>☑ 개인정보 활용 동의: [ ${agreePrivacy ? 'V' : ' '} ] 동의 &nbsp;&nbsp;&nbsp;&nbsp; [ ${!agreePrivacy ? 'V' : ' '} ] 부동의</span>
          </div>
          
          <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:11px;">
            <div>작성자 성명: ${writerName || '김안전'}</div>
            <div>전화번호: ${writerPhone || '010-0000-0000'}</div>
            <div>작성일: ${formatDate(writeDate) || formatDate(new Date())}</div>
          </div>
          
          <div style="margin-top: 25px; display: flex; justify-content: space-around; font-size: 12px; font-weight: 700;">
            <div>사업주: ____________________ (서명 또는 인)</div>
            <div>근로자대표(재해자): ____________________ (서명 또는 인)</div>
          </div>
        </div>

        <div style="margin-top: 20px; font-size: 14px; font-weight: 700; text-align: center; letter-spacing: 2px;">
          지방고용노동청(지청)장 귀하
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  reportWindow.document.close();
}
