(function () {
  var AUTH_STORAGE_KEY = 'ielts_user_email';
  var DEVICE_KEY_STORAGE = 'ielts_device_key';
  var PROGRESS_PREFIX = 'ielts_progress_';
  var MAX_RESULTS_PER_SECTION = 200;
  var API_BASE = window.__API_BASE__ || '';
  var PREMIUM_RULES_URL = 'https://t.me/m/a1GrXtnLY2Iy';

  // Cache keys for the lightweight bootstrap snapshot (premium + materials).
  // The progress payload is already persisted by saveLocalData, so this snapshot
  // only covers the parts that previously had to be re-fetched on every visit.
  var BOOTSTRAP_CACHE_PREFIX = 'ielts_bootstrap_v1_';
  var BOOTSTRAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24h hard cap
  var BOOTSTRAP_REVALIDATE_AFTER_MS = 60 * 1000;     // refresh if older than 1 min
  var CLIENT_REFRESH_STORAGE_KEY = 'ielts_client_refresh_generation';
  var CLIENT_REFRESH_POLL_MS = 30000;
  var syncPromise = null;
  var syncResultCached = null;
  var premiumAccessPromise = null;
  var materialAccessPromise = null;
  var bootstrapPromise = null;
  var bootstrapAttempted = false;
  var clientRefreshPromise = null;
  var clientRefreshTimer = null;
  var premiumAccessState = {
    loaded: false,
    hasAccess: false,
    isAdmin: false,
    email: '',
    notes: '',
    decidedBy: '',
    decidedAt: ''
  };
  var materialAccessState = {
    loaded: false,
    items: [],
    byId: {},
    byPath: {}
  };

  function installSafariCompat() {
    if (!String.prototype.padStart) {
      String.prototype.padStart = function (targetLength, padString) {
        var value = String(this);
        var length = targetLength >> 0;
        var fill = padString === undefined ? ' ' : String(padString);
        if (value.length >= length) return value;
        if (!fill) fill = ' ';
        while (fill.length < length - value.length) fill += fill;
        return fill.slice(0, length - value.length) + value;
      };
    }

    if (!Array.from) {
      Array.from = function (items, mapFn, thisArg) {
        var arr = [];
        if (!items) return arr;
        for (var i = 0; i < items.length; i++) {
          arr.push(mapFn ? mapFn.call(thisArg, items[i], i) : items[i]);
        }
        return arr;
      };
    }

    if (!Object.assign) {
      Object.assign = function (target) {
        if (target == null) throw new TypeError('Cannot convert undefined or null to object');
        var output = Object(target);
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];
          if (source == null) continue;
          for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) output[key] = source[key];
          }
        }
        return output;
      };
    }

    if (window.NodeList && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = Array.prototype.forEach;
    }

    if (window.HTMLCollection && !HTMLCollection.prototype.forEach) {
      HTMLCollection.prototype.forEach = Array.prototype.forEach;
    }

    if (window.Element && !Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }

    if (window.Element && !Element.prototype.closest) {
      Element.prototype.closest = function (selector) {
        var el = this;
        while (el && el.nodeType === 1) {
          if (el.matches && el.matches(selector)) return el;
          el = el.parentElement || el.parentNode;
        }
        return null;
      };
    }
  }

  installSafariCompat();

  function nowIso() {
    return new Date().toISOString();
  }

  function buildAttemptId(section, submittedAt) {
    return String(section || 'test') + '_attempt_' + String(submittedAt || nowIso()).replace(/[^0-9A-Za-z]/g, '');
  }

  function isSavedAttemptReview() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return !!params.get('attempt') && params.get('redo') !== '1';
    } catch (e) {
      return false;
    }
  }

  function getEmail() {
    try {
      return (localStorage.getItem(AUTH_STORAGE_KEY) || '').trim().toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function getDeviceKey() {
    try {
      var existing = localStorage.getItem(DEVICE_KEY_STORAGE);
      if (existing) {
        document.cookie = DEVICE_KEY_STORAGE + '=' + encodeURIComponent(String(existing)) + '; Path=/; Max-Age=31536000; SameSite=Lax';
        return String(existing);
      }
      var created;
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        created = 'dev_' + crypto.randomUUID().replace(/-/g, '');
      } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        created = 'dev_' + Array.from(buf).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      } else {
        created = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      }
      localStorage.setItem(DEVICE_KEY_STORAGE, created);
      document.cookie = DEVICE_KEY_STORAGE + '=' + encodeURIComponent(created) + '; Path=/; Max-Age=31536000; SameSite=Lax';
      return created;
    } catch (e) {
      return '';
    }
  }

  function isNetworkFailureMessage(message) {
    var text = String(message || '').trim().toLowerCase();
    return text === 'load failed' || text.indexOf('failed to fetch') !== -1 || text.indexOf('networkerror') !== -1;
  }

  function authHeaders(extra) {
    var headers = Object.assign({}, extra || {});
    var deviceKey = getDeviceKey();
    if (deviceKey) headers['X-Device-Key'] = deviceKey;
    return headers;
  }

  function cleanClientRefreshQuery() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has('site_refresh')) return;
      url.searchParams.delete('site_refresh');
      window.history.replaceState(
        window.history.state,
        document.title,
        url.pathname + (url.searchParams.toString() ? ('?' + url.searchParams.toString()) : '') + url.hash
      );
    } catch (e) {}
  }

  function shouldDeferClientRefresh() {
    if (isProtectedTestPath(window.location.pathname)) return true;
    if (/\/mock(?:\.html)?$/i.test(window.location.pathname)) {
      try {
        return !!(
          localStorage.getItem('ielts_mock_active_part') ||
          sessionStorage.getItem('ielts_mock_active_part') ||
          (document.body && document.body.classList.contains('mock-frame-open'))
        );
      } catch (e) {
        return !!(document.body && document.body.classList.contains('mock-frame-open'));
      }
    }
    return false;
  }

  function reloadForClientRefresh(generation) {
    var nextGeneration = Math.max(0, Number(generation) || 0);
    try {
      localStorage.setItem(CLIENT_REFRESH_STORAGE_KEY, String(nextGeneration));
    } catch (e) {}
    try {
      sessionStorage.setItem(CLIENT_REFRESH_STORAGE_KEY, String(nextGeneration));
    } catch (e) {}

    var maintenance = [];
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === 'function') {
      maintenance.push(
        navigator.serviceWorker.getRegistration().then(function (registration) {
          return registration ? registration.update() : null;
        }).catch(function () {})
      );
    }
    if (window.caches && typeof window.caches.keys === 'function') {
      maintenance.push(
        window.caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (key) { return window.caches.delete(key); }));
        }).catch(function () {})
      );
    }

    Promise.all(maintenance).finally(function () {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('site_refresh', String(nextGeneration));
        window.location.replace(url.pathname + '?' + url.searchParams.toString() + url.hash);
      } catch (e) {
        window.location.reload();
      }
    });
  }

  function checkClientRefresh() {
    if (window.location.protocol === 'file:') return Promise.resolve(null);
    if (clientRefreshPromise) return clientRefreshPromise;
    clientRefreshPromise = fetch(apiUrl('/api/client-refresh'), {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-store' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (payload) {
      if (!payload) return null;
      var remoteGeneration = Math.max(0, Number(payload.generation) || 0);
      var localRaw = null;
      try { localRaw = localStorage.getItem(CLIENT_REFRESH_STORAGE_KEY); } catch (e) {}
      if (localRaw === null) {
        try { localRaw = sessionStorage.getItem(CLIENT_REFRESH_STORAGE_KEY); } catch (e) {}
      }
      // Treat browsers that predate this feature as generation zero. This is
      // essential for the first admin-triggered refresh: closed and previously
      // unseen browsers must refresh on their next visit instead of silently
      // adopting the newer generation without loading the new build.
      var localGeneration = localRaw === null ? 0 : Math.max(0, Number(localRaw) || 0);
      if (remoteGeneration > localGeneration && !shouldDeferClientRefresh()) {
        reloadForClientRefresh(remoteGeneration);
      } else if (localRaw === null && remoteGeneration === 0) {
        try { localStorage.setItem(CLIENT_REFRESH_STORAGE_KEY, '0'); } catch (e) {}
        try { sessionStorage.setItem(CLIENT_REFRESH_STORAGE_KEY, '0'); } catch (e) {}
      }
      return payload;
    }).catch(function () {
      return null;
    }).finally(function () {
      clientRefreshPromise = null;
    });
    return clientRefreshPromise;
  }

  function initClientRefreshWatcher() {
    cleanClientRefreshQuery();
    checkClientRefresh();
    if (!clientRefreshTimer) {
      clientRefreshTimer = window.setInterval(checkClientRefresh, CLIENT_REFRESH_POLL_MS);
    }
    window.addEventListener('focus', checkClientRefresh);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkClientRefresh();
    });
  }

  function progressKey(email) {
    return PROGRESS_PREFIX + (email || 'guest');
  }

  function clearLocalSessionData() {
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i) || '';
        if (
          key === AUTH_STORAGE_KEY ||
          key.indexOf(BOOTSTRAP_CACHE_PREFIX) === 0
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function (key) {
        localStorage.removeItem(key);
      });
    } catch (e) {}

    try {
      sessionStorage.setItem('ielts_recent_logout_at', nowIso());
    } catch (e) {}
  }

  function getSiteRootPath(pathname) {
    var path = String(pathname || '');
    if (/\/(?:Reading|Listening|Writing)\//.test(path)) {
      return path.replace(/\/(?:Reading|Listening|Writing)\/.*$/, '/');
    }
    return path.replace(/\/[^/]*$/, '/');
  }

  function toSiteRelativePath(pathname) {
    var path = String(pathname || '');
    var root = getSiteRootPath(window.location.pathname);
    if (root && path.indexOf(root) === 0) {
      return path.slice(root.length);
    }
    return path.replace(/^\//, '');
  }

  function getLoginUrl(nextPath) {
    var loginPath = '';
    if (window.location.protocol === 'file:') {
      loginPath = getSiteRootPath(window.location.pathname) + 'login.html';
    } else {
      loginPath = '/login.html';
    }
    return loginPath + (nextPath ? ('?next=' + encodeURIComponent(nextPath)) : '');
  }

  function buildSameOriginPath(rawHref) {
    if (!rawHref) return '';
    try {
      var url = new URL(rawHref, window.location.href);
      if (window.location.protocol !== 'file:' && url.origin !== window.location.origin) return '';
      return toSiteRelativePath(url.pathname) + (url.search || '') + (url.hash || '');
    } catch (e) {
      return '';
    }
  }

  function normalizeMaterialPath(pathname) {
    var path = String(pathname || '');
    try {
      path = decodeURIComponent(path);
    } catch (e) {}
    path = path.replace(/\\/g, '/').split('#', 1)[0].split('?', 1)[0].replace(/^\/+/, '');
    if (/\.html$/i.test(path)) path = path.slice(0, -5);
    return path.toLowerCase();
  }

  function exportAccessStorageKey(pathname) {
    return 'ielts_export_access_' + normalizeMaterialPath(pathname || window.location.pathname);
  }

  function hasServerExportAccess() {
    if (!isProtectedTestPath(window.location.pathname)) return false;
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('export_access') === '1') {
        try {
          sessionStorage.setItem(exportAccessStorageKey(window.location.pathname), '1');
        } catch (storageError) {}
        try {
          params.delete('export_access');
          var cleanQuery = params.toString();
          var cleanUrl = window.location.pathname + (cleanQuery ? ('?' + cleanQuery) : '') + (window.location.hash || '');
          window.history.replaceState(window.history.state, document.title, cleanUrl);
        } catch (historyError) {}
        return true;
      }
    } catch (e) {}
    try {
      return sessionStorage.getItem(exportAccessStorageKey(window.location.pathname)) === '1';
    } catch (e) {
      return false;
    }
  }

  function deriveMaterialIdFromHref(href) {
    var normalized = normalizeMaterialPath(href);
    var prefix = 'material_';
    if (normalized.indexOf('reading/') === 0) prefix = 'reading_';
    else if (normalized.indexOf('listening/') === 0) prefix = 'listening_';
    else if (normalized.indexOf('writing/') === 0) prefix = 'writing_';
    else if (normalized === 'speaking' || normalized.indexOf('speaking/') === 0) prefix = 'speaking_';
    else if (normalized === 'books' || normalized.indexOf('books/') === 0) prefix = 'books_';
    var slug = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return prefix + (slug || 'unknown');
  }

  function isProtectedTestPath(pathname) {
    var value = String(pathname || '');
    return /\/(?:Reading|Listening|Writing|Speaking|Books)\//.test(value) || /\/(?:speaking|books)(?:\.html)?$/i.test(value);
  }

  function getMaterialLibraryUrl(pathname) {
    var value = String(pathname || window.location.pathname || '');
    var match = value.match(/\/(Reading|Listening|Writing|Speaking|Books)\//i);
    var section = match ? String(match[1] || '').toLowerCase() : '';
    if (!section) {
      return window.location.protocol === 'file:'
        ? getSiteRootPath(value) + 'index.html'
        : '/';
    }
    return window.location.protocol === 'file:'
      ? getSiteRootPath(value) + section + '.html'
      : '/' + section;
  }

  function leaveProtectedMaterial() {
    var target = getMaterialLibraryUrl(window.location.pathname);
    try {
      window.location.replace(target);
    } catch (e) {
      window.location.href = target;
    }
  }

  function isProtectedNextPath(pathname) {
    var normalized = String(pathname || '').replace(/^\//, '');
    return /^(?:Reading|Listening|Writing|Speaking|Books)\//.test(normalized) || /^(?:speaking|books)(?:\.html)?$/i.test(normalized);
  }

  var loginModalState = {
    root: null,
    message: null,
    pendingResolve: null
  };
  var premiumModalState = {
    root: null,
    message: null,
    title: null,
    closeButton: null,
    primaryButton: null,
    actions: null,
    persistent: false,
    pendingResolve: null
  };
  var blockedNoticeShown = false;

  function installInspectionProtection() {
    // Use a window-level flag so other scripts (e.g. header-enhance.js) that
    // also call this kind of guard don't double-install.
    if (window.__ieltsInspectionProtectionInstalled || !document || !document.addEventListener) return;
    window.__ieltsInspectionProtectionInstalled = true;

    document.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    document.addEventListener('keydown', function (event) {
      var key = String(event.key || '').toLowerCase();
      var code = Number(event.keyCode || event.which || 0);
      var ctrlOrMeta = !!(event.ctrlKey || event.metaKey);
      var shift = !!event.shiftKey;

      if (
        key === 'f12' ||
        key === 'f3' ||
        code === 114 ||
        (ctrlOrMeta && shift && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrlOrMeta && key === 'f') ||
        (ctrlOrMeta && key === 'u')
      ) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        event.stopPropagation();
      }
    }, true);
  }

  function getLoginModalTheme() {
    var path = String(window.location.pathname || '').toLowerCase();
    if (path.indexOf('listening') !== -1) {
      return {
        overlay: 'rgba(10, 34, 39, 0.44)',
        cardBg: 'linear-gradient(180deg, #ffffff 0%, #f2fbfd 100%)',
        border: '#cbe7ec',
        shadow: 'rgba(14, 95, 106, 0.2)',
        title: '#126879',
        text: '#476770',
        buttonBorder: '#b9d9df',
        buttonText: '#1a6976',
        primaryBorder: '#0d6772',
        primaryBg: 'linear-gradient(135deg, #1aa1af, #127583)'
      };
    }
    return {
      overlay: 'rgba(9, 18, 33, 0.48)',
      cardBg: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)',
      border: '#d2def4',
      shadow: 'rgba(18, 42, 76, 0.22)',
      title: '#234a82',
      text: '#4d6482',
      buttonBorder: '#bed0eb',
      buttonText: '#33598f',
      primaryBorder: '#1f5894',
      primaryBg: 'linear-gradient(135deg, #2f79c8, #1f5ea6)'
    };
  }

  function ensureLoginModal() {
    if (loginModalState.root) return loginModalState.root;
    if (!document.body) return null;

    var style = document.createElement('style');
    style.textContent = [
      '.login-required-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;background:var(--login-modal-overlay, rgba(9,18,33,.48));backdrop-filter:blur(3px);z-index:1400;}',
      '.login-required-modal.is-open{display:flex;}',
      '.login-required-card{width:min(460px,100%);padding:24px;border-radius:22px;background:var(--login-modal-card-bg, linear-gradient(180deg,#fff 0%,#f5f9ff 100%));border:1px solid var(--login-modal-border, #d2def4);box-shadow:0 28px 70px var(--login-modal-shadow, rgba(18,42,76,.22));}',
      '.login-required-title{margin:0 0 10px;color:var(--login-modal-title, #234a82);font-size:1.28rem;font-weight:800;}',
      '.login-required-text{margin:0;color:var(--login-modal-text, #4d6482);font-size:.98rem;line-height:1.55;}',
      '.login-required-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;}',
      '.login-required-btn{min-width:136px;height:48px;border-radius:14px;border:1px solid var(--login-modal-button-border, #bed0eb);background:#fff;color:var(--login-modal-button-text, #33598f);font-size:.95rem;font-weight:800;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;}',
      '.login-required-btn:hover{transform:translateY(-1px);box-shadow:0 12px 22px color-mix(in srgb, var(--login-modal-button-text, #33598f) 16%, transparent);}',
      '.login-required-btn.primary{border-color:var(--login-modal-primary-border, #1f5894);background:var(--login-modal-primary-bg, linear-gradient(135deg,#2f79c8,#1f5ea6));color:#fff;}'
    ].join('');
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.className = 'login-required-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="login-required-card" role="dialog" aria-modal="true" aria-labelledby="loginRequiredTitle">' +
        '<h3 class="login-required-title" id="loginRequiredTitle">Login Required</h3>' +
        '<p class="login-required-text">Please log in first to start the test.</p>' +
        '<div class="login-required-actions">' +
          '<button class="login-required-btn" type="button" data-login-action="cancel">Cancel</button>' +
          '<button class="login-required-btn primary" type="button" data-login-action="login">Go to Login</button>' +
        '</div>' +
      '</div>';

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeLoginModal(false);
    });

    Array.prototype.forEach.call(modal.querySelectorAll('[data-login-action]'), function (button) {
      button.addEventListener('click', function () {
        closeLoginModal(button.getAttribute('data-login-action') === 'login');
      });
    });

    document.body.appendChild(modal);
    loginModalState.root = modal;
    loginModalState.message = modal.querySelector('.login-required-text');
    return modal;
  }

  function ensurePremiumModal() {
    if (premiumModalState.root) return premiumModalState.root;
    if (!document.body) return null;

    var style = document.createElement('style');
    style.textContent = [
      'body.premium-blocked-lock{overflow:hidden;}',
      'body.premium-blocked-lock > *:not(.premium-required-modal){pointer-events:none;user-select:none;-webkit-user-select:none;}',
      'body.premium-blocked-lock .premium-required-modal{pointer-events:auto;}',
      '.premium-required-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(35,14,14,.52);backdrop-filter:blur(4px);z-index:1450;}',
      '.premium-required-modal.is-open{display:flex;}',
      '.premium-required-card{width:min(520px,100%);padding:28px;border-radius:24px;background:linear-gradient(180deg,#fffdfd 0%,#fff2f2 100%);border:1px solid #efc3c3;box-shadow:0 30px 80px rgba(113,33,33,.26);}',
      '.premium-required-title{margin:0 0 12px;color:#8e2b2b;font-size:1.34rem;font-weight:800;}',
      '.premium-required-text{margin:0;color:#654949;font-size:.98rem;line-height:1.6;}',
      '.premium-required-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;}',
      '.premium-required-actions.is-hidden{display:none;}',
      '.premium-required-btn{min-width:136px;height:48px;border-radius:14px;border:1px solid #e3b0b0;background:#fff;color:#8e2b2b;font-size:.95rem;font-weight:800;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;}',
      '.premium-required-btn:hover{transform:translateY(-1px);box-shadow:0 12px 22px rgba(142,43,43,.16);}',
      '.premium-required-btn.primary{border-color:#b53030;background:linear-gradient(135deg,#f24848,#b72b2b);color:#fff;}'
    ].join('');
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.className = 'premium-required-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="premium-required-card" role="dialog" aria-modal="true" aria-labelledby="premiumRequiredTitle">' +
        '<h3 class="premium-required-title" id="premiumRequiredTitle">Premium Access Required</h3>' +
        '<p class="premium-required-text">Your email has not been approved for premium tests yet.</p>' +
        '<div class="premium-required-actions">' +
          '<button class="premium-required-btn" type="button" data-premium-action="close">Close</button>' +
          '<button class="premium-required-btn primary" type="button" data-premium-action="account">View rules</button>' +
        '</div>' +
      '</div>';

    modal.addEventListener('click', function (event) {
      if (premiumModalState.persistent) return;
      if (event.target === modal) closePremiumModal(false);
    });

    Array.prototype.forEach.call(modal.querySelectorAll('[data-premium-action]'), function (button) {
      button.addEventListener('click', function () {
        closePremiumModal(button.getAttribute('data-premium-action') === 'account');
      });
    });

    document.body.appendChild(modal);
    premiumModalState.root = modal;
    premiumModalState.title = modal.querySelector('.premium-required-title');
    premiumModalState.message = modal.querySelector('.premium-required-text');
    premiumModalState.closeButton = modal.querySelector('[data-premium-action="close"]');
    premiumModalState.primaryButton = modal.querySelector('[data-premium-action="account"]');
    premiumModalState.actions = modal.querySelector('.premium-required-actions');
    return modal;
  }

  function openLoginModal(message, onResolve) {
    var modal = ensureLoginModal();
    if (!modal) {
      if (onResolve) onResolve(true);
      return;
    }
    var theme = getLoginModalTheme();
    modal.style.setProperty('--login-modal-overlay', theme.overlay);
    modal.style.setProperty('--login-modal-card-bg', theme.cardBg);
    modal.style.setProperty('--login-modal-border', theme.border);
    modal.style.setProperty('--login-modal-shadow', theme.shadow);
    modal.style.setProperty('--login-modal-title', theme.title);
    modal.style.setProperty('--login-modal-text', theme.text);
    modal.style.setProperty('--login-modal-button-border', theme.buttonBorder);
    modal.style.setProperty('--login-modal-button-text', theme.buttonText);
    modal.style.setProperty('--login-modal-primary-border', theme.primaryBorder);
    modal.style.setProperty('--login-modal-primary-bg', theme.primaryBg);
    loginModalState.pendingResolve = onResolve || null;
    if (loginModalState.message) {
      loginModalState.message.textContent = message || 'Please log in first to start the test.';
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeLoginModal(shouldLogin) {
    if (!loginModalState.root) return;
    loginModalState.root.classList.remove('is-open');
    loginModalState.root.setAttribute('aria-hidden', 'true');
    if (loginModalState.pendingResolve) {
      var handler = loginModalState.pendingResolve;
      loginModalState.pendingResolve = null;
      handler(shouldLogin);
    }
  }

  function openPremiumModal(message, onResolve, options) {
    var modal = ensurePremiumModal();
    if (!modal) {
      if (onResolve) onResolve(false);
      return;
    }
    var settings = options || {};
    premiumModalState.pendingResolve = onResolve || null;
    premiumModalState.persistent = !!settings.persistent;
    if (premiumModalState.title) {
      premiumModalState.title.textContent = settings.title || 'Premium Access Required';
    }
    if (premiumModalState.message) {
      premiumModalState.message.textContent = message || 'Your email has not been approved for premium tests yet.';
    }
    if (premiumModalState.closeButton) {
      premiumModalState.closeButton.textContent = settings.closeLabel || 'Close';
    }
    if (premiumModalState.primaryButton) {
      premiumModalState.primaryButton.textContent = settings.primaryLabel || 'View rules';
      premiumModalState.primaryButton.style.display = settings.hidePrimary ? 'none' : '';
    }
    if (premiumModalState.closeButton) {
      premiumModalState.closeButton.style.display = settings.hideClose ? 'none' : '';
    }
    if (premiumModalState.actions) {
      premiumModalState.actions.classList.toggle('is-hidden', !!settings.hideActions);
    }
    document.body.classList.toggle('premium-blocked-lock', !!settings.persistent);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closePremiumModal(openAccount) {
    if (premiumModalState.persistent) return;
    if (!premiumModalState.root) return;
    premiumModalState.root.classList.remove('is-open');
    premiumModalState.root.setAttribute('aria-hidden', 'true');
    premiumModalState.persistent = false;
    document.body.classList.remove('premium-blocked-lock');
    if (premiumModalState.pendingResolve) {
      var handler = premiumModalState.pendingResolve;
      premiumModalState.pendingResolve = null;
      handler(openAccount);
    }
    if (!openAccount && isProtectedTestPath(window.location.pathname)) {
      leaveProtectedMaterial();
    }
  }

  function promptLoginThenRedirect(nextPath) {
    openLoginModal('Please log in first to start the test.', function (shouldLogin) {
      if (shouldLogin) {
        window.location.href = getLoginUrl(nextPath);
      } else if (isProtectedTestPath(window.location.pathname)) {
        window.location.href = window.location.protocol === 'file:' ? getSiteRootPath(window.location.pathname) + 'index.html' : '/';
      }
    });
  }

  function apiUrl(path) {
    return API_BASE ? (API_BASE.replace(/\/$/, '') + path) : path;
  }

  async function fetchPremiumAccess(email) {
    var res;
    try {
      res = await fetch(apiUrl('/api/premium-access?email=' + encodeURIComponent(email)), {
        method: 'GET',
        headers: authHeaders({ 'Accept': 'application/json', 'Cache-Control': 'no-store' }),
        cache: 'no-store'
      });
    } catch (err) {
      if (isNetworkFailureMessage(err && err.message)) {
        throw new Error('Unable to reach the server right now. Please try again.');
      }
      throw err;
    }
    var text = await res.text();
    var payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch (e) {}
    }
    if (!res.ok) throw new Error(payload.error || ('Request failed (HTTP ' + res.status + ')'));
    return payload;
  }

  async function fetchMaterialAccess() {
    var res;
    try {
      res = await fetch(apiUrl('/api/material-access'), {
        method: 'GET',
        headers: authHeaders({ 'Accept': 'application/json', 'Cache-Control': 'no-store' }),
        cache: 'no-store'
      });
    } catch (err) {
      if (isNetworkFailureMessage(err && err.message)) {
        throw new Error('Unable to reach the server right now. Please try again.');
      }
      throw err;
    }
    var text = await res.text();
    var payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch (e) {}
    }
    if (!res.ok) throw new Error(payload.error || ('Request failed (HTTP ' + res.status + ')'));
    return payload;
  }

  async function initPremiumAccess(forceRefresh) {
    var email = getEmail();
    if (!email) {
      premiumAccessState = {
        loaded: true,
        hasAccess: false,
        isAdmin: false,
        email: '',
        durationMonths: 0,
        durationDays: 0,
        premiumUntil: '',
        notes: '',
        decidedBy: '',
        decidedAt: '',
        isExpired: false
      };
      return premiumAccessState;
    }
    // Reuse already-loaded state to avoid duplicate fetches when multiple
    // page modules each call initPremiumAccess on load.
    if (premiumAccessState.loaded && !forceRefresh) return premiumAccessState;
    if (forceRefresh) premiumAccessPromise = null;
    if (premiumAccessPromise) return premiumAccessPromise;
    premiumAccessPromise = fetchPremiumAccess(email)
      .then(function (payload) {
        premiumAccessState = {
          loaded: true,
          hasAccess: !!payload.has_access,
          isAdmin: !!payload.is_admin,
          email: payload.email || email,
          durationMonths: Number(payload.duration_months) || 0,
          durationDays: Number(payload.duration_days) || 0,
          premiumUntil: payload.premium_until || '',
          notes: payload.notes || '',
          decidedBy: payload.decided_by || '',
          decidedAt: payload.decided_at || '',
          isExpired: !!payload.is_expired
        };
        return premiumAccessState;
      })
      .catch(function (error) {
        if (isBlockedDeviceMessage(error && error.message) && !blockedNoticeShown) {
          showBlockedAccess(error.message);
        }
        premiumAccessState = {
          loaded: true,
          hasAccess: false,
          isAdmin: false,
          email: email,
          durationMonths: 0,
          durationDays: 0,
          premiumUntil: '',
          notes: '',
          decidedBy: '',
          decidedAt: '',
          isExpired: false
        };
        return premiumAccessState;
      })
      .finally(function () {
        premiumAccessPromise = null;
      });
    return premiumAccessPromise;
  }

  function bootstrapCacheKey(email) {
    return BOOTSTRAP_CACHE_PREFIX + String(email || 'guest').toLowerCase();
  }

  function loadBootstrapCache(email) {
    if (!email) return null;
    try {
      var raw = localStorage.getItem(bootstrapCacheKey(email));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.savedAt !== 'number') return null;
      var age = Date.now() - parsed.savedAt;
      if (age < 0 || age > BOOTSTRAP_CACHE_TTL_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveBootstrapCache(email, payload) {
    if (!email || !payload) return;
    try {
      localStorage.setItem(
        bootstrapCacheKey(email),
        JSON.stringify({ savedAt: Date.now(), payload: payload })
      );
    } catch (e) {}
  }

  function applyPremiumPayload(payload, fallbackEmail) {
    var premium = payload || {};
    premiumAccessState = {
      loaded: true,
      hasAccess: !!premium.has_access,
      isAdmin: !!premium.is_admin,
      email: premium.email || fallbackEmail || '',
      durationMonths: Number(premium.duration_months) || 0,
      durationDays: Number(premium.duration_days) || 0,
      premiumUntil: premium.premium_until || '',
      notes: premium.notes || '',
      decidedBy: premium.decided_by || '',
      decidedAt: premium.decided_at || '',
      isExpired: !!premium.is_expired
    };
  }

  function applyMaterialsPayload(materialPayload) {
    var items = Array.isArray(materialPayload && materialPayload.items) ? materialPayload.items : [];
    var byId = {};
    var byPath = {};
    items.forEach(function (item) {
      var href = String((item && item.href) || '');
      var materialId = String((item && item.material_id) || deriveMaterialIdFromHref(href));
      var pathKey = normalizeMaterialPath(href);
      var normalizedItem = {
        materialId: materialId,
        href: href,
        title: String((item && item.title) || ''),
        section: String((item && item.section) || ''),
        isPremium: !!(item && item.is_premium),
        audience: String((item && item.audience) || ((item && item.is_premium) ? 'premium' : 'all')).toLowerCase(),
        updatedAt: String((item && item.updated_at) || ''),
        updatedBy: String((item && item.updated_by) || '')
      };
      byId[materialId] = normalizedItem;
      if (pathKey) byPath[pathKey] = normalizedItem;
    });
    materialAccessState = {
      loaded: true,
      items: items,
      byId: byId,
      byPath: byPath
    };
  }

  function dispatchProgressReady(stage) {
    if (!document || typeof document.dispatchEvent !== 'function') return;
    try {
      var event = new CustomEvent('ielts-progress-ready', { detail: { stage: stage } });
      document.dispatchEvent(event);
    } catch (e) {
      // CustomEvent constructor may not exist in some legacy browsers; ignore.
    }
  }

  // Hydrate module-level state from localStorage if a fresh snapshot exists.
  // Called once on script load so the page can render with real premium/material
  // info immediately, without waiting for any network round-trip.
  function hydrateFromCache() {
    var email = getEmail();
    if (!email) return false;
    var entry = loadBootstrapCache(email);
    if (!entry || !entry.payload) return false;
    applyPremiumPayload(entry.payload.premium, email);
    applyMaterialsPayload(entry.payload.materials);
    return true;
  }

  // Single-call alternative to running initSync + initPremiumAccess +
  // initMaterialAccess separately. Hits /api/bootstrap once and seeds all
  // three module-level state variables from one response, so a page load
  // costs 1 round trip instead of 3.
  async function initBootstrap(forceRefresh) {
    if (forceRefresh) {
      bootstrapPromise = null;
      bootstrapAttempted = false;
    }
    if (bootstrapPromise) return bootstrapPromise;
    var email = getEmail();
    if (!email) return null;

    // If we already revalidated very recently, skip another network call.
    if (!forceRefresh && bootstrapAttempted) {
      var entry = loadBootstrapCache(email);
      if (entry && (Date.now() - entry.savedAt) < BOOTSTRAP_REVALIDATE_AFTER_MS) {
        return null;
      }
    }

    bootstrapAttempted = true;
    bootstrapPromise = (async function () {
      var res;
      try {
        res = await fetch(apiUrl('/api/bootstrap?email=' + encodeURIComponent(email)), {
          method: 'GET',
          headers: authHeaders({ 'Accept': 'application/json', 'Cache-Control': 'no-store' }),
          cache: 'no-store'
        });
      } catch (err) {
        return null;
      }
      var text = await res.text();
      var payload = {};
      if (text) {
        try { payload = JSON.parse(text); } catch (e) {}
      }
      if (!res.ok) {
        if (isBlockedDeviceMessage(payload && payload.error) && !blockedNoticeShown) {
          showBlockedAccess(payload.error);
        }
        return null;
      }

      // Seed account/progress (same effect as initSync resolving)
      try {
        var migrated = migrateGuestProgressToAccount(email);
        var local = migrated || loadLocalData();
        var remote = normalizeData((payload.account && payload.account.progress) || {});
        var merged = mergeData(local, remote);
        saveLocalData(merged);
        pushProgressToServer(merged);
        syncResultCached = merged;
      } catch (e) {}

      applyPremiumPayload(payload.premium, email);
      applyMaterialsPayload(payload.materials);

      // Persist a snapshot so the next page open can render from local
      // storage instantly without waiting on the network.
      saveBootstrapCache(email, {
        premium: payload.premium || {},
        materials: payload.materials || { items: [] }
      });

      dispatchProgressReady('fresh');

      return {
        progress: syncResultCached,
        premium: premiumAccessState,
        materials: materialAccessState
      };
    })().finally(function () {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  }

  async function initMaterialAccess(forceRefresh) {
    if (forceRefresh) materialAccessPromise = null;
    if (materialAccessState.loaded && !forceRefresh) return materialAccessState;
    if (materialAccessPromise) return materialAccessPromise;
    materialAccessPromise = fetchMaterialAccess()
      .then(function (payload) {
        var items = Array.isArray(payload.items) ? payload.items : [];
        var byId = {};
        var byPath = {};
        items.forEach(function (item) {
          var href = String((item && item.href) || '');
          var materialId = String((item && item.material_id) || deriveMaterialIdFromHref(href));
          var pathKey = normalizeMaterialPath(href);
          var normalizedItem = {
            materialId: materialId,
            href: href,
            title: String((item && item.title) || ''),
            section: String((item && item.section) || ''),
            isPremium: !!(item && item.is_premium),
            audience: String((item && item.audience) || ((item && item.is_premium) ? 'premium' : 'all')).toLowerCase(),
            updatedAt: String((item && item.updated_at) || ''),
            updatedBy: String((item && item.updated_by) || '')
          };
          byId[materialId] = normalizedItem;
          if (pathKey) byPath[pathKey] = normalizedItem;
        });
        materialAccessState = {
          loaded: true,
          items: items,
          byId: byId,
          byPath: byPath
        };
        return materialAccessState;
      })
      .catch(function () {
        materialAccessState = {
          loaded: true,
          items: [],
          byId: {},
          byPath: {}
        };
        return materialAccessState;
      })
      .finally(function () {
        materialAccessPromise = null;
      });
    return materialAccessPromise;
  }

  function getPremiumAccessState() {
    return Object.assign({}, premiumAccessState);
  }

  function getMaterialAccessState() {
    return {
      loaded: !!materialAccessState.loaded,
      items: (materialAccessState.items || []).slice(),
      byId: Object.assign({}, materialAccessState.byId || {}),
      byPath: Object.assign({}, materialAccessState.byPath || {})
    };
  }

  function hasPremiumPrivileges() {
    return !!(premiumAccessState && (premiumAccessState.hasAccess || premiumAccessState.isAdmin));
  }

  function getMaterialAudience(href) {
    var pathKey = normalizeMaterialPath(href);
    var byPathItem = pathKey ? materialAccessState.byPath[pathKey] : null;
    if (byPathItem && byPathItem.audience) return byPathItem.audience;
    var byIdItem = materialAccessState.byId[deriveMaterialIdFromHref(href)];
    return (byIdItem && byIdItem.audience) || ((byIdItem && byIdItem.isPremium) ? 'premium' : 'all');
  }

  function isPremiumMaterialHref(href) {
    return getMaterialAudience(href) === 'premium';
  }

  function canAccessMaterialHref(href) {
    var audience = getMaterialAudience(href);
    if (premiumAccessState && premiumAccessState.isAdmin) return true;
    if (audience === 'premium') return hasPremiumPrivileges();
    if (audience === 'basic') return !!getEmail() && !hasPremiumPrivileges();
    return true;
  }

  function showMaterialAccessRequired(href) {
    var audience = getMaterialAudience(href);
    if (audience === 'basic') {
      openPremiumModal(
        'This test is available only for basic users. Premium accounts cannot open this material.',
        function () {},
        { title: 'Basic User Only', hidePrimary: true }
      );
      return;
    }
    showPremiumRequired();
  }

  function showPremiumRequired() {
    var message = 'Your email has not been approved for premium tests yet. Ask the admin to enable premium test access for this account.';
    openPremiumModal(message, function (openAccount) {
      if (openAccount) {
        if (isProtectedTestPath(window.location.pathname)) {
          var rulesWindow = null;
          try {
            rulesWindow = window.open(PREMIUM_RULES_URL, '_blank', 'noopener');
            if (rulesWindow) rulesWindow.opener = null;
          } catch (e) {}
          leaveProtectedMaterial();
          return;
        }
        window.location.href = PREMIUM_RULES_URL;
      }
    });
  }

  var startAccessCheckInFlight = false;

  function getCurrentMaterialPath() {
    return toSiteRelativePath(window.location.pathname);
  }

  function getCurrentMaterialReturnPath() {
    return getCurrentMaterialPath() + (window.location.search || '') + (window.location.hash || '');
  }

  function setStartButtonChecking(button, checking) {
    if (!button) return;
    if (checking) {
      if (!button.getAttribute('data-original-start-text')) {
        button.setAttribute('data-original-start-text', button.textContent || 'Start Test');
      }
      button.textContent = 'Checking access...';
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    } else {
      var original = button.getAttribute('data-original-start-text');
      if (original) button.textContent = original;
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
  }

  function isMaterialAccessReadyForStart() {
    return !!(materialAccessState.loaded && (!getEmail() || premiumAccessState.loaded));
  }

  function ensureAccessDataReadyForStart() {
    return Promise.all([
      initBootstrap(),
      initPremiumAccess(),
      initMaterialAccess()
    ]);
  }

  function allowCurrentMaterialStart() {
    if (!isProtectedTestPath(window.location.pathname)) return true;
    if (hasServerExportAccess()) return true;
    var materialPath = getCurrentMaterialPath();
    var audience = getMaterialAudience(materialPath);

    // Materials marked for all users should open without any premium check.
    if (audience === 'all') return true;

    if (!getEmail()) {
      promptLoginThenRedirect(getCurrentMaterialReturnPath());
      return false;
    }
    if (!canAccessMaterialHref(materialPath)) {
      showMaterialAccessRequired(materialPath);
      return false;
    }
    return true;
  }

  function guardStartButtonClick(event, button) {
    if (!button || !isProtectedTestPath(window.location.pathname)) return false;

    if (isMaterialAccessReadyForStart()) {
      if (allowCurrentMaterialStart()) return false;
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      return true;
    }

    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    if (startAccessCheckInFlight) return true;

    startAccessCheckInFlight = true;
    setStartButtonChecking(button, true);
    ensureAccessDataReadyForStart()
      .then(function () {
        if (allowCurrentMaterialStart() && typeof window.startTest === 'function') {
          window.startTest();
        }
      })
      .finally(function () {
        startAccessCheckInFlight = false;
        setStartButtonChecking(button, false);
      });
    return true;
  }

  function isBlockedDeviceMessage(message) {
    var text = String(message || '').toLowerCase();
    return text.indexOf('fourth device') !== -1 || text.indexOf('you are banned because this premium account was opened') !== -1;
  }

  function showBlockedAccess(message) {
    blockedNoticeShown = true;
    openPremiumModal(
      message || 'You are banned because this premium account was opened from a fourth device.',
      function () {},
      { title: 'Access Blocked', hidePrimary: true, hideClose: true, hideActions: true, persistent: true }
    );
  }

  function baseData() {
    return {
      tests: {
        listening: { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] },
        reading: { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] },
        speaking: { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] },
        writing: { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] },
        mock: { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] }
      },
      books: {
        visits: 0,
        total_used: 0,
        used: {}
      },
      drafts: {},
      logins: [],
      activity: []
    };
  }

  function normalizeData(parsed) {
    var fresh = baseData();
    var data = Object.assign({}, fresh, parsed || {});
    var parsedTests = (parsed && parsed.tests) || {};

    Object.keys(fresh.tests).forEach(function (section) {
      data.tests[section] = Object.assign({}, fresh.tests[section], parsedTests[section] || {});
      if (!Array.isArray(data.tests[section].results)) data.tests[section].results = [];
    });

    data.books = Object.assign({}, fresh.books, (parsed && parsed.books) || {});
    data.books.used = Object.assign({}, fresh.books.used, data.books.used || {});
    data.drafts = Object.assign({}, fresh.drafts, (parsed && parsed.drafts) || {});
    if (!Array.isArray(data.logins)) data.logins = [];
    if (!Array.isArray(data.activity)) data.activity = [];
    return data;
  }

  function mergeDrafts(localDrafts, remoteDrafts) {
    var merged = {};
    var keys = Object.keys(remoteDrafts || {}).concat(Object.keys(localDrafts || {}));
    keys.forEach(function (key) {
      var local = (localDrafts || {})[key] || {};
      var remote = (remoteDrafts || {})[key] || {};
      var localUpdated = String(local.updated_at || '');
      var remoteUpdated = String(remote.updated_at || '');
      merged[key] = remoteUpdated > localUpdated ? remote : local;
    });
    return merged;
  }

  function mergeUsedBooks(localUsed, remoteUsed) {
    var merged = {};
    [remoteUsed || {}, localUsed || {}].forEach(function (source) {
      Object.keys(source).forEach(function (key) {
        var incoming = source[key] || {};
        var existing = merged[key] || { label: incoming.label || key, count: 0, last_used: '' };
        merged[key] = {
          label: incoming.label || existing.label || key,
          count: Math.max(Number(existing.count) || 0, Number(incoming.count) || 0),
          last_used: (existing.last_used || '') > (incoming.last_used || '') ? (existing.last_used || '') : (incoming.last_used || '')
        };
      });
    });
    return merged;
  }

  function mergeResults(localResults, remoteResults) {
    var seen = {};
    var merged = [];
    (remoteResults || []).concat(localResults || []).forEach(function (entry) {
      if (!entry) return;
      var key = entry.attempt_id || [entry.label || '', entry.score || 0, entry.total || 0, entry.submitted_at || ''].join('|');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(entry);
    });
    merged.sort(function (a, b) {
      return String(b.submitted_at || '').localeCompare(String(a.submitted_at || ''));
    });
    return merged.slice(0, MAX_RESULTS_PER_SECTION);
  }

  function mergeActivity(localActivity, remoteActivity) {
    var seen = {};
    var merged = [];
    (remoteActivity || []).concat(localActivity || []).forEach(function (entry) {
      if (!entry) return;
      var key = [entry.text || '', entry.at || ''].join('|');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(entry);
    });
    merged.sort(function (a, b) {
      return String(b.at || '').localeCompare(String(a.at || ''));
    });
    return merged.slice(0, 50);
  }

  function mergeLogins(localLogins, remoteLogins) {
    var seen = {};
    var merged = [];
    (remoteLogins || []).concat(localLogins || []).forEach(function (entry) {
      if (!entry) return;
      var key = [entry.at || '', entry.device || '', entry.browser || '', entry.email || ''].join('|');
      if (seen[key]) return;
      seen[key] = true;
      merged.push({
        at: entry.at || '',
        email: entry.email || '',
        device: entry.device || '',
        browser: entry.browser || ''
      });
    });
    merged.sort(function (a, b) {
      return String(b.at || '').localeCompare(String(a.at || ''));
    });
    return merged.slice(0, 50);
  }

  function mergeData(localData, remoteData) {
    var local = normalizeData(localData);
    var remote = normalizeData(remoteData);
    var merged = baseData();

    Object.keys(merged.tests).forEach(function (section) {
      var lt = local.tests[section] || {};
      var rt = remote.tests[section] || {};
      var results = mergeResults(lt.results, rt.results);
      var latestEntry = results[0] || null;
      var bestScore = null;
      results.forEach(function (entry) {
        var score = Number(entry && entry.score);
        if (isFinite(score)) bestScore = bestScore == null ? score : Math.max(bestScore, score);
      });
      merged.tests[section] = {
        visits: Math.max(Number(lt.visits) || 0, Number(rt.visits) || 0),
        opens: Math.max(Number(lt.opens) || 0, Number(rt.opens) || 0),
        last_opened: String(lt.last_opened || '') > String(rt.last_opened || '') ? String(lt.last_opened || '') : String(rt.last_opened || ''),
        latest_score: latestEntry ? latestEntry.score : (rt.latest_score != null ? rt.latest_score : lt.latest_score),
        best_score: bestScore != null ? bestScore : (rt.best_score != null ? rt.best_score : lt.best_score),
        last_submitted: latestEntry ? latestEntry.submitted_at : (String(lt.last_submitted || '') > String(rt.last_submitted || '') ? String(lt.last_submitted || '') : String(rt.last_submitted || '')),
        results: results
      };
    });

    merged.books = {
      visits: Math.max(Number(local.books.visits) || 0, Number(remote.books.visits) || 0),
      total_used: Math.max(Number(local.books.total_used) || 0, Number(remote.books.total_used) || 0),
      used: mergeUsedBooks(local.books.used, remote.books.used)
    };
    merged.drafts = mergeDrafts(local.drafts, remote.drafts);
    merged.logins = mergeLogins(local.logins, remote.logins);
    merged.activity = mergeActivity(local.activity, remote.activity);
    return normalizeData(merged);
  }

  function loadStoredData(email) {
    var key = progressKey(email);
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return baseData();
      var parsed = JSON.parse(raw);
      return normalizeData(parsed);
    } catch (e) {
      return baseData();
    }
  }

  function saveStoredData(email, data) {
    var key = progressKey(email);
    try {
      localStorage.setItem(key, JSON.stringify(normalizeData(data)));
    } catch (e) {}
  }

  function loadLocalData() {
    return loadStoredData(getEmail());
  }

  function saveLocalData(data) {
    saveStoredData(getEmail(), data);
  }

  function hasProgressContent(data) {
    var normalized = normalizeData(data || {});
    var hasTests = Object.keys(normalized.tests || {}).some(function (section) {
      var test = normalized.tests[section] || {};
      return (Array.isArray(test.results) && test.results.length) ||
        Number(test.visits) > 0 ||
        Number(test.opens) > 0 ||
        !!test.last_opened ||
        !!test.last_submitted;
    });
    var hasBooks = !!(
      normalized.books &&
      (Number(normalized.books.total_used) > 0 || Object.keys(normalized.books.used || {}).length)
    );
    return hasTests ||
      hasBooks ||
      Object.keys(normalized.drafts || {}).length > 0 ||
      (Array.isArray(normalized.logins) && normalized.logins.length > 0) ||
      (Array.isArray(normalized.activity) && normalized.activity.length > 0);
  }

  function migrateGuestProgressToAccount(email) {
    var accountEmail = String(email || getEmail() || '').trim().toLowerCase();
    if (!accountEmail) return null;

    var guestKey = progressKey('');
    var accountKey = progressKey(accountEmail);
    if (guestKey === accountKey) return null;

    var guestData = loadStoredData('');
    if (!hasProgressContent(guestData)) return null;

    var accountData = loadStoredData(accountEmail);
    var merged = mergeData(accountData, guestData);
    saveStoredData(accountEmail, merged);

    try {
      localStorage.removeItem(guestKey);
    } catch (e) {}

    return merged;
  }

  async function fetchAccountData(email) {
    var res;
    try {
      res = await fetch(apiUrl('/api/account-data?email=' + encodeURIComponent(email)), {
        method: 'GET',
        headers: authHeaders({ 'Accept': 'application/json', 'Cache-Control': 'no-store' }),
        cache: 'no-store'
      });
    } catch (err) {
      if (isNetworkFailureMessage(err && err.message)) {
        throw new Error('Unable to reach the server right now. Please try again.');
      }
      throw err;
    }
    var text = await res.text();
    var payload = {};
    if (text) {
      try { payload = JSON.parse(text); } catch (e) {}
    }
    if (!res.ok) throw new Error(payload.error || ('Request failed (HTTP ' + res.status + ')'));
    return payload;
  }

  async function pushProgressToServer(data) {
    var email = getEmail();
    if (!email) return;
    try {
      var res = await fetch(apiUrl('/api/account-data'), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        keepalive: true,
        body: JSON.stringify({ email: email, progress: normalizeData(data) })
      });
      if (res && !res.ok) {
        var text = '';
        try { text = await res.text(); } catch (e) {}
        var payload = {};
        if (text) {
          try { payload = JSON.parse(text); } catch (e) {}
        }
        var message = payload.error || '';
        if (isBlockedDeviceMessage(message) && !blockedNoticeShown) {
          showBlockedAccess(message);
        }
      }
    } catch (e) {}
  }

  async function initSync(forceRefresh) {
    var email = getEmail();
    if (!email) return baseData();
    // Reuse the merged data from the first sync so a second caller within
    // the same page load doesn't re-fetch /api/account-data.
    if (syncResultCached && !forceRefresh) return syncResultCached;
    if (syncPromise) return syncPromise;

    var migrated = migrateGuestProgressToAccount(email);
    var local = migrated || loadLocalData();
    syncPromise = fetchAccountData(email)
      .then(function (payload) {
        var remote = normalizeData(payload.progress || {});
        var merged = mergeData(local, remote);
        saveLocalData(merged);
        pushProgressToServer(merged);
        syncResultCached = merged;
        return merged;
      })
      .catch(function (error) {
        if (isBlockedDeviceMessage(error && error.message) && !blockedNoticeShown) {
          showBlockedAccess(error.message);
        }
        pushProgressToServer(local);
        syncResultCached = local;
        return local;
      })
      .finally(function () {
        syncPromise = null;
      });

    return syncPromise;
  }

  function loadData() {
    var email = getEmail();
    if (!email) return loadStoredData('');
    migrateGuestProgressToAccount(email);
    return loadLocalData();
  }

  function saveData(data) {
    var email = getEmail();
    var normalized = normalizeData(data);
    saveStoredData(email, normalized);
    if (email) pushProgressToServer(normalized);
  }

  function addActivity(data, text) {
    data.activity = data.activity || [];
    data.activity.unshift({ text: text, at: nowIso() });
    if (data.activity.length > 50) data.activity = data.activity.slice(0, 50);
  }

  function getDeviceType() {
    try {
      var ua = navigator.userAgent || '';
      if (/tablet|ipad/i.test(ua)) return 'Tablet';
      if (/mobile|iphone|android/i.test(ua)) return 'Mobile';
    } catch (e) {}
    return 'Desktop';
  }

  function getBrowserName() {
    try {
      var ua = navigator.userAgent || '';
      if (/edg/i.test(ua)) return 'Edge';
      if (/chrome|crios/i.test(ua)) return 'Chrome';
      if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
      if (/firefox|fxios/i.test(ua)) return 'Firefox';
    } catch (e) {}
    return 'Browser';
  }

  function trackLogin(details) {
    var email = getEmail();
    if (!email) return;
    var data = loadData();
    data.logins = data.logins || [];
    data.logins.unshift({
      at: nowIso(),
      email: email,
      device: (details && details.device) || getDeviceType(),
      browser: (details && details.browser) || getBrowserName()
    });
    if (data.logins.length > 50) {
      data.logins = data.logins.slice(0, 50);
    }
    saveData(data);
  }

  function trackSectionVisit(section) {
    if (!section) return;
    var data = loadData();
    if (section === 'books') {
      data.books.visits += 1;
      addActivity(data, 'Visited books page');
    } else if (data.tests[section]) {
      data.tests[section].visits += 1;
      addActivity(data, 'Visited ' + section + ' section');
    }
    saveData(data);
  }

  function trackTestOpen(section, label) {
    if (!section) return;
    var data = loadData();
    if (!data.tests[section]) return;
    data.tests[section].opens += 1;
    data.tests[section].last_opened = nowIso();
    addActivity(data, 'Opened ' + (label || section) + ' test');
    saveData(data);
  }

  function trackBookUse(bookId, bookLabel) {
    var data = loadData();
    var id = (bookId || 'book').trim().toLowerCase();
    var label = bookLabel || id;
    data.books.used[id] = data.books.used[id] || { label: label, count: 0, last_used: '' };
    data.books.used[id].label = label;
    data.books.used[id].count += 1;
    data.books.used[id].last_used = nowIso();
    data.books.total_used += 1;
    addActivity(data, 'Used book: ' + label);
    saveData(data);
  }

  function normalizeMockPath(pathname) {
    var path = String(pathname || '');
    try {
      path = decodeURIComponent(path);
    } catch (e) {}
    return path.replace(/\\/g, '/').replace(/^\/+/, '').split('#', 1)[0].split('?', 1)[0].toLowerCase();
  }

  function getMockDashboardHref() {
    if (window.location.protocol === 'file:') {
      return getSiteRootPath(window.location.pathname) + 'mock.html';
    }
    return '/mock.html';
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  function requestMockFullscreen() {
    var root = document.documentElement;
    var openFullscreen = root && (root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen);
    if (!openFullscreen || getFullscreenElement()) return;
    try {
      var result = openFullscreen.call(root);
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (e) {}
  }

  function isActiveMockTestPage() {
    if (isSavedAttemptReview()) return false;
    var params = null;
    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (e) {}
    var queryMockId = params ? (params.get('mock') || '') : '';
    var queryMockPart = params ? (params.get('mockPart') || '') : '';
    var activePart = '';
    var lock = '';
    try {
      activePart = sessionStorage.getItem('ielts_mock_active_part') || '';
      lock = sessionStorage.getItem('ielts_mock_fullscreen_lock') || '';
    } catch (e) {}
    if (!activePart) {
      try { activePart = localStorage.getItem('ielts_mock_active_part') || ''; } catch (e) {}
    }
    if (!lock) {
      try { lock = localStorage.getItem('ielts_mock_fullscreen_lock') || ''; } catch (e) {}
    }
    if (lock !== '1') return false;
    var section = document.body && document.body.getAttribute('data-track-section') || '';
    if (!section) {
      if (/\/Listening\//i.test(window.location.pathname)) section = 'listening';
      else if (/\/Reading\//i.test(window.location.pathname)) section = 'reading';
      else if (/\/Writing\//i.test(window.location.pathname)) section = 'writing';
    }
    if (section !== 'listening' && section !== 'reading' && section !== 'writing') return false;
    if (!queryMockId && !queryMockPart && activePart !== section) return false;
    if (queryMockPart && queryMockPart !== section) return false;
    var mock = loadActiveMockSession();
    if (!mock || !mock.tests || !mock.tests[section]) return false;
    if (queryMockId && mock.id && queryMockId !== mock.id) return false;
    return true;
  }

  function installMockFullscreenLock() {
    if (!document.body || window.__ieltsMockFullscreenLockInstalled) return;
    window.__ieltsMockFullscreenLockInstalled = true;

    document.addEventListener('click', function (event) {
      if (!isActiveMockTestPage()) return;
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!getFullscreenElement()) requestMockFullscreen();

      var startButton = target.closest('.start-button, [data-start-test], #startButton');
      if (startButton) {
        return;
      }

      var fullscreenButton = target.closest('#fullscreenBtn');
      if (!fullscreenButton) return;
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      else event.stopPropagation();
      requestMockFullscreen();
    }, true);
  }

  function loadActiveMockSession() {
    var parsed = null;
    try {
      parsed = JSON.parse(sessionStorage.getItem('ielts_mock_active') || 'null');
    } catch (e) {}
    if (!parsed || !parsed.tests) {
      try {
        parsed = JSON.parse(localStorage.getItem('ielts_mock_active') || 'null');
      } catch (e) {}
    }
    if (parsed && parsed.tests) {
      try {
        sessionStorage.setItem('ielts_mock_active', JSON.stringify(parsed));
        if (parsed.id) sessionStorage.setItem('ielts_mock_active_id', parsed.id);
      } catch (e) {}
      return parsed;
    }
    return null;
  }

  function saveActiveMockSession(mock) {
    if (!mock || !mock.tests) return;
    try {
      sessionStorage.setItem('ielts_mock_active', JSON.stringify(mock));
      if (mock.id) sessionStorage.setItem('ielts_mock_active_id', mock.id);
    } catch (e) {}
    try {
      localStorage.setItem('ielts_mock_active', JSON.stringify(mock));
      if (mock.id) localStorage.setItem('ielts_mock_active_id', mock.id);
    } catch (e) {}
  }

  function showMockContinueButton() {
    if (document.getElementById('ieltsMockContinueButton')) return;
    var link = document.createElement('a');
    link.id = 'ieltsMockContinueButton';
    link.href = getMockDashboardHref();
    link.textContent = 'Continue mock';
    link.setAttribute('aria-label', 'Continue full mock');
    link.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483000',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-height:44px',
      'padding:0 18px',
      'border-radius:999px',
      'background:#111827',
      'color:#fff',
      'font:700 14px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'text-decoration:none',
      'box-shadow:0 12px 32px rgba(15,23,42,.28)'
    ].join(';');
    document.body.appendChild(link);
  }

  function redirectToMockDashboard(section, entry) {
    if (window.parent && window.parent !== window) {
      try {
        var targetOrigin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*';
        window.parent.postMessage({
          type: 'ielts-mock-part-complete',
          section: section || '',
          entry: entry || null
        }, targetOrigin);
        return;
      } catch (e) {}
    }
    var target = getMockDashboardHref();
    if (document.documentElement) {
      document.documentElement.style.cursor = 'progress';
    }
    try {
      window.location.replace(target);
    } catch (e) {
      window.location.href = target;
    }
  }

  function abortMockSubmitFlow(section, entry) {
    redirectToMockDashboard(section, entry);
    throw new Error('IELTS_MOCK_REDIRECT');
  }

  function resultPercent(entry) {
    var score = Number(entry && entry.score);
    var total = Number(entry && entry.total);
    if (!isFinite(score) || !isFinite(total) || total <= 0) return null;
    return Math.round((score / total) * 100);
  }

  function saveCompletedMockResult(mock) {
    if (!mock || !mock.completed || !(mock.completed.listening && mock.completed.reading && mock.completed.writing)) {
      return;
    }

    var sections = mock.results || {};
    var sectionKeys = ['listening', 'reading', 'writing'];
    var percents = sectionKeys.map(function (key) {
      return resultPercent(sections[key]);
    }).filter(function (value) {
      return value !== null;
    });
    var overall = percents.length
      ? Math.round(percents.reduce(function (sum, value) { return sum + value; }, 0) / percents.length)
      : 0;
    var submittedAt = sectionKeys.reduce(function (latest, key) {
      var at = String((sections[key] && sections[key].submitted_at) || '');
      return at > latest ? at : latest;
    }, '') || nowIso();

    var data = loadData();
    data.tests.mock = data.tests.mock || { visits: 0, opens: 0, last_opened: '', latest_score: null, best_score: null, last_submitted: '', results: [] };
    var entry = {
      attempt_id: mock.id || ('mock_' + submittedAt.replace(/[^0-9A-Za-z]/g, '')),
      test_id: mock.id || '',
      href: 'mock-results',
      label: 'Full IELTS Mock',
      score: overall,
      total: 100,
      submitted_at: submittedAt,
      tests: mock.tests || {},
      sections: {
        listening: sections.listening || null,
        reading: sections.reading || null,
        writing: sections.writing || null
      }
    };

    data.tests.mock.results = (data.tests.mock.results || []).filter(function (item) {
      return String(item && item.attempt_id || '') !== String(entry.attempt_id || '');
    });
    data.tests.mock.results.unshift(entry);
    if (data.tests.mock.results.length > MAX_RESULTS_PER_SECTION) {
      data.tests.mock.results = data.tests.mock.results.slice(0, MAX_RESULTS_PER_SECTION);
    }
    data.tests.mock.latest_score = entry.score;
    data.tests.mock.best_score = data.tests.mock.best_score == null
      ? entry.score
      : Math.max(Number(data.tests.mock.best_score) || 0, entry.score);
    data.tests.mock.last_submitted = entry.submitted_at;
    addActivity(data, 'Completed full mock: ' + entry.score + '/100');
    saveData(data);
  }

  function updateActiveMockSession(section, entry) {
    var params = null;
    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (e) {}
    var queryMockId = params ? (params.get('mock') || '') : '';
    var queryMockPart = params ? (params.get('mockPart') || '') : '';
    var activePart = '';
    try {
      activePart = sessionStorage.getItem('ielts_mock_active_part') || '';
    } catch (e) {}
    if (!activePart) {
      try { activePart = localStorage.getItem('ielts_mock_active_part') || ''; } catch (e) {}
    }

    if (!queryMockId && !queryMockPart && activePart !== section) return false;

    var mock = loadActiveMockSession();
    if (!mock || !mock.tests || !mock.tests[section]) return false;
    if (queryMockId && mock.id && queryMockId !== mock.id) return false;
    if (queryMockPart && queryMockPart !== section) return false;

    var expected = mock.tests[section] || {};
    var expectedTestId = String(expected.testId || '');
    var entryTestId = String(entry && entry.test_id || '');
    var expectedHref = normalizeMockPath(expected.href || '');
    var entryHref = normalizeMockPath(entry && entry.href || window.location.pathname);
    if (!queryMockId && !queryMockPart && expectedTestId && entryTestId && expectedTestId !== entryTestId && expectedHref && expectedHref !== entryHref) {
      return false;
    }

    mock.completed = mock.completed || {};
    mock.results = mock.results || {};
    mock.completed[section] = true;
    mock.results[section] = entry;
    saveActiveMockSession(mock);
    saveCompletedMockResult(mock);
    return true;
  }

  function trackTestResult(section, details) {
    if (!section) return;
    if (isSavedAttemptReview() && !(details && details.allow_review_tracking)) return;
    var data = loadData();
    if (!data.tests[section]) return;

    var score = Number(details && details.score);
    var total = Number(details && details.total);
    if (!isFinite(score) || !isFinite(total) || total <= 0) return;

    var label = (details && details.label) || (section.charAt(0).toUpperCase() + section.slice(1) + ' test');
    var submittedAt = nowIso();
    var attemptId = (details && details.attempt_id) || buildAttemptId(section, submittedAt);
    var answersSnapshot = details && details.answers;
    if (answersSnapshot && typeof answersSnapshot === 'object') {
      data.drafts = data.drafts || {};
      data.drafts[attemptId] = {
        answers: answersSnapshot,
        updated_at: submittedAt
      };
    }
    var entry = {
      attempt_id: attemptId,
      test_id: (details && details.test_id) || '',
      href: (details && details.href) || (window.location.pathname + window.location.search + window.location.hash),
      label: label,
      score: score,
      total: total,
      submitted_at: submittedAt
    };

    data.tests[section].results.unshift(entry);
    if (data.tests[section].results.length > MAX_RESULTS_PER_SECTION) {
      data.tests[section].results = data.tests[section].results.slice(0, MAX_RESULTS_PER_SECTION);
    }
    data.tests[section].latest_score = score;
    data.tests[section].last_submitted = submittedAt;
    data.tests[section].best_score = data.tests[section].best_score == null
      ? score
      : Math.max(data.tests[section].best_score, score);

    addActivity(data, 'Submitted ' + label + ': ' + score + '/' + total);
    saveData(data);
    var updatedActiveMock = updateActiveMockSession(section, entry);
    if (updatedActiveMock) {
      abortMockSubmitFlow(section, entry);
    }

    // Dispatch a global event so the AI recommendation engine (and any other
    // listener) can react without each individual test script having to be
    // modified. Wrapped in try/catch in case CustomEvent is unavailable.
    try {
      var detail = {
        section: section,
        score: score,
        total: total,
        label: label,
        test_id: entry.test_id,
        attempt_id: entry.attempt_id,
        href: entry.href,
        submitted_at: submittedAt,
        answers: details && details.answers ? Object.assign({}, details.answers) : null,
        mock_updated: updatedActiveMock
      };
      document.dispatchEvent(new CustomEvent('ielts:test-submitted', { detail: detail }));
    } catch (e) {}
  }

  function saveDraft(testId, answers) {
    if (!testId) return;
    var data = loadData();
    data.drafts = data.drafts || {};
    data.drafts[testId] = {
      answers: answers || {},
      updated_at: nowIso()
    };
    saveData(data);
  }

  function loadDraft(testId) {
    if (!testId) return {};
    var data = loadData();
    return (data.drafts && data.drafts[testId] && data.drafts[testId].answers) || {};
  }

  function bindPageTracking() {
    var body = document.body;
    if (!body) return;

    initClientRefreshWatcher();

    window.addEventListener('pageshow', function (event) {
      if (!getEmail() && event && event.persisted) {
        window.location.reload();
      }
    });

    var signedInEmail = getEmail();
    installMockFullscreenLock();

    // Stale-while-revalidate: hydrate premium + material state from
    // localStorage immediately so the page can render with correct info
    // on every visit after the first, with zero network wait. Fresh data
    // still comes in from /api/bootstrap below; pages can listen for the
    // `ielts-progress-ready` event to refresh themselves once it lands.
    if (signedInEmail) {
      if (hydrateFromCache()) {
        dispatchProgressReady('cache');
      }
    }

    // Prefer the single /api/bootstrap round-trip. If it succeeds, the three
    // module-level states are already populated, so the subsequent
    // initSync/initPremiumAccess/initMaterialAccess calls short-circuit
    // through their "already loaded" caches. If bootstrap fails (e.g. running
    // against an older server that doesn't have the endpoint), the three
    // calls fall back to hitting their original endpoints individually.
    (signedInEmail ? initBootstrap() : Promise.resolve(null)).then(function () {
      return Promise.all([initSync(), initPremiumAccess(), initMaterialAccess()]);
    }).then(function (results) {
      var premium = results[1] || premiumAccessState;
      if (!signedInEmail && isProtectedTestPath(window.location.pathname) && getMaterialAudience(window.location.pathname) !== 'all' && !hasServerExportAccess()) {
        promptLoginThenRedirect(toSiteRelativePath(window.location.pathname) + window.location.search + window.location.hash);
        return;
      }
      if (signedInEmail && isProtectedTestPath(window.location.pathname) && !canAccessMaterialHref(window.location.pathname) && !hasServerExportAccess()) {
        showMaterialAccessRequired(window.location.pathname);
        return;
      }

      var section = body.getAttribute('data-track-section');
      if (section) trackSectionVisit(section);

      document.addEventListener('click', function (e) {
        var startButton = e.target.closest('.start-button, [data-start-test]');
        if (guardStartButtonClick(e, startButton)) return;

        var testEl = e.target.closest('[data-track-test]');
        if (testEl) {
          var href = testEl.getAttribute('href') || '';
          var nextPath = buildSameOriginPath(href) || (toSiteRelativePath(window.location.pathname) + window.location.search + window.location.hash);
          var email = getEmail();
          if (!email) {
            if (isProtectedNextPath(nextPath)) {
              if (getMaterialAudience(nextPath) !== 'all') {
                e.preventDefault();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                promptLoginThenRedirect(nextPath);
                return;
              }
            }
          }
          if (email && isProtectedNextPath(nextPath) && !canAccessMaterialHref(nextPath)) {
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            showMaterialAccessRequired(nextPath);
            return;
          }
          if (email) {
            var s = testEl.getAttribute('data-track-test');
            var label = testEl.getAttribute('data-track-label') || testEl.textContent.trim();
            trackTestOpen(s, label);
          }
        }

        var linkEl = e.target.closest('a[href]');
        if (linkEl && !testEl) {
          var genericHref = linkEl.getAttribute('href') || '';
          var genericNextPath = buildSameOriginPath(genericHref);
          if (genericNextPath && isProtectedNextPath(genericNextPath)) {
            var signedEmail = getEmail();
            if (!signedEmail) {
              if (getMaterialAudience(genericNextPath) !== 'all') {
                e.preventDefault();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                promptLoginThenRedirect(genericNextPath);
                return;
              }
            }
            if (!canAccessMaterialHref(genericNextPath)) {
              e.preventDefault();
              if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
              showMaterialAccessRequired(genericNextPath);
              return;
            }
          }
        }

        var bookEl = e.target.closest('[data-track-book]');
        if (bookEl) {
          var id = bookEl.getAttribute('data-track-book');
          var bookLabel = bookEl.getAttribute('data-book-label') || bookEl.textContent.trim();
          trackBookUse(id, bookLabel);
        }
      }, { once: false, capture: true });
    });
  }

  (function () {
    var _nativeDefine = Object.defineProperty;
    var _exported = Object.freeze({
      getEmail: getEmail,
      getPremiumAccessState: getPremiumAccessState,
      initPremiumAccess: initPremiumAccess,
      getMaterialAccessState: getMaterialAccessState,
      initMaterialAccess: initMaterialAccess,
      isPremiumMaterialHref: isPremiumMaterialHref,
      getMaterialAudience: getMaterialAudience,
      canAccessMaterialHref: canAccessMaterialHref,
      deriveMaterialIdFromHref: deriveMaterialIdFromHref,
      loadData: loadData,
      saveData: saveData,
      initSync: initSync,
      fetchAccountData: fetchAccountData,
      trackSectionVisit: trackSectionVisit,
      trackTestOpen: trackTestOpen,
      trackBookUse: trackBookUse,
      trackTestResult: trackTestResult,
      buildAttemptId: buildAttemptId,
      trackLogin: trackLogin,
      saveDraft: saveDraft,
      loadDraft: loadDraft,
      clearLocalSessionData: clearLocalSessionData,
      getDeviceKey: getDeviceKey,
      showBlockedAccess: showBlockedAccess,
      showPremiumRequired: showPremiumRequired,
      checkClientRefresh: checkClientRefresh
    });
    try {
      _nativeDefine(window, 'IELTSProgress', {
        value: _exported,
        writable: false,
        configurable: false,
        enumerable: true
      });
    } catch (e) {
      window.IELTSProgress = _exported;
    }
  })();

  installInspectionProtection();

  function installReadingClipboardLimit() {
    if (!/\/Reading\//i.test(window.location.pathname) || window.__readingClipboardLimitInstalled) return;
    window.__readingClipboardLimitInstalled = true;

    function wordsFrom(value) {
      return String(value || '').trim().match(/\S+/g) || [];
    }

    function isTextAnswer(target) {
      if (!target || target.disabled || target.readOnly) return false;
      if (target.tagName === 'TEXTAREA') return true;
      if (target.tagName !== 'INPUT') return false;
      var type = String(target.type || 'text').toLowerCase();
      return type === 'text' || type === 'search';
    }

    function selectedText() {
      var active = document.activeElement;
      if (isTextAnswer(active) && typeof active.selectionStart === 'number' && typeof active.selectionEnd === 'number') {
        var inputSelection = active.value.slice(active.selectionStart, active.selectionEnd);
        if (inputSelection) return inputSelection;
      }
      return window.getSelection ? String(window.getSelection() || '') : '';
    }

    document.addEventListener('keydown', function (event) {
      var key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (key === 'c' || key === 'v')) {
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('copy', function (event) {
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      event.stopPropagation();
      var limited = wordsFrom(selectedText()).slice(0, 3).join(' ');
      if (!limited || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData('text/plain', limited);
    }, true);

    document.addEventListener('paste', function (event) {
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      event.stopPropagation();
      var target = event.target;
      if (!isTextAnswer(target) || !event.clipboardData) return;
      event.preventDefault();

      var pasted = wordsFrom(event.clipboardData.getData('text/plain')).slice(0, 3).join(' ');
      if (!pasted) return;
      var start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
      var end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start;
      var combined = target.value.slice(0, start) + pasted + target.value.slice(end);
      target.value = wordsFrom(combined).slice(0, 3).join(' ');
      if (typeof target.setSelectionRange === 'function') {
        target.setSelectionRange(target.value.length, target.value.length);
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);
  }

  function installReadingProgressBar() {
    if (!/\/Reading\//i.test(window.location.pathname)) return;
    installReadingClipboardLimit();
    document.body.classList.add('reading-listening-progress');
    if (document.getElementById('p2_passagePanel') && document.getElementById('p3_passagePanel')) {
      document.body.classList.add('reading-full-progress');
    }

    if (!document.querySelector('style[data-reading-progress-listening-style]')) {
      var style = document.createElement('style');
      style.setAttribute('data-reading-progress-listening-style', '1');
      style.textContent = [
        'body.reading-listening-progress .progress-container{background:#fff!important;border-top:0!important;outline:0!important;padding:0!important;box-shadow:none!important;z-index:1000!important;}',
        'body.reading-listening-progress .progress-nav{display:flex!important;align-items:stretch!important;justify-content:space-between!important;gap:0!important;min-height:48px!important;width:100%!important;padding:0!important;flex-wrap:nowrap!important;}',
        'body.reading-listening-progress .progress-items{display:flex!important;align-items:stretch!important;flex:1 1 auto!important;min-width:0!important;gap:0!important;overflow-x:auto!important;background:#fff!important;box-shadow:none!important;}',
        'body.reading-listening-progress #bottomPartTabs{display:flex!important;align-items:stretch!important;justify-content:space-between!important;gap:0!important;width:100%!important;min-width:max-content!important;background:#fff!important;box-shadow:none!important;}',
        'body.reading-listening-progress #bottomPartTabs.reading-progress-parts{min-width:0!important;}',
        'body.reading-listening-progress .reading-progress-part{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;flex:1 1 0!important;min-width:220px!important;min-height:48px!important;padding:0 20px!important;border-left:0!important;border-right:0!important;background:#fff!important;box-shadow:none!important;white-space:nowrap!important;cursor:pointer!important;}',
        'body.reading-listening-progress .reading-progress-part.active{justify-content:flex-start!important;background:#fff!important;box-shadow:none!important;}',
        'body.reading-listening-progress .part-label-progress{display:none!important;}',
        'body.reading-listening-progress .part-label-progress[hidden]{display:none!important;}',
        'body.reading-listening-progress .part-label-progress.is-complete{background:#2f8a24!important;}',
        'body.reading-listening-progress .part-mini-progress{display:none!important;}',
        'body.reading-listening-progress .part-mini-progress[hidden]{display:none!important;}',
        'body.reading-listening-progress .part-mini-progress span{display:block!important;flex:0 0 22px!important;width:22px!important;height:3px!important;background:#d7d7d7!important;}',
        'body.reading-listening-progress .part-mini-progress span.is-answered{background:#2f8a24!important;}',
        'body.reading-listening-progress .part-mini-progress span.is-current:not(.is-answered){background:#d7d7d7!important;}',
        'body.reading-listening-progress .reading-progress-rail{display:flex;align-items:center!important;gap:7px!important;flex-wrap:nowrap!important;}',
        'body.reading-listening-progress .part-button,body.reading-listening-progress #bottomPartTabs>.btn{appearance:none!important;box-sizing:border-box!important;position:relative!important;overflow:visible!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:transparent!important;border:0!important;box-shadow:none!important;color:#0f172a!important;font-size:16px!important;font-weight:700!important;line-height:1!important;padding:0!important;margin:0!important;min-width:auto!important;height:26px!important;border-radius:0!important;cursor:pointer!important;}',
        'body.reading-listening-progress .reading-progress-part.active .part-button::before{content:""!important;position:absolute!important;left:0!important;top:-8px!important;width:100%!important;height:3px!important;background:#d7d7d7!important;pointer-events:none!important;}',
        'body.reading-listening-progress .reading-progress-part.active .part-button.part-complete::before{background:#2f8a24!important;}',
        'body.reading-listening-progress .part-button.active,body.reading-listening-progress #bottomPartTabs>.btn strong{font-weight:800!important;}',
        'body.reading-listening-progress .part-progress-count{appearance:none!important;background:transparent!important;border:0!important;color:#64748b!important;font-size:16px!important;font-weight:400!important;line-height:1!important;padding:0!important;margin:0!important;cursor:pointer!important;}',
        'body.reading-listening-progress .part-progress-count:hover,body.reading-listening-progress .part-button:hover{color:#0b5cab!important;}',
        'body.reading-listening-progress .progress-item{appearance:none!important;box-sizing:border-box!important;position:relative!important;overflow:visible!important;display:flex!important;align-items:center!important;justify-content:center!important;width:22px!important;min-width:22px!important;height:26px!important;min-height:0!important;padding:0 3px!important;margin:0!important;border:0!important;border-radius:3px!important;background:transparent!important;box-shadow:none!important;color:#0f172a!important;font-size:16px!important;font-weight:400!important;line-height:1!important;transform:none!important;cursor:pointer!important;transition:background-color .15s ease,border-color .15s ease!important;}',
        'body.reading-listening-progress .progress-item::before{content:""!important;position:absolute!important;left:0!important;top:-8px!important;width:100%!important;height:3px!important;background:#d7d7d7!important;pointer-events:none!important;}',
        'body.reading-listening-progress .progress-item.answered::before,body.reading-listening-progress .progress-item.correct::before,body.reading-listening-progress .progress-item.incorrect::before{background:#2f8a24!important;}',
        'body.reading-listening-progress .progress-item:hover{background:#e8f1fb!important;transform:none!important;}',
        'body.reading-listening-progress .progress-item.current{background:#fff!important;border:2px solid #2b8ed8!important;color:#0f172a!important;font-weight:700!important;padding:0 3px!important;}',
        'body.reading-listening-progress .progress-item.answered:not(.current){background:#bbf7d0!important;border:1px solid #86efac!important;color:#064e3b!important;border-radius:5px!important;font-weight:600!important;}',
        'body.reading-listening-progress .progress-item.correct{background:#9ae6b4!important;border:1px solid #38a169!important;color:#064e3b!important;border-radius:5px!important;font-weight:700!important;}',
        'body.reading-listening-progress .progress-item.incorrect{background:#fecaca!important;border:1px solid #f87171!important;color:#7f1d1d!important;border-radius:5px!important;font-weight:700!important;}',
        'body.reading-listening-progress.reading-full-progress #bottomPartTabs.reading-progress-parts .reading-progress-part.active{flex:0 0 auto!important;min-width:max-content!important;}',
        'body.reading-listening-progress #bottomPartTabs.reading-progress-parts .part-button{height:22px!important;border-radius:2px!important;line-height:1.1!important;}',
        'body.reading-listening-progress #bottomPartTabs.reading-progress-parts .progress-item{height:22px!important;border:1px solid transparent!important;border-radius:2px!important;line-height:1.1!important;}',
        'body.reading-listening-progress #bottomPartTabs.reading-progress-parts .progress-item.current{border:1px solid #2563eb!important;box-shadow:0 0 0 1px rgba(37,99,235,.2)!important;}',
        'body.reading-listening-progress .nav-buttons{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:0!important;flex:0 0 auto!important;margin-left:auto!important;padding:6px 14px!important;border-left:0!important;background:#fff!important;box-shadow:none!important;}',
        'body.reading-listening-progress #prev-btn,body.reading-listening-progress #next-btn{display:none!important;}',
        'body.reading-listening-progress #submit-all-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;padding:0 18px!important;border-radius:4px!important;font-size:14px!important;font-weight:700!important;white-space:nowrap!important;}',
        '@media (max-width: 760px){body.reading-listening-progress .progress-nav{min-height:44px!important;}body.reading-listening-progress .reading-progress-part{min-width:160px!important;padding:0 12px!important;gap:8px!important;}body.reading-listening-progress .part-button,body.reading-listening-progress #bottomPartTabs>.btn,body.reading-listening-progress .part-progress-count,body.reading-listening-progress .progress-item{font-size:14px!important;}body.reading-listening-progress .nav-buttons{padding:5px 8px!important;}body.reading-listening-progress #submit-all-btn{padding:0 12px!important;}}'
      ].join('\n');
      document.head.appendChild(style);
    }

    function normalize() {
      var prev = document.getElementById('prev-btn');
      var next = document.getElementById('next-btn');
      if (prev) prev.setAttribute('aria-hidden', 'true');
      if (next) next.setAttribute('aria-hidden', 'true');
      var tabs = document.getElementById('bottomPartTabs');
      if (!tabs) return;

      function syncMiniProgress(partWrap, rail, isActive) {
        if (!partWrap || !rail) return;
        var chips = Array.prototype.slice.call(rail.querySelectorAll('.progress-item'));
        var strip = partWrap.querySelector('.part-mini-progress');
        if (!strip) {
          strip = document.createElement('div');
          strip.className = 'part-mini-progress';
          strip.setAttribute('aria-hidden', 'true');
          partWrap.insertBefore(strip, partWrap.firstChild);
        }
        var signature = [
          isActive ? '1' : '0',
          chips.length,
          chips.map(function (chip) {
            return [
              chip.classList.contains('answered') ? 'a' : '',
              chip.classList.contains('correct') ? 'c' : '',
              chip.classList.contains('incorrect') ? 'i' : '',
              chip.classList.contains('current') ? 'n' : ''
            ].join('');
          }).join('|')
        ].join(':');
        if (isActive && chips.length) {
          var wrapRect = partWrap.getBoundingClientRect();
          var railRect = rail.getBoundingClientRect();
          var left = Math.max(0, Math.round(railRect.left - wrapRect.left));
          var width = Math.max(0, Math.round(railRect.width));
          signature += ':' + left + ':' + width;
        }
        if (strip.dataset.signature === signature) return;
        strip.dataset.signature = signature;
        strip.hidden = !isActive;
        strip.style.gridTemplateColumns = 'repeat(' + Math.max(chips.length, 1) + ', 1fr)';
        if (isActive && chips.length) {
          var activeWrapRect = partWrap.getBoundingClientRect();
          var activeRailRect = rail.getBoundingClientRect();
          strip.style.left = Math.max(0, Math.round(activeRailRect.left - activeWrapRect.left)) + 'px';
          strip.style.right = 'auto';
          strip.style.width = Math.max(0, Math.round(activeRailRect.width)) + 'px';
        } else {
          strip.style.left = '0';
          strip.style.right = 'auto';
          strip.style.width = '100%';
        }
        strip.textContent = '';
        chips.forEach(function (chip) {
          var segment = document.createElement('span');
          segment.classList.toggle('is-answered',
            chip.classList.contains('answered') ||
            chip.classList.contains('correct') ||
            chip.classList.contains('incorrect'));
          segment.classList.toggle('is-current', chip.classList.contains('current'));
          strip.appendChild(segment);
        });
      }

      function syncLabelProgress(partWrap, isActive) {
        if (!partWrap) return;
        var button = partWrap.querySelector('.part-button, #bottomPartTabs > .btn');
        var rail = partWrap.querySelector('.reading-progress-rail, [id^="rail-part-"]');
        if (!button) return;
        var labelStrip = partWrap.querySelector('.part-label-progress');
        if (!labelStrip) {
          labelStrip = document.createElement('div');
          labelStrip.className = 'part-label-progress';
          labelStrip.setAttribute('aria-hidden', 'true');
          partWrap.insertBefore(labelStrip, partWrap.firstChild);
        }
        labelStrip.hidden = !isActive;
        var chips = rail ? Array.prototype.slice.call(rail.querySelectorAll('.progress-item')) : [];
        var answered = chips.filter(function (chip) {
          return chip.classList.contains('answered') ||
            chip.classList.contains('correct') ||
            chip.classList.contains('incorrect');
        }).length;
        button.classList.toggle('part-complete', chips.length > 0 && answered === chips.length);
        labelStrip.classList.toggle('is-complete', chips.length > 0 && answered === chips.length);
        var wrapRect = partWrap.getBoundingClientRect();
        var buttonRect = button.getBoundingClientRect();
        labelStrip.style.left = Math.max(0, Math.round(buttonRect.left - wrapRect.left)) + 'px';
        labelStrip.style.width = Math.max(24, Math.round(buttonRect.width)) + 'px';
      }

      Array.prototype.slice.call(tabs.querySelectorAll('.reading-progress-part')).forEach(function (partWrap) {
        var rail = partWrap.querySelector('.reading-progress-rail, [id^="rail-part-"]');
        var isActive = partWrap.classList.contains('active') || (rail && rail.style.display !== 'none');
        syncLabelProgress(partWrap, isActive);
        syncMiniProgress(partWrap, rail, isActive);
      });

      var children = Array.prototype.slice.call(tabs.children);
      var hasDirectRail = children.some(function (child) {
        return child.id && child.id.indexOf('rail-part-') === 0;
      });
      if (!hasDirectRail) return;

      tabs.classList.add('reading-progress-parts');
      tabs.classList.add('reading-progress-parts-legacy');
      children.forEach(function (child) {
        if (child.parentNode !== tabs || child.id && child.id.indexOf('rail-part-') === 0) return;
        if (child.tagName !== 'BUTTON') return;

        var rail = child.nextElementSibling;
        if (!rail || !rail.id || rail.id.indexOf('rail-part-') !== 0) return;

        var isActive = rail.style.display !== 'none';
        var partWrap = document.createElement('div');
        partWrap.className = 'reading-progress-part' + (isActive ? ' active' : '');
        partWrap.onclick = function (event) {
          if (event.target && event.target.classList && event.target.classList.contains('progress-item')) return;
          child.click();
        };

        child.classList.add('part-button');
        if (/^Part\s+\d+$/i.test((child.textContent || '').trim())) {
          child.textContent = child.textContent.replace(/^Part/i, 'Passage');
        }
        if (isActive) child.classList.add('active');
        partWrap.appendChild(child);

        if (!isActive) {
          var chips = Array.prototype.slice.call(rail.querySelectorAll('.progress-item'));
          var answered = chips.filter(function (chip) {
            return chip.classList.contains('answered') || chip.classList.contains('correct') || chip.classList.contains('incorrect');
          }).length;
          var count = document.createElement('button');
          count.type = 'button';
          count.className = 'part-progress-count';
          count.textContent = answered + ' of ' + chips.length;
          count.onclick = function () { child.click(); };
          partWrap.appendChild(count);
        }

        rail.classList.add('reading-progress-rail');
        partWrap.appendChild(rail);
        tabs.appendChild(partWrap);
        syncLabelProgress(partWrap, isActive);
        syncMiniProgress(partWrap, rail, isActive);
      });
      Array.prototype.slice.call(tabs.children).forEach(function (child) {
        if (!child.classList || !child.classList.contains('reading-progress-part')) {
          tabs.removeChild(child);
        }
      });
    }

    function scheduleNormalize() {
      window.setTimeout(normalize, 0);
    }

    normalize();
    window.setTimeout(normalize, 120);
    window.setTimeout(normalize, 500);

    if (!window.__readingProgressBarRefreshAttached) {
      window.__readingProgressBarRefreshAttached = true;
      ['click', 'input', 'change', 'drop'].forEach(function (eventName) {
        document.addEventListener(eventName, scheduleNormalize, true);
      });
      window.addEventListener('resize', scheduleNormalize);
      window.addEventListener('orientationchange', scheduleNormalize);
    }
  }

  // Lazily inject the AI recommendation engine on every page that loads this
  // tracker. Reading/Listening test pages need it to show the post-submit
  // modal; the account page uses it to render saved recommendations. Other
  // pages get a no-op include — the engine just sits idle if no event fires.
  function injectAiRecommendation() {
    if (window.__ieltsAiRecoInjected) return;
    window.__ieltsAiRecoInjected = true;

    var scriptHref;
    var cssHref;
    if (window.location.protocol === 'file:') {
      var path = window.location.pathname;
      var root = '';
      if (/\/(?:Reading|Listening|Writing)\//.test(path)) {
        root = path.replace(/\/(?:Reading|Listening|Writing)\/.*$/, '/');
      } else {
        root = path.replace(/\/[^/]*$/, '/');
      }
      scriptHref = root + 'assets/ai-recommendation.js';
      cssHref = root + 'assets/ai-recommendation.css';
    } else {
      scriptHref = '/assets/ai-recommendation.js';
      cssHref = '/assets/ai-recommendation.css';
    }

    if (!document.querySelector('link[data-ai-reco-css]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref + '?v=20260520-reading-result-actions-62';
      link.setAttribute('data-ai-reco-css', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-ai-reco-js]')) {
      var script = document.createElement('script');
      script.src = scriptHref;
      script.async = true;
      script.setAttribute('data-ai-reco-js', '1');
      document.head.appendChild(script);
    }

    // Submit-button "reopen results" shim — works for both
    // #submit-all-btn (Reading full + passage tests) and #submitBtn
    // (Listening full + section tests). Cheap enough to inject on every
    // page; it no-ops when no matching button exists.
    if (!document.querySelector('script[data-submit-reopen-shim]')) {
      var shimHref;
      if (window.location.protocol === 'file:') {
        var shimRoot = window.location.pathname;
        if (/\/(?:Reading|Listening|Writing|Books)\//.test(shimRoot)) {
          shimRoot = shimRoot.replace(/\/(?:Reading|Listening|Writing|Books)\/.*$/, '/');
        } else {
          shimRoot = shimRoot.replace(/\/[^/]*$/, '/');
        }
        shimHref = shimRoot + 'assets/submit-reopen-shim.js';
      } else {
        shimHref = '/assets/submit-reopen-shim.js';
      }
      var shimScript = document.createElement('script');
      shimScript.src = shimHref + '?v=20260519-submit-first';
      shimScript.async = true;
      shimScript.setAttribute('data-submit-reopen-shim', '1');
      document.head.appendChild(shimScript);
    }

    // Generic audio preload for the few test pages that contain #testAudio but
    // are not covered by the dedicated Listening full/section helpers.
    if (!document.querySelector('script[data-audio-preload]')) {
      var audioPreloadHref;
      if (window.location.protocol === 'file:') {
        var audioRoot = window.location.pathname;
        if (/\/(?:Reading|Listening|Writing|Books)\//.test(audioRoot)) {
          audioRoot = audioRoot.replace(/\/(?:Reading|Listening|Writing|Books)\/.*$/, '/');
        } else {
          audioRoot = audioRoot.replace(/\/[^/]*$/, '/');
        }
        audioPreloadHref = audioRoot + 'assets/audio-preload.js';
      } else {
        audioPreloadHref = '/assets/audio-preload.js';
      }
      var audioPreloadScript = document.createElement('script');
      audioPreloadScript.src = audioPreloadHref + '?v=20260609-audio-preload';
      audioPreloadScript.async = true;
      audioPreloadScript.setAttribute('data-audio-preload', '1');
      document.head.appendChild(audioPreloadScript);
    }

    // Writing pages also need the Writing Results Panel (PDF download + AI
    // Recommendations launcher). It's safe to load on other pages too, but
    // we save the bandwidth by gating on the Writing path.
    var isWritingPage = /\/Writing\//i.test(window.location.pathname);
    if (isWritingPage) {
      var wrScript;
      var wrCss;
      if (window.location.protocol === 'file:') {
        var wrRoot = window.location.pathname.replace(/\/(?:Reading|Listening|Writing)\/.*$/, '/');
        wrScript = wrRoot + 'assets/writing-results-panel.js';
        wrCss = wrRoot + 'assets/writing-results-panel.css';
      } else {
        wrScript = '/assets/writing-results-panel.js';
        wrCss = '/assets/writing-results-panel.css';
      }
      if (!document.querySelector('link[data-wr-panel-css]')) {
        var wrLink = document.createElement('link');
        wrLink.rel = 'stylesheet';
        wrLink.href = wrCss;
        wrLink.setAttribute('data-wr-panel-css', '1');
        document.head.appendChild(wrLink);
      }
      if (!document.querySelector('script[data-wr-panel-js]')) {
        var wrScriptEl = document.createElement('script');
        wrScriptEl.src = wrScript;
        wrScriptEl.async = true;
        wrScriptEl.setAttribute('data-wr-panel-js', '1');
        document.head.appendChild(wrScriptEl);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindPageTracking();
      installReadingProgressBar();
      injectAiRecommendation();
    });
  } else {
    bindPageTracking();
    installReadingProgressBar();
    injectAiRecommendation();
  }
})();
