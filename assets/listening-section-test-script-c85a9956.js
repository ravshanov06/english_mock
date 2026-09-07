
            // Global variables
            let currentPart = 0;
            let answers = window.answers && typeof window.answers === 'object' ? window.answers : {};
    window.answers = answers;
            let testSubmitted = !!window.testSubmitted;
    window.testSubmitted = testSubmitted;
            let highlightTarget = null;

            // Correct Answers for Gamification Section 4
            const correctAnswers = {
                31: "marketing",
                32: "airlines",
                33: "feedback",
                34: "behaviour",
                35: "pilots",
                36: "exercise",
                37: "piano",
                38: "hand",
                39: "fun",
                40: "privacy"
            };

            // Accept alternatives
            const alternatives = {
                32: ["airline"],
                34: ["behavior"]
            };

            function isFlexibleCorrect(questionId, userAnswer) {
                const values = [];
                if (correctAnswers[questionId]) values.push(correctAnswers[questionId]);
                if (alternatives[questionId]) values.push(...alternatives[questionId]);

                const trimmedUser = String(userAnswer || '').trim();
                if (!trimmedUser || !values.length) return false;

                const flex = window.__listeningAnswerFlex;
                if (flex && typeof flex.matches === 'function') {
                    return values.some(value => flex.matches(trimmedUser, value));
                }

                const normalizedUser = trimmedUser.toLowerCase();
                return values.some(value => String(value || '').trim().toLowerCase() === normalizedUser);
            }

            // Test Section Data
            const testData = [
                { title: "SECTION 4", instructions: "Questions 31-40", description: "Complete the notes below. Write ONE WORD ONLY for each answer.", questionRange: "31-40" }
            ];

            // Audio setup
            const audioUrl = "Section 4.12.mp3";
            let audioLoaded = false;

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


            function getAudioElement() {
                return document.getElementById('ieltsAudio') || document.getElementById('testAudio');
            }

            window.addEventListener('load', () => {
                const audio = getAudioElement();
                if (!audio) {
                    setScreenVisibility('loadingScreen', false);
                    setScreenVisibility('startScreen', true);
                    return;
                }
                
                audio.addEventListener('canplaythrough', () => {
                    audioLoaded = true;
                    checkReady();
                });
                
                audio.addEventListener('error', () => {
                    document.getElementById('loadingScreen').querySelector('.loading-subtitle').textContent = "Audio failed to load";
                });

                // Start loading audio immediately
                audio.src = audioUrl;
                audio.load();

                // Fallback
                setTimeout(() => {
                    if (!audioLoaded) {
                        setScreenVisibility('loadingScreen', false);
                        setScreenVisibility('startScreen', true);
                    }
                }, 8000);
            });

            function checkReady() {
                if (audioLoaded) {
                    setScreenVisibility('loadingScreen', false);
                    setScreenVisibility('startScreen', true);
                }
            }

            function startTest() {
                setScreenVisibility('loadingScreen', false);
                setScreenVisibility('startScreen', false);
                setScreenVisibility('testInterface', true);
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                const audio = getAudioElement();
                if (audio) audio.play().catch(e => console.log("Play interrupted:", e)); // Auto-play (may be blocked on some browsers)
                updatePartDisplay();
                updateNavigation();
                initializeHighlighting();
            }

            // Optional minimal play/pause button
            function togglePlayPause() {
                const audio = document.getElementById('ieltsAudio');
                const btn = document.getElementById('playPauseBtn');
                if (audio.paused) {
                    audio.play();
                    btn.textContent = "вќљвќљ Pause Audio";
                } else {
                    audio.pause();
                    btn.textContent = "▶ Play Audio";
                }
            }

            // Rest of functions unchanged...
            function switchPart(partIndex) {
                currentPart = partIndex;
                updatePartDisplay();
                updateNavigation();
            }

            function updatePartDisplay() {
                const partData = testData[currentPart];
                document.getElementById('partTitle').textContent = partData.title;
                document.getElementById('partInstructions').textContent = partData.instructions;
                document.getElementById('questionsTitle').textContent = `Questions ${partData.questionRange}`;
                document.getElementById('questionsDescription').textContent = partData.description;
                document.getElementById('part1Content').classList.remove('hidden');
            }

            function updateNavigation() {
                document.getElementById('part1Btn').classList.add('active');
                document.getElementById('part1Questions').classList.remove('hidden');
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
                testSubmitted = true;
        window.testSubmitted = true;
                document.getElementById('submitBtn').disabled = true;
                syncTextInputsToAnswers();
                const results = checkAnswers();
                showResults(results);
                highlightAnswers();
                showCorrectAnswers();
            }

            function checkAnswers() {
                let totalCorrect = 0;
                let partScores = [0];
                let detailedResults = [];
                const questionRanges = [[31, 40]];

                questionRanges.forEach((range, partIndex) => {
                    const [start, end] = range;
                    for (let i = start; i <= end; i++) {
                        const liveInputValue = (function (node) { return node ? node.value : ''; })(document.getElementById(`q${i}`));
                        let userAnswer = ((liveInputValue || answers[i]) || '').trim();
                        let correctAnswer = correctAnswers[i];
                        let isCorrect = false;

                        if (correctAnswer) {
                            isCorrect = isFlexibleCorrect(i, userAnswer);

                            if (isCorrect) {
                                partScores[partIndex]++;
                                totalCorrect++;
                            }
                        }

                        detailedResults.push({
                            questionId: i,
                            userAnswer: userAnswer || 'No answer',
                            correctAnswer: correctAnswer || 'Unknown',
                            isCorrect
                        });
                    }
                });

                return { totalCorrect, partScores, detailedResults };
            }

            function showCorrectAnswers() {
                document.querySelectorAll('.answer-feedback').forEach(el => el.remove());

                const questionRanges = [[31, 40]];
                questionRanges.forEach((range) => {
                    const [start, end] = range;
                    for (let i = start; i <= end; i++) {
                        const input = document.getElementById(`q${i}`);
                        if (input) {
                            const liveInputValue = (function (node) { return node ? node.value : ''; })(document.getElementById(`q${i}`));
                        let userAnswer = ((liveInputValue || answers[i]) || '').trim();
                            let correctAnswer = correctAnswers[i] || 'Unknown';
                            let displayCorrect = correctAnswer;

                            if (alternatives[i]) {
                                displayCorrect += " (or " + alternatives[i].join("/") + ")";
                            }

                            let isCorrect = isFlexibleCorrect(i, userAnswer);

                            const container = input.parentNode;
                            const feedback = document.createElement('div');
                            feedback.className = 'answer-feedback';
                            feedback.style.padding = '8px';
                            feedback.style.margin = '6px 0';
                            feedback.style.fontSize = '14px';
                            feedback.style.borderRadius = '4px';
                            feedback.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da';
                            feedback.style.color = isCorrect ? '#155724' : '#721c24';
                            if (isCorrect) {
                                var _sf = document.createElement('strong'); _sf.textContent = '✓ Correct!'; feedback.appendChild(_sf);
                                feedback.appendChild(document.createTextNode(' You chose: '));
                                var _ef = document.createElement('em'); _ef.textContent = userAnswer; feedback.appendChild(_ef);
                            } else {
                                var _sf = document.createElement('strong'); _sf.textContent = '✗ Incorrect.'; feedback.appendChild(_sf);
                                feedback.appendChild(document.createTextNode(' You chose: '));
                                var _ef = document.createElement('em'); _ef.textContent = userAnswer || 'nothing'; feedback.appendChild(_ef);
                                feedback.appendChild(document.createElement('br'));
                                var _sf2 = document.createElement('strong'); _sf2.textContent = 'Correct:'; feedback.appendChild(_sf2);
                                feedback.appendChild(document.createTextNode(' '));
                                var _ef2 = document.createElement('em'); _ef2.textContent = displayCorrect; feedback.appendChild(_ef2);
                            }
                            container.appendChild(feedback);
                        }
                    }
                });
            }

            function highlightAnswers() {
                document.querySelectorAll('.correct, .incorrect').forEach(el => {
                    el.classList.remove('correct', 'incorrect');
                });

                const questionRanges = [[31, 40]];
                questionRanges.forEach((range) => {
                    const [start, end] = range;
                    for (let i = start; i <= end; i++) {
                        const input = document.getElementById(`q${i}`);
                        if (input) {
                            const liveInputValue = (function (node) { return node ? node.value : ''; })(document.getElementById(`q${i}`));
                            let user = ((liveInputValue || answers[i]) || '').trim();
                            let isCorrect = isFlexibleCorrect(i, user);
                            input.classList.add(isCorrect ? 'correct' : 'incorrect');
                        }
                    }
                });
            }

            function showResults(results) {
                document.getElementById('totalScore').textContent = `${results.totalCorrect}/10`;
                document.getElementById('part1Score').textContent = `${results.partScores[0]}/10`;
                document.getElementById('resultsModal').classList.remove('hidden');
            }

            function closeResults() {
                document.getElementById('resultsModal').classList.add('hidden');
            }

            function initializeHighlighting() {
                const highlightBtn = document.getElementById('highlight-btn');
                const removeBtn = document.getElementById('remove-highlight-btn');
                const panel = document.querySelector('.questions-section');

                function getSelection() {
                    const sel = window.getSelection();
                    if (sel.rangeCount && !sel.isCollapsed && panel.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                        return sel.getRangeAt(0);
                    }
                    return null;
                }

                highlightBtn.addEventListener('click', () => {
                    const range = getSelection();
                    if (range) {
                        const span = document.createElement('span');
                        span.className = 'highlight';
                        span.appendChild(range.extractContents());
                        range.insertNode(span);
                        window.getSelection().removeAllRanges();
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
                        const rect = range.getBoundingClientRect();
                        highlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
                        highlightBtn.style.left = (window.scrollX + rect.left) + 'px';
                        highlightBtn.style.display = 'block';
                    } else {
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
        
