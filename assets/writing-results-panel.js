/*
 * Writing Results Panel
 * ---------------------
 * Listens for `ielts:test-submitted` on Writing pages and shows a results
 * panel with:
 *   - Task 1 / Task 2 / Total word counts
 *   - "Download as PDF" (window.print() with a hidden print-only sheet that
 *     carries an Alkimyogar watermark on every page)
 *   - "View AI Recommendations" (opens the shared AI rec modal)
 *   - "AI Writing Feedback" (opens the Grammarly-style review already on the
 *     page, if loaded)
 *   - "Back to Menu" + "Close"
 *
 * The shared AI recommendation engine (ai-recommendation.js) discovers this
 * modal via #writingResultsModal and injects its own trigger button into the
 * .wr-actions row, so layout-specific knowledge stays here while the
 * cross-section recommendation behaviour stays there.
 */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function getWritingConfig() {
    // The writing-test-engine stores task definitions on window when it
    // initialises, but it doesn't expose them directly. We read the prompt
    // body + textarea + per-task minimums from the DOM as a stable contract.
    var headerTitle = document.getElementById('taskHeaderTitle');
    var headerSubtitle = document.getElementById('taskHeaderSubtitle');
    var testTitle = document.title || '';
    return {
      testTitle: testTitle,
      headerTitle: headerTitle ? headerTitle.textContent : '',
      headerSubtitle: headerSubtitle ? headerSubtitle.textContent : ''
    };
  }

  // The writing engine keeps the user's answers in its own closure. We rely
  // on the payload provided by `ielts:test-submitted` (which includes the
  // answers under detail.answers.task1 / .task2) — see writing-test-engine's
  // submitExam.
  function extractWritingAnswers(payload) {
    var data = (payload && payload.answers) || {};
    return {
      task1: String(data.task1 || ''),
      task2: String(data.task2 || '')
    };
  }

  // Try to pull each task's prompt + image from the visible DOM. We capture
  // the active task's prompt body and rely on a `data-wr-task-prompt`
  // sidecar (set below when the modal first opens) for the other.
  var cachedPrompts = { task1: '', task2: '' };

  function rememberCurrentPrompt() {
    var activeTab = document.querySelector('.bottom-cell.is-active');
    if (!activeTab) return;
    var key = activeTab.id === 'bottomTaskTwo' ? 'task2' : 'task1';
    var promptBody = document.getElementById('promptBody');
    if (promptBody) cachedPrompts[key] = promptBody.innerHTML;
  }

  // Run on every tab change so by submission time both prompts are cached.
  // MutationObserver covers both the initial render (when the user clicks
  // Start) and subsequent Task 1 / Task 2 switches without needing per-test
  // click handlers.
  function bindPromptCapture() {
    rememberCurrentPrompt();
    var promptBody = document.getElementById('promptBody');
    if (promptBody && typeof MutationObserver !== 'undefined') {
      try {
        var obs = new MutationObserver(function () {
          rememberCurrentPrompt();
        });
        obs.observe(promptBody, { childList: true, subtree: false });
      } catch (e) {}
    }
    // Click fallback for environments without MutationObserver.
    ['bottomTaskOne', 'bottomTaskTwo'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        window.setTimeout(rememberCurrentPrompt, 50);
      });
    });
  }

  // ---------- Print sheet ----------
  function ensurePrintSheet() {
    var sheet = document.getElementById('writingPrintSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'writingPrintSheet';
    document.body.appendChild(sheet);
    return sheet;
  }

  function buildPrintSheet(payload) {
    var sheet = ensurePrintSheet();
    var answers = extractWritingAnswers(payload);
    var t1Count = countWords(answers.task1);
    var t2Count = countWords(answers.task2);
    var total = t1Count + t2Count;
    var label = (payload && payload.label) || document.title || 'Writing Test';
    var date = new Date().toLocaleString();
    var prompt1 = cachedPrompts.task1 || '';
    var prompt2 = cachedPrompts.task2 || '';

    var email = (window.IELTSProgress && window.IELTSProgress.getEmail && window.IELTSProgress.getEmail()) || '';

    sheet.innerHTML =
      '<div class="wr-print-header">' +
        '<div class="wr-print-brand">Alkimyogar</div>' +
        '<div class="wr-print-sub">Official Practice Submission &mdash; ' + escapeHtml(label) + '</div>' +
      '</div>' +
      '<div class="wr-print-meta">' +
        '<div><strong>Student:</strong> ' + escapeHtml(email || 'Guest') + '</div>' +
        '<div><strong>Date:</strong> ' + escapeHtml(date) + '</div>' +
        '<div><strong>Total words:</strong> ' + total + ' (Task 1: ' + t1Count + ' / Task 2: ' + t2Count + ')</div>' +
      '</div>' +
      '<section class="wr-print-task">' +
        '<h2>Task 1</h2>' +
        '<div class="wr-print-meta-mini">Target 150 words &mdash; you wrote ' + t1Count + ' words.</div>' +
        (prompt1 ? '<div class="wr-print-prompt">' + prompt1 + '</div>' : '') +
        '<div class="wr-print-essay">' + escapeHtml(answers.task1 || '(No response written.)') + '</div>' +
      '</section>' +
      '<section class="wr-print-task">' +
        '<h2>Task 2</h2>' +
        '<div class="wr-print-meta-mini">Target 250 words &mdash; you wrote ' + t2Count + ' words.</div>' +
        (prompt2 ? '<div class="wr-print-prompt">' + prompt2 + '</div>' : '') +
        '<div class="wr-print-essay">' + escapeHtml(answers.task2 || '(No response written.)') + '</div>' +
      '</section>' +
      '<div class="wr-print-footer">' +
        'Generated from ieltsmaterials.uz &mdash; Alkimyogar &copy; ' + new Date().getFullYear() +
      '</div>';
    return sheet;
  }

  function triggerPdfDownload(payload) {
    buildPrintSheet(payload);
    // Let the browser pick up the @media print rules and prompt "Save as PDF".
    window.print();
  }

  // The writing engine used to mount the AI Writing Feedback launcher itself;
  // we now call openFeedback directly with a self-built getTasks payload that
  // mirrors the engine's `getAITaskPayload` shape.
  function openWritingFeedback() {
    if (!window.IELTSAIWritingFeedback || typeof window.IELTSAIWritingFeedback.openFeedback !== 'function') return;
    var payload = latestPayload || {};
    var answers = extractWritingAnswers(payload);
    var label = payload.label || document.title || 'Writing Test';
    window.IELTSAIWritingFeedback.openFeedback({
      getTasks: function () {
        return [
          { label: 'Task 1 — ' + label, target: 150, text: answers.task1 || '' },
          { label: 'Task 2 — ' + label, target: 250, text: answers.task2 || '' }
        ];
      }
    });
  }

  // ---------- Results modal ----------
  // The latest payload, captured at submission time, so the persistent header
  // button can re-open the modal later without needing the original event.
  var latestPayload = null;

  function ensureModal() {
    var modal = document.getElementById('writingResultsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'writingResultsModal';
    modal.className = 'wr-modal';
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
    // Attach listeners ONCE, here at creation time, so reopening the modal
    // doesn't stack handlers.
    modal.addEventListener('click', function (event) {
      var target = event.target.closest('[data-wr-action]');
      if (!target) {
        if (event.target === modal) closeModal();
        return;
      }
      var action = target.getAttribute('data-wr-action');
      if (action === 'pdf') {
        triggerPdfDownload(latestPayload);
      } else if (action === 'close') {
        closeModal();
      } else if (action === 'feedback') {
        closeModal();
        openWritingFeedback();
      }
      // "menu" is a real <a>, default navigation handles it.
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
    return modal;
  }

  function openModal(payload) {
    if (payload) latestPayload = payload;
    var modal = ensureModal();
    var answers = extractWritingAnswers(latestPayload || {});
    var t1 = countWords(answers.task1);
    var t2 = countWords(answers.task2);
    var total = t1 + t2;
    var label = (latestPayload && latestPayload.label) || 'Writing Test';

    modal.innerHTML = '' +
      '<div class="wr-card" role="dialog" aria-modal="true" aria-labelledby="wrTitle">' +
        '<div class="wr-head">' +
          '<h2 id="wrTitle">Test Results</h2>' +
          '<div class="wr-head-sub">' + escapeHtml(label) + '</div>' +
        '</div>' +
        '<div class="wr-summary">' +
          '<div class="wr-cell"><div class="wr-cell-value">' + t1 + '</div><div class="wr-cell-label">Task 1 words</div></div>' +
          '<div class="wr-cell"><div class="wr-cell-value">' + t2 + '</div><div class="wr-cell-label">Task 2 words</div></div>' +
          '<div class="wr-cell"><div class="wr-cell-value">' + total + '</div><div class="wr-cell-label">Total words</div></div>' +
        '</div>' +
        '<div class="wr-body">' +
          '<p class="wr-question">Would you like to download a PDF copy of your submission?</p>' +
        '</div>' +
        '<div class="wr-actions">' +
          '<button type="button" class="wr-btn wr-btn-pdf" data-wr-action="pdf">' +
            '<i class="fas fa-file-pdf" aria-hidden="true"></i> Download as PDF' +
          '</button>' +
          '<button type="button" class="wr-btn wr-btn-feedback" data-wr-action="feedback">' +
            '<i class="fas fa-pen-fancy" aria-hidden="true"></i> Open AI Writing Feedback' +
          '</button>' +
          '<a class="wr-btn wr-btn-secondary" href="../writing.html" data-wr-action="menu">' +
            '<i class="fas fa-arrow-left" aria-hidden="true"></i> Back to Menu' +
          '</a>' +
          '<button type="button" class="wr-btn wr-btn-close" data-wr-action="close">Close Results</button>' +
        '</div>' +
      '</div>';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    var modal = document.getElementById('writingResultsModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ---------- Persistent header button ----------
  // After the panel is closed, the user still needs a way to open the
  // Grammarly-style AI Writing Feedback. We inject a purple gradient pill
  // next to the existing "Back to Menu" link (matching the Reading/Listening
  // AI button styling).
  function injectHeaderTrigger(payload) {
    var backLink = document.getElementById('submittedMenuLink');
    if (!backLink) return;
    if (document.getElementById('wrHeaderTrigger')) return;
    var btn = document.createElement('button');
    btn.id = 'wrHeaderTrigger';
    btn.type = 'button';
    btn.textContent = 'Open AI Writing Feedback';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '6px';
    btn.style.marginRight = '8px';
    btn.style.padding = '6px 14px';
    btn.style.border = '1px solid #3b6cd6';
    btn.style.borderRadius = '999px';
    btn.style.background = 'linear-gradient(135deg, #3b6cd6, #6a3fd6)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '700';
    btn.style.fontSize = '0.85rem';
    btn.style.cursor = 'pointer';
    btn.style.fontFamily = 'inherit';
    btn.style.boxShadow = '0 4px 10px rgba(58, 64, 178, 0.28)';
    btn.addEventListener('click', function () {
      if (payload) latestPayload = payload;
      openWritingFeedback();
    });
    backLink.parentNode.insertBefore(btn, backLink);
  }

  // ---------- Boot ----------
  function init() {
    bindPromptCapture();
    document.addEventListener('ielts:test-submitted', function (event) {
      var detail = event && event.detail;
      if (!detail || detail.section !== 'writing') return;
      // Augment the payload with task-level word counts so the AI engine can
      // compute weak areas without having to dig into draft answers.
      var answers = extractWritingAnswers(detail);
      detail.task1Words = countWords(answers.task1);
      detail.task2Words = countWords(answers.task2);
      // Give the writing engine a beat to enter review mode (which unhides
      // #submittedMenuLink), then show panel + inject header trigger.
      window.setTimeout(function () {
        openModal(detail);
        injectHeaderTrigger(detail);
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.IELTSWritingResultsPanel = {
    open: openModal,
    close: closeModal,
    downloadPdf: triggerPdfDownload
  };
})();
