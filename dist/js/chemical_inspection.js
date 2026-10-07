// ==========================================================================
// Safe_On: 유해화학물질 취급 공장별 현장점검 평가시트 클라이언트 로직
// ==========================================================================

(function() {
  // State
  let chemChecklistMaster = [];
  let chemItemEvaluations = {}; // itemId -> { evalStatus, maxScore, score, remarks }
  let currentActiveCategory = 'ALL';
  let currentEditingReportId = null;
  let isOnlyTargetPlantFilter = false;

  // Signature canvas
  let sigCanvas = null;
  let sigCtx = null;
  let isDrawingSig = false;

  // Target plant mappings based on the PDF
  const PLANT_CATEGORY_MAP = {
    '진영1공장': ['제조, 사용 시설 및 설비', '실내 저장, 보관 시설 및 설비', '실외저장, 보관 시설 및 설비', '배관 이송 시설 및 설비'],
    '진영2공장': ['제조, 사용 시설 및 설비', '실외저장, 보관 시설 및 설비', '배관 이송 시설 및 설비'],
    '담안공장': ['제조, 사용 시설 및 설비', '실외저장, 보관 시설 및 설비'],
    '의전공장': ['제조, 사용 시설 및 설비', '실내 저장, 보관 시설 및 설비', '차량 운반 시설 및 설비']
  };

  // Main init function
  window.initChemicalInspectionModule = function() {
    setupSubNav();
    setupSignaturePad();
    bindEvents();
    setDefaultValues();
    loadChecklistItems();
  };

  // Sub Navigation Mode Switching (작성/등록 <-> 이력 목록)
  function setupSubNav() {
    const btnModeForm = document.getElementById('btnChemModeForm');
    const btnModeList = document.getElementById('btnChemModeList');
    const secForm = document.getElementById('chemSectionForm');
    const secList = document.getElementById('chemSectionList');

    if (btnModeForm && btnModeList && secForm && secList) {
      btnModeForm.addEventListener('click', () => {
        btnModeForm.classList.add('active');
        btnModeList.classList.remove('active');
        secForm.style.display = 'block';
        secList.style.display = 'none';
      });

      btnModeList.addEventListener('click', () => {
        btnModeList.classList.add('active');
        btnModeForm.classList.remove('active');
        secForm.style.display = 'none';
        secList.style.display = 'block';
        loadChemicalInspectionHistory();
      });
    }
  }

  // Signature Pad Setup
  function setupSignaturePad() {
    sigCanvas = document.getElementById('chemSigCanvas');
    if (!sigCanvas) return;

    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#0f172a';

    const resizeCanvas = () => {
      const rect = sigCanvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sigCanvas.width = rect.width;
        sigCanvas.height = rect.height;
        sigCtx.lineWidth = 2.5;
        sigCtx.lineCap = 'round';
        sigCtx.strokeStyle = '#0f172a';
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getPos = (e) => {
      const rect = sigCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      isDrawingSig = true;
      const pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
      if (e.cancelable) e.preventDefault();
    };

    const moveDraw = (e) => {
      if (!isDrawingSig) return;
      const pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
      if (e.cancelable) e.preventDefault();
    };

    const stopDraw = () => {
      isDrawingSig = false;
    };

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', stopDraw);

    sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
    sigCanvas.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', stopDraw);

    const btnClear = document.getElementById('btnChemClearSig');
    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.preventDefault();
        clearSignature();
      });
    }
  }

  function clearSignature() {
    if (sigCtx && sigCanvas) {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
  }

  function isCanvasBlank(canvas) {
    if (!canvas) return true;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  }

  // Default values
  function setDefaultValues() {
    const dateInput = document.getElementById('chemInspDate');
    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }

    const inspectorInput = document.getElementById('chemInspectorName');
    const savedManager = sessionStorage.getItem('bizpro_manager_name') || '김안전 관리자';
    if (inspectorInput && !inspectorInput.value) {
      inspectorInput.value = savedManager;
    }

    const roleInput = document.getElementById('chemInspectorRole');
    if (roleInput && !roleInput.value) {
      roleInput.value = '안전보건관리책임자';
    }
  }

  // Load 78 checklist items from API
  async function loadChecklistItems() {
    try {
      const res = await fetch('/api/chemical-checklist-items');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        chemChecklistMaster = json.data;

        // Initialize evaluations state
        chemChecklistMaster.forEach(item => {
          if (!chemItemEvaluations[item.item_id]) {
            chemItemEvaluations[item.item_id] = {
              evalStatus: 'PASS',
              maxScore: item.default_score || 5,
              score: item.default_score || 5,
              remarks: ''
            };
          }
        });

        renderChecklistTable();
        updateKPISummary();
      }
    } catch (e) {
      console.error('Failed to load chemical checklist items:', e);
    }
  }

  // Bind UI Events
  function bindEvents() {
    // Plant Selection change
    const plantSelect = document.getElementById('chemPlantSelect');
    if (plantSelect) {
      plantSelect.addEventListener('change', () => {
        onPlantSelectionChange();
      });
    }

    // Category Tabs
    document.querySelectorAll('.chem-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chem-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentActiveCategory = btn.getAttribute('data-cat');
        renderChecklistTable();
      });
    });

    // Keyword Search
    const searchInput = document.getElementById('chemKeywordSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderChecklistTable();
      });
    }

    // Target Plant Only Toggle
    const targetOnlyCheck = document.getElementById('chemTargetOnlyCheck');
    if (targetOnlyCheck) {
      targetOnlyCheck.addEventListener('change', (e) => {
        isOnlyTargetPlantFilter = e.target.checked;
        renderChecklistTable();
      });
    }

    // Batch Set All Pass
    const btnBatchPass = document.getElementById('btnChemBatchPass');
    if (btnBatchPass) {
      btnBatchPass.addEventListener('click', () => {
        setAllVisibleItemsPass();
      });
    }

    // Submit / Draft Buttons
    const btnSubmit = document.getElementById('btnChemSubmit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        submitChemicalInspection('COMPLETED');
      });
    }

    const btnDraft = document.getElementById('btnChemSaveDraft');
    if (btnDraft) {
      btnDraft.addEventListener('click', () => {
        submitChemicalInspection('DRAFT');
      });
    }

    // Print Preview Modal Open
    const btnPrintPreview = document.getElementById('btnChemPrintPreview');
    if (btnPrintPreview) {
      btnPrintPreview.addEventListener('click', () => {
        openPrintModalCurrent();
      });
    }

    // AI Analysis Button
    const btnAIAnalysis = document.getElementById('btnChemAIAnalysis');
    if (btnAIAnalysis) {
      btnAIAnalysis.addEventListener('click', () => {
        runChemicalAIAnalysis();
      });
    }

    // Filter Search in History List
    const btnHistorySearch = document.getElementById('btnChemHistorySearch');
    if (btnHistorySearch) {
      btnHistorySearch.addEventListener('click', () => {
        loadChemicalInspectionHistory();
      });
    }
  }

  // Handle Plant Selection Change
  function onPlantSelectionChange() {
    const selectedPlant = document.getElementById('chemPlantSelect').value;
    const applicableCategories = PLANT_CATEGORY_MAP[selectedPlant] || [];

    // Highlight or mark category buttons
    document.querySelectorAll('.chem-cat-btn').forEach(btn => {
      const cat = btn.getAttribute('data-cat');
      if (cat === 'ALL') return;
      if (applicableCategories.includes(cat)) {
        btn.style.borderColor = '#0284c7';
      } else {
        btn.style.borderColor = '#e2e8f0';
      }
    });

    renderChecklistTable();
    updateKPISummary();
  }

  // Render 78 Checklist Items Table
  function renderChecklistTable() {
    const tbody = document.getElementById('chemChecklistTableBody');
    if (!tbody) return;

    const selectedPlant = document.getElementById('chemPlantSelect') ? document.getElementById('chemPlantSelect').value : '진영1공장';
    const keyword = (document.getElementById('chemKeywordSearch') ? document.getElementById('chemKeywordSearch').value : '').trim().toLowerCase();

    // Filter items
    const filteredItems = chemChecklistMaster.filter(item => {
      // 1. Category filter
      if (currentActiveCategory !== 'ALL' && item.category_main !== currentActiveCategory) {
        return false;
      }

      // 2. Target Plant Only Filter
      const isTarget = item.plant_targets.includes(selectedPlant) || selectedPlant === '전체';
      if (isOnlyTargetPlantFilter && !isTarget) {
        return false;
      }

      // 3. Keyword Search
      if (keyword) {
        const text = (item.detail_content + ' ' + item.category_sub + ' ' + item.check_method).toLowerCase();
        if (!text.includes(keyword)) return false;
      }

      return true;
    });

    // Update Counts on Category Buttons
    updateCategoryCounts();

    if (filteredItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
            검색 및 필터 조건에 부합하는 체크리스트 항목이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    filteredItems.forEach((item, index) => {
      const evalData = chemItemEvaluations[item.item_id] || {
        evalStatus: 'PASS',
        maxScore: item.default_score || 5,
        score: item.default_score || 5,
        remarks: ''
      };

      const isTarget = item.plant_targets.includes(selectedPlant) || selectedPlant === '전체';
      const rowClass = isTarget ? '' : 'chem-row-inapplicable';

      rowsHtml += `
        <tr class="${rowClass}" data-item-id="${item.item_id}">
          <td style="font-weight: 600; color: #0f172a; text-align: center; width: 150px;">
            ${item.category_main}
            <div>
              <span class="chem-target-badge ${isTarget ? '' : 'not-target'}">
                ${isTarget ? '✓ ' + selectedPlant + ' 적용' : '비대상'}
              </span>
            </div>
          </td>
          <td style="text-align: center; font-weight: 700; color: #475569; width: 45px;">
            ${item.item_no}
          </td>
          <td style="font-weight: 600; text-align: center; width: 90px; color: #1e3a8a;">
            ${item.category_sub}
          </td>
          <td style="text-align: center; width: 110px;">
            <span class="chem-method-badge">${item.check_method}</span>
          </td>
          <td style="font-size: 13px; color: #1e293b; line-height: 1.5;">
            ${escapeHtml(item.detail_content)}
          </td>
          <td style="text-align: center; width: 55px; font-weight: 700; color: #64748b;">
            ${item.default_score}점
          </td>
          <td style="text-align: center; width: 175px;">
            <div class="chem-eval-options">
              <label class="chem-eval-opt">
                <input type="radio" name="eval_stat_${item.item_id}" value="PASS" ${evalData.evalStatus === 'PASS' ? 'checked' : ''} onchange="chemOnEvalChange(${item.item_id}, 'PASS', ${item.default_score})">
                <span class="opt-pass">적합</span>
              </label>
              <label class="chem-eval-opt">
                <input type="radio" name="eval_stat_${item.item_id}" value="FAIL" ${evalData.evalStatus === 'FAIL' ? 'checked' : ''} onchange="chemOnEvalChange(${item.item_id}, 'FAIL', ${item.default_score})">
                <span class="opt-fail">부적합</span>
              </label>
              <label class="chem-eval-opt">
                <input type="radio" name="eval_stat_${item.item_id}" value="NA" ${evalData.evalStatus === 'NA' ? 'checked' : ''} onchange="chemOnEvalChange(${item.item_id}, 'NA', ${item.default_score})">
                <span class="opt-na">N/A</span>
              </label>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 6px;">
              <span style="font-size: 11px; color: #64748b;">평점:</span>
              <input type="number" class="chem-score-input" min="0" max="${item.default_score}" value="${evalData.score}" id="score_input_${item.item_id}" onchange="chemOnScoreChange(${item.item_id}, this.value, ${item.default_score})">
              <span style="font-size: 11px; color: #94a3b8;">/ ${item.default_score}</span>
            </div>
          </td>
          <td style="width: 140px;">
            <input type="text" class="chem-remarks-input" placeholder="비고/조치사항 메모" value="${escapeHtml(evalData.remarks || '')}" onchange="chemOnRemarksChange(${item.item_id}, this.value)">
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  // Update counts on Category Tabs
  function updateCategoryCounts() {
    const selectedPlant = document.getElementById('chemPlantSelect') ? document.getElementById('chemPlantSelect').value : '진영1공장';
    
    // Count total
    const cntAll = chemChecklistMaster.length;
    const elAll = document.getElementById('chemCatCountAll');
    if (elAll) elAll.textContent = cntAll;

    const categories = [
      { id: 'chemCatCount1', name: '제조, 사용 시설 및 설비' },
      { id: 'chemCatCount2', name: '실내 저장, 보관 시설 및 설비' },
      { id: 'chemCatCount3', name: '실외저장, 보관 시설 및 설비' },
      { id: 'chemCatCount4', name: '배관 이송 시설 및 설비' },
      { id: 'chemCatCount5', name: '차량 운반 시설 및 설비' }
    ];

    categories.forEach(c => {
      const el = document.getElementById(c.id);
      if (el) {
        const count = chemChecklistMaster.filter(i => i.category_main === c.name).length;
        el.textContent = count;
      }
    });
  }

  // Global event delegates for table inputs
  window.chemOnEvalChange = function(itemId, status, defaultScore) {
    if (!chemItemEvaluations[itemId]) {
      chemItemEvaluations[itemId] = { evalStatus: 'PASS', maxScore: defaultScore, score: defaultScore, remarks: '' };
    }
    chemItemEvaluations[itemId].evalStatus = status;

    const scoreInput = document.getElementById(`score_input_${itemId}`);
    if (status === 'PASS') {
      chemItemEvaluations[itemId].score = defaultScore;
      if (scoreInput) scoreInput.value = defaultScore;
    } else if (status === 'FAIL') {
      chemItemEvaluations[itemId].score = 0;
      if (scoreInput) scoreInput.value = 0;
    } else if (status === 'NA') {
      chemItemEvaluations[itemId].score = 0;
      if (scoreInput) scoreInput.value = 0;
    }

    updateKPISummary();
  };

  window.chemOnScoreChange = function(itemId, value, maxScore) {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
    if (num > maxScore) num = maxScore;
    if (num < 0) num = 0;

    if (!chemItemEvaluations[itemId]) {
      chemItemEvaluations[itemId] = { evalStatus: 'PASS', maxScore, score: num, remarks: '' };
    }
    chemItemEvaluations[itemId].score = num;

    const input = document.getElementById(`score_input_${itemId}`);
    if (input) input.value = num;

    updateKPISummary();
  };

  window.chemOnRemarksChange = function(itemId, text) {
    if (!chemItemEvaluations[itemId]) {
      chemItemEvaluations[itemId] = { evalStatus: 'PASS', maxScore: 5, score: 5, remarks: text };
    } else {
      chemItemEvaluations[itemId].remarks = text;
    }
  };

  // Set all visible items to PASS
  function setAllVisibleItemsPass() {
    chemChecklistMaster.forEach(item => {
      chemItemEvaluations[item.item_id] = {
        evalStatus: 'PASS',
        maxScore: item.default_score || 5,
        score: item.default_score || 5,
        remarks: chemItemEvaluations[item.item_id] ? chemItemEvaluations[item.item_id].remarks : ''
      };
    });
    renderChecklistTable();
    updateKPISummary();
  }

  // Update Real-time KPI Scorecards
  function updateKPISummary() {
    const selectedPlant = document.getElementById('chemPlantSelect') ? document.getElementById('chemPlantSelect').value : '진영1공장';

    let totalScore = 0;
    let earnedScore = 0;
    let passCount = 0;
    let failCount = 0;
    let naCount = 0;
    let applicableCount = 0;

    chemChecklistMaster.forEach(item => {
      const isTarget = item.plant_targets.includes(selectedPlant) || selectedPlant === '전체';
      const ev = chemItemEvaluations[item.item_id] || {
        evalStatus: 'PASS',
        maxScore: item.default_score || 5,
        score: item.default_score || 5
      };

      if (isTarget) {
        applicableCount++;
        totalScore += ev.maxScore;
        earnedScore += ev.score;

        if (ev.evalStatus === 'PASS') passCount++;
        else if (ev.evalStatus === 'FAIL') failCount++;
        else naCount++;
      }
    });

    const rate = totalScore > 0 ? Math.round((earnedScore / totalScore) * 100) : 100;

    const elTotal = document.getElementById('chemKpiTotalScore');
    const elRate = document.getElementById('chemKpiRate');
    const elPass = document.getElementById('chemKpiPassCount');
    const elFail = document.getElementById('chemKpiFailCount');
    const elNa = document.getElementById('chemKpiNaCount');
    const elCount = document.getElementById('chemKpiItemCount');

    if (elTotal) elTotal.textContent = `${earnedScore} / ${totalScore}점`;
    if (elRate) elRate.textContent = `${rate}%`;
    if (elPass) elPass.textContent = `${passCount}건`;
    if (elFail) elFail.textContent = `${failCount}건`;
    if (elNa) elNa.textContent = `${naCount}건`;
    if (elCount) elCount.textContent = `${applicableCount}개 항목`;
  }

  // Submit Chemical Inspection
  async function submitChemicalInspection(status = 'COMPLETED') {
    const plantName = document.getElementById('chemPlantSelect').value;
    const inspectionCategory = document.getElementById('chemInspCategory').value;
    const inspectionDate = document.getElementById('chemInspDate').value;
    const inspectorName = document.getElementById('chemInspectorName').value.trim();
    const inspectorRole = document.getElementById('chemInspectorRole').value.trim();
    const summaryNotes = document.getElementById('chemSummaryNotes').value.trim();

    if (!plantName || !inspectionCategory || !inspectionDate || !inspectorName) {
      alert('필수 기본 정보(공장명, 점검구분, 점검일자, 점검자)를 모두 입력해 주세요.');
      return;
    }

    // Capture Signature
    let signatureData = null;
    if (sigCanvas && !isCanvasBlank(sigCanvas)) {
      signatureData = sigCanvas.toDataURL('image/png');
    }

    // Prepare Results
    const results = chemChecklistMaster.map(item => {
      const ev = chemItemEvaluations[item.item_id] || {
        evalStatus: 'PASS',
        maxScore: item.default_score || 5,
        score: item.default_score || 5,
        remarks: ''
      };
      return {
        itemId: item.item_id,
        evalStatus: ev.evalStatus,
        maxScore: ev.maxScore,
        score: ev.score,
        remarks: ev.remarks
      };
    });

    const payload = {
      plantName,
      inspectionCategory,
      inspectionDate,
      inspectorName,
      inspectorRole,
      summaryNotes,
      signatureData,
      overallStatus: status,
      results
    };

    try {
      const res = await fetch('/api/chemical-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert(`[성공] ${data.message} (문서번호: ${data.reportId})`);
        
        // Switch to history tab
        const btnModeList = document.getElementById('btnChemModeList');
        if (btnModeList) btnModeList.click();
      } else {
        alert(`[오류] ${data.message}`);
      }
    } catch (e) {
      console.error('Submit error:', e);
      alert('서버와 통신하는 중 오류가 발생했습니다.');
    }
  }

  // Load Inspection History List
  async function loadChemicalInspectionHistory() {
    const tbody = document.getElementById('chemHistoryTableBody');
    if (!tbody) return;

    const startDate = document.getElementById('chemFilterStartDate') ? document.getElementById('chemFilterStartDate').value : '';
    const endDate = document.getElementById('chemFilterEndDate') ? document.getElementById('chemFilterEndDate').value : '';
    const plantName = document.getElementById('chemFilterPlant') ? document.getElementById('chemFilterPlant').value : 'ALL';
    const status = document.getElementById('chemFilterStatus') ? document.getElementById('chemFilterStatus').value : 'ALL';

    let url = `/api/chemical-inspections?plantName=${encodeURIComponent(plantName)}&status=${encodeURIComponent(status)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;

    try {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">점검 이력을 조회하는 중입니다...</td></tr>`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        if (json.data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: #94a3b8;">등록된 유해화학물질 현장점검 이력이 없습니다.</td></tr>`;
          return;
        }

        let html = '';
        json.data.forEach((r, idx) => {
          const rate = r.total_score > 0 ? Math.round((r.earned_score / r.total_score) * 100) : 100;
          const statusBadge = r.overall_status === 'COMPLETED'
            ? `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">점검완료</span>`
            : `<span style="background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">임시저장</span>`;

          html += `
            <tr>
              <td style="font-weight: 700; color: #0284c7;">${r.report_id}</td>
              <td style="font-weight: 600;">${r.inspection_date}</td>
              <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${r.plant_name}</span></td>
              <td>${r.inspection_category}</td>
              <td><strong>${r.inspector_name}</strong> <span style="font-size: 11px; color: #64748b;">(${r.inspector_role || '관리자'})</span></td>
              <td><strong>${r.earned_score}</strong> / ${r.total_score}점 <span style="color: ${rate >= 90 ? '#10b981' : (rate >= 70 ? '#f59e0b' : '#ef4444')}; font-weight: 700;">(${rate}%)</span></td>
              <td>
                <span style="color: #10b981; font-weight: 600;">적합 ${r.pass_count}</span> / 
                <span style="color: #ef4444; font-weight: 600;">부적합 ${r.fail_count}</span>
              </td>
              <td>${statusBadge}</td>
              <td>
                <div style="display: flex; gap: 4px; justify-content: center;">
                  <button class="chem-btn-action" style="padding: 4px 8px; font-size: 11.5px;" onclick="viewChemicalInspectionDetail('${r.report_id}')">상세/수정</button>
                  <button class="chem-btn-action" style="padding: 4px 8px; font-size: 11.5px;" onclick="openPrintModalById('${r.report_id}')">🖨️ 인쇄</button>
                  <button class="chem-btn-action" style="padding: 4px 8px; font-size: 11.5px; color: #ef4444;" onclick="deleteChemicalInspection('${r.report_id}')">삭제</button>
                </div>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }
    } catch (e) {
      console.error('History load error:', e);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #ef4444;">점검 이력 조회 중 오류가 발생했습니다.</td></tr>`;
    }
  }

  // View / Edit Detail
  window.viewChemicalInspectionDetail = async function(reportId) {
    try {
      const res = await fetch(`/api/chemical-inspections/${reportId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const { report, results } = json.data;

        // Switch to Form tab
        const btnModeForm = document.getElementById('btnChemModeForm');
        if (btnModeForm) btnModeForm.click();

        // Populate header
        document.getElementById('chemPlantSelect').value = report.plant_name;
        document.getElementById('chemInspCategory').value = report.inspection_category;
        document.getElementById('chemInspDate').value = report.inspection_date;
        document.getElementById('chemInspectorName').value = report.inspector_name;
        document.getElementById('chemInspectorRole').value = report.inspector_role || '';
        document.getElementById('chemSummaryNotes').value = report.summary_notes || '';

        // Populate evaluations
        results.forEach(r => {
          chemItemEvaluations[r.item_id] = {
            evalStatus: r.eval_status,
            maxScore: r.max_score,
            score: r.score,
            remarks: r.remarks || ''
          };
        });

        // Restore signature if available
        if (report.signature_data && sigCtx && sigCanvas) {
          const img = new Image();
          img.onload = () => {
            clearSignature();
            sigCtx.drawImage(img, 0, 0);
          };
          img.src = report.signature_data;
        }

        renderChecklistTable();
        updateKPISummary();
        alert(`점검 번호 [${report.report_id}] 데이터를 불러왔습니다.`);
      }
    } catch (e) {
      console.error('Detail load error:', e);
      alert('상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // Delete Chemical Inspection
  window.deleteChemicalInspection = async function(reportId) {
    if (!confirm(`점검 기록 [${reportId}]을(를) 정말로 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/chemical-inspections/${reportId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert('성공적으로 삭제되었습니다.');
        loadChemicalInspectionHistory();
      } else {
        alert(`[삭제 실패] ${json.message}`);
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Open Print Modal for Current Form
  function openPrintModalCurrent() {
    const plantName = document.getElementById('chemPlantSelect').value;
    const inspectionCategory = document.getElementById('chemInspCategory').value;
    const inspectionDate = document.getElementById('chemInspDate').value;
    const inspectorName = document.getElementById('chemInspectorName').value;
    const inspectorRole = document.getElementById('chemInspectorRole').value;
    const summaryNotes = document.getElementById('chemSummaryNotes').value;

    let sigDataUrl = '';
    if (sigCanvas && !isCanvasBlank(sigCanvas)) {
      sigDataUrl = sigCanvas.toDataURL('image/png');
    }

    const items = chemChecklistMaster.map(m => {
      const ev = chemItemEvaluations[m.item_id] || {
        evalStatus: 'PASS',
        score: m.default_score || 5,
        maxScore: m.default_score || 5,
        remarks: ''
      };
      return {
        ...m,
        eval_status: ev.evalStatus,
        score: ev.score,
        max_score: ev.maxScore,
        remarks: ev.remarks
      };
    });

    renderPrintSheet({
      report_id: 'CHEM-PREVIEW',
      plant_name: plantName,
      inspection_category: inspectionCategory,
      inspection_date: inspectionDate,
      inspector_name: inspectorName,
      inspector_role: inspectorRole,
      summary_notes: summaryNotes,
      signature_data: sigDataUrl
    }, items);
  }

  // Open Print Modal for Saved Report
  window.openPrintModalById = async function(reportId) {
    try {
      const res = await fetch(`/api/chemical-inspections/${reportId}`);
      const json = await res.json();
      if (json.success && json.data) {
        renderPrintSheet(json.data.report, json.data.results);
      }
    } catch (e) {
      console.error(e);
      alert('인쇄 양식을 불러오는 중 오류가 발생했습니다.');
    }
  };

  // Render 4-Page Print Sheet Layout (Matching user's PDF exact structure!)
  function renderPrintSheet(report, items) {
    const modal = document.getElementById('chemPrintModalOverlay');
    const container = document.getElementById('chemPrintSheetContainer');
    if (!modal || !container) return;

    let totalMax = 0;
    let totalScore = 0;
    let passCount = 0;
    let failCount = 0;

    items.forEach(it => {
      totalMax += (it.max_score || it.default_score || 5);
      totalScore += (it.score !== undefined ? it.score : 5);
      if (it.eval_status === 'PASS') passCount++;
      if (it.eval_status === 'FAIL') failCount++;
    });

    const rate = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 100;

    let rowsHtml = '';
    items.forEach(it => {
      const statText = it.eval_status === 'PASS' ? '적합' : (it.eval_status === 'FAIL' ? '부적합' : 'N/A');
      const statColor = it.eval_status === 'PASS' ? '#059669' : (it.eval_status === 'FAIL' ? '#dc2626' : '#64748b');

      rowsHtml += `
        <tr>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 11px; font-weight: bold; background: #fafafa;">
            ${it.category_main}
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 11px; font-weight: bold;">
            ${it.item_no}
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 11px; font-weight: bold;">
            ${it.category_sub}
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 10.5px;">
            ${it.check_method}
          </td>
          <td style="border: 1px solid #333; padding: 6px 8px; font-size: 11px; line-height: 1.4; text-align: left;">
            ${escapeHtml(it.detail_content)}
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 11px;">
            ${it.max_score || it.default_score || 5}
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: center; font-size: 11px; font-weight: bold; color: ${statColor};">
            ${it.score} (${statText})
          </td>
          <td style="border: 1px solid #333; padding: 6px 4px; text-align: left; font-size: 10.5px;">
            ${escapeHtml(it.remarks || '')}
          </td>
        </tr>
      `;
    });

    const sheetHtml = `
      <div style="font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; color: #000; padding: 15px; background: #fff;">
        <!-- Header Section matching PDF -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">
              공장별 현장점검 평가시트
            </h2>
            <div style="font-size: 14px; font-weight: 700; color: #334155; margin-top: 6px;">
              ■ 유해화학물질 취급 공장별 평가기준 체크리스트
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
              문서번호: ${report.report_id} | 발행일자: ${new Date().toLocaleDateString('ko-KR')}
            </div>
          </div>

          <!-- Top-right Meta Box matching PDF -->
          <table style="border-collapse: collapse; width: 260px; font-size: 11.5px; border: 1.5px solid #000;">
            <tr>
              <th style="border: 1px solid #000; padding: 4px 6px; background: #f3f4f6; width: 75px; text-align: center;">공장명</th>
              <td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold; text-align: center;">${report.plant_name}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 4px 6px; background: #f3f4f6; text-align: center;">점검구분</th>
              <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">${report.inspection_category}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 4px 6px; background: #f3f4f6; text-align: center;">점검일자</th>
              <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">${report.inspection_date}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 4px 6px; background: #f3f4f6; text-align: center;">점검자</th>
              <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <span>${report.inspector_name}</span>
                  ${report.signature_data ? `<img src="${report.signature_data}" style="max-height: 24px; vertical-align: middle;">` : `<span>(인)</span>`}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Score summary line -->
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; font-weight: bold; background: #f8fafc; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 4px;">
          <span>총 점검 항목: ${items.length}개</span>
          <span>적합: <span style="color: #059669;">${passCount}건</span> / 부적합: <span style="color: #dc2626;">${failCount}건</span></span>
          <span>평가 총점: ${totalScore} / ${totalMax}점 (적합률: ${rate}%)</span>
        </div>

        <!-- 78 Items Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="border: 1px solid #000; padding: 6px 4px; width: 130px; font-size: 11.5px;">대분류</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 35px; font-size: 11.5px;">No</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 85px; font-size: 11.5px;">중분류</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 100px; font-size: 11.5px;">점검방법</th>
              <th style="border: 1px solid #000; padding: 6px 8px; font-size: 11.5px;">평가 세부 내용</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 45px; font-size: 11.5px;">배점</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 80px; font-size: 11.5px;">평점</th>
              <th style="border: 1px solid #000; padding: 6px 4px; width: 110px; font-size: 11.5px;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Summary Notes & Action Box -->
        <div style="margin-top: 14px; border: 1px solid #000; padding: 10px; background: #fff;">
          <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">■ 현장 종합 소견 및 개선 조치 의견</div>
          <div style="font-size: 11.5px; line-height: 1.5; color: #1e293b; min-height: 40px;">
            ${report.summary_notes ? escapeHtml(report.summary_notes).replace(/\n/g, '<br>') : '특이사항 없음.'}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = sheetHtml;
    modal.classList.add('active');
  }

  window.closeChemPrintModal = function() {
    const modal = document.getElementById('chemPrintModalOverlay');
    if (modal) modal.classList.remove('active');
  };

  window.triggerChemWindowPrint = function() {
    window.print();
  };

  // Run AI Safety Diagnosis Analysis (Gemini Integration)
  async function runChemicalAIAnalysis() {
    const plantName = document.getElementById('chemPlantSelect').value;
    const inspectionDate = document.getElementById('chemInspDate').value;
    const inspectorName = document.getElementById('chemInspectorName').value;
    const summaryNotes = document.getElementById('chemSummaryNotes').value;

    const modal = document.getElementById('chemAIModalOverlay');
    const content = document.getElementById('chemAIModalContent');
    if (modal && content) {
      modal.classList.add('active');
      content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 32px; animation: spin 1s infinite linear;">✨</div>
          <p style="margin-top: 16px; font-size: 14px; color: #475569; font-weight: 600;">
            비즈프로 AI가 화관법 및 PSM 기준에 따라 안전진단 리포트를 작성하고 있습니다...
          </p>
        </div>
      `;
    }

    const results = chemChecklistMaster.map(item => {
      const ev = chemItemEvaluations[item.item_id] || { evalStatus: 'PASS', score: 5, remarks: '' };
      return {
        categoryMain: item.category_main,
        categorySub: item.category_sub,
        detailContent: item.detail_content,
        evalStatus: ev.evalStatus,
        remarks: ev.remarks
      };
    });

    try {
      const res = await fetch('/api/chemical-inspections/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantName,
          inspectionDate,
          inspectorName,
          summaryNotes,
          results
        })
      });
      const data = await res.json();

      if (data.success && data.answer) {
        if (content) {
          content.innerHTML = `
            <div style="line-height: 1.6; font-size: 13.5px; color: #1e293b; white-space: pre-wrap; padding: 10px;">
              ${escapeHtml(data.answer)}
            </div>
          `;
        }
      } else {
        if (content) {
          content.innerHTML = `<p style="color: #ef4444; padding: 20px;">AI 분석 결과를 가져올 수 없습니다.</p>`;
        }
      }
    } catch (e) {
      console.error('AI analysis error:', e);
      if (content) {
        content.innerHTML = `<p style="color: #ef4444; padding: 20px;">AI 분석 요청 중 오류가 발생했습니다.</p>`;
      }
    }
  }

  window.closeChemAIModal = function() {
    const modal = document.getElementById('chemAIModalOverlay');
    if (modal) modal.classList.remove('active');
  };

  // Utility
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
