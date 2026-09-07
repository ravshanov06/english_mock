(function () {
  var path = String(window.location.pathname || '').toLowerCase();
  var isFullListeningPage = path.indexOf('/listening/') !== -1 && path.indexOf('/listening/section') === -1;
  if (!isFullListeningPage) return;

  function disableAnswerSpellcheck(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var fields = scope.querySelectorAll([
      'input:not([type])',
      'input[type="text"]',
      'input[type="search"]',
      'textarea',
      '[contenteditable="true"]'
    ].join(','));

    fields.forEach(function (field) {
      field.spellcheck = false;
      field.setAttribute('spellcheck', 'false');
      field.setAttribute('autocomplete', 'off');
      field.setAttribute('autocorrect', 'off');
      field.setAttribute('autocapitalize', 'off');
      field.setAttribute('data-gramm', 'false');
      field.setAttribute('data-gramm_editor', 'false');
      field.setAttribute('data-enable-grammarly', 'false');
      field.setAttribute('data-lt-blocked', 'true');
      field.setAttribute('data-ms-editor', 'false');
    });
  }

  function bindSpellcheckGuard() {
    disableAnswerSpellcheck();

    if (document.documentElement) {
      document.documentElement.setAttribute('spellcheck', 'false');
    }
    if (document.body) {
      document.body.setAttribute('spellcheck', 'false');
    }

    if (typeof MutationObserver !== 'function' || !document.body) return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('input, textarea, [contenteditable="true"]')) {
            disableAnswerSpellcheck({ querySelectorAll: function () { return [node]; } });
          }
          disableAnswerSpellcheck(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  var audioSequenceCache = null;
  var liveAudioAdvanceTimer = null;
  var liveAudioSwitchGuard = false;
  var liveAudioSourceSwitching = false;
  var liveAudioRetryCounts = {};
  var audioFallbackMap = {};
  var preparedAudioUrlMap = {};
  var audioPreparationPromise = null;
  var audioElementSourcePatchApplied = false;

  function isSafariLikeBrowser() {
    var ua = String((navigator && navigator.userAgent) || '');
    return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Android|Edg|OPR|SamsungBrowser/i.test(ua);
  }

  function getAudioElement() {
    return document.getElementById('testAudio');
  }

  function getAudioControllerBar() {
    return document.querySelector('.audio-controller-bar');
  }

  function getHeader() {
    return document.querySelector('.header');
  }

  function getTestInterface() {
    return document.getElementById('testInterface') || document.querySelector('.test-interface');
  }

  function getAudioControllerNote() {
    return document.querySelector('.audio-controller-note');
  }

  function getStartButton() {
    return document.querySelector('.start-button');
  }

  function isMockListeningLaunch() {
    var params = null;
    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (error) {}

    if (params && params.get('mockPart') === 'listening') return true;

    try {
      return sessionStorage.getItem('ielts_mock_active_part') === 'listening' &&
        sessionStorage.getItem('ielts_mock_fullscreen_lock') === '1';
    } catch (error) {
      return false;
    }
  }

  function getResultsModal() {
    return document.getElementById('resultsModal');
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
    if (window.__listeningFullAudioLayoutGuardAttached) return;
    window.__listeningFullAudioLayoutGuardAttached = true;

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

  function hasPlayableSource(audio) {
    if (!audio) return false;
    return !!(audio.getAttribute('src') || audio.currentSrc || audio.querySelector('source[src]'));
  }

  function isAbsoluteUrl(src) {
    return /^https?:\/\//i.test(String(src || ''));
  }

  function getSourceFilename(src) {
    var raw = String(src || '').trim();
    if (!raw) return '';
    if (!isAbsoluteUrl(raw)) {
      return raw.split('?')[0].split('#')[0].split('/').pop();
    }
    try {
      return new URL(raw).pathname.split('/').pop();
    } catch (error) {
      return raw.split('?')[0].split('#')[0].split('/').pop();
    }
  }

  function getFallbackSource(src) {
    var filename = getSourceFilename(src);
    return audioFallbackMap[filename] || '';
  }

  function normalizeAudioSourceName(src) {
    var filename = getSourceFilename(src);
    try {
      filename = decodeURIComponent(filename);
    } catch (error) {}
    return String(filename || '').trim().toLowerCase();
  }

  function getAudioSequenceIndexForSource(src, sequence) {
    var target = normalizeAudioSourceName(src);
    if (!target) return -1;

    for (var i = 0; i < sequence.length; i++) {
      if (normalizeAudioSourceName(sequence[i]) === target) {
        return i;
      }
    }

    return -1;
  }

  function normalizePreparedSourceKey(src) {
    var raw = String(src || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw, window.location.href).href;
    } catch (error) {
      return raw;
    }
  }

  function rememberPreparedAudioSource(originalSrc, objectUrl) {
    if (!originalSrc || !objectUrl) return;
    preparedAudioUrlMap[normalizePreparedSourceKey(originalSrc)] = objectUrl;
    preparedAudioUrlMap[getSourceFilename(originalSrc)] = objectUrl;
    try {
      preparedAudioUrlMap[decodeURIComponent(getSourceFilename(originalSrc))] = objectUrl;
    } catch (error) {}
  }

  function resolvePreparedAudioSource(src) {
    if (!src) return src;
    return preparedAudioUrlMap[normalizePreparedSourceKey(src)] ||
      preparedAudioUrlMap[getSourceFilename(src)] ||
      src;
  }

  function getPreparedAudioSource(src) {
    if (!src) return '';
    return preparedAudioUrlMap[normalizePreparedSourceKey(src)] ||
      preparedAudioUrlMap[getSourceFilename(src)] ||
      '';
  }

  function isPreparedAudioUrl(src) {
    return String(src || '').indexOf('blob:') === 0;
  }

  function isAudioUsingPreparedSource(audio) {
    if (!audio) return false;
    var requestedSource = audio.dataset.requestedSrc || '';
    var preparedSource = getPreparedAudioSource(requestedSource);
    return !!preparedSource && (
      audio.getAttribute('src') === preparedSource ||
      audio.currentSrc === preparedSource ||
      isPreparedAudioUrl(audio.getAttribute('src')) ||
      isPreparedAudioUrl(audio.currentSrc)
    );
  }

  function patchAudioElementSourceSetter() {
    var audio = getAudioElement();
    if (!audio || audioElementSourcePatchApplied) return;

    var descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') ||
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
    var nativeSetAttribute = audio.setAttribute;

    if (descriptor && descriptor.set && descriptor.get) {
      Object.defineProperty(audio, 'src', {
        configurable: true,
        enumerable: true,
        get: function () {
          return descriptor.get.call(audio);
        },
        set: function (value) {
          audio.dataset.requestedSrc = value;
          audio.dataset.reviewActiveSrc = value;
          descriptor.set.call(audio, resolvePreparedAudioSource(value));
        }
      });
    }

    audio.setAttribute = function (name, value) {
      if (String(name || '').toLowerCase() === 'src') {
        audio.dataset.requestedSrc = value;
        audio.dataset.reviewActiveSrc = value;
        return nativeSetAttribute.call(audio, name, resolvePreparedAudioSource(value));
      }
      return nativeSetAttribute.call(audio, name, value);
    };

    audioElementSourcePatchApplied = true;
  }

  function uniqueAudioSources(sources) {
    var seen = {};
    var output = [];
    (sources || []).forEach(function (source) {
      var clean = String(source || '').trim();
      var key = normalizePreparedSourceKey(clean);
      if (!clean || seen[key]) return;
      seen[key] = true;
      output.push(clean);
    });
    return output;
  }

  function getAudioSourcesForPreparation() {
    var sequence = getInlineAudioSequence();
    if (sequence && sequence.length) return uniqueAudioSources(sequence);

    var audio = getAudioElement();
    if (!audio) return [];
    var sources = [];
    if (audio.getAttribute('src')) sources.push(audio.getAttribute('src'));
    Array.prototype.forEach.call(audio.querySelectorAll('source[src]'), function (source) {
      sources.push(source.getAttribute('src'));
    });
    if (audio.currentSrc) sources.push(audio.currentSrc);
    return uniqueAudioSources(sources);
  }

  function setAudioPreparationUi(isPreparing, loaded, total, percent) {
    var button = getStartButton();
    var subtitle = document.querySelector('.start-subtitle');
    var cleanPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (button) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || 'Start Test';
      }
      button.disabled = !!isPreparing;
      button.textContent = isPreparing
        ? 'Preparing audio ' + cleanPercent + '%'
        : button.dataset.originalText;
    }
    if (subtitle) {
      if (!subtitle.dataset.originalText) {
        subtitle.dataset.originalText = subtitle.textContent || '';
      }
      subtitle.textContent = isPreparing
        ? 'Preparing audio for smooth offline playback in this browser. ' + loaded + ' / ' + total + ' files ready.'
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

  function prepareListeningAudioForLocalPlayback() {
    if (audioPreparationPromise) return audioPreparationPromise;
    if (isSafariLikeBrowser()) {
      return Promise.resolve(false);
    }
    if (!window.fetch || !window.URL || typeof window.URL.createObjectURL !== 'function') {
      return Promise.resolve(false);
    }

    patchAudioElementSourceSetter();
    var sources = getAudioSourcesForPreparation();
    if (!sources.length) return Promise.resolve(false);

    var loaded = 0;
    setAudioPreparationUi(true, loaded, sources.length, 0);

    function updateOverallProgress(currentFraction) {
      var overall = ((loaded + Math.max(0, Math.min(1, Number(currentFraction) || 0))) / sources.length) * 100;
      setAudioPreparationUi(true, loaded, sources.length, overall);
    }

    function prepareSource(source) {
      var key = normalizePreparedSourceKey(source);
      if (preparedAudioUrlMap[key]) {
        loaded += 1;
        setAudioPreparationUi(true, loaded, sources.length, (loaded / sources.length) * 100);
        return Promise.resolve(preparedAudioUrlMap[key]);
      }
      return fetchAudioBlobWithProgress(source, updateOverallProgress)
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          rememberPreparedAudioSource(source, objectUrl);
          loaded += 1;
          setAudioPreparationUi(true, loaded, sources.length, (loaded / sources.length) * 100);
          return objectUrl;
        });
    }

    audioPreparationPromise = sources.reduce(function (chain, source) {
      return chain.then(function () {
        return prepareSource(source);
      });
    }, Promise.resolve()).then(function () {
      setAudioPreparationUi(false, sources.length, sources.length);
      return true;
    }).catch(function () {
      audioPreparationPromise = null;
      setAudioPreparationUi(false, loaded, sources.length);
      return false;
    });

    return audioPreparationPromise;
  }

  window.addEventListener('beforeunload', function () {
    Object.keys(preparedAudioUrlMap).forEach(function (key) {
      var value = preparedAudioUrlMap[key];
      if (typeof value === 'string' && value.indexOf('blob:') === 0) {
        try { URL.revokeObjectURL(value); } catch (error) {}
      }
    });
  });

  function getCurrentAudioSequenceIndex(audio, sequence) {
    if (!audio || !sequence || !sequence.length) return -1;

    var candidates = [
      audio.getAttribute('src') || '',
      audio.dataset.requestedSrc || '',
      audio.currentSrc || ''
    ];

    for (var i = 0; i < candidates.length; i++) {
      var index = getAudioSequenceIndexForSource(candidates[i], sequence);
      if (index !== -1) return index;
    }

    return -1;
  }

  function requestAudioSource(audio, src) {
    if (!audio || !src) return;
    audio.dataset.requestedSrc = src;
    audio.dataset.reviewActiveSrc = src;
    audio.setAttribute('src', src);
    audio.load();
  }

  function bindAudioFallback() {
    var audio = getAudioElement();
    if (!audio || audio.dataset.fullTestAudioFallbackBound === 'true') return;

    audio.dataset.fullTestAudioFallbackBound = 'true';

    audio.addEventListener('loadeddata', function () {
      delete audio.dataset.fallbackAttemptedFor;
    });

    audio.addEventListener('error', function () {
      var failedSource = audio.dataset.requestedSrc || audio.currentSrc || audio.getAttribute('src') || '';
      var fallbackSource = getFallbackSource(failedSource);
      if (!failedSource || !fallbackSource || fallbackSource === failedSource) return;
      if (audio.dataset.fallbackAttemptedFor === failedSource) return;

      audio.dataset.fallbackAttemptedFor = failedSource;
      requestAudioSource(audio, fallbackSource);

      if (!window.testSubmitted && typeof window.triggerAudioPlayback === 'function') {
        window.triggerAudioPlayback();
      }
    });
  }

  function scheduleAudioRetry() {
    if (window.__listeningAudioRetryPending) return;
    window.__listeningAudioRetryPending = true;

    function retryPlayback() {
      if (!window.__listeningAudioRetryPending) return;
      window.__listeningAudioRetryPending = false;
      document.removeEventListener('pointerdown', retryPlayback, true);
      document.removeEventListener('keydown', retryPlayback, true);

      var audio = getAudioElement();
      if (!audio || window.testSubmitted || !hasPlayableSource(audio)) return;

      try {
        audio.muted = false;
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
      } catch (error) {}
    }

    document.addEventListener('pointerdown', retryPlayback, true);
    document.addEventListener('keydown', retryPlayback, true);
  }

  function doAttemptPlay(audio) {
    if (!audio || window.testSubmitted || !hasPlayableSource(audio)) return;

    try {
      audio.muted = false;
    } catch (error) {}

    try {
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          try {
            audio.muted = true;
            var fallbackPromise = audio.play();
            if (fallbackPromise && typeof fallbackPromise.then === 'function') {
              fallbackPromise.then(function () {
                try {
                  audio.muted = false;
                } catch (error) {}
              }).catch(function () {
                scheduleAudioRetry();
              });
            } else {
              scheduleAudioRetry();
            }
          } catch (error) {
            scheduleAudioRetry();
          }
        });
      }
    } catch (error) {
      scheduleAudioRetry();
    }
  }

  function wrapTriggerAudioPlayback() {
    if (typeof window.triggerAudioPlayback !== 'function' || window.triggerAudioPlayback.__fullTestFixed) return;

    window.triggerAudioPlayback = function () {
      var audio = getAudioElement();
      if (!audio || window.testSubmitted || !hasPlayableSource(audio)) return;

      if (audio.readyState >= 2) {
        doAttemptPlay(audio);
        return;
      }

      var pending = false;
      var onReady = function () {
        if (pending) return;
        pending = true;
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
        doAttemptPlay(audio);
      };
      var onError = function () {
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
        pending = true;
      };
      audio.addEventListener('canplay', onReady);
      audio.addEventListener('error', onError);
      setTimeout(onReady, 3000);
    };

    window.triggerAudioPlayback.__fullTestFixed = true;
  }

  function wrapStartTest() {
    if (typeof window.startTest !== 'function' || window.startTest.__fullTestFixed) return;

    var originalStartTest = window.startTest;

    function isHistoricalAttemptReview() {
      try {
        var params = new URLSearchParams(window.location.search || '');
        return !!params.get('attempt') && params.get('redo') !== '1';
      } catch (error) {
        return false;
      }
    }

    function getCurrentTestStorageId() {
      try {
        if (typeof TEST_STORAGE_ID !== 'undefined' && TEST_STORAGE_ID) {
          return String(TEST_STORAGE_ID);
        }
      } catch (error) {}

      var mock = null;
      try {
        mock = JSON.parse(sessionStorage.getItem('ielts_mock_active') || 'null');
      } catch (error) {}
      if (!mock || !mock.tests) {
        try {
          mock = JSON.parse(localStorage.getItem('ielts_mock_active') || 'null');
        } catch (error) {}
      }
      return String(mock && mock.tests && mock.tests.listening && mock.tests.listening.testId || '');
    }

    function clearAnswersForFreshStart() {
      if (isHistoricalAttemptReview()) return;
      window.__listeningFreshStartRequested = true;

      var testStorageId = getCurrentTestStorageId();
      if (testStorageId && window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
        window.IELTSProgress.saveDraft(testStorageId, {});
      }

      if (testStorageId) {
        try {
          var email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function'
            ? window.IELTSProgress.getEmail()
            : '';
          localStorage.removeItem('ielts_saved_answers_' + (email || 'guest') + '_' + testStorageId);
        } catch (error) {}
      }

      document.querySelectorAll('input, textarea, select').forEach(function (field) {
        if (field.type === 'radio' || field.type === 'checkbox') field.checked = false;
        else if (field.tagName === 'SELECT') field.selectedIndex = 0;
        else if (
          field.type !== 'button' &&
          field.type !== 'submit' &&
          (field.type !== 'hidden' || /^q\d+/i.test(field.id || field.name || ''))
        ) field.value = '';
        field.disabled = false;
      });
      document.querySelectorAll('.drop-zone').forEach(function (zone) {
        zone.dataset.option = '';
        zone.dataset.value = '';
        zone.dataset.optionKey = '';
        zone.classList.remove('filled');
        zone.draggable = false;
        var placeholder = zone.dataset.placeholder || '';
        var value = zone.querySelector('.drop-value');
        if (value) value.textContent = placeholder;
        else zone.textContent = placeholder;
      });
      document.querySelectorAll('.drag-item').forEach(function (item) {
        item.dataset.used = 'false';
        item.classList.remove('used', 'selected');
        item.draggable = true;
      });
      document.querySelectorAll('.answer-feedback, .answer-indicator').forEach(function (node) {
        node.remove();
      });
      if (window.IELTSHighlightPersistence && typeof window.IELTSHighlightPersistence.clearCurrent === 'function') {
        window.IELTSHighlightPersistence.clearCurrent();
      }
    }

    function finishStart(result) {
      var audio = getAudioElement();
      syncSubmitButtonVisibility();
      bindAudioFallback();
      bindAudioNetworkRecoveryGuard();
      bindLiveAudioSequenceController();
      syncLiveAudioFromSource({ syncPart: false });
      ensureLiveAudioReadyAfterStart();
      if (audio && !window.testSubmitted && audio.paused && hasPlayableSource(audio) && typeof window.triggerAudioPlayback === 'function') {
        window.triggerAudioPlayback();
      }
      return result;
    }

    window.startTest = function () {
      if (window.__listeningFullStartInProgress) return false;
      window.__listeningFullStartInProgress = true;
      clearAnswersForFreshStart();
      var context = this;
      var args = arguments;

      if (isSafariLikeBrowser()) {
        try {
          return finishStart(originalStartTest.apply(context, args));
        } finally {
          window.__listeningFullStartInProgress = false;
        }
      }

      if (isMockListeningLaunch()) {
        try {
          return finishStart(originalStartTest.apply(context, args));
        } finally {
          window.__listeningFullStartInProgress = false;
        }
      }

      return prepareListeningAudioForLocalPlayback().then(function () {
        var result = originalStartTest.apply(context, args);
        return finishStart(result);
      }).finally(function () {
        window.__listeningFullStartInProgress = false;
      });
    };

    window.startTest.__fullTestFixed = true;
  }

  function getInlineAudioSequence() {
    if (audioSequenceCache && audioSequenceCache.length) return audioSequenceCache.slice();

    if (Array.isArray(window.__listeningFullAudioSequence) && window.__listeningFullAudioSequence.length) {
      audioSequenceCache = window.__listeningFullAudioSequence.slice();
      return audioSequenceCache.slice();
    }

    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src) continue;

      var content = scripts[i].textContent || '';
      var match = content.match(/(?:const|var|let)\s+audioSequence\s*=\s*\[([\s\S]*?)\]/);
      if (!match) continue;

      var parsed = [];
      match[1].replace(/(['"])(.*?)\1/g, function (_fullMatch, _quote, value) {
        parsed.push(value);
        return _fullMatch;
      });

      if (parsed.length) {
        audioSequenceCache = parsed.slice();
        return parsed;
      }
    }

    audioSequenceCache = [];
    return [];
  }

  function getCurrentPartIndex() {
    for (var i = 1; i <= 4; i++) {
      var partContent = document.getElementById('part' + i + 'Content');
      if (partContent && !partContent.classList.contains('hidden')) {
        return i - 1;
      }
    }

    var activeButton = document.querySelector('[id^="part"][id$="Btn"].active');
    if (activeButton && activeButton.id) {
      var buttonMatch = activeButton.id.match(/^part(\d+)Btn$/i);
      if (buttonMatch) {
        return Math.max(0, parseInt(buttonMatch[1], 10) - 1);
      }
    }

    return 0;
  }

  function getSubmitSections() {
    var submitButton = document.getElementById('submitBtn');
    if (!submitButton) return [];

    var sections = [];
    var node = submitButton.parentElement;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('submit-section')) {
        sections.push(node);
      }
      node = node.parentElement;
    }

    if (!sections.length) {
      sections.push(submitButton);
    }

    return sections;
  }

  function syncSubmitButtonVisibility() {
    var shouldShow = getCurrentPartIndex() === 3;
    getSubmitSections().forEach(function (section) {
      section.hidden = !shouldShow;
      section.classList.toggle('hidden', !shouldShow);
      if (shouldShow) {
        section.style.removeProperty('display');
      } else {
        section.style.display = 'none';
      }
    });
  }

  function bindSubmitButtonVisibilityGuard() {
    if (window.__listeningFullSubmitButtonVisibilityGuardAttached) return;
    window.__listeningFullSubmitButtonVisibilityGuardAttached = true;

    syncSubmitButtonVisibility();
    window.setTimeout(syncSubmitButtonVisibility, 0);
    window.setTimeout(syncSubmitButtonVisibility, 120);
    window.setTimeout(syncSubmitButtonVisibility, 500);

    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('[id^="part"][id$="Btn"], .question-number, .nav-arrow')) {
        window.setTimeout(syncSubmitButtonVisibility, 0);
      }
    }, true);

    if (typeof MutationObserver !== 'function' || !document.body) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'attributes' || mutations[i].addedNodes.length) {
          syncSubmitButtonVisibility();
          return;
        }
      }
    });

    for (var part = 1; part <= 4; part++) {
      var partContent = document.getElementById('part' + part + 'Content');
      if (partContent) {
        observer.observe(partContent, {
          attributes: true,
          attributeFilter: ['class', 'style', 'hidden']
        });
      }
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function isLiveAudioSequenceAvailable() {
    return !isReviewModeActive() && getInlineAudioSequence().length > 1;
  }

  function isLiveListeningModeActive() {
    return !window.testSubmitted &&
      !window.__listeningSubmissionObserved &&
      !isReviewModeActive();
  }

  function getStoredLiveAudioIndex(audio, sequence) {
    if (!audio || !sequence || !sequence.length) return 0;

    var sourceIndex = getCurrentAudioSequenceIndex(audio, sequence);
    if (sourceIndex !== -1) return sourceIndex;

    var storedIndex = parseInt(audio.dataset.liveActiveSectionIndex || '', 10);
    if (Number.isFinite(storedIndex)) {
      return Math.max(0, Math.min(sequence.length - 1, storedIndex));
    }

    return Math.max(0, Math.min(sequence.length - 1, getCurrentPartIndex()));
  }

  function clearLiveAudioAdvanceTimer() {
    if (liveAudioAdvanceTimer) {
      clearTimeout(liveAudioAdvanceTimer);
      liveAudioAdvanceTimer = null;
    }
  }

  function resetLiveAudioRetryCount(index) {
    delete liveAudioRetryCounts[String(index)];
  }

  function isNearNaturalAudioEnd(audio) {
    if (!audio) return false;
    if (audio.ended) return true;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return false;
    return audio.duration - audio.currentTime <= 0.75;
  }

  function syncVisiblePartToAudioIndex(partIndex) {
    if (partIndex < 0 || getCurrentPartIndex() === partIndex) return;
    if (typeof window.switchPart !== 'function') return;

    liveAudioSwitchGuard = true;
    try {
      window.switchPart(partIndex);
    } finally {
      liveAudioSwitchGuard = false;
    }
  }

  function syncLiveAudioFromSource(options) {
    if (!isLiveAudioSequenceAvailable()) return;

    var settings = options || {};
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    var audioIndex = getCurrentAudioSequenceIndex(audio, sequence);
    if (audioIndex < 0) return;

    clearLiveAudioAdvanceTimer();

    audio.dataset.liveActiveSectionIndex = String(audioIndex);

    if (settings.syncPart !== false) {
      syncVisiblePartToAudioIndex(audioIndex);
    }
  }

  function setLiveAudioSection(partIndex, options) {
    if (!isLiveAudioSequenceAvailable()) return false;

    var settings = options || {};
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    if (!audio || !sequence.length) return false;

    var nextIndex = Math.max(0, Math.min(sequence.length - 1, partIndex));
    var targetSource = sequence[nextIndex];
    if (!targetSource) return false;

    clearLiveAudioAdvanceTimer();

    audio.dataset.liveActiveSectionIndex = String(nextIndex);
    delete audio.dataset.liveQueuedSectionIndex;
    resetLiveAudioRetryCount(nextIndex);

    if (settings.syncPart !== false) {
      syncVisiblePartToAudioIndex(nextIndex);
    }

    if (getCurrentAudioSequenceIndex(audio, sequence) !== nextIndex || !hasPlayableSource(audio)) {
      liveAudioSourceSwitching = true;
      requestAudioSource(audio, targetSource);
      if (settings.resetTime !== false) {
        try {
          audio.currentTime = 0;
        } catch (error) {}
      }
      setTimeout(function () {
        liveAudioSourceSwitching = false;
      }, 1200);
    }

    if (settings.play !== false && typeof window.triggerAudioPlayback === 'function') {
      window.triggerAudioPlayback();
    }

    return true;
  }

  function queueLiveAudioAdvance(delayMs) {
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    if (!audio || sequence.length < 2 || !isLiveListeningModeActive()) return;

    var currentIndex = getStoredLiveAudioIndex(audio, sequence);
    var nextIndex = currentIndex + 1;
    if (nextIndex >= sequence.length) return;

    if (audio.dataset.liveQueuedSectionIndex === String(nextIndex) && liveAudioAdvanceTimer) return;

    clearLiveAudioAdvanceTimer();
    audio.dataset.liveQueuedSectionIndex = String(nextIndex);
    liveAudioAdvanceTimer = setTimeout(function () {
      liveAudioAdvanceTimer = null;
      if (!isLiveListeningModeActive()) return;
      setLiveAudioSection(nextIndex, {
        syncPart: true,
        resetTime: true,
        play: true
      });
    }, Math.max(0, Number(delayMs) || 0));
  }

  function recoverLiveAudioSource(audio, sequence) {
    if (!audio || !sequence.length || !isLiveListeningModeActive()) return;

    var currentIndex = getStoredLiveAudioIndex(audio, sequence);
    var failedSource = audio.dataset.requestedSrc || audio.currentSrc || audio.getAttribute('src') || sequence[currentIndex] || '';
    var fallbackSource = getFallbackSource(failedSource);
    clearLiveAudioAdvanceTimer();

    if (fallbackSource && fallbackSource !== failedSource && audio.dataset.fallbackAttemptedFor !== failedSource) {
      audio.dataset.fallbackAttemptedFor = failedSource;
      requestAudioSource(audio, fallbackSource);
      if (typeof window.triggerAudioPlayback === 'function') {
        window.triggerAudioPlayback();
      }
      return;
    }

    var retryKey = String(currentIndex);
    var retryCount = (liveAudioRetryCounts[retryKey] || 0) + 1;
    liveAudioRetryCounts[retryKey] = retryCount;

    updateAudioRecoveryNote(retryCount > 3
      ? 'Audio is still loading. Reconnecting to this section...'
      : 'Audio did not load. Reconnecting to this section...');

    setTimeout(function () {
      if (!isLiveListeningModeActive()) return;
      var retrySource = sequence[currentIndex] || failedSource;
      if (!retrySource) return;
      requestAudioSource(audio, retrySource);
      if (typeof window.triggerAudioPlayback === 'function') {
        window.triggerAudioPlayback();
      }
    }, Math.min(8000, 900 + retryCount * 900));
  }

  function ensureLiveAudioReadyAfterStart() {
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    if (!audio || !sequence.length || !isLiveListeningModeActive()) return;

    if (!hasPlayableSource(audio)) {
      audio.dataset.liveActiveSectionIndex = '0';
      requestAudioSource(audio, sequence[0]);
    } else if (sequence.length > 1) {
      var activeIndex = getStoredLiveAudioIndex(audio, sequence);
      audio.dataset.liveActiveSectionIndex = String(activeIndex);
    }

    if (audio.paused && typeof window.triggerAudioPlayback === 'function') {
      window.triggerAudioPlayback();
    }
  }

  function bindLiveAudioSequenceController() {
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    if (!audio || !sequence.length || audio.dataset.liveAudioSequenceControllerBound === 'true') return;

    audio.dataset.liveAudioSequenceControllerBound = 'true';

    audio.addEventListener('loadeddata', function () {
      if (!isLiveListeningModeActive()) return;
      var currentSequence = getInlineAudioSequence();
      var index = getStoredLiveAudioIndex(audio, currentSequence);
      audio.dataset.liveActiveSectionIndex = String(index);
      resetLiveAudioRetryCount(index);
      delete audio.dataset.fallbackAttemptedFor;
      liveAudioSourceSwitching = false;
    });

    audio.addEventListener('playing', function () {
      if (!isLiveListeningModeActive()) return;
      var currentSequence = getInlineAudioSequence();
      var index = getStoredLiveAudioIndex(audio, currentSequence);
      audio.dataset.liveActiveSectionIndex = String(index);
      if (currentSequence.length > 1) {
        syncVisiblePartToAudioIndex(index);
      }
    });

    audio.addEventListener('ended', function (event) {
      var currentSequence = getInlineAudioSequence();
      if (currentSequence.length < 2 || !isLiveListeningModeActive()) return;
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      queueLiveAudioAdvance(10000);
    }, true);

    audio.addEventListener('timeupdate', function (event) {
      var currentSequence = getInlineAudioSequence();
      if (currentSequence.length < 2 || liveAudioSourceSwitching || !isLiveListeningModeActive() || !isNearNaturalAudioEnd(audio)) return;
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      queueLiveAudioAdvance(10000);
    }, true);

    audio.addEventListener('pause', function (event) {
      var currentSequence = getInlineAudioSequence();
      if (currentSequence.length < 2 || liveAudioSourceSwitching || !isLiveListeningModeActive() || !isNearNaturalAudioEnd(audio)) return;
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      queueLiveAudioAdvance(10000);
    }, true);

    audio.addEventListener('error', function (event) {
      if (!isLiveListeningModeActive()) return;
      var currentSequence = getInlineAudioSequence();
      if (!currentSequence.length) return;
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      recoverLiveAudioSource(audio, currentSequence);
    }, true);
  }

  function markReviewModeActive() {
    window.__listeningFullReviewActive = true;
    document.body.classList.add('listening-review-active');
  }

  function isReviewModeActive() {
    var resultsModal = getResultsModal();
    var submitButton = document.getElementById('submitBtn');
    var submittedMenuLink = document.getElementById('submittedMenuLink');
    var submittedMenuVisible = submittedMenuLink && submittedMenuLink.style.display && submittedMenuLink.style.display !== 'none';
    return !!window.testSubmitted ||
      !!window.__listeningFullReviewActive ||
      !!window.__listeningSubmissionObserved ||
      document.body.classList.contains('listening-review-active') ||
      !!(submitButton && submitButton.disabled && document.querySelector('.answer-feedback')) ||
      !!submittedMenuVisible ||
      !!(resultsModal && !resultsModal.classList.contains('hidden'));
  }

  function scheduleReviewAudioSync(options) {
    var settings = options || {};
    window.setTimeout(function () {
      revealReviewAudioController(settings);
    }, 0);
  }

  function updateReviewNote(partIndex, sequenceLength) {
    var note = getAudioControllerNote();
    if (!note) return;

    if (sequenceLength > 1) {
      note.textContent = 'Review mode - section ' + (partIndex + 1) + ' audio is ready while you check your answers.';
      return;
    }

    note.textContent = 'Review mode - use this player to re-listen while checking your answers.';
  }

  function updateAudioRecoveryNote(message) {
    var note = getAudioControllerNote();
    if (!note) return;
    note.textContent = message;
  }

  function bindAudioNetworkRecoveryGuard() {
    var audio = getAudioElement();
    if (!audio || audio.dataset.networkRecoveryBound === 'true') return;
    audio.dataset.networkRecoveryBound = 'true';

    var retryTimer = null;
    var retryCount = 0;

    function clearRetryTimer() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function isSubmitted() {
      return !!window.testSubmitted || !!window.__listeningSubmissionObserved;
    }

    function retryCurrentAudio() {
      clearRetryTimer();
      if (isSubmitted() || !hasPlayableSource(audio)) return;

      retryCount += 1;

      var source = audio.dataset.requestedSrc || audio.getAttribute('src') || audio.currentSrc || '';
      if (isAudioUsingPreparedSource(audio)) {
        updateAudioRecoveryNote('Audio is prepared locally. Resuming the same section...');
        doAttemptPlay(audio);
        return;
      }

      updateAudioRecoveryNote('Audio connection interrupted. Reconnecting to the same section...');

      var previousTime = 0;
      try {
        previousTime = Number(audio.currentTime) || 0;
      } catch (error) {}

      try {
        if (source) {
          audio.dataset.requestedSrc = source;
          audio.setAttribute('src', source);
        }
        audio.load();
      } catch (error) {}

      var restoreAndPlay = function () {
        audio.removeEventListener('loadedmetadata', restoreAndPlay);
        audio.removeEventListener('canplay', restoreAndPlay);
        try {
          if (previousTime > 0 && Number.isFinite(audio.duration) && previousTime < audio.duration) {
            audio.currentTime = previousTime;
          }
        } catch (error) {}
        doAttemptPlay(audio);
      };

      audio.addEventListener('loadedmetadata', restoreAndPlay);
      audio.addEventListener('canplay', restoreAndPlay);
      retryTimer = setTimeout(restoreAndPlay, Math.min(12000, 1500 + retryCount * 1500));
    }

    audio.addEventListener('playing', function () {
      retryCount = 0;
      clearRetryTimer();
      if (isReviewModeActive()) {
        scheduleReviewAudioSync({ resetTime: false });
      } else {
        updateAudioRecoveryNote('Listening Audio');
      }
    });

    audio.addEventListener('waiting', function () {
      if (isSubmitted()) return;
      updateAudioRecoveryNote('Buffering audio...');
    });

    audio.addEventListener('stalled', function () {
      if (isSubmitted()) return;
      if (isAudioUsingPreparedSource(audio)) {
        updateAudioRecoveryNote('Audio is prepared locally. Resuming...');
        doAttemptPlay(audio);
        return;
      }
      updateAudioRecoveryNote('Audio connection is slow. Reconnecting...');
      clearRetryTimer();
      retryTimer = setTimeout(retryCurrentAudio, 2500);
    });

    audio.addEventListener('error', function (event) {
      if (isSubmitted()) return;
      var failedSource = audio.dataset.requestedSrc || audio.currentSrc || audio.getAttribute('src') || '';
      if (getFallbackSource(failedSource)) return;

      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      retryCurrentAudio();
    }, true);
  }

  function syncReviewAudio(options) {
    var settings = options || {};
    var audio = getAudioElement();
    var sequence = getInlineAudioSequence();
    if (!audio || !sequence.length) return;

    var targetIndex = getCurrentPartIndex();
    if (targetIndex >= sequence.length) {
      targetIndex = sequence.length - 1;
    }
    if (targetIndex < 0) {
      targetIndex = 0;
    }

    var targetSource = sequence[targetIndex] || sequence[0];
    if (!targetSource) return;

    updateReviewNote(targetIndex, sequence.length);
    bindAudioFallback();

    var previousSource = audio.dataset.reviewActiveSrc || '';
    if (settings.force || previousSource !== targetSource || !hasPlayableSource(audio)) {
      requestAudioSource(audio, targetSource);
      if (settings.resetTime !== false) {
        try {
          audio.currentTime = 0;
        } catch (error) {}
      }
    }
  }

  function revealReviewAudioController(options) {
    syncAudioControllerLayout();
    var audioBar = getAudioControllerBar();
    if (audioBar) {
      audioBar.classList.remove('hidden');
    }
    syncReviewAudio(options);
  }

  function wrapShowResults() {
    if (typeof window.showResults !== 'function' || window.showResults.__fullTestReviewFixed) return;

    var originalShowResults = window.showResults;
    window.showResults = function () {
      var result = originalShowResults.apply(this, arguments);
      markReviewModeActive();
      scheduleReviewAudioSync({ force: true });
      return result;
    };

    window.showResults.__fullTestReviewFixed = true;
  }

  function wrapCloseResults() {
    if (typeof window.closeResults !== 'function' || window.closeResults.__fullTestReviewFixed) return;

    var originalCloseResults = window.closeResults;
    window.closeResults = function () {
      var result = originalCloseResults.apply(this, arguments);
      markReviewModeActive();
      scheduleReviewAudioSync({ force: true });
      return result;
    };

    window.closeResults.__fullTestReviewFixed = true;
  }

  function wrapUpdatePartDisplay() {
    if (typeof window.updatePartDisplay !== 'function' || window.updatePartDisplay.__fullTestReviewFixed) return;

    var originalUpdatePartDisplay = window.updatePartDisplay;
    window.updatePartDisplay = function () {
      var result = originalUpdatePartDisplay.apply(this, arguments);
      syncSubmitButtonVisibility();
      if (isReviewModeActive()) {
        scheduleReviewAudioSync({ force: true });
      }
      return result;
    };

    window.updatePartDisplay.__fullTestReviewFixed = true;
  }

  function wrapSwitchPart() {
    if (typeof window.switchPart !== 'function' || window.switchPart.__fullTestReviewFixed) return;

    var originalSwitchPart = window.switchPart;
    window.switchPart = function () {
      var result = originalSwitchPart.apply(this, arguments);
      syncSubmitButtonVisibility();
      if (isReviewModeActive()) {
        scheduleReviewAudioSync({ force: true });
      }
      return result;
    };

    window.switchPart.__fullTestReviewFixed = true;
  }

  function injectTapDropStyles() {
    if (document.getElementById('listeningFullTapDropStyles')) return;

    var style = document.createElement('style');
    style.id = 'listeningFullTapDropStyles';
    style.textContent = [
      '.drag-item.tap-selected {',
      '  border-color: #2563eb;',
      '  background: #dbeafe;',
      '  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);',
      '}',
      '.drop-zone.tap-ready {',
      '  touch-action: manipulation;',
      '}',
      '.drop-zone.filled {',
      '  cursor: grab;',
      '}',
      '.drop-zone.filled:active {',
      '  cursor: grabbing;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalizeReusableDragState() {
    document.querySelectorAll('.drag-item[data-multiple="true"]').forEach(function (item) {
      item.dataset.used = 'false';
      item.classList.remove('used', 'tap-selected');
      item.draggable = true;
    });

    document.querySelectorAll('.drop-zone').forEach(function (zone) {
      if (zone.dataset.option) {
        zone.draggable = true;
      }
    });
  }

  function bindTapDropFallback() {
    var zones = document.querySelectorAll('.drop-zone');
    var items = document.querySelectorAll('.drag-item');
    if (!zones.length || !items.length) return;

    injectTapDropStyles();

    function clearSelection() {
      document.querySelectorAll('.drag-item.tap-selected').forEach(function (node) {
        node.classList.remove('tap-selected');
      });
    }

    function getSelectedItem(scope) {
      var searchScope = scope && scope.querySelector ? scope : document;
      return searchScope.querySelector('.drag-item.tap-selected');
    }

    function getDragScope(node) {
      var current = node && node.parentElement;
      while (current && current !== document.body) {
        if (current.querySelector && current.querySelector('.drop-zone') && current.querySelector('.drag-item')) {
          return current;
        }
        current = current.parentElement;
      }
      return document;
    }

    function getGroupName(node) {
      if (!node) return '';
      if (node.dataset && node.dataset.group) return node.dataset.group;
      var grouped = node.closest && node.closest('[data-group]');
      return grouped && grouped.dataset ? grouped.dataset.group || '' : '';
    }

    function sameGroup(item, groupName) {
      if (!groupName) return true;
      return !item.dataset.group || item.dataset.group === groupName;
    }

    function findOptionItem(optionId, scope, groupName) {
      if (!optionId) return null;
      var searchScope = scope && scope.querySelectorAll ? scope : document;
      var itemsInScope = Array.prototype.slice.call(searchScope.querySelectorAll('.drag-item'));
      var item = itemsInScope.find(function (node) {
        return node.dataset.option === optionId && sameGroup(node, groupName);
      });
      if (item) return item;

      return Array.prototype.slice.call(document.querySelectorAll('.drag-item')).find(function (node) {
        return node.dataset.option === optionId && sameGroup(node, groupName);
      }) || null;
    }

    function findZoneByTarget(targetName, scope) {
      if (!targetName) return null;
      var searchScope = scope && scope.querySelectorAll ? scope : document;
      var zonesInScope = Array.prototype.slice.call(searchScope.querySelectorAll('.drop-zone'));
      var zone = zonesInScope.find(function (node) {
        return node.dataset.target === targetName;
      });
      if (zone) return zone;

      return Array.prototype.slice.call(document.querySelectorAll('.drop-zone')).find(function (node) {
        return node.dataset.target === targetName;
      }) || null;
    }

    function releaseOption(optionId, scope, groupName) {
      if (!optionId) return;
      var item = findOptionItem(optionId, scope, groupName);
      if (!item || item.dataset.multiple === 'true') return;
      item.dataset.used = 'false';
      item.classList.remove('used');
      item.draggable = true;
      item.classList.remove('tap-selected');
    }

    function updateAnswerValue(targetName, value) {
      if (!targetName) return;
      var input = document.querySelector('input[name="' + targetName + '"]');
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var match = targetName.match(/^q(\d+)$/i);
      if (match && typeof window.saveAnswer === 'function') {
        window.saveAnswer(parseInt(match[1], 10), value);
      }
    }

    function resetZone(zone) {
      if (!zone) return;
      // Don't fall back to zone.textContent — if the zone is currently filled
      // that's the user's answer, not the placeholder. Use the dataset value
      // (set on initial bind) and a generic default as last resort.
      var scope = getDragScope(zone);
      var groupName = getGroupName(zone);
      var placeholder = zone.dataset.placeholder || 'Drop here';
      if (zone.dataset.option && zone.dataset.multiple !== 'true') {
        releaseOption(zone.dataset.option, scope, groupName);
      }
      zone.dataset.value = '';
      delete zone.dataset.option;
      zone.textContent = '';
      var placeholderNode = document.createElement('span');
      placeholderNode.className = 'placeholder';
      placeholderNode.textContent = placeholder;
      zone.appendChild(placeholderNode);
      zone.classList.remove('filled');
      zone.draggable = false;
      updateAnswerValue(zone.dataset.target, '');
    }

    function renderZoneValue(zone, label) {
      zone.textContent = '';
      var valueNode = document.createElement('span');
      valueNode.className = 'drop-value';
      valueNode.textContent = label;
      zone.appendChild(valueNode);
    }

    function markItemUsed(item) {
      if (!item || item.dataset.multiple === 'true') return;
      item.dataset.used = 'true';
      item.classList.add('used');
      item.draggable = false;
      item.classList.remove('tap-selected');
    }

    function placeSelectedItem(zone, item) {
      if (!zone || !item) return;
      var optionId = item.dataset.option || '';
      var answer = item.dataset.answer || optionId;
      var label = item.dataset.label || item.textContent.trim() || answer;
      if (!optionId) return;

      var scope = getDragScope(zone);
      var groupName = getGroupName(zone);
      if (zone.dataset.multiple !== 'true' && zone.dataset.option && zone.dataset.option !== optionId) {
        releaseOption(zone.dataset.option, scope, groupName);
      }

      zone.dataset.option = optionId;
      zone.dataset.value = answer;
      renderZoneValue(zone, label);
      zone.classList.add('filled');
      zone.draggable = true;

      if (zone.dataset.multiple !== 'true') {
        markItemUsed(item);
      }

      updateAnswerValue(zone.dataset.target, answer);
      clearSelection();
    }

    function clearSourceZone(sourceZone, keepOptionUsed) {
      if (!sourceZone) return;
      var sourceOption = sourceZone.dataset.option || '';
      sourceZone.dataset.value = '';
      delete sourceZone.dataset.option;
      sourceZone.textContent = '';
      var placeholderNode = document.createElement('span');
      placeholderNode.className = 'placeholder';
      placeholderNode.textContent = sourceZone.dataset.placeholder || 'Drop here';
      sourceZone.appendChild(placeholderNode);
      sourceZone.classList.remove('filled');
      sourceZone.draggable = false;
      updateAnswerValue(sourceZone.dataset.target, '');
      if (!keepOptionUsed && sourceOption && sourceZone.dataset.multiple !== 'true') {
        releaseOption(sourceOption, getDragScope(sourceZone), getGroupName(sourceZone));
      }
    }

    function placeDraggedItem(zone, optionId, label, answer, sourceZone) {
      if (!zone || !optionId) return;
      var scope = getDragScope(zone);
      var groupName = getGroupName(zone);
      var item = findOptionItem(optionId, scope, groupName);
      var isMultiple = zone.dataset.multiple === 'true';

      if (!isMultiple && zone.dataset.option && zone.dataset.option !== optionId) {
        releaseOption(zone.dataset.option, scope, groupName);
      }

      if (sourceZone && sourceZone !== zone) {
        clearSourceZone(sourceZone, true);
      }

      zone.dataset.option = optionId;
      zone.dataset.value = answer || (item && item.dataset.answer) || optionId;
      renderZoneValue(zone, label || (item && (item.dataset.label || item.textContent.trim())) || optionId);
      zone.classList.add('filled');
      zone.draggable = true;

      if (!isMultiple) {
        markItemUsed(item);
      }

      updateAnswerValue(zone.dataset.target, zone.dataset.value || '');
      clearSelection();
    }

    function bindScopedDragDropFix() {
      zones.forEach(function (zone) {
        if (zone.dataset.scopedDragBound === 'true') return;
        zone.dataset.scopedDragBound = 'true';

        zone.addEventListener('dragover', function (event) {
          event.preventDefault();
        }, true);

        zone.addEventListener('drop', function (event) {
          var transfer = event.dataTransfer;
          if (!transfer) return;
          var optionId = transfer.getData('text/plain');
          if (!optionId) return;

          event.preventDefault();
          event.stopImmediatePropagation();

          var sourceTarget = transfer.getData('text/source-zone');
          var sourceZone = sourceTarget ? findZoneByTarget(sourceTarget) : null;
          var label = transfer.getData('text/label') || optionId;
          var answer = transfer.getData('text/answer') || optionId;
          placeDraggedItem(zone, optionId, label, answer, sourceZone);
        }, true);

        zone.addEventListener('dragstart', function (event) {
          if (!zone.dataset.option) {
            event.preventDefault();
            return;
          }

          var transfer = event.dataTransfer;
          if (!transfer) return;

          var optionId = zone.dataset.option || '';
          var answer = zone.dataset.value || optionId;
          var labelNode = zone.querySelector('.drop-value');
          var label = labelNode ? labelNode.textContent.trim() : zone.textContent.trim();

          transfer.setData('text/plain', optionId);
          transfer.setData('text/label', label || optionId);
          transfer.setData('text/answer', answer);
          transfer.setData('text/source-zone', zone.dataset.target || '');
          transfer.setData('text/multiple', zone.dataset.multiple || '');

          event.stopImmediatePropagation();
        }, true);
      });

      document.querySelectorAll('.drag-options').forEach(function (bin) {
        if (bin.dataset.scopedReturnBound === 'true') return;
        bin.dataset.scopedReturnBound = 'true';

        bin.addEventListener('dragover', function (event) {
          event.preventDefault();
        }, true);

        bin.addEventListener('drop', function (event) {
          var transfer = event.dataTransfer;
          if (!transfer) return;
          var sourceTarget = transfer.getData('text/source-zone');
          if (!sourceTarget) return;

          event.preventDefault();
          event.stopImmediatePropagation();

          var sourceZone = findZoneByTarget(sourceTarget);
          if (!sourceZone) return;
          clearSourceZone(sourceZone, false);
        }, true);
      });
    }

    bindScopedDragDropFix();
    normalizeReusableDragState();

    items.forEach(function (item) {
      if (item.dataset.tapBound === 'true') return;
      item.dataset.tapBound = 'true';
      item.tabIndex = item.tabIndex >= 0 ? item.tabIndex : 0;

      item.addEventListener('click', function () {
        if (item.dataset.used === 'true') return;
        if (item.classList.contains('tap-selected')) {
          item.classList.remove('tap-selected');
          return;
        }
        clearSelection();
        item.classList.add('tap-selected');
      });

      item.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        item.click();
      });
    });

    zones.forEach(function (zone) {
      if (zone.dataset.tapBound === 'true') return;
      zone.dataset.tapBound = 'true';
      zone.classList.add('tap-ready');
      zone.tabIndex = zone.tabIndex >= 0 ? zone.tabIndex : 0;

      zone.addEventListener('click', function () {
        var selectedItem = getSelectedItem(getDragScope(zone));
        if (selectedItem) {
          placeSelectedItem(zone, selectedItem);
          return;
        }
        if (zone.dataset.option) {
          resetZone(zone);
        }
      });

      zone.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        zone.click();
      });
    });
  }

  function wrapSetupDragDrop() {
    if (typeof window.setupDragDrop !== 'function' || window.setupDragDrop.__fullTestFixed) return;

    var originalSetupDragDrop = window.setupDragDrop;
    window.setupDragDrop = function () {
      var result = originalSetupDragDrop.apply(this, arguments);
      bindTapDropFallback();
      return result;
    };

    window.setupDragDrop.__fullTestFixed = true;
  }

  function wrapRestoreSavedAnswers() {
    if (typeof window.restoreSavedAnswers !== 'function' || window.restoreSavedAnswers.__fullTestDropFixed) return;

    var originalRestoreSavedAnswers = window.restoreSavedAnswers;
    window.restoreSavedAnswers = function () {
      if (window.__listeningFreshStartRequested) {
        bindTapDropFallback();
        normalizeReusableDragState();
        normalizeAllCheckboxGroups();
        return;
      }
      var result = originalRestoreSavedAnswers.apply(this, arguments);
      bindTapDropFallback();
      normalizeReusableDragState();
      normalizeAllCheckboxGroups();
      return result;
    };

    window.restoreSavedAnswers.__fullTestDropFixed = true;
  }

  function getCheckboxesByName(groupName) {
    if (!groupName) return [];
    try {
      return Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"][name="' + CSS.escape(groupName) + '"]'));
    } catch (error) {
      return Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"]')).filter(function (input) {
        return input.name === groupName;
      });
    }
  }

  function getGroupQuestionIds(groupName, container) {
    // Prefer the explicit array passed to updateCheckboxGroup([..], 'q21_22_23') in the onchange handler.
    if (container) {
      var checkbox = container.querySelector && container.querySelector('input[type="checkbox"][onchange*="updateCheckboxGroup"]');
      var handler = checkbox && (checkbox.getAttribute('onchange') || '');
      var arrayMatch = handler && handler.match(/updateCheckboxGroup\s*\(\s*\[([^\]]+)\]/);
      if (arrayMatch) {
        var ids = arrayMatch[1].split(',').map(function (token) {
          return parseInt(token.trim(), 10);
        }).filter(function (value, index, list) {
          return Number.isFinite(value) && list.indexOf(value) === index;
        });
        if (ids.length) return ids;
      }
    }

    var source = groupName || '';
    if (container && container.getAttribute) {
      source += '_' + (container.getAttribute('data-multi-group') || '');
    }
    return (source.match(/\d+/g) || []).map(function (value) {
      return parseInt(value, 10);
    }).filter(function (value, index, list) {
      return Number.isFinite(value) && list.indexOf(value) === index;
    });
  }

  function getTextLimit(text) {
    var normalized = String(text || '').toLowerCase();
    if (/\b(two|2)\b/.test(normalized) && /choose|which/.test(normalized)) return 2;
    if (/\b(three|3)\b/.test(normalized) && /choose|which/.test(normalized)) return 3;
    if (/\b(four|4)\b/.test(normalized) && /choose|which/.test(normalized)) return 4;
    return 0;
  }

  function getCheckboxLimit(input, container) {
    if (!input) return 0;
    var groupContainer = container || input.closest('[data-multi-group]');
    var explicitLimit = groupContainer && (
      groupContainer.getAttribute('data-max-selected') ||
      groupContainer.getAttribute('data-max-options') ||
      groupContainer.getAttribute('data-limit')
    );
    if (explicitLimit && !Number.isNaN(parseInt(explicitLimit, 10))) {
      return parseInt(explicitLimit, 10);
    }

    var textScope = groupContainer || input.closest('.multiple-choice-block, .matching-section, .multiple-choice, .question-group');
    var textLimit = getTextLimit(textScope ? textScope.textContent : '');
    if (textLimit) return textLimit;

    var ids = getGroupQuestionIds(input.name, groupContainer);
    if (ids.length >= 2) return ids.length;
    return 0;
  }

  function refreshCheckboxDisabledState(groupName, limit, container) {
    var checkboxes = getCheckboxesByName(groupName);
    if (!checkboxes.length || !limit) return;
    var checkedCount = checkboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;

    checkboxes.forEach(function (checkbox) {
      var wasLimited = checkbox.dataset.checkboxLimitDisabled === 'true';
      if (!checkbox.checked && checkedCount >= limit) {
        checkbox.disabled = true;
        checkbox.dataset.checkboxLimitDisabled = 'true';
      } else if (wasLimited) {
        checkbox.disabled = false;
        delete checkbox.dataset.checkboxLimitDisabled;
      }
    });

    if (container && container.dataset) {
      container.dataset.selectedCount = String(Math.min(checkedCount, limit));
      container.dataset.maxSelected = String(limit);
    }
  }

  function syncCheckboxAnswer(groupName, container) {
    if (typeof window.updateCheckboxGroup !== 'function') return;
    var ids = getGroupQuestionIds(groupName, container);
    if (ids.length < 2) return;
    window.updateCheckboxGroup(ids, groupName);
  }

  function normalizeCheckboxGroup(groupName, changedInput) {
    var checkboxes = getCheckboxesByName(groupName);
    if (!checkboxes.length) return false;
    var container = (changedInput && changedInput.closest('[data-multi-group]')) ||
      checkboxes[0].closest('[data-multi-group]');
    var limit = getCheckboxLimit(changedInput || checkboxes[0], container);
    if (!limit || limit < 1) return false;

    var checked = checkboxes.filter(function (checkbox) {
      return checkbox.checked;
    });
    var trimmed = false;

    if (checked.length > limit) {
      if (changedInput && changedInput.checked && checked.indexOf(changedInput) !== -1) {
        changedInput.checked = false;
      } else {
        checked.slice(limit).forEach(function (checkbox) {
          checkbox.checked = false;
        });
      }
      trimmed = true;
    }

    refreshCheckboxDisabledState(groupName, limit, container);
    if (trimmed) {
      syncCheckboxAnswer(groupName, container);
    }
    return trimmed;
  }

  function normalizeAllCheckboxGroups() {
    var seen = {};
    document.querySelectorAll('input[type="checkbox"][name]').forEach(function (input) {
      if (seen[input.name]) return;
      seen[input.name] = true;
      normalizeCheckboxGroup(input.name, input);
    });
  }

  function bindCheckboxLimitGuard() {
    if (window.__listeningFullCheckboxLimitGuardAttached) return;
    window.__listeningFullCheckboxLimitGuardAttached = true;

    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || input.type !== 'checkbox' || !input.name) return;
      if (normalizeCheckboxGroup(input.name, input)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    normalizeAllCheckboxGroups();
    window.setTimeout(normalizeAllCheckboxGroups, 0);
    window.setTimeout(normalizeAllCheckboxGroups, 250);
  }

  function wrapUpdateCheckboxGroup() {
    if (typeof window.updateCheckboxGroup !== 'function' || window.updateCheckboxGroup.__checkboxLimitFixed) return;

    var originalUpdateCheckboxGroup = window.updateCheckboxGroup;
    window.updateCheckboxGroup = function (qIds, groupName) {
      normalizeCheckboxGroup(groupName);
      return originalUpdateCheckboxGroup.apply(this, arguments);
    };

    window.updateCheckboxGroup.__checkboxLimitFixed = true;
  }

  function styleMultiAnswerCheckboxGroups() {
    document.querySelectorAll('[data-multi-group]').forEach(function (container) {
      if (!container) return;
      var checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"][name]'));
      if (!checkboxes.length) return;

      var groupName = container.getAttribute('data-multi-group') || checkboxes[0].name || '';
      var questionIds = getGroupQuestionIds(groupName, container);
      container.classList.add('multi-answer-checkbox-card');

      if (questionIds.length && !container.getAttribute('data-max-selected')) {
        container.setAttribute('data-max-selected', String(questionIds.length));
      }

      checkboxes.forEach(function (checkbox) {
        checkbox.classList.add('choice-input');
        var label = checkbox.closest && checkbox.closest('label');
        if (label) {
          label.classList.add('choice-item');
        }
      });
    });
  }

  var bottomProgressRefreshTimer = null;
  var bottomProgressObserver = null;
  var bottomProgressRendering = false;

  function getBottomNavigation() {
    return document.querySelector('.bottom-navigation');
  }

  function getPartsNavigation() {
    var bottomNavigation = getBottomNavigation();
    return bottomNavigation && bottomNavigation.querySelector('.parts-navigation');
  }

  function getPartRange(partNumber) {
    var start = ((partNumber - 1) * 10) + 1;
    return { start: start, end: start + 9 };
  }

  function getActivePartNumber() {
    for (var i = 1; i <= 4; i++) {
      var button = document.getElementById('part' + i + 'Btn');
      if (button && button.classList.contains('active')) return i;
    }

    for (var j = 1; j <= 4; j++) {
      var content = document.getElementById('part' + j + 'Content');
      if (content && !content.classList.contains('hidden')) return j;
    }

    return 1;
  }

  function queryInputsByName(name) {
    if (!name) return [];
    try {
      if (window.CSS && typeof window.CSS.escape === 'function') {
        return Array.prototype.slice.call(document.querySelectorAll('[name="' + window.CSS.escape(name) + '"]'));
      }
    } catch (error) {}

    return Array.prototype.slice.call(document.querySelectorAll('[name]')).filter(function (input) {
      return input.name === name;
    });
  }

  function getMultiGroupContainerForQuestion(questionId) {
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-multi-group]'));
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var ids = getGroupQuestionIds(group.getAttribute('data-multi-group') || '', group);
      if (ids.indexOf(questionId) !== -1) {
        return { container: group, questionIds: ids };
      }
    }
    return null;
  }

  function isQuestionAnsweredByMultiGroup(questionId) {
    var groupInfo = getMultiGroupContainerForQuestion(questionId);
    if (!groupInfo) return null;

    var checkboxes = Array.prototype.slice.call(groupInfo.container.querySelectorAll('input[type="checkbox"][name]'));
    if (!checkboxes.length) return false;

    var limit = getCheckboxLimit(checkboxes[0], groupInfo.container) || groupInfo.questionIds.length || 1;
    var checkedCount = checkboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;
    var slotIndex = Math.max(0, groupInfo.questionIds.indexOf(questionId));
    return checkedCount >= Math.min(limit, slotIndex + 1);
  }

  function isElementValueFilled(element) {
    if (!element) return false;
    if ('value' in element) {
      return String(element.value || '').trim() !== '';
    }
    if (element.isContentEditable) {
      return String(element.textContent || '').trim() !== '';
    }
    return false;
  }

  function isDropZoneAnswered(questionId) {
    var zone = document.querySelector('.drop-zone[data-target="q' + questionId + '"], .drop-zone[data-question="q' + questionId + '"]');
    if (!zone || !zone.dataset) return false;
    var storedValue = zone.dataset.value || zone.dataset.option || zone.dataset.answer || '';
    if (String(storedValue || '').trim() !== '') return true;
    return zone.classList.contains('filled') && String(zone.textContent || '').replace(/Drop [A-Z0-9-]+ here/i, '').trim() !== '';
  }

  function isQuestionAnswered(questionId) {
    var multiAnswer = isQuestionAnsweredByMultiGroup(questionId);
    if (multiAnswer !== null) return multiAnswer;

    var inputs = queryInputsByName('q' + questionId);
    if (inputs.some(function (input) {
      if (input.type === 'radio' || input.type === 'checkbox') return input.checked;
      return isElementValueFilled(input);
    })) {
      return true;
    }

    var byId = document.getElementById('q' + questionId);
    if (byId && byId.matches && byId.matches('input, textarea, select, [contenteditable="true"]')) {
      return isElementValueFilled(byId);
    }

    var select = document.querySelector('select[data-question="q' + questionId + '"], select[data-target="q' + questionId + '"]');
    if (select && String(select.value || '').trim() !== '') return true;

    return isDropZoneAnswered(questionId);
  }

  function countAnsweredInPart(partNumber) {
    var range = getPartRange(partNumber);
    var count = 0;
    for (var questionId = range.start; questionId <= range.end; questionId++) {
      if (isQuestionAnswered(questionId)) count++;
    }
    return count;
  }

  function getCurrentQuestionNumber(activePartNumber) {
    var current = parseInt(document.documentElement.getAttribute('data-full-listening-current-question') || '', 10);
    var range = getPartRange(activePartNumber);
    if (Number.isFinite(current) && current >= range.start && current <= range.end) {
      return current;
    }
    return range.start;
  }

  function setCurrentQuestionNumber(questionNumber) {
    var numeric = parseInt(questionNumber, 10);
    if (!Number.isFinite(numeric)) return;
    document.documentElement.setAttribute('data-full-listening-current-question', String(numeric));
    scheduleBottomProgressNavRefresh();
  }

  function syncPartMiniProgress(navItem, partNumber, activePartNumber, currentQuestion) {
    if (!navItem) return;

    var partButton = navItem.querySelector('.part-button');
    var labelStrip = navItem.querySelector('.part-label-progress');
    if (!labelStrip) {
      labelStrip = document.createElement('div');
      labelStrip.className = 'part-label-progress';
      labelStrip.setAttribute('aria-hidden', 'true');
      navItem.insertBefore(labelStrip, navItem.firstChild);
    }
    labelStrip.classList.toggle('is-complete', countAnsweredInPart(partNumber) >= 10);
    if (partButton) {
      partButton.classList.toggle('part-complete', countAnsweredInPart(partNumber) >= 10);
    }
    if (partButton) {
      var navRect = navItem.getBoundingClientRect();
      var buttonRect = partButton.getBoundingClientRect();
      labelStrip.style.left = Math.max(0, Math.round(buttonRect.left - navRect.left)) + 'px';
      labelStrip.style.width = Math.max(24, Math.round(buttonRect.width)) + 'px';
    }

    var strip = navItem.querySelector('.part-mini-progress');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'part-mini-progress';
      strip.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 10; i++) {
        var segment = document.createElement('span');
        strip.appendChild(segment);
      }
      navItem.insertBefore(strip, navItem.firstChild);
    }

    var isActive = partNumber === activePartNumber;
    labelStrip.hidden = !isActive;
    strip.hidden = !isActive;
    navItem.classList.toggle('has-mini-progress', isActive);
    if (!isActive) return;

    var questionNumbers = document.getElementById('part' + partNumber + 'Questions');
    if (questionNumbers && !questionNumbers.classList.contains('hidden')) {
      var itemRect = navItem.getBoundingClientRect();
      var numbersRect = questionNumbers.getBoundingClientRect();
      strip.style.left = Math.max(0, Math.round(numbersRect.left - itemRect.left)) + 'px';
      strip.style.right = 'auto';
      strip.style.width = Math.max(0, Math.round(numbersRect.width)) + 'px';
    } else {
      strip.style.left = '0';
      strip.style.right = 'auto';
      strip.style.width = '100%';
    }

    var range = getPartRange(partNumber);
    Array.prototype.slice.call(strip.children).forEach(function (segment, index) {
      var questionId = range.start + index;
      segment.classList.toggle('is-answered', isQuestionAnswered(questionId));
      segment.classList.toggle('is-current', questionId === currentQuestion);
    });
  }

  function renderBottomProgressNavigation() {
    if (bottomProgressRendering) return;

    var bottomNavigation = getBottomNavigation();
    var partsNavigation = getPartsNavigation();
    if (!bottomNavigation || !partsNavigation) return;

    bottomProgressRendering = true;
    try {
      bottomNavigation.classList.add('progress-nav-enhanced');
      partsNavigation.classList.add('progress-parts-navigation');

      var activePart = getActivePartNumber();
      var currentQuestion = getCurrentQuestionNumber(activePart);

      for (var partNumber = 1; partNumber <= 4; partNumber++) {
        var partItem = document.getElementById('part' + partNumber + 'Btn');
        var questionNumbers = document.getElementById('part' + partNumber + 'Questions');
        if (!partItem) continue;

        var navItem = partItem.closest('.part-nav-item');
        if (navItem) {
          navItem.classList.toggle('active', partNumber === activePart);
        }

        partItem.classList.toggle('active', partNumber === activePart);
        var partLabel = 'Part ' + partNumber;
        if (partItem.textContent !== partLabel) {
          partItem.textContent = partLabel;
        }

        var countLabel = navItem && navItem.querySelector('.part-progress-count');
        if (navItem && !countLabel) {
          countLabel = document.createElement('span');
          countLabel.className = 'part-progress-count';
          partItem.insertAdjacentElement('afterend', countLabel);
        }
        if (countLabel) {
          var progressText = countAnsweredInPart(partNumber) + ' of 10';
          if (countLabel.textContent !== progressText) {
            countLabel.textContent = progressText;
          }
          countLabel.hidden = partNumber === activePart;
        }

        if (questionNumbers) {
          questionNumbers.classList.toggle('hidden', partNumber !== activePart);
          questionNumbers.querySelectorAll('.question-number').forEach(function (button) {
            var number = parseInt(button.textContent || '', 10);
            if (!Number.isFinite(number)) return;
            button.classList.toggle('is-answered', isQuestionAnswered(number));
            button.classList.toggle('current', number === currentQuestion);
          });
        }
        syncPartMiniProgress(navItem, partNumber, activePart, currentQuestion);
      }
    } finally {
      bottomProgressRendering = false;
    }
  }

  function scheduleBottomProgressNavRefresh() {
    if (bottomProgressRefreshTimer) {
      window.clearTimeout(bottomProgressRefreshTimer);
    }
    bottomProgressRefreshTimer = window.setTimeout(function () {
      bottomProgressRefreshTimer = null;
      renderBottomProgressNavigation();
    }, 0);
  }

  function wrapFocusQuestion() {
    if (typeof window.focusQuestion !== 'function' || window.focusQuestion.__fullTestProgressFixed) return;

    var originalFocusQuestion = window.focusQuestion;
    window.focusQuestion = function (questionNumber) {
      setCurrentQuestionNumber(questionNumber);
      var result = originalFocusQuestion.apply(this, arguments);
      scheduleBottomProgressNavRefresh();
      return result;
    };

    window.focusQuestion.__fullTestProgressFixed = true;
  }

  function wrapUpdateProgress() {
    if (typeof window.updateProgress !== 'function' || window.updateProgress.__fullTestProgressFixed) return;

    var originalUpdateProgress = window.updateProgress;
    window.updateProgress = function () {
      var result = originalUpdateProgress.apply(this, arguments);
      scheduleBottomProgressNavRefresh();
      return result;
    };

    window.updateProgress.__fullTestProgressFixed = true;
  }

  function bindBottomProgressEvents() {
    if (window.__listeningFullBottomProgressEventsAttached) return;
    window.__listeningFullBottomProgressEventsAttached = true;

    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest && event.target.closest('.question-number');
      if (!button) return;
      var number = parseInt(button.textContent || '', 10);
      if (Number.isFinite(number)) {
        setCurrentQuestionNumber(number);
      }
    });

    document.addEventListener('click', function (event) {
      var item = event.target && event.target.closest && event.target.closest('.bottom-navigation.progress-nav-enhanced .part-nav-item');
      if (!item || event.target.closest('.question-number') || event.target.closest('.part-button')) return;

      var button = item.querySelector('.part-button[id^="part"][id$="Btn"]');
      var match = button && button.id && button.id.match(/^part(\d+)Btn$/);
      if (!match || typeof window.switchPart !== 'function') return;

      window.switchPart(parseInt(match[1], 10) - 1);
      scheduleBottomProgressNavRefresh();
    });

    ['input', 'change', 'drop'].forEach(function (eventName) {
      document.addEventListener(eventName, scheduleBottomProgressNavRefresh, true);
    });
  }

  function observeBottomProgressNavigation() {
    if (bottomProgressObserver || typeof MutationObserver !== 'function') return;
    var bottomNavigation = getBottomNavigation();
    if (!bottomNavigation) return;

    bottomProgressObserver = new MutationObserver(function () {
      if (bottomProgressRendering) return;
      scheduleBottomProgressNavRefresh();
    });
    bottomProgressObserver.observe(bottomNavigation, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-value', 'data-option', 'data-answer']
    });
  }

  function injectBottomProgressStyles() {
    if (document.getElementById('listeningFullBottomProgressStyles')) return;

    var style = document.createElement('style');
    style.id = 'listeningFullBottomProgressStyles';
    style.textContent = [
      '.bottom-navigation.progress-nav-enhanced {',
      '  background: #fff;',
      '  padding: 0 16px;',
      '  box-shadow: none;',
      '  min-height: 44px;',
      '  border-top: 0;',
      '  border-left: 0;',
      '  border-right: 0;',
      '  outline: 0;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .parts-navigation {',
      '  flex: 1 1 auto;',
      '  align-self: stretch;',
      '  justify-content: stretch;',
      '  gap: 0;',
      '  flex-wrap: nowrap;',
      '  overflow-x: auto;',
      '  scrollbar-width: thin;',
      '  background: #fff;',
      '  box-shadow: none;',
      '  border-top: 0;',
      '  outline: 0;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-nav-item {',
      '  position: relative;',
      '  min-height: 44px;',
      '  padding: 0 clamp(18px, 4vw, 70px);',
      '  gap: 10px;',
      '  flex: 1 0 0;',
      '  justify-content: center;',
      '  white-space: nowrap;',
      '  cursor: pointer;',
      '  transition: background-color 0.15s ease;',
      '  background: #fff;',
      '  border-left: 0;',
      '  border-right: 0;',
      '  box-shadow: none;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-nav-item:hover {',
      '  background: #fff;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-nav-item.active {',
      '  background: #fff;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-label-progress {',
      '  display: none !important;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-label-progress[hidden] {',
      '  display: none !important;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-label-progress.is-complete {',
      '  background: #2f8a24;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-mini-progress {',
      '  display: none !important;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-mini-progress[hidden] {',
      '  display: none !important;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-mini-progress span {',
      '  display: block;',
      '  flex: 0 0 22px;',
      '  width: 22px;',
      '  height: 3px;',
      '  background: #d7d7d7;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-mini-progress span.is-answered {',
      '  background: #2f8a24;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-mini-progress span.is-current:not(.is-answered) {',
      '  background: #d7d7d7;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-button {',
      '  box-sizing: border-box;',
      '  position: relative;',
      '  overflow: visible;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 0;',
      '  height: 22px;',
      '  border-radius: 2px;',
      '  background: transparent !important;',
      '  color: #111827 !important;',
      '  font-size: 1rem;',
      '  font-weight: 400;',
      '  line-height: 1.1;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-button.active {',
      '  background: transparent !important;',
      '  color: #111827 !important;',
      '  font-weight: 700;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-button.active::before {',
      '  content: "";',
      '  position: absolute;',
      '  left: 0;',
      '  top: -8px;',
      '  width: 100%;',
      '  height: 3px;',
      '  background: #d7d7d7;',
      '  pointer-events: none;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-button.active.part-complete::before {',
      '  background: #2f8a24;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .part-progress-count {',
      '  color: #6b7280;',
      '  font-size: 1rem;',
      '  line-height: 1.35;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-numbers {',
      '  gap: 7px;',
      '  align-items: center;',
      '  flex-wrap: nowrap;',
      '  max-width: none;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number {',
      '  box-sizing: border-box;',
      '  position: relative;',
      '  overflow: visible;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 22px;',
      '  min-width: 22px;',
      '  height: 22px;',
      '  padding: 0 3px;',
      '  border: 1px solid transparent;',
      '  border-radius: 2px;',
      '  background: transparent;',
      '  color: #111827;',
      '  font-size: 1rem;',
      '  line-height: 1.1;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number::before {',
      '  content: "";',
      '  position: absolute;',
      '  left: 0;',
      '  top: -8px;',
      '  width: 100%;',
      '  height: 3px;',
      '  background: #d7d7d7;',
      '  pointer-events: none;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number.is-answered::before {',
      '  background: #2f8a24;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number:hover {',
      '  background: #f3f4f6;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number.current {',
      '  border-color: #2563eb;',
      '  color: #111827;',
      '  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);',
      '}',
      '.bottom-navigation.progress-nav-enhanced .question-number.is-answered {',
      '  font-weight: 600;',
      '}',
      '.bottom-navigation.progress-nav-enhanced .nav-arrow {',
      '  flex: 0 0 auto;',
      '  margin-left: 12px;',
      '}',
      'body.contrast-white-black .bottom-navigation.progress-nav-enhanced .part-button,',
      'body.contrast-white-black .bottom-navigation.progress-nav-enhanced .question-number {',
      '  color: #f8fafc !important;',
      '}',
      'body.contrast-white-black .bottom-navigation.progress-nav-enhanced .part-progress-count {',
      '  color: #d1d5db;',
      '}',
      'body.contrast-white-black .bottom-navigation.progress-nav-enhanced .question-number.current {',
      '  border-color: #93c5fd;',
      '  box-shadow: 0 0 0 1px rgba(147, 197, 253, 0.45);',
      '}',
      'body.contrast-yellow-black .bottom-navigation.progress-nav-enhanced .part-button,',
      'body.contrast-yellow-black .bottom-navigation.progress-nav-enhanced .question-number {',
      '  color: #fde68a !important;',
      '}',
      'body.contrast-yellow-black .bottom-navigation.progress-nav-enhanced .part-progress-count {',
      '  color: #facc15;',
      '}',
      'body.contrast-yellow-black .bottom-navigation.progress-nav-enhanced .question-number.current {',
      '  border-color: #facc15;',
      '  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.45);',
      '}',
      '@media (max-width: 768px) {',
      '  .bottom-navigation.progress-nav-enhanced .parts-navigation {',
      '    justify-content: flex-start;',
      '    gap: 0;',
      '  }',
      '  .bottom-navigation.progress-nav-enhanced .part-nav-item {',
      '    padding: 0 12px;',
      '    gap: 7px;',
      '  }',
      '  .bottom-navigation.progress-nav-enhanced .part-mini-progress {',
      '    right: auto;',
      '  }',
      '  .bottom-navigation.progress-nav-enhanced .part-button,',
      '  .bottom-navigation.progress-nav-enhanced .part-progress-count,',
      '  .bottom-navigation.progress-nav-enhanced .question-number {',
      '    font-size: 0.92rem;',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function injectSectionHeaderStyles() {
    if (document.getElementById('listeningFullSectionHeaderFixStyles')) return;

    var style = document.createElement('style');
    style.id = 'listeningFullSectionHeaderFixStyles';
    style.textContent = [
      '.section4-header-row {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '  justify-content: flex-start !important;',
      '  align-items: flex-start !important;',
      '  gap: 6px !important;',
      '  max-width: none !important;',
      '  margin-bottom: 20px;',
      '  line-height: 1.18;',
      '}',
      '.section4-header-row > span {',
      '  display: block;',
      '  max-width: 100%;',
      '  white-space: normal;',
      '  word-break: normal;',
      '}',
      '.section4-header-row > span:first-child {',
      '  letter-spacing: 0;',
      '}',
      '.section4-header-row > span + span {',
      '  font-size: 0.82em;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalizeMojibakeText(root) {
    var scope = root && root.nodeType ? root : document.body;
    if (!scope || typeof document.createTreeWalker !== 'function') return;

    var replacements = [
      [/РІСљ[-"]\s*/g, ''],
      [/вњ[“—]\s*/g, ''],
      [/в–і\s*/g, ''],
      [/РІР‚вЂњ/g, '-'],
      [/вЂ“/g, '-'],
      [/вЂ”/g, '-'],
      [/вЂ™/g, "'"],
      [/вЂљ/g, "'"],
      [/вЂњ/g, '"'],
      [/вЂќ/g, '"']
    ];
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/i.test(node.parentElement.tagName)) continue;
      var text = node.nodeValue;
      var normalized = text;
      replacements.forEach(function (entry) {
        normalized = normalized.replace(entry[0], entry[1]);
      });
      if (normalized !== text) {
        node.nodeValue = normalized;
      }
    }
  }

  function bindMojibakeNormalizer() {
    if (window.__listeningFullMojibakeNormalizerAttached) return;
    window.__listeningFullMojibakeNormalizerAttached = true;

    normalizeMojibakeText(document.body);
    if (typeof MutationObserver !== 'function' || !document.body) return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 3) {
            var wrapper = document.createElement('span');
            wrapper.appendChild(node.cloneNode(true));
            normalizeMojibakeText(wrapper);
            if (wrapper.firstChild && wrapper.firstChild.nodeValue !== node.nodeValue) {
              node.nodeValue = wrapper.firstChild.nodeValue;
            }
            return;
          }
          if (node.nodeType === 1) {
            normalizeMojibakeText(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function enhanceBottomProgressNavigation() {
    injectBottomProgressStyles();
    wrapFocusQuestion();
    wrapUpdateProgress();
    bindBottomProgressEvents();
    observeBottomProgressNavigation();
    scheduleBottomProgressNavRefresh();
    window.setTimeout(scheduleBottomProgressNavRefresh, 80);
    window.setTimeout(scheduleBottomProgressNavRefresh, 300);
  }

  function init() {
    styleMultiAnswerCheckboxGroups();
    injectSectionHeaderStyles();
    bindMojibakeNormalizer();
    bindSpellcheckGuard();
    attachAudioLayoutGuard();
    bindAudioFallback();
    bindAudioNetworkRecoveryGuard();
    bindLiveAudioSequenceController();
    bindSubmitButtonVisibilityGuard();
    wrapTriggerAudioPlayback();
    wrapStartTest();
    wrapShowResults();
    wrapCloseResults();
    wrapUpdatePartDisplay();
    wrapSwitchPart();
    wrapSetupDragDrop();
    wrapRestoreSavedAnswers();
    wrapUpdateCheckboxGroup();
    bindCheckboxLimitGuard();
    bindTapDropFallback();
    normalizeAllCheckboxGroups();
    styleMultiAnswerCheckboxGroups();
    enhanceBottomProgressNavigation();
    // The Submit-button "reopen results" behavior used to live here. It now
    // lives in the shared assets/submit-reopen-shim.js (loaded on every
    // test page by progress-tracker.js) so passage + section tests get the
    // same UX without duplicating code.

    if (isReviewModeActive()) {
      revealReviewAudioController({ force: true });
    }
  }

  if (document.readyState === 'loading') {
    styleMultiAnswerCheckboxGroups();
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
