document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Header Scroll Effect
  // ==========================================
  const header = document.querySelector('.header');
  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Run once on load to catch page refresh at scrolled position

  // ==========================================
  // 2. Mobile Menu Toggle
  // ==========================================
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('navMenu');
  
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      nav.classList.toggle('active');
    });

    // Close menu when clicking navigation links (especially useful for hash links/anchors)
    const navLinks = nav.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        nav.classList.remove('active');
      });
    });
  }

  // ==========================================
  // 3. Scroll Reveal Animations (IntersectionObserver)
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Unobserve after showing so we don't re-animate every scroll unless desired
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(element => {
    revealObserver.observe(element);
  });

  // ==========================================
  // 4. Counter Animation for Statistics
  // ==========================================
  const counterElements = document.querySelectorAll('.stat-item-num');
  
  const animateCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    const suffix = counter.getAttribute('data-suffix') || '';
    const duration = 2000; // 2 seconds
    const startTime = performance.now();
    
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad formula for smooth decelerating
      const ease = progress * (2 - progress);
      const current = Math.floor(ease * target);
      
      // Formatting number with commas
      counter.textContent = current.toLocaleString() + suffix;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        counter.textContent = target.toLocaleString() + suffix;
      }
    };
    
    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.5
  });

  counterElements.forEach(counter => {
    counterObserver.observe(counter);
  });

  // ==========================================
  // 5. Contact Form Validation and Simulation
  // ==========================================
  const contactForm = document.getElementById('contactForm');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');

  if (contactForm && modalOverlay) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Form Input Values
      const name = document.getElementById('clientName').value.trim();
      const phone = document.getElementById('clientPhone').value.trim();
      const company = document.getElementById('companyName').value.trim();
      const email = document.getElementById('clientEmail').value.trim();
      const service = document.getElementById('inquiryType').value;
      const message = document.getElementById('messageText').value.trim();
      const agree = document.getElementById('agreeCheckbox').checked;

      // Basic Validation Check
      if (!name || !phone || !email || !service || !message) {
        alert('모든 필수 항목(*)을 입력해 주세요.');
        return;
      }

      if (!agree) {
        alert('개인정보처리방침에 동의해 주셔야 신청이 완료됩니다.');
        return;
      }

      // Simulate API submit delay (show loading button)
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '신청 전송 중...';

      setTimeout(() => {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        // Open Success Modal
        modalOverlay.classList.add('active');
        
        // Reset form fields
        contactForm.reset();
      }, 1200);
    });
  }

  // Close modal logic
  if (modalClose && modalOverlay) {
    modalClose.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    });
  }
});
