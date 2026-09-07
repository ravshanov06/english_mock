(function () {
  var DEFAULT_PARTS = [
    { id: 1, title: 'Passage 1', qStart: 1, qEnd: 13, passagePanel: 'p1_passagePanel', questionsPanel: 'p1_questionsPanel' },
    { id: 2, title: 'Passage 2', qStart: 14, qEnd: 26, passagePanel: 'p2_passagePanel', questionsPanel: 'p2_questionsPanel' },
    { id: 3, title: 'Passage 3', qStart: 27, qEnd: 40, passagePanel: 'p3_passagePanel', questionsPanel: 'p3_questionsPanel' }
  ];

  function init(config) {
    config = config || {};

    var PARTS = config.parts || DEFAULT_PARTS;
    var correctAnswers = config.correctAnswers || {};
    var TEST_STORAGE_ID = String(config.testStorageId || config.testId || 'reading_test');
    var TEST_LABEL = String(config.label || TEST_STORAGE_ID);
    var LEGACY_ANSWER_STORAGE_PREFIX = 'ielts_saved_answers_';
    var SEARCH_PARAMS = new URLSearchParams(window.location.search);
    var ATTEMPT_QUERY_ID = SEARCH_PARAMS.get('attempt') || '';
    var REDO_QUERY = SEARCH_PARAMS.get('redo') === '1';
    var groupedAnswers = Array.isArray(config.groupedAnswers) ? config.groupedAnswers : [];

    var currentPart = 1;
    var currentQuestion = 1;
    var seconds = Number(config.seconds || 60 * 60);
    var timerInterval = null;
    var isSubmitted = false;
    var freshStartRequested = false;
    var selectedContrast = 'normal';
    var selectedTextSize = 'medium';
    var currentView = 'home';

    function el(id) {
      return document.getElementById(id);
    }

    function norm(value) {
      return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function getTextInputByName(name) {
      var input = document.querySelector('input[name="' + name + '"]');
      return input && input.type === 'text' ? input : null;
    }

    function normalizeRecentRadioTables() {
      var testNumberMatch = TEST_STORAGE_ID.match(/(?:^|_)(\d+)$/);
      var testNumber = testNumberMatch ? Number(testNumberMatch[1]) : 0;
      if (testNumber < 101 || testNumber > 117) return;

      document.body.classList.add('recent-reading-radio-format');
      var testShell = el('testContainer');
      var progressBar = document.querySelector('.progress-container');
      if (testShell && progressBar) testShell.appendChild(progressBar);
      if (!el('recent-reading-radio-format-styles')) {
        var style = document.createElement('style');
        style.id = 'recent-reading-radio-format-styles';
        style.textContent = [
          '.recent-reading-radio-format .question-group{margin-bottom:34px}',
          '.recent-reading-radio-format #testContainer{display:flex;flex-direction:column;height:100vh;max-height:100vh;overflow:hidden}',
          '.recent-reading-radio-format #testContainer.hidden{display:none!important}',
          '.recent-reading-radio-format #testContainer>header{flex:0 0 auto}',
          '.recent-reading-radio-format #testContainer>.main-content{display:flex;flex:1 1 0;min-height:0;height:auto;overflow:hidden}',
          '.recent-reading-radio-format #testContainer>.progress-container{display:block;position:relative;inset:auto;flex:0 0 auto;width:100%;visibility:visible;z-index:1000;background:#fff}',
          '.recent-reading-radio-format #testContainer>.main-content>.passage-container,.recent-reading-radio-format #testContainer>.main-content>.questions-container{min-height:0;overflow-y:auto}',
          '.recent-reading-radio-format .question-group-title{font-size:1.05rem;font-weight:700;margin:0 0 12px}',
          '.recent-reading-radio-format .question-group>p{margin:8px 0;line-height:1.5}',
          '.recent-reading-radio-format .instruction-block{margin:10px 0 18px;line-height:1.5}',
          '.recent-reading-radio-format .instruction-block p{margin:6px 0}',
          '.recent-reading-radio-format .instruction-choices{display:grid;grid-template-columns:max-content 1fr;gap:5px 12px;margin-top:10px}',
          '.recent-reading-radio-format .instruction-choices strong{white-space:nowrap}',
          '.recent-reading-radio-format .question,.recent-reading-radio-format .tf-question,.recent-reading-radio-format .mcq-question{display:block;margin:20px 0 30px;padding:0;border:0;background:transparent;box-shadow:none}',
          '.recent-reading-radio-format .question-text,.recent-reading-radio-format .tf-question>p:first-child,.recent-reading-radio-format .mcq-question>p:first-child{display:block;margin:0 0 12px;font-weight:500;line-height:1.5}',
          '.recent-reading-radio-format .options,.recent-reading-radio-format .tf-options,.recent-reading-radio-format .reason-options{display:flex!important;flex-direction:column!important;align-items:stretch;gap:10px!important;padding-left:8px}',
          '.recent-reading-radio-format .options label,.recent-reading-radio-format .tf-options label,.recent-reading-radio-format .reason-options label{display:flex!important;align-items:flex-start;gap:8px;width:100%;line-height:1.45;cursor:pointer}',
          '.recent-reading-radio-format .options label input,.recent-reading-radio-format .tf-options label input,.recent-reading-radio-format .reason-options label input{flex:0 0 auto;margin:4px 0 0}',
          '.recent-reading-radio-format .notes-bullets li{margin:10px 0;line-height:1.55}',
          '.recent-reading-radio-format .matching-key{margin:16px 0 20px}',
          '.recent-reading-radio-format .matching-key-title{font-size:1.05rem;font-weight:700;margin-bottom:12px}',
          '.recent-reading-radio-format .matching-key-list{display:flex;flex-direction:column;gap:12px;line-height:1.45}',
          '.recent-reading-radio-format .drag-options{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 20px}',
          '.recent-reading-radio-format .drag-item{width:auto;max-width:100%;cursor:grab}',
          '.recent-reading-radio-format .drop-zone{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin:4px 6px}',
          '.recent-reading-radio-format table.radio-matrix{width:100%;border-collapse:collapse;table-layout:fixed;margin:16px 0 24px}',
          '.recent-reading-radio-format table.radio-matrix th,.recent-reading-radio-format table.radio-matrix td{border:1px solid #cbd5e0;background:#fff;color:#111827;padding:10px;vertical-align:middle}',
          '.recent-reading-radio-format table.radio-matrix th:first-child,.recent-reading-radio-format table.radio-matrix td:first-child{width:58%;text-align:left;line-height:1.45}',
          '.recent-reading-radio-format table.radio-matrix th:not(:first-child),.recent-reading-radio-format table.radio-matrix td:not(:first-child){width:auto;text-align:center;padding:10px 4px}',
          '.recent-reading-radio-format table.radio-matrix td:not(:first-child) input[type=radio]{display:block;margin:0 auto}',
          '@media(max-width:700px){.recent-reading-radio-format table.radio-matrix{font-size:.86rem}.recent-reading-radio-format table.radio-matrix th:first-child,.recent-reading-radio-format table.radio-matrix td:first-child{width:55%;padding:8px}.recent-reading-radio-format table.radio-matrix th:not(:first-child),.recent-reading-radio-format table.radio-matrix td:not(:first-child){padding:8px 2px}}'
        ].join('');
        document.head.appendChild(style);
      }

      document.querySelectorAll('table').forEach(function (table) {
        if (!table.querySelector('input[type="radio"]')) return;
        var initialRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
        var initialHeaders = initialRows.length ? Array.prototype.slice.call(initialRows[0].querySelectorAll('th,td')).map(function (cell) {
          return cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase();
        }) : [];
        var truthHeaders = initialHeaders.slice(1);
        var isTruthMatrix = truthHeaders.join('|') === 'TRUE|FALSE|NOT GIVEN' || truthHeaders.join('|') === 'YES|NO|NOT GIVEN';
        if (isTruthMatrix) {
          var standaloneQuestions = document.createDocumentFragment();
          initialRows.slice(1).forEach(function (row) {
            var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
            if (!cells.length) return;
            var firstRadio = row.querySelector('input[type="radio"]');
            if (!firstRadio) return;
            var question = document.createElement('div');
            question.className = 'question';
            question.dataset.question = String(firstRadio.name || '').replace(/^q/, '');
            var questionText = document.createElement('div');
            questionText.className = 'question-text';
            while (cells[0].firstChild) questionText.appendChild(cells[0].firstChild);
            var options = document.createElement('div');
            options.className = 'options';
            cells.slice(1).forEach(function (cell, index) {
              var radio = cell.querySelector('input[type="radio"]');
              if (!radio) return;
              var label = document.createElement('label');
              label.append(radio, document.createTextNode(' ' + truthHeaders[index]));
              options.appendChild(label);
            });
            question.append(questionText, options);
            standaloneQuestions.appendChild(question);
          });
          table.replaceWith(standaloneQuestions);
          return;
        }
        table.classList.add('radio-matrix');
        var tableGroup = table.closest('.question-group');
        var precedingParagraphs = tableGroup ? Array.prototype.slice.call(tableGroup.querySelectorAll(':scope > p')).filter(function (paragraph) {
          return Boolean(paragraph.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING);
        }) : [];
        var instruction = precedingParagraphs.slice().reverse().find(function (paragraph) {
          return /match each|classify/i.test(paragraph.textContent);
        });
        var optionSource = precedingParagraphs.slice().reverse().find(function (paragraph) {
          return paragraph.querySelectorAll('strong').length >= 2;
        }) || instruction;
        if (instruction && optionSource) {
          var originalInstruction = instruction.textContent.trim();
          var optionStrongElements = Array.prototype.slice.call(optionSource.querySelectorAll('strong'));
          var namedOptions = optionStrongElements.map(function (strong) {
            var match = strong.textContent.trim().match(/^([A-I])\s+(.+)$/);
            return match ? { letter: match[1], name: match[2] } : null;
          }).filter(Boolean);
          if (namedOptions.length < 2) {
            namedOptions = optionStrongElements.map(function (strong) {
              var letterMatch = strong.textContent.trim().match(/^([A-I])$/);
              if (!letterMatch) return null;
              var name = strong.nextSibling && strong.nextSibling.nodeType === 3 ? strong.nextSibling.textContent : '';
              name = name.replace(/\u00a0/g, ' ').trim().replace(/[;,]$/, '').trim();
              return name ? { letter: letterMatch[1], name: name } : null;
            }).filter(Boolean);
          }
          if (namedOptions.length >= 2 && !instruction.parentElement.querySelector('.matching-key')) {
            var key = document.createElement('div');
            key.className = 'matching-key';
            var keyTitle = document.createElement('div');
            keyTitle.className = 'matching-key-title';
            var isClassification = /classify/i.test(originalInstruction);
            keyTitle.textContent = isClassification ? 'List of Projects' : 'List of Researchers';
            var keyList = document.createElement('div');
            keyList.className = 'matching-key-list';
            namedOptions.forEach(function (option) {
              var row = document.createElement('div');
              row.textContent = option.letter + '. ' + option.name;
              keyList.appendChild(row);
            });
            key.append(keyTitle, keyList);
            if (isClassification) {
              instruction.textContent = 'Classify each statement using the list below.';
            } else {
              var instructionLead = originalInstruction.split(/\bwith\b/i)[0].trim();
              instruction.textContent = instructionLead + ' with the correct researcher from the list below.';
            }
            instruction.insertAdjacentElement('afterend', key);
            if (optionSource !== instruction) optionSource.remove();
          }
        }
        var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
        if (!rows.length) return;
        var headers = Array.prototype.slice.call(rows[0].querySelectorAll('th,td'));
        if (headers[0] && !headers[0].textContent.trim()) headers[0].textContent = 'Statement';
        rows.slice(1).forEach(function (row) {
          Array.prototype.slice.call(row.querySelectorAll('td')).slice(1).forEach(function (cell, index) {
            var radio = cell.querySelector('input[type="radio"]');
            if (!radio) return;
            var headerText = headers[index + 1] ? headers[index + 1].textContent.trim() : radio.value;
            if (!radio.getAttribute('aria-label')) radio.setAttribute('aria-label', headerText || radio.value);
            cell.replaceChildren(radio);
          });
        });
      });

      document.querySelectorAll('.tf-question, .mcq-question').forEach(function (question) {
        question.classList.add('question');
        var prompt = question.querySelector(':scope > p:first-child');
        if (prompt) prompt.classList.add('question-text');
        var directLabels = Array.prototype.slice.call(question.querySelectorAll(':scope > label'));
        if (directLabels.length) {
          var directOptions = document.createElement('div');
          directOptions.className = 'options';
          directLabels.forEach(function (label) { directOptions.appendChild(label); });
          question.appendChild(directOptions);
        }
      });
      document.querySelectorAll('.tf-options, .reason-options').forEach(function (options) {
        options.classList.add('options');
      });
      document.querySelectorAll('.notes-picture input[type="text"].input-field').forEach(function (input) {
        input.classList.add('inline-input');
      });
      document.querySelectorAll('.question-group').forEach(function (group) {
        var radios = Array.prototype.slice.call(group.querySelectorAll('input[type="radio"]'));
        if (!radios.length) return;
        var values = radios.map(function (radio) { return String(radio.value || '').toUpperCase(); });
        var hasTrueSet = ['TRUE', 'FALSE', 'NOT GIVEN'].every(function (value) { return values.indexOf(value) !== -1; });
        var hasYesSet = ['YES', 'NO', 'NOT GIVEN'].every(function (value) { return values.indexOf(value) !== -1; });
        if (!hasTrueSet && !hasYesSet) return;
        var instruction = Array.prototype.slice.call(group.querySelectorAll(':scope > p')).find(function (paragraph) {
          return /TRUE|YES/.test(paragraph.textContent) && /NOT GIVEN/.test(paragraph.textContent);
        });
        if (!instruction) return;
        var block = document.createElement('div');
        block.className = 'instruction-block';
        if (hasTrueSet) {
          block.innerHTML = '<p>Do the following statements agree with the information given in the reading passage?</p><p>Choose:</p><div class="instruction-choices"><strong>TRUE</strong><span>if the statement agrees with the information</span><strong>FALSE</strong><span>if the statement contradicts the information</span><strong>NOT GIVEN</strong><span>if there is no information on this</span></div>';
        } else {
          block.innerHTML = '<p>Do the following statements agree with the claims of the writer?</p><p>Choose:</p><div class="instruction-choices"><strong>YES</strong><span>if the statement agrees with the writer’s claims</span><strong>NO</strong><span>if the statement contradicts the writer’s claims</span><strong>NOT GIVEN</strong><span>if it is impossible to say what the writer thinks about this</span></div>';
        }
        instruction.replaceWith(block);
      });
      document.querySelectorAll('.drag-options, .drag-list').forEach(function (bank) {
        var seenOptions = {};
        Array.prototype.slice.call(bank.querySelectorAll(':scope > .drag-item')).forEach(function (item) {
          var optionKey = (item.dataset.group || 'default') + '|' + (item.dataset.option || item.dataset.answer || item.textContent.trim());
          if (seenOptions[optionKey]) {
            item.remove();
            return;
          }
          seenOptions[optionKey] = true;
          item.draggable = true;
        });
      });
    }

    function displayCorrect(correct) {
      if (correct && correct.type === 'partial') return correct.options.join(', ');
      if (Array.isArray(correct)) return correct.join(', ');
      return String(correct == null ? '' : correct).replace(/\s*\/\s*/g, ', ');
    }

    function questionPoints(correct) {
      if (!correct) return 0;
      if (correct && correct.type === 'partial') return correct.options.length;
      if (Array.isArray(correct)) return correct.length;
      return 1;
    }

    function parseGroupedQuestionNumbers(name) {
      var match = String(name || '').match(/^q(\d+(?:_\d+)+)$/);
      if (!match) return [];
      return match[1].split('_').map(function (item) {
        return parseInt(item, 10);
      }).filter(Boolean);
    }

    function getCheckboxesByName(name) {
      return Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"]')).filter(function (checkbox) {
        return checkbox.name === name;
      });
    }

    function getGroupedCheckboxContext(questionNumber) {
      var qNumber = parseInt(questionNumber, 10);
      if (!qNumber) return null;

      var inputs = document.querySelectorAll('input[type="checkbox"][name^="q"]');
      for (var index = 0; index < inputs.length; index += 1) {
        var numbers = parseGroupedQuestionNumbers(inputs[index].name);
        if (numbers.indexOf(qNumber) === -1) continue;
        return {
          name: inputs[index].name,
          numbers: numbers,
          checkboxes: getCheckboxesByName(inputs[index].name)
        };
      }

      return null;
    }

    function getGroupedSelectedValues(context) {
      if (!context || !context.checkboxes.length) return [];
      return context.checkboxes.filter(function (checkbox) {
        return checkbox.checked;
      }).map(function (checkbox) {
        return checkbox.value;
      }).sort();
    }

    function getGroupedAnswerForQuestion(questionNumber) {
      var qNumber = parseInt(questionNumber, 10);
      var context = getGroupedCheckboxContext(qNumber);
      if (!context) return '';
      var selected = getGroupedSelectedValues(context);
      var position = context.numbers.indexOf(qNumber);
      return selected[position] || '';
    }

    function setProgressAnswered(questionNumber, answered) {
      var chip = document.querySelector('.progress-item[data-question="' + questionNumber + '"]');
      if (!chip) return;
      chip.classList.toggle('answered', Boolean(answered));
    }

    function collectCurrentAnswers() {
      var saved = {};
      var maxQ = PARTS[PARTS.length - 1].qEnd;

      for (var q = 1; q <= maxQ; q += 1) {
        var key = 'q' + q;
        var radios = document.querySelectorAll('input[name="' + key + '"][type="radio"]');
        var text = getTextInputByName(key);
        var sel = document.querySelector('select[name="' + key + '"]');
        var cbs = document.querySelectorAll('input[name="' + key + '"][type="checkbox"]');
        var zone = document.querySelector('.drop-zone[data-target="' + key + '"]');
        var groupedValue = getGroupedAnswerForQuestion(q);

        if (radios.length) {
          var checked = Array.prototype.slice.call(radios).find(function (radio) { return radio.checked; });
          if (checked) saved[key] = checked.value;
        } else if (cbs.length) {
          var values = Array.prototype.slice.call(cbs)
            .filter(function (cb) { return cb.checked; })
            .map(function (cb) { return cb.value; })
            .sort();
          if (values.length) saved[key] = values.join(',');
        } else if (groupedValue) {
          saved[key] = groupedValue;
        } else if (text && text.value.trim()) {
          saved[key] = text.value.trim();
        } else if (sel && sel.value) {
          saved[key] = sel.value;
        } else if (zone && zone.dataset.value) {
          saved[key] = zone.dataset.value;
        }
      }

      return saved;
    }

    function getLegacySavedAnswersKey() {
      var email = window.IELTSProgress && typeof window.IELTSProgress.getEmail === 'function'
        ? window.IELTSProgress.getEmail()
        : '';
      return LEGACY_ANSWER_STORAGE_PREFIX + (email || 'guest') + '_' + TEST_STORAGE_ID;
    }

    function persistCurrentAnswers() {
      if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
        window.IELTSProgress.saveDraft(TEST_STORAGE_ID, collectCurrentAnswers());
        return;
      }

      try {
        localStorage.setItem(getLegacySavedAnswersKey(), JSON.stringify(collectCurrentAnswers()));
      } catch (error) {}
    }

    function updateDropText(zone, text) {
      var valueSpan = zone.querySelector('.drop-value');
      if (valueSpan) valueSpan.textContent = text;
      else zone.textContent = text;
    }

    function clearZone(zone) {
      if (!zone) return;
      var placeholder = zone.dataset.placeholder || '';
      zone.dataset.optionKey = '';
      zone.dataset.option = '';
      zone.dataset.value = '';
      updateDropText(zone, placeholder);
      zone.classList.remove('filled');
      zone.draggable = false;
    }

    function setZoneValue(zone, optionKey, answer, label) {
      if (!zone) return;
      var display = label ? answer + ' ' + label : answer;
      zone.dataset.optionKey = optionKey || answer;
      zone.dataset.option = optionKey || answer;
      zone.dataset.value = answer;
      updateDropText(zone, display);
      zone.classList.add('filled');
      zone.draggable = true;
    }

    function findDragItem(answerValue, group) {
      var answer = String(answerValue || '').toUpperCase();
      return Array.prototype.slice.call(document.querySelectorAll('.drag-item')).find(function (node) {
        var itemGroup = node.dataset.group || 'default';
        if (group && itemGroup !== group) return false;
        return String(node.dataset.answer || node.dataset.option || '').toUpperCase() === answer;
      });
    }

    function restoreReadingDropZone(questionName, answerValue) {
      var zones = document.querySelectorAll('.drop-zone[data-target="' + questionName + '"]');
      if (!zones.length || !answerValue) return;

      Array.prototype.forEach.call(zones, function (zone) {
        var group = zone.dataset.group || 'default';
        var item = findDragItem(answerValue, group);
        if (!item) return;
        setZoneValue(zone, item.dataset.option || answerValue, item.dataset.answer || answerValue, item.dataset.label || '');
        item.dataset.used = 'true';
        item.classList.add('used');
        item.draggable = false;
      });

      var input = document.querySelector('input[name="' + questionName + '"]');
      if (input) input.value = answerValue;
    }

    function restoreSavedAnswers() {
      if (freshStartRequested) return;
      var stored = {};

      if (window.IELTSProgress && typeof window.IELTSProgress.loadDraft === 'function') {
        if (ATTEMPT_QUERY_ID) stored = window.IELTSProgress.loadDraft(ATTEMPT_QUERY_ID) || {};
        if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
          stored = window.IELTSProgress.loadDraft(TEST_STORAGE_ID) || {};
        }
      }

      if (!REDO_QUERY && (!stored || !Object.keys(stored).length)) {
        try {
          stored = JSON.parse(localStorage.getItem(getLegacySavedAnswersKey()) || '{}') || {};
        } catch (error) {
          stored = {};
        }
        if (stored && Object.keys(stored).length && window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
          window.IELTSProgress.saveDraft(TEST_STORAGE_ID, stored);
        }
      }

      Object.keys(stored || {}).forEach(function (key) {
        var value = stored[key];
        if (value == null || value === '') return;
        var questionNumber = parseInt(String(key).replace('q', ''), 10);

        var zone = document.querySelector('.drop-zone[data-target="' + key + '"]');
        var text = getTextInputByName(key);
        var sel = document.querySelector('select[name="' + key + '"]');
        var radios = document.querySelectorAll('input[name="' + key + '"][type="radio"]');
        var cbs = document.querySelectorAll('input[name="' + key + '"][type="checkbox"]');
        var groupedContext = getGroupedCheckboxContext(questionNumber);

        if (zone) {
          restoreReadingDropZone(key, value);
          return;
        }

        if (radios.length) {
          Array.prototype.forEach.call(radios, function (radio) {
            radio.checked = String(radio.value).toUpperCase() === String(value).toUpperCase();
          });
          return;
        }

        if (cbs.length) {
          var selected = String(value).split(',').map(function (item) { return item.trim().toUpperCase(); });
          Array.prototype.forEach.call(cbs, function (cb) {
            cb.checked = selected.indexOf(String(cb.value || '').toUpperCase()) !== -1;
          });
          return;
        }

        if (groupedContext) {
          var groupedSelected = String(value).split(',').map(function (item) { return item.trim().toUpperCase(); });
          Array.prototype.forEach.call(groupedContext.checkboxes, function (cb) {
            if (groupedSelected.indexOf(String(cb.value || '').toUpperCase()) !== -1) cb.checked = true;
          });
          return;
        }

        if (text) {
          text.value = value;
          return;
        }

        if (sel) sel.value = value;
      });

      Object.keys(stored || {}).forEach(function (key) {
        var q = parseInt(String(key).replace('q', ''), 10);
        var groupedContext = getGroupedCheckboxContext(q);
        if (groupedContext) {
          var selectedValues = getGroupedSelectedValues(groupedContext);
          groupedContext.numbers.forEach(function (questionNumber, index) {
            setProgressAnswered(questionNumber, selectedValues[index] || stored['q' + questionNumber]);
          });
        } else {
          setProgressAnswered(q, stored[key]);
        }
      });
    }

    function renderBottomTabs() {
      var tabs = el('bottomPartTabs');
      if (!tabs) return;
      tabs.innerHTML = '';
      tabs.className = 'reading-progress-parts';
      var currentAnswers = collectCurrentAnswers();

      PARTS.forEach(function (part) {
        var partWrap = document.createElement('div');
        var isActive = part.id === currentPart;
        var total = part.qEnd - part.qStart + 1;
        var answered = 0;
        for (var countQ = part.qStart; countQ <= part.qEnd; countQ += 1) {
          if (currentAnswers['q' + countQ]) answered += 1;
        }
        partWrap.className = 'reading-progress-part' + (isActive ? ' active' : '');
        partWrap.onclick = function (event) {
          if (event.target && event.target.classList && event.target.classList.contains('progress-item')) return;
          switchPart(part.id);
        };

        var labelProgress = document.createElement('div');
        labelProgress.className = 'part-label-progress' + (answered === total ? ' is-complete' : '');
        labelProgress.setAttribute('aria-hidden', 'true');
        labelProgress.hidden = !isActive;
        partWrap.appendChild(labelProgress);

        var miniProgress = document.createElement('div');
        miniProgress.className = 'part-mini-progress';
        miniProgress.setAttribute('aria-hidden', 'true');
        miniProgress.style.gridTemplateColumns = 'repeat(' + total + ', 1fr)';
        miniProgress.hidden = !isActive;
        for (var miniQ = part.qStart; miniQ <= part.qEnd; miniQ += 1) {
          var segment = document.createElement('span');
          segment.className = (currentAnswers['q' + miniQ] ? 'is-answered ' : '') +
            (miniQ === currentQuestion && isActive ? 'is-current' : '');
          miniProgress.appendChild(segment);
        }
        partWrap.appendChild(miniProgress);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'part-button' + (isActive ? ' active' : '') + (answered === total ? ' part-complete' : '');
        btn.textContent = part.title;
        btn.onclick = function () { switchPart(part.id); };
        partWrap.appendChild(btn);

        var rail = document.createElement('div');
        rail.id = 'rail-part-' + part.id;
        rail.className = 'reading-progress-rail';
        rail.style.display = isActive ? 'flex' : 'none';

        for (var q = part.qStart; q <= part.qEnd; q += 1) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.textContent = q;
          chip.className = 'progress-item' +
            (q === currentQuestion && isActive ? ' current' : '') +
            (currentAnswers['q' + q] ? ' answered' : '');
          chip.dataset.question = q;
          chip.onclick = function (questionNumber) {
            return function () { scrollToQuestion(questionNumber); };
          }(q);
          rail.appendChild(chip);
        }

        if (isActive) {
          partWrap.appendChild(rail);
        } else {
          var count = document.createElement('button');
          count.type = 'button';
          count.className = 'part-progress-count';
          count.textContent = answered + ' of ' + total;
          count.onclick = function () { switchPart(part.id); };
          partWrap.appendChild(count);
          partWrap.appendChild(rail);
        }

        tabs.appendChild(partWrap);
      });
    }

    function refreshBottomBar() {
      renderBottomTabs();
    }

    function switchPart(partId) {
      if (currentPart === partId) return;

      PARTS.forEach(function (part) {
        var passage = el(part.passagePanel);
        var questions = el(part.questionsPanel);
        var rail = el('rail-part-' + part.id);
        if (passage) passage.classList.add('hidden');
        if (questions) questions.classList.add('hidden');
        if (rail) rail.style.display = 'none';
      });

      currentPart = partId;
      var part = PARTS[currentPart - 1];
      currentQuestion = part.qStart;

      var passagePanel = el(part.passagePanel);
      var questionsPanel = el(part.questionsPanel);
      var activeRail = el('rail-part-' + part.id);
      if (passagePanel) passagePanel.classList.remove('hidden');
      if (questionsPanel) questionsPanel.classList.remove('hidden');
      if (activeRail) activeRail.style.display = 'flex';
      if (el('headerPassageTitle')) el('headerPassageTitle').textContent = 'Passage ' + currentPart + ' of 3';
      scrollToQuestion(currentQuestion, false);
      refreshBottomBar();
    }

    function scrollToQuestion(num, smooth) {
      if (smooth === undefined) smooth = true;
      var target = document.querySelector('[data-question-anchor="' + num + '"]') ||
        document.querySelector('[data-question="' + num + '"]') ||
        document.querySelector('input[name="q' + num + '"]') ||
        document.querySelector('select[name="q' + num + '"]');
      if (!target) {
        var groupedContext = getGroupedCheckboxContext(num);
        if (groupedContext && groupedContext.checkboxes.length) target = groupedContext.checkboxes[0].closest('.question') || groupedContext.checkboxes[0];
      }
      if (target) target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      updateCurrentQuestion(num);
    }

    function updateCurrentQuestion(num) {
      currentQuestion = num;
      document.querySelectorAll('#rail-part-' + currentPart + ' .progress-item').forEach(function (item) {
        item.classList.toggle('current', parseInt(item.dataset.question, 10) === num);
      });
    }

    function attachAnsweredListeners() {
      document.querySelectorAll('input[type="radio"], input[type="text"], input:not([type]), select, input[type="checkbox"]').forEach(function (input) {
        input.addEventListener('change', function () {
          var match = input.name && input.name.match(/^q(\d+)$/);
          var groupedQuestions = parseGroupedQuestionNumbers(input.name);
          if (!match && !groupedQuestions.length) return;

          if (groupedQuestions.length) {
            var groupedContext = getGroupedCheckboxContext(groupedQuestions[0]);
            var selectedValues = getGroupedSelectedValues(groupedContext);
            groupedQuestions.forEach(function (questionNumber, index) {
              setProgressAnswered(questionNumber, selectedValues[index]);
            });
            persistCurrentAnswers();
            return;
          }

          var q = parseInt(match[1], 10);
          if (document.querySelector('.progress-item[data-question="' + q + '"]')) {
            var value = '';
            if (input.type === 'text') value = input.value.trim();
            else if (input.type === 'checkbox') {
              value = Array.prototype.slice.call(document.querySelectorAll('input[name="' + input.name + '"]:checked'))
                .map(function (cb) { return cb.value; })
                .join(',');
            } else value = input.value;
            setProgressAnswered(q, value);
          }
          persistCurrentAnswers();
        });
      });
    }

    function createAnchors() {
      var maxQ = PARTS[PARTS.length - 1].qEnd;
      for (var q = 1; q <= maxQ; q += 1) {
        if (document.querySelector('[data-question-anchor="' + q + '"]')) continue;
        var target = document.querySelector('[data-question="' + q + '"]') ||
          document.querySelector('input[name="q' + q + '"]') ||
          document.querySelector('select[name="q' + q + '"]') ||
          document.querySelector('.drop-zone[data-target="q' + q + '"]');
        if (!target) {
          var groupedContext = getGroupedCheckboxContext(q);
          if (groupedContext && groupedContext.checkboxes.length) target = groupedContext.checkboxes[0].closest('.question') || groupedContext.checkboxes[0];
        }
        if (target && target.parentNode) {
          var anchor = document.createElement('span');
          anchor.className = 'question-anchor';
          anchor.dataset.questionAnchor = q;
          target.parentNode.insertBefore(anchor, target);
        }
      }
    }

    function setupLimitedCheckboxes() {
      document.querySelectorAll('.multi-select-question').forEach(function (question) {
        var limit = parseInt(question.dataset.limit || config.multiSelectLimit || '2', 10);
        var checkboxes = question.querySelectorAll('.multi-checkbox');
        checkboxes.forEach(function (cb) {
          cb.addEventListener('change', function () {
            var selected = Array.prototype.slice.call(checkboxes).filter(function (item) { return item.checked; });
            if (selected.length > limit) cb.checked = false;
          });
        });
      });

      var groupedCheckboxes = {};
      document.querySelectorAll('input[type="checkbox"][name^="q"]').forEach(function (checkbox) {
        var numbers = parseGroupedQuestionNumbers(checkbox.name);
        if (numbers.length < 2) return;
        if (!groupedCheckboxes[checkbox.name]) {
          groupedCheckboxes[checkbox.name] = {
            limit: numbers.length,
            checkboxes: getCheckboxesByName(checkbox.name)
          };
        }
      });

      Object.keys(groupedCheckboxes).forEach(function (name) {
        var group = groupedCheckboxes[name];
        group.checkboxes.forEach(function (cb) {
          cb.addEventListener('change', function () {
            var selected = group.checkboxes.filter(function (item) { return item.checked; });
            if (selected.length > group.limit) cb.checked = false;
          });
        });
      });
    }

    function setupThreatSelection() {
      var checkboxes = document.querySelectorAll('.threat-checkbox');
      if (!checkboxes.length) return;
      var hidden25 = document.querySelector('input[name="q25"]');
      var hidden26 = document.querySelector('input[name="q26"]');

      function updateHidden() {
        var selected = Array.prototype.slice.call(checkboxes)
          .filter(function (checkbox) { return checkbox.checked; })
          .map(function (checkbox) { return checkbox.value; })
          .sort();
        if (hidden25) hidden25.value = selected[0] || '';
        if (hidden26) hidden26.value = selected[1] || '';
        [hidden25, hidden26].forEach(function (input) {
          if (input) input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
          var selected = Array.prototype.slice.call(checkboxes).filter(function (checkbox) { return checkbox.checked; });
          if (selected.length > 2) {
            cb.checked = false;
            return;
          }
          updateHidden();
        });
      });
    }

    function setupDragDrop() {
      var defaultGroup = 'default';
      var zones = document.querySelectorAll('.drop-zone');
      var items = document.querySelectorAll('.drag-item');
      var optionBins = document.querySelectorAll('.drag-options, .drag-list');

      function releaseOption(optionKey, group) {
        if (!optionKey) return;
        var item = document.querySelector('.drag-item[data-option="' + optionKey + '"][data-group="' + group + '"]') ||
          document.querySelector('.drag-item[data-option="' + optionKey + '"]');
        if (item) {
          item.dataset.used = 'false';
          item.classList.remove('used');
          item.draggable = true;
        }
      }

      items.forEach(function (item) {
        var group = item.dataset.group || defaultGroup;
        item.dataset.group = group;
        item.dataset.used = 'false';
        item.draggable = true;
        item.addEventListener('dragstart', function (event) {
          if (item.dataset.used === 'true') {
            event.preventDefault();
            return;
          }
          var answer = item.dataset.answer || item.dataset.option;
          event.dataTransfer.setData('text/plain', item.dataset.option);
          event.dataTransfer.setData('text/label', item.dataset.label || '');
          event.dataTransfer.setData('text/answer', answer);
          event.dataTransfer.setData('text/group', group);
          event.dataTransfer.effectAllowed = 'move';
        });
      });

      zones.forEach(function (zone) {
        zone.dataset.group = zone.dataset.group || defaultGroup;
        clearZone(zone);

        zone.addEventListener('dragover', function (event) {
          event.preventDefault();
          zone.classList.add('over');
        });

        zone.addEventListener('dragleave', function () {
          zone.classList.remove('over');
        });

        zone.addEventListener('drop', function (event) {
          event.preventDefault();
          zone.classList.remove('over');
          var optionKey = event.dataTransfer.getData('text/plain');
          var label = event.dataTransfer.getData('text/label');
          var answer = event.dataTransfer.getData('text/answer') || optionKey;
          var draggedGroup = event.dataTransfer.getData('text/group') || defaultGroup;
          var zoneGroup = zone.dataset.group || defaultGroup;
          if (!optionKey || draggedGroup !== zoneGroup) return;

          var item = document.querySelector('.drag-item[data-option="' + optionKey + '"][data-group="' + zoneGroup + '"]') ||
            document.querySelector('.drag-item[data-option="' + optionKey + '"]');
          if (!item || item.dataset.used === 'true') return;

          if (zone.dataset.optionKey && zone.dataset.optionKey !== optionKey) releaseOption(zone.dataset.optionKey, zoneGroup);

          setZoneValue(zone, optionKey, answer, label);
          item.dataset.used = 'true';
          item.classList.add('used');
          item.draggable = false;

          var targetName = zone.dataset.target;
          var input = document.querySelector('input[name="' + targetName + '"]');
          if (input) {
            input.value = answer;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }

          document.querySelectorAll('.drop-zone[data-target="' + targetName + '"][data-group="' + zoneGroup + '"]').forEach(function (sibling) {
            if (sibling !== zone) setZoneValue(sibling, optionKey, answer, label);
          });
        });

        zone.addEventListener('dragstart', function (event) {
          if (!zone.dataset.optionKey) {
            event.preventDefault();
            return;
          }
          var item = document.querySelector('.drag-item[data-option="' + zone.dataset.optionKey + '"][data-group="' + zone.dataset.group + '"]') ||
            document.querySelector('.drag-item[data-option="' + zone.dataset.optionKey + '"]');
          event.dataTransfer.setData('text/plain', zone.dataset.optionKey);
          event.dataTransfer.setData('text/label', item ? item.dataset.label || '' : '');
          event.dataTransfer.setData('text/answer', item ? item.dataset.answer || item.dataset.option : zone.dataset.value);
          event.dataTransfer.setData('text/group', zone.dataset.group || defaultGroup);
          event.dataTransfer.setData('text/source-zone', zone.dataset.target || '');
          event.dataTransfer.effectAllowed = 'move';
        });

        function returnZoneOption() {
          var optionKey = zone.dataset.optionKey || zone.dataset.option;
          if (!optionKey) return;
          releaseOption(optionKey, zone.dataset.group || defaultGroup);
          var targetName = zone.dataset.target;
          document.querySelectorAll('.drop-zone[data-target="' + targetName + '"][data-group="' + zone.dataset.group + '"]').forEach(clearZone);
          var input = document.querySelector('input[name="' + targetName + '"]');
          if (input) {
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        zone.addEventListener('click', returnZoneOption);

        zone.addEventListener('dblclick', function () {
          returnZoneOption();
        });
      });

      optionBins.forEach(function (bin) {
        bin.dataset.group = bin.dataset.group || defaultGroup;
        bin.addEventListener('dragover', function (event) { event.preventDefault(); });
        bin.addEventListener('drop', function (event) {
          event.preventDefault();
          var optionKey = event.dataTransfer.getData('text/plain');
          var source = event.dataTransfer.getData('text/source-zone');
          var group = event.dataTransfer.getData('text/group') || bin.dataset.group || defaultGroup;
          if (!optionKey || !source) return;
          var zone = document.querySelector('.drop-zone[data-target="' + source + '"][data-group="' + group + '"]') ||
            document.querySelector('.drop-zone[data-target="' + source + '"]');
          if (zone && zone.dataset.optionKey === optionKey) {
            document.querySelectorAll('.drop-zone[data-target="' + source + '"][data-group="' + (zone.dataset.group || defaultGroup) + '"]').forEach(clearZone);
            releaseOption(optionKey, zone.dataset.group || defaultGroup);
            var input = document.querySelector('input[name="' + source + '"]');
            if (input) {
              input.value = '';
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      });
    }

    function getQuestionUserValue(key) {
      var questionNumber = parseInt(String(key).replace('q', ''), 10);
      var radios = document.querySelectorAll('input[name="' + key + '"][type="radio"]');
      var text = getTextInputByName(key);
      var sel = document.querySelector('select[name="' + key + '"]');
      var cbs = document.querySelectorAll('input[name="' + key + '"][type="checkbox"]');
      var zones = document.querySelectorAll('.drop-zone[data-target="' + key + '"]');
      var groupedContext = getGroupedCheckboxContext(questionNumber);
      var user = null;

      if (radios.length) {
        var checked = Array.prototype.slice.call(radios).find(function (radio) { return radio.checked; });
        if (checked) user = checked.value;
        radios.forEach(function (radio) { radio.disabled = true; });
      } else if (cbs.length) {
        user = Array.prototype.slice.call(cbs)
          .filter(function (cb) { return cb.checked; })
          .map(function (cb) { return cb.value; })
          .sort()
          .join(',');
        cbs.forEach(function (cb) { cb.disabled = true; });
      } else if (groupedContext) {
        var correctForKey = correctAnswers[key];
        if (correctForKey && correctForKey.type === 'partial') {
          // For partial scoring inside a grouped checkbox (e.g. name="q23_24"),
          // every checked value contributes a point — pass them all, not just the
          // slot-positional pick.
          user = getGroupedSelectedValues(groupedContext).join(',');
        } else {
          user = getGroupedAnswerForQuestion(questionNumber);
        }
        groupedContext.checkboxes.forEach(function (cb) { cb.disabled = true; });
      } else if (text) {
        user = (text.value || '').trim();
        text.disabled = true;
      } else if (sel) {
        user = sel.value;
        sel.disabled = true;
      }

      if (!user && zones.length) {
        var filled = Array.prototype.slice.call(zones).find(function (zone) { return zone.dataset.value; });
        if (filled) user = (filled.dataset.value || '').trim();
      }

      return user || '';
    }

    function scoreAnswer(key, correct, user) {
      if (!correct) {
        return { pointsEarned: 0, pointsTotal: 0, isCorrect: false };
      }

      var pointsTotal = questionPoints(correct);
      var pointsEarned = 0;

      if (correct && correct.type === 'partial') {
        var selectedPartial = String(user || '').split(',').map(function (item) { return item.trim().toUpperCase(); }).filter(Boolean);
        var partialSet = new Set(correct.options.map(function (item) { return String(item).toUpperCase(); }));
        pointsEarned = selectedPartial.reduce(function (sum, item) { return sum + (partialSet.has(item) ? 1 : 0); }, 0);
      } else if (Array.isArray(correct)) {
        var selectedArray = String(user || '').split(',').map(function (item) { return item.trim().toUpperCase(); }).filter(Boolean);
        var arraySet = new Set(correct.map(function (item) { return String(item).toUpperCase(); }));
        pointsEarned = selectedArray.reduce(function (sum, item) { return sum + (arraySet.has(item) ? 1 : 0); }, 0);
      } else if (user) {
        var variants = String(correct).split('|').map(function (item) { return norm(item); }).filter(Boolean);
        pointsEarned = variants.indexOf(norm(user)) !== -1 ? 1 : 0;
      }

      if (pointsEarned > pointsTotal) pointsEarned = pointsTotal;
      return {
        pointsEarned: pointsEarned,
        pointsTotal: pointsTotal,
        isCorrect: pointsTotal > 0 && pointsEarned === pointsTotal
      };
    }

    function applyGroupedAnswers(results) {
      groupedAnswers.forEach(function (group) {
        var questions = (group.questions || []).map(function (q) { return parseInt(q, 10); }).filter(Boolean);
        var answers = (group.answers || []).map(function (answer) { return String(answer).toUpperCase(); }).sort();
        var chosen = questions.map(function (q) {
          var result = results['q' + q];
          return result && result.userAnswer && result.userAnswer !== 'No answer'
            ? String(result.userAnswer).toUpperCase()
            : '';
        }).filter(Boolean).sort();
        var isComplete = chosen.length === answers.length && chosen.join(',') === answers.join(',');

        questions.forEach(function (q) {
          var key = 'q' + q;
          if (!results[key]) return;
          results[key].pointsEarned = isComplete && results[key].userAnswer !== 'No answer' ? 1 : 0;
          results[key].pointsTotal = 1;
          results[key].isCorrect = isComplete && results[key].userAnswer !== 'No answer';
          results[key].correct = answers.join(' / ');
        });
      });
    }

    function injectReviewHighlightStyles() {
      if (document.getElementById('reading-review-highlight-styles')) return;
      var style = document.createElement('style');
      style.id = 'reading-review-highlight-styles';
      style.textContent = [
        '.reading-review-correct-choice{background:#dcfce7!important;border:1px solid #22c55e!important;color:#14532d!important;border-radius:6px;padding:4px 6px;box-shadow:0 0 0 2px rgba(34,197,94,.12);}',
        '.reading-review-wrong-choice{background:#fee2e2!important;border:1px solid #ef4444!important;color:#7f1d1d!important;border-radius:6px;padding:4px 6px;box-shadow:0 0 0 2px rgba(239,68,68,.10);}',
        'label.reading-review-correct-choice,label.reading-review-wrong-choice{display:inline-block;}',
        'td.reading-review-correct-choice,td.reading-review-wrong-choice{padding:6px!important;}',
        '.reading-review-correct-field{border-color:#22c55e!important;background:#f0fdf4!important;box-shadow:0 0 0 2px rgba(34,197,94,.20)!important;}',
        '.reading-review-wrong-field{border-color:#ef4444!important;background:#fff1f2!important;box-shadow:0 0 0 2px rgba(239,68,68,.18)!important;}',
        '.reading-review-correct-choice input:disabled,.reading-review-wrong-choice input:disabled{opacity:1;}'
      ].join('\n');
      document.head.appendChild(style);
    }

    function clearReviewHighlights() {
      document.querySelectorAll('.reading-review-correct-choice,.reading-review-wrong-choice,.reading-review-correct-field,.reading-review-wrong-field').forEach(function (node) {
        node.classList.remove('reading-review-correct-choice', 'reading-review-wrong-choice', 'reading-review-correct-field', 'reading-review-wrong-field');
      });
    }

    function correctValuesForHighlight(correct) {
      if (!correct) return [];
      if (correct && correct.type === 'partial') return correct.options || [];
      if (Array.isArray(correct)) return correct;
      return String(correct).split(/[|,/]+/);
    }

    function selectedValuesForHighlight(value) {
      return String(value || '').split(',');
    }

    function optionHighlightTarget(input) {
      if (!input) return null;
      var label = input.closest ? input.closest('label') : null;
      if (label) return label;
      var cell = input.closest ? input.closest('td') : null;
      if (cell) return cell;
      return input.parentNode || input;
    }

    function highlightOptionControls(inputs, correct, userAnswer) {
      var correctSet = new Set(correctValuesForHighlight(correct).map(function (item) { return norm(item); }).filter(Boolean));
      var userSet = new Set(selectedValuesForHighlight(userAnswer).map(function (item) { return norm(item); }).filter(Boolean));
      Array.prototype.slice.call(inputs || []).forEach(function (input) {
        var target = optionHighlightTarget(input);
        var value = norm(input.value);
        if (!target || !value) return;
        if (correctSet.has(value)) target.classList.add('reading-review-correct-choice');
        if (userSet.has(value) && !correctSet.has(value)) target.classList.add('reading-review-wrong-choice');
      });
    }

    function highlightFieldControl(node, isCorrect) {
      if (!node) return;
      node.classList.add(isCorrect ? 'reading-review-correct-field' : 'reading-review-wrong-field');
    }

    function highlightDragOptions(correct, userAnswer) {
      var correctSet = new Set(correctValuesForHighlight(correct).map(function (item) { return norm(item); }).filter(Boolean));
      var userSet = new Set(selectedValuesForHighlight(userAnswer).map(function (item) { return norm(item); }).filter(Boolean));
      document.querySelectorAll('.drag-item[data-answer]').forEach(function (item) {
        var value = norm(item.dataset.answer || item.dataset.value || item.textContent);
        if (!value) return;
        if (correctSet.has(value)) item.classList.add('reading-review-correct-choice');
        if (userSet.has(value) && !correctSet.has(value)) item.classList.add('reading-review-wrong-choice');
      });
    }

    function highlightReviewAnswer(key, questionNumber, res) {
      var radios = document.querySelectorAll('input[name="' + key + '"][type="radio"]');
      var cbs = document.querySelectorAll('input[name="' + key + '"][type="checkbox"]');
      var text = getTextInputByName(key);
      var sel = document.querySelector('select[name="' + key + '"]');
      var zones = document.querySelectorAll('.drop-zone[data-target="' + key + '"]');
      var groupedContext = getGroupedCheckboxContext(questionNumber);

      if (radios.length) highlightOptionControls(radios, res.correct, res.userAnswer);
      if (cbs.length) highlightOptionControls(cbs, res.correct, res.userAnswer);
      if (!cbs.length && groupedContext && groupedContext.checkboxes.length) {
        highlightOptionControls(groupedContext.checkboxes, res.correct, res.userAnswer);
      }
      if (zones.length) highlightDragOptions(res.correct, res.userAnswer);
      highlightFieldControl(text, res.isCorrect);
      highlightFieldControl(sel, res.isCorrect);
      Array.prototype.slice.call(zones).forEach(function (zone) {
        highlightFieldControl(zone, res.isCorrect);
      });
    }

    function groupedQuestionNumbersForReview(context) {
      if (!context || !context.numbers || !context.numbers.length) return [];
      if (context.numbers.length === 2 && context.numbers[1] > context.numbers[0] + 1) {
        var range = [];
        for (var q = context.numbers[0]; q <= context.numbers[1]; q += 1) range.push(q);
        return range;
      }
      return context.numbers.slice();
    }

    function groupedCorrectValuesForReview(context, results) {
      var values = [];
      groupedQuestionNumbersForReview(context).forEach(function (q) {
        var res = results['q' + q];
        if (!res) return;
        values = values.concat(correctValuesForHighlight(res.correct));
      });
      return Array.from(new Set(values.map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
    }

    function groupedUserValuesForReview(context) {
      return Array.from(new Set(getGroupedSelectedValues(context).map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
    }

    function isGroupedReviewCorrect(correctValues, userValues) {
      if (!correctValues.length) return false;
      if (correctValues.length !== userValues.length) return false;
      var userNorms = userValues.map(norm);
      return correctValues.every(function (value) { return userNorms.indexOf(norm(value)) !== -1; });
    }

    function submitAll() {
      // After the first submission, the same button reopens the results
      // modal — students often want to see their score again after closing
      // the panel. The button label is updated to "View Result" once
      // submission has happened.
      if (isSubmitted) {
        var existingModal = el('results-modal');
        if (existingModal) existingModal.style.display = 'flex';
        return;
      }
      if (!confirm('Submit the entire test?')) return;
      isSubmitted = true;
      stopTimer();

      var submitButton = el('submit-all-btn');
      if (submitButton) {
        submitButton.classList.add('is-submitted');
        submitButton.dataset.originalLabel = submitButton.textContent || 'Submit Test';
        submitButton.textContent = 'View Result';
        submitButton.title = 'Open the results panel from your submitted test';
        submitButton.disabled = false;
      }

      var maxQ = PARTS[PARTS.length - 1].qEnd;
      var results = {};
      var score = 0;
      var totalPoints = Object.keys(correctAnswers).reduce(function (sum, key) {
        return sum + questionPoints(correctAnswers[key]);
      }, 0);

      for (var q = 1; q <= maxQ; q += 1) {
        var key = 'q' + q;
        var correct = correctAnswers[key];
        if (!correct) continue;
        var user = getQuestionUserValue(key);
        var scoreResult = scoreAnswer(key, correct, user);
        results[key] = {
          userAnswer: user || 'No answer',
          correct: correct,
          pointsEarned: scoreResult.pointsEarned,
          pointsTotal: scoreResult.pointsTotal,
          isCorrect: scoreResult.isCorrect
        };
      }

      applyGroupedAnswers(results);
      score = Object.keys(results).reduce(function (sum, key) { return sum + (results[key].pointsEarned || 0); }, 0);

      for (var progressQ = 1; progressQ <= maxQ; progressQ += 1) {
        var res = results['q' + progressQ];
        var chip = document.querySelector('.progress-item[data-question="' + progressQ + '"]');
        if (chip) {
          chip.classList.remove('current', 'answered');
          if (res) chip.classList.add(res.isCorrect ? 'correct' : 'incorrect');
        }
      }

      if (el('score-display')) el('score-display').textContent = score + '/' + totalPoints;
      var breakdown = el('score-breakdown');
      if (breakdown) {
        breakdown.innerHTML = PARTS.map(function (part) {
          var partEarned = 0;
          var partTotal = 0;
          for (var q = part.qStart; q <= part.qEnd; q += 1) {
            var result = results['q' + q];
            if (!result) continue;
            partEarned += result.pointsEarned || 0;
            partTotal += result.pointsTotal || 0;
          }
          var partRatio = partTotal > 0 ? Math.round((partEarned / partTotal) * 100) : 0;
          return '<div class="score-item" style="--ratio:' + partRatio + '%"><span>Passage ' + part.id + ':</span><span>' + partEarned + '/' + partTotal + '</span></div>';
        }).join('');
      }

      if (window.IELTSProgress && typeof window.IELTSProgress.trackTestResult === 'function') {
        window.IELTSProgress.trackTestResult('reading', {
          score: score,
          total: totalPoints,
          label: TEST_LABEL,
          test_id: TEST_STORAGE_ID,
          answers: collectCurrentAnswers(),
          href: window.location.pathname
        });
      }

      var submittedMenuLink = el('submittedMenuLink');
      if (submittedMenuLink) submittedMenuLink.style.display = 'inline-flex';

      var resultsModal = el('results-modal');
      if (resultsModal) resultsModal.style.display = 'flex';

      var reviewButton = el('review-answers');
      if (reviewButton) {
        reviewButton.onclick = function () {
          if (resultsModal) resultsModal.style.display = 'none';
          showCorrectIndicators(results);
        };
      }
    }

    function showCorrectIndicators(results) {
      document.querySelectorAll('.answer-indicator').forEach(function (node) { node.remove(); });
      clearReviewHighlights();
      injectReviewHighlightStyles();
      var maxQ = PARTS[PARTS.length - 1].qEnd;
      var handledGroupedNames = {};

      for (var q = 1; q <= maxQ; q += 1) {
        var key = 'q' + q;
        var res = results[key];
        if (!res) continue;
        var groupedContextForDisplay = getGroupedCheckboxContext(q);

        if (groupedContextForDisplay && groupedContextForDisplay.checkboxes.length) {
          if (handledGroupedNames[groupedContextForDisplay.name]) continue;
          handledGroupedNames[groupedContextForDisplay.name] = true;

          var groupedCorrectValues = groupedCorrectValuesForReview(groupedContextForDisplay, results);
          var groupedUserValues = groupedUserValuesForReview(groupedContextForDisplay);
          var groupedIsCorrect = isGroupedReviewCorrect(groupedCorrectValues, groupedUserValues);

          highlightOptionControls(groupedContextForDisplay.checkboxes, groupedCorrectValues, groupedUserValues.join(','));

          var groupedQuestion = groupedContextForDisplay.checkboxes[0].closest('.question');
          var groupedTarget = groupedQuestion ? (groupedQuestion.querySelector('.options') || groupedQuestion) : groupedContextForDisplay.checkboxes[0].parentNode;
          if (!groupedTarget) continue;

          var groupedBox = document.createElement('div');
          groupedBox.className = 'answer-indicator ' + (groupedIsCorrect ? 'correct' : 'incorrect');
          groupedBox.style.display = 'block';
          groupedBox.style.marginTop = '6px';
          groupedBox.innerHTML = groupedIsCorrect
            ? '<i class="fas fa-check"></i> Correct! <strong>Answers:</strong> ' + groupedCorrectValues.join(', ')
            : '<i class="fas fa-times"></i> Incorrect. Your answer: <strong>' + (groupedUserValues.join(',') || 'No answer') + '</strong> <strong>Correct:</strong> ' + groupedCorrectValues.join(', ');
          groupedTarget.appendChild(groupedBox);
          continue;
        }

        highlightReviewAnswer(key, q, res);

        var target = null;
        var qEl = document.querySelector('[data-question="' + q + '"] .options');
        if (qEl) target = qEl;
        if (!target) {
          var input = document.querySelector('input[name="' + key + '"]');
          if (input) target = input.parentNode;
        }
        if (!target) {
          var dz = document.querySelector('.drop-zone[data-target="' + key + '"]');
          if (dz) target = dz;
        }
        if (!target) {
          var sel = document.querySelector('select[name="' + key + '"]');
          if (sel) target = sel.parentNode;
        }
        if (!target) {
          var groupedContext = getGroupedCheckboxContext(q);
          if (groupedContext && groupedContext.checkboxes.length) {
            var groupQuestion = groupedContext.checkboxes[0].closest('.question');
            target = groupQuestion ? (groupQuestion.querySelector('.options') || groupQuestion) : groupedContext.checkboxes[0].parentNode;
          }
        }
        if (!target) continue;

        var box = document.createElement('div');
        box.className = 'answer-indicator ' + (res.isCorrect ? 'correct' : 'incorrect');
        box.style.display = 'block';
        box.style.marginTop = '6px';
        var correctDisplay = displayCorrect(res.correct);

        if (res.pointsTotal > 1) {
          var status = res.isCorrect ? 'Correct!' : (res.pointsEarned > 0 ? 'Partially correct (' + res.pointsEarned + '/' + res.pointsTotal + ')' : 'Incorrect.');
          box.innerHTML = (res.isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>') +
            ' ' + status + ' Your answer: <strong>' + res.userAnswer + '</strong> <strong>Correct:</strong> ' + correctDisplay;
        } else {
          box.innerHTML = res.isCorrect
            ? '<i class="fas fa-check"></i> Correct!'
            : '<i class="fas fa-times"></i> Incorrect. Your answer: <strong>' + res.userAnswer + '</strong> <strong>Correct:</strong> ' + correctDisplay;
        }
        target.appendChild(box);
      }
    }

    function updateTimer() {
      if (isSubmitted) return;
      seconds -= 1;
      var timerSpan = document.querySelector('#globalTimer span');
      var timerContainer = document.querySelector('#globalTimer');
      var minutes = Math.floor(seconds / 60);
      var remainingSeconds = seconds % 60;
      if (timerSpan) {
        timerSpan.textContent = String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0');
      }
      if (timerContainer && seconds <= 2 * 60) timerContainer.classList.add('warning');
      if (seconds <= 0) {
        stopTimer();
        alert('Time is up! Submitting all passages.');
        var submitButton = el('submit-all-btn');
        if (submitButton) submitButton.click();
      }
    }

    function stopTimer() {
      if (!timerInterval) return;
      clearInterval(timerInterval);
      timerInterval = null;
    }

    function clearSavedAnswersForFreshStart() {
      freshStartRequested = true;

      if (window.IELTSProgress && typeof window.IELTSProgress.saveDraft === 'function') {
        window.IELTSProgress.saveDraft(TEST_STORAGE_ID, {});
      }
      try {
        localStorage.removeItem(getLegacySavedAnswersKey());
      } catch (error) {}
      if (window.IELTSHighlightPersistence && typeof window.IELTSHighlightPersistence.clearCurrent === 'function') {
        window.IELTSHighlightPersistence.clearCurrent();
      }

      document.querySelectorAll('input[name^="q"]').forEach(function (input) {
        if (input.type === 'radio' || input.type === 'checkbox') input.checked = false;
        else input.value = '';
        input.disabled = false;
      });
      document.querySelectorAll('select[name^="q"]').forEach(function (select) {
        select.value = '';
        select.disabled = false;
      });
      document.querySelectorAll('.drop-zone').forEach(clearZone);
      document.querySelectorAll('.drag-item').forEach(function (item) {
        item.dataset.used = 'false';
        item.classList.remove('used');
        item.draggable = true;
      });
      document.querySelectorAll('.progress-item').forEach(function (item) {
        item.classList.remove('answered', 'correct', 'incorrect');
      });
      document.querySelectorAll('.answer-indicator').forEach(function (node) {
        node.remove();
      });
      clearReviewHighlights();
      refreshBottomBar();
    }

    function startTest() {
      if (isSubmitted) return;
      // Normal Start Test clicks always begin a clean attempt. An explicit
      // historical attempt link keeps its answers so it can still be reviewed.
      if (!ATTEMPT_QUERY_ID) clearSavedAnswersForFreshStart();
      if (el('startScreen')) el('startScreen').classList.add('hidden');
      if (el('testContainer')) el('testContainer').classList.remove('hidden');
      stopTimer();
      timerInterval = setInterval(updateTimer, 1000);
    }

    function initPanels() {
      PARTS.forEach(function (part) {
        var passage = el(part.passagePanel);
        var questions = el(part.questionsPanel);
        if (!passage || !questions) return;
        if (part.id === 1) {
          passage.classList.remove('hidden');
          questions.classList.remove('hidden');
        } else {
          passage.classList.add('hidden');
          questions.classList.add('hidden');
        }
      });
    }

    function initSavedAnswers() {
      if (window.IELTSProgress && typeof window.IELTSProgress.initSync === 'function') {
        window.IELTSProgress.initSync().then(function () {
          restoreSavedAnswers();
          attachAnsweredListeners();
          refreshBottomBar();
        }).catch(function () {
          restoreSavedAnswers();
          attachAnsweredListeners();
          refreshBottomBar();
        });
      } else {
        restoreSavedAnswers();
        attachAnsweredListeners();
        refreshBottomBar();
      }
    }

    function initOptionsModal() {
      var optionsModal = el('options-modal');
      var optionsTitle = el('options-title');
      var optionsBack = el('options-back');
      var optionsHome = el('options-home');
      var contrastMenu = el('contrast-menu');
      var textSizeMenu = el('textsize-menu');
      if (!optionsModal || !optionsHome || !contrastMenu || !textSizeMenu) return;

      function switchView(view) {
        currentView = view;
        optionsHome.style.display = view === 'home' ? 'block' : 'none';
        contrastMenu.style.display = view === 'contrast' ? 'block' : 'none';
        textSizeMenu.style.display = view === 'textsize' ? 'block' : 'none';
        if (optionsBack) optionsBack.style.visibility = view === 'home' ? 'hidden' : 'visible';
        if (optionsTitle) optionsTitle.textContent = view === 'home' ? 'Options' : (view === 'contrast' ? 'Contrast' : 'Text size');
      }

      function openOptions() {
        optionsModal.style.display = 'flex';
        switchView('home');
      }

      function closeOptions() {
        optionsModal.style.display = 'none';
      }

      var optionsButton = el('optionsMenuBtn');
      var closeButton = el('close-options');
      if (optionsButton) optionsButton.addEventListener('click', openOptions);
      if (closeButton) closeButton.addEventListener('click', closeOptions);
      window.addEventListener('click', function (event) { if (event.target === optionsModal) closeOptions(); });
      if (optionsBack) optionsBack.addEventListener('click', function () { switchView('home'); });

      optionsHome.querySelectorAll('.option-row').forEach(function (row) {
        row.addEventListener('click', function () { switchView(row.dataset.target); });
      });

      function applyContrast(mode) {
        document.body.classList.remove('contrast-white-black', 'contrast-yellow-black');
        if (mode === 'whiteblack') document.body.classList.add('contrast-white-black');
        if (mode === 'yellowblack') document.body.classList.add('contrast-yellow-black');
        selectedContrast = mode;
        contrastMenu.querySelectorAll('button').forEach(function (button) {
          button.classList.toggle('selected', button.dataset.contrast === selectedContrast);
        });
        if (el('contrast-current')) {
          el('contrast-current').textContent = mode === 'whiteblack'
            ? 'White on black'
            : (mode === 'yellowblack' ? 'Yellow on black' : 'Black on white');
        }
      }

      function applyTextSize(size) {
        var base = { small: '14px', medium: '16px', large: '19px', xlarge: '24px' }[size] || '16px';
        document.documentElement.style.fontSize = base;
        selectedTextSize = size;
        textSizeMenu.querySelectorAll('button').forEach(function (button) {
          button.classList.toggle('selected', button.dataset.textsize === selectedTextSize);
        });
        if (el('textsize-current')) {
          el('textsize-current').textContent = size === 'small'
            ? 'Small'
            : (size === 'large' ? 'Large' : (size === 'xlarge' ? 'Extra large' : 'Medium'));
        }
      }

      contrastMenu.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
          applyContrast(button.dataset.contrast);
          switchView('home');
        });
      });

      textSizeMenu.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
          applyTextSize(button.dataset.textsize);
          switchView('home');
        });
      });

      applyContrast(selectedContrast);
      applyTextSize(selectedTextSize);
    }

    function initFullscreen() {
      var fsBtn = el('fullscreenBtn');
      if (!fsBtn) return;
      fsBtn.addEventListener('click', function () {
        if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
          (function () { var requestFullscreen = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen; if (requestFullscreen) { try { var request = requestFullscreen.call(document.documentElement); if (request && typeof request.catch === 'function') request.catch(function () {}); } catch (error) {} } })();
        } else { var exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen; if (exitFullscreen) exitFullscreen.call(document); }
      });
    }

    function initResize() {
      var isResizing = false;
      document.querySelectorAll('.resizer').forEach(function (resizer) {
        resizer.addEventListener('mousedown', function () {
          isResizing = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });
      });
      document.addEventListener('mousemove', function (event) {
        if (!isResizing) return;
        var container = document.querySelector('.main-content');
        if (!container) return;
        var rect = container.getBoundingClientRect();
        var mouseX = event.clientX - rect.left;
        var leftPct = (mouseX / rect.width) * 100;
        var rightPct = 100 - leftPct;
        if (leftPct >= 30 && leftPct <= 70) {
          var passage = document.querySelector('.passage-container:not(.hidden)');
          var questions = document.querySelector('.questions-container:not(.hidden)');
          if (passage) passage.style.flex = leftPct + '%';
          if (questions) questions.style.flex = rightPct + '%';
        }
      });
      document.addEventListener('mouseup', function () {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    }

    function initHighlighting() {
      var highlightBtn = el('highlight-btn');
      var removeHighlightBtn = el('remove-highlight-btn');
      if (!highlightBtn || !removeHighlightBtn) return;
      var passagePanels = PARTS.map(function (part) { return el(part.passagePanel); });
      var questionsPanels = PARTS.map(function (part) { return el(part.questionsPanel); });
      var lastSelection = null;
      var highlightTarget = null;
      var selectionFrame = null;

      function getValidSelection() {
        var sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return null;
        var range = sel.getRangeAt(0);
        var validInPassage = passagePanels.some(function (panel) { return panel && panel.contains(range.commonAncestorContainer); });
        var validInQuestions = questionsPanels.some(function (panel) { return panel && panel.contains(range.commonAncestorContainer); });
        return validInPassage || validInQuestions ? range : null;
      }

      function showHighlightBtn(range) {
        var rect = range.getBoundingClientRect();
        highlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
        highlightBtn.style.left = (window.scrollX + rect.left) + 'px';
        highlightBtn.style.display = 'block';
      }

      function hideHighlightBtn() {
        highlightBtn.style.display = 'none';
      }

      function showRemoveBtn(span) {
        var rect = span.getBoundingClientRect();
        removeHighlightBtn.style.top = (window.scrollY + rect.top - 35) + 'px';
        removeHighlightBtn.style.left = (window.scrollX + rect.left) + 'px';
        removeHighlightBtn.style.display = 'block';
        highlightTarget = span;
      }

      function hideRemoveBtn() {
        removeHighlightBtn.style.display = 'none';
        highlightTarget = null;
      }

      function getHighlightSegmentRanges(range) {
        if (!range || range.collapsed) return [];
        var segments = [];
        var root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentNode
          : range.commonAncestorContainer;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var node = walker.nextNode();
        while (node) {
          if (!range.intersectsNode(node)) {
            node = walker.nextNode();
            continue;
          }
          var nodeStart = node === range.startContainer ? range.startOffset : 0;
          var nodeEnd = node === range.endContainer ? range.endOffset : (node.textContent || '').length;
          if (nodeStart < nodeEnd) {
            var segmentRange = document.createRange();
            segmentRange.setStart(node, nodeStart);
            segmentRange.setEnd(node, nodeEnd);
            segments.push(segmentRange);
          }
          if (node === range.endContainer) break;
          node = walker.nextNode();
        }
        return segments;
      }

      highlightBtn.addEventListener('click', function () {
        if (!lastSelection) return;
        var segments = getHighlightSegmentRanges(lastSelection);
        for (var index = segments.length - 1; index >= 0; index -= 1) {
          try {
            var span = document.createElement('span');
            span.className = 'highlight';
            span.appendChild(segments[index].extractContents());
            segments[index].insertNode(span);
          } catch (error) {}
        }
        window.getSelection().removeAllRanges();
        hideHighlightBtn();
      });

      removeHighlightBtn.addEventListener('click', function () {
        if (!highlightTarget) return;
        var parent = highlightTarget.parentNode;
        while (highlightTarget.firstChild) parent.insertBefore(highlightTarget.firstChild, highlightTarget);
        parent.removeChild(highlightTarget);
        hideRemoveBtn();
      });

      document.addEventListener('selectionchange', function () {
        if (selectionFrame) cancelAnimationFrame(selectionFrame);
        selectionFrame = requestAnimationFrame(function () {
          hideHighlightBtn();
          hideRemoveBtn();
          var range = getValidSelection();
          if (range) {
            lastSelection = range;
            showHighlightBtn(range);
          } else {
            lastSelection = null;
          }
          selectionFrame = null;
        });
      });

      document.addEventListener('mousedown', function (event) {
        if (event.target !== highlightBtn && event.target !== removeHighlightBtn) {
          hideHighlightBtn();
          hideRemoveBtn();
        }
      });

      document.addEventListener('click', function (event) {
        if (event.target.classList && event.target.classList.contains('highlight')) {
          event.preventDefault();
          showRemoveBtn(event.target);
        }
      });
    }

    function initGuards() {
      document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
      document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'C', 'V', 'X'].indexOf(event.key) !== -1) {
          event.preventDefault();
        }
      });
      ['copy', 'cut', 'paste'].forEach(function (eventName) {
        document.addEventListener(eventName, function (event) { event.preventDefault(); });
      });
    }

    window.startTest = startTest;

    window.setTimeout(function () {
      if (el('loadingScreen')) el('loadingScreen').classList.add('hidden');
      if (el('startScreen')) el('startScreen').classList.remove('hidden');
    }, Number(config.loadingDelay || 900));

    initPanels();
    normalizeRecentRadioTables();
    renderBottomTabs();
    setupDragDrop();
    setupLimitedCheckboxes();
    setupThreatSelection();
    createAnchors();
    initSavedAnswers();
    refreshBottomBar();
    initOptionsModal();
    initFullscreen();
    initResize();
    initHighlighting();
    initGuards();

    var submitButton = el('submit-all-btn');
    if (submitButton) submitButton.addEventListener('click', submitAll);
    var closeModalButton = el('close-modal');
    if (closeModalButton) closeModalButton.addEventListener('click', function () {
      if (el('results-modal')) el('results-modal').style.display = 'none';
    });
  }

  window.IELTSReadingFullTest = {
    init: init
  };
})();
