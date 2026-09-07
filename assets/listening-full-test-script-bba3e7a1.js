
            // Global variables
            let currentPart = 0;
            let answers = {};
            let testSubmitted = false;
            let lastSelection = null;
            let highlightTarget = null;
            let autoUnmutePending = false;
const TEST_STORAGE_ID = 'listening_test_7';
const LEGACY_ANSWER_STORAGE_PREFIX = 'ielts_saved_answers_';
const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const ATTEMPT_QUERY_ID = SEARCH_PARAMS.get('attempt') || '';
const REDO_QUERY = SEARCH_PARAMS.get('redo') === '1';

function persistAnswers() {
    if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
        window.IELTSProgress.saveDraft(TEST_STORAGE_ID, answers);
    }
}

function getLegacySavedAnswersKey() {
    const email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function'
        ? window.IELTSProgress.getEmail()
        : '';
    return LEGACY_ANSWER_STORAGE_PREFIX + (email || 'guest') + '_' + TEST_STORAGE_ID;
}

function restoreDropZoneAnswer(questionId, answerValue) {
    const zone = document.querySelector(`.drop-zone[data-target="q${questionId}"]`);
    if (!zone || !answerValue) return;
    const item = Array.from(document.querySelectorAll('.drag-item')).find((node) =>
        (node.dataset.answer || node.dataset.option || '').toUpperCase() === String(answerValue).toUpperCase()
    );
    if (!item) return;
    zone.dataset.option = item.dataset.option || answerValue;
    zone.dataset.value = item.dataset.answer || answerValue;
    zone.textContent = ''; var _zdv = document.createElement('span'); _zdv.className = 'drop-value'; _zdv.textContent = item.dataset.label || item.textContent.trim(); zone.appendChild(_zdv);
    zone.classList.add('filled');
    zone.draggable = true;
    item.dataset.used = 'true';
    item.classList.add('used');
    item.draggable = false;
    const hiddenInput = document.querySelector(`input[name="q${questionId}"]`);
    if (hiddenInput) hiddenInput.value = item.dataset.answer || answerValue;
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
    answers = stored;

    Object.keys(answers).forEach((key) => {
        const qId = Number(key);
        const value = answers[key];
        if (!value) return;

        if (document.querySelector(`.drop-zone[data-target="q${qId}"]`)) {
            restoreDropZoneAnswer(qId, value);
            return;
        }

        const textInput = document.getElementById(`q${qId}`);
        if (textInput && textInput.type === 'text') {
            textInput.value = value;
            return;
        }

        const radios = document.querySelectorAll(`input[name="q${qId}"][type="radio"]`);
        if (radios.length) {
            const radio = Array.from(radios).find((node) => String(node.value).toUpperCase() === String(value).toUpperCase());
            if (radio) radio.checked = true;
            return;
        }

        let checkboxes = document.querySelectorAll(`input[name="q${qId}"][type="checkbox"]`);
        if (!checkboxes.length) {
            const groupedContainer = Array.from(document.querySelectorAll('[data-multi-group]')).find((node) => {
                const groupName = node.getAttribute('data-multi-group') || '';
                const numbers = (groupName.match(/\d+/g) || []).map((part) => Number(part));
                if (numbers.includes(qId)) return true;
                return numbers.length >= 2 && qId >= Math.min(...numbers) && qId <= Math.max(...numbers);
            });
            if (groupedContainer) {
                const groupName = groupedContainer.getAttribute('data-multi-group');
                checkboxes = document.querySelectorAll(`input[name="${groupName}"][type="checkbox"]`);
            }
        }
        if (checkboxes.length) {
            const rawValue = String(value).trim().toUpperCase();
            const selected = rawValue.indexOf(',') !== -1
                ? rawValue.split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean)
                : rawValue.split('').filter(Boolean);
            checkboxes.forEach((node) => {
                node.checked = selected.includes(String(node.value || '').toUpperCase());
            });
        }
    });
    updateProgress();
}

            function setScreenVisibility(id, isVisible) {
                const element = document.getElementById(id);
                if (!element) return;
                element.hidden = !isVisible;
                element.classList.toggle('hidden', !isVisible);
                if (isVisible) {
                    element.style.removeProperty('display');
                } else {
                    element.style.display = 'none';
                }
            }
            // Block right-click menu and copy shortcuts
            document.addEventListener('contextmenu', (event) => event.preventDefault());
            document.addEventListener('copy', (event) => event.preventDefault());
            document.addEventListener('keydown', (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
                    event.preventDefault();
                }
            });

            const audioSequence = [
                "DAY_28.mp3"
            ];
            window.__listeningFullAudioSequence = audioSequence.slice();
            let currentAudioIndex = 0;
            const testAudioElement = document.getElementById('testAudio');

            function playNextAudio() {
                if (testSubmitted || currentAudioIndex >= audioSequence.length) return;
                const nextSource = audioSequence[currentAudioIndex++];
                if (testAudioElement) {
                    testAudioElement.src = nextSource;
                    testAudioElement.load();
                    triggerAudioPlayback();
                }
            }

            function startAudioSequence() {
                currentAudioIndex = 0;
                if (testAudioElement) {
                    testAudioElement.pause();
                    testAudioElement.currentTime = 0;
                    playNextAudio();
                }
            }

            if (testAudioElement) {
                testAudioElement.addEventListener('ended', () => {
                    playNextAudio();
                });
                testAudioElement.addEventListener('playing', () => {
                    if (autoUnmutePending) {
                        testAudioElement.muted = false;
                        autoUnmutePending = false;
                    }
                });
            }

            function triggerAudioPlayback() {
                if (!testAudioElement) return;
                autoUnmutePending = true;
                testAudioElement.muted = true;
                const playPromise = testAudioElement.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {
                        setTimeout(() => {
                            testAudioElement.play().catch(() => {});
                        }, 250);
                    });
                }
            }

            const correctAnswers = {};
            for (let i = 1; i <= 40; i++) {
                correctAnswers[i] = '';
            }
            correctAnswers[1] = '30 March';
            correctAnswers[2] = '0903775115';
            correctAnswers[3] = 'northern';
            correctAnswers[4] = 'train';
            correctAnswers[5] = 'hotel';
            correctAnswers[6] = 'farm';
            correctAnswers[7] = 'pass';
            correctAnswers[8] = 'booklet';
            correctAnswers[9] = 'insurance';
            correctAnswers[10] = 'internet cafe|internetcafe';
            correctAnswers[11] = 'C';
            correctAnswers[12] = 'F';
            correctAnswers[13] = 'D';
            correctAnswers[14] = 'A';
            correctAnswers[15] = 'H';
            correctAnswers[16] = 'C';
            correctAnswers[17] = 'B';
            correctAnswers[18] = 'C';
            correctAnswers[19] = 'A';
            correctAnswers[20] = 'C';
            correctAnswers[21] = 'A';
            correctAnswers[22] = 'B';
            correctAnswers[23] = 'C';
            correctAnswers[24] = 'A';
            correctAnswers[25] = 'B';
            correctAnswers[26] = 'H';
            correctAnswers[27] = 'D';
            correctAnswers[28] = 'G';
            correctAnswers[29] = 'E';
            correctAnswers[30] = 'F';
            correctAnswers[31] = 'traditional';
            correctAnswers[32] = 'time';
            correctAnswers[33] = 'money';
            correctAnswers[34] = 'confidence';
            correctAnswers[35] = 'guesses';
            correctAnswers[36] = 'walking';
            correctAnswers[37] = 'link';
            correctAnswers[38] = 'concentration';
            correctAnswers[39] = 'additional';
            correctAnswers[40] = 'teachers';

            // Test Section Data
            const testData = [
                {
                    title: "SECTION 1",
                    instructions: "Questions 1-10: International Student Travel Agency Enquiry Form",
                    description: "Complete the form below. NO MORE THAN TWO WORDS AND/OR A NUMBER.",
                    questionRange: "1-10"
                },
                {
                    title: "SECTION 2",
                    instructions: "Questions 11-20: Bookshop map and multiple choice",
                    description: "Q11-15 table labeling and Q16-20 multiple choice.",
                    questionRange: "11-20"
                },
                {
                    title: "SECTION 3",
                    instructions: "Questions 21-30: The Just-in-Time Supply System (JIT)",
                    description: "Q21-24 multiple choice and Q25-30 drag-and-drop.",
                    questionRange: "21-30"
                },
                {
                    title: "SECTION 4",
                    instructions: "Questions 31-40: Dyscalculia",
                    description: "Complete the notes below.",
                    questionRange: "31-40"
                }
            ];

            const partRanges = [
                { start: 1, end: 10 },
                { start: 11, end: 20 },
                { start: 21, end: 30 },
                { start: 31, end: 40 }
            ];
            const partTotals = partRanges.map(range => range.end - range.start + 1);

            const radioQuestionIds = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
            const multiSelectQuestionIds = [];
            const dropZoneQuestionIds = [25, 26, 27, 28, 29, 30];

            function getPartIndex(questionId) {
                return partRanges.findIndex(range => questionId >= range.start && questionId <= range.end);
            }

            // Initialize on load
            window.addEventListener('load', () => {
                setTimeout(() => {
                    setScreenVisibility('loadingScreen', false);
                    setScreenVisibility('startScreen', true);
                }, 3000);
            });

            function startTest() {
                setScreenVisibility('loadingScreen', false);
                setScreenVisibility('startScreen', false);
                setScreenVisibility('testInterface', true);
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                startAudioSequence();
                updatePartDisplay();
                updateNavigation();
                initializeHighlighting();
                setupDragDrop();
                if (window.IELTSProgress && typeof window.IELTSProgress.initSync === 'function') {
                    window.IELTSProgress.initSync().then(function () {
                        restoreSavedAnswers();
                        updateProgress();
                    });
                } else {
                    restoreSavedAnswers();
                    updateProgress();
                }
            }

            function switchPart(partIndex) {
                currentPart = partIndex;
                updatePartDisplay();
                updateNavigation();
            }

            function nextPart() {
                if (currentPart < testData.length - 1) {
                    switchPart(currentPart + 1);
                }
            }

            function updatePartDisplay() {
                const partData = testData[currentPart];
                document.getElementById('partTitle').textContent = partData.title;
                document.getElementById('partInstructions').textContent = partData.instructions;
                document.getElementById('questionsTitle').textContent = `Questions ${partData.questionRange}`;
                document.getElementById('questionsDescription').textContent = partData.description;
                for (let i = 1; i <= 4; i++) {
                    document.getElementById(`part${i}Content`).classList.add('hidden');
                }
                document.getElementById(`part${currentPart + 1}Content`).classList.remove('hidden');
            }

            function updateNavigation() {
                for (let i = 1; i <= 4; i++) {
                    const btn = document.getElementById(`part${i}Btn`);
                    btn.classList.toggle('active', i === currentPart + 1);
                }
                for (let i = 1; i <= 4; i++) {
                    const nums = document.getElementById(`part${i}Questions`);
                    nums.classList.toggle('hidden', i !== currentPart + 1);
                }
                document.getElementById('nextButton').disabled = (currentPart === 3);
            }

            function focusQuestion(qNum) {
                const el = document.getElementById(`q${qNum}`);
                if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            function saveAnswer(qId, value) {
                answers[qId] = value;
                persistAnswers();
                updateProgress();
            }

            function updateCheckboxGroup(qIds, groupName) {
                const checkedValues = Array.from(document.querySelectorAll(`input[name="${groupName}"]:checked`))
                    .map(input => input.value.toUpperCase());
                checkedValues.sort();
                const combined = checkedValues.join('');
                qIds.forEach(id => {
                    answers[id] = combined;
                });
                persistAnswers();
                updateProgress();
            }

            function updateProgress() {
                const total = 40;
                const answered = Object.values(answers).filter(val => val && val.toString().trim() !== '').length;
                const percent = total ? Math.min(100, Math.round((answered / total) * 100)) : 0;
                const fill = document.getElementById('progressFill');
                const label = document.getElementById('progressLabel');
                if (fill) {
                    fill.style.width = `${percent}%`;
                }
                if (label) {
                    label.textContent = `${answered}/${total} answered`;
                }
            }

            const multiGroupMap = {};
            const multiSelectSettings = {};

            function getAnswerVariants(rawCorrectAnswer) {
                if (!rawCorrectAnswer) return [];
                return rawCorrectAnswer.toString().split('|').map(option => option.trim().toLowerCase()).filter(Boolean);
            }

            function matchesAnswer(normalizedUser, rawCorrectAnswer) {
                const variants = getAnswerVariants(rawCorrectAnswer);
                return variants.length > 0 && variants.includes(normalizedUser);
            }

            function getMultiGroupCorrectLetters(groupName) {
                const setting = multiSelectSettings[groupName];
                if (setting && setting.type === 'perLetter') {
                    return Array.from(new Set(Object.values(setting.answers || {}).map(letter => letter.toUpperCase())));
                }
                const matchingId = Object.keys(multiGroupMap).find(id => multiGroupMap[id] === groupName);
                if (!matchingId) return [];
                const correctValue = (correctAnswers[matchingId] || '').toString().trim().toUpperCase();
                return correctValue ? correctValue.split('') : [];
            }

            function submitTest() {
                if (testSubmitted) return;
                testSubmitted = true;
                currentAudioIndex = audioSequence.length;
                autoUnmutePending = false;
                if (testAudioElement) {
                    testAudioElement.pause();
                    testAudioElement.currentTime = 0;
                    testAudioElement.removeAttribute('src');
                    testAudioElement.load();
                }
                document.getElementById('submitBtn').disabled = true;
                const results = checkAnswers();
                showResults(results);
                highlightAnswers();
                showCorrectAnswers();
            }

            function checkAnswers() {
                let totalCorrect = 0;
                let partScores = [0, 0, 0, 0];
                let detailedResults = [];

                for (let i = 1; i <= 40; i++) {
                    const rawUserAnswer = (answers[i] || '').trim();
                    const rawCorrectAnswer = correctAnswers[i] || '';
                    let isCorrect = false;
                    const groupName = multiGroupMap[i];

                    if (groupName) {
                        const normalizedUser = rawUserAnswer.toString().trim().toUpperCase();
                        const multiSetting = multiSelectSettings[groupName];
                        if (multiSetting && multiSetting.type === 'perLetter') {
                            const targetLetter = (multiSetting.answers[i] || '').toString().toUpperCase();
                            isCorrect = Boolean(targetLetter && normalizedUser.includes(targetLetter));
                        } else {
                            const normalizedExpected = rawCorrectAnswer.toString().trim().toUpperCase();
                            isCorrect = normalizedExpected && normalizedUser === normalizedExpected;
                        }
                    } else {
                        const normalizedUser = rawUserAnswer.toLowerCase();
                        isCorrect = matchesAnswer(normalizedUser, rawCorrectAnswer);
                    }

                    if (isCorrect) {
                        const partIndex = getPartIndex(i);
                        if (partIndex !== -1) {
                            partScores[partIndex]++;
                        }
                        totalCorrect++;
                    }

                    detailedResults.push({
                        questionId: i,
                        userAnswer: rawUserAnswer || 'No answer',
                        correctAnswer: rawCorrectAnswer || 'Not set',
                        isCorrect
                    });
                }

                window.testResults = detailedResults;
                return { totalCorrect, partScores, detailedResults };
            }

            function showCorrectAnswers() {
                document.querySelectorAll('.answer-feedback').forEach(el => el.remove());
                const results = window.testResults || [];

                results.forEach(({ questionId, userAnswer, correctAnswer, isCorrect }) => {
                    const container = findFeedbackContainer(questionId);
                    if (!container) return;
                    const feedback = document.createElement('div');
                    feedback.className = 'answer-feedback';
                    feedback.style.padding = '8px';
                    feedback.style.margin = '6px 0';
                    feedback.style.fontSize = '14px';
                    feedback.style.borderRadius = '4px';
                    feedback.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da';
                    feedback.style.color = isCorrect ? '#155724' : '#721c24';
                    const correctLabel = correctAnswer || 'Not set';
                    if (isCorrect) {
                        var _sf = document.createElement('strong'); _sf.textContent = 'Correct.'; feedback.appendChild(_sf);
                        feedback.appendChild(document.createTextNode(' You answered: '));
                        var _ef = document.createElement('em'); _ef.textContent = userAnswer; feedback.appendChild(_ef);
                    } else {
                        var _sf = document.createElement('strong'); _sf.textContent = 'Incorrect.'; feedback.appendChild(_sf);
                        feedback.appendChild(document.createTextNode(' You answered: '));
                        var _ef = document.createElement('em'); _ef.textContent = userAnswer; feedback.appendChild(_ef);
                        feedback.appendChild(document.createElement('br'));
                        var _sf2 = document.createElement('strong'); _sf2.textContent = 'Correct:'; feedback.appendChild(_sf2);
                        feedback.appendChild(document.createTextNode(' '));
                        var _ef2 = document.createElement('em'); _ef2.textContent = correctLabel; feedback.appendChild(_ef2);
                    }
                    container.appendChild(feedback);
                });
            }

            function findFeedbackContainer(questionId) {
                if (radioQuestionIds.includes(questionId)) {
                    return getMultipleChoiceContainer(questionId);
                }
                if (multiSelectQuestionIds.includes(questionId)) {
                    const direct = document.querySelector(`[data-multi-target="q${questionId}"]`);
                    if (direct) return direct;
                    const groupName = multiGroupMap[questionId];
                    if (groupName) {
                        return document.querySelector(`[data-multi-group="${groupName}"]`);
                    }
                    return null;
                }
                if (dropZoneQuestionIds.includes(questionId)) {
                    return (function (node) { return node && node.closest ? node.closest('.drop-item') : null; })(document.querySelector(`.drop-zone[data-target="q${questionId}"]`));
                }
                return (function (node) { return node ? node.parentNode : null; })(document.getElementById(`q${questionId}`));
            }

            function getMultipleChoiceContainer(questionId) {
                const firstInput = document.querySelector(`input[name="q${questionId}"]`);
                if (!firstInput) return null;
                return firstInput.closest('.multiple-choice-block') || firstInput.closest('tr');
            }

            function highlightAnswers() {
                document.querySelectorAll('.correct, .incorrect').forEach(el => {
                    el.classList.remove('correct', 'incorrect');
                });
                document.querySelectorAll('.choice-item').forEach(el => {
                    el.classList.remove('correct', 'incorrect');
                });

                for (let i = 1; i <= 40; i++) {
                    const input = document.getElementById(`q${i}`);
                    if (input) {
                        const user = (answers[i] || '').trim().toLowerCase();
                        const isCorrect = matchesAnswer(user, correctAnswers[i]);
                        if (user) {
                            input.classList.add(isCorrect ? 'correct' : 'incorrect');
                        } else {
                            input.classList.remove('correct', 'incorrect');
                        }
                    }
                }

                radioQuestionIds.forEach(qId => {
                    document.querySelectorAll(`input[name="q${qId}"]`).forEach(radio => {
                        const choiceItem = radio.closest('.choice-item');
                        if (choiceItem) {
                            if (radio.value === correctAnswers[qId]) {
                                choiceItem.classList.add('correct');
                            } else if (radio.checked) {
                                choiceItem.classList.add('incorrect');
                            }
                            return;
                        }

                        const tableRow = radio.closest('tr');
                        if (tableRow && radio.checked) {
                            const isCorrect = radio.value === (correctAnswers[qId] || '').toString().toUpperCase();
                            tableRow.classList.add(isCorrect ? 'correct' : 'incorrect');
                        }
                    });
                });

                const processedGroups = new Set();
                Object.entries(multiGroupMap).forEach(([qId, groupName]) => {
                    if (processedGroups.has(groupName)) return;
                    processedGroups.add(groupName);
                    const correctLetters = getMultiGroupCorrectLetters(groupName);
                    document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
                        const item = input.closest('.choice-item');
                        if (!item) return;
                        const optionValue = (input.value || '').toString().toUpperCase();
                        if (correctLetters.includes(optionValue)) {
                            item.classList.add('correct');
                        } else if (input.checked) {
                            item.classList.add('incorrect');
                        }
                    });
                });

                dropZoneQuestionIds.forEach(qId => {
                    const zone = document.querySelector(`.drop-zone[data-target="q${qId}"]`);
                    if (!zone || !zone.dataset.value) return;
                    const userValue = (zone.dataset.value || '').toString().toUpperCase();
                    const correctValue = (correctAnswers[qId] || '').toString().toUpperCase();
                    const isCorrect = correctValue && userValue === correctValue;
                    zone.classList.add(isCorrect ? 'correct' : 'incorrect');
                });
            }function showResults(results) {
    if (window.IELTSProgress && typeof window.IELTSProgress.trackTestResult === 'function') {
        window.IELTSProgress.trackTestResult('listening', {
            score: results.totalCorrect,
            total: 40,
            label: 'Listening Test 7',
            test_id: TEST_STORAGE_ID,
            answers: Object.assign({}, answers)
        });
    }document.getElementById('totalScore').textContent = `${results.totalCorrect}/40`;
                document.getElementById('part1Score').textContent = `${results.partScores[0]}/${partTotals[0]}`;
                document.getElementById('part2Score').textContent = `${results.partScores[1]}/${partTotals[1]}`;
                document.getElementById('part3Score').textContent = `${results.partScores[2]}/${partTotals[2]}`;
                document.getElementById('part4Score').textContent = `${results.partScores[3]}/${partTotals[3]}`;
                const submittedMenuLink = document.getElementById('submittedMenuLink');
                if (submittedMenuLink) submittedMenuLink.style.display = 'inline-flex';
                document.getElementById('resultsModal').classList.remove('hidden');
            }

            function closeResults() {
                document.getElementById('resultsModal').classList.add('hidden');
            }

            function initializeHighlighting() {
                const highlightBtn = document.getElementById('highlight-btn');
                const removeBtn = document.getElementById('remove-highlight-btn');
                const panel = document.querySelector('.questions-section');
                let storedHighlightRange = null;

                function getSelection() {
                    const sel = window.getSelection();
                    if (sel.rangeCount && !sel.isCollapsed) {
                        const range = sel.getRangeAt(0);
                        const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
                        const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer;
                        if (panel.contains(startNode) && panel.contains(endNode)) {
                            return range;
                        }
                    }
                    return null;
                }

                function applyHighlightInPlace(range) {
                    const rootNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                        ? range.commonAncestorContainer.parentNode
                        : range.commonAncestorContainer;
                    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
                        acceptNode(node) {
                            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                            if (!panel.contains(node.parentNode)) return NodeFilter.FILTER_REJECT;
                            if (node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('highlight')) return NodeFilter.FILTER_REJECT;
                            try {
                                const startsAfterRange = range.comparePoint(node, 0) === 1;
                                const endsBeforeRange = range.comparePoint(node, node.length) === -1;
                                return startsAfterRange || endsBeforeRange
                                    ? NodeFilter.FILTER_REJECT
                                    : NodeFilter.FILTER_ACCEPT;
                            } catch (error) {
                                return NodeFilter.FILTER_REJECT;
                            }
                        }
                    });

                    const nodes = [];
                    let currentNode = walker.nextNode();
                    while (currentNode) {
                        nodes.push(currentNode);
                        currentNode = walker.nextNode();
                    }

                    nodes.forEach((node) => {
                        let startOffset = 0;
                        let endOffset = node.length;

                        while (startOffset < node.length && range.comparePoint(node, startOffset) === -1) {
                            startOffset++;
                        }
                        while (endOffset > startOffset && range.comparePoint(node, endOffset) === 1) {
                            endOffset--;
                        }
                        if (endOffset <= startOffset) return;

                        let selectedTextNode = node;
                        if (endOffset < selectedTextNode.length) {
                            selectedTextNode.splitText(endOffset);
                        }
                        if (startOffset > 0) {
                            selectedTextNode = selectedTextNode.splitText(startOffset);
                        }

                        const span = document.createElement('span');
                        span.className = 'highlight';
                        selectedTextNode.parentNode.insertBefore(span, selectedTextNode);
                        span.appendChild(selectedTextNode);
                    });
                }

                highlightBtn.addEventListener('click', () => {
                    const selectedRange = getSelection() || storedHighlightRange;
                    const range = selectedRange ? selectedRange.cloneRange() : null;
                    if (range) {
                        applyHighlightInPlace(range);
                        window.getSelection().removeAllRanges();
                        storedHighlightRange = null;
                        highlightBtn.style.display = 'none';
                    }
                });

                removeBtn.addEventListener('click', () => {
                    if (highlightTarget) {
                        const parent = highlightTarget.parentNode;
                        while (highlightTarget.firstChild) parent.insertBefore(highlightTarget.firstChild, highlightTarget);
                        parent.removeChild(highlightTarget);
                        removeBtn.style.display = 'none';
                    }
                });

                document.addEventListener('selectionchange', () => {
                    const range = getSelection();
                    if (range) {
                        storedHighlightRange = range.cloneRange();
                        const rect = range.getBoundingClientRect();
                        highlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
                        highlightBtn.style.left = (window.scrollX + rect.left) + 'px';
                        highlightBtn.style.display = 'block';
                    } else {
                        storedHighlightRange = null;
                        highlightBtn.style.display = 'none';
                    }
                });

                panel.addEventListener('click', (e) => {
                    if (e.target.classList.contains('highlight')) {
                        highlightTarget = e.target;
                        const rect = e.target.getBoundingClientRect();
                        removeBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
                        removeBtn.style.left = (window.scrollX + rect.left) + 'px';
                        removeBtn.style.display = 'block';
                    }
                });

                document.addEventListener('mousedown', (e) => {
                    if (!['highlight-btn', 'remove-highlight-btn'].includes(e.target.id)) {
                        highlightBtn.style.display = 'none';
                        removeBtn.style.display = 'none';
                    }
                });
            }

            function setupDragDrop() {
                const zones = document.querySelectorAll('.drop-zone');
                const items = document.querySelectorAll('.drag-item');
                const optionBins = document.querySelectorAll('.drag-options');

                const releaseOption = (option) => {
                    if (!option) return;
                    const item = document.querySelector(`.drag-item[data-option="${option}"]`);
                    if (!item || item.dataset.multiple === 'true') return;
                    item.dataset.used = "false";
                    item.classList.remove('used');
                    item.draggable = true;
                };

                const updateHiddenInput = (name, value) => {
                    if (!name) return;
                    const input = document.querySelector(`input[name="${name}"]`);
                    if (input) {
                        input.value = value;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                };

                items.forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    if (item.dataset.used === "true") {
                        e.preventDefault();
                        return;
                    }
                    const optionId = item.dataset.option || '';
                    const answerValue = item.dataset.answer || optionId;
                    const labelText = item.dataset.label || item.textContent.trim() || answerValue;
                    e.dataTransfer.setData('text/plain', optionId);
                    e.dataTransfer.setData('text/label', labelText);
                    e.dataTransfer.setData('text/answer', answerValue);
                    e.dataTransfer.setData('text/multiple', item.dataset.multiple || '');
                });
                });

                zones.forEach(zone => {
                    const placeholder = zone.dataset.placeholder || zone.textContent;
                    const isMultiple = zone.dataset.multiple === 'true';
                    zone.textContent = ''; var _zph = document.createElement('span'); _zph.className = 'placeholder'; _zph.textContent = placeholder; zone.appendChild(_zph);

                    zone.addEventListener('dragover', (e) => e.preventDefault());
                    zone.addEventListener('drop', (e) => {
                        e.preventDefault();
                        const optionId = e.dataTransfer.getData('text/plain');
                        if (!optionId) return;
                        const label = e.dataTransfer.getData('text/label') || optionId;
                        const answer = e.dataTransfer.getData('text/answer') || optionId;
                        const sourceZone = e.dataTransfer.getData('text/source-zone');
                        if (!isMultiple && zone.dataset.option && zone.dataset.option !== optionId) {
                            releaseOption(zone.dataset.option);
                        }
                        if (sourceZone) {
                            const srcEl = document.querySelector(`.drop-zone[data-target="${sourceZone}"]`);
                            if (srcEl && srcEl !== zone) {
                                srcEl.dataset.value = '';
                                delete srcEl.dataset.option;
                                const srcPlaceholder = srcEl.dataset.placeholder || '';
                                srcEl.textContent = ''; var _zph2 = document.createElement('span'); _zph2.className = 'placeholder'; _zph2.textContent = srcPlaceholder; srcEl.appendChild(_zph2);
                                srcEl.classList.remove('filled');
                                srcEl.draggable = false;
                                updateHiddenInput(sourceZone, '');
                            }
                        }
                        zone.dataset.option = optionId;
                        zone.dataset.value = answer;
                        zone.textContent = ''; var _zdv = document.createElement('span'); _zdv.className = 'drop-value'; _zdv.textContent = label; zone.appendChild(_zdv);
                        zone.classList.add('filled');
                        if (!isMultiple) {
                            zone.draggable = true;
                            const item = document.querySelector(`.drag-item[data-option="${optionId}"]`);
                            if (item && !sourceZone) {
                                item.dataset.used = "true";
                                item.classList.add('used');
                                item.draggable = false;
                            }
                        } else {
                            zone.draggable = false;
                        }
                        updateHiddenInput(zone.dataset.target, answer);
                    });

                    zone.addEventListener('dragstart', (e) => {
                        if (isMultiple || !zone.dataset.option) {
                            e.preventDefault();
                            return;
                        }
                        const optionId = zone.dataset.option;
                        const answer = zone.dataset.value || optionId;
                        const label = (function (node) { return node ? node.textContent.trim() : ''; })(zone.querySelector('.drop-value')) || zone.textContent.trim();
                        e.dataTransfer.setData('text/plain', optionId);
                        e.dataTransfer.setData('text/label', label);
                        e.dataTransfer.setData('text/answer', answer);
                        e.dataTransfer.setData('text/source-zone', zone.dataset.target);
                    });

                    zone.addEventListener('dblclick', () => {
                        if (!isMultiple && zone.dataset.option) {
                            releaseOption(zone.dataset.option);
                        }
                        zone.dataset.value = '';
                        delete zone.dataset.option;
                        zone.textContent = ''; var _zph = document.createElement('span'); _zph.className = 'placeholder'; _zph.textContent = placeholder; zone.appendChild(_zph);
                        zone.classList.remove('filled');
                        zone.draggable = false;
                        updateHiddenInput(zone.dataset.target, '');
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
                        if (zone) {
                            zone.dataset.value = '';
                            delete zone.dataset.option;
                            const resetPlaceholder = zone.dataset.placeholder || '';
                            zone.textContent = ''; var _zph = document.createElement('span'); _zph.className = 'placeholder'; _zph.textContent = resetPlaceholder; zone.appendChild(_zph);
                            zone.classList.remove('filled');
                            zone.draggable = false;
                            updateHiddenInput(source, '');
                        }
                        releaseOption(option);
                    });
                });
            }

            /* Options modal & fullscreen controls */
            const optionsModal = document.getElementById('options-modal');
            const optionsTitleEl = document.getElementById('options-title');
            const optionsBackBtn = document.getElementById('options-back');
            const optionsHome = document.getElementById('options-home');
            const contrastMenu = document.getElementById('contrast-menu');
            const textSizeMenu = document.getElementById('textsize-menu');
            const optionsMenuBtn = document.getElementById('optionsMenuBtn');
            const closeOptionsBtn = document.getElementById('close-options');
            const contrastDescriptions = {
                normal: 'Black on white',
                whiteblack: 'White on black',
                yellowblack: 'Yellow on black'
            };
            const textSizeDescriptions = {
                small: 'Small',
                medium: 'Medium',
                large: 'Large',
                xlarge: 'Extra large'
            };
            let selectedContrast = 'normal';
            let selectedTextSize = 'medium';

            function switchOptionsView(view) {
                if (!optionsModal) return;
                if (optionsHome) optionsHome.classList.toggle('hidden', view !== 'home');
                if (contrastMenu) contrastMenu.classList.toggle('hidden', view !== 'contrast');
                if (textSizeMenu) textSizeMenu.classList.toggle('hidden', view !== 'textsize');
                if (optionsBackBtn) {
                    optionsBackBtn.style.visibility = view === 'home' ? 'hidden' : 'visible';
                }
                if (optionsTitleEl) {
                    optionsTitleEl.textContent = view === 'home' ? 'Options' : view === 'contrast' ? 'Contrast' : 'Text size';
                }
            }

            function openOptions() {
                if (!optionsModal) return;
                optionsModal.classList.remove('hidden');
                switchOptionsView('home');
            }

            function closeOptions() {
                if (!optionsModal) return;
                optionsModal.classList.add('hidden');
            }

            function applyContrast(mode) {
                selectedContrast = mode;
                document.body.classList.remove('contrast-white-black', 'contrast-yellow-black');
                if (mode === 'whiteblack') {
                    document.body.classList.add('contrast-white-black');
                } else if (mode === 'yellowblack') {
                    document.body.classList.add('contrast-yellow-black');
                }
                const label = contrastDescriptions[mode] || contrastDescriptions.normal;
                const contrastCurrent = document.getElementById('contrast-current');
                if (contrastCurrent) {
                    contrastCurrent.textContent = label;
                }
                if (contrastMenu) {
                    contrastMenu.querySelectorAll('button').forEach(btn => {
                        btn.classList.toggle('selected', btn.dataset.contrast === mode);
                    });
                }
            }

            function applyTextSize(size) {
                selectedTextSize = size;
                const mapping = { small: '14px', medium: '16px', large: '19px', xlarge: '22px' };
                document.documentElement.style.fontSize = mapping[size] || mapping.medium;
                const label = textSizeDescriptions[size] || textSizeDescriptions.medium;
                const textSizeCurrent = document.getElementById('textsize-current');
                if (textSizeCurrent) {
                    textSizeCurrent.textContent = label;
                }
                if (textSizeMenu) {
                    textSizeMenu.querySelectorAll('button').forEach(btn => {
                        btn.classList.toggle('selected', btn.dataset.textsize === size);
                    });
                }
            }

            if (optionsHome) {
                const rows = optionsHome.querySelectorAll('.option-row');
                rows.forEach(row => {
                    row.addEventListener('click', () => {
                        const target = row.dataset.target;
                        if (target) switchOptionsView(target);
                    });
                });
            }

            if (contrastMenu) {
                contrastMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const mode = btn.dataset.contrast;
                        if (mode) {
                            applyContrast(mode);
                            switchOptionsView('home');
                        }
                    });
                });
            }

            if (textSizeMenu) {
                textSizeMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const size = btn.dataset.textsize;
                        if (size) {
                            applyTextSize(size);
                            switchOptionsView('home');
                        }
                    });
                });
            }

            if (optionsMenuBtn) optionsMenuBtn.addEventListener('click', openOptions);
            if (closeOptionsBtn) closeOptionsBtn.addEventListener('click', closeOptions);
            if (optionsBackBtn) optionsBackBtn.addEventListener('click', () => switchOptionsView('home'));
            window.addEventListener('click', (event) => {
                if (event.target === optionsModal) {
                    closeOptions();
                }
            });

            applyContrast(selectedContrast);
            applyTextSize(selectedTextSize);

            const fsBtn = document.getElementById('fullscreenBtn');
            if (fsBtn) {
                fsBtn.addEventListener('click', () => {
            const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            if (!fullscreenElement) {
                const requestFullscreen = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
                if (requestFullscreen) {
                    try {
                        const request = requestFullscreen.call(document.documentElement);
                        if (request && typeof request.catch === 'function') request.catch(() => {});
                    } catch (error) {
                        console.warn('Fullscreen failed', error);
                    }
                }
            } else {
                const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
                if (exitFullscreen) exitFullscreen.call(document);
            }
        });
            }
        