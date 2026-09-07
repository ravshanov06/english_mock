
    // Global variables
    let currentPart = 0;
    let answers = window.answers && typeof window.answers === 'object' ? window.answers : {};
    window.answers = answers;
    let testSubmitted = !!window.testSubmitted;
    window.testSubmitted = testSubmitted;
    let lastSelection = null;
    let highlightTarget = null;
    let uiControlsInitialized = false;
	    const multiQuestionGroups = {};
	    const multiAnswers = {};

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
	        21: ["c"],
	        22: ["c"],
	        23: ["a"],
	        24: ["a"],
	        25: ["b"],
	        26: ["g"],
	        27: ["b"],
	        28: ["a"],
	        29: ["d"],
	        30: ["c"]
	    };

    function normalizeAnswerValue(value) {
        return (value != null ? value : '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/\s+/g, ' ');
    }
    function getNormalizedCorrectValues(questionId) {
        const entry = correctAnswers[questionId];
        if (Array.isArray(entry)) {
            return entry
                .map(item => normalizeAnswerValue(item))
                .filter(Boolean);
        }
        if (entry !== undefined && entry !== null && entry !== '') {
            return [normalizeAnswerValue(entry)];
        }
        return [];
    }

    // Test Section Data
	    const testData = [
	        {
	            title: "SECTION 3",
	            instructions: "Answer Questions 21–30.",
	            description: "Allergies and pollen changes.",
	            questionRange: "21–30"
	        }
	    ];

    const partRanges = [
        { start: 21, end: 30 }
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
    window.addEventListener('load', () => {
        setupUIControls();
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
        const bottomNav = document.getElementById('bottomNavigation');
        if (bottomNav) {
            bottomNav.classList.remove('hidden');
        }
        const testAudio = document.getElementById('testAudio');
        if (testAudio) {
            testAudio.currentTime = 0;
            testAudio.play().catch(() => {});
        }
        updatePartDisplay();
        updateNavigation();
        (function (node) { if (node) node.classList.remove('answers-visible'); })(document.querySelector('.questions-section'));
        prepopulateForm(formPrefillAnswers);
        initializeHighlighting();
        setupDragDrop();
        setupUIControls();
    }

	    function switchPart(partIndex) {
	        if (typeof partIndex !== 'number') return;
	        if (partIndex < 0 || partIndex >= totalParts) return;
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
	            let focusTarget = el;
	            if (el.tagName === 'TR') {
	                focusTarget = el.querySelector('input[type="radio"]') || el;
	            } else {
	                focusTarget = el.querySelector('input, button, [tabindex]') || el;
	            }
	            try {
	                focusTarget.focus({ preventScroll: true });
	            } catch (error) {
	                focusTarget.focus();
	            }
	            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	        }
	    }

    function saveAnswer(qId, value) {
        answers[qId] = value;
    }

    function getGroupKeyForQuestion(qId) {
        return Object.keys(multiQuestionGroups).find(key => multiQuestionGroups[key].includes(qId)) || '';
    }

    function handleMultiSelect(groupKey, maxSelections, changedInput) {
        const inputs = Array.from(document.querySelectorAll(`input[name="${groupKey}"]`));
        const checked = inputs.filter(input => input.checked);
        if (checked.length > maxSelections) {
            if (changedInput) {
                changedInput.checked = false;
            } else {
                checked[checked.length - 1].checked = false;
            }
        }
        const selectedValues = inputs
            .filter(input => input.checked)
            .map(input => normalizeAnswerValue(input.value));
        multiAnswers[groupKey] = selectedValues;
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
        document.querySelectorAll('.answer-feedback-row').forEach(el => el.remove());
        const results = window.testResults || [];

        results.forEach(({ questionId, userAnswer, correctAnswer, isCorrect }) => {
            const anchor = document.getElementById(`q${questionId}`);
            if (!anchor) return;

            const userText = (userAnswer || '').toString().trim() || '-';
            const correctText = (correctAnswer || '').toString().trim() || '-';
            const feedback = document.createElement('div');
            feedback.className = 'answer-feedback';
            feedback.style.padding = '8px';
            feedback.style.margin = '6px 0';
            feedback.style.fontSize = '14px';
            feedback.style.borderRadius = '4px';
            feedback.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da';
            feedback.style.color = isCorrect ? '#155724' : '#721c24';
            if (isCorrect) {
                const status = document.createElement('strong');
                status.textContent = '\u2713 Correct.';
                feedback.appendChild(status);
                feedback.appendChild(document.createTextNode(' You answered: '));
                const answer = document.createElement('em');
                answer.textContent = userText;
                feedback.appendChild(answer);
            } else {
                const status = document.createElement('strong');
                status.textContent = '\u2717 Incorrect.';
                feedback.appendChild(status);
                feedback.appendChild(document.createTextNode(' You answered: '));
                const answer = document.createElement('em');
                answer.textContent = userText;
                feedback.appendChild(answer);
                feedback.appendChild(document.createElement('br'));
                const correctLabel = document.createElement('strong');
                correctLabel.textContent = 'Correct:';
                feedback.appendChild(correctLabel);
                feedback.appendChild(document.createTextNode(' '));
                const correct = document.createElement('em');
                correct.textContent = correctText;
                feedback.appendChild(correct);
            }

            if (anchor.tagName === 'TR') {
                const row = document.createElement('tr');
                row.className = 'answer-feedback-row';
                const cell = document.createElement('td');
                cell.colSpan = 10;
                cell.appendChild(feedback);
                row.appendChild(cell);
                anchor.insertAdjacentElement('afterend', row);
                return;
            }

            const container = anchor.classList && anchor.classList.contains('multiple-choice-block')
                ? anchor
                : (anchor.closest('.multiple-choice-block') || anchor.parentNode || anchor);
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
	        const radioSections = [
	            { start: 21, end: 25 }
	        ];
	        radioSections.forEach(section => {
	            for (let qId = section.start; qId <= section.end; qId++) {
	                if (getGroupKeyForQuestion(qId)) {
	                    continue;
	                }
                document.querySelectorAll(`input[name="q${qId}"]`).forEach(radio => {
                    const item = radio.closest('.choice-item');
                    if (!item) return;
                    const radioValue = normalizeAnswerValue(radio.value);
                    const correctValues = getNormalizedCorrectValues(qId);
                    if (correctValues.includes(radioValue)) {
                        item.classList.add('correct');
                    } else if (radio.checked) {
                        item.classList.add('incorrect');
                    }
                });
            }
        });
        document.querySelectorAll('.drop-zone').forEach(zone => {
            const qId = Number((zone.dataset.target || '').replace('q', ''));
            if (!qId) return;
            const userValue = normalizeAnswerValue(zone.dataset.value || '');
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
            zone.textContent = ''; const dropValue = document.createElement('span'); dropValue.className = 'drop-value'; dropValue.textContent = normalizedLabel; zone.appendChild(dropValue);
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
            zone.textContent = ''; const placeholderSpan = document.createElement('span'); placeholderSpan.className = 'placeholder'; placeholderSpan.textContent = placeholder; zone.appendChild(placeholderSpan);
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
            zone.textContent = ''; const placeholderSpan = document.createElement('span'); placeholderSpan.className = 'placeholder'; placeholderSpan.textContent = placeholder; zone.appendChild(placeholderSpan);
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
	                const groupKey = getGroupKeyForQuestion(i);
	                const correctValues = getNormalizedCorrectValues(i);
	                let userAnswer = '';
	                let isCorrect = false;
	                if (groupKey) {
	                    const selectedValues = multiAnswers[groupKey] || [];
	                    userAnswer = selectedValues.join(', ');
	                    isCorrect = correctValues.some(value => selectedValues.includes(value));
                } else {
                    const liveInputValue = (function (node) { return node ? node.value : ''; })(document.getElementById(`q${i}`));
                    userAnswer = ((liveInputValue || answers[i]) || '').trim();
                    const normalized = normalizeAnswerValue(userAnswer);
                    isCorrect = correctValues.includes(normalized);
                }
	                const partIndex = getPartIndex(i);
	                if (isCorrect && partIndex !== -1) {
	                    totalCorrect++;
	                    partScores[partIndex]++;
	                }
	                detailedResults.push({
	                    questionId: i,
	                    userAnswer: userAnswer || 'No answer',
	                    correctAnswer: correctValues[0] || 'Not set',
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
        const part3Score = results.partScores[0] || 0;
        const part3Range = partRanges[0];
        const part3Total = part3Range ? (part3Range.end - part3Range.start + 1) : 0;
        document.getElementById('part3Score').textContent = `${part3Score}/${part3Total}`;
        document.getElementById('resultsModal').classList.remove('hidden');
    }

    function closeResults() {
        document.getElementById('resultsModal').classList.add('hidden');
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
