(function () {
  if (window.__listeningSectionProgressInitialized) return;
  window.__listeningSectionProgressInitialized = true;

  var rawPath = String(window.location.pathname || '');
  var lowerPath = rawPath.toLowerCase();
  var decodedPath = lowerPath;
  try {
    decodedPath = decodeURIComponent(rawPath).toLowerCase();
  } catch (e) {}

  if (decodedPath.indexOf('/listening/section ') === -1) return;

  var searchParams = new URLSearchParams(window.location.search || '');
  var attemptQueryId = searchParams.get('attempt') || '';
  var redoQuery = searchParams.get('redo') === '1';
  var legacyAnswerStoragePrefix = 'ielts_saved_answers_';
  var saveTimer = null;
  var startWrapped = false;
  var submitWrapped = false;
  var showResultsWrapped = false;
  var closeResultsWrapped = false;
  var submissionTracked = false;
  var modalObserverAttached = false;
  var headerMenuLink = null;
  var audioPreparationPromise = null;
  var preparedAudioUrl = '';

  function isSafariLikeBrowser() {
    var ua = String((navigator && navigator.userAgent) || '');
    return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Android|Edg|OPR|SamsungBrowser/i.test(ua);
  }

  function getAudioControllerBar() {
    return document.querySelector('.audio-controller-bar');
  }

  function getAudioElement() {
    return document.getElementById('testAudio');
  }

  function getStartButton() {
    return document.querySelector('.start-button');
  }

  function getAudioControllerNote() {
    return document.querySelector('.audio-controller-note');
  }

  function getHeader() {
    return document.querySelector('.header');
  }

  function getTestInterface() {
    return document.getElementById('testInterface') || document.querySelector('.test-interface');
  }

  function getResultsModal() {
    return document.getElementById('resultsModal');
  }

  function getLoadingScreen() {
    return document.getElementById('loadingScreen');
  }

  function getStartScreen() {
    return document.getElementById('startScreen');
  }

  function getBottomNavigation() {
    return document.getElementById('bottomNavigation') || document.querySelector('.bottom-navigation');
  }

  function syncAudioControllerLayout() {
    var audioBar = getAudioControllerBar();
    var header = getHeader();
    var testInterface = getTestInterface();
    if (!audioBar || !header || !testInterface) return;

    if (audioBar.parentNode !== testInterface || header.nextElementSibling !== audioBar) {
      header.insertAdjacentElement('afterend', audioBar);
    }

    var headerHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 0));
    if (headerHeight) {
      audioBar.style.top = headerHeight + 'px';
    }
    audioBar.style.zIndex = '195';
    audioBar.style.width = '100%';
  }

  function attachAudioLayoutGuard() {
    if (window.__listeningSectionAudioLayoutGuardAttached) return;
    window.__listeningSectionAudioLayoutGuardAttached = true;

    var sync = function () {
      syncAudioControllerLayout();
    };

    sync();
    window.setTimeout(sync, 0);
    window.setTimeout(sync, 180);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    if (typeof MutationObserver === 'function') {
      var header = getHeader();
      if (header) {
        var headerObserver = new MutationObserver(sync);
        headerObserver.observe(header, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['class', 'style']
        });
      }
    }

    if (typeof ResizeObserver === 'function') {
      var resizeHeader = getHeader();
      if (resizeHeader) {
        var resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(resizeHeader);
      }
    }
  }

  function updateAudioControllerNote(isReviewMode) {
    var note = getAudioControllerNote();
    if (!note) return;

    note.textContent = isReviewMode
      ? 'Review mode - use this player to re-listen while checking your answers.'
      : 'This player appears here after you submit or open review answers.';
  }

  function getSectionAudioSource() {
    var audio = getAudioElement();
    if (!audio) return '';
    if (audio.getAttribute('src')) return audio.getAttribute('src');
    var source = audio.querySelector('source[src]');
    if (source) return source.getAttribute('src') || '';
    return audio.currentSrc || '';
  }

  function setAudioPreparationUi(isPreparing, percent) {
    var button = getStartButton();
    var startScreen = getStartScreen();
    var subtitle = startScreen ? startScreen.querySelector('.start-subtitle') : document.querySelector('.start-subtitle');
    var cleanPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (button) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || 'Start Test';
      }
      button.disabled = !!isPreparing;
      button.textContent = isPreparing ? 'Preparing audio ' + cleanPercent + '%' : button.dataset.originalText;
    }
    if (subtitle) {
      if (!subtitle.dataset.originalText) {
        subtitle.dataset.originalText = subtitle.textContent || '';
      }
      subtitle.textContent = isPreparing
        ? 'Preparing audio for smooth playback in this browser.'
        : subtitle.dataset.originalText;
    }
  }

  function fetchAudioBlobWithProgress(source, onProgress) {
    return fetch(source, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Audio download failed');
        var total = Number(response.headers.get('Content-Length')) || 0;
        if (!response.body || typeof response.body.getReader !== 'function' || !total) {
          if (typeof onProgress === 'function') onProgress(0);
          return response.blob().then(function (blob) {
            if (typeof onProgress === 'function') onProgress(1);
            return blob;
          });
        }

        var reader = response.body.getReader();
        var loaded = 0;
        var chunks = [];

        function readNext() {
          return reader.read().then(function (result) {
            if (result.done) {
              if (typeof onProgress === 'function') onProgress(1);
              return new Blob(chunks, {
                type: response.headers.get('Content-Type') || 'audio/mpeg'
              });
            }
            chunks.push(result.value);
            loaded += result.value.byteLength || result.value.length || 0;
            if (typeof onProgress === 'function') {
              onProgress(Math.max(0, Math.min(1, loaded / total)));
            }
            return readNext();
          });
        }

        return readNext();
      });
  }

  function applyPreparedAudioSource() {
    var audio = getAudioElement();
    if (!audio || !preparedAudioUrl) return;
    try {
      audio.pause();
    } catch (e) {}
    Array.prototype.forEach.call(audio.querySelectorAll('source'), function (source) {
      source.parentNode.removeChild(source);
    });
    audio.setAttribute('src', preparedAudioUrl);
    try {
      audio.load();
    } catch (e) {}
  }

  function prepareSectionAudioForLocalPlayback() {
    if (audioPreparationPromise) return audioPreparationPromise;
    if (isSafariLikeBrowser()) {
      return Promise.resolve(false);
    }
    if (!window.fetch || !window.URL || typeof window.URL.createObjectURL !== 'function') {
      return Promise.resolve(false);
    }
    var source = getSectionAudioSource();
    if (!source || /^blob:/i.test(source)) return Promise.resolve(false);

    setAudioPreparationUi(true, 0);
    audioPreparationPromise = fetchAudioBlobWithProgress(source, function (fraction) {
        setAudioPreparationUi(true, fraction * 100);
      })
      .then(function (blob) {
        preparedAudioUrl = URL.createObjectURL(blob);
        applyPreparedAudioSource();
        setAudioPreparationUi(false);
        return true;
      })
      .catch(function () {
        audioPreparationPromise = null;
        setAudioPreparationUi(false);
        return false;
      });
    return audioPreparationPromise;
  }

  window.addEventListener('beforeunload', function () {
    if (preparedAudioUrl) {
      try { URL.revokeObjectURL(preparedAudioUrl); } catch (e) {}
    }
  });

  function isResultsModalVisible() {
    var resultsModal = getResultsModal();
    return !!(resultsModal && !resultsModal.classList.contains('hidden'));
  }

  function isReviewModeActive() {
    return !!window.testSubmitted ||
      !!window.__listeningSubmissionObserved ||
      !!(document.body && document.body.classList.contains('listening-review-active')) ||
      isResultsModalVisible();
  }

  function hasActiveTestInterface() {
    var testInterface = getTestInterface();
    return !!window.__listeningTestStarted ||
      isReviewModeActive() ||
      !!(testInterface && !testInterface.classList.contains('hidden'));
  }

  function syncPrimarySectionScreens() {
    if (!hasActiveTestInterface()) return;

    var loadingScreen = getLoadingScreen();
    var startScreen = getStartScreen();
    var testInterface = getTestInterface();
    var bottomNavigation = getBottomNavigation();

    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    if (startScreen) {
      startScreen.classList.add('hidden');
    }
    if (testInterface) {
      testInterface.classList.remove('hidden');
    }
    if (bottomNavigation && hasActiveTestInterface()) {
      bottomNavigation.classList.remove('hidden');
    }
  }

  function hideAudioControllerUntilReview() {
    syncPrimarySectionScreens();
    syncAudioControllerLayout();
    updateAudioControllerNote(false);

    var audioBar = getAudioControllerBar();
    if (!audioBar) return;
    audioBar.classList.add('hidden');
  }

  function revealReviewAudioController() {
    syncPrimarySectionScreens();
    syncAudioControllerLayout();
    updateAudioControllerNote(true);

    var audioBar = getAudioControllerBar();
    if (audioBar) {
      audioBar.classList.remove('hidden');
    }

    window.__listeningSubmissionObserved = true;
    showHeaderMenuLink();
  }

  function enforceAudioVisibilityState() {
    syncPrimarySectionScreens();
    if (isReviewModeActive()) {
      revealReviewAudioController();
      return;
    }
    hideAudioControllerUntilReview();
  }

  function deriveTestId() {
    var decoded = rawPath;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch (e) {}
    decoded = decoded.replace(/\.html$/i, '');
    return 'listening_' + decoded.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  var testStorageId = deriveTestId();

  function getLabel() {
    var title = document.querySelector('.part-title');
    if (title && title.textContent.trim()) return title.textContent.trim();
    var heading = document.querySelector('.start-subtitle');
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return document.title || 'Listening Section';
  }

  function getMenuHref() {
    var pathname = String(window.location.pathname || '');
    if (window.location.protocol === 'file:') {
      var normalized = pathname.replace(/\\/g, '/');
      var marker = '/Listening/';
      var index = normalized.lastIndexOf(marker);
      if (index !== -1) {
        return normalized.slice(0, index + 1) + 'listening.html';
      }
      return 'listening.html';
    }
    return '/listening.html';
  }

  function ensureNavigationStyles() {
    if (document.getElementById('listeningSectionProgressStyles')) return;

    var style = document.createElement('style');
    style.id = 'listeningSectionProgressStyles';
    style.textContent = [
      '.header-menu-link{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:linear-gradient(135deg,#7f1d1d 0%,#b91c1c 48%,#ef4444 100%);box-shadow:0 14px 28px rgba(185,28,28,.22);color:#fff7f7;text-decoration:none;font-size:.92rem;font-weight:700;letter-spacing:.01em;white-space:nowrap;transition:transform 180ms ease,box-shadow 180ms ease,filter 180ms ease;}',
      '.header-menu-link:hover{transform:translateY(-1px);box-shadow:0 18px 34px rgba(185,28,28,.28);filter:saturate(1.08) brightness(1.03);}',
      '.back-menu-button{display:inline-flex;align-items:center;justify-content:center;min-width:150px;height:44px;margin-top:14px;padding:0 16px;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:linear-gradient(135deg,#7f1d1d 0%,#b91c1c 48%,#ef4444 100%);box-shadow:0 14px 28px rgba(185,28,28,.22);color:#fff7f7;text-decoration:none;font-size:.95rem;font-weight:800;letter-spacing:.01em;transition:transform 180ms ease,box-shadow 180ms ease,filter 180ms ease;}',
      '.back-menu-button:hover{transform:translateY(-1px);box-shadow:0 18px 34px rgba(185,28,28,.28);filter:saturate(1.08) brightness(1.03);}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureNavigationLinks() {
    ensureNavigationStyles();

    var headerRight = document.querySelector('.header-right');
    if (headerRight && !headerRight.querySelector('#submittedMenuLink')) {
      headerMenuLink = document.createElement('a');
      headerMenuLink.id = 'submittedMenuLink';
      headerMenuLink.className = 'header-menu-link';
      headerMenuLink.href = getMenuHref();
      headerMenuLink.textContent = 'Back to Menu';
      headerMenuLink.style.display = 'none';
      headerRight.insertBefore(headerMenuLink, headerRight.firstChild);
    } else if (headerRight) {
      headerMenuLink = headerRight.querySelector('#submittedMenuLink');
    }

    var resultsContent = document.querySelector('#resultsModal .results-content');
    if (resultsContent && !resultsContent.querySelector('.back-menu-button')) {
      var backButton = document.createElement('a');
      backButton.className = 'back-menu-button';
      backButton.href = getMenuHref();
      backButton.textContent = 'Back to Menu';
      var closeButton = resultsContent.querySelector('.close-button');
      if (closeButton) {
        resultsContent.insertBefore(backButton, closeButton);
      } else {
        resultsContent.appendChild(backButton);
      }
    }
  }

  function showHeaderMenuLink() {
    ensureNavigationLinks();
    if (!headerMenuLink) return;
    headerMenuLink.style.setProperty('display', 'inline-flex', 'important');
    headerMenuLink.style.visibility = 'visible';
    headerMenuLink.style.opacity = '1';
    syncAudioControllerLayout();
  }

  function getLegacySavedAnswersKey() {
    var email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function'
      ? window.IELTSProgress.getEmail()
      : '';
    return legacyAnswerStoragePrefix + (email || 'guest') + '_' + testStorageId;
  }

  function collectCurrentAnswers() {
    var saved = {};

    Array.prototype.forEach.call(document.querySelectorAll('input[name], select[name], textarea[name], input[id^="q"], select[id^="q"], textarea[id^="q"]'), function (field) {
      var name = field.name || field.id;
      if (!name || !/^q/i.test(name)) return;
      var type = (field.type || '').toLowerCase();

      if (type === 'radio') {
        if (saved.hasOwnProperty(name)) return;
        var checked = document.querySelector('input[name="' + name + '"]:checked');
        if (checked) saved[name] = checked.value;
        return;
      }

      if (type === 'checkbox') {
        if (saved.hasOwnProperty(name)) return;
        var values = Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function (input) {
          return input.value;
        });
        if (values.length) saved[name] = values.join(',');
        return;
      }

      if (field.value != null && String(field.value).trim() !== '') {
        saved[name] = String(field.value).trim();
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('.drop-zone[data-target]'), function (zone) {
      var target = zone.getAttribute('data-target');
      var value = zone.dataset.value || zone.dataset.option || '';
      if (target && value) saved[target] = value;
    });

    return saved;
  }

  function installSectionQuestionBars() {
    if (document.body) {
      document.body.classList.add('listening-section-question-bars');
    }

    if (!document.getElementById('listeningSectionQuestionBarsStyle')) {
      var style = document.createElement('style');
      style.id = 'listeningSectionQuestionBarsStyle';
      style.textContent = [
        'body.listening-section-question-bars .bottom-navigation{background:#fff!important;box-shadow:none!important;border-top:0!important;border-left:0!important;border-right:0!important;outline:0!important;}',
        'body.listening-section-question-bars .bottom-navigation .parts-navigation{background:#fff!important;box-shadow:none!important;border-top:0!important;outline:0!important;}',
        'body.listening-section-question-bars .bottom-navigation .part-nav-item{background:#fff!important;border-left:0!important;border-right:0!important;box-shadow:none!important;}',
        'body.listening-section-question-bars .bottom-navigation .question-numbers{gap:7px!important;align-items:center!important;flex-wrap:nowrap!important;}',
        'body.listening-section-question-bars .bottom-navigation .question-number{box-sizing:border-box!important;position:relative!important;overflow:visible!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:22px!important;min-width:22px!important;height:22px!important;padding:0 3px!important;border:1px solid transparent;border-radius:2px;background:transparent;color:#111827;font-size:1rem;line-height:1.1;}',
        'body.listening-section-question-bars .bottom-navigation .question-number::before{content:""!important;position:absolute!important;left:0!important;top:-8px!important;width:100%!important;height:3px!important;background:#d7d7d7!important;pointer-events:none!important;}',
        'body.listening-section-question-bars .bottom-navigation .question-number.is-answered::before{background:#2f8a24!important;}',
        'body.listening-section-question-bars .bottom-navigation .part-button{box-sizing:border-box!important;position:relative!important;overflow:visible!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;height:22px!important;line-height:1.1!important;}',
        'body.listening-section-question-bars .bottom-navigation .part-button.active::before{content:""!important;position:absolute!important;left:0!important;top:-8px!important;width:100%!important;height:3px!important;background:#d7d7d7!important;pointer-events:none!important;}',
        'body.listening-section-question-bars .bottom-navigation .part-button.active.part-complete::before{background:#2f8a24!important;}',
        'body.listening-section-question-bars .bottom-navigation .question-number.current{border-color:#2563eb!important;box-shadow:0 0 0 1px rgba(147,197,253,.45)!important;}',
        'body.listening-section-question-bars .bottom-navigation .question-number:hover{background:#f3f4f6!important;}'
      ].join('\n');
      document.head.appendChild(style);
    }

    function hasAnswerForQuestion(questionNumber, snapshot) {
      var key = 'q' + questionNumber;
      if (snapshot && snapshot[key]) return true;
      if (window.answers && window.answers[questionNumber]) return true;

      var directFields = document.querySelectorAll(
        'input[name="' + key + '"], select[name="' + key + '"], textarea[name="' + key + '"], ' +
        'input[id="' + key + '"], select[id="' + key + '"], textarea[id="' + key + '"]'
      );
      for (var i = 0; i < directFields.length; i += 1) {
        var field = directFields[i];
        var type = (field.type || '').toLowerCase();
        if ((type === 'radio' || type === 'checkbox') && field.checked) return true;
        if (type !== 'radio' && type !== 'checkbox' && String(field.value || '').trim()) return true;
      }

      var grouped = Array.prototype.slice.call(document.querySelectorAll('input[name^="q"][type="checkbox"]')).filter(function (input) {
        return String(input.name || '').split('_').indexOf(String(questionNumber)) !== -1;
      });
      return grouped.some(function (input) { return input.checked; });
    }

    function syncQuestionBars() {
      var snapshot = collectCurrentAnswers();
      Array.prototype.forEach.call(document.querySelectorAll('.bottom-navigation .question-number'), function (button) {
        var questionNumber = parseInt((button.textContent || '').replace(/\D+/g, ''), 10);
        if (!questionNumber) return;
        button.classList.toggle('is-answered', hasAnswerForQuestion(questionNumber, snapshot));
      });
      Array.prototype.forEach.call(document.querySelectorAll('.bottom-navigation .part-button'), function (button) {
        var navItem = button.closest ? button.closest('.part-nav-item') : null;
        var numbers = navItem ? Array.prototype.slice.call(navItem.querySelectorAll('.question-number')) : [];
        button.classList.toggle('part-complete', numbers.length > 0 && numbers.every(function (numberButton) {
          var questionNumber = parseInt((numberButton.textContent || '').replace(/\D+/g, ''), 10);
          return questionNumber && hasAnswerForQuestion(questionNumber, snapshot);
        }));
      });
    }

    function scheduleSyncQuestionBars() {
      window.setTimeout(syncQuestionBars, 0);
    }

    syncQuestionBars();
    window.setTimeout(syncQuestionBars, 150);
    window.setTimeout(syncQuestionBars, 600);

    if (!window.__listeningSectionQuestionBarsEvents) {
      window.__listeningSectionQuestionBarsEvents = true;
      ['input', 'change', 'click', 'drop'].forEach(function (eventName) {
        document.addEventListener(eventName, scheduleSyncQuestionBars, true);
      });
    }
  }

  function restoreDropZoneAnswer(target, answerValue) {
    var zone = document.querySelector('.drop-zone[data-target="' + target + '"]');
    if (!zone || !answerValue) return;

    var group = zone.getAttribute('data-group') || '';
    var item = Array.prototype.find.call(document.querySelectorAll('.drag-item'), function (node) {
      if (group && (node.getAttribute('data-group') || '') !== group) return false;
      var candidate = (node.dataset.answer || node.dataset.option || '').toUpperCase();
      return candidate === String(answerValue).toUpperCase();
    });
    if (!item) return;

    zone.dataset.option = item.dataset.option || answerValue;
    zone.dataset.value = item.dataset.answer || item.dataset.option || answerValue;
    zone.textContent = '';
    var dropSpan = document.createElement('span');
    dropSpan.className = 'drop-value';
    dropSpan.textContent = item.dataset.label || item.textContent.trim();
    zone.appendChild(dropSpan);
    zone.classList.add('filled');
    zone.draggable = true;

    if (item.dataset.reusable !== 'true') {
      item.dataset.used = 'true';
      item.classList.add('used');
      item.draggable = false;
    }

    var hidden = document.querySelector('input[name="' + target + '"]');
    if (hidden) {
      hidden.value = item.dataset.answer || item.dataset.option || answerValue;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    window.answers = window.answers || {};
    var numericId = Number(String(target).replace(/^q/, ''));
    if (!isNaN(numericId)) {
      window.answers[numericId] = item.dataset.answer || item.dataset.option || answerValue;
    } else {
      window.answers[target] = item.dataset.answer || item.dataset.option || answerValue;
    }
  }

  function loadStoredAnswers() {
    if (redoQuery) return {};

    var stored = {};
    if (window.IELTSProgress && typeof window.IELTSProgress.loadDraft === 'function') {
      if (attemptQueryId) {
        stored = window.IELTSProgress.loadDraft(attemptQueryId) || {};
      }
      if (!stored || !Object.keys(stored).length) {
        stored = window.IELTSProgress.loadDraft(testStorageId) || {};
      }
    }

    if (!stored || !Object.keys(stored).length) {
      try {
        stored = JSON.parse(localStorage.getItem(getLegacySavedAnswersKey()) || '{}') || {};
      } catch (e) {
        stored = {};
      }
    }

    return stored || {};
  }

  function restoreSavedAnswers() {
    var stored = loadStoredAnswers();
    if (!stored || !Object.keys(stored).length) return;

    window.answers = window.answers || {};

    Object.keys(stored).forEach(function (key) {
      var value = stored[key];
      if (value == null || value === '') return;

      if (document.querySelector('.drop-zone[data-target="' + key + '"]')) {
        restoreDropZoneAnswer(key, value);
        return;
      }

      var radios = document.querySelectorAll('input[name="' + key + '"][type="radio"]');
      if (radios.length) {
        var radioMatch = Array.prototype.find.call(radios, function (radio) {
          return String(radio.value) === String(value);
        });
        if (radioMatch) {
          radioMatch.checked = true;
          radioMatch.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      var checkboxes = document.querySelectorAll('input[name="' + key + '"][type="checkbox"]');
      if (checkboxes.length) {
        var selected = Array.isArray(value) ? value : String(value).split(',').map(function (item) {
          return item.trim();
        });
        Array.prototype.forEach.call(checkboxes, function (checkbox) {
          checkbox.checked = selected.indexOf(String(checkbox.value)) !== -1;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return;
      }

      var field = document.querySelector('[name="' + key + '"]') || document.getElementById(key);
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var fieldId = Number(String(key).replace(/^q/, ''));
      if (!isNaN(fieldId)) {
        window.answers[fieldId] = value;
      }
    });
  }

  function shouldPersistDraft() {
    return !attemptQueryId || redoQuery;
  }

  function saveDraftNow() {
    if (!shouldPersistDraft()) return;

    var snapshot = collectCurrentAnswers();
    if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
      window.IELTSProgress.saveDraft(testStorageId, snapshot);
      return;
    }

    try {
      localStorage.setItem(getLegacySavedAnswersKey(), JSON.stringify(snapshot));
    } catch (e) {}
  }

  function scheduleDraftSave() {
    if (!shouldPersistDraft()) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraftNow, 120);
  }

  function bindAutosave() {
    if (!shouldPersistDraft()) return;

    document.addEventListener('input', scheduleDraftSave, true);
    document.addEventListener('change', scheduleDraftSave, true);
    document.addEventListener('drop', function () {
      window.setTimeout(scheduleDraftSave, 30);
    }, true);
    document.addEventListener('click', function () {
      window.setTimeout(scheduleDraftSave, 30);
    }, true);
  }

  function trackSubmission() {
    if (submissionTracked) return;
    if (!window.IELTSProgress || typeof window.IELTSProgress.trackTestResult !== 'function') return;

    var detailedResults = window.testResults || [];
    var score = detailedResults.filter(function (entry) {
      return entry && entry.isCorrect;
    }).length;
    var total = Number(window.totalQuestions) || detailedResults.length || 0;
    if (!total) return;

    window.IELTSProgress.trackTestResult('listening', {
      label: getLabel(),
      score: score,
      total: total,
      test_id: testStorageId,
      href: window.location.pathname + window.location.search + window.location.hash,
      answers: collectCurrentAnswers()
    });

    submissionTracked = true;
  }

  function watchResultsModal() {
    if (modalObserverAttached || typeof MutationObserver !== 'function') return;

    var resultsModal = getResultsModal();
    if (!resultsModal) return;

    var observer = new MutationObserver(function () {
      enforceAudioVisibilityState();
    });

    observer.observe(resultsModal, { attributes: true, attributeFilter: ['class'] });
    modalObserverAttached = true;
  }

  function wrapStartTest() {
    if (startWrapped || typeof window.startTest !== 'function') return;

    var originalStartTest = window.startTest;

    function finishStart(result) {
      window.setTimeout(function () {
        syncPrimarySectionScreens();
        restoreSavedAnswers();
        scheduleDraftSave();
        installSectionQuestionBars();
        enforceAudioVisibilityState();
      }, 0);
      return result;
    }

    window.startTest = function () {
      if (window.__listeningSectionStartInProgress) return false;
      window.__listeningSectionStartInProgress = true;
      var context = this;
      var args = arguments;

      if (isSafariLikeBrowser()) {
        try {
          window.__listeningTestStarted = true;
          return finishStart(originalStartTest.apply(context, args));
        } finally {
          window.__listeningSectionStartInProgress = false;
        }
      }

      return prepareSectionAudioForLocalPlayback().then(function () {
        window.__listeningTestStarted = true;
        var result = originalStartTest.apply(context, args);
        return finishStart(result);
      }).finally(function () {
        window.__listeningSectionStartInProgress = false;
      });
    };

    window.startTest.__sectionProgressFixed = true;
    startWrapped = true;
  }

  function wrapSubmitTest() {
    if (submitWrapped || typeof window.submitTest !== 'function') return;

    var originalSubmitTest = window.submitTest;
    window.submitTest = function () {
      var result = originalSubmitTest.apply(this, arguments);
      if (window.testSubmitted || isResultsModalVisible()) {
        syncPrimarySectionScreens();
        trackSubmission();
        revealReviewAudioController();
      }
      return result;
    };

    window.submitTest.__sectionProgressFixed = true;
    submitWrapped = true;
  }

  function wrapShowResults() {
    if (showResultsWrapped || typeof window.showResults !== 'function') return;

    var originalShowResults = window.showResults;
    window.showResults = function () {
      var result = originalShowResults.apply(this, arguments);
      window.setTimeout(function () {
        syncPrimarySectionScreens();
        revealReviewAudioController();
      }, 0);
      return result;
    };

    window.showResults.__sectionProgressFixed = true;
    showResultsWrapped = true;
  }

  function wrapCloseResults() {
    if (closeResultsWrapped || typeof window.closeResults !== 'function') return;

    var originalCloseResults = window.closeResults;
    window.closeResults = function () {
      var result = originalCloseResults.apply(this, arguments);
      syncPrimarySectionScreens();
      if (isReviewModeActive()) {
        revealReviewAudioController();
      }
      return result;
    };

    window.closeResults.__sectionProgressFixed = true;
    closeResultsWrapped = true;
  }

  function init() {
    if (document.body) {
      document.body.setAttribute('data-track-section', 'listening');
    }

    if (hasActiveTestInterface()) {
      window.__listeningTestStarted = true;
    }

    attachAudioLayoutGuard();
    ensureNavigationLinks();
    bindAutosave();
    installSectionQuestionBars();
    watchResultsModal();
    wrapStartTest();
    wrapSubmitTest();
    wrapShowResults();
    wrapCloseResults();
    enforceAudioVisibilityState();
  }

  window.__listeningSectionRevealReviewUI = revealReviewAudioController;
  window.__listeningSectionHideAudioUI = hideAudioControllerUntilReview;
  window.__listeningSectionSyncAudioLayout = syncAudioControllerLayout;
  window.__listeningSectionSyncScreens = syncPrimarySectionScreens;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
