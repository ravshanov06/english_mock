
        const TEST_STORAGE_ID = "reading_reading_passage_3s_passage_3_26";
        const TEST_LABEL = "Passage 3.26";
        const LEGACY_ANSWER_STORAGE_PREFIX = "ielts_saved_answers_";
        const ATTEMPT_QUERY_ID = new URLSearchParams(window.location.search).get("attempt") || "";
        const REDO_QUERY = new URLSearchParams(window.location.search).get("redo") === "1";
        const correctAnswers = {
            q27: "YES", q28: "NOT GIVEN", q29: "NO", q30: "NOT GIVEN", q31: "NO",
            q32: "B", q33: "A", q34: "C", q35: "D", q36: "D",
            q37: "E", q38: "C", q39: "F", q40: "A"
        };

        let submitted = false;
        let currentQuestion = 27;
        let seconds = 20 * 60;
        let timerInterval;
        let lastSelection = null;
        let highlightTarget = null;
        let isResizing = false;
        let selectedContrast = 'normal';
        let selectedTextSize = 'medium';
        const currentPart = 1;

        const loadingScreen = document.getElementById("loadingScreen");
        const startScreen = document.getElementById("startScreen");
        const testContainer = document.getElementById("testContainer");
        const timerElement = document.querySelector(".timer span");
        const timerContainer = document.querySelector(".timer");
        const bottomPartTabs = document.getElementById("bottomPartTabs");
        const prevBtn = document.getElementById("prev-btn");
        const nextBtn = document.getElementById("next-btn");
        const submitBtn = document.getElementById("submit-all-btn");
        const resultsModal = document.getElementById("results-modal");
        const scoreDisplay = document.getElementById("score-display");
        const passage3Score = document.getElementById("passage3-score");
        const closeModalBtn = document.getElementById("close-modal");
        const reviewBtn = document.getElementById("review-answers");
        const submittedMenuLink = document.getElementById("submittedMenuLink");
        const passagePanel = document.getElementById("passagePanel");
        const questionsPanel = document.getElementById("questionsPanel");
        const resizer = document.getElementById("resizer");
        const highlightBtn = document.getElementById("highlight-btn");
        const removeHighlightBtn = document.getElementById("remove-highlight-btn");

        function renderBottomTabs() {
            if (!bottomPartTabs) return;
            bottomPartTabs.innerHTML = "";
            const passageButton = document.createElement("button");
            passageButton.type = "button";
            passageButton.className = "btn btn-secondary";
            passageButton.style.fontWeight = "900";
            passageButton.innerHTML = "<strong>Passage 3</strong>";
            passageButton.addEventListener("click", () => goToQuestion(currentQuestion));
            bottomPartTabs.appendChild(passageButton);

            const rail = document.createElement("div");
            rail.id = "rail-part-1";
            rail.style.display = "flex";
            rail.style.gap = "6px";
            rail.style.flexWrap = "wrap";
            rail.style.alignItems = "center";
            for (let q = 27; q <= 40; q++) {
                const button = document.createElement("button");
                button.className = "progress-item" + (q === currentQuestion ? " current" : "");
                button.dataset.question = String(q);
                button.textContent = String(q);
                button.type = "button";
                button.style.width = "30px";
                button.style.height = "20px";
                button.style.borderRadius = "6px";
                button.style.fontSize = "14px";
                button.style.padding = "0";
                button.style.lineHeight = "20px";
                button.addEventListener("click", () => goToQuestion(q));
                rail.appendChild(button);
            }
            bottomPartTabs.appendChild(rail);
        }

        function getProgressChip(q) {
            return document.querySelector('.progress-item[data-question="' + q + '"]');
        }

        function updateAnsweredState(q) {
            const chip = getProgressChip(q);
            if (!chip) return;
            if (getAnswer("q" + q)) chip.classList.add("answered");
            else chip.classList.remove("answered");
        }

        function updateCurrentState() {
            document.querySelectorAll("#rail-part-1 .progress-item").forEach((chip) => chip.classList.remove("current"));
            const currentChip = getProgressChip(currentQuestion);
            if (currentChip) currentChip.classList.add("current");
            prevBtn.disabled = currentQuestion === 27;
            nextBtn.disabled = currentQuestion === 40;
            const target = document.querySelector('.question[data-question="' + currentQuestion + '"]');
            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        function goToQuestion(q) {
            currentQuestion = q;
            updateCurrentState();
        }

        function getAnswer(name) {
            const hidden = document.querySelector('input[type="hidden"][name="' + name + '"]');
            if (hidden) return hidden.value.trim();
            const checked = document.querySelector('input[type="radio"][name="' + name + '"]:checked');
            return checked ? checked.value : "";
        }

        function collectCurrentAnswers() {
            const saved = {};
            for (let q = 27; q <= 40; q++) {
                const key = "q" + q;
                const value = getAnswer(key);
                if (value) saved[key] = value;
            }
            return saved;
        }

        function getLegacySavedAnswersKey() {
            const email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === "function"
                ? window.IELTSProgress.getEmail()
                : "";
            return LEGACY_ANSWER_STORAGE_PREFIX + (email || "guest") + "_" + TEST_STORAGE_ID;
        }

        function persistCurrentAnswers() {
            const answers = collectCurrentAnswers();
            if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === "function") {
                window.IELTSProgress.saveDraft(TEST_STORAGE_ID, answers);
            } else {
                try { localStorage.setItem(getLegacySavedAnswersKey(), JSON.stringify(answers)); } catch (e) {}
            }
        }

        function setDropZoneValue(questionName, value) {
            const zone = document.querySelector('.drop-zone[data-target="' + questionName + '"]');
            const input = document.querySelector('input[type="hidden"][name="' + questionName + '"]');
            if (!zone || !input) return;
            const item = document.querySelector('.drag-item[data-answer="' + value + '"]');
            if (!item) return;
            clearExistingDropValue(value, questionName);
            input.value = value;
            zone.textContent = item.textContent;
            zone.dataset.value = value;
            zone.classList.add("filled");
            item.classList.add("used");
            updateAnsweredState(Number(questionName.replace("q", "")));
        }

        function clearZone(questionName) {
            const zone = document.querySelector('.drop-zone[data-target="' + questionName + '"]');
            const input = document.querySelector('input[type="hidden"][name="' + questionName + '"]');
            if (!zone || !input) return;
            const currentValue = input.value;
            if (currentValue) {
                const item = document.querySelector('.drag-item[data-answer="' + currentValue + '"]');
                if (item) item.classList.remove("used");
            }
            input.value = "";
            zone.textContent = "Drop answer here";
            zone.dataset.value = "";
            zone.classList.remove("filled");
            updateAnsweredState(Number(questionName.replace("q", "")));
        }

        function clearExistingDropValue(value, exceptQuestionName) {
            document.querySelectorAll('.drop-zone[data-value="' + value + '"]').forEach((zone) => {
                if (zone.dataset.target !== exceptQuestionName) clearZone(zone.dataset.target);
            });
            const input = document.querySelector('input[type="hidden"][name="' + exceptQuestionName + '"]');
            if (input && input.value && input.value !== value) {
                const oldItem = document.querySelector('.drag-item[data-answer="' + input.value + '"]');
                if (oldItem) oldItem.classList.remove("used");
            }
        }

        function restoreSavedAnswers() {
            let stored = {};
            if (window.IELTSProgress && typeof window.IELTSProgress.loadDraft === "function") {
                if (ATTEMPT_QUERY_ID) stored = window.IELTSProgress.loadDraft(ATTEMPT_QUERY_ID) || {};
                if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) stored = window.IELTSProgress.loadDraft(TEST_STORAGE_ID) || {};
            }
            if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
                try { stored = JSON.parse(localStorage.getItem(getLegacySavedAnswersKey()) || "{}") || {}; } catch (e) { stored = {}; }
            }
            Object.keys(stored).forEach((key) => {
                const value = stored[key];
                const hidden = document.querySelector('input[type="hidden"][name="' + key + '"]');
                if (hidden) {
                    setDropZoneValue(key, value);
                    return;
                }
                const radio = document.querySelector('input[type="radio"][name="' + key + '"][value="' + value + '"]');
                if (radio) radio.checked = true;
                updateAnsweredState(Number(key.replace("q", "")));
            });
        }

        function updateTimer() {
            seconds--;
            const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
            const secs = String(seconds % 60).padStart(2, "0");
            timerElement.textContent = mins + ":" + secs;
            if (seconds <= 120) timerContainer.classList.add("warning");
            if (seconds <= 0) {
                clearInterval(timerInterval);
                if (!submitted) submitTest();
            }
        }

        function submitTest() {
            if (submitted) return;
            submitted = true;
            clearInterval(timerInterval);
            let score = 0;
            for (let q = 27; q <= 40; q++) {
                const key = "q" + q;
                if (getAnswer(key) === correctAnswers[key]) score++;
            }
            scoreDisplay.textContent = score + "/14";
            passage3Score.textContent = score + "/14";
            resultsModal.style.display = "flex";
            submittedMenuLink.style.display = "inline-flex";
            if (window.IELTSProgress && typeof window.IELTSProgress.trackTestResult === "function") {
                window.IELTSProgress.trackTestResult("reading", {
                    score: score,
                    total: 14,
                    label: TEST_LABEL,
                    test_id: TEST_STORAGE_ID,
                    answers: collectCurrentAnswers(),
                    href: window.location.pathname
                });
            }
        }

        function reviewAnswers() {
            for (let q = 27; q <= 40; q++) {
                const key = "q" + q;
                const answer = getAnswer(key);
                const correct = correctAnswers[key];
                const chip = getProgressChip(q);
                const feedback = document.querySelector('[data-feedback="' + q + '"]');
                if (chip) {
                    chip.classList.remove("answered");
                    chip.classList.add(answer === correct ? "correct" : "incorrect");
                }
                if (feedback) {
                    if (answer === correct) {
                        feedback.className = "answer-indicator correct";
                        feedback.textContent = "Correct answer: " + correct;
                    } else {
                        feedback.className = "answer-indicator incorrect";
                        feedback.textContent = "Your answer: " + (answer || "No answer") + " | Correct answer: " + correct;
                    }
                }
            }
            resultsModal.style.display = "none";
        }

        function startTest() {
            startScreen.classList.add("hidden");
            testContainer.classList.remove("hidden");
            timerInterval = setInterval(updateTimer, 1000);
        }

        function getValidSelection() {
            const selection = window.getSelection();
            if (!selection.rangeCount || selection.isCollapsed) return null;
            const range = selection.getRangeAt(0);
            if (passagePanel.contains(range.commonAncestorContainer) || questionsPanel.contains(range.commonAncestorContainer)) return range;
            return null;
        }

        function showHighlightBtn(range) {
            const rect = range.getBoundingClientRect();
            highlightBtn.style.top = window.scrollY + rect.top - 40 + "px";
            highlightBtn.style.left = window.scrollX + rect.left + "px";
            highlightBtn.style.display = "block";
        }

        function showRemoveBtn(node) {
            const rect = node.getBoundingClientRect();
            removeHighlightBtn.style.top = window.scrollY + rect.top - 40 + "px";
            removeHighlightBtn.style.left = window.scrollX + rect.left + "px";
            removeHighlightBtn.style.display = "block";
            highlightTarget = node;
        }

        function hideHighlightTools() {
            highlightBtn.style.display = "none";
            removeHighlightBtn.style.display = "none";
            highlightTarget = null;
        }

        function initHighlighting() {
            document.addEventListener("mouseup", () => {
                const range = getValidSelection();
                if (range) {
                    lastSelection = range;
                    showHighlightBtn(range);
                } else {
                    highlightBtn.style.display = "none";
                }
            });
            highlightBtn.addEventListener("click", () => {
                if (!lastSelection) return;
                const span = document.createElement("span");
                span.className = "highlight";
                span.appendChild(lastSelection.extractContents());
                lastSelection.insertNode(span);
                window.getSelection().removeAllRanges();
                highlightBtn.style.display = "none";
            });
            document.addEventListener("click", (event) => {
                if (event.target.classList.contains("highlight")) {
                    showRemoveBtn(event.target);
                } else if (!event.target.closest("#remove-highlight-btn")) {
                    removeHighlightBtn.style.display = "none";
                }
            });
            removeHighlightBtn.addEventListener("click", () => {
                if (!highlightTarget) return;
                const parent = highlightTarget.parentNode;
                while (highlightTarget.firstChild) parent.insertBefore(highlightTarget.firstChild, highlightTarget);
                parent.removeChild(highlightTarget);
                hideHighlightTools();
            });
        }

        function initResizer() {
            if (!resizer) return;
            resizer.addEventListener("mousedown", () => { isResizing = true; });
            document.addEventListener("mousemove", (event) => {
                if (!isResizing || window.innerWidth <= 900) return;
                const percent = (event.clientX / window.innerWidth) * 100;
                if (percent > 25 && percent < 75) {
                    passagePanel.style.width = percent + "%";
                    questionsPanel.style.width = (100 - percent) + "%";
                }
            });
            document.addEventListener("mouseup", () => { isResizing = false; });
        }

        function initDragAndDrop() {
            let draggedAnswer = "";
            document.querySelectorAll(".drag-item").forEach((item) => {
                item.addEventListener("dragstart", (event) => {
                    if (item.classList.contains("used")) {
                        event.preventDefault();
                        return;
                    }
                    draggedAnswer = item.dataset.answer;
                    event.dataTransfer.setData("text/plain", draggedAnswer);
                });
                item.addEventListener("dblclick", () => {
                    if (item.classList.contains("used")) return;
                    const emptyZone = Array.from(document.querySelectorAll(".drop-zone")).find((zone) => !zone.dataset.value);
                    if (emptyZone) {
                        setDropZoneValue(emptyZone.dataset.target, item.dataset.answer);
                        persistCurrentAnswers();
                    }
                });
            });
            document.querySelectorAll(".drop-zone").forEach((zone) => {
                zone.addEventListener("dragover", (event) => {
                    event.preventDefault();
                    zone.classList.add("over");
                });
                zone.addEventListener("dragleave", () => zone.classList.remove("over"));
                zone.addEventListener("drop", (event) => {
                    event.preventDefault();
                    zone.classList.remove("over");
                    const value = event.dataTransfer.getData("text/plain") || draggedAnswer;
                    if (!value) return;
                    setDropZoneValue(zone.dataset.target, value);
                    persistCurrentAnswers();
                });
                zone.addEventListener("click", () => {
                    if (submitted) return;
                    if (zone.dataset.value) {
                        clearZone(zone.dataset.target);
                        persistCurrentAnswers();
                    }
                });
            });
        }

        function initEvents() {
            document.addEventListener("change", (event) => {
                if (event.target.matches('input[type="radio"][name^="q"]')) {
                    updateAnsweredState(Number(event.target.name.replace("q", "")));
                    persistCurrentAnswers();
                }
            }, true);
            prevBtn.addEventListener("click", () => { if (currentQuestion > 27) goToQuestion(currentQuestion - 1); });
            nextBtn.addEventListener("click", () => { if (currentQuestion < 40) goToQuestion(currentQuestion + 1); });
            submitBtn.addEventListener("click", submitTest);
            closeModalBtn.addEventListener("click", () => { resultsModal.style.display = "none"; });
            reviewBtn.addEventListener("click", reviewAnswers);
            document.addEventListener("contextmenu", (e) => e.preventDefault());
            document.addEventListener("keydown", (e) => {
                if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) || (e.ctrlKey && e.key === "u")) {
                    e.preventDefault();
                }
            });
        }

        renderBottomTabs();
        initEvents();
        initResizer();
        initHighlighting();
        initDragAndDrop();
        restoreSavedAnswers();
        updateCurrentState();

        setTimeout(() => {
            loadingScreen.classList.add("hidden");
            startScreen.classList.remove("hidden");
        }, 700);

        /* Fullscreen toggle */
        document.getElementById("fullscreenBtn").addEventListener("click", () => {
            if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
                try { var requestFullscreen = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen; var request = requestFullscreen && requestFullscreen.call(document.documentElement); if (request && typeof request.catch === 'function') request.catch(function () {}); }
                catch (e) { console.warn("Fullscreen failed", e); }
            } else {
                var exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen; if (exitFullscreen) exitFullscreen.call(document);
            }
        });

        /* Options modal */
        const optionsModal = document.getElementById("options-modal");
        const optionsTitle = document.getElementById("options-title");
        const optionsBack = document.getElementById("options-back");
        const optionsHome = document.getElementById("options-home");
        const contrastMenu = document.getElementById("contrast-menu");
        const textSizeMenu = document.getElementById("textsize-menu");
        let currentView = "home";

        function switchView(view) {
            currentView = view;
            optionsHome.style.display = view === "home" ? "block" : "none";
            contrastMenu.style.display = view === "contrast" ? "block" : "none";
            textSizeMenu.style.display = view === "textsize" ? "block" : "none";
            optionsBack.style.visibility = view === "home" ? "hidden" : "visible";
            optionsTitle.textContent = view === "home" ? "Options" : (view === "contrast" ? "Contrast" : "Text size");
        }

        document.getElementById("optionsMenuBtn").addEventListener("click", () => {
            optionsModal.style.display = "flex";
            switchView("home");
        });
        document.getElementById("close-options").addEventListener("click", () => { optionsModal.style.display = "none"; });
        window.addEventListener("click", (e) => { if (e.target === optionsModal) optionsModal.style.display = "none"; });
        optionsBack.addEventListener("click", () => switchView("home"));
        optionsHome.querySelectorAll(".option-row").forEach((row) => {
            row.addEventListener("click", () => switchView(row.dataset.target));
        });

        function applyContrast(mode) {
            document.body.classList.remove("contrast-white-black", "contrast-yellow-black");
            if (mode === "whiteblack") document.body.classList.add("contrast-white-black");
            if (mode === "yellowblack") document.body.classList.add("contrast-yellow-black");
            selectedContrast = mode;
            contrastMenu.querySelectorAll("button").forEach((btn) => btn.classList.toggle("selected", btn.dataset.contrast === mode));
            document.getElementById("contrast-current").textContent = mode === "whiteblack" ? "White on black" : mode === "yellowblack" ? "Yellow on black" : "Black on white";
        }
        contrastMenu.querySelectorAll("button").forEach((btn) => {
            btn.addEventListener("click", () => { applyContrast(btn.dataset.contrast); switchView("home"); });
        });

        function applyTextSize(size) {
            const base = { small: "14px", medium: "16px", large: "19px", xlarge: "24px" }[size] || "16px";
            document.documentElement.style.fontSize = base;
            selectedTextSize = size;
            textSizeMenu.querySelectorAll("button").forEach((btn) => btn.classList.toggle("selected", btn.dataset.textsize === size));
            document.getElementById("textsize-current").textContent = size === "small" ? "Small" : size === "large" ? "Large" : size === "xlarge" ? "Extra large" : "Medium";
        }
        textSizeMenu.querySelectorAll("button").forEach((btn) => {
            btn.addEventListener("click", () => { applyTextSize(btn.dataset.textsize); switchView("home"); });
        });

        applyContrast(selectedContrast);
        applyTextSize(selectedTextSize);

        /* Selection menu (right-click-style) */
        const selectionMenu = document.getElementById("selection-menu");
        selectionMenu.innerHTML = '<button id="sm-highlight"><i class="fas fa-highlighter"></i> Highlight</button><button id="sm-remove"><i class="fas fa-eraser"></i> Remove highlight</button>';
        document.getElementById("sm-highlight").addEventListener("click", () => {
            selectionMenu.style.display = "none";
            if (!lastSelection) return;
            const span = document.createElement("span");
            span.className = "highlight";
            span.appendChild(lastSelection.extractContents());
            lastSelection.insertNode(span);
            window.getSelection().removeAllRanges();
        });
        document.getElementById("sm-remove").addEventListener("click", () => {
            selectionMenu.style.display = "none";
            if (highlightTarget) {
                const parent = highlightTarget.parentNode;
                while (highlightTarget.firstChild) parent.insertBefore(highlightTarget.firstChild, highlightTarget);
                parent.removeChild(highlightTarget);
                highlightTarget = null;
            }
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#selection-menu")) selectionMenu.style.display = "none";
        });
    