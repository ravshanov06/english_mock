        /* ========= CONFIG ========= */
        const PARTS = [
            { id: 1, title: 'Passage 2', qStart: 14, qEnd: 26, passagePanel: 'p1_passagePanel', questionsPanel: 'p1_questionsPanel' },
        ];

        /* ======= ANSWER KEY ======= */
        const correctAnswers = {
            q14: "A",
            q15: "D",
            q16: "B",
            q17: "E",
            q18: "A",
            q19: "D",
            q20: "C",
            q21: "E",
            q22: "B",
            q23: "D",
            q24: "A",
            q25: "C",
            q26: "A"
        };

        /* ========= STATE ========= */
        let currentPart = 1;
        let currentQuestion = 14;
        let seconds = 60 * 60;
        let timerInterval;
        let selectedContrast = 'normal';
        let selectedTextSize = 'medium';
        const TEST_STORAGE_ID = 'reading_reading_passage_2s_passage_2_40';
        const TEST_LABEL = 'Passage 2.40';
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
                    const chip = document.querySelector(`#rail-part-${currentPart} .progress-item[data-question="${q}"]`);
                    let val = '';
                    if (input.type === 'text') val = input.value.trim();
                    else if (input.type === 'checkbox') {
                        const checked = Array.from(document.querySelectorAll(`input[name="${input.name}"]:checked`)).map(cb => cb.value);
                        val = checked.length > 0 ? checked.join(',') : '';
                    } else val = input.value;
                    if (chip) chip.classList.toggle('answered', !!val);
                    persistCurrentAnswers();
                });
            });
        }

        function startTest() {
            el('loadingScreen').classList.add('hidden');
            el('startScreen').classList.add('hidden');
            el('testContainer').classList.remove('hidden');
            normalizeMcqGroups();
            normalizeSummaryGroups();
            renderBottomTabs();
            attachAnsweredListeners();
            restoreSavedAnswers();
            startTimer();
            setTimeout(() => scrollToQuestion(currentQuestion, false), 100);
        }
        window.startTest = startTest;

        function startTimer() {
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                seconds--;
                const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
                const ss = String(seconds % 60).padStart(2, '0');
                const span = document.querySelector('#globalTimer span');
                if (span) span.textContent = `${mm}:${ss}`;
                if (seconds <= 0) { clearInterval(timerInterval); el('submit-all-btn').click(); }
            }, 1000);
        }

        setTimeout(() => {
            el('loadingScreen').classList.add('hidden');
            el('startScreen').classList.remove('hidden');
        }, 700);

        function norm(s) { return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }

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

        const groupedChoiceConfigs = [
            { name: 'q14_15_choice', qStart: 14, qEnd: 15, reviewId: 'q14-15-review' },
            { name: 'q16_17_choice', qStart: 16, qEnd: 17, reviewId: 'q16-17-review' },
            { name: 'q18_19_choice', qStart: 18, qEnd: 19, reviewId: 'q18-19-review' },
            { name: 'q20_21_choice', qStart: 20, qEnd: 21, reviewId: 'q20-21-review' },
        ];

        /* ===== SUBMIT ALL ===== */
        el('submit-all-btn').addEventListener('click', () => {
            if (!confirm('Submit the entire test?')) return;

            const firstQuestion = PARTS[0].qStart;
            const lastQuestion = PARTS[PARTS.length - 1].qEnd;
            let score = 0, total = lastQuestion - firstQuestion + 1;
            const results = {};
            const groupedChoiceState = groupedChoiceConfigs.map(cfg => ({
                cfg,
                selected: Array.from(document.querySelectorAll(`input[name="${cfg.name}"]:checked`)).map(cb => cb.value)
            }));

            for (let q = firstQuestion; q <= lastQuestion; q++) {
                const key = `q${q}`;
                const corr = correctAnswers[key];
                let user = null, isCorrect = false;
                const groupedState = groupedChoiceState.find(entry => q >= entry.cfg.qStart && q <= entry.cfg.qEnd);
                if (groupedState) {
                    user = groupedState.selected.join(',') || 'No answer';
                    isCorrect = groupedState.selected.includes(String(corr));
                    results[key] = { userAnswer: user, correct: corr, isCorrect };
                    if (isCorrect) score++;
                    continue;
                }

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
                        const variants = String(corr).split('|').map(v => norm(v)).filter(Boolean);
                        isCorrect = variants.includes(norm(user));
                        text.disabled = true;
                    }
                } else if (sel) {
                    user = sel.value;
                    if (user) { isCorrect = (user.toUpperCase() === corr.toUpperCase()); sel.disabled = true; }
                }
                if (isCorrect) score++;
                results[key] = { userAnswer: user || 'No answer', correct: corr, isCorrect };
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
            var submitButton = el('submit-all-btn');
            if (submitButton) {
                submitButton.classList.add('is-submitted');
                submitButton.textContent = 'View Result';
                submitButton.disabled = false;
            }

            localStorage.setItem('ielts_results', JSON.stringify(results));
            el('results-modal').style.display = 'flex';
        });

        el('close-modal').addEventListener('click', () => el('results-modal').style.display = 'none');
        el('review-answers').addEventListener('click', () => {
            localStorage.setItem('ielts_results', localStorage.getItem('ielts_results') || '{}');
            el('results-modal').style.display = 'none';
            document.body.classList.add('review-mode');
        });

        el('prev-btn').addEventListener('click', () => {
            if (currentQuestion > PARTS[0].qStart) scrollToQuestion(currentQuestion - 1);
        });
        el('next-btn').addEventListener('click', () => {
            if (currentQuestion < PARTS[0].qEnd) scrollToQuestion(currentQuestion + 1);
        });

        document.addEventListener('change', (e) => {
            if (e.target && e.target.name && /^q\d+$/.test(e.target.name)) persistCurrentAnswers();
        }, true);
        setupPairedMultiSelect('q14_15_choice', 'q14', 'q15');
        setupPairedMultiSelect('q16_17_choice', 'q16', 'q17');
        setupPairedMultiSelect('q18_19_choice', 'q18', 'q19');
        setupPairedMultiSelect('q20_21_choice', 'q20', 'q21');

        /* Options modal logic */
        const optionsModal = el('options-modal');
        const optionsTitle = el('options-title');
        el('optionsMenuBtn').addEventListener('click', () => { optionsModal.style.display = 'flex'; showOptionsHome(); });
        el('close-options').addEventListener('click', () => { optionsModal.style.display = 'none'; });
        el('options-back').addEventListener('click', showOptionsHome);
        function showOptionsHome() {
            currentView = 'home';
            el('options-home').style.display = 'block';
            el('contrast-menu').style.display = 'none';
            el('textsize-menu').style.display = 'none';
            el('options-back').style.visibility = 'hidden';
            optionsTitle.textContent = 'Options';
        }
        document.querySelectorAll('.option-row').forEach(row => row.addEventListener('click', () => {
            const target = row.getAttribute('data-target');
            el('options-home').style.display = 'none';
            el('options-back').style.visibility = 'visible';
            if (target === 'contrast') { el('contrast-menu').style.display = 'block'; optionsTitle.textContent = 'Contrast'; }
            if (target === 'textsize') { el('textsize-menu').style.display = 'block'; optionsTitle.textContent = 'Text size'; }
        }));
        document.querySelectorAll('[data-contrast]').forEach(btn => btn.addEventListener('click', () => {
            document.body.classList.remove('contrast-whiteblack','contrast-yellowblack');
            const v = btn.getAttribute('data-contrast');
            if (v === 'whiteblack') document.body.classList.add('contrast-whiteblack');
            if (v === 'yellowblack') document.body.classList.add('contrast-yellowblack');
            el('contrast-current').textContent = btn.textContent.trim();
            selectedContrast = v;
            showOptionsHome();
        }));
        document.querySelectorAll('[data-textsize]').forEach(btn => btn.addEventListener('click', () => {
            document.body.classList.remove('text-small','text-medium','text-large','text-xlarge');
            const v = btn.getAttribute('data-textsize');
            document.body.classList.add(`text-${v}`);
            el('textsize-current').textContent = btn.textContent.trim();
            selectedTextSize = v;
            showOptionsHome();
        }));
