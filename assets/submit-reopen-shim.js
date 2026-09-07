/*
 * Submit-button "reopen results" shim
 * -----------------------------------
 * Applies a consistent post-submission UX across every Reading and
 * Listening test on the site:
 *   - Reading full mocks      (#submit-all-btn, label "Submit All")
 *   - Reading passage tests   (#submit-all-btn, label "Submit All")
 *   - Listening full mocks    (#submitBtn,      label "Submit Test")
 *   - Listening section tests (#submitBtn,      label "Submit Test")
 *   - Legacy single pages     (#submit-btn,     label "Submit Test")
 *
 * After the per-test script submits, this shim:
 *   1. Detects submission via disabled state, result modal, or progress event
 *   2. Re-enables the button (on requestAnimationFrame to win the race)
 *   3. Adds an `is-submitted` class + relabels the button "View Result"
 *   4. Intercepts subsequent clicks in capture phase to reopen the results
 *      modal instead of letting them re-trigger submission
 *
 * The shim is idempotent — it only takes over once per button. If the
 * per-test script wraps `submitTest()` differently from what we expect,
 * the only safe fallback is to do nothing (we never *break* submission).
 *
 * Loaded automatically by progress-tracker.js on every page.
 */
(function () {
  'use strict';

  if (window.__ieltsSubmitReopenShim) return;
  window.__ieltsSubmitReopenShim = true;

  // CSS selectors for the button conventions used across tests.
  var BUTTON_SELECTORS = ['#submit-all-btn', '#submitBtn', '#submit-btn'];

  // CSS selectors for the result modals each test convention opens.
  var MODAL_SELECTORS = ['#results-modal', '#resultsModal'];

  function findFirstElement(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function resultsModalEl() {
    return findFirstElement(MODAL_SELECTORS);
  }

  function isResultsModalOpen(modal) {
    if (!modal) return false;
    if (modal.classList.contains('hidden')) return false;
    if (modal.getAttribute('aria-hidden') === 'true') return false;
    var style = window.getComputedStyle ? window.getComputedStyle(modal) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return modal.style.display === 'flex' ||
      modal.classList.contains('show') ||
      modal.classList.contains('is-open') ||
      (style && style.display !== 'none');
  }

  function normalizePath(value) {
    var raw = String(value || '');
    try {
      raw = new URL(raw, window.location.href).pathname;
    } catch (e) {
      raw = raw.split('#')[0].split('?')[0];
    }
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {}
    return raw.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  }

  function currentSection() {
    return /\/listening\//i.test(window.location.pathname) ? 'listening' :
      (/\/reading\//i.test(window.location.pathname) ? 'reading' : '');
  }

  function latestStoredResultForPage() {
    try {
      if (new URLSearchParams(window.location.search || '').get('redo') === '1') return null;
    } catch (e) {}
    if (!window.IELTSProgress || typeof window.IELTSProgress.loadData !== 'function') return null;
    var section = currentSection();
    if (!section) return null;
    var data = window.IELTSProgress.loadData() || {};
    var bucket = data.tests && data.tests[section];
    var results = bucket && Array.isArray(bucket.results) ? bucket.results : [];
    var here = normalizePath(window.location.pathname);
    return results.find(function (entry) {
      return normalizePath(entry && entry.href) === here;
    }) || null;
  }

  function populateResultsModalFromStoredEntry(entry) {
    if (!entry) return;
    var modal = resultsModalEl();
    if (!modal) return;
    var scoreEl = modal.querySelector('#totalScore, #score-display, .score-display');
    if (scoreEl) scoreEl.textContent = String(entry.score) + '/' + String(entry.total);
  }

  function reopenResults() {
    var modal = resultsModalEl();
    if (!modal) return false;
    populateResultsModalFromStoredEntry(latestStoredResultForPage());
    // Different per-test scripts hide via different mechanisms — undo all.
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.classList.add('show', 'is-open');
    modal.removeAttribute('aria-hidden');
    var overlay = document.querySelector('.results-overlay, .modal-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.display = '';
    }
    return true;
  }

  function attachToButton(btn) {
    if (!btn || btn.__ieltsReopenBound) return;
    btn.__ieltsReopenBound = true;

    function hasSubmissionEvidence() {
      // Heuristic 1: button has been disabled (typical post-submit behavior).
      if (btn.disabled) return true;
      // Heuristic 2: we've already taken over.
      if (btn.classList.contains('is-submitted')) return true;
      // Heuristic 3: test scripts expose a submitted flag.
      if (window.testSubmitted || window.__listeningSubmissionObserved || window.__ieltsResultSubmittedThisPage) return true;
      // Heuristic 4: the results modal is open and carries a numeric score.
      // Many tests ship with hidden default text such as "0/40"; that must
      // not turn the first-load button into "View Result".
      var modal = resultsModalEl();
      if (isResultsModalOpen(modal)) {
        var scoreEl = modal.querySelector('#totalScore, #score-display, .score-display');
        if (scoreEl && /\d/.test(scoreEl.textContent || '')) return true;
      }
      return false;
    }

    function applyAffordance() {
      if (btn.classList.contains('is-submitted')) {
        // Already taken over — just make sure the button is clickable.
        if (btn.disabled) reEnableNextFrame();
        return;
      }
      btn.classList.add('is-submitted');
      btn.dataset.originalLabel = btn.textContent || btn.value || 'Submit';
      btn.textContent = 'View Result';
      btn.title = 'Open the results panel from your submitted test';
      btn.addEventListener('click', function (event) {
        if (!hasSubmissionEvidence()) return;     // first click — let it submit
        event.preventDefault();
        event.stopImmediatePropagation();
        reopenResults();
      }, true);
      reEnableNextFrame();
    }

    function checkSoonAfterSubmitClick() {
      [0, 80, 250, 700].forEach(function (delay) {
        setTimeout(function () {
          if (hasSubmissionEvidence()) applyAffordance();
        }, delay);
      });
    }

    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-submitted')) return;
      checkSoonAfterSubmitClick();
    }, false);

    function reEnableNextFrame() {
      // The per-test script disabled the button synchronously inside its
      // submit handler. By the time our observer's microtask fires, the
      // disable has already happened. We schedule the un-disable on the
      // next animation frame to guarantee it runs after the per-test
      // code's full chain of synchronous + microtask work.
      requestAnimationFrame(function () {
        if (!btn.classList.contains('is-submitted')) return;
        btn.disabled = false;
        btn.removeAttribute('disabled');
      });
    }

    if (typeof MutationObserver === 'function') {
      var obs = new MutationObserver(function () {
        if (!hasSubmissionEvidence()) return;
        applyAffordance();
        // If the per-test code re-disables after we re-enable, flip back.
        if (btn.disabled && btn.classList.contains('is-submitted')) reEnableNextFrame();
      });
      obs.observe(btn, { attributes: true, attributeFilter: ['disabled', 'class'] });
    }
    // If the page was loaded into review mode (a previously-submitted
    // attempt being reopened), apply immediately.
    if (hasSubmissionEvidence()) applyAffordance();
  }

  function attachToAllButtons() {
    BUTTON_SELECTORS.forEach(function (sel) {
      var btn = document.querySelector(sel);
      if (btn) attachToButton(btn);
    });
  }

  function init() {
    attachToAllButtons();
    // Late-arriving buttons: some tests render the submit button after a
    // network call. A short retry covers that.
    if (typeof MutationObserver === 'function') {
      var pageObs = new MutationObserver(function () { attachToAllButtons(); });
      pageObs.observe(document.documentElement, { childList: true, subtree: true });
      // Stop watching after 8s to avoid wasted work.
      setTimeout(function () { pageObs.disconnect(); }, 8000);
    }
  }

  document.addEventListener('ielts:test-submitted', function () {
    window.__ieltsResultSubmittedThisPage = true;
    [0, 80, 250].forEach(function (delay) {
      setTimeout(function () {
        BUTTON_SELECTORS.forEach(function (sel) {
          var btn = document.querySelector(sel);
          if (!btn) return;
          btn.__ieltsReopenBound = false;
          attachToButton(btn);
        });
      }, delay);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
