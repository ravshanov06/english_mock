
    // Global variables
    let currentPart = 0;
    let answers = window.answers && typeof window.answers === 'object' ? window.answers : {};
      window.answers = answers;
      let testSubmitted = !!window.testSubmitted;
      window.testSubmitted = testSubmitted;
    let lastSelection = null;
    let highlightTarget = null;
    let uiControlsInitialized = false;

    // Block right-click menu and copy shortcuts
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('copy', (event) => event.preventDefault());
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            event.preventDefault();
        }
    });

    // Correct Answers
    const correctAnswers = {
        11: ["a"],
        12: ["a"],
        13: ["b"],
        14: ["c"],
        15: ["c"],
        16: ["b"],
        17: ["c"],
        18: ["d"],
        19: ["a"],
        20: ["f"]
    };

    function getNormalizedCorrectValues(questionId) {
        const entry = correctAnswers[questionId];
        if (Array.isArray(entry)) {
            return entry
                .map(item => item.toString().trim().toLowerCase())
                .filter(Boolean);
        }
        if (entry !== undefined && entry !== null && entry !== '') {
            return [entry.toString().trim().toLowerCase()];
        }
        return [];
    }

    // Test Section Data
    const testData = [
        {
            title: "PART 2",
            instructions: "Answer the multiple-choice questions and match responsibilities for the Electronic Toy Company.",
            description: "Listen for the staffing updates and choose the correct answers for Questions 11-20.",
            questionRange: "11-20"
        }
    ];

    const partRanges = [
        { start: 11, end: 20 }
    ];

    const totalParts = testData.length;
    const totalQuestions = partRanges.reduce((sum, range) => sum + (range.end - range.start + 1), 0);

    function getPartIndex(questionId) {
        return partRanges.findIndex(range => questionId >= range.start && questionId <= range.end);
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
    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            setScreenVisibility('loadingScreen', false);
            setScreenVisibility('startScreen', true);
        }, 3000);
        try {
            setupUIControls();
        } catch (error) {
            console.warn('setupUIControls failed', error);
        }
    });

    function startTest() {
        setScreenVisibility('loadingScreen', false);
        setScreenVisibility('startScreen', false);
        setScreenVisibility('testInterface', true);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        const testAudio = document.getElementById('testAudio');
        if (testAudio) {
            testAudio.currentTime = 0;
            testAudio.play().catch(() => {});
        }
        updatePartDisplay();
        updateNavigation();
        (function (node) { if (node) node.classList.remove('answers-visible'); })(document.querySelector('.questions-section'));
        (function (node) { if (node) node.classList.add('hidden'); })(document.querySelector('.audio-controller-bar'));
prepopulateForm(formPrefillAnswers);
        initializeHighlighting();
        setupDragDrop();
        setupUIControls();
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
        const partContents = document.querySelectorAll('[id^="part"][id$="Content"]');
        partContents.forEach(section => section.classList.add('hidden'));
        const activeContent = document.getElementById(`part${currentPart + 1}Content`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    function updateNavigation() {
        for (let i = 0; i < totalParts; i++) {
            const btn = document.getElementById(`part${i + 1}Btn`);
            if (btn) {
                btn.classList.toggle('active', i === currentPart);
            }
            const nums = document.getElementById(`part${i + 1}Questions`);
            if (nums) {
                nums.classList.toggle('hidden', i !== currentPart);
            }
        }
        const nextButton = document.getElementById('nextButton');
        if (nextButton) {
            nextButton.disabled = (currentPart === totalParts - 1);
        }
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
    }

    const formPrefillAnswers = {}; // kept for future sections but currently empty so inputs remain blank

    function prepopulateForm(prefills) {
        Object.entries(prefills).forEach(([id, value]) => {
            const input = document.getElementById(`q${id}`);
            if (input) {
                input.value = value;
                saveAnswer(Number(id), value);
            }
        });
    }

    function showCorrectAnswers() {
        document.querySelectorAll('.answer-feedback').forEach(el => el.remove());
        const results = window.testResults || [];
        results.forEach(({ questionId, userAnswer, correctAnswer, isCorrect }) => {
            let container = null;
            if (questionId >= 11 && questionId <= 15) {
                container = document.getElementById(`q${questionId}`);
            } else if (questionId >= 16 && questionId <= 20) {
                const zone = document.querySelector(`.drop-zone[data-target="q${questionId}"]`);
                container = (zone && zone.closest('.person-row')) || zone;
            } else {
                const input = document.getElementById(`q${questionId}`);
                if (input) {
                    container = input.parentNode;
                }
            }
            if (!container) return;
            const feedback = document.createElement('div');
            feedback.className = 'answer-feedback';
            feedback.style.padding = '8px';
            feedback.style.margin = '6px 0';
            feedback.style.fontSize = '14px';
            feedback.style.borderRadius = '4px';
            feedback.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da';
            feedback.style.color = isCorrect ? '#155724' : '#721c24';
            if (isCorrect) {
                var _sf = document.createElement('strong'); _sf.textContent = '✓ Correct.'; feedback.appendChild(_sf);
                feedback.appendChild(document.createTextNode(' You answered: '));
                var _ef = document.createElement('em'); _ef.textContent = userAnswer; feedback.appendChild(_ef);
            } else {
                var _sf = document.createElement('strong'); _sf.textContent = '✗ Incorrect.'; feedback.appendChild(_sf);
                feedback.appendChild(document.createTextNode(' You answered: '));
                var _ef = document.createElement('em'); _ef.textContent = userAnswer; feedback.appendChild(_ef);
                feedback.appendChild(document.createElement('br'));
                var _sf2 = document.createElement('strong'); _sf2.textContent = 'Correct:'; feedback.appendChild(_sf2);
                feedback.appendChild(document.createTextNode(' '));
                var _ef2 = document.createElement('em'); _ef2.textContent = correctAnswer; feedback.appendChild(_ef2);
            }
            container.appendChild(feedback);
        });
        const questionsSection = document.querySelector('.questions-section');
        if (questionsSection) {
            questionsSection.classList.add('answers-visible');
        }
    }

    function highlightAnswers() {
        document.querySelectorAll('.correct, .incorrect').forEach(el => {
            el.classList.remove('correct', 'incorrect');
        });
        document.querySelectorAll('.choice-item').forEach(el => {
            el.classList.remove('correct', 'incorrect');
        });
        for (let i = 11; i <= 20; i++) {
            const input = document.getElementById(`q${i}`);
            if (input) {
                const user = (answers[i] || '').trim().toLowerCase();
                const correctValues = getNormalizedCorrectValues(i);
                const isCorrect = correctValues.length > 0 && correctValues.includes(user);
                input.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
        }
        const radioSections = [
            { start: 11, end: 15 }
        ];
        radioSections.forEach(section => {
            for (let qId = section.start; qId <= section.end; qId++) {
                document.querySelectorAll(`input[name="q${qId}"]`).forEach(radio => {
                    const item = radio.closest('.choice-item');
                    if (!item) return;
                    const radioValue = radio.value.trim().toLowerCase();
                    const correctValues = getNormalizedCorrectValues(qId);
                    if (correctValues.includes(radioValue)) {
                        item.classList.add('correct');
                    } else if (radio.checked) {
                        item.classList.add('incorrect');
                    }
                });
            }
        });
        [16, 17, 18, 19, 20].forEach(qId => {
            const zone = document.querySelector(`.drop-zone[data-target="q${qId}"]`);
            if (!zone) return;
            const userValue = (zone.dataset.value || '').trim().toLowerCase();
            const correctValues = getNormalizedCorrectValues(qId);
            const isCorrect = correctValues.length > 0 && correctValues.includes(userValue);
            zone.classList.add(isCorrect ? 'correct' : 'incorrect');
        });
    }

    function setupDragDrop() {
        const zones = document.querySelectorAll('.drop-zone');
        const items = document.querySelectorAll('.drag-item');
        if (!zones.length || !items.length) return;
        const optionBins = document.querySelectorAll('.drag-options');

        let selectedDragItem = null;

        const clearSelected = () => {
            if (!selectedDragItem) return;
            selectedDragItem.classList.remove('selected');
            selectedDragItem = null;
        };

        const releaseOption = (option, group = '') => {
            if (!option) return;
            const selector = `.drag-item[data-option="${option}"]${group ? `[data-group="${group}"]` : ''}`;
            const item = document.querySelector(selector);
            if (!item) return;
            const reusable = item.dataset.reusable === "true";
            if (!reusable) {
                item.dataset.used = "false";
                item.classList.remove('used');
                item.draggable = true;
            }
            if (selectedDragItem === item) {
                clearSelected();
            }
        };

        const selectDragItem = (item) => {
            if (!item || item.dataset.used === "true") return;
            if (selectedDragItem === item) {
                clearSelected();
                return;
            }
            clearSelected();
            selectedDragItem = item;
            selectedDragItem.classList.add('selected');
        };

        const applyToZone = (zone, option, label, group) => {
            if (!zone || !option) return;
            const normalizedLabel = label || option;
            const targetGroup = zone.dataset.group || group || '';
            if (zone.dataset.value && zone.dataset.value !== option) {
                releaseOption(zone.dataset.value, targetGroup);
            }
            zone.dataset.value = option;
            zone.classList.add('filled');
            zone.textContent = ''; var _zdv = document.createElement('span'); _zdv.className = 'drop-value'; _zdv.textContent = normalizedLabel; zone.appendChild(_zdv);
            const selector = `.drag-item[data-option="${option}"]${targetGroup ? `[data-group="${targetGroup}"]` : ''}`;
            const item = document.querySelector(selector);
            if (item) {
                const reusable = item.dataset.reusable === "true";
                if (!reusable) {
                    item.dataset.used = "true";
                    item.classList.add('used');
                    item.draggable = false;
                }
                item.classList.remove('selected');
            }
            clearSelected();
            const qId = Number((zone.dataset.target || '').replace('q', ''));
            if (qId) {
                saveAnswer(qId, option);
            }
        };

        const resetZone = (zone) => {
            if (!zone) return;
            const placeholder = zone.dataset.placeholder || 'Drop letter';
            const storedValue = zone.dataset.value;
            const group = zone.dataset.group || '';
            if (storedValue) {
                releaseOption(storedValue, group);
            }
            zone.dataset.value = '';
            zone.classList.remove('filled');
            zone.textContent = ''; var _zph = document.createElement('span'); _zph.className = 'placeholder'; _zph.textContent = placeholder; zone.appendChild(_zph);
            const qId = Number((zone.dataset.target || '').replace('q', ''));
            if (qId) {
                saveAnswer(qId, '');
            }
        };

        items.forEach(item => {
            item.dataset.used = "false";
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                if (item.dataset.used === "true") {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', item.dataset.option || '');
                e.dataTransfer.setData('text/group', item.dataset.group || '');
                e.dataTransfer.setData('text/label', item.dataset.label || item.textContent.trim());
                selectDragItem(item);
            });
            item.addEventListener('click', () => selectDragItem(item));
        });

        zones.forEach(zone => {
            const placeholder = zone.dataset.placeholder || 'Drop letter';
            zone.textContent = ''; var _zph = document.createElement('span'); _zph.className = 'placeholder'; _zph.textContent = placeholder; zone.appendChild(_zph);
            zone.addEventListener('dragover', (e) => e.preventDefault());
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                const option = e.dataTransfer.getData('text/plain');
                if (!option) return;
                const draggedGroup = e.dataTransfer.getData('text/group') || '';
                const label = e.dataTransfer.getData('text/label') || option;
                applyToZone(zone, option, label, draggedGroup);
            });
            zone.addEventListener('click', (e) => {
                if (e.detail > 1) return;
                if (!selectedDragItem) return;
                const option = selectedDragItem.dataset.option;
                const label = selectedDragItem.dataset.label || selectedDragItem.textContent.trim();
                const group = selectedDragItem.dataset.group || '';
                applyToZone(zone, option, label, group);
            });
            zone.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                resetZone(zone);
            });
        });

        optionBins.forEach(bin => {
            bin.addEventListener('dragover', (e) => e.preventDefault());
            bin.addEventListener('drop', (e) => {
                e.preventDefault();
                const option = e.dataTransfer.getData('text/plain');
                if (!option) return;
                const draggedGroup = e.dataTransfer.getData('text/group') || '';
                const binGroup = bin.dataset.group || draggedGroup || '';
                releaseOption(option, binGroup);
                zones.forEach(zone => {
                    if (zone.dataset.value === option) {
                        resetZone(zone);
                    }
                });
            });
            bin.addEventListener('click', () => {
                clearSelected();
            });
        });
    }

    function setupUIControls() {
        if (uiControlsInitialized) return;
        uiControlsInitialized = true;
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const optionsMenuBtn = document.getElementById('optionsMenuBtn');
        const optionsModal = document.getElementById('options-modal');
        const optionsHome = document.getElementById('options-home');
        const contrastMenu = document.getElementById('contrast-menu');
        const textSizeMenu = document.getElementById('textsize-menu');
        const optionsBackBtn = document.getElementById('options-back');
        const closeOptionsBtn = document.getElementById('close-options');
        const contrastCurrent = document.getElementById('contrast-current');
        const textsizeCurrent = document.getElementById('textsize-current');

        const openModal = () => {
            if (!optionsModal) return;
            optionsModal.classList.remove('hidden');
            if (optionsHome) optionsHome.classList.remove('hidden');
            if (contrastMenu) contrastMenu.classList.add('hidden');
            if (textSizeMenu) textSizeMenu.classList.add('hidden');
            if (optionsBackBtn) {
                optionsBackBtn.style.visibility = 'hidden';
            }
        };

        const closeModal = () => {
            if (!optionsModal) return;
            optionsModal.classList.add('hidden');
        };

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                const docEl = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
                    if (docEl.requestFullscreen) {
                        docEl.requestFullscreen();
                    } else if (docEl.webkitRequestFullscreen) {
                        docEl.webkitRequestFullscreen();
                    } else if (docEl.mozRequestFullScreen) {
                        docEl.mozRequestFullScreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        var exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen; if (exitFullscreen) exitFullscreen.call(document);
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    }
                }
            });
        }

        if (optionsMenuBtn) optionsMenuBtn.addEventListener('click', openModal);
        if (closeOptionsBtn) closeOptionsBtn.addEventListener('click', closeModal);
        if (optionsModal) optionsModal.addEventListener('click', (event) => {
            if (event.target === optionsModal) {
                closeModal();
            }
        });

        const showMenu = (menu) => {
            if (!optionsModal) return;
            if (optionsHome) optionsHome.classList.add('hidden');
            if (contrastMenu) contrastMenu.classList.add('hidden');
            if (textSizeMenu) textSizeMenu.classList.add('hidden');
            if (menu) {
                menu.classList.remove('hidden');
            }
            if (optionsBackBtn) {
                optionsBackBtn.style.visibility = 'visible';
            }
        };

        if (optionsBackBtn) optionsBackBtn.addEventListener('click', () => {
            if (!optionsModal) return;
            if (optionsHome) optionsHome.classList.remove('hidden');
            if (contrastMenu) contrastMenu.classList.add('hidden');
            if (textSizeMenu) textSizeMenu.classList.add('hidden');
            if (optionsBackBtn) {
                optionsBackBtn.style.visibility = 'hidden';
            }
        });

        document.querySelectorAll('.option-row').forEach(row => {
            row.addEventListener('click', () => {
                const target = row.dataset.target;
                if (target === 'contrast') {
                    showMenu(contrastMenu);
                } else if (target === 'textsize') {
                    showMenu(textSizeMenu);
                }
            });
        });

        if (contrastMenu) contrastMenu.querySelectorAll('button[data-contrast]').forEach(button => {
            button.addEventListener('click', () => {
                const contrast = button.dataset.contrast;
                document.body.classList.remove('contrast-white-black', 'contrast-yellow-black');
                if (contrast === 'whiteblack') {
                    document.body.classList.add('contrast-white-black');
                } else if (contrast === 'yellowblack') {
                    document.body.classList.add('contrast-yellow-black');
                }
                if (contrastCurrent) {
                    contrastCurrent.textContent = button.textContent.trim();
                }
            });
        });

        if (textSizeMenu) textSizeMenu.querySelectorAll('button[data-textsize]').forEach(button => {
            button.addEventListener('click', () => {
                const textSize = button.dataset.textsize;
                document.body.classList.remove('text-small', 'text-medium', 'text-large', 'text-xlarge');
                if (textSize) {
                    document.body.classList.add(`text-${textSize}`);
                }
                if (textsizeCurrent) {
                    textsizeCurrent.textContent = button.textContent.trim();
                }
            });
        });
    }


    function calculateResults() {
        let totalCorrect = 0;
        const partScores = new Array(totalParts).fill(0);
        const detailedResults = [];
        for (const range of partRanges) {
            for (let i = range.start; i <= range.end; i++) {
                const userAnswer = (answers[i] || '').trim();
                const normalized = userAnswer.toLowerCase();
                const correctValues = getNormalizedCorrectValues(i);
                const isCorrect = correctValues.includes(normalized);
                const partIndex = getPartIndex(i);
                if (isCorrect && partIndex !== -1) {
                    totalCorrect++;
                    partScores[partIndex]++;
                }
                detailedResults.push({
                    questionId: i,
                    userAnswer,
                    correctAnswer: correctValues[0] || '',
                    isCorrect
                });
            }
        }
        return { totalCorrect, partScores, detailedResults };
    }
                        function syncTextInputsToAnswers() {
                document.querySelectorAll('input[type="text"], textarea').forEach(input => {
                    const keySource = input.id || input.name || '';
                    const match = keySource.match(/^q(\d+)$/i);
                    if (!match) return;
                    answers[Number(match[1])] = input.value;
                });
            }

    function submitTest() {
        if (testSubmitted || window.testSubmitted) return;
        syncTextInputsToAnswers();
        const results = calculateResults();
        window.testResults = results.detailedResults;
        showResults(results);
        showCorrectAnswers();
        highlightAnswers();
        testSubmitted = true;
        window.testSubmitted = true;
    }

    function showResults(results) {
        document.getElementById('totalScore').textContent = `${results.totalCorrect}/${totalQuestions}`;
        const partScore = results.partScores[0] || 0;
        const partRange = partRanges[0];
        const partTotal = partRange ? (partRange.end - partRange.start + 1) : 0;
        document.getElementById('part2Score').textContent = `${partScore}/${partTotal}`;
        document.getElementById('resultsModal').classList.remove('hidden');
    }

    function closeResults() {
        document.getElementById('resultsModal').classList.add('hidden');
        (function (node) { if (node) node.classList.remove('hidden'); })(document.querySelector('.audio-controller-bar'));
}

    function initializeHighlighting() {
        const highlightBtn = document.getElementById('highlight-btn');
        const removeBtn = document.getElementById('remove-highlight-btn');
        const panel = document.querySelector('.questions-section');
        if (!highlightBtn || !removeBtn || !panel) return;

        let storedHighlightRange = null;

        const positionHighlightButton = (range) => {
            if (!range) return;
            const rect = range.getBoundingClientRect();
            const buttonHeight = highlightBtn.offsetHeight || 38;
            const top = rect.top + window.scrollY - buttonHeight - 8;
            const left = rect.left + window.scrollX;
            const clampedLeft = Math.min(Math.max(left, 10), window.innerWidth - highlightBtn.offsetWidth - 10);
            highlightBtn.style.top = `${Math.max(top, 10)}px`;
            highlightBtn.style.left = `${Math.max(clampedLeft, 10)}px`;
        };

        const positionRemoveButton = (element) => {
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const buttonHeight = removeBtn.offsetHeight || 36;
            const top = rect.top + window.scrollY - buttonHeight - 8;
            const left = rect.left + window.scrollX + (rect.width - removeBtn.offsetWidth) / 2;
            const clampedLeft = Math.min(Math.max(left, 10), window.innerWidth - removeBtn.offsetWidth - 10);
            removeBtn.style.top = `${Math.max(top, 10)}px`;
            removeBtn.style.left = `${clampedLeft}px`;
            removeBtn.style.display = 'inline-flex';
        };

        const hideRemoveButton = () => {
            removeBtn.style.display = 'none';
            highlightTarget = null;
        };

        const showRemoveButton = (element) => {
            if (!element) return;
            highlightTarget = element;
            positionRemoveButton(element);
        };

        const isSelectionInsidePanel = (range) => {
            if (!range) return false;
            const nodes = [
                range.commonAncestorContainer,
                range.startContainer,
                range.endContainer
            ];
            return nodes.some(node => panel.contains(node));
        };

        const updateHighlightState = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                if (isSelectionInsidePanel(range)) {
                    storedHighlightRange = range.cloneRange();
                    highlightBtn.disabled = false;
                    highlightBtn.style.display = 'inline-flex';
                    positionHighlightButton(range);
                    return;
                }
            }
            storedHighlightRange = null;
            highlightBtn.disabled = true;
            highlightBtn.style.display = 'none';
        };

        const applyHighlight = () => {
            if (!storedHighlightRange) return;
            const range = storedHighlightRange.cloneRange();
            const span = document.createElement('span');
            span.className = 'highlight';
            try {
                range.surroundContents(span);
            } catch (error) {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            }
            storedHighlightRange = null;
            window.getSelection().removeAllRanges();
            highlightBtn.disabled = true;
            highlightBtn.style.display = 'none';
        };

        highlightBtn.style.display = 'inline-flex';
        removeBtn.style.display = 'none';
        highlightBtn.disabled = true;
        document.addEventListener('selectionchange', updateHighlightState);
        document.addEventListener('mouseup', updateHighlightState);
        document.addEventListener('pointerup', updateHighlightState);
        document.addEventListener('touchend', updateHighlightState);
        document.addEventListener('keyup', updateHighlightState);
        highlightBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            applyHighlight();
            hideRemoveButton();
        });
        removeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!highlightTarget) return;
            const span = highlightTarget;
            const parent = span.parentNode;
            if (!parent) return;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            hideRemoveButton();
        });

        panel.addEventListener('click', (event) => {
            const span = event.target.closest('.highlight');
            if (span) {
                event.stopPropagation();
                showRemoveButton(span);
                return;
            }
            if (!removeBtn.contains(event.target)) {
                hideRemoveButton();
            }
        });

        document.addEventListener('click', (event) => {
            if (event.target.closest('.highlight') || removeBtn.contains(event.target)) {
                return;
            }
            hideRemoveButton();
        });

        document.addEventListener('scroll', () => {
            if (highlightTarget) {
                showRemoveButton(highlightTarget);
            }
        }, true);

        updateHighlightState();
    }
