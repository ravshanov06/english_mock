(function () {
    if (window.__listeningReviewModeInitialized) return;
    window.__listeningReviewModeInitialized = true;

    function disableAnswerSpellcheck(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var fields = scope.querySelectorAll([
            'input:not([type])',
            'input[type="text"]',
            'input[type="search"]',
            'textarea',
            '[contenteditable="true"]'
        ].join(','));

        fields.forEach(function (field) {
            field.spellcheck = false;
            field.setAttribute('spellcheck', 'false');
            field.setAttribute('autocomplete', 'off');
            field.setAttribute('autocorrect', 'off');
            field.setAttribute('autocapitalize', 'off');
            field.setAttribute('data-gramm', 'false');
            field.setAttribute('data-gramm_editor', 'false');
            field.setAttribute('data-enable-grammarly', 'false');
            field.setAttribute('data-lt-blocked', 'true');
            field.setAttribute('data-ms-editor', 'false');
        });
    }

    function bindSpellcheckGuard() {
        disableAnswerSpellcheck();

        if (document.documentElement) {
            document.documentElement.setAttribute('spellcheck', 'false');
        }
        if (document.body) {
            document.body.setAttribute('spellcheck', 'false');
        }

        if (typeof MutationObserver !== 'function' || !document.body) return;

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches('input, textarea, [contenteditable="true"]')) {
                        disableAnswerSpellcheck({ querySelectorAll: function () { return [node]; } });
                    }
                    disableAnswerSpellcheck(node);
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    bindSpellcheckGuard();

    var searchParams = new URLSearchParams(window.location.search || '');
    var attemptReviewRequested = !!searchParams.get('attempt') && searchParams.get('redo') !== '1';
    var resultsModal = document.getElementById('resultsModal');
    var resultsContent = resultsModal ? resultsModal.querySelector('.results-content') : null;
    var reviewApplied = false;
    var reviewTimer = null;

    function hasVisibleResults() {
        return !!(resultsModal && !resultsModal.classList.contains('hidden'));
    }

    function ensureReviewState() {
        window.__listeningSubmissionObserved = true;
        document.body.classList.add('listening-review-active');

        if (typeof window.__listeningSectionSyncScreens === 'function') {
            window.__listeningSectionSyncScreens();
        }

        var submitButton = document.getElementById('submitBtn');
        if (submitButton) {
            submitButton.disabled = true;
        }

        var audioControllerBar = document.querySelector('.audio-controller-bar');
        if (typeof window.__listeningSectionRevealReviewUI === 'function') {
            window.__listeningSectionRevealReviewUI();
        } else if (audioControllerBar) {
            audioControllerBar.classList.remove('hidden');
        }

        ensureReviewAudioSource();
    }

    function getReviewAudioElement() {
        return document.getElementById('testAudio') || document.getElementById('ieltsAudio');
    }

    function hasPlayableAudioSource(audio) {
        return !!(audio && (audio.getAttribute('src') || audio.currentSrc || audio.querySelector('source[src]')));
    }

    function ensureReviewAudioSource() {
        var audio = getReviewAudioElement();
        if (!audio) return;

        if (!audio.getAttribute('src')) {
            var source = audio.querySelector('source[src]');
            if (source && source.getAttribute('src')) {
                audio.setAttribute('src', source.getAttribute('src'));
            }
        }

        if (hasPlayableAudioSource(audio) && audio.readyState === 0) {
            try {
                audio.load();
            } catch (error) {}
        }
    }

    function enhanceResultsModal() {
        // The "You can now review this listening test…" note used to be
        // injected here. Students reported it cluttered the result window,
        // so it has been removed. We still clean up any pre-existing copy
        // that may be cached in older session DOM snapshots.
        if (!resultsContent) return;
        var stale = resultsContent.querySelector('.listening-review-modal-note');
        if (stale) stale.parentNode.removeChild(stale);
    }

    function finalizeSavedAttemptReview(results) {
        var safeResults = results || { detailedResults: [] };

        if (Array.isArray(safeResults.detailedResults)) {
            window.testResults = safeResults.detailedResults;
        }

        if (typeof window.showResults === 'function') {
            window.showResults(safeResults);
        } else if (resultsModal) {
            resultsModal.classList.remove('hidden');
        }

        if (typeof window.showCorrectAnswers === 'function') {
            window.showCorrectAnswers();
        }

        if (typeof window.highlightAnswers === 'function') {
            window.highlightAnswers();
        }

        window.testSubmitted = true;
        window.__listeningSubmissionObserved = true;
        ensureReviewState();
        enhanceResultsModal();
    }

    function buildSavedAttemptResults() {
        if (typeof window.calculateResults === 'function') {
            return window.calculateResults();
        }

        if (typeof window.checkAnswers === 'function') {
            return window.checkAnswers();
        }

        return null;
    }

    function applySavedAttemptReview() {
        if (!attemptReviewRequested || reviewApplied) return true;

        var testInterface = document.getElementById('testInterface');
        if (testInterface && testInterface.classList.contains('hidden')) {
            return false;
        }

        if (window.testSubmitted || (resultsModal && !resultsModal.classList.contains('hidden'))) {
            reviewApplied = true;
            ensureReviewState();
            enhanceResultsModal();
            return true;
        }

        var results = buildSavedAttemptResults();
        if (!results) return false;

        finalizeSavedAttemptReview(results);
        reviewApplied = true;
        return true;
    }

    function scheduleSavedAttemptReview() {
        if (!attemptReviewRequested || reviewApplied) return;

        var attemptsRemaining = 12;
        window.clearInterval(reviewTimer);
        reviewTimer = window.setInterval(function () {
            if (applySavedAttemptReview() || attemptsRemaining <= 0) {
                window.clearInterval(reviewTimer);
                reviewTimer = null;
                return;
            }
            attemptsRemaining -= 1;
        }, 180);
    }

    if (resultsModal && typeof MutationObserver === 'function') {
        var observer = new MutationObserver(function () {
            if (!resultsModal.classList.contains('hidden')) {
                ensureReviewState();
                enhanceResultsModal();
            }
        });
        observer.observe(resultsModal, { attributes: true, attributeFilter: ['class'] });
    }

    if (typeof window.showResults === 'function') {
        var originalShowResults = window.showResults;
        window.showResults = function () {
            var result = originalShowResults.apply(this, arguments);
            ensureReviewState();
            enhanceResultsModal();
            return result;
        };
    }

    if (typeof window.startTest === 'function') {
        var originalStartTest = window.startTest;
        window.startTest = function () {
            var result = originalStartTest.apply(this, arguments);
            if (attemptReviewRequested) {
                scheduleSavedAttemptReview();
            }
            return result;
        };
    }

    if (hasVisibleResults() || window.__listeningSubmissionObserved) {
        ensureReviewState();
        enhanceResultsModal();
    }
})();
