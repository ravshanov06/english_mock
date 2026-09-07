
        /* ========= CONFIG ========= */
        const PARTS = [
            { id: 1, title: 'Passage 3', qStart: 27, qEnd: 40, passagePanel: 'p1_passagePanel', questionsPanel: 'p1_questionsPanel' },
        ];

        /* ======= ANSWER KEY ======= */
        const correctAnswers = {
            q27: "D",
            q28: "G",
            q29: "A",
            q30: "E",
            q31: "B",
            q32: "F",
            q33: "HUMAN BEING",
            q34: "THREE CARDS",
            q35: "SPECIFIC FAMILIAR PATH",
            q36: "MENTAL WALK",
            q37: "B",
            q38: "C",
            q39: "E",
            q40: "D"
        };

        /* ========= STATE ========= */
        let currentPart = 1;
        let currentQuestion = 27;
        let seconds = 60 * 60;
        let timerInterval;
        let selectedContrast = 'normal';
        let selectedTextSize = 'medium';
        const TEST_STORAGE_ID = 'reading_reading_passage_3s_passage_3_10';
        const TEST_LABEL = 'Passage 3.10';
        const LEGACY_ANSWER_STORAGE_PREFIX = 'ielts_saved_answers_';
        const SEARCH_PARAMS = new URLSearchParams(window.location.search);
        const ATTEMPT_QUERY_ID = SEARCH_PARAMS.get('attempt') || '';
        const REDO_QUERY = SEARCH_PARAMS.get('redo') === '1';
        /* ========= HELPERS ========= */
        function el(id) { return document.getElementById(id); }
        function inRange(q, pId) { const p = PARTS[pId - 1]; return q >= p.qStart && q <= p.qEnd; }
                function collectCurrentAnswers() {
            const saved = {};
            const firstQuestion = PARTS[0].qStart;
            const maxQ = PARTS[PARTS.length - 1].qEnd;
            for (let q = firstQuestion; q <= maxQ; q++) {
                const key = `q${q}`;
                const radios = document.querySelectorAll(`input[name="${key}"][type="radio"]`);
                const text = document.querySelector(`input[name="${key}"][type="text"]`);
                const sel = document.querySelector(`select[name="${key}"]`);
                const cbs = document.querySelectorAll(`input[name="${key}"][type="checkbox"]`);

                if (document.querySelector(`.drop-zone[data-target="${key}"]`)) {
                    if (text && text.value.trim()) saved[key] = text.value.trim();
                } else if (radios.length) {
                    const checked = Array.from(radios).find((r) => r.checked);
                    if (checked) saved[key] = checked.value;
                } else if (cbs.length) {
                    const values = Array.from(cbs).filter((cb) => cb.checked).map((cb) => cb.value).sort();
                    if (values.length) saved[key] = values.join(',');
                } else if (text && text.value.trim()) {
                    saved[key] = text.value.trim();
                } else if (sel && sel.value) {
                    saved[key] = sel.value;
                }
            }
            return saved;
        }
        function getLegacySavedAnswersKey() {
            const email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function'
                ? window.IELTSProgress.getEmail()
                : '';
            return LEGACY_ANSWER_STORAGE_PREFIX + (email || 'guest') + '_' + TEST_STORAGE_ID;
        }
        function persistCurrentAnswers() {
            if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
                window.IELTSProgress.saveDraft(TEST_STORAGE_ID, collectCurrentAnswers());
            } else {
                try {
                    localStorage.setItem(getLegacySavedAnswersKey(), JSON.stringify(collectCurrentAnswers()));
                } catch (e) {}
            }
        }
        function restoreReadingDropZone(questionName, answerValue) {
            const zone = document.querySelector(`.drop-zone[data-target="${questionName}"]`);
            if (!zone || !answerValue) return;
            const item = Array.from(document.querySelectorAll('.drag-item')).find((node) =>
                (node.dataset.answer || node.dataset.option || '').toUpperCase() === String(answerValue).toUpperCase()
            );
            if (!item) return;
            zone.dataset.option = item.dataset.option || answerValue;
            zone.dataset.value = item.dataset.option || answerValue;
            zone.textContent = item.dataset.label ? `${item.dataset.answer || answerValue} ${item.dataset.label}` : (item.dataset.answer || answerValue);
            zone.classList.add('filled');
            zone.draggable = true;
            item.dataset.used = 'true';
            item.classList.add('used');
            item.draggable = false;
            const input = document.querySelector(`input[name="${questionName}"]`);
            if (input) {
                input.value = item.dataset.answer || answerValue;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        function restoreSavedAnswers() {
            var stored = {};
            if (window.IELTSProgress && typeof window.IELTSProgress.loadDraft === 'function') {
                if (ATTEMPT_QUERY_ID) {
                    stored = window.IELTSProgress.loadDraft(ATTEMPT_QUERY_ID) || {};
                }
                if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
                    stored = window.IELTSProgress.loadDraft(TEST_STORAGE_ID) || {};
                }
            }
            if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
                try {
                    stored = JSON.parse(localStorage.getItem(getLegacySavedAnswersKey()) || '{}') || {};
                } catch (e) {
                    stored = {};
                }
                if (stored && Object.keys(stored).length && window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
                    window.IELTSProgress.saveDraft(TEST_STORAGE_ID, stored);
                }
            }
            Object.keys(stored).forEach((key) => {
                const value = stored[key];
                if (value == null || value === '') return;
                const zone = document.querySelector(`.drop-zone[data-target="${key}"]`);
                if (zone) {
                    restoreReadingDropZone(key, value);
                    return;
                }
                const radios = document.querySelectorAll(`input[name="${key}"]:not([type="checkbox"])`);
                if (radios.length && radios[0].type === 'radio') {
                    const match = Array.from(radios).find((r) => String(r.value) === String(value));
                    if (match) {
                        match.checked = true;
                        match.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    return;
                }
                const cbs = document.querySelectorAll(`input[name="${key}"][type="checkbox"]`);
                if (cbs.length) {
                    const selected = String(value).split(',').map((part) => part.trim()).filter(Boolean);
                    cbs.forEach((cb) => {
                        cb.checked = selected.includes(cb.value);
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                    return;
                }
                const text = document.querySelector(`input[name="${key}"]:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), textarea[name="${key}"], input[name="${key}"]`);
                if (text && text.type !== 'hidden') {
                    text.value = value;
                    text.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
                const hidden = document.querySelector(`input[name="${key}"]`);
                if (hidden) {
                    hidden.value = value;
                    hidden.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
                const select = document.querySelector(`select[name="${key}"]`);
                if (select) {
                    select.value = value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        /* ======= BOTTOM TABS + PER-PART NUMBER RAILS ======= */
        function renderBottomTabs() {
            const tabs = el('bottomPartTabs');
            tabs.innerHTML = '';
            PARTS.forEach(p => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary';
                btn.style.fontWeight = (p.id === currentPart) ? '900' : '600';
                btn.innerHTML = (p.id === currentPart) ? `<strong>${p.title}</strong>` : `${p.title}`;
                btn.onclick = () => switchPart(p.id);
                tabs.appendChild(btn);

                const rail = document.createElement('div');
                rail.id = `rail-part-${p.id}`;
                rail.style.display = (p.id === currentPart) ? 'flex' : 'none';
                rail.style.gap = '6px';
                rail.style.flexWrap = 'wrap';
                rail.style.alignItems = 'center';
                const total = p.qEnd - p.qStart + 1;
                for (let q = p.qStart; q <= p.qEnd; q++) {
                    const chip = document.createElement('div');
                    chip.textContent = q;
                    chip.className = 'progress-item' + (q === currentQuestion && p.id === currentPart ? ' current' : '');
                    chip.dataset.question = q;
                    chip.style.width = '30px'; chip.style.height = '20px'; chip.style.borderRadius = '6px';
                    chip.style.fontSize = '14px'; chip.style.padding = '0'; chip.style.lineHeight = '20px';
                    chip.onclick = () => scrollToQuestion(q);
                    rail.appendChild(chip);
                }
                tabs.appendChild(rail);
            });
        }

        function refreshBottomBar() { renderBottomTabs(); }

        function normalizeMcqGroups() {
            document.querySelectorAll('.question-group').forEach(group => {
                const directPs = Array.from(group.children).filter(node => node.tagName === 'P');
                const instructionText = directPs.map(p => p.textContent.trim()).join(' ');
                if (/Choose the correct answer\./i.test(instructionText)) {
                    group.classList.add('mcq-group');
                }
            });
        }


function normalizeSummaryGroups() {
    document.querySelectorAll('.question-group').forEach(group => {
        const directPs = Array.from(group.children).filter(node => node.tagName === 'P');
        const instructionText = directPs.map(p => p.textContent.trim()).join(' ');
        if (/Complete the summary/i.test(instructionText)) {
            group.classList.add('summary-group');
        }
    });
}
        function switchPart(partId) {
            if (currentPart === partId) return;
            PARTS.forEach(p => {
                el(p.passagePanel).classList.add('hidden');
                el(p.questionsPanel).classList.add('hidden');
                const r = el(`rail-part-${p.id}`); if (r) r.style.display = 'none';
            });
            currentPart = partId;
            const p = PARTS[currentPart - 1];
            currentQuestion = p.qStart;
            el(p.passagePanel).classList.remove('hidden');
            el(p.questionsPanel).classList.remove('hidden');
            const r = el(`rail-part-${p.id}`); if (r) r.style.display = 'flex';
            el('headerPassageTitle').textContent = `Passage ${currentPart} of ${PARTS.length}`;
            scrollToQuestion(currentQuestion, false);
            refreshBottomBar();
        }

        function scrollToQuestion(num, smooth = true) {
            const anchor = document.querySelector(`[data-question-anchor="${num}"]`);
            const elQ = anchor || document.querySelector(`[data-question="${num}"]`) ||
                document.querySelector(`input[name="q${num}"]`) ||
                document.querySelector(`select[name="q${num}"]`);
            if (elQ) elQ.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
            updateCurrentQuestion(num);
        }

        function updateCurrentQuestion(num) {
            currentQuestion = num;
            document.querySelectorAll(`#rail-part-${currentPart} .progress-item`).forEach(it => {
                it.classList.toggle('current', parseInt(it.dataset.question, 10) === num);
            });
        }

        function attachAnsweredListeners() {
            document.querySelectorAll('input[type="radio"], input[type="text"], select, input[type="checkbox"]').forEach(input => {
                input.addEventListener('change', () => {
                    const m = input.name && input.name.match(/^q(\d+)$/);
                    if (!m) return;
                    const q = parseInt(m[1], 10);
                    const chip = document.querySelector(`.progress-item[data-question="${q}"]`);
                    if (chip) {
                        let val = '';
                        if (input.type === 'text') val = input.value.trim();
                        else if (input.type === 'checkbox') {
                            const checked = Array.from(document.querySelectorAll(`input[name="${input.name}"]:checked`)).map(cb => cb.value);
                            val = checked.length > 0 ? checked.join(',') : '';
                        } else val = input.value;
                        if (val) chip.classList.add('answered');
                    }
                });
            });
        }

        function createAnchors() {
            for (let q = PARTS[0].qStart; q <= PARTS[PARTS.length - 1].qEnd; q++) {
                if (document.querySelector(`[data-question-anchor="${q}"]`)) continue;
                const target = document.querySelector(`[data-question="${q}"]`) ||
                    document.querySelector(`input[name="q${q}"]`) ||
                    document.querySelector(`select[name="q${q}"]`);
                if (target && target.parentNode) {
                    const anchor = document.createElement('span');
                    anchor.className = 'question-anchor';
                    anchor.dataset.questionAnchor = q;
                    target.parentNode.insertBefore(anchor, target);
                }
            }
        }

        /* Drag & Drop for Q32-36 */
        function setupDragDrop() {
            const zones = document.querySelectorAll('.drop-zone');
            const items = document.querySelectorAll('.drag-item');
            const optionBins = document.querySelectorAll('.drag-options');

            const releaseOption = (option) => {
                const item = document.querySelector(`.drag-item[data-option="${option}"]`);
                if (item) {
                    item.dataset.used = "false";
                    item.classList.remove('used');
                    item.draggable = true;
                }
            };

            items.forEach(item => {
                item.dataset.used = "false";
                item.addEventListener('dragstart', (e) => {
                    if (item.dataset.used === "true") {
                        e.preventDefault();
                        return;
                    }
                    const answer = item.dataset.answer || item.dataset.option;
                    e.dataTransfer.setData('text/plain', item.dataset.option);
                    e.dataTransfer.setData('text/label', item.dataset.label || '');
                    e.dataTransfer.setData('text/answer', answer);
                    e.dataTransfer.effectAllowed = 'move';
                });
            });

            zones.forEach(zone => {
                const placeholder = zone.dataset.placeholder || '';
                zone.dataset.value = '';
                zone.draggable = false;

                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    zone.classList.add('over');
                });
                zone.addEventListener('dragleave', () => zone.classList.remove('over'));
                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.classList.remove('over');
                    const option = e.dataTransfer.getData('text/plain');
                    const label = e.dataTransfer.getData('text/label');
                    const answer = e.dataTransfer.getData('text/answer') || option;
                    if (!option) return;

                    const item = document.querySelector(`.drag-item[data-option="${option}"]`);
                    if (!item || item.dataset.used === "true") return;

                    if (zone.dataset.value && zone.dataset.value !== option) {
                        releaseOption(zone.dataset.value);
                    }

                    zone.dataset.value = option;
                    zone.textContent = label ? `${answer} ${label}` : answer;
                    zone.classList.add('filled');
                    zone.draggable = true;
                    item.dataset.used = "true";
                    item.classList.add('used');
                    item.draggable = false;

                    const targetName = zone.dataset.target;
                    const input = document.querySelector(`input[name="${targetName}"]`);
                    if (input) {
                        input.value = answer;
                        const evt = new Event('change', { bubbles: true });
                        input.dispatchEvent(evt);
                    }
                });

                zone.addEventListener('dragstart', (e) => {
                    if (!zone.dataset.value) {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.setData('text/plain', zone.dataset.value);
                    const item = document.querySelector(`.drag-item[data-option="${zone.dataset.value}"]`);
                    e.dataTransfer.setData('text/label', item ? item.dataset.label : '');
                    e.dataTransfer.setData('text/answer', item ? (item.dataset.answer || item.dataset.option) : zone.dataset.value);
                    e.dataTransfer.setData('text/source-zone', zone.dataset.target);
                    e.dataTransfer.effectAllowed = 'move';
                });

                zone.addEventListener('dblclick', () => {
                    if (zone.dataset.value) releaseOption(zone.dataset.value);
                    zone.dataset.value = '';
                    zone.textContent = placeholder;
                    zone.classList.remove('filled');
                    zone.draggable = false;
                    const targetName = zone.dataset.target;
                    const input = document.querySelector(`input[name="${targetName}"]`);
                    if (input) {
                        input.value = '';
                        const evt = new Event('change', { bubbles: true });
                        input.dispatchEvent(evt);
                    }
                });
            });

            optionBins.forEach(bin => {
                bin.addEventListener('dragover', (e) => e.preventDefault());
                bin.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const option = e.dataTransfer.getData('text/plain');
                    const source = e.dataTransfer.getData('text/source-zone');
                    if (!option || !source) return;
                    const zone = document.querySelector(`.drop-zone[data-target="${source}"]`);
                    if (zone && zone.dataset.value === option) {
                        zone.dataset.value = '';
                        zone.textContent = zone.dataset.placeholder || '';
                        zone.classList.remove('filled');
                        zone.draggable = false;
                        const input = document.querySelector(`input[name="${source}"]`);
                        if (input) {
                            input.value = '';
                            const evt = new Event('change', { bubbles: true });
                            input.dispatchEvent(evt);
                        }
                        releaseOption(option);
                    }
                });
            });
        }

        function setupPairedMultiSelect(groupName, firstTarget, secondTarget) {
            const checks = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
            const first = document.querySelector(`input[name="${firstTarget}"]`);
            const second = document.querySelector(`input[name="${secondTarget}"]`);
            if (!checks.length || !first || !second) return;

            const sync = (changed) => {
                const selected = checks.filter(cb => cb.checked);
                if (selected.length > 2 && changed && changed.checked) {
                    changed.checked = false;
                }
                const final = checks.filter(cb => cb.checked).map(cb => cb.value);
                first.value = final[0] || '';
                second.value = final[1] || '';
                first.dispatchEvent(new Event('change', { bubbles: true }));
                second.dispatchEvent(new Event('change', { bubbles: true }));
            };

            checks.forEach(cb => cb.addEventListener('change', () => sync(cb)));
        }

        /* ===== SUBMIT ALL ===== */
        el('submit-all-btn').addEventListener('click', () => {
            if (!confirm('Submit the entire test?')) return;

            const firstQuestion = PARTS[0].qStart;
            const lastQuestion = PARTS[PARTS.length - 1].qEnd;
            let score = 0, total = lastQuestion - firstQuestion + 1;
            const results = {};

            for (let q = firstQuestion; q <= lastQuestion; q++) {
                const key = `q${q}`;
                const corr = correctAnswers[key];
                let user = null, isCorrect = false;

                const radios = document.querySelectorAll(`input[name="${key}"][type="radio"]`);
                const text = document.querySelector(`input[name="${key}"][type="text"]`);
                const sel = document.querySelector(`select[name="${key}"]`);
                const cbs = document.querySelectorAll(`input[name="${key}"][type="checkbox"]`);

                if (radios.length > 0) {
                    const c = Array.from(radios).find(r => r.checked);
                    if (c) { user = c.value; isCorrect = (user.toUpperCase() === corr.toUpperCase()); radios.forEach(r => r.disabled = true); }
                } else if (cbs.length > 0) {
                    user = Array.from(cbs).filter(cb => cb.checked).map(cb => cb.value).sort().join(',');
                    if (user) {
                        const corrArr = Array.isArray(corr) ? corr.sort().join(',') : '';
                        isCorrect = user === corrArr;
                        cbs.forEach(cb => cb.disabled = true);
                    }
                } else if (text) {
                    user = (text.value || '').trim();
                    if (user) {
                        const norm = (s) => String(s).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                        const variants = String(corr).split('|').map(v => norm(v)).filter(Boolean);
                        isCorrect = variants.includes(norm(user));
                        text.disabled = true;
                    }
                } else if (sel) {
                    user = sel.value;
                    if (user) { isCorrect = user === corr; sel.disabled = true; }
                }

                if (isCorrect) score++;
                results[key] = { userAnswer: user || 'No answer', correct: corr, isCorrect };
            }

            for (let q = firstQuestion; q <= lastQuestion; q++) {
                const res = results[`q${q}`];
                const ch = document.querySelector(`.progress-item[data-question="${q}"]`);
                if (ch) {
                    ch.classList.remove('current', 'answered');
                    if (res) ch.classList.add(res.isCorrect ? 'correct' : 'incorrect');
                }
            }

            if (window.IELTSProgress && typeof window.IELTSProgress.trackTestResult === 'function') {
                window.IELTSProgress.trackTestResult('reading', {
                    score: score,
                    total: total,
                    label: TEST_LABEL,
                    test_id: TEST_STORAGE_ID,
                    answers: collectCurrentAnswers(),
                    href: window.location.pathname
                });
            }

            el('score-display').textContent = `${score}/${total}`;
            const breakdown = el('score-breakdown');
            breakdown.innerHTML = PARTS.map(p => {
                const partScore = Array.from({ length: p.qEnd - p.qStart + 1 }, (_, i) => results[`q${p.qStart + i}`])
                    .filter(r => r && r.isCorrect).length;
                return `<div class="score-item"><span>Passage ${p.id}:</span><span>${partScore}/${p.qEnd - p.qStart + 1}</span></div>`;
            }).join('');
            var submittedMenuLink = el('submittedMenuLink');
            if (submittedMenuLink) submittedMenuLink.style.display = 'inline-flex';
            el('results-modal').style.display = 'flex';

            el('review-answers').onclick = () => {
                el('results-modal').style.display = 'none';
                showCorrectIndicators(results);
                if (window.IELTSReadingReviewMode && window.IELTSReadingReviewMode.enhanceGroupedCheckboxIndicators) window.IELTSReadingReviewMode.enhanceGroupedCheckboxIndicators(results);
            };
        });

        function showCorrectIndicators(results) {
            document.querySelectorAll('.answer-indicator').forEach(e => e.remove());
            const firstQuestion = PARTS[0].qStart;
            const total = PARTS[PARTS.length - 1].qEnd;

            for (let q = firstQuestion; q <= total; q++) {
                const key = `q${q}`;
                const res = results[key];
                if (!res) continue;

                let target = null;
                const qEl = document.querySelector(`[data-question="${q}"] .options`);
                if (qEl) target = qEl;
                if (!target) {
                    const input = document.querySelector(`input[name="${key}"]`);
                    if (input) target = input.parentNode;
                }
                if (!target) {
                    const dz = document.querySelector(`.drop-zone[data-target="${key}"]`);
                    if (dz) target = dz;
                }
                if (!target) {
                    const sel = document.querySelector(`select[name="${key}"]`);
                    if (sel) target = sel.parentNode;
                }
                if (!target) continue;

                const box = document.createElement('div');
                box.className = 'answer-indicator ' + (res.isCorrect ? 'correct' : 'incorrect');
                box.style.display = 'block';
                box.style.marginTop = '6px';
                box.innerHTML = res.isCorrect
                    ? `<i class="fas fa-check"></i> Correct!`
                    : `<i class="fas fa-times"></i> Incorrect. Your answer: <strong>${res.userAnswer}</strong> <strong>Correct:</strong> ${Array.isArray(res.correct) ? res.correct.join(', ') : res.correct}`;
                target.appendChild(box);
            }
        }

        const timerSpan = document.querySelector('#globalTimer span');
        const timerContainer = document.querySelector('#globalTimer');
        function updateTimer() {
            seconds--;
            const m = Math.floor(seconds / 60), s = seconds % 60;
            timerSpan.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            if (seconds <= 2 * 60) timerContainer.classList.add('warning');
            if (seconds <= 0) { clearInterval(timerInterval); alert('Time is up! Submitting all passages.'); el('submit-all-btn').click(); }
        }

        function startTest() {
            el('startScreen').classList.add('hidden');
            el('testContainer').classList.remove('hidden');
            timerInterval = setInterval(updateTimer, 1000);
        }
        window.startTest = startTest;

        setTimeout(() => { el('loadingScreen').classList.add('hidden'); el('startScreen').classList.remove('hidden'); }, 900);

        PARTS.forEach(p => {
            if (p.id === 1) { el(p.passagePanel).classList.remove('hidden'); el(p.questionsPanel).classList.remove('hidden'); }
            else { el(p.passagePanel).classList.add('hidden'); el(p.questionsPanel).classList.add('hidden'); }
        });
        renderBottomTabs();
        normalizeMcqGroups();
        normalizeSummaryGroups();
        attachAnsweredListeners();
        setupDragDrop();
        createAnchors();
        restoreSavedAnswers();
        document.addEventListener('change', function (e) {
            if (e.target && e.target.name && /^q\d+$/.test(e.target.name)) persistCurrentAnswers();
        }, true);
        document.addEventListener('input', function (e) {
            if (e.target && e.target.name && /^q\d+$/.test(e.target.name)) persistCurrentAnswers();
        }, true);

        /* Options modal logic */
        const optionsModal = el('options-modal');
        const optionsTitle = el('options-title');
        const optionsBack = el('options-back');
        const optionsHome = el('options-home');
        const contrastMenu = el('contrast-menu');
        const textSizeMenu = el('textsize-menu');

        const openOptions = () => {
            optionsModal.style.display = 'flex';
            switchView('home');
        };
        const closeOptions = () => optionsModal.style.display = 'none';
        el('optionsMenuBtn').addEventListener('click', openOptions);
        el('close-options').addEventListener('click', closeOptions);
        window.addEventListener('click', (e) => { if (e.target === optionsModal) closeOptions(); });
        optionsBack.addEventListener('click', () => switchView('home'));

        function switchView(view) {
            currentView = view;
            optionsHome.style.display = view === 'home' ? 'block' : 'none';
            contrastMenu.style.display = view === 'contrast' ? 'block' : 'none';
            textSizeMenu.style.display = view === 'textsize' ? 'block' : 'none';
            optionsBack.style.visibility = view === 'home' ? 'hidden' : 'visible';
            optionsTitle.textContent = view === 'home' ? 'Options' : (view === 'contrast' ? 'Contrast' : 'Text size');
        }

        optionsHome.querySelectorAll('.option-row').forEach(row => {
            row.addEventListener('click', () => {
                const target = row.dataset.target;
                switchView(target);
            });
        });

        function applyContrast(mode) {
            document.body.classList.remove('contrast-white-black', 'contrast-yellow-black');
            if (mode === 'whiteblack') document.body.classList.add('contrast-white-black');
            if (mode === 'yellowblack') document.body.classList.add('contrast-yellow-black');
            selectedContrast = mode;
            contrastMenu.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.contrast === selectedContrast);
            });
            el('contrast-current').textContent =
                mode === 'whiteblack' ? 'White on black' :
                mode === 'yellowblack' ? 'Yellow on black' : 'Black on white';
        }

        contrastMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                applyContrast(btn.dataset.contrast);
                switchView('home');
            });
        });

        function applyTextSize(size) {
            const base = { small: '14px', medium: '16px', large: '19px', xlarge: '24px' }[size] || '16px';
            document.documentElement.style.fontSize = base;
            selectedTextSize = size;
            textSizeMenu.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.textsize === selectedTextSize);
            });
            el('textsize-current').textContent =
                size === 'small' ? 'Small' :
                size === 'large' ? 'Large' :
                size === 'xlarge' ? 'Extra large' : 'Medium';
        }

        textSizeMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                applyTextSize(btn.dataset.textsize);
                switchView('home');
            });
        });

        applyContrast(selectedContrast);
        applyTextSize(selectedTextSize);

        /* Fullscreen toggle */
        const fsBtn = el('fullscreenBtn');
        fsBtn.addEventListener('click', () => {
            if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
                try { var requestFullscreen = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen; var request = requestFullscreen && requestFullscreen.call(document.documentElement); if (request && typeof request.catch === 'function') request.catch(function () {}); }
                catch (e) { console.warn('Fullscreen failed', e); }
            } else {
                var exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen; if (exitFullscreen) exitFullscreen.call(document);
            }
        });

        /* Notes removed */

        let isResizing = false;
        document.querySelectorAll('.resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', () => { isResizing = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; });
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const container = document.querySelector('.main-content');
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const leftPct = (mouseX / rect.width) * 100;
            const rightPct = 100 - leftPct;
            if (leftPct >= 30 && leftPct <= 70) {
                const passage = document.querySelector('.passage-container:not(.hidden)');
                const questions = document.querySelector('.questions-container:not(.hidden)');
                if (passage) passage.style.flex = leftPct + '%';
                if (questions) questions.style.flex = rightPct + '%';
            }
        });
        document.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; } });

        /* ========= HIGHLIGHT (selectionchange-based) ========= */
        const highlightBtn = el('highlight-btn');
        const removeHighlightBtn = el('remove-highlight-btn');
        const passagePanels = PARTS.map(p => el(p.passagePanel));
        const questionsPanels = PARTS.map(p => el(p.questionsPanel));
        let lastSelection = null, highlightTarget = null, currentPanel = null;

        function getValidSelection() {
            const sel = window.getSelection();
            if (!sel.rangeCount || sel.isCollapsed) return null;
            const range = sel.getRangeAt(0);
            if (passagePanels.some(pp => pp && pp.contains(range.commonAncestorContainer))) {
                currentPanel = passagePanels.find(pp => pp.contains(range.commonAncestorContainer));
            } else if (questionsPanels.some(qp => qp && qp.contains(range.commonAncestorContainer))) {
                currentPanel = questionsPanels.find(qp => qp.contains(range.commonAncestorContainer));
            } else return null;
            return range;
        }

        function showHighlightBtn(range) {
            const rect = range.getBoundingClientRect();
            highlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
            highlightBtn.style.left = (window.scrollX + rect.left) + 'px';
            highlightBtn.style.display = 'block';
        }

        function hideHighlightBtn() { highlightBtn.style.display = 'none'; }

        function showRemoveBtn(span) {
            const rect = span.getBoundingClientRect();
            removeHighlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
            removeHighlightBtn.style.left = (window.scrollX + rect.left) + 'px';
            removeHighlightBtn.style.display = 'block';
            highlightTarget = span;
        }

        function hideRemoveBtn() { removeHighlightBtn.style.display = 'none'; highlightTarget = null; }

        /* Build an array of sub-ranges so we can wrap each segment in its own span (fixes cross-paragraph selection) */
        function getHighlightSegmentRanges(range) {
            if (!range || range.collapsed) return [];
            const segments = [];
            const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentNode
                : range.commonAncestorContainer;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            let node = walker.nextNode();
            while (node) {
                if (!range.intersectsNode(node)) { node = walker.nextNode(); continue; }
                const nodeStart = (node === range.startContainer) ? range.startOffset : 0;
                const nodeEnd = (node === range.endContainer) ? range.endOffset : (node.textContent || '').length;
                if (nodeStart < nodeEnd) {
                    const segRange = document.createRange();
                    segRange.setStart(node, nodeStart);
                    segRange.setEnd(node, nodeEnd);
                    segments.push(segRange);
                }
                if (node === range.endContainer) break;
                node = walker.nextNode();
            }
            return segments;
        }

        highlightBtn.addEventListener('click', () => {
            if (!lastSelection) return;
            const segments = getHighlightSegmentRanges(lastSelection);
            if (segments.length === 0) return;
            /* Process from end to start so DOM changes don't invalidate earlier ranges */
            for (let i = segments.length - 1; i >= 0; i--) {
                const segRange = segments[i];
                try {
                    const span = document.createElement('span');
                    span.className = 'highlight';
                    span.appendChild(segRange.extractContents());
                    segRange.insertNode(span);
                } catch (err) { /* skip invalid segment */ }
            }
            window.getSelection().removeAllRanges();
            hideHighlightBtn();
        });

        removeHighlightBtn.addEventListener('click', () => {
            if (highlightTarget) {
                const parent = highlightTarget.parentNode;
                while (highlightTarget.firstChild) parent.insertBefore(highlightTarget.firstChild, highlightTarget);
                parent.removeChild(highlightTarget);
                hideRemoveBtn();
            }
        });

        let selectionFrame = null;
        document.addEventListener('selectionchange', () => {
            if (selectionFrame) cancelAnimationFrame(selectionFrame);
            selectionFrame = requestAnimationFrame(() => {
                hideHighlightBtn(); hideRemoveBtn();
                const range = getValidSelection();
                if (range) { lastSelection = range; showHighlightBtn(range); } else { lastSelection = null; }
                selectionFrame = null;
            });
        });

        document.addEventListener('mousedown', (e) => {
            if (e.target !== highlightBtn && e.target !== removeHighlightBtn) { hideHighlightBtn(); hideRemoveBtn(); }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('highlight')) { e.preventDefault(); showRemoveBtn(e.target); }
        });

        // Disable right-click context menu while keeping text selection active
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Block copy/paste/cut via keyboard or menu
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'C', 'V', 'X'].includes(e.key)) {
                e.preventDefault();
            }
        });
        ['copy', 'cut', 'paste'].forEach(evt => {
            document.addEventListener(evt, (e) => {
                e.preventDefault();
            });
        });

        el('close-modal').addEventListener('click', () => { el('results-modal').style.display = 'none'; });
    