
        // Correct Answers
        const correctAnswers = {
            q27: "YES", q28: "YES", q29: "NO", q30: "NOT GIVEN", q31: "NOT GIVEN", q32: "NO",
            q33: "B", q34: "A", q35: "D", q36: "B", q37: "D",
            q38: "C", q39: "A", q40: "D"
        };

        // === PROTECTION: Only block right-click (context menu) and dev shortcuts ===
        // This prevents casual users from viewing source via right-click
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        // Block common developer tools shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || // Ctrl+Shift+I or J
                (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U
                e.preventDefault();
            }
        });

        let lastSelection = null;
        let highlightTarget = null;
        let currentPanel = null;
        let submitted = false;
        let currentQuestion = 27;
        let isResizing = false;
        let seconds = 20 * 60;
        let timerInterval;

        const TEST_STORAGE_ID = 'reading_reading_passage_3s_passage_3_25';
        const TEST_LABEL = 'Passage 3.25';
        const LEGACY_ANSWER_STORAGE_PREFIX = 'ielts_saved_answers_';
        const SEARCH_PARAMS = new URLSearchParams(window.location.search);
        const ATTEMPT_QUERY_ID = SEARCH_PARAMS.get('attempt') || '';
        const REDO_QUERY = SEARCH_PARAMS.get('redo') === '1';

        const highlightBtn = document.getElementById('highlight-btn');
        const removeHighlightBtn = document.getElementById('remove-highlight-btn');
        const passagePanel = document.querySelector('.passage-container');
        const questionsPanel = document.getElementById('questions');
        const resizer = document.getElementById('resizer');
        const submitBtn = document.getElementById('submit-all-btn') || document.getElementById('submit-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const resultsModal = document.getElementById('results-modal');
        const scoreDisplay = document.getElementById('score-display');
        const passage3Score = document.getElementById('passage3-score');
        const closeModalBtn = document.getElementById('close-modal');
        const reviewBtn = document.getElementById('review-answers');
        const timerElement = document.querySelector('.timer span');
        const timerContainer = document.querySelector('.timer');

        function collectCurrentAnswers() {
            const saved = {};
            for (let q = 27; q <= 40; q++) {
                const key = `q${q}`;
                const radios = document.querySelectorAll(`input[name="${key}"][type="radio"]`);
                const zone = document.querySelector(`.drop-zone[data-target="${key}"]`);
                if (radios.length) {
                    const checked = Array.from(radios).find((r) => r.checked);
                    if (checked) saved[key] = checked.value;
                } else if (zone) {
                    const inp = document.querySelector(`input[name="${key}"]`);
                    if (inp && inp.value.trim()) saved[key] = inp.value.trim();
                }
            }
            return saved;
        }

        function restoreReadingDropZone(questionName, answerValue) {
            const zone = document.querySelector(`.drop-zone[data-target="${questionName}"]`);
            if (!zone || !answerValue) return;
            const item = Array.from(document.querySelectorAll('.drag-item')).find((node) =>
                (node.dataset.answer || '').toUpperCase() === String(answerValue).toUpperCase()
            );
            if (!item) return;
            zone.dataset.value = item.dataset.option;
            zone.textContent = item.dataset.label ? `${item.dataset.answer} ${item.dataset.label}` : item.dataset.answer;
            zone.classList.add('filled');
            zone.draggable = true;
            item.dataset.used = 'true';
            item.classList.add('used');
            item.draggable = false;
            const input = document.querySelector(`input[name="${questionName}"]`);
            if (input) { input.value = item.dataset.answer; }
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
        function restoreSavedAnswers() {
            var stored = {};
            if (window.IELTSProgress && typeof window.IELTSProgress.loadDraft === 'function') {
                if (ATTEMPT_QUERY_ID) stored = window.IELTSProgress.loadDraft(ATTEMPT_QUERY_ID) || {};
                if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) stored = window.IELTSProgress.loadDraft(TEST_STORAGE_ID) || {};
            }
            if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
                try {
                    stored = JSON.parse(localStorage.getItem(getLegacySavedAnswersKey()) || '{}') || {};
                } catch (e) {
                    stored = {};
                }
            }
            Object.keys(stored).forEach((key) => {
                const value = stored[key];
                if (!value) return;
                const zone = document.querySelector(`.drop-zone[data-target="${key}"]`);
                if (zone) {
                    restoreReadingDropZone(key, value);
                } else {
                    const radio = document.querySelector(`input[name="${key}"][type="radio"][value="${value}"]`);
                    if (radio) radio.checked = true;
                }
                const q = parseInt(String(key).replace('q', ''), 10);
                const chip = document.querySelector(`.progress-item[data-question="${q}"]`);
                if (chip) chip.classList.add('answered');
            });
        }

        // Timer
        function updateTimer() {
            seconds--;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if (seconds <= 120) timerContainer.classList.add('warning');
            if (seconds <= 0) {
                clearInterval(timerInterval);
                if (!submitted) {
                    alert('Time is up! Submitting your test.');
                    submitTest();
                }
            }
        }

        // Highlight functionality (fully working)
        function getValidSelection() {
            const sel = window.getSelection();
            if (!sel.rangeCount || sel.isCollapsed) return null;
            const range = sel.getRangeAt(0);
            if (passagePanel.contains(range.commonAncestorContainer) || 
                questionsPanel.contains(range.commonAncestorContainer)) {
                return range;
            }
            return null;
        }

        function showHighlightBtn(range) {
            const rect = range.getBoundingClientRect();
            highlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
            highlightBtn.style.left = (window.scrollX + rect.left) + 'px';
            highlightBtn.style.display = 'block';
        }

        function hideHighlightBtn() {
            highlightBtn.style.display = 'none';
        }

        function showRemoveBtn(span) {
            const rect = span.getBoundingClientRect();
            removeHighlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
            removeHighlightBtn.style.left = (window.scrollX + rect.left) + 'px';
            removeHighlightBtn.style.display = 'block';
            highlightTarget = span;
        }

        function hideRemoveBtn() {
            removeHighlightBtn.style.display = 'none';
            highlightTarget = null;
        }

        highlightBtn.addEventListener('click', () => {
            if (lastSelection) {
                const span = document.createElement('span');
                span.className = 'highlight';
                span.appendChild(lastSelection.extractContents());
                lastSelection.insertNode(span);
                window.getSelection().removeAllRanges();
                hideHighlightBtn();
            }
        });

        removeHighlightBtn.addEventListener('click', () => {
            if (highlightTarget) {
                const parent = highlightTarget.parentNode;
                while (highlightTarget.firstChild) {
                    parent.insertBefore(highlightTarget.firstChild, highlightTarget);
                }
                parent.removeChild(highlightTarget);
                hideRemoveBtn();
            }
        });

        document.addEventListener('selectionchange', () => {
            hideHighlightBtn();
            hideRemoveBtn();
            const range = getValidSelection();
            if (range) {
                lastSelection = range;
                showHighlightBtn(range);
            } else {
                lastSelection = null;
            }
        });

        [passagePanel, questionsPanel].forEach(panel => {
            panel.addEventListener('scroll', () => {
                hideHighlightBtn();
                hideRemoveBtn();
            });
        });

        document.addEventListener('mousedown', (e) => {
            if (e.target !== highlightBtn && e.target !== removeHighlightBtn) {
                hideHighlightBtn();
                hideRemoveBtn();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('highlight')) {
                e.preventDefault();
                showRemoveBtn(e.target);
            }
        });

        // Rest of the script (resizer, navigation, submit, etc.) remains unchanged...
        // (Included fully below for completeness)

        // Resizer
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const container = document.querySelector('.main-content');
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const containerWidth = containerRect.width;
            const leftPercentage = (mouseX / containerWidth) * 100;
            if (leftPercentage >= 30 && leftPercentage <= 70) {
                document.querySelector('.passage-container').style.flex = leftPercentage + '%';
                document.querySelector('.questions-container').style.width = (100 - leftPercentage) + '%';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Navigation & Submit (same as before)
        function scrollToQuestion(num) {
            const anchor = document.querySelector(`[data-question-anchor="${num}"]`);
            const el = anchor || document.querySelector(`[data-question="${num}"]`) || document.querySelector(`input[name="q${num}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            updateCurrentQuestion(num);
        }

        function setupDragDrop() {
            const items = document.querySelectorAll('.drag-item');
            const zones = document.querySelectorAll('.drop-zone');
            const bins = document.querySelectorAll('.drag-options');

            const releaseItem = (optionKey) => {
                const item = document.querySelector(`.drag-item[data-option="${optionKey}"]`);
                if (item) { item.dataset.used = 'false'; item.classList.remove('used'); item.draggable = true; }
            };

            items.forEach(item => {
                item.dataset.used = 'false';
                item.addEventListener('dragstart', (e) => {
                    if (item.dataset.used === 'true') { e.preventDefault(); return; }
                    e.dataTransfer.setData('text/plain', item.dataset.option);
                    e.dataTransfer.setData('text/label', item.dataset.label || '');
                    e.dataTransfer.setData('text/answer', item.dataset.answer);
                    e.dataTransfer.effectAllowed = 'move';
                });
            });

            zones.forEach(zone => {
                const placeholder = zone.dataset.placeholder || '';
                zone.dataset.value = '';
                zone.draggable = false;

                zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
                zone.addEventListener('dragleave', () => zone.classList.remove('over'));
                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.classList.remove('over');
                    const option = e.dataTransfer.getData('text/plain');
                    const label = e.dataTransfer.getData('text/label');
                    const answer = e.dataTransfer.getData('text/answer') || option;
                    if (!option) return;
                    const item = document.querySelector(`.drag-item[data-option="${option}"]`);
                    if (!item || item.dataset.used === 'true') return;
                    if (zone.dataset.value && zone.dataset.value !== option) releaseItem(zone.dataset.value);
                    zone.dataset.value = option;
                    zone.textContent = label ? `${answer} ${label}` : answer;
                    zone.classList.add('filled');
                    zone.draggable = true;
                    item.dataset.used = 'true';
                    item.classList.add('used');
                    item.draggable = false;
                    const inp = document.querySelector(`input[name="${zone.dataset.target}"]`);
                    if (inp) { inp.value = answer; inp.dispatchEvent(new Event('change', { bubbles: true })); }
                });
                zone.addEventListener('dragstart', (e) => {
                    if (!zone.dataset.value) { e.preventDefault(); return; }
                    e.dataTransfer.setData('text/plain', zone.dataset.value);
                    const it = document.querySelector(`.drag-item[data-option="${zone.dataset.value}"]`);
                    e.dataTransfer.setData('text/label', it ? (it.dataset.label || '') : '');
                    e.dataTransfer.setData('text/answer', it ? (it.dataset.answer || zone.dataset.value) : zone.dataset.value);
                    e.dataTransfer.setData('text/source-zone', zone.dataset.target);
                    e.dataTransfer.effectAllowed = 'move';
                });
                zone.addEventListener('dblclick', () => {
                    if (zone.dataset.value) releaseItem(zone.dataset.value);
                    zone.dataset.value = '';
                    zone.textContent = placeholder;
                    zone.classList.remove('filled');
                    zone.draggable = false;
                    const inp = document.querySelector(`input[name="${zone.dataset.target}"]`);
                    if (inp) { inp.value = ''; inp.dispatchEvent(new Event('change', { bubbles: true })); }
                });
                zone.addEventListener('click', () => {
                    if (submitted) return;
                    if (zone.dataset.value) {
                        releaseItem(zone.dataset.value);
                        zone.dataset.value = '';
                        zone.textContent = placeholder;
                        zone.classList.remove('filled');
                        zone.draggable = false;
                        const inp = document.querySelector(`input[name="${zone.dataset.target}"]`);
                        if (inp) { inp.value = ''; inp.dispatchEvent(new Event('change', { bubbles: true })); }
                    }
                });
            });

            bins.forEach(bin => {
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
                        const inp = document.querySelector(`input[name="${source}"]`);
                        if (inp) { inp.value = ''; inp.dispatchEvent(new Event('change', { bubbles: true })); }
                        releaseItem(option);
                    }
                });
            });
        }

        function updateCurrentQuestion(num) {
            currentQuestion = num;
            document.querySelectorAll('.progress-item').forEach(item => {
                item.classList.remove('current');
                if (item.dataset.question == num) item.classList.add('current');
            });
            prevBtn.disabled = num <= 27;
            nextBtn.disabled = num >= 40;
        }

        document.querySelectorAll('.progress-item').forEach(item => {
            item.addEventListener('click', () => scrollToQuestion(parseInt(item.dataset.question)));
        });

        prevBtn.addEventListener('click', () => { if (currentQuestion > 27) scrollToQuestion(currentQuestion - 1); });
        nextBtn.addEventListener('click', () => { if (currentQuestion < 40) scrollToQuestion(currentQuestion + 1); });

        document.querySelectorAll('input[type="radio"], input[type="text"]').forEach(input => {
            input.addEventListener('change', () => {
                persistCurrentAnswers();
                if (submitted) return;
                const match = input.name && input.name.match(/^q(\d+)$/);
                if (match && input.value) {
                    (function (node) { if (node) node.classList.add('answered'); })(document.querySelector(`.progress-item[data-question="${match[1]}"]`));
                }
            });
        });

        submitBtn.addEventListener('click', submitTest);

        function submitTest() {
            if (submitted || !confirm('Are you sure you want to submit?')) return;
            submitted = true;
            clearInterval(timerInterval);
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Submitted';
            let score = 0;
            const results = {};

            for (let i = 27; i <= 37; i++) {
                const key = `q${i}`;
                const radio = document.querySelector(`input[name="${key}"]:checked`);
                const userAnswer = radio ? radio.value : '';
                const isCorrect = userAnswer === correctAnswers[key];
                if (isCorrect) score++;
                results[key] = { userAnswer, correct: correctAnswers[key], isCorrect };
                document.querySelectorAll(`input[name="${key}"]`).forEach(r => r.disabled = true);
            }

            for (let i = 38; i <= 40; i++) {
                const key = `q${i}`;
                const inp = document.querySelector(`input[name="${key}"]`);
                const userAnswer = inp && inp.value.trim() ? inp.value.trim() : '';
                const isCorrect = userAnswer.toUpperCase() === (correctAnswers[key] || '').toUpperCase();
                if (isCorrect) score++;
                results[key] = { userAnswer, correct: correctAnswers[key], isCorrect };
                if (inp) inp.disabled = true;
                const zone = document.querySelector(`.drop-zone[data-target="${key}"]`);
                if (zone) zone.style.pointerEvents = 'none';
            }
            document.querySelectorAll('.drag-item').forEach(item => { item.draggable = false; item.style.pointerEvents = 'none'; });

            scoreDisplay.textContent = `${score}/14`;
            passage3Score.textContent = `${score}/14`;
            for (let i = 27; i <= 40; i++) {
                const item = document.querySelector(`.progress-item[data-question="${i}"]`);
                if (item && results[`q${i}`]) {
                    item.classList.remove('current', 'answered');
                    item.classList.add(results[`q${i}`].isCorrect ? 'correct' : 'incorrect');
                }
            }
            window.testResults = results;
            if (window.IELTSProgress && typeof window.IELTSProgress.trackTestResult === 'function') {
                window.IELTSProgress.trackTestResult('reading', {
                    score: score,
                    total: 14,
                    label: TEST_LABEL,
                    test_id: TEST_STORAGE_ID,
                    answers: collectCurrentAnswers(),
                    href: window.location.pathname
                });
            }
            var submittedMenuLink = document.getElementById('submittedMenuLink');
            if (submittedMenuLink) submittedMenuLink.style.display = 'inline-flex';
            resultsModal.style.display = 'flex';
        }

        function showCorrectAnswers() {
            if (!submitted) return;
            document.querySelectorAll('.answer-indicator').forEach(el => el.remove());

            for (let i = 27; i <= 37; i++) {
                const res = window.testResults[`q${i}`];
                if (!res) continue;
                const target = document.querySelector(`[data-question="${i}"] .options`);
                if (!target) continue;
                const div = document.createElement('div');
                div.className = 'answer-indicator ' + (res.isCorrect ? 'correct' : 'incorrect');
                div.innerHTML = res.isCorrect 
                    ? `<i class="fas fa-check"></i> Correct!` 
                    : `<i class="fas fa-times"></i> Incorrect. Correct: <strong>${res.correct}</strong>`;
                target.appendChild(div);
            }

            for (let i = 38; i <= 40; i++) {
                const res = window.testResults[`q${i}`];
                if (!res) continue;
                const zone = document.querySelector(`.drop-zone[data-target="q${i}"]`);
                const target = zone ? zone.parentNode : null;
                if (!target) continue;
                const div = document.createElement('div');
                div.className = 'answer-indicator ' + (res.isCorrect ? 'correct' : 'incorrect');
                div.style.display = 'block';
                div.style.marginTop = '8px';
                div.innerHTML = res.isCorrect
                    ? `<i class="fas fa-check"></i> Correct!`
                    : `<i class="fas fa-times"></i> Incorrect. Your answer: <strong>${res.userAnswer || 'None'}</strong>. Correct: <strong>${res.correct}</strong>`;
                target.appendChild(div);
            }
        }

        closeModalBtn.addEventListener('click', () => resultsModal.style.display = 'none');
        reviewBtn.addEventListener('click', () => {
            resultsModal.style.display = 'none';
            showCorrectAnswers();
            scrollToQuestion(27);
        });

        function startTest() {
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('testContainer').classList.remove('hidden');
            timerInterval = setInterval(updateTimer, 1000);
        }

        setupDragDrop();
        restoreSavedAnswers();

        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
        }, 2000);
    
