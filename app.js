/* ─── Meta Ads Reframe — shared app.js ─── */

(function () {
  const body = document.body;
  const vertical = body.dataset.vertical;
  const routeBase = body.dataset.route;
  const campaignDefault = body.dataset.campaign;

  /* ── UTM helpers ── */
  function getUTMs() {
    const p = new URLSearchParams(window.location.search);
    const utms = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
      if (p.get(k)) utms[k] = p.get(k);
    });
    return utms;
  }

  function buildDestination() {
    const utms = getUTMs();
    const params = new URLSearchParams(utms).toString();
    return params ? `${routeBase}?${params}` : routeBase;
  }

  /* ── Scroll reveals ── */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initReveal() {
    if (prefersReduced) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => entry.target.classList.add('visible'), delay);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach((el, i) => {
      if (!el.dataset.delay) el.dataset.delay = (i % 4) * 80;
      obs.observe(el);
    });
  }

  /* ── Highlighter sweeps ── */
  function initHighlighters() {
    if (prefersReduced) {
      document.querySelectorAll('.hl').forEach(el => el.classList.add('revealed'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('revealed'), 180);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('.hl').forEach(el => obs.observe(el));
  }

  /* ── Capture sheet ── */
  const overlay = document.getElementById('capture-overlay');
  const form = document.getElementById('lead-form');
  const openBtn = document.getElementById('cta-open');
  const closeBtn = document.getElementById('sheet-close');

  function openSheet() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const firstInput = form.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  function closeSheet() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openSheet);
  closeBtn.addEventListener('click', closeSheet);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSheet();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  /* ── Form validation ── */
  function setError(input, msg) {
    input.classList.add('error');
    let errEl = input.parentElement.querySelector('.form-error-msg');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'form-error-msg';
      input.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.classList.add('visible');
  }

  function clearError(input) {
    input.classList.remove('error');
    const errEl = input.parentElement.querySelector('.form-error-msg');
    if (errEl) errEl.classList.remove('visible');
  }

  ['first-name', 'last-name', 'email', 'phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearError(el));
  });

  function validateForm() {
    let valid = true;

    const firstName = document.getElementById('first-name');
    const lastName = document.getElementById('last-name');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const consent = document.getElementById('sms-consent');
    const consentGroup = consent.closest('.consent-group');

    if (!firstName.value.trim()) { setError(firstName, 'Required'); valid = false; }
    if (!lastName.value.trim()) { setError(lastName, 'Required'); valid = false; }
    if (!email.value.trim() || !email.value.includes('@')) {
      setError(email, 'Valid email required'); valid = false;
    }
    if (!phone.value.trim()) { setError(phone, 'Required'); valid = false; }
    if (!consent.checked) {
      consentGroup.classList.add('error');
      valid = false;
    } else {
      consentGroup.classList.remove('error');
    }

    return valid;
  }

  /* ── Submit ── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const utms = getUTMs();
    const campaign = utms.utm_campaign || campaignDefault;
    const source = utms.utm_source || 'direct';

    const payload = {
      first_name: document.getElementById('first-name').value.trim(),
      last_name: document.getElementById('last-name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      sms_consent: true,
      consent_timestamp: new Date().toISOString(),
      source,
      medium: 'Lead_Magnet',
      campaign,
      vertical,
      ts: new Date().toISOString(),
      ...utms,
    };

    try {
      await fetch('/.netlify/functions/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      /* fail-open: route regardless */
    }

    window.location.href = buildDestination();
  });

  /* ── Init ── */
  initReveal();
  initHighlighters();
})();
