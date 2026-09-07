(function () {
  if (window.__ieltsGenericAudioPreloadInitialized) return;
  window.__ieltsGenericAudioPreloadInitialized = true;

  function isHandledByDedicatedListeningPreloader() {
    return !!(
      window.__listeningFullStartInProgress !== undefined ||
      window.__listeningSectionStartInProgress !== undefined ||
      window.__listeningFullAudioSequence ||
      window.__listeningSectionProgressInitialized
    );
  }

  function getAudioElement() {
    return document.getElementById('testAudio');
  }

  function getStartButton() {
    return document.querySelector('.start-button');
  }

  function getStartSubtitle() {
    var startScreen = document.getElementById('startScreen');
    return startScreen ? startScreen.querySelector('.start-subtitle') : document.querySelector('.start-subtitle');
  }

  function getAudioSource(audio) {
    if (!audio) return '';
    if (audio.getAttribute('src')) return audio.getAttribute('src');
    var source = audio.querySelector('source[src]');
    if (source) return source.getAttribute('src') || '';
    return audio.currentSrc || '';
  }

  function setPreparingUi(isPreparing, percent) {
    var button = getStartButton();
    var subtitle = getStartSubtitle();
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

  var preparedUrl = '';
  var preparePromise = null;

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

  function applyPreparedUrl(audio) {
    if (!audio || !preparedUrl) return;
    try { audio.pause(); } catch (e) {}
    Array.prototype.forEach.call(audio.querySelectorAll('source'), function (source) {
      source.parentNode.removeChild(source);
    });
    audio.setAttribute('src', preparedUrl);
    try { audio.load(); } catch (e) {}
  }

  function prepareAudio() {
    if (isHandledByDedicatedListeningPreloader()) return Promise.resolve(false);
    if (preparePromise) return preparePromise;
    if (!window.fetch || !window.URL || typeof window.URL.createObjectURL !== 'function') {
      return Promise.resolve(false);
    }

    var audio = getAudioElement();
    var source = getAudioSource(audio);
    if (!audio || !source || /^blob:/i.test(source)) return Promise.resolve(false);

    setPreparingUi(true, 0);
    preparePromise = fetchAudioBlobWithProgress(source, function (fraction) {
        setPreparingUi(true, fraction * 100);
      })
      .then(function (blob) {
        preparedUrl = URL.createObjectURL(blob);
        applyPreparedUrl(audio);
        setPreparingUi(false);
        return true;
      })
      .catch(function () {
        preparePromise = null;
        setPreparingUi(false);
        return false;
      });

    return preparePromise;
  }

  function wrapStartTest() {
    if (typeof window.startTest !== 'function' || window.startTest.__genericAudioPreloadWrapped) return;

    var originalStartTest = window.startTest;
    window.startTest = function () {
      if (window.__genericAudioPreloadStartInProgress) return false;
      window.__genericAudioPreloadStartInProgress = true;
      var context = this;
      var args = arguments;

      return prepareAudio().then(function () {
        return originalStartTest.apply(context, args);
      }).finally(function () {
        window.__genericAudioPreloadStartInProgress = false;
      });
    };

    window.startTest.__genericAudioPreloadWrapped = true;
  }

  window.addEventListener('beforeunload', function () {
    if (preparedUrl) {
      try { URL.revokeObjectURL(preparedUrl); } catch (e) {}
    }
  });

  function init() {
    if (!getAudioElement()) return;
    wrapStartTest();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.setTimeout(init, 300);
})();
