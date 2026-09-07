(function () {
    if (window.__readingReviewModeInitialized) return;
    window.__readingReviewModeInitialized = true;

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

    function reviewNorm(value) {
        return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function getReviewTextInput(name) {
        var input = document.querySelector('input[name="' + name + '"]');
        return input && input.type === 'text' ? input : null;
    }

    function escapeReviewHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function displayReviewCorrect(correct) {
        if (correct && correct.type === 'partial') return (correct.options || []).join(', ');
        if (Array.isArray(correct)) return correct.join(', ');
        return String(correct == null ? '' : correct).split('|')[0].replace(/\s*\/\s*/g, ', ');
    }

    function reviewCorrectValues(correct) {
        if (!correct) return [];
        if (correct && correct.type === 'partial') return correct.options || [];
        if (Array.isArray(correct)) return correct;
        return String(correct).split(/[|,/]+/);
    }

    function reviewSelectedValues(value) {
        return String(value || '').split(',');
    }

    function injectReviewStyles() {
        if (document.getElementById('reading-passage-review-highlight-styles')) return;
        var style = document.createElement('style');
        style.id = 'reading-passage-review-highlight-styles';
        style.textContent = [
            '.reading-review-correct-choice{background:#dcfce7!important;border:1px solid #22c55e!important;color:#14532d!important;border-radius:6px;padding:4px 6px;box-shadow:0 0 0 2px rgba(34,197,94,.12);}',
            '.reading-review-wrong-choice{background:#fee2e2!important;border:1px solid #ef4444!important;color:#7f1d1d!important;border-radius:6px;padding:4px 6px;box-shadow:0 0 0 2px rgba(239,68,68,.10);}',
            'label.reading-review-correct-choice,label.reading-review-wrong-choice{display:inline-block;}',
            'td.reading-review-correct-choice,td.reading-review-wrong-choice{padding:6px!important;}',
            '.reading-review-correct-field{border-color:#22c55e!important;background:#f0fdf4!important;box-shadow:0 0 0 2px rgba(34,197,94,.20)!important;}',
            '.reading-review-wrong-field{border-color:#ef4444!important;background:#fff1f2!important;box-shadow:0 0 0 2px rgba(239,68,68,.18)!important;}',
            '.reading-review-generated{display:block;margin-top:6px;padding:10px 12px;border-radius:5px;font-size:.92rem;}',
            '.reading-review-generated.correct{background:#dcfce7;border:1px solid #22c55e;color:#14532d;}',
            '.reading-review-generated.incorrect{background:#fee2e2;border:1px solid #ef4444;color:#7f1d1d;}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function clearGeneratedReview() {
        document.querySelectorAll('.reading-review-generated').forEach(function (node) { node.remove(); });
        document.querySelectorAll('.reading-review-correct-choice,.reading-review-wrong-choice,.reading-review-correct-field,.reading-review-wrong-field').forEach(function (node) {
            node.classList.remove('reading-review-correct-choice', 'reading-review-wrong-choice', 'reading-review-correct-field', 'reading-review-wrong-field');
        });
    }

    function optionTarget(input) {
        if (!input) return null;
        var label = input.closest ? input.closest('label') : null;
        if (label) return label;
        var cell = input.closest ? input.closest('td') : null;
        if (cell) return cell;
        return input.parentNode || input;
    }

    function addReviewBox(target, res, combinedCorrect) {
        if (!target || !res) return;
        var box = document.createElement('div');
        box.className = 'reading-review-generated ' + (res.isCorrect ? 'correct' : 'incorrect');
        var correct = combinedCorrect || displayReviewCorrect(res.correct);
        box.innerHTML = res.isCorrect
            ? '<strong>Correct!</strong>'
            : '<strong>Incorrect.</strong> Your answer: <strong>' + escapeReviewHtml(res.userAnswer || 'No answer') + '</strong> <strong>Correct:</strong> ' + escapeReviewHtml(correct);
        target.appendChild(box);
    }

    function groupedQuestionNumbersFromName(name) {
        var numbers = [];
        String(name || '').replace(/\d+/g, function (match) {
            numbers.push(parseInt(match, 10));
            return match;
        });
        if (numbers.length === 2 && numbers[1] > numbers[0] + 1) {
            var range = [];
            for (var q = numbers[0]; q <= numbers[1]; q += 1) range.push(q);
            return range;
        }
        return numbers;
    }

    function enhanceGroupedCheckboxIndicators(results) {
        if (!results || typeof results !== 'object') return;
        injectReviewStyles();

        var checkboxGroups = {};
        document.querySelectorAll('input[type="checkbox"][name^="q"]').forEach(function (input) {
            if (!/_\d+/.test(input.name || '')) return;
            checkboxGroups[input.name] = checkboxGroups[input.name] || [];
            checkboxGroups[input.name].push(input);
        });

        Object.keys(checkboxGroups).forEach(function (name) {
            var inputs = checkboxGroups[name];
            if (!inputs.length) return;

            var keys = groupedQuestionNumbersFromName(name).map(function (q) { return 'q' + q; }).filter(function (key) {
                return !!results[key];
            });
            if (!keys.length) return;

            var correctValues = [];
            keys.forEach(function (key) {
                correctValues = correctValues.concat(reviewCorrectValues(results[key].correct));
            });
            correctValues = Array.from(new Set(correctValues.map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
            if (!correctValues.length) return;

            var userValues = inputs.filter(function (input) { return input.checked; }).map(function (input) {
                return String(input.value || '').trim();
            }).filter(Boolean);
            userValues = Array.from(new Set(userValues));
            var userNorms = userValues.map(reviewNorm);
            var isCorrect = userValues.length === correctValues.length && correctValues.every(function (value) {
                return userNorms.indexOf(reviewNorm(value)) !== -1;
            });

            highlightOptions(inputs, correctValues, userValues);

            var groupQuestion = inputs[0].closest && (inputs[0].closest('.question') || inputs[0].closest('.question-group'));
            var target = groupQuestion ? (groupQuestion.querySelector('.options') || groupQuestion) : inputs[0].parentNode;
            if (!target) return;
            target.querySelectorAll('.answer-indicator,.reading-review-generated').forEach(function (node) {
                node.remove();
            });

            var box = document.createElement('div');
            box.className = 'answer-indicator ' + (isCorrect ? 'correct' : 'incorrect');
            box.style.display = 'block';
            box.style.marginTop = '6px';
            box.innerHTML = isCorrect
                ? '<i class="fas fa-check"></i> Correct! <strong>Answers:</strong> ' + escapeReviewHtml(correctValues.join(', '))
                : '<i class="fas fa-times"></i> Incorrect. Your answer: <strong>' + escapeReviewHtml(userValues.join(',') || 'No answer') + '</strong> <strong>Correct:</strong> ' + escapeReviewHtml(correctValues.join(', '));
            target.appendChild(box);
        });
    }

    function highlightOptions(inputs, correctValues, userValues) {
        var correctSet = new Set((correctValues || []).map(function (item) { return reviewNorm(item); }).filter(Boolean));
        var userSet = new Set((userValues || []).map(function (item) { return reviewNorm(item); }).filter(Boolean));
        inputs.forEach(function (input) {
            var target = optionTarget(input);
            var value = reviewNorm(input.value);
            if (!target || !value) return;
            if (correctSet.has(value)) target.classList.add('reading-review-correct-choice');
            if (userSet.has(value) && !correctSet.has(value)) target.classList.add('reading-review-wrong-choice');
        });
    }

    function keysForCheckboxGroup(name, inputs, results) {
        var keys = [];
        var numbers = [];
        String(name || '').replace(/\d+/g, function (match) {
            numbers.push(parseInt(match, 10));
            return match;
        });
        if (numbers.length === 2 && numbers[1] > numbers[0] + 1) {
            for (var q = numbers[0]; q <= numbers[1]; q += 1) {
                var rangeKey = 'q' + q;
                if (results[rangeKey] && keys.indexOf(rangeKey) === -1) keys.push(rangeKey);
            }
        } else {
            numbers.forEach(function (number) {
                var key = 'q' + number;
                if (results[key] && keys.indexOf(key) === -1) keys.push(key);
            });
        }
        if (!keys.length && inputs[0]) {
            var group = inputs[0].closest && (inputs[0].closest('.question-group') || inputs[0].closest('.question'));
            if (group) {
                group.querySelectorAll('input[name^="q"]').forEach(function (input) {
                    var match = /^q(\d+)$/.exec(input.name || '');
                    if (!match) return;
                    var key = 'q' + match[1];
                    if (results[key] && keys.indexOf(key) === -1) keys.push(key);
                });
            }
        }
        return keys;
    }

    function applyStoredPassageReview() {
        if (!document.body || !document.body.classList.contains('review-mode')) return;
        var results = {};
        try {
            results = JSON.parse(localStorage.getItem('ielts_results') || '{}') || {};
        } catch (error) {
            results = {};
        }
        if (!Object.keys(results).length) return;

        injectReviewStyles();
        clearGeneratedReview();

        var handledKeys = {};
        var checkboxGroups = {};
        document.querySelectorAll('input[type="checkbox"][name]').forEach(function (input) {
            checkboxGroups[input.name] = checkboxGroups[input.name] || [];
            checkboxGroups[input.name].push(input);
        });

        Object.keys(checkboxGroups).forEach(function (name) {
            var inputs = checkboxGroups[name];
            var keys = keysForCheckboxGroup(name, inputs, results);
            if (!keys.length) return;
            var correctValues = [];
            var userValues = [];
            keys.forEach(function (key) {
                handledKeys[key] = true;
                correctValues = correctValues.concat(reviewCorrectValues(results[key].correct));
                userValues = userValues.concat(reviewSelectedValues(results[key].userAnswer));
            });
            correctValues = Array.from(new Set(correctValues.map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
            userValues = Array.from(new Set(userValues.map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
            highlightOptions(inputs, correctValues, userValues);
            var reviewTarget = inputs[0].closest && (inputs[0].closest('.question-group') || inputs[0].closest('.question') || inputs[0].parentNode);
            addReviewBox(reviewTarget, {
                isCorrect: correctValues.length > 0 && userValues.length === correctValues.length && correctValues.every(function (value) {
                    return userValues.map(reviewNorm).indexOf(reviewNorm(value)) !== -1;
                }),
                userAnswer: userValues.join(',') || 'No answer',
                correct: correctValues
            }, correctValues.join(', '));
        });

        Object.keys(results).forEach(function (key) {
            if (handledKeys[key]) return;
            var res = results[key];
            if (!res) return;
            var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="' + key + '"][type="radio"]'));
            var text = getReviewTextInput(key);
            var sel = document.querySelector('select[name="' + key + '"]');
            var target = null;

            if (radios.length) {
                highlightOptions(radios, reviewCorrectValues(res.correct), reviewSelectedValues(res.userAnswer));
                target = (radios[0].closest && (radios[0].closest('.question') || radios[0].closest('.question-group'))) || radios[0].parentNode;
            } else if (text) {
                text.classList.add(res.isCorrect ? 'reading-review-correct-field' : 'reading-review-wrong-field');
                target = text.parentNode;
            } else if (sel) {
                sel.classList.add(res.isCorrect ? 'reading-review-correct-field' : 'reading-review-wrong-field');
                target = sel.parentNode;
            }
            addReviewBox(target, res);
        });
    }

    function bindPassageReviewObserver() {
        if (!document.body || document.body.dataset.readingPassageReviewObserver === '1') return;
        document.body.dataset.readingPassageReviewObserver = '1';
        applyStoredPassageReview();
        if (typeof MutationObserver !== 'function') return;
        var observer = new MutationObserver(function (mutations) {
            if (mutations.some(function (mutation) { return mutation.attributeName === 'class'; })) {
                applyStoredPassageReview();
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPassageReviewObserver);
    } else {
        bindPassageReviewObserver();
    }

    window.IELTSReadingReviewMode = window.IELTSReadingReviewMode || {};
    window.IELTSReadingReviewMode.enhanceGroupedCheckboxIndicators = enhanceGroupedCheckboxIndicators;

    var searchParams = new URLSearchParams(window.location.search || '');
    var attemptReviewRequested = !!searchParams.get('attempt') && searchParams.get('redo') !== '1';
    var reviewApplied = false;
    var reviewTimer = null;

    if (!attemptReviewRequested) return;

    function getSubmitButton() {
        return document.getElementById('submit-all-btn');
    }

    function getReviewButton() {
        return document.getElementById('review-answers');
    }

    function getResultsModal() {
        return document.getElementById('results-modal');
    }

    function isTestVisible() {
        var testContainer = document.getElementById('testContainer');
        if (!testContainer) return true;
        return !testContainer.classList.contains('hidden');
    }

    function suppressTracking(callback) {
        var progress = window.IELTSProgress;
        if (!progress || typeof progress.trackTestResult !== 'function') {
            return callback();
        }

        var originalTrackTestResult = progress.trackTestResult;
        progress.trackTestResult = function () {};

        try {
            return callback();
        } finally {
            progress.trackTestResult = originalTrackTestResult;
        }
    }

    function triggerSubmitFlow() {
        var submitButton = getSubmitButton();
        if (!submitButton) return false;

        var originalConfirm = window.confirm;
        window.confirm = function () { return true; };

        try {
            suppressTracking(function () {
                submitButton.click();
            });
        } finally {
            window.confirm = originalConfirm;
        }

        return true;
    }

    function openReviewedAnswers() {
        var reviewButton = getReviewButton();
        if (!reviewButton) return false;

        if (typeof reviewButton.onclick === 'function') {
            reviewButton.onclick();
            return true;
        }

        reviewButton.click();
        return true;
    }

    function applySavedAttemptReview() {
        if (reviewApplied) return true;
        if (!isTestVisible()) return false;

        var submitButton = getSubmitButton();
        var reviewButton = getReviewButton();
        if (!submitButton || !reviewButton) return false;

        if (!submitButton.disabled) {
            if (!triggerSubmitFlow()) return false;
        }

        openReviewedAnswers();

        var resultsModal = getResultsModal();
        if (resultsModal) {
            resultsModal.style.display = 'none';
        }

        reviewApplied = true;
        document.body.classList.add('reading-review-active');
        return true;
    }

    function scheduleSavedAttemptReview() {
        if (reviewApplied) return;

        var attemptsRemaining = 16;
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

    if (typeof window.startTest === 'function') {
        var originalStartTest = window.startTest;
        window.startTest = function () {
            var result = originalStartTest.apply(this, arguments);
            scheduleSavedAttemptReview();
            return result;
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleSavedAttemptReview);
    } else {
        scheduleSavedAttemptReview();
    }
})();
