(function () {
  var AUTH_STORAGE_KEY = 'ielts_user_email';

  function installInspectionProtection() {
    // Window-level flag so progress-tracker.js and this file don't both install
    // duplicate handlers (which would each capture every keydown/contextmenu).
    if (window.__ieltsInspectionProtectionInstalled || !document || !document.addEventListener) return;
    window.__ieltsInspectionProtectionInstalled = true;

    document.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      event.stopPropagation();
    }, true);

    document.addEventListener('keydown', function (event) {
      var key = String(event.key || '').toLowerCase();
      var code = Number(event.keyCode || event.which || 0);
      var ctrlOrMeta = !!(event.ctrlKey || event.metaKey);
      var shift = !!event.shiftKey;

      var blocked =
        key === 'f12' ||
        key === 'f3' ||
        code === 123 ||
        code === 114 ||
        (ctrlOrMeta && shift && (key === 'i' || key === 'j' || key === 'c' || code === 73 || code === 74 || code === 67)) ||
        (ctrlOrMeta && (key === 'f' || code === 70)) ||
        (ctrlOrMeta && (key === 'u' || code === 85));

      if (!blocked) return;

      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      event.stopPropagation();
      return false;
    }, true);
  }

  function getSignedInEmail() {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function updateHeaderAccountState(topbar) {
    if (!topbar) return;
    var loginQuick = topbar.querySelector('.login-quick');
    var email = getSignedInEmail();
    var menuLogin = topbar.querySelector('.menu-link[href="/login"]');
    if (!email) {
      if (loginQuick) {
        loginQuick.textContent = 'Login';
        loginQuick.setAttribute('href', '/login');
        loginQuick.setAttribute('title', 'Login');
      }
      if (menuLogin) menuLogin.textContent = 'Login';
      return;
    }
    if (loginQuick) {
      loginQuick.textContent = 'Account';
      loginQuick.setAttribute('href', '/account');
      loginQuick.setAttribute('title', email);
    }
    if (menuLogin) {
      menuLogin.textContent = 'Account';
      menuLogin.setAttribute('href', '/account');
    }
  }

  function iconSearch() {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M16 16L21 21"></path></svg>';
  }

  function siteSearch(query) {
    var q = query.toLowerCase().trim();
    if (!q) return null;

    var pages = [
      { href: '/', score: 0, terms: ['home', 'main', 'ielts', 'cdi', 'materials', 'website', 'intro', 'contact', 'method', 'platform', 'online course', 'assessment'] },
      { href: '/listening', score: 0, terms: ['listening', 'audio', 'section 1', 'section 2', 'section 3', 'section 4', 'transcript', 'note taking'] },
      { href: '/reading', score: 0, terms: ['reading', 'passage', 'true false not given', 'matching headings', 'vocabulary', 'comprehension'] },
      { href: '/speaking', score: 0, terms: ['speaking', 'part 1', 'part 2', 'part 3', 'cue card', 'fluency', 'pronunciation'] },
      { href: '/writing', score: 0, terms: ['writing', 'task 1', 'task 2', 'essay', 'report', 'band feedback', 'grammar'] },
      { href: '/books', score: 0, terms: ['books', 'book', 'materials', 'vocabulary books', 'practice books'] },
      { href: '/login', score: 0, terms: ['login', 'sign in', 'signin', 'account', 'password'] }
    ];

    for (var i = 0; i < pages.length; i += 1) {
      var page = pages[i];
      var localScore = 0;
      for (var j = 0; j < page.terms.length; j += 1) {
        var term = page.terms[j];
        if (term === q) {
          localScore += 6;
        } else if (term.indexOf(q) !== -1 || q.indexOf(term) !== -1) {
          localScore += 3;
        }
      }
      if (page.href.toLowerCase().indexOf(q) !== -1) {
        localScore += 4;
      }
      page.score = localScore;
    }

    pages.sort(function (a, b) { return b.score - a.score; });
    return pages[0].score > 0 ? pages[0].href : null;
  }

  function setupHeader() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    updateHeaderAccountState(topbar);

    // Re-sync the topbar when auth state changes elsewhere — same-tab login
    // pages dispatch `ielts:auth-changed`, and other tabs trigger the
    // `storage` event when localStorage[ielts_user_email] is mutated.
    var refresh = function () { updateHeaderAccountState(topbar); };
    window.addEventListener('ielts:auth-changed', refresh);
    window.addEventListener('storage', function (event) {
      if (!event || event.key === AUTH_STORAGE_KEY || event.key === null) refresh();
    });

    // Sync page-specific menu theme vars from .topbar to root so injected UI
    // elements (drawer/search panel) inherit the same page palette.
    var themedVars = [
      '--menu-accent',
      '--menu-panel-bg',
      '--menu-panel-border',
      '--menu-panel-text',
      '--menu-drawer-bg',
      '--menu-drawer-text',
      '--menu-drawer-subtext'
    ];
    var topbarStyles = window.getComputedStyle(topbar);
    themedVars.forEach(function (v) {
      var value = topbarStyles.getPropertyValue(v).trim();
      if (value) document.documentElement.style.setProperty(v, value);
    });

    var searchBtn = topbar.querySelector('.search-btn');
    var menuBtn = topbar.querySelector('.menu-btn');
    var menuList = topbar.querySelector('.menu-list');
    if (!searchBtn || !menuBtn || !menuList) return;

    var shell = document.querySelector('.shell') || document.body;

    var searchPanel = document.createElement('div');
    searchPanel.className = 'search-panel';
    searchPanel.innerHTML =
      '<input class="search-input" type="text" placeholder="Search for..." aria-label="Search input">' +
      '<button class="search-submit" type="button" aria-label="Run search">' + iconSearch() + '</button>';
    topbar.appendChild(searchPanel);

    function closeSearch() {
      searchPanel.classList.remove('open');
    }

    searchBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      searchPanel.classList.toggle('open');
      if (searchPanel.classList.contains('open')) {
        searchPanel.querySelector('.search-input').focus();
      }
    });

    function runSearch() {
      var input = searchPanel.querySelector('.search-input');
      var q = input.value.trim();
      if (!q) return;

      var target = siteSearch(q);
      if (target) {
        window.location.href = target + '?q=' + encodeURIComponent(q);
        return;
      }
      window.alert('No matching page found inside this website for: ' + q);
    }

    searchPanel.querySelector('.search-submit').addEventListener('click', runSearch);
    searchPanel.querySelector('.search-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });

    var overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    var drawer = document.createElement('aside');
    drawer.className = 'side-drawer';
    drawer.setAttribute('aria-label', 'Main menu');

    var html = '<div class="drawer-top"><button class="drawer-close" type="button" aria-label="Close menu">×</button></div>';
    html += '<ul class="drawer-list">';

    Array.prototype.slice.call(menuList.querySelectorAll(':scope > .menu-item')).forEach(function (item) {
      var link = item.querySelector(':scope > .menu-link');
      if (!link) return;
      var sub = item.querySelector(':scope > .submenu');
      var hasSub = !!sub;

      html += '<li class="drawer-item">';
      html += '<div class="drawer-head">';
      html += '<a class="drawer-link" href="' + link.getAttribute('href') + '">' + link.textContent.trim() + '</a>';
      if (hasSub) {
        html += '<button class="drawer-toggle" type="button" aria-label="Expand">⌄</button>';
      }
      html += '</div>';

      if (hasSub) {
        html += '<ul class="drawer-sub">';
        Array.prototype.slice.call(sub.querySelectorAll('a')).forEach(function (a) {
          html += '<li><a href="' + a.getAttribute('href') + '">' + a.textContent.trim() + '</a></li>';
        });
        html += '</ul>';
      }
      html += '</li>';
    });

    var extraLinks = [
      { t: getSignedInEmail() ? 'Account' : 'Login', h: getSignedInEmail() ? '/account' : '/login' },
      { t: 'Contact', h: '#' },
      { t: 'News', h: '#' }
    ];
    extraLinks.forEach(function (x) {
      html += '<li class="drawer-item"><div class="drawer-head"><a class="drawer-link" href="' + x.h + '">' + x.t + '</a></div></li>';
    });

    html += '</ul>';
    drawer.innerHTML = html;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function closeMenu() {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }

    function openMenu() {
      overlay.classList.add('open');
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openMenu();
    });

    overlay.addEventListener('click', closeMenu);
    drawer.querySelector('.drawer-close').addEventListener('click', closeMenu);

    Array.prototype.slice.call(drawer.querySelectorAll('.drawer-toggle')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var li = btn.closest('.drawer-item');
        if (!li) return;
        li.classList.toggle('open');
      });
    });

    document.addEventListener('click', function (e) {
      if (!topbar.contains(e.target)) closeSearch();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSearch();
        closeMenu();
      }
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !isLocal) return;
    var ua = navigator.userAgent || '';
    var isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(ua);

    if (isSafari) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          registrations.forEach(function (registration) {
            registration.unregister();
          });
        }).catch(function () {
          // Safari should use the network directly if SW cleanup is not allowed.
        });
      });
      return;
    }

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        // Ignore registration failures and keep normal page behavior.
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHeader);
  } else {
    setupHeader();
  }
  installInspectionProtection();
  registerServiceWorker();
})();
