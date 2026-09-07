(function () {
    'use strict';

    var data = window.READING_ANSWER_EXPLANATIONS;
    if (!data || !data.items) return;

    var tooltip;
    var activeMark = null;
    var activeQuestion = null;
    var annotationsBuilt = false;

    function passageNumber(question) {
        if (question <= 13) return 1;
        if (question <= 26) return 2;
        return 3;
    }

    function passageRoot(question) {
        var expected = document.getElementById(
            'passage' + passageNumber(question)
        );
        if (expected) return expected;

        /*
         * Full reading tests contain passage1, passage2 and passage3, while a
         * standalone Passage 2 or Passage 3 test contains only one passage
         * panel.  Most standalone pages intentionally keep that panel's
         * legacy id as passage1 even though their questions retain the full
         * IELTS numbering (14-26 or 27-40).  In that layout the sole passage
         * panel is the correct evidence root.
         */
        var standalonePassages = document.querySelectorAll(
            '.passage-content[id^="passage"]'
        );
        if (standalonePassages.length === 1) {
            return standalonePassages[0];
        }
        return null;
    }

    function textNodes(root) {
        var nodes = [];
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
            var parent = node.parentElement;
            if (
                parent &&
                !parent.closest('.reading-evidence-qbadge') &&
                !parent.closest('.reading-evidence-mark') &&
                !parent.closest('.reading-evidence-tooltip') &&
                !parent.closest('[data-question-anchor]') &&
                !parent.closest('.drop-zone')
            ) {
                nodes.push(node);
            }
        }
        return nodes;
    }

    function normalizedSearchView(value) {
        var raw = String(value || '');
        var normalized = '';
        var rawOffsets = [];
        for (var index = 0; index < raw.length; index += 1) {
            var character = raw.charAt(index);
            var lower = character.toLowerCase();
            var isLetter = lower !== character.toUpperCase();
            var isNumber = /[0-9]/.test(character);
            if (isLetter || isNumber) {
                normalized += lower;
                rawOffsets.push(index);
            } else if (
                normalized &&
                normalized.charAt(normalized.length - 1) !== ' '
            ) {
                normalized += ' ';
                rawOffsets.push(index);
            }
        }
        if (normalized.charAt(normalized.length - 1) === ' ') {
            normalized = normalized.slice(0, -1);
            rawOffsets.pop();
        }
        return { text: normalized, rawOffsets: rawOffsets };
    }

    function evidenceChunks(evidence) {
        return String(evidence || '')
            .split(/\s*(?:\.{3,}|…|\[\s*(?:…|\.{3,})\s*\])\s*/)
            .map(function (chunk) {
                return normalizedSearchView(chunk).text.trim();
            })
            .filter(Boolean);
    }

    function wordCount(value) {
        return String(value || '').split(/\s+/).filter(Boolean).length;
    }

    function bestPhrase(text, chunk) {
        var exact = text.indexOf(chunk);
        if (exact !== -1) {
            return {
                start: exact,
                end: exact + chunk.length,
                words: wordCount(chunk),
                exact: true
            };
        }

        /*
         * A few manually reviewed records include a bracketed clarification
         * or a tiny grammatical change.  Use only a substantial consecutive
         * phrase from such a record; three words is long enough to avoid
         * matching generic fragments such as "in the passage".
         */
        var words = chunk.split(/\s+/).filter(Boolean);
        for (
            var size = Math.min(12, words.length);
            size >= 3;
            size -= 1
        ) {
            for (var startWord = 0; startWord <= words.length - size; startWord += 1) {
                var phrase = words.slice(startWord, startWord + size).join(' ');
                var phraseStart = text.indexOf(phrase);
                if (phraseStart !== -1) {
                    return {
                        start: phraseStart,
                        end: phraseStart + phrase.length,
                        words: size,
                        exact: false
                    };
                }
            }
        }
        return null;
    }

    function locateEvidence(question, evidence) {
        var root = passageRoot(question);
        if (!root) return null;
        var chunks = evidenceChunks(evidence);
        if (!chunks.length) return null;
        var paragraphs = root.querySelectorAll('p');
        var best = null;

        for (var index = 0; index < paragraphs.length; index += 1) {
            var nodes = textNodes(paragraphs[index]);
            var combined = nodes.map(function (node) {
                return node.nodeValue;
            }).join('');
            var view = normalizedSearchView(combined);
            var cursor = 0;
            var sequential = [];
            var allSequential = true;

            chunks.forEach(function (chunk) {
                if (!allSequential) return;
                var found = view.text.indexOf(chunk, cursor);
                if (found === -1) {
                    allSequential = false;
                    return;
                }
                sequential.push({
                    start: found,
                    end: found + chunk.length,
                    words: wordCount(chunk)
                });
                cursor = found + chunk.length;
            });

            var matches = sequential;
            var score = 0;
            if (allSequential && matches.length === chunks.length) {
                score = matches.reduce(function (sum, match) {
                    return sum + match.words;
                }, 0) + 1000;
            } else {
                matches = chunks.map(function (chunk) {
                    return bestPhrase(view.text, chunk);
                }).filter(Boolean);
                score = matches.reduce(function (sum, match) {
                    return sum + match.words;
                }, 0);
            }
            if (!matches.length || score < 3) continue;

            var normalizedStart = Math.min.apply(
                null,
                matches.map(function (match) { return match.start; })
            );
            var normalizedEnd = Math.max.apply(
                null,
                matches.map(function (match) { return match.end; })
            );
            var candidate = {
                paragraph: paragraphs[index],
                nodes: nodes,
                startOffset: view.rawOffsets[normalizedStart],
                endOffset: view.rawOffsets[normalizedEnd - 1] + 1,
                score: score
            };
            if (!best || candidate.score > best.score) best = candidate;
        }
        return best;
    }

    function boundary(nodes, absoluteOffset) {
        var cursor = 0;
        for (var index = 0; index < nodes.length; index += 1) {
            var length = nodes[index].nodeValue.length;
            if (absoluteOffset <= cursor + length) {
                return {
                    node: nodes[index],
                    offset: absoluteOffset - cursor
                };
            }
            cursor += length;
        }
        return null;
    }

    function wrapEvidence(question, item) {
        var passage = passageRoot(question);
        if (!passage) return null;
        var wanted = String(item.evidence || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        var existingMarks = passage.querySelectorAll(
            '.reading-evidence-mark'
        );
        for (var markIndex = 0; markIndex < existingMarks.length; markIndex += 1) {
            var copy = existingMarks[markIndex].cloneNode(true);
            Array.prototype.forEach.call(
                copy.querySelectorAll('.reading-evidence-qbadge'),
                function (badge) { badge.remove(); }
            );
            var markedText = copy.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            if (markedText === wanted) {
                existingMarks[markIndex].classList.add(
                    'reading-evidence-mark-shared'
                );
                addQuestionBadge(
                    existingMarks[markIndex],
                    question,
                    item
                );
                return existingMarks[markIndex];
            }
        }

        var located = locateEvidence(question, item.evidence);
        if (!located) return null;
        var start = boundary(located.nodes, located.startOffset);
        var end = boundary(located.nodes, located.endOffset);
        if (!start || !end) return null;

        var range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);

        var mark = document.createElement('mark');
        mark.className = 'reading-evidence-mark';
        mark.tabIndex = 0;
        mark.dataset.question = String(question);
        mark.setAttribute(
            'aria-label',
            'Question ' + question + ' answer evidence. Open explanation.'
        );
        mark.appendChild(range.extractContents());

        addQuestionBadge(mark, question, item);
        range.insertNode(mark);

        bindMark(mark, question, item);
        return mark;
    }

    function addQuestionBadge(mark, question, item) {
        var badge = document.createElement('span');
        badge.className = 'reading-evidence-qbadge';
        badge.dataset.question = String(question);
        badge.tabIndex = 0;
        badge.setAttribute('role', 'button');
        badge.setAttribute(
            'aria-label',
            'Open explanation for Question ' + question
        );
        badge.textContent = 'Q' + question;
        mark.appendChild(badge);
        function activate(event) {
            event.stopPropagation();
            if (
                activeMark === mark &&
                activeQuestion === question &&
                tooltip.classList.contains('is-open')
            ) {
                closeTooltip();
            } else {
                openTooltip(mark, question, item);
            }
        }
        badge.addEventListener('click', activate);
        badge.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activate(event);
        });
    }

    function appendTooltipRow(label, value, className) {
        var row = document.createElement('div');
        row.className =
            'reading-evidence-tooltip-row' +
            (className ? ' ' + className : '');
        var heading = document.createElement('span');
        heading.className = 'reading-evidence-tooltip-label';
        heading.textContent = label;
        row.appendChild(heading);
        row.appendChild(document.createTextNode(value));
        tooltip.appendChild(row);
    }

    function fillTooltip(question, item) {
        tooltip.innerHTML = '';
        var link = data.links && data.links[question];
        var title = document.createElement('div');
        title.className = 'reading-evidence-tooltip-title';
        var titleText = document.createElement('span');
        titleText.textContent = 'Question ' + question;
        var answer = document.createElement('span');
        answer.className = 'reading-evidence-tooltip-answer';
        answer.textContent = 'Answer: ' + item.answer;
        title.appendChild(titleText);
        title.appendChild(answer);
        tooltip.appendChild(title);

        if (link) {
            appendTooltipRow(
                'Question wording',
                link.clue,
                'reading-evidence-tooltip-clue'
            );
            appendTooltipRow(
                'Synonyms and paraphrases',
                link.language,
                'reading-evidence-tooltip-language'
            );
        }
        appendTooltipRow(
            'Exact passage evidence',
            '“' + item.evidence + '”',
            'reading-evidence-tooltip-quote'
        );
        appendTooltipRow(
            'Why this answer is correct',
            item.why,
            'reading-evidence-tooltip-reason'
        );
        if (item.others) {
            appendTooltipRow(
                'Why the other choices are incorrect',
                item.others,
                'reading-evidence-tooltip-others'
            );
        }

        var location = document.createElement('div');
        location.className = 'reading-evidence-tooltip-location';
        location.textContent = item.location;
        tooltip.appendChild(location);
    }

    function positionTooltip(mark) {
        if (window.innerWidth <= 768) return;
        var rect = mark.getBoundingClientRect();
        var safeTop = 12;
        var safeBottom = 88;
        var tooltipRect = tooltip.getBoundingClientRect();
        var gap = 9;
        var availableHeight = Math.max(
            240,
            window.innerHeight - safeTop - safeBottom
        );
        tooltip.style.maxHeight = availableHeight + 'px';
        tooltipRect = tooltip.getBoundingClientRect();
        var left = Math.min(
            window.innerWidth - tooltipRect.width - 12,
            Math.max(12, rect.left)
        );
        var spaceBelow =
            window.innerHeight - safeBottom - rect.bottom - gap;
        var spaceAbove = rect.top - safeTop - gap;
        var top;
        if (tooltipRect.height <= spaceBelow) {
            top = rect.bottom + gap;
        } else if (tooltipRect.height <= spaceAbove) {
            top = rect.top - tooltipRect.height - gap;
        } else {
            top = safeTop;
        }
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.scrollTop = 0;
    }

    function openTooltip(mark, question, item) {
        if (activeMark && activeMark !== mark) {
            activeMark.classList.remove('is-active');
        }
        activeMark = mark;
        activeQuestion = question;
        mark.classList.add('is-active');
        fillTooltip(question, item);
        tooltip.classList.add('is-open');
        tooltip.setAttribute('aria-hidden', 'false');
        window.requestAnimationFrame(function () {
            positionTooltip(mark);
        });
    }

    function closeTooltip() {
        if (activeMark) activeMark.classList.remove('is-active');
        activeMark = null;
        activeQuestion = null;
        tooltip.classList.remove('is-open');
        tooltip.setAttribute('aria-hidden', 'true');
    }

    function bindMark(mark, question, item) {
        mark.addEventListener('click', function (event) {
            if (event.target.closest('.reading-evidence-qbadge')) return;
            event.stopPropagation();
            if (
                activeMark === mark &&
                activeQuestion === question &&
                tooltip.classList.contains('is-open')
            ) {
                closeTooltip();
            } else {
                openTooltip(mark, question, item);
            }
        });
        mark.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            mark.click();
        });
    }

    function sameQuestions(left, right) {
        if (left.length !== right.length) return false;
        for (var index = 0; index < left.length; index += 1) {
            if (left[index].question !== right[index].question) return false;
        }
        return true;
    }

    function renderAnnotationSegment(paragraph, segment) {
        var nodes = textNodes(paragraph);
        var start = boundary(nodes, segment.start);
        var end = boundary(nodes, segment.end);
        if (!start || !end) return;

        var range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);

        var mark = document.createElement('mark');
        mark.className = 'reading-evidence-mark';
        if (segment.active.length > 1) {
            mark.classList.add('reading-evidence-mark-shared');
        }
        mark.tabIndex = 0;
        mark.dataset.question = segment.active.map(function (record) {
            return record.question;
        }).join(',');
        mark.setAttribute(
            'aria-label',
            'Answer evidence for Question ' + mark.dataset.question +
            '. Open explanation.'
        );
        mark.appendChild(range.extractContents());

        var badgesAdded = 0;
        segment.active.forEach(function (record) {
            /* Put each Q badge at the end of that question's own evidence. */
            if (segment.end !== record.end) return;
            addQuestionBadge(
                mark,
                record.question,
                record.item
            );
            badgesAdded += 1;
        });

        /*
         * Clicking a shared colour area opens the most specific explanation;
         * every other explanation remains available from its Q badge.
         */
        var primary = segment.active.slice().sort(function (left, right) {
            return (left.end - left.start) - (right.end - right.start);
        })[0];
        bindMark(mark, primary.question, primary.item);
        range.insertNode(mark);
    }

    function buildAnnotations() {
        if (annotationsBuilt) return;
        annotationsBuilt = true;
        var groups = [];

        /* Locate every answer before changing the DOM so overlaps are safe. */
        Object.keys(data.items).forEach(function (key) {
            var question = Number(key);
            var item = data.items[key];
            var located = locateEvidence(question, item.evidence);
            if (!located) return;
            var group = groups.filter(function (candidate) {
                return candidate.paragraph === located.paragraph;
            })[0];
            if (!group) {
                group = {
                    paragraph: located.paragraph,
                    ranges: []
                };
                groups.push(group);
            }
            group.ranges.push({
                question: question,
                item: item,
                start: located.startOffset,
                end: located.endOffset
            });
        });

        groups.forEach(function (group) {
            var boundaries = [];
            group.ranges.forEach(function (record) {
                boundaries.push(record.start, record.end);
            });
            boundaries = boundaries.filter(function (value, index, values) {
                return values.indexOf(value) === index;
            }).sort(function (left, right) { return left - right; });

            var segments = [];
            for (var index = 0; index < boundaries.length - 1; index += 1) {
                var segmentStart = boundaries[index];
                var segmentEnd = boundaries[index + 1];
                var active = group.ranges.filter(function (record) {
                    return record.start < segmentEnd && record.end > segmentStart;
                }).sort(function (left, right) {
                    return left.question - right.question;
                });
                if (!active.length) continue;
                var previous = segments[segments.length - 1];
                if (
                    previous &&
                    previous.end === segmentStart &&
                    sameQuestions(previous.active, active)
                ) {
                    previous.end = segmentEnd;
                } else {
                    segments.push({
                        start: segmentStart,
                        end: segmentEnd,
                        active: active
                    });
                }
            }

            /* Right-to-left preserves the original offsets in each paragraph. */
            segments.sort(function (left, right) {
                return right.start - left.start;
            }).forEach(function (segment) {
                renderAnnotationSegment(group.paragraph, segment);
            });
        });
    }

    function initialize() {
        tooltip = document.createElement('aside');
        tooltip.className = 'reading-evidence-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltip);

        var reviewButton = document.getElementById('review-answers');
        if (reviewButton) {
            reviewButton.addEventListener('click', function () {
                window.setTimeout(buildAnnotations, 0);
            });
        }

        if (document.body.classList.contains('reading-review-active')) {
            buildAnnotations();
        }
        if (typeof MutationObserver === 'function') {
            new MutationObserver(function () {
                if (document.body.classList.contains('reading-review-active')) {
                    buildAnnotations();
                }
            }).observe(document.body, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        document.addEventListener('click', function (event) {
            if (
                activeMark &&
                !event.target.closest('.reading-evidence-mark') &&
                !event.target.closest('.reading-evidence-tooltip')
            ) {
                closeTooltip();
            }
        });
        window.addEventListener('resize', closeTooltip);
        document.addEventListener('scroll', function (event) {
            /*
             * Scroll events do not bubble, so this listener uses capture to
             * notice movement in the passage panels. That also means it sees
             * the tooltip's own scrollbar. Do not close/reset the tooltip
             * while the learner is scrolling through its explanation.
             */
            if (
                event.target === tooltip ||
                (
                    event.target &&
                    event.target.nodeType === 1 &&
                    tooltip.contains(event.target)
                )
            ) {
                return;
            }
            closeTooltip();
        }, true);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeTooltip();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
