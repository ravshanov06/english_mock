(function () {
  if (window.__ieltsHighlightPersistenceInstalled) return;
  window.__ieltsHighlightPersistenceInstalled = true;

  var STORAGE_PREFIX = 'ielts_highlights_v1:';
  var STYLE_ID = 'ielts-highlight-stability-style';
  var SAVE_DELAY = 100;
  var RESTORE_DELAYS = [120, 420, 1000];
  var lastSelectionRange = null;
  var activeHighlight = null;
  var saveTimer = null;
  var restoreTimer = null;
  var isRestoring = false;

  function injectStableHighlightCss() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.highlight{display:inline!important;margin:0!important;padding:0!important;',
      'line-height:inherit!important;vertical-align:baseline!important;',
      'box-decoration-break:clone;-webkit-box-decoration-break:clone;}',
      '.highlight *{color:inherit!important;}',
      'td:has(input[type="radio"]),th:has(input[type="radio"]){cursor:pointer;}'
    ].join('');
    document.head.appendChild(style);
  }

  function normalizePath(pathname) {
    var value = String(pathname || '');
    try {
      value = decodeURIComponent(value);
    } catch (e) {}
    return value.replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
  }

  function getBaseStorageKey() {
    return STORAGE_PREFIX + normalizePath(window.location.pathname);
  }

  function getAttemptStorageKey(attemptId) {
    return getBaseStorageKey() + ':attempt:' + String(attemptId || '');
  }

  function getStorageKeys() {
    var base = getBaseStorageKey();
    var keys = [base];
    try {
      var params = new URLSearchParams(window.location.search || '');
      var attempt = params.get('attempt');
      if (attempt) keys.unshift(base + ':attempt:' + attempt);
    } catch (e) {}
    return keys;
  }

  function getSearchParams() {
    try {
      return new URLSearchParams(window.location.search || '');
    } catch (e) {
      return null;
    }
  }

  function isRedoMode() {
    var params = getSearchParams();
    return !!(params && params.get('redo') === '1');
  }

  function isSavedReviewMode() {
    var params = getSearchParams();
    return !!(params && params.get('attempt') && params.get('redo') !== '1');
  }

  function clearSavedHighlights() {
    getStorageKeys().forEach(function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
  }

  function readSavedHighlights() {
    var keys = getStorageKeys();
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      } catch (e) {}
    }
    return [];
  }

  function writeSavedHighlights(items) {
    var payload = JSON.stringify({
      updatedAt: new Date().toISOString(),
      items: items || []
    });
    getStorageKeys().forEach(function (key) {
      try {
        localStorage.setItem(key, payload);
      } catch (e) {}
    });
  }

  function saveAttemptHighlightSnapshot(attemptId) {
    if (!attemptId) return;
    var payload = JSON.stringify({
      updatedAt: new Date().toISOString(),
      items: collectHighlights()
    });
    try {
      localStorage.setItem(getAttemptStorageKey(attemptId), payload);
    } catch (e) {}
  }

  function clearCurrentHighlights() {
    try {
      localStorage.removeItem(getBaseStorageKey());
    } catch (e) {}
    unwrapAllHighlights();
  }

  function isElementSkipped(element) {
    if (!element || element.nodeType !== 1) return false;
    return !!element.closest([
      'script',
      'style',
      'noscript',
      'input',
      'textarea',
      'select',
      'button',
      'audio',
      'video',
      'canvas',
      'svg',
      '#highlight-btn',
      '#remove-highlight-btn',
      '#selection-menu',
      '.selection-menu',
      '.answer-feedback',
      '.answer-indicator',
      '.results-modal',
      '.modal',
      '.loading-screen',
      '.start-screen'
    ].join(','));
  }

  function getStableRoot(node) {
    var element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    if (!element) return document.body;
    var selector = [
      '[data-highlight-root]',
      '[id^="p"][id$="_passagePanel"]',
      '[id^="p"][id$="_questionsPanel"]',
      '#passagePanel',
      '#questionsPanel',
      '.passage-content[id]',
      '.passage-container[id]',
      '.questions-container[id]',
      '[id^="part"][id$="Content"]',
      '#testInterface',
      '#testContainer'
    ].join(',');
    return element.closest(selector) || document.body;
  }

  function getRootKey(root) {
    return root && root.id ? root.id : '__body__';
  }

  function getRootByKey(key) {
    if (!key || key === '__body__') return document.body;
    return document.getElementById(key);
  }

  function collectTextNodes(root) {
    var nodes = [];
    if (!root) return nodes;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (isElementSkipped(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function getHighlightOffsets(root, highlight) {
    var nodes = collectTextNodes(root);
    var offset = 0;
    var start = null;
    var end = null;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var length = node.nodeValue.length;
      if (highlight.contains(node)) {
        if (start === null) start = offset;
        end = offset + length;
      }
      offset += length;
    }
    if (start === null || end === null || end <= start) return null;
    return { start: start, end: end };
  }

  function collectHighlights() {
    var items = [];
    document.querySelectorAll('span.highlight').forEach(function (highlight) {
      var text = highlight.textContent || '';
      if (!text) return;
      var root = getStableRoot(highlight);
      var offsets = getHighlightOffsets(root, highlight);
      if (!offsets) return;
      items.push({
        root: getRootKey(root),
        start: offsets.start,
        end: offsets.end,
        text: text
      });
    });
    return items;
  }

  function saveHighlights(forceEmpty) {
    if (isRestoring) return;
    var items = collectHighlights();
    if (!items.length && !forceEmpty) return;
    writeSavedHighlights(items);
  }

  function scheduleSave(forceEmpty) {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      saveHighlights(!!forceEmpty);
    }, SAVE_DELAY);
  }

  function unwrapHighlight(highlight) {
    if (!highlight || !highlight.parentNode) return;
    var parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
    parent.normalize();
  }

  function unwrapAllHighlights() {
    Array.prototype.slice.call(document.querySelectorAll('span.highlight')).forEach(unwrapHighlight);
  }

  function getBoundary(root, offset) {
    var nodes = collectTextNodes(root);
    var seen = 0;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var next = seen + node.nodeValue.length;
      if (offset <= next) {
        return {
          node: node,
          offset: Math.max(0, Math.min(node.nodeValue.length, offset - seen))
        };
      }
      seen = next;
    }
    return null;
  }

  function getRootText(root) {
    return collectTextNodes(root).map(function (node) {
      return node.nodeValue;
    }).join('');
  }

  function findRestorableOffsets(root, item) {
    var fullText = getRootText(root);
    var start = Number(item.start) || 0;
    var end = Number(item.end) || start;
    var text = String(item.text || '');
    if (!text) return null;

    if (fullText.slice(start, end) !== text) {
      var nearStart = Math.max(0, start - 80);
      var near = fullText.indexOf(text, nearStart);
      if (near === -1 || near > start + 160) near = fullText.indexOf(text);
      if (near === -1) return null;
      start = near;
      end = near + text.length;
    }

    if (end <= start) return null;
    return { start: start, end: end };
  }

  function wrapTextNodePortion(node, startOffset, endOffset) {
    if (!node || !node.parentNode || endOffset <= startOffset) return null;
    var selected = node;
    if (endOffset < selected.nodeValue.length) selected.splitText(endOffset);
    if (startOffset > 0) selected = selected.splitText(startOffset);
    if (!selected.nodeValue) return null;

    var span = document.createElement('span');
    span.className = 'highlight';
    selected.parentNode.insertBefore(span, selected);
    span.appendChild(selected);
    return span;
  }

  function applyRangeHighlight(range) {
    if (!range || range.collapsed) return false;
    var rootNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isElementSkipped(node.parentElement)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest('.highlight')) return NodeFilter.FILTER_REJECT;
        try {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch (e) {
          return NodeFilter.FILTER_REJECT;
        }
      }
    });

    var segments = [];
    var node = walker.nextNode();
    while (node) {
      var startOffset = 0;
      var endOffset = node.nodeValue.length;
      try {
        while (startOffset < node.nodeValue.length && range.comparePoint(node, startOffset) === -1) startOffset++;
        while (endOffset > startOffset && range.comparePoint(node, endOffset) === 1) endOffset--;
      } catch (e) {
        node = walker.nextNode();
        continue;
      }
      if (endOffset > startOffset) {
        segments.push({ node: node, start: startOffset, end: endOffset });
      }
      node = walker.nextNode();
    }

    for (var i = segments.length - 1; i >= 0; i--) {
      wrapTextNodePortion(segments[i].node, segments[i].start, segments[i].end);
    }
    return segments.length > 0;
  }

  function restoreOne(root, item) {
    var offsets = findRestorableOffsets(root, item);
    if (!offsets) return;
    var start = getBoundary(root, offsets.start);
    var end = getBoundary(root, offsets.end);
    if (!start || !end || !start.node || !end.node) return;

    var range = document.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      applyRangeHighlight(range);
    } catch (e) {}
  }

  function restoreHighlights() {
    var items = readSavedHighlights();
    if (!items.length) return;
    isRestoring = true;
    try {
      unwrapAllHighlights();
      items.slice().sort(function (a, b) {
        if (a.root === b.root) return (Number(b.start) || 0) - (Number(a.start) || 0);
        return String(a.root || '').localeCompare(String(b.root || ''));
      }).forEach(function (item) {
        var root = getRootByKey(item.root);
        if (root) restoreOne(root, item);
      });
    } finally {
      isRestoring = false;
    }
  }

  function scheduleRestore() {
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(restoreHighlights, 80);
  }

  function runReviewRestores() {
    RESTORE_DELAYS.forEach(function (delay) {
      window.setTimeout(restoreHighlights, delay);
    });
  }

  function isReviewLikeState() {
    if (document.body && document.body.classList.contains('listening-review-active')) return true;
    if (document.body && document.body.classList.contains('reading-review-active')) return true;
    var submittedLink = document.getElementById('submittedMenuLink');
    if (submittedLink && getComputedStyle(submittedLink).display !== 'none') return true;
    var submitBtn = document.getElementById('submitBtn') || document.getElementById('submit-all-btn');
    if (submitBtn && submitBtn.disabled) return true;
    if (isSavedReviewMode()) return true;
    return false;
  }

  function isSubmitOrReviewControl(target) {
    var element = target && target.closest ? target.closest('button, a, input[type="button"], input[type="submit"]') : null;
    if (!element) return false;
    var id = String(element.id || '').toLowerCase();
    var text = String(element.textContent || element.value || '').toLowerCase();
    return id === 'submitbtn' ||
      id === 'submit-all-btn' ||
      id === 'review-answers' ||
      id === 'reviewanswers' ||
      /submit/.test(id) ||
      /submit/.test(text) ||
      /review/.test(id) ||
      /review/.test(text);
  }

  function getValidSelectionRange() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    var range = selection.getRangeAt(0);
    if (!range || range.collapsed) return null;
    if (isElementSkipped(range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement)) return null;
    return range.cloneRange();
  }

  function rememberSelection() {
    var range = getValidSelectionRange();
    if (range) lastSelectionRange = range;
  }

  function bindControls() {
    var highlightBtn = document.getElementById('highlight-btn');
    var removeBtn = document.getElementById('remove-highlight-btn');

    document.addEventListener('selectionchange', function () {
      window.requestAnimationFrame(rememberSelection);
    });
    document.addEventListener('mouseup', rememberSelection, true);
    document.addEventListener('keyup', rememberSelection, true);

    document.addEventListener('click', function (event) {
      var highlight = event.target && event.target.closest ? event.target.closest('span.highlight') : null;
      if (highlight) activeHighlight = highlight;

      if (isSubmitOrReviewControl(event.target)) {
        saveHighlights(false);
        runReviewRestores();
      }
    }, true);

    if (highlightBtn) {
      highlightBtn.addEventListener('click', function (event) {
        var range = getValidSelectionRange() || lastSelectionRange;
        if (!range) return;
        if (applyRangeHighlight(range)) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          if (window.getSelection) window.getSelection().removeAllRanges();
          lastSelectionRange = null;
          highlightBtn.style.display = 'none';
          scheduleSave(false);
        }
      }, true);
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function (event) {
        var target = activeHighlight;
        if (!target || !document.body.contains(target)) {
          var selection = window.getSelection ? window.getSelection() : null;
          if (selection && selection.anchorNode) {
            var anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
            target = anchor && anchor.closest ? anchor.closest('span.highlight') : null;
          }
        }
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        unwrapHighlight(target);
        activeHighlight = null;
        removeBtn.style.display = 'none';
        scheduleSave(true);
      }, true);
    }
  }

  function bindRadioTableCells() {
    document.addEventListener('click', function (event) {
      if (!event.target || event.defaultPrevented) return;
      if (event.button !== 0) return;

      var clickedElement = event.target.closest ? event.target.closest('input, label, a, button, select, textarea') : null;
      if (clickedElement) return;

      var cell = event.target.closest ? event.target.closest('td, th') : null;
      if (!cell) return;

      var radio = cell.querySelector('input[type="radio"]');
      if (!radio || radio.disabled) return;

      radio.click();
    }, false);
  }

  function bindMutationGuard() {
    if (typeof MutationObserver !== 'function' || !document.body) return;
    var observer = new MutationObserver(function () {
      if (isRestoring) return;
      if (document.querySelector('span.highlight')) {
        scheduleSave(false);
        return;
      }
      if (isReviewLikeState() && readSavedHighlights().length) {
        scheduleRestore();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    injectStableHighlightCss();
    if (isRedoMode()) {
      clearSavedHighlights();
      unwrapAllHighlights();
    }
    bindControls();
    bindRadioTableCells();
    bindMutationGuard();
    document.addEventListener('ielts:test-submitted', function (event) {
      var detail = event && event.detail ? event.detail : {};
      saveHighlights(true);
      saveAttemptHighlightSnapshot(detail.attempt_id);
    });
    if (isReviewLikeState()) {
      window.setTimeout(restoreHighlights, 50);
    }
    window.addEventListener('beforeunload', function () {
      saveHighlights(false);
    });
  }

  window.IELTSHighlightPersistence = {
    save: saveHighlights,
    restore: restoreHighlights,
    saveAttempt: saveAttemptHighlightSnapshot,
    clearCurrent: clearCurrentHighlights
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
