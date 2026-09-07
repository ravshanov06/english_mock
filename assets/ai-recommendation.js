/*
 * IELTS AI Personalized Recommendation Engine
 * -------------------------------------------
 * Rule-based recommendation module for Reading and Listening tests.
 *
 * Input features:
 *   - section ('reading' | 'listening')
 *   - score, total
 *   - per-part scores (Reading: 3 passages, Listening: 4 sections)
 *
 * Output:
 *   - predicted band score
 *   - overall level (beginner / intermediate / advanced)
 *   - per-part weakness diagnosis with advice
 *   - recommended next tests (links inside the site)
 *   - written summary
 *
 * Public API (window.IELTSRecommendation):
 *   compute(section, payload)                -> recommendation object
 *   showModalAfterSubmit(payload, recObject) -> renders + saves
 *   saveLatest(rec)                          -> persists to localStorage
 *   loadHistory()                            -> last N recommendations
 *   loadLatest(section)                      -> last recommendation per section
 *   renderAccountSection(container)          -> renders saved recommendations
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'ielts_ai_recommendations_';
  var STORAGE_VERSION = 1;
  var MAX_HISTORY = 30;

  // ---------- Helpers ----------
  function getEmail() {
    if (window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function') {
      return window.IELTSProgress.getEmail() || 'guest';
    }
    try { return (localStorage.getItem('ielts_user_email') || '').trim().toLowerCase() || 'guest'; }
    catch (e) { return 'guest'; }
  }

  function storageKey() { return STORAGE_PREFIX + getEmail(); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function siteRoot() {
    var path = String(window.location.pathname || '');
    if (/\/(?:Reading|Listening|Writing|Speaking|Books)\//.test(path)) {
      return path.replace(/\/(?:Reading|Listening|Writing|Speaking|Books)\/.*$/, '/');
    }
    return path.replace(/\/[^/]*$/, '/');
  }

  function siteLink(rel) {
    if (window.location.protocol === 'file:') {
      return siteRoot() + rel;
    }
    return '/' + rel.replace(/^\//, '');
  }

  // ---------- Band score estimation (IELTS official scale) ----------
  // Reading and Listening share the same raw-to-band conversion.
  function rawToBand(score) {
    var s = Math.max(0, Math.min(40, Number(score) || 0));
    if (s >= 39) return 9.0;
    if (s >= 37) return 8.5;
    if (s >= 35) return 8.0;
    if (s >= 33) return 7.5;
    if (s >= 30) return 7.0;
    if (s >= 27) return 6.5;
    if (s >= 23) return 6.0;
    if (s >= 19) return 5.5;
    if (s >= 15) return 5.0;
    if (s >= 12) return 4.5;
    if (s >= 9)  return 4.0;
    if (s >= 6)  return 3.5;
    return 3.0;
  }

  function levelFromScore(scoreRatio) {
    if (scoreRatio < 0.5) return 'beginner';
    if (scoreRatio < 0.75) return 'intermediate';
    return 'advanced';
  }

  // ---------- Section labels & next-step targets ----------
  var READING_PARTS = [
    { id: 1, name: 'Passage 1', advice: 'Practice scanning for facts and headings.' },
    { id: 2, name: 'Passage 2', advice: 'Focus on paragraph matching and True/False/Not Given.' },
    { id: 3, name: 'Passage 3', advice: 'Train on advanced academic vocabulary and inference.' }
  ];
  var LISTENING_SECTIONS = [
    { id: 1, name: 'Section 1', advice: 'Form completion practice; daily-life conversations.' },
    { id: 2, name: 'Section 2', advice: 'Map / plan / matching tasks; monologue listening.' },
    { id: 3, name: 'Section 3', advice: 'Academic discussion between 2-3 speakers; multiple choice.' },
    { id: 4, name: 'Section 4', advice: 'University lectures; note-completion and summary.' }
  ];
  // Writing isn't auto-graded — the Writing flow uses the existing
  // IELTSAIWritingFeedback (Grammarly-style review) instead of this
  // recommendation engine.

  // Suggested next-step links on the public site.
  var READING_NEXT_LINKS = {
    beginner: [
      { label: 'Easy reading passages', href: siteLink('reading.html#passage1') },
      { label: 'Books for Reading', href: siteLink('books.html') }
    ],
    intermediate: [
      { label: 'Full reading tests', href: siteLink('reading.html#full') },
      { label: 'Passage 2 practice', href: siteLink('reading.html#passage2') }
    ],
    advanced: [
      { label: 'Challenging Passage 3 tests', href: siteLink('reading.html#passage3') },
      { label: 'Full reading mocks', href: siteLink('reading.html#full') }
    ]
  };
  var LISTENING_NEXT_LINKS = {
    beginner: [
      { label: 'Section 1 practice', href: siteLink('listening.html#section1') },
      { label: 'Vocabulary books', href: siteLink('books.html') }
    ],
    intermediate: [
      { label: 'Section 2 maps & plans', href: siteLink('listening.html#section2') },
      { label: 'Full listening tests', href: siteLink('listening.html#full') }
    ],
    advanced: [
      { label: 'Section 4 lectures', href: siteLink('listening.html#section4') },
      { label: 'Full listening mocks', href: siteLink('listening.html#full') }
    ]
  };

  // ---------- Try to extract part scores from the DOM ----------
  function readReadingParts() {
    var parts = [];
    var breakdown = document.getElementById('score-breakdown');
    if (!breakdown) return null;
    var items = breakdown.querySelectorAll('.score-item');
    if (!items.length) return null;
    items.forEach(function (node, idx) {
      var spans = node.querySelectorAll('span');
      if (spans.length < 2) return;
      var match = String(spans[1].textContent || '').trim().match(/(\d+)\s*\/\s*(\d+)/);
      if (!match) return;
      parts.push({
        id: idx + 1,
        name: 'Passage ' + (idx + 1),
        earned: Number(match[1]),
        total: Number(match[2])
      });
    });
    return parts.length ? parts : null;
  }

  function readListeningParts() {
    var parts = [];
    for (var i = 1; i <= 4; i += 1) {
      var node = document.getElementById('part' + i + 'Score');
      if (!node) continue;
      var match = String(node.textContent || '').trim().match(/(\d+)\s*\/\s*(\d+)/);
      if (!match) continue;
      parts.push({
        id: i,
        name: 'Section ' + i,
        earned: Number(match[1]),
        total: Number(match[2])
      });
    }
    return parts.length ? parts : null;
  }

  function collectPartScores(section) {
    if (section === 'reading') return readReadingParts();
    if (section === 'listening') return readListeningParts();
    return null;
  }

  // ---------- The recommendation algorithm ----------
  function buildSummaryMessage(section, score, total, band, level, weakestPart) {
    var skill = section === 'reading' ? 'Reading' : 'Listening';
    var partLabel = section === 'reading' ? 'passage' : 'section';

    var lvlText = {
      beginner: 'You are at a foundational stage',
      intermediate: 'You are at an intermediate stage',
      advanced: 'You are performing at an advanced level'
    }[level];

    var weakText = '';
    if (weakestPart && weakestPart.total > 0 && weakestPart.earned < weakestPart.total) {
      weakText = ' Your weakest area is <strong>' + escapeHtml(weakestPart.name) +
        '</strong> (' + weakestPart.earned + '/' + weakestPart.total + '). ';
    } else {
      weakText = ' ';
    }

    var direction;
    if (level === 'beginner') {
      direction = 'Focus on easier ' + partLabel + 's, build core vocabulary, and review answers carefully before moving on.';
    } else if (level === 'intermediate') {
      direction = 'Practice timed full ' + skill.toLowerCase() + ' tests and target your weak ' + partLabel + ' with focused drills.';
    } else {
      direction = 'Push toward harder material and refine accuracy and timing on the toughest ' + partLabel + 's.';
    }

    return lvlText + ' in <strong>' + skill + '</strong>. You scored <strong>' +
      score + '/' + total + '</strong> (estimated band <strong>' +
      band.toFixed(1) + '</strong>).' + weakText + direction;
  }

  function buildWeakAreas(section, parts) {
    if (!parts || !parts.length) return [];
    var meta = section === 'reading' ? READING_PARTS : LISTENING_SECTIONS;
    return parts.map(function (p) {
      var ratio = p.total ? p.earned / p.total : 1;
      var matchedMeta = meta.find(function (m) { return m.id === p.id; }) || {};
      var advice;
      var isStrong = ratio >= 0.75;
      if (isStrong) {
        advice = 'Strong area — keep this level.';
      } else if (ratio >= 0.5) {
        advice = matchedMeta.advice || 'Practice this part with similar question types.';
      } else {
        advice = (matchedMeta.advice || 'Practice this part with similar question types.') +
          ' Start with easier material then build up.';
      }
      return {
        id: p.id,
        name: p.name,
        earned: p.earned,
        total: p.total,
        ratio: ratio,
        advice: advice,
        isStrong: isStrong
      };
    });
  }

  function buildRecommendationItems(section, level, weakAreas) {
    var skill = section === 'reading' ? 'Reading' : 'Listening';
    var partWord = section === 'reading' ? 'passage' : 'section';
    var items = [];

    if (level === 'beginner') {
      items.push({
        title: 'Start with foundational ' + skill.toLowerCase() + ' practice',
        description: 'Build core IELTS vocabulary and grammar; complete easier ' + partWord + 's slowly with no time pressure first.'
      });
      items.push({
        title: 'Review every wrong answer',
        description: 'For each missed question, write the correct answer + a one-line reason. This single habit gives the biggest gains at this level.'
      });
    } else if (level === 'intermediate') {
      items.push({
        title: 'Sit timed full ' + skill.toLowerCase() + ' tests',
        description: 'Aim for 2 full mock tests per week under exam timing to lock in pace and stamina.'
      });
      items.push({
        title: 'Target the weakest ' + partWord,
        description: 'Drill the question types that cost you the most marks; consistency on those will move your band up.'
      });
    } else {
      items.push({
        title: 'Refine accuracy on hard ' + partWord + 's',
        description: 'You already have the level — focus on losing fewer marks on tricky question types (e.g. matching headings, multiple choice with paraphrase).'
      });
      items.push({
        title: 'Optimize time per ' + partWord,
        description: 'Time each ' + partWord + ' separately, and try to finish 1-2 minutes ahead to leave buffer for transfer and check.'
      });
    }

    // Add per-weak-area items
    (weakAreas || []).filter(function (w) { return !w.isStrong; }).forEach(function (w) {
      items.push({
        title: 'Practice: ' + w.name,
        description: w.advice
      });
    });

    if (section === 'listening') {
      items.push({
        title: 'Daily dictation practice',
        description: 'Re-listen to one short clip per day and write everything you hear word-for-word. This sharpens spelling and number/date capture.'
      });
    } else {
      items.push({
        title: 'Skim + scan drill',
        description: 'Read one passage in 7 minutes for the main idea, then scan for 10 specific facts in 5 minutes. Repeat 3x weekly.'
      });
    }

    return items;
  }

  function nextLinksFor(section, level) {
    var map = section === 'reading' ? READING_NEXT_LINKS : LISTENING_NEXT_LINKS;
    return (map && map[level]) || [];
  }

  function compute(section, payload) {
    var data = payload || {};
    var score = Number(data.score);
    var total = Number(data.total);
    if (!isFinite(score) || !isFinite(total) || total <= 0) return null;
    if (section !== 'reading' && section !== 'listening') return null;

    var ratio = score / total;
    var band = rawToBand(score);
    var level = levelFromScore(ratio);

    var parts = Array.isArray(data.parts) && data.parts.length ? data.parts : collectPartScores(section);
    var weakAreas = buildWeakAreas(section, parts);

    // Weakest part = lowest ratio with non-zero total. If multiple ties, first.
    var weakest = null;
    (weakAreas || []).forEach(function (w) {
      if (!w.total) return;
      if (!weakest || w.ratio < weakest.ratio) weakest = w;
    });

    var summary = buildSummaryMessage(section, score, total, band, level, weakest);
    var items = buildRecommendationItems(section, level, weakAreas);
    var nextLinks = nextLinksFor(section, level);

    return {
      version: STORAGE_VERSION,
      section: section,
      label: String(data.label || ''),
      test_id: String(data.test_id || ''),
      score: score,
      total: total,
      ratio: ratio,
      band: band,
      level: level,
      summary: summary,
      parts: parts || [],
      weakAreas: weakAreas,
      items: items,
      nextLinks: nextLinks,
      createdAt: new Date().toISOString()
    };
  }

  // ---------- Persistence ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (entry) { return entry && entry.section && entry.createdAt; });
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX_HISTORY)));
    } catch (e) {}
  }

  function saveLatest(rec) {
    if (!rec) return;
    var list = loadHistory();
    list.unshift(rec);
    saveHistory(list);
    try {
      document.dispatchEvent(new CustomEvent('ielts:ai-recommendations-updated', { detail: { rec: rec } }));
    } catch (e) {}
  }

  function loadLatest(section) {
    var list = loadHistory();
    if (!section) return list[0] || null;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].section === section) return list[i];
    }
    return null;
  }

  // ---------- Modal rendering ----------
  function ensureCss() {
    if (document.getElementById('ai-reco-css')) return;
    var link = document.createElement('link');
    link.id = 'ai-reco-css';
    link.rel = 'stylesheet';
    var href;
    if (window.location.protocol === 'file:') {
      href = siteRoot() + 'assets/ai-recommendation.css';
    } else {
      href = '/assets/ai-recommendation.css';
    }
    link.href = href + '?v=20260520-reading-result-actions-62';
    document.head.appendChild(link);
  }

  function buildModalHtml(rec) {
    var skill = rec.section === 'reading' ? 'Reading' : 'Listening';
    var levelClass = rec.level;
    var partWord = rec.section === 'reading' ? 'passage' : 'section';
    // `isWriting` is referenced below from an earlier version of this module
    // that also rendered Writing recommendations. Writing now uses its own
    // panel (writing-results-panel.js + ai-writing-feedback.js) and
    // showModalAfterSubmit() returns early for `section === 'writing'`, but
    // we still define the flag defensively so the labels stay correct if a
    // future caller passes a writing payload.
    var isWriting = rec.section === 'writing';
    var partsHtml = (rec.weakAreas || []).map(function (w) {
      var cls = 'ai-reco-weak-item';
      if (w.isStrong) cls += ' is-strong';
      else if (w.ratio >= 0.5) cls += ' is-mid';
      var pct = w.total ? Math.max(0, Math.min(100, Math.round(w.ratio * 100))) : 0;
      return '<div class="' + cls + '">' +
        '<div class="ai-reco-weak-head">' +
          '<span class="ai-reco-weak-name">' + escapeHtml(w.name) + '</span>' +
          '<span class="ai-reco-weak-score">' + escapeHtml(w.earned) + ' / ' + escapeHtml(w.total) + '</span>' +
        '</div>' +
        '<div class="ai-reco-weak-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="ai-reco-weak-advice">' + escapeHtml(w.advice) + '</div>' +
      '</div>';
    }).join('');

    var itemsHtml = (rec.items || []).map(function (it) {
      return '<li><strong>' + escapeHtml(it.title) + '</strong><span>' + escapeHtml(it.description) + '</span></li>';
    }).join('');

    var linksHtml = (rec.nextLinks || []).map(function (l) {
      return '<a class="ai-reco-next-link" href="' + escapeHtml(l.href) + '">' + escapeHtml(l.label) + '</a>';
    }).join('');

    var levelLabel = rec.level.charAt(0).toUpperCase() + rec.level.slice(1);

    return '' +
      '<div class="ai-reco-card" role="dialog" aria-modal="true" aria-labelledby="aiRecoTitle">' +
        '<div class="ai-reco-head">' +
          '<div class="ai-reco-head-title">' +
            '<div class="ai-reco-head-icon" aria-hidden="true">AI</div>' +
            '<div>' +
              '<h2 id="aiRecoTitle">' + escapeHtml(skill) + ' Recommendations</h2>' +
              '<div class="ai-reco-head-sub">Personalized study plan from your latest test</div>' +
            '</div>' +
          '</div>' +
          '<button class="ai-reco-close" type="button" data-ai-reco-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ai-reco-body">' +
          '<div class="ai-reco-summary">' +
            '<div class="ai-reco-stat">' +
              '<span class="ai-reco-stat-label">' + (isWriting ? 'Words written' : 'Your score') + '</span>' +
              '<span class="ai-reco-stat-value">' + escapeHtml(rec.score) + ' / ' + escapeHtml(rec.total) + '</span>' +
              '<span class="ai-reco-stat-note">' + Math.round(rec.ratio * 100) + '% of ' + (isWriting ? 'target words' : 'correct answers') + '</span>' +
            '</div>' +
            (isWriting ? '' : (
              '<div class="ai-reco-stat">' +
                '<span class="ai-reco-stat-label">Estimated band</span>' +
                '<span class="ai-reco-stat-value">' + rec.band.toFixed(1) + '</span>' +
                '<span class="ai-reco-stat-note">IELTS ' + escapeHtml(skill) + ' band scale</span>' +
              '</div>'
            )) +
            '<div class="ai-reco-stat">' +
              '<span class="ai-reco-stat-label">Your level</span>' +
              '<span class="ai-reco-stat-value"><span class="ai-reco-level-pill ' + escapeHtml(levelClass) + '">' + escapeHtml(levelLabel) + '</span></span>' +
              '<span class="ai-reco-stat-note">Predicted by AI engine</span>' +
            '</div>' +
          '</div>' +
          '<div class="ai-reco-message">' + rec.summary + '</div>' +
          (partsHtml ? (
            '<div>' +
              '<h3 class="ai-reco-section-title">Performance by ' + partWord + '</h3>' +
              '<div class="ai-reco-weak-list">' + partsHtml + '</div>' +
            '</div>'
          ) : '') +
          '<div>' +
            '<h3 class="ai-reco-section-title">Your recommended next steps</h3>' +
            '<ul class="ai-reco-list">' + itemsHtml + '</ul>' +
          '</div>' +
          (linksHtml ? (
            '<div>' +
              '<h3 class="ai-reco-section-title">Suggested practice on this site</h3>' +
              '<div class="ai-reco-next-links">' + linksHtml + '</div>' +
            '</div>'
          ) : '') +
        '</div>' +
        '<div class="ai-reco-foot">' +
          '<button class="ai-reco-btn" type="button" data-ai-reco-close>Close</button>' +
          (isWriting ? '<button class="ai-reco-btn primary" type="button" data-ai-reco-feedback>Open AI Writing Feedback</button>' : '') +
          '<a class="ai-reco-btn ' + (isWriting ? '' : 'primary') + '" href="' + escapeHtml(siteLink('account.html#progress')) + '">Open my account</a>' +
        '</div>' +
        '<p class="ai-reco-disclaimer">These tips are generated automatically from your latest test result.</p>' +
      '</div>';
  }

  function openModal(rec) {
    if (!rec) return;
    ensureCss();
    var modal = document.getElementById('aiRecoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'aiRecoModal';
      modal.className = 'ai-reco-modal';
      modal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modal);
    }
    modal.innerHTML = buildModalHtml(rec);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
      if (event.target && event.target.closest('[data-ai-reco-close]')) close();
      if (event.target && event.target.closest('[data-ai-reco-feedback]')) {
        close();
        if (window.IELTSAIWritingFeedback && typeof window.IELTSAIWritingFeedback.openFeedback === 'function') {
          var getTasks = window.IELTSGetWritingTasks;
          if (typeof getTasks === 'function') {
            window.IELTSAIWritingFeedback.openFeedback({ getTasks: getTasks });
          }
        }
      }
    });

    document.addEventListener('keydown', function escListener(event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        close();
        document.removeEventListener('keydown', escListener);
      }
    });
  }

  // Wait briefly for the test engine to finish writing part scores into the DOM,
  // then compute the recommendation, save it, and inject trigger buttons next
  // to the existing Test Results modal and the persistent header "Back to Menu"
  // link. We deliberately do NOT auto-open the modal — users click a button.
  function showModalAfterSubmit(payload) {
    if (!payload) return;
    var sec = payload.section;
    // Writing intentionally does NOT use the AI recommendation engine — the
    // Writing flow surfaces the existing IELTSAIWritingFeedback (Grammarly-
    // style review) from its own Results panel instead.
    if (sec !== 'reading' && sec !== 'listening') return;
    window.setTimeout(function () {
      var rec = compute(sec, payload);
      if (!rec) return;
      saveLatest(rec);
      injectTriggerButtons(rec);
    }, 250);
  }

  // The current recommendation for this submission, accessible from injected
  // buttons. Updated each time injectTriggerButtons runs.
  var lastRec = null;

  function injectTriggerButtons(rec) {
    lastRec = rec;
    injectModalTrigger(rec);
    injectHeaderTrigger(rec);
  }

  // Insert a trigger button INSIDE the Test Results panel. Handles:
  //   - Reading  (#results-modal — has .modal-buttons row)
  //   - Listening (#resultsModal — has .results-content stack)
  // Writing is handled by the Writing Results Panel (writing-results-panel.js)
  // which shows an "Open AI Writing Feedback" button instead.
  function injectModalTrigger(rec) {
    var modal = document.getElementById('results-modal')
      || document.getElementById('resultsModal');
    if (!modal) return;

    // Reading layout: there's an explicit .modal-buttons row.
    var buttonRow = modal.querySelector('.modal-buttons');
    if (buttonRow) {
      if (buttonRow.querySelector('[data-ai-reco-trigger]')) return;
      var btn = buildTriggerButton(rec, '');
      // Render it as a prominent full-width gradient button on its own row,
      // sitting ABOVE the existing Back to Menu / Close Results buttons —
      // matching the Writing results panel layout.
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.flex = '1 1 100%';
      btn.style.width = '100%';
      btn.style.padding = '12px 18px';
      btn.style.border = '1px solid #2f56b9';
      btn.style.borderRadius = '8px';
      btn.style.background = 'linear-gradient(135deg, #3b6cd6, #6a3fd6)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.style.fontFamily = 'inherit';
      // Allow the row to wrap so the trigger keeps its own line and the
      // other buttons flow underneath it.
      buttonRow.style.flexWrap = 'wrap';
      // Place it as the FIRST item so it's emphasized.
      buttonRow.insertBefore(btn, buttonRow.firstChild);
      return;
    }

    // Listening layout: .results-content holds two buttons stacked. Insert the
    // trigger right BEFORE "Back to Menu" so it lives inside the panel.
    var resultsContent = modal.querySelector('.results-content') || modal.querySelector('.modal-content');
    if (resultsContent) {
      if (resultsContent.querySelector('[data-ai-reco-trigger]')) return;
      var trigger = buildTriggerButton(rec, '');
      // Match the existing button styling roughly.
      trigger.style.display = 'block';
      trigger.style.width = '100%';
      trigger.style.padding = '12px 18px';
      trigger.style.margin = '12px 0 0';
      trigger.style.border = '1px solid #2f56b9';
      trigger.style.borderRadius = '10px';
      trigger.style.background = 'linear-gradient(135deg, #3b6cd6, #6a3fd6)';
      trigger.style.color = '#fff';
      trigger.style.fontWeight = '700';
      trigger.style.cursor = 'pointer';
      trigger.style.fontFamily = 'inherit';
      var scoreSummary = resultsContent.querySelector('.score-summary');
      if (scoreSummary && scoreSummary.parentNode === resultsContent) {
        scoreSummary.insertAdjacentElement('afterend', trigger);
        return;
      }

      var backLink = resultsContent.querySelector('.back-menu-button')
        || resultsContent.querySelector('.btn-secondary')
        || null;
      if (backLink && backLink.parentNode === resultsContent) {
        resultsContent.insertBefore(trigger, backLink);
      } else {
        resultsContent.appendChild(trigger);
      }
    }
  }

  // Insert a trigger button NEXT TO the header "Back to Menu" link
  // (#submittedMenuLink), so the user can still access recommendations after
  // closing the Test Results panel.
  function injectHeaderTrigger(rec) {
    var backLink = document.getElementById('submittedMenuLink');
    if (!backLink) return;
    if (document.getElementById('aiRecoHeaderTrigger')) return;

    var trigger = buildTriggerButton(rec, '');
    trigger.id = 'aiRecoHeaderTrigger';
    // Inline styling so we don't depend on any specific test layout's CSS.
    trigger.style.display = 'inline-flex';
    trigger.style.alignItems = 'center';
    trigger.style.gap = '6px';
    trigger.style.marginRight = '8px';
    trigger.style.padding = '6px 12px';
    trigger.style.border = '1px solid #2f56b9';
    trigger.style.borderRadius = '999px';
    trigger.style.background = 'linear-gradient(135deg, #3b6cd6, #6a3fd6)';
    trigger.style.color = '#fff';
    trigger.style.fontWeight = '700';
    trigger.style.fontSize = '0.85rem';
    trigger.style.cursor = 'pointer';
    trigger.style.fontFamily = 'inherit';
    trigger.style.textDecoration = 'none';

    if (backLink.parentNode) {
      backLink.parentNode.insertBefore(trigger, backLink);
    }
  }

  function buildTriggerButton(rec, className) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-ai-reco-trigger', '1');
    if (className) btn.className = className;
    btn.textContent = 'View AI Recommendations';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      // Always open with the most recent rec so the button keeps working even
      // if the user reopens the page after navigating away.
      openModal(lastRec || loadLatest(rec && rec.section) || rec);
    });
    return btn;
  }

  // ---------- Account-page rendering ----------
  function renderAccountSection(container) {
    if (!container) return;
    ensureCss();
    var history = loadHistory();
    var latestReading = history.find(function (r) { return r.section === 'reading'; });
    var latestListening = history.find(function (r) { return r.section === 'listening'; });

    var cards = [];
    if (latestReading) cards.push(renderAccountCard(latestReading));
    if (latestListening) cards.push(renderAccountCard(latestListening));

    if (!cards.length) {
      container.innerHTML = '<div class="ai-reco-account-card">' +
        '<div class="ai-reco-account-head">' +
          '<h3><span class="ai-reco-tag">AI</span> Personalized recommendations</h3>' +
        '</div>' +
        '<div class="ai-reco-empty">Submit a Reading or Listening test to receive personalized AI recommendations here.</div>' +
      '</div>';
      return;
    }

    container.innerHTML = cards.join('');
  }

  function renderAccountCard(rec) {
    var skill = rec.section === 'reading' ? 'Reading' : 'Listening';
    var when;
    try { when = new Date(rec.createdAt).toLocaleString(); } catch (e) { when = rec.createdAt; }
    var label = rec.label || (skill + ' test');

    var itemsHtml = (rec.items || []).slice(0, 4).map(function (it) {
      return '<div class="ai-reco-account-item">' +
        '<h4>' + escapeHtml(it.title) + '</h4>' +
        '<p>' + escapeHtml(it.description) + '</p>' +
      '</div>';
    }).join('');

    var weakHtml = (rec.weakAreas || []).map(function (w) {
      var cls = 'ai-reco-weak-item';
      if (w.isStrong) cls += ' is-strong';
      else if (w.ratio >= 0.5) cls += ' is-mid';
      var pct = w.total ? Math.max(0, Math.min(100, Math.round(w.ratio * 100))) : 0;
      return '<div class="' + cls + '">' +
        '<div class="ai-reco-weak-head">' +
          '<span class="ai-reco-weak-name">' + escapeHtml(w.name) + '</span>' +
          '<span class="ai-reco-weak-score">' + escapeHtml(w.earned) + ' / ' + escapeHtml(w.total) + '</span>' +
        '</div>' +
        '<div class="ai-reco-weak-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="ai-reco-weak-advice">' + escapeHtml(w.advice) + '</div>' +
      '</div>';
    }).join('');

    var linksHtml = (rec.nextLinks || []).map(function (l) {
      return '<a class="ai-reco-next-link" href="' + escapeHtml(l.href) + '">' + escapeHtml(l.label) + '</a>';
    }).join('');

    return '<div class="ai-reco-account-card">' +
      '<div class="ai-reco-account-head">' +
        '<h3><span class="ai-reco-tag">AI</span> ' + escapeHtml(skill) + ' recommendations</h3>' +
        '<div class="ai-reco-account-meta">' +
          '<span>' + escapeHtml(label) + '</span>' +
          '<span>Score: ' + escapeHtml(rec.score) + '/' + escapeHtml(rec.total) + '</span>' +
          '<span>Band ' + rec.band.toFixed(1) + '</span>' +
          '<span>Level: ' + escapeHtml(rec.level) + '</span>' +
          '<span>' + escapeHtml(when) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ai-reco-message">' + rec.summary + '</div>' +
      (weakHtml ? (
        '<div>' +
          '<h4 class="ai-reco-section-title">Performance by ' + (rec.section === 'reading' ? 'passage' : 'section') + '</h4>' +
          '<div class="ai-reco-weak-list">' + weakHtml + '</div>' +
        '</div>'
      ) : '') +
      (itemsHtml ? (
        '<div>' +
          '<h4 class="ai-reco-section-title">Top suggestions</h4>' +
          '<div class="ai-reco-account-list">' + itemsHtml + '</div>' +
        '</div>'
      ) : '') +
      (linksHtml ? (
        '<div>' +
          '<h4 class="ai-reco-section-title">Suggested practice</h4>' +
          '<div class="ai-reco-next-links">' + linksHtml + '</div>' +
        '</div>'
      ) : '') +
    '</div>';
  }

  // ---------- Auto-hook into trackTestResult ----------
  // progress-tracker.js dispatches a CustomEvent 'ielts:test-submitted' after
  // every successful trackTestResult call. We listen for it here, so individual
  // test scripts don't need to be modified.
  document.addEventListener('ielts:test-submitted', function (event) {
    var detail = event && event.detail;
    if (!detail) return;
    showModalAfterSubmit(detail);
  });

  // ---------- Export ----------
  window.IELTSRecommendation = {
    compute: compute,
    showModalAfterSubmit: showModalAfterSubmit,
    saveLatest: saveLatest,
    loadHistory: loadHistory,
    loadLatest: loadLatest,
    renderAccountSection: renderAccountSection,
    rawToBand: rawToBand
  };
})();
