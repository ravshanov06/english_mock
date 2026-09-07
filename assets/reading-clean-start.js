(function () {
    'use strict';

    if (window.__readingCleanStartInstalled) return;
    window.__readingCleanStartInstalled = true;

    var script = document.currentScript;
    var testId = script && script.getAttribute('data-test-id');
    var originalStartTest = window.startTest;

    function clearControl(control) {
        if (!control) return;
        if (control.disabled) control.disabled = false;
        if (control.type === 'radio' || control.type === 'checkbox') {
            control.checked = false;
        } else if (control.tagName === 'SELECT') {
            control.selectedIndex = 0;
        } else if (control.type !== 'button' && control.type !== 'submit') {
            control.value = '';
        }
        control.classList.remove(
            'reading-review-correct-field',
            'reading-review-wrong-field'
        );
    }

    function resetDropZones() {
        document.querySelectorAll('.drop-zone').forEach(function (zone) {
            var placeholder = zone.getAttribute('data-placeholder') || '';
            zone.textContent = placeholder;
            zone.classList.remove(
                'filled',
                'correct',
                'incorrect',
                'reading-review-correct-choice',
                'reading-review-wrong-choice'
            );
            zone.removeAttribute('data-option');
            zone.removeAttribute('data-value');
            zone.draggable = false;
        });

        document.querySelectorAll('.drag-item').forEach(function (item) {
            item.classList.remove('used', 'selected');
            item.removeAttribute('data-used');
            item.draggable = true;
        });
    }

    function resetProgressAndReview() {
        document.body.classList.remove('reading-review-active');
        document.querySelectorAll(
            '.answer-indicator,.answer-feedback,.reading-review-generated,' +
            '.reading-evidence-tooltip,.reading-evidence-qbadge'
        ).forEach(function (node) {
            node.remove();
        });
        document.querySelectorAll('.reading-evidence-mark').forEach(function (mark) {
            var parent = mark.parentNode;
            if (!parent) return;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            parent.normalize();
        });
        document.querySelectorAll(
            '.reading-review-correct-choice,.reading-review-wrong-choice'
        ).forEach(function (node) {
            node.classList.remove(
                'reading-review-correct-choice',
                'reading-review-wrong-choice'
            );
        });
        document.querySelectorAll('.progress-item').forEach(function (item) {
            item.classList.remove(
                'answered',
                'correct',
                'incorrect',
                'current'
            );
        });
        var firstProgress = document.querySelector('.progress-item');
        if (firstProgress) firstProgress.classList.add('current');
    }

    function unwrapUserHighlights() {
        document.querySelectorAll('.highlight').forEach(function (highlight) {
            var parent = highlight.parentNode;
            if (!parent) return;
            while (highlight.firstChild) {
                parent.insertBefore(highlight.firstChild, highlight);
            }
            parent.removeChild(highlight);
            parent.normalize();
        });
    }

    function clearSavedState() {
        if (
            testId &&
            window.IELTSProgress &&
            typeof window.IELTSProgress.saveDraft === 'function'
        ) {
            /* A newer empty draft also wins over an older synced draft. */
            window.IELTSProgress.saveDraft(testId, {});
        }

        try {
            var normalizedPath = decodeURIComponent(window.location.pathname || '')
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/')
                .toLowerCase();
            var highlightPrefix = 'ielts_highlights_v1:' + normalizedPath;
            var legacySuffix = testId ? '_' + testId : '';
            var keys = [];
            for (var index = 0; index < localStorage.length; index += 1) {
                keys.push(localStorage.key(index));
            }
            keys.forEach(function (key) {
                if (!key) return;
                if (key.indexOf(highlightPrefix) === 0) {
                    localStorage.removeItem(key);
                }
                if (
                    legacySuffix &&
                    key.indexOf('ielts_saved_answers_') === 0 &&
                    key.slice(-legacySuffix.length) === legacySuffix
                ) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {}
    }

    function resetAttempt() {
        document.querySelectorAll(
            'input[name^="q"],textarea[name^="q"],select[name^="q"]'
        ).forEach(clearControl);
        resetDropZones();
        resetProgressAndReview();
        unwrapUserHighlights();
        clearSavedState();

        /* Let existing answer listeners see and persist the clean state. */
        var firstAnswer = document.querySelector(
            'input[name^="q"],textarea[name^="q"],select[name^="q"]'
        );
        if (firstAnswer) {
            firstAnswer.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    window.startTest = function () {
        resetAttempt();
        if (typeof originalStartTest === 'function') {
            return originalStartTest.apply(this, arguments);
        }
    };
})();
