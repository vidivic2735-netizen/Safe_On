document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
  // ==========================================
  // 1. Tab Switching Control
  // ==========================================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const formsSlider = document.getElementById('formsSlider');
  const tabIndicator = document.querySelector('.tab-indicator');
  const slideLogin = document.querySelector('.form-slide.slide-login');
  const slideSignup = document.querySelector('.form-slide.slide-signup');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      
      // Update active button
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      if (target === 'login') {
        // Move slider to login
        formsSlider.style.transform = 'translateX(0%)';
        // Position indicator to left
        tabIndicator.style.transform = 'translateX(0)';
        // Adjust opacities
        slideLogin.style.opacity = '1';
        slideSignup.style.opacity = '0';
      } else if (target === 'signup') {
        // Move slider to signup
        formsSlider.style.transform = 'translateX(-50%)';
        // Position indicator to right
        tabIndicator.style.transform = 'translateX(100%)';
        // Adjust opacities
        slideLogin.style.opacity = '0';
        slideSignup.style.opacity = '1';
      }
    });
  });

  // ==========================================
  // 2. Sign Up Password Validation
  // ==========================================
  const signupPwd = document.getElementById('signupPwd');
  const signupPwdConfirm = document.getElementById('signupPwdConfirm');
  const pwdMatchMsg = document.getElementById('pwdMatchMsg');

  const checkPasswords = () => {
    const pwdVal = signupPwd.value;
    const confirmVal = signupPwdConfirm.value;

    if (!confirmVal) {
      pwdMatchMsg.textContent = '';
      pwdMatchMsg.className = 'validation-message';
      return false;
    }

    if (pwdVal === confirmVal) {
      pwdMatchMsg.textContent = '비밀번호가 일치합니다.';
      pwdMatchMsg.className = 'validation-message success';
      return true;
    } else {
      pwdMatchMsg.textContent = '비밀번호가 일치하지 않습니다.';
      pwdMatchMsg.className = 'validation-message error';
      return false;
    }
  };

  signupPwd.addEventListener('input', checkPasswords);
  signupPwdConfirm.addEventListener('input', checkPasswords);

  // ==========================================
  // 3. Modal Controls
  // ==========================================
  const modalOverlay = document.getElementById('loginModalOverlay');
  const modalIcon = document.getElementById('modalIcon');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalClose = document.getElementById('loginModalClose');
  
  let modalRedirectTarget = null; // 'login-tab' or 'dashboard' or null

  const showModal = (icon, title, desc, redirectAction = null) => {
    if (icon === 'success') {
      modalIcon.textContent = '✓';
      modalIcon.className = 'modal-icon';
    } else if (icon === 'error') {
      modalIcon.textContent = '✕';
      modalIcon.className = 'modal-icon error';
    }
    
    modalTitle.textContent = title;
    modalDesc.innerHTML = desc;
    modalRedirectTarget = redirectAction;
    
    modalOverlay.classList.add('active');
  };

  modalClose.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    
    if (modalRedirectTarget === 'login-tab') {
      // Switch back to Login Tab
      const loginTabBtn = document.querySelector('.tab-btn[data-target="login"]');
      if (loginTabBtn) loginTabBtn.click();
    } else if (modalRedirectTarget === 'dashboard') {
      // Redirect to Incident Management Dashboard
      window.location.href = 'dashboard.html';
    }
  });

  // ==========================================
  // 4. Form Submit Simulators
  // ==========================================
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  // Login Form Submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = document.getElementById('loginId').value.trim();
      const password = document.getElementById('loginPwd').value;
      const rememberId = document.getElementById('rememberId').checked;

      if (!username || !password) {
        alert('아이디와 비밀번호를 모두 입력해 주세요.');
        return;
      }

      // Login Progress
      const submitBtn = loginForm.querySelector('.form-submit-btn');
      const originalText = submitBtn.querySelector('span:first-child').textContent;
      const spinner = submitBtn.querySelector('.spinner');

      submitBtn.disabled = true;
      submitBtn.querySelector('span:first-child').textContent = '로그인 중...';
      if (spinner) spinner.style.display = 'inline-block';

      // Save ID to localStorage if checked
      if (rememberId) {
        localStorage.setItem('bizpro_remembered_id', username);
      } else {
        localStorage.removeItem('bizpro_remembered_id');
      }

      // API Call
      fetch(API_BASE + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: username, password: password })
      })
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        submitBtn.disabled = false;
        submitBtn.querySelector('span:first-child').textContent = originalText;
        if (spinner) spinner.style.display = 'none';

        if (status === 200 && data.success) {
          // Store session data temporarily
          sessionStorage.setItem('bizpro_manager_name', data.user.userName);
          sessionStorage.setItem('bizpro_company_name', data.user.companyName || '(주)비즈안전');

          // Success
          showModal(
            'success',
            '로그인 성공',
            `${data.user.userName}님 환영합니다!<br>사고관리 시스템에 성공적으로 로그인했습니다.<br>잠시 후 사고관리 대시보드로 이동합니다.`,
            'dashboard'
          );
          // Auto redirect after 1.5 seconds
          setTimeout(() => {
            if (modalOverlay.classList.contains('active') && modalRedirectTarget === 'dashboard') {
              window.location.href = 'dashboard.html';
            }
          }, 1500);
        } else {
          // Failure
          showModal(
            'error',
            '로그인 실패',
            data.message || '로그인 중 오류가 발생했습니다.'
          );
        }
      })
      .catch(err => {
        submitBtn.disabled = false;
        submitBtn.querySelector('span:first-child').textContent = originalText;
        if (spinner) spinner.style.display = 'none';
        console.error(err);
        showModal('error', '로그인 오류', '서버와 통신할 수 없습니다.');
      });
    });
  }

  // Pre-populate remembered ID if exists
  const savedId = localStorage.getItem('bizpro_remembered_id');
  if (savedId && document.getElementById('loginId')) {
    document.getElementById('loginId').value = savedId;
    document.getElementById('rememberId').checked = true;
  }

  // Signup Form Submit
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const companyName = document.getElementById('companyName').value.trim();
      const bizRegisterNo = document.getElementById('bizRegisterNo').value.trim();
      const signupId = document.getElementById('signupId').value.trim();
      const managerName = document.getElementById('managerName').value.trim();
      const managerPhone = document.getElementById('managerPhone').value.trim();
      const pwdVal = signupPwd.value;
      const confirmVal = signupPwdConfirm.value;

      if (pwdVal !== confirmVal) {
        alert('비밀번호 확인이 일치하지 않습니다.');
        return;
      }

      const signupAgree = document.getElementById('signupAgree').checked;
      if (!signupAgree) {
        alert('이용약관에 동의하셔야 회원가입이 가능합니다.');
        return;
      }

      // Register Progress
      const submitBtn = signupForm.querySelector('.form-submit-btn');
      const originalText = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = '회원 등록 중...';

      // API Call
      fetch(API_BASE + '/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          bizRegisterNo,
          signupId,
          signupPwd: pwdVal,
          managerName,
          managerPhone
        })
      })
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (status === 201 && data.success) {
          // Reset forms
          signupForm.reset();
          pwdMatchMsg.textContent = '';
          pwdMatchMsg.className = 'validation-message';

          // Show Success and switch tab on close
          showModal(
            'success',
            '신규 회원 가입 완료',
            '사고관리 시스템 회원 가입이 완료되었습니다.<br>로그인 화면으로 이동합니다. 가입하신 계정으로 로그인해 주세요.',
            'login-tab'
          );
        } else {
          showModal(
            'error',
            '회원가입 실패',
            data.message || '회원가입 처리 중 오류가 발생했습니다.'
          );
        }
      })
      .catch(err => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        console.error(err);
        showModal('error', '회원가입 오류', '서버와 통신할 수 없습니다.');
      });
    });
  }

  // Find Credentials Sim link
  const findCredentials = document.getElementById('findCredentials');
  if (findCredentials) {
    findCredentials.addEventListener('click', (e) => {
      e.preventDefault();
      alert('비밀번호 재설정 이메일을 발송하기 위해 사내 인사 관리자 또는 비즈프로 고객지원센터(1544-0000)로 문의해 주세요.');
    });
  }
});
