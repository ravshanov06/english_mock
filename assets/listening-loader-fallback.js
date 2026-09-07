(function () {
  var path = String(window.location.pathname || '').toLowerCase();
  var isListeningSectionPage = path.indexOf('/listening/section ') !== -1 || path.indexOf('/listening/section%20') !== -1;
  var isFullListeningPage = path.indexOf('/listening/') !== -1 && path.indexOf('/listening/section') === -1;
  if (!isListeningSectionPage && !isFullListeningPage) {
    return;
  }

  function hasTestStarted() {
    var testInterface = document.getElementById('testInterface');
    return !!window.__listeningTestStarted ||
      !!window.__listeningSubmissionObserved ||
      !!(document.body && document.body.classList.contains('listening-review-active')) ||
      !!window.testSubmitted ||
      !!(testInterface && !testInterface.classList.contains('hidden'));
  }

  function syncStartedScreens() {
    if (!hasTestStarted()) return;

    var loadingScreen = document.getElementById('loadingScreen');
    var startScreen = document.getElementById('startScreen');
    var testInterface = document.getElementById('testInterface');
    var bottomNav = document.getElementById('bottomNavigation') || document.querySelector('.bottom-navigation');

    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (startScreen) startScreen.classList.add('hidden');
    if (testInterface) testInterface.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');
  }

  function revealStartScreen() {
    if (hasTestStarted()) {
      syncStartedScreens();
      return;
    }
    var loadingScreen = document.getElementById('loadingScreen');
    var startScreen = document.getElementById('startScreen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (startScreen) startScreen.classList.remove('hidden');
  }

  function safeCall(name) {
    if (typeof window[name] === 'function') {
      try {
        window[name]();
      } catch (error) {
        console.warn(name + ' failed', error);
      }
    }
  }

  function fallbackStartTest() {
    var startScreen = document.getElementById('startScreen');
    var testInterface = document.getElementById('testInterface');
    var audioBar = document.querySelector('.audio-controller-bar');
    var testAudio = document.getElementById('testAudio');
    var bottomNav = document.querySelector('.bottom-navigation');
    var firstContent = document.getElementById('part1Content');

    window.__listeningTestStarted = true;
    if (startScreen) startScreen.classList.add('hidden');
    if (testInterface) testInterface.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');
    if (firstContent) firstContent.classList.remove('hidden');
    if (audioBar) audioBar.classList.add('hidden');

    if (testAudio) {
      try {
        testAudio.currentTime = 0;
        testAudio.play().catch(function () {});
      } catch (error) {}
    }

    safeCall('updatePartDisplay');
    safeCall('updateNavigation');
    safeCall('initializeHighlighting');
    safeCall('setupDragDrop');
    safeCall('setupUIControls');
  }

  function runStartTest() {
    window.__listeningTestStarted = true;
    syncStartedScreens();
    var originalStartTest = window.__listeningOriginalStartTest;
    if (typeof originalStartTest === 'function') {
      try {
        return originalStartTest();
      } catch (error) {
        console.warn('startTest failed, using fallback', error);
      }
    }
    return fallbackStartTest();
  }

  function ensureStartHandler() {
    if (typeof window.__listeningSafeStartTest !== 'function') {
      window.__listeningSafeStartTest = runStartTest;
    }
    if (typeof window.startTest === 'function' &&
        window.startTest !== runStartTest &&
        window.startTest !== fallbackStartTest &&
        typeof window.__listeningOriginalStartTest !== 'function') {
      window.__listeningOriginalStartTest = window.startTest;
    }
    if (typeof window.startTest !== 'function') {
      window.__listeningOriginalStartTest = fallbackStartTest;
    }
    window.startTest = runStartTest;

    var startButton = document.querySelector('.start-button');
    if (!startButton || startButton.dataset.fallbackBound === 'true') return;
    if (startButton.getAttribute('onclick')) return;

    startButton.dataset.fallbackBound = 'true';
    startButton.addEventListener('click', function (event) {
      event.preventDefault();
      runStartTest();
    });
  }

  function initFallback() {
    syncStartedScreens();
    revealStartScreen();
    if (isListeningSectionPage) {
      ensureStartHandler();
    }
    window.setTimeout(function () {
      syncStartedScreens();
      revealStartScreen();
      if (isListeningSectionPage) {
        ensureStartHandler();
      }
    }, 3200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFallback);
  } else {
    initFallback();
  }
})();
