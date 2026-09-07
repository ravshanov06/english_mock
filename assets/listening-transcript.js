(function () {
    'use strict';

    var data = window.LISTENING_TRANSCRIPT_DATA;
    if (!data || !Array.isArray(data.transcript) || !data.transcript.length) return;

    var transcriptTextCorrections = {
        'section4-7': [
            {
                find: 'when they are exposed to potentially harmful traits.',
                replace: 'when they are exposed to potentially harmful light.'
            }
        ],
        'section4-13': [
            {
                find: 'Among human-related dangers, seahorses pose the greatest threat.',
                replace: 'Among human-related dangers, fishing poses the greatest threat.'
            }
        ]
    };
    (transcriptTextCorrections[data.test] || []).forEach(function (correction) {
        data.transcript.forEach(function (entry) {
            if (!entry || typeof entry.text !== 'string') return;
            entry.text = entry.text.split(correction.find).join(correction.replace);
        });
    });

    var evidenceCorrections = {
        'section1-1': {
            2: {
                phrase: "It's T-Y-12-6-O-S.",
                highlight: 'T-Y-12-6-O-S'
            }
        },
        'section1-2': {
            10: {
                phrase: "Of course. It's b-e-a-u-m-o-n-d.com.",
                highlight: 'b-e-a-u-m-o-n-d'
            }
        },
        'section1-6': {
            5: {
                phrase: "That's Q Y zero nine one eight.",
                highlight: 'Q Y zero nine one eight'
            }
        },
        'section1-7': {
            10: {
                phrase: "Greatly. That's spelled G-R-A-T-E-L-E-Y.",
                highlight: 'G-R-A-T-E-L-E-Y'
            }
        },
        'section1-9': {
            1: {
                phrase: "That's C-R-E-S-W-I-C-K.",
                highlight: 'C-R-E-S-W-I-C-K'
            }
        },
        'section1-11': {
            5: {
                phrase: 'she is eight. NURSE So, I will put nine down.',
                highlight: 'nine'
            }
        },
        'section1-13': {
            1: {
                phrase: 'My work phone is 9463 550.',
                highlight: '9463 550'
            }
        },
        'section1-15': {
            7: {
                phrase: "No. It's L-E-I-G-H.",
                highlight: 'L-E-I-G-H'
            }
        },
        'section1-16': {
            1: {
                phrase: '07 958 847 222.',
                highlight: '07 958 847 222'
            },
            4: {
                phrase: "Well, we definitely need to be there for the 24th. So, if we leave the UK on the 22nd, we'll have time to recover on the 23rd.",
                highlight: '22nd'
            }
        },
        'section2-8': {
            16: {
                phrase: 'And the station was ready for trains to start using it again earlier this year.',
                highlight: 'start using it again earlier this year'
            }
        },
        'section4-14': {
            32: {
                phrase: "Another reason is that the original designers didn't expect the fast population growth.",
                highlight: 'population'
            }
        },
        'section4-7': {
            36: {
                phrase: 'when they are exposed to potentially harmful light.',
                highlight: 'light'
            },
            39: {
                phrase: 'There, saffron was used as a perfume to keep the places smelling fresh and aromatic.',
                highlight: 'perfume'
            }
        },
        'section4-13': {
            38: {
                phrase: 'Among human-related dangers, fishing poses the greatest threat.',
                highlight: 'fishing'
            }
        },
        'section4-18': {
            39: {
                phrase: 'Oyster is a source of seafood popular among the local hospitality industry.',
                highlight: 'hospitality'
            },
            40: {
                phrase: 'The government ought to restore the business by encouraging aquaculture, recreation, and shipping.',
                highlight: 'shipping'
            }
        },
        4: {
            37: {
                phrase: 'Because the instructions on the equipment were often located in places where they were difficult to read',
                highlight: 'instructions'
            }
        },
        10: {
            32: {
                phrase: 'some people are genetically disposed to developing the disease',
                highlight: 'genetically disposed'
            },
            38: {
                phrase: 'provided by the Manufacturing Pharmaceutical Company at cost price',
                highlight: 'at cost price'
            }
        },
        13: {
            8: {
                phrase: 'choice of doing comic or what we call classic work',
                highlight: 'comic'
            }
        },
        15: {
            29: {
                phrase: "since the graphics were my idea, I'll take those on",
                highlight: 'graphics'
            },
            30: {
                phrase: 'crunching. Okay.',
                highlight: 'crunching'
            }
        },
        20: {
            39: {
                phrase: 'local people produce ropes from them',
                highlight: 'ropes'
            }
        },
        21: {
            6: {
                phrase: 'for towels unless you bring your own',
                highlight: 'towels'
            },
            34: {
                phrase: 'action',
                highlight: 'action'
            }
        },
        24: {
            7: {
                phrase: 'There are six in total',
                highlight: 'six'
            }
        },
        26: {
            31: {
                phrase: 'total fat consumption is highest for teenagers',
                highlight: 'teenagers'
            },
            34: {
                phrase: 'surveys were conducted',
                highlight: 'surveys'
            }
        },
        29: {
            34: {
                phrase: 'giving them similar rights to natural resources',
                highlight: 'rights'
            }
        },
        32: {
            32: {
                phrase: 'incentive schemes that were initiated by airlines',
                highlight: 'airlines'
            }
        },
        34: {
            6: {
                phrase: 'for towels unless you bring your own',
                highlight: 'towels'
            }
        },
        36: {
            1: {
                phrase: 'How about animals this year',
                highlight: 'animals'
            }
        },
        38: {
            10: {
                phrase: 'no more than three hours at the most',
                highlight: 'three hours'
            },
            35: {
                phrase: 'They were generally satisfied in terms of their salary',
                highlight: 'salary'
            }
        },
        40: {
            4: {
                phrase: "Nick Poskitt. That's P-O-S-K-I-T-T",
                highlight: 'Poskitt'
            },
            5: {
                phrase: "it's Hawthorn Way actually",
                highlight: 'Way'
            },
            7: {
                phrase: 'of fish. I\'m fine with everything else',
                highlight: 'fish'
            },
            8: {
                phrase: "there's blues? Yes maybe",
                highlight: 'blues'
            },
            9: {
                phrase: 'you from a magazine',
                highlight: 'magazine'
            },
            11: {
                phrase: 'paint pictures of the local landscape',
                highlight: 'paint pictures'
            },
            12: {
                phrase: "we've built a climbing wall and there'll also be an inflatable bouncy",
                highlight: 'climbing wall'
            },
            13: {
                phrase: "If you're over 18 there's an exciting contest to take part in here",
                highlight: 'contest'
            },
            14: {
                phrase: 'performing and singing throughout the day',
                highlight: 'performing and singing'
            },
            15: {
                phrase: 'advice on how to successfully grow your own fruit and vegetables',
                highlight: 'grow your own fruit and vegetables'
            },
            18: {
                phrase: "we'll also be offering day trips to",
                highlight: 'day trips'
            },
            19: {
                phrase: "it's twice the",
                highlight: 'twice'
            },
            21: {
                phrase: 'The title is professional learning',
                highlight: 'professional learning'
            },
            23: {
                phrase: "It's on presenting results as part of the wider collaborative culture",
                highlight: 'presenting results'
            },
            24: {
                phrase: 'such as pupil behaviour',
                highlight: 'behaviour'
            },
            27: {
                phrase: 'in classroom simulation',
                highlight: 'simulation'
            }
        },
        42: {
            4: {
                phrase: 'let them drive a tractor, or feed the animals',
                highlight: 'feed the animals'
            },
            10: {
                phrase: 'the postcode is S-H-12-1-L-Q',
                highlight: 'S-H-12-1-L-Q'
            },
            22: {
                phrase: 'all these can be represented diagrammatically',
                highlight: 'represented diagrammatically'
            }
        },
        43: {
            25: {
                phrase: 'we should finish off the whole course of tablets',
                highlight: 'finish off the whole course'
            },
            26: {
                phrase: 'there needs to be clearer information given on the packaging',
                highlight: 'clearer information'
            },
            27: {
                phrase: 'make them into things like plant holders for your garden',
                highlight: 'plant holders'
            },
            28: {
                phrase: 'we now have the capacity to use less dangerous materials',
                highlight: 'less dangerous materials'
            },
            29: {
                phrase: 'take it to a centre to be used by people who need it',
                highlight: 'used by people who need it'
            }
        },
        44: {
            32: {
                phrase: 'constructed from specially sharpened stone',
                highlight: 'stone'
            }
        },
        45: {
            15: {
                phrase: 'authorised the spending',
                highlight: 'authorised the spending'
            }
        },
        18: {
            32: {
                phrase: 'with them we carried out phone interviews',
                highlight: 'phone interviews'
            },
            38: {
                phrase: 'the thing that was mentioned most often here was presentations',
                highlight: 'presentations'
            }
        }
    };
    var correctionsForTest = evidenceCorrections[data.test] || evidenceCorrections[Number(data.test)] || {};
    if (Array.isArray(data.highlights)) {
        data.highlights.forEach(function (entry) {
            var correction = entry && correctionsForTest[Number(entry.question)];
            if (!correction) return;
            entry.phrase = correction.phrase;
            entry.highlight = correction.highlight;
            entry.method = 'manual-correction';
        });
    }

    var sources = Array.isArray(data.sources) ? data.sources : [];
    var highlights = Array.isArray(data.highlights) ? data.highlights : [];
    var panel;
    var backdrop;
    var content;
    var toggle;
    var cues = [];
    var activeCue = null;
    var activeSource = sources[0] || '';
    var pendingSeek = null;

    function formatTime(totalSeconds) {
        var seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        var minutes = Math.floor(seconds / 60);
        return minutes + ':' + String(seconds % 60).padStart(2, '0');
    }

    function sourceName(value) {
        if (!value) return '';
        try {
            return decodeURIComponent(String(value).split('?')[0].split('/').pop());
        } catch (error) {
            return String(value).split('?')[0].split('/').pop();
        }
    }

    function entrySource(entry) {
        if (typeof entry.source === 'number') return sources[entry.source] || '';
        return entry.source || sources[0] || '';
    }

    function currentAudioSource(audio) {
        return sourceName(audio.currentSrc || audio.getAttribute('src') || activeSource);
    }

    function appendAnswerHighlights(container, text) {
        var lowerText = text.toLowerCase();
        var ranges = [];

        highlights.forEach(function (answer) {
            if (!answer || !answer.phrase) return;
            var phrase = String(answer.phrase).toLowerCase();
            var from = 0;
            var phraseStart;
            while ((phraseStart = lowerText.indexOf(phrase, from)) !== -1) {
                var highlightedText = String(answer.highlight || answer.phrase).toLowerCase();
                var relativeStart = phrase.indexOf(highlightedText);
                if (relativeStart !== -1) {
                    ranges.push({
                        start: phraseStart + relativeStart,
                        end: phraseStart + relativeStart + highlightedText.length,
                        question: answer.question
                    });
                }
                from = phraseStart + phrase.length;
            }
        });

        ranges.sort(function (left, right) {
            return left.start - right.start || left.end - right.end;
        });
        ranges = ranges.reduce(function (merged, range) {
            var previous = merged[merged.length - 1];
            if (previous && previous.start === range.start && previous.end === range.end) {
                previous.questions.push(range.question);
            } else {
                merged.push({
                    start: range.start,
                    end: range.end,
                    questions: [range.question]
                });
            }
            return merged;
        }, []);

        var cursor = 0;
        ranges.forEach(function (range) {
            if (range.start < cursor) return;
            if (range.start > cursor) {
                container.appendChild(document.createTextNode(text.slice(cursor, range.start)));
            }
            var mark = document.createElement('mark');
            mark.className = 'transcript-answer';
            mark.dataset.question = range.questions.join(', Q');
            mark.title = 'Answer evidence for Question' +
                (range.questions.length > 1 ? 's ' : ' ') +
                range.questions.join(', ');
            mark.textContent = text.slice(range.start, range.end);
            container.appendChild(mark);
            cursor = range.end;
        });

        if (cursor < text.length) {
            container.appendChild(document.createTextNode(text.slice(cursor)));
        }
    }

    function getAudio() {
        return document.getElementById('testAudio');
    }

    function seekAndPlay(entry) {
        var audio = getAudio();
        if (!audio) return;
        var source = entrySource(entry);
        activeSource = source || activeSource;
        pendingSeek = Number(entry.time) || 0;

        function applySeek() {
            if (pendingSeek === null) return;
            var target = pendingSeek;
            pendingSeek = null;
            try {
                audio.currentTime = target;
            } catch (error) {
                pendingSeek = target;
                return;
            }
            var playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function () {});
            }
        }

        if (source && currentAudioSource(audio) !== sourceName(source)) {
            audio.pause();
            audio.src = source;
            audio.load();
        }

        if (audio.readyState >= 1) {
            applySeek();
        } else {
            audio.addEventListener('loadedmetadata', applySeek, { once: true });
        }
    }

    function setActiveCue(cue, shouldScroll) {
        if (activeCue === cue) return;
        if (activeCue) activeCue.classList.remove('is-active');
        activeCue = cue;
        if (!activeCue) return;
        activeCue.classList.add('is-active');
        if (shouldScroll && panel.classList.contains('is-open')) {
            activeCue.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function syncActiveCue() {
        var audio = getAudio();
        if (!audio || !cues.length) return;
        var currentTime = Number(audio.currentTime) || 0;
        var source = currentAudioSource(audio);
        var matchingCues = cues.filter(function (cue) {
            return !source || cue.dataset.source === source;
        });
        if (!matchingCues.length) return;
        var match = matchingCues[0];
        for (var index = 0; index < matchingCues.length; index += 1) {
            if (Number(matchingCues[index].dataset.time) <= currentTime) {
                match = matchingCues[index];
            } else {
                break;
            }
        }
        setActiveCue(match, !audio.paused);
    }

    function openPanel() {
        panel.classList.add('is-open');
        backdrop.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('transcript-open');
        syncActiveCue();
        window.setTimeout(function () {
            panel.querySelector('.transcript-close').focus();
        }, 0);
    }

    function closePanel(returnFocus) {
        panel.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('transcript-open');
        if (returnFocus) toggle.focus();
    }

    function buildTranscript() {
        var audioBar = document.querySelector('.audio-controller-bar');
        if (!audioBar || document.getElementById('listeningTranscriptPanel')) return;

        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'transcript-toggle';
        toggle.setAttribute('aria-controls', 'listeningTranscriptPanel');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML =
            '<i class="fas fa-align-left" aria-hidden="true"></i>' +
            '<span>Transcript</span>';
        audioBar.appendChild(toggle);

        backdrop = document.createElement('div');
        backdrop.className = 'transcript-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');

        panel = document.createElement('aside');
        panel.id = 'listeningTranscriptPanel';
        panel.className = 'transcript-panel';
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('aria-label', 'Listening transcript');
        panel.innerHTML =
            '<div class="transcript-panel-header">' +
                '<h2 class="transcript-panel-title">Transcript</h2>' +
                '<button type="button" class="transcript-close" ' +
                    'aria-label="Close transcript">&times;</button>' +
            '</div>' +
            '<div class="transcript-content"></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        content = panel.querySelector('.transcript-content');

        var answerKey = document.createElement('div');
        answerKey.className = 'transcript-answer-key';
        answerKey.innerHTML =
            '<span class="transcript-answer-key-swatch" aria-hidden="true"></span>' +
            '<span>Correct answer or answer evidence</span>';
        content.appendChild(answerKey);

        data.transcript.forEach(function (entry) {
            if (entry.part) {
                var heading = document.createElement('h3');
                heading.className = 'transcript-part-title';
                heading.textContent = entry.part;
                content.appendChild(heading);
                return;
            }

            var source = entrySource(entry);
            var cue = document.createElement('button');
            cue.type = 'button';
            cue.className = 'transcript-cue';
            cue.dataset.time = String(Number(entry.time) || 0);
            cue.dataset.source = sourceName(source);
            cue.setAttribute(
                'aria-label',
                'Play from ' + formatTime(entry.time) + '. ' + entry.text
            );
            cue.innerHTML =
                '<span class="transcript-time">' + formatTime(entry.time) + '</span>' +
                '<span class="transcript-cue-text"></span>';
            appendAnswerHighlights(
                cue.querySelector('.transcript-cue-text'),
                String(entry.text || '')
            );
            cue.addEventListener('click', function () {
                setActiveCue(cue, false);
                seekAndPlay(entry);
            });
            cues.push(cue);
            content.appendChild(cue);
        });

        toggle.addEventListener('click', openPanel);
        backdrop.addEventListener('click', function () { closePanel(true); });
        panel.querySelector('.transcript-close').addEventListener('click', function () {
            closePanel(true);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && panel.classList.contains('is-open')) {
                closePanel(true);
            }
        });

        var audio = getAudio();
        if (audio) {
            audio.addEventListener('timeupdate', syncActiveCue);
            audio.addEventListener('seeked', syncActiveCue);
            audio.addEventListener('loadedmetadata', syncActiveCue);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildTranscript);
    } else {
        buildTranscript();
    }
})();
