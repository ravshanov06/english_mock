/*
 * IELTS AI Writing Feedback (Grammarly-style)
 * -------------------------------------------
 * Builds a two-pane review panel: the student's essay on the left with
 * inline-underlined issues, and a stack of suggestion cards on the right
 * showing strikethrough -> green diff plus Accept / Ignore controls.
 *
 * Uses an offline heuristic NLP pass plus an optional call to the public
 * LanguageTool grammar API (no key, free). Falls back to heuristics if
 * the network call fails.
 *
 * Public API on window.IELTSAIWritingFeedback:
 *   analyzeText(text, opts)        -> Promise<Report>
 *   mountButton({ getTasks })      -> attaches a floating launch button
 *   openFeedback({ getTasks })     -> opens the modal programmatically
 */
(function () {
  'use strict';

  var LT_ENDPOINT = 'https://api.languagetool.org/v2/check';
  var LT_LANGUAGE = 'en-US';
  var LT_TIMEOUT_MS = 9000;
  var LT_MAX_CHARS = 18000;

  var TRANSITION_WORDS = [
    'however', 'moreover', 'furthermore', 'in addition', 'additionally',
    'therefore', 'consequently', 'as a result', 'for example', 'for instance',
    'on the other hand', 'in contrast', 'in conclusion', 'to conclude',
    'firstly', 'secondly', 'finally', 'overall', 'nevertheless', 'whereas',
    'although', 'despite', 'meanwhile', 'similarly', 'in summary'
  ];

  var STOP_WORDS = (
    'a an the and or but if then so because while when where which who whom whose ' +
    'this that these those is am are was were be been being have has had do does did ' +
    'will would shall should can could may might must of in on at by for to from with ' +
    'as into about over under between through during after before above below up down ' +
    'out off again further once it its their there here we you i he she they them us our ' +
    'my your his her them theirs ours mine not no nor than too very just also only own ' +
    'same such more most some any all each every other another both either neither'
  ).split(/\s+/).reduce(function (acc, w) { acc[w] = true; return acc; }, {});

  var VOWEL_SOUND_EXCEPTIONS_AN = { 'hour': 1, 'honest': 1, 'honor': 1, 'heir': 1 };
  var VOWEL_SOUND_EXCEPTIONS_A  = { 'university': 1, 'unique': 1, 'european': 1, 'user': 1, 'one': 1, 'once': 1, 'unit': 1, 'unified': 1, 'useful': 1 };

  // ---------------- helpers ----------------
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function splitSentences(text) {
    if (!text) return [];
    var raw = String(text).replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    return (raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function wordsOf(text) { return String(text || '').toLowerCase().match(/[a-z']+/g) || []; }
  function countWords(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function indexOfWithRegex(text, regex) {
    regex.lastIndex = 0;
    var hits = []; var m;
    while ((m = regex.exec(text)) !== null) {
      hits.push({ index: m.index, match: m[0], groups: m });
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
    return hits;
  }

  // ---------------- heuristic checks ----------------
  // Combines several open-source grammar/style rule sets re-implemented
  // locally so they run with no network call:
  //   * Article (a/an) check
  //   * Subject-verb agreement (basic)
  //   * Common IELTS-misspelt words
  //   * Capitalisation (sentence start + pronoun "I")
  //   * Punctuation hygiene (double spaces, repeated marks, missing space)
  //   * Confusions list (your/you're, its/it's, their/there/they're,
  //     then/than, loose/lose, fewer/less, modal + to, etc.)
  //   * write-good style rules (passive voice, weasel words, wordy phrases,
  //     adverbs ending in -ly, "There is/are" openings)
  //   * retext-equivalent rules (repeated words, uncountable plurals)
  //
  // Each issue has: kind ('grammar' | 'mechanics' | 'style'), severity
  // ('major' | 'minor'), rule (short label), message (one line),
  // replacement (concrete string or null), offset, length, source.
  function runHeuristicChecks(text) {
    var issues = [];
    if (!text || !text.trim()) return issues;

    function push(kind, severity, rule, message, replacement, index, length) {
      issues.push({
        kind: kind, severity: severity, rule: rule, message: message,
        replacement: replacement == null ? null : String(replacement),
        offset: index, length: length, source: 'heuristic'
      });
    }

    // ---- Punctuation & spacing ----
    indexOfWithRegex(text, /  +/g).forEach(function (h) {
      push('mechanics', 'minor', 'Remove extra spaces', 'Two or more spaces in a row.', ' ', h.index, h.match.length);
    });
    indexOfWithRegex(text, /([.,!?;:]){2,}/g).forEach(function (h) {
      push('mechanics', 'minor', 'Repeated punctuation', 'Punctuation mark repeated.', h.match.charAt(0), h.index, h.match.length);
    });
    indexOfWithRegex(text, /\s+([,.!?;:])/g).forEach(function (h) {
      push('mechanics', 'minor', 'Space before punctuation', 'There should be no space before this punctuation mark.', h.groups[1], h.index, h.match.length);
    });
    indexOfWithRegex(text, /([a-zA-Z])([,.!?;:])(?=[A-Za-z])/g).forEach(function (h) {
      var punct = h.groups[2];
      push('mechanics', 'minor', 'Missing space after punctuation', 'Add a space after the punctuation mark.', punct + ' ', h.index + 1, 1);
    });

    // ---- Capitalisation ----
    indexOfWithRegex(text, /(^|[^A-Za-z'])(i)(?=[\s'\.,!?:;]|$)/g).forEach(function (h) {
      var off = h.index + h.match.indexOf('i');
      push('grammar', 'major', 'Capitalise "I"', 'The pronoun "I" must be capitalised.', 'I', off, 1);
    });
    indexOfWithRegex(text, /(^|[.!?]\s+)([a-z])/g).forEach(function (h) {
      var letter = h.groups[2];
      var letterIdx = h.index + h.match.length - 1;
      push('mechanics', 'major', 'Sentence start capitalisation', 'A new sentence should start with a capital letter.', letter.toUpperCase(), letterIdx, 1);
    });

    // ---- Contractions (formal register) ----
    var informal = [
      { rx: /\bcan't\b/g,  fix: 'cannot' },
      { rx: /\bcannot\b/g, fix: null }, // not an issue, but listed to balance
      { rx: /\bdon't\b/g,  fix: 'do not' },
      { rx: /\bdoesn't\b/g,fix: 'does not' },
      { rx: /\bdidn't\b/g, fix: 'did not' },
      { rx: /\bwon't\b/g,  fix: 'will not' },
      { rx: /\bwouldn't\b/g, fix: 'would not' },
      { rx: /\bshouldn't\b/g, fix: 'should not' },
      { rx: /\bcouldn't\b/g, fix: 'could not' },
      { rx: /\bisn't\b/g,  fix: 'is not' },
      { rx: /\baren't\b/g, fix: 'are not' },
      { rx: /\bwasn't\b/g, fix: 'was not' },
      { rx: /\bweren't\b/g, fix: 'were not' },
      { rx: /\bhasn't\b/g, fix: 'has not' },
      { rx: /\bhaven't\b/g,fix: 'have not' },
      { rx: /\bhadn't\b/g, fix: 'had not' },
      { rx: /\bI'm\b/g,    fix: 'I am' },
      { rx: /\bI've\b/g,   fix: 'I have' },
      { rx: /\bI'll\b/g,   fix: 'I will' },
      { rx: /\bI'd\b/g,    fix: 'I would' },
      { rx: /\bit's\b/gi,  fix: 'it is' },
      { rx: /\bthey're\b/gi, fix: 'they are' },
      { rx: /\bwe're\b/gi, fix: 'we are' },
      { rx: /\byou're\b/gi, fix: 'you are' },
      { rx: /\bthat's\b/gi, fix: 'that is' },
      { rx: /\bthere's\b/gi, fix: 'there is' },
      { rx: /\blet's\b/gi, fix: 'let us' }
    ];
    informal.forEach(function (item) {
      if (!item.fix) return;
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        push('style', 'minor', 'Avoid contractions', 'Avoid contractions in formal academic writing.', item.fix, h.index, h.match.length);
      });
    });

    // ---- Common IELTS spelling errors ----
    var typos = [
      { rx: /\balot\b/gi, fix: 'a lot' },
      { rx: /\baswell\b/gi, fix: 'as well' },
      { rx: /\bteh\b/gi, fix: 'the' },
      { rx: /\brecieve\b/gi, fix: 'receive' },
      { rx: /\brecieved\b/gi, fix: 'received' },
      { rx: /\bgovernement\b/gi, fix: 'government' },
      { rx: /\bbecuase\b/gi, fix: 'because' },
      { rx: /\bbecasue\b/gi, fix: 'because' },
      { rx: /\bdefinately\b/gi, fix: 'definitely' },
      { rx: /\bnoticiable\b/gi, fix: 'noticeable' },
      { rx: /\bthier\b/gi, fix: 'their' },
      { rx: /\bwich\b/gi, fix: 'which' },
      { rx: /\boccured\b/gi, fix: 'occurred' },
      { rx: /\boccuring\b/gi, fix: 'occurring' },
      { rx: /\bsuccesful\b/gi, fix: 'successful' },
      { rx: /\bsuccessfull\b/gi, fix: 'successful' },
      { rx: /\bseperate\b/gi, fix: 'separate' },
      { rx: /\bseperated\b/gi, fix: 'separated' },
      { rx: /\benviroment\b/gi, fix: 'environment' },
      { rx: /\benviornment\b/gi, fix: 'environment' },
      { rx: /\bpriviledge\b/gi, fix: 'privilege' },
      { rx: /\bbeleive\b/gi, fix: 'believe' },
      { rx: /\bacheive\b/gi, fix: 'achieve' },
      { rx: /\bacheived\b/gi, fix: 'achieved' },
      { rx: /\boppurtunity\b/gi, fix: 'opportunity' },
      { rx: /\bopportunaty\b/gi, fix: 'opportunity' },
      { rx: /\btommorrow\b/gi, fix: 'tomorrow' },
      { rx: /\btomorow\b/gi, fix: 'tomorrow' },
      { rx: /\baccomodate\b/gi, fix: 'accommodate' },
      { rx: /\baccomodation\b/gi, fix: 'accommodation' },
      { rx: /\bbussiness\b/gi, fix: 'business' },
      { rx: /\bcomming\b/gi, fix: 'coming' },
      { rx: /\bdissapear\b/gi, fix: 'disappear' },
      { rx: /\bdissapoint\b/gi, fix: 'disappoint' },
      { rx: /\bembarass\b/gi, fix: 'embarrass' },
      { rx: /\bfourty\b/gi, fix: 'forty' },
      { rx: /\bgrammer\b/gi, fix: 'grammar' },
      { rx: /\bharrass\b/gi, fix: 'harass' },
      { rx: /\bimediatly\b/gi, fix: 'immediately' },
      { rx: /\bimediately\b/gi, fix: 'immediately' },
      { rx: /\bindependant\b/gi, fix: 'independent' },
      { rx: /\bjewelery\b/gi, fix: 'jewellery' },
      { rx: /\bkindergarden\b/gi, fix: 'kindergarten' },
      { rx: /\bliesure\b/gi, fix: 'leisure' },
      { rx: /\bmaintainance\b/gi, fix: 'maintenance' },
      { rx: /\bmispell\b/gi, fix: 'misspell' },
      { rx: /\bneccessary\b/gi, fix: 'necessary' },
      { rx: /\bnecesary\b/gi, fix: 'necessary' },
      { rx: /\bperseverence\b/gi, fix: 'perseverance' },
      { rx: /\bposession\b/gi, fix: 'possession' },
      { rx: /\bpreceeding\b/gi, fix: 'preceding' },
      { rx: /\bquesion\b/gi, fix: 'question' },
      { rx: /\bquestionaire\b/gi, fix: 'questionnaire' },
      { rx: /\brecomend\b/gi, fix: 'recommend' },
      { rx: /\brecommand\b/gi, fix: 'recommend' },
      { rx: /\brefered\b/gi, fix: 'referred' },
      { rx: /\bresturant\b/gi, fix: 'restaurant' },
      { rx: /\brythm\b/gi, fix: 'rhythm' },
      { rx: /\bschedual\b/gi, fix: 'schedule' },
      { rx: /\bsincerly\b/gi, fix: 'sincerely' },
      { rx: /\btruely\b/gi, fix: 'truly' },
      { rx: /\buntill\b/gi, fix: 'until' },
      { rx: /\bvaccum\b/gi, fix: 'vacuum' },
      { rx: /\bwierd\b/gi, fix: 'weird' },
      { rx: /\bwellcome\b/gi, fix: 'welcome' },
      { rx: /\byatch\b/gi, fix: 'yacht' },
      { rx: /\bbenificial\b/gi, fix: 'beneficial' },
      { rx: /\bargument\b/gi, fix: null }, // common but spelt right
      { rx: /\bagrument\b/gi, fix: 'argument' },
      { rx: /\bagument\b/gi, fix: 'argument' },
      { rx: /\bcollegue\b/gi, fix: 'colleague' },
      { rx: /\bequiptment\b/gi, fix: 'equipment' },
      { rx: /\bfreind\b/gi, fix: 'friend' },
      { rx: /\bcalender\b/gi, fix: 'calendar' },
      { rx: /\bproffessional\b/gi, fix: 'professional' },
      { rx: /\bpublically\b/gi, fix: 'publicly' },
      { rx: /\babsence\b/gi, fix: null },
      { rx: /\babcense\b/gi, fix: 'absence' },
      { rx: /\babsense\b/gi, fix: 'absence' },
      { rx: /\bnow days\b/gi, fix: 'nowadays' },
      { rx: /\beach others\b/gi, fix: "each other's" }
    ];
    typos.forEach(function (item) {
      if (!item.fix) return;
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        push('grammar', 'major', 'Possible spelling error',
          '"' + h.match + '" — likely a misspelling of "' + item.fix + '".',
          item.fix, h.index, h.match.length);
      });
    });

    // ---- Subject-verb agreement ----
    var svaPatterns = [
      { rx: /\b(He|She|It|he|she|it)\s+(have)\b/g, fix: function (m) { return m[1] + ' has'; } },
      { rx: /\b(He|She|It|he|she|it)\s+(don't|do not)\b/g, fix: function (m) { return m[1] + " does not"; } },
      { rx: /\b(They|We|You|they|we|you)\s+(has)\b/g, fix: function (m) { return m[1] + ' have'; } },
      { rx: /\b(I)\s+(is)\b/g, fix: function () { return 'I am'; } },
      { rx: /\b(I)\s+(was|were)\b/g, fix: function (m) { return m[2] === 'were' ? 'I was' : 'I was'; } },
      { rx: /\b(He|She|It|he|she|it)\s+(are)\b/g, fix: function (m) { return m[1] + ' is'; } },
      { rx: /\b(He|She|It|he|she|it)\s+(were)\b/g, fix: function (m) { return m[1] + ' was'; } },
      { rx: /\b(They|We|You|they|we|you)\s+(was)\b/g, fix: function (m) { return m[1] + ' were'; } },
      { rx: /\b(He|She|It|he|she|it)\s+(go|do|make|take|want|need|like|come|run|see)\b/g, fix: function (m) { var v = m[2]; return m[1] + ' ' + (v.match(/[sxz]$|ch$|sh$/) ? v + 'es' : v + 's'); } }
    ];
    svaPatterns.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var fixed = item.fix(h.groups);
        push('grammar', 'major', 'Subject-verb agreement',
          '"' + h.match + '" — subject and verb do not agree. Try "' + fixed + '".',
          fixed, h.index, h.match.length);
      });
    });

    // ---- Article (a/an) ----
    indexOfWithRegex(text, /\b(a|an|A|An)\s+([A-Za-z][A-Za-z'-]*)/g).forEach(function (h) {
      var article = h.groups[1].toLowerCase();
      var word = h.groups[2].toLowerCase();
      var startsVowelLetter = /^[aeiou]/.test(word);
      var startsVowelSound;
      if (VOWEL_SOUND_EXCEPTIONS_AN[word]) startsVowelSound = true;
      else if (VOWEL_SOUND_EXCEPTIONS_A[word]) startsVowelSound = false;
      else startsVowelSound = startsVowelLetter;
      var origArticle = h.groups[1];
      var isCap = origArticle.charAt(0) === 'A';
      if (article === 'a' && startsVowelSound) {
        push('grammar', 'major', 'Article (a/an)', '"a" before a vowel sound — use "an".', isCap ? 'An' : 'an', h.index, origArticle.length);
      } else if (article === 'an' && !startsVowelSound) {
        push('grammar', 'major', 'Article (a/an)', '"an" before a consonant sound — use "a".', isCap ? 'A' : 'a', h.index, origArticle.length);
      }
    });

    // ---- Common confusions ----
    var confusions = [
      { rx: /\byour welcome\b/gi, fix: "you're welcome", rule: "Confusion (your → you're)" },
      { rx: /\byour right\b/gi, fix: "you're right", rule: "Confusion (your → you're)" },
      { rx: /\byour wrong\b/gi, fix: "you're wrong", rule: "Confusion (your → you're)" },
      { rx: /\byour a\b/gi, fix: "you're a", rule: "Confusion (your → you're)" },
      { rx: /\byour an\b/gi, fix: "you're an", rule: "Confusion (your → you're)" },
      { rx: /\bits a\b/g, fix: "it's a", rule: "Confusion (its → it's)" },
      { rx: /\bits an\b/g, fix: "it's an", rule: "Confusion (its → it's)" },
      { rx: /\bits the\b/g, fix: "it's the", rule: "Confusion (its → it's)" },
      { rx: /\bits not\b/g, fix: "it's not", rule: "Confusion (its → it's)" },
      { rx: /\btheir is\b/gi, fix: 'there is', rule: 'Confusion (their → there)' },
      { rx: /\btheir are\b/gi, fix: 'there are', rule: 'Confusion (their → there)' },
      { rx: /\btheir was\b/gi, fix: 'there was', rule: 'Confusion (their → there)' },
      { rx: /\btheir were\b/gi, fix: 'there were', rule: 'Confusion (their → there)' },
      { rx: /\bmore then\b/gi, fix: 'more than', rule: 'Confusion (then → than)' },
      { rx: /\bless then\b/gi, fix: 'less than', rule: 'Confusion (then → than)' },
      { rx: /\bdifferent then\b/gi, fix: 'different from', rule: 'Confusion (then/than → from)' },
      { rx: /\brather then\b/gi, fix: 'rather than', rule: 'Confusion (then → than)' },
      { rx: /\bbetter then\b/gi, fix: 'better than', rule: 'Confusion (then → than)' },
      { rx: /\bworse then\b/gi, fix: 'worse than', rule: 'Confusion (then → than)' },
      { rx: /\bloose weight\b/gi, fix: 'lose weight', rule: 'Confusion (loose → lose)' },
      { rx: /\bloose the\b/gi, fix: 'lose the', rule: 'Confusion (loose → lose)' },
      { rx: /\bloose a\b/gi, fix: 'lose a', rule: 'Confusion (loose → lose)' },
      { rx: /\bless people\b/gi, fix: 'fewer people', rule: 'Count noun (fewer)' },
      { rx: /\bless students\b/gi, fix: 'fewer students', rule: 'Count noun (fewer)' },
      { rx: /\bless cars\b/gi, fix: 'fewer cars', rule: 'Count noun (fewer)' },
      { rx: /\bless children\b/gi, fix: 'fewer children', rule: 'Count noun (fewer)' },
      { rx: /\bless options\b/gi, fix: 'fewer options', rule: 'Count noun (fewer)' },
      { rx: /\bless jobs\b/gi, fix: 'fewer jobs', rule: 'Count noun (fewer)' },
      { rx: /\bless countries\b/gi, fix: 'fewer countries', rule: 'Count noun (fewer)' },
      { rx: /\bmust to\b/gi, fix: 'must', rule: 'Modal verb (must + base form)' },
      { rx: /\bcan to\b/gi, fix: 'can', rule: 'Modal verb (can + base form)' },
      { rx: /\bcould to\b/gi, fix: 'could', rule: 'Modal verb (could + base form)' },
      { rx: /\bshould to\b/gi, fix: 'should', rule: 'Modal verb (should + base form)' },
      { rx: /\bwould to\b/gi, fix: 'would', rule: 'Modal verb (would + base form)' },
      { rx: /\bmight to\b/gi, fix: 'might', rule: 'Modal verb (might + base form)' },
      { rx: /\bdiscuss about\b/gi, fix: 'discuss', rule: 'Preposition (no "about" after discuss)' },
      { rx: /\bmention about\b/gi, fix: 'mention', rule: 'Preposition (no "about" after mention)' },
      { rx: /\bdepend of\b/gi, fix: 'depend on', rule: 'Preposition (depend on)' },
      { rx: /\bdependent of\b/gi, fix: 'dependent on', rule: 'Preposition (dependent on)' },
      { rx: /\bafraid from\b/gi, fix: 'afraid of', rule: 'Preposition (afraid of)' },
      { rx: /\bdifferent than\b/gi, fix: 'different from', rule: 'Preposition (different from)' },
      { rx: /\bmarried with\b/gi, fix: 'married to', rule: 'Preposition (married to)' },
      { rx: /\binterested on\b/gi, fix: 'interested in', rule: 'Preposition (interested in)' },
      { rx: /\bgood in\b/gi, fix: 'good at', rule: 'Preposition (good at)' }
    ];
    confusions.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        push('grammar', 'major', item.rule,
          '"' + h.match + '" — try "' + item.fix + '".',
          item.fix, h.index, h.match.length);
      });
    });

    // ---- Uncountable nouns wrongly pluralised ----
    var uncountables = [
      { rx: /\binformations\b/gi, fix: 'information' },
      { rx: /\badvices\b/gi, fix: 'advice / pieces of advice' },
      { rx: /\bresearches\b/gi, fix: 'research / studies' },
      { rx: /\bequipments\b/gi, fix: 'equipment / pieces of equipment' },
      { rx: /\bfurnitures\b/gi, fix: 'furniture / pieces of furniture' },
      { rx: /\bknowledges\b/gi, fix: 'knowledge' },
      { rx: /\bhomeworks\b/gi, fix: 'homework' },
      { rx: /\btraffics\b/gi, fix: 'traffic' },
      { rx: /\bpollutions\b/gi, fix: 'pollution' },
      { rx: /\bprogresses\b/gi, fix: 'progress' },
      { rx: /\bsoftwares\b/gi, fix: 'software / software programs' },
      { rx: /\bhardwares\b/gi, fix: 'hardware' },
      { rx: /\baccomodations\b/gi, fix: 'accommodation' },
      { rx: /\bvocabularies\b/gi, fix: 'vocabulary' }
    ];
    uncountables.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        push('grammar', 'major', 'Uncountable noun',
          '"' + h.match + '" — this noun is uncountable. Use "' + item.fix + '" (no "-s").',
          item.fix, h.index, h.match.length);
      });
    });

    // ---- Repeated word ("the the", "is is") ----
    indexOfWithRegex(text, /\b([a-zA-Z]+)\s+\1\b/gi).forEach(function (h) {
      var word = h.groups[1];
      // Skip a small whitelist of legitimately doubled words.
      if (/^(that|had|so|very|really|never|ever)$/i.test(word)) return;
      push('grammar', 'major', 'Repeated word', 'You wrote "' + word + '" twice in a row.', word, h.index, h.match.length);
    });

    // ---- Passive voice (write-good style) ----
    var passiveRx = /\b(am|is|are|was|were|be|been|being)\s+(\w+ed|written|done|made|seen|taken|given|known|shown|built|brought|found|held|kept|left|met|paid|sent|sold|told|thought|caught|taught|put|cut|set|spoken|broken|chosen|driven|grown|eaten|forgotten|risen|run|spent|sworn|won|worn|begun)\b/gi;
    indexOfWithRegex(text, passiveRx).forEach(function (h) {
      push('style', 'minor', 'Passive voice', 'Consider an active alternative for stronger writing.', null, h.index, h.match.length);
    });

    // ---- Weasel / hedge words ----
    var weaselWords = ['very', 'really', 'quite', 'rather', 'fairly', 'somewhat', 'just', 'basically', 'actually', 'literally', 'simply', 'pretty much', 'a lot of'];
    weaselWords.forEach(function (w) {
      var rx = new RegExp('\\b' + w.replace(/ /g, '\\s+') + '\\b', 'gi');
      indexOfWithRegex(text, rx).forEach(function (h) {
        push('style', 'minor', 'Weasel word', 'Consider removing "' + w + '" — it weakens the sentence.', '', h.index, h.match.length);
      });
    });

    // ---- Wordy phrases (write-good "too-wordy") ----
    var wordy = [
      { rx: /\bin order to\b/gi, fix: 'to' },
      { rx: /\bdue to the fact that\b/gi, fix: 'because' },
      { rx: /\bowing to the fact that\b/gi, fix: 'because' },
      { rx: /\bin spite of the fact that\b/gi, fix: 'although' },
      { rx: /\bin the event that\b/gi, fix: 'if' },
      { rx: /\bfor the reason that\b/gi, fix: 'because' },
      { rx: /\bfor the purpose of\b/gi, fix: 'to' },
      { rx: /\bat this point in time\b/gi, fix: 'now' },
      { rx: /\bat the present time\b/gi, fix: 'currently' },
      { rx: /\bin the near future\b/gi, fix: 'soon' },
      { rx: /\bon a daily basis\b/gi, fix: 'daily' },
      { rx: /\bon a regular basis\b/gi, fix: 'regularly' },
      { rx: /\bby means of\b/gi, fix: 'by' },
      { rx: /\ba large number of\b/gi, fix: 'many' },
      { rx: /\ba small number of\b/gi, fix: 'a few' },
      { rx: /\bin spite of\b/gi, fix: 'despite' },
      { rx: /\bso as to\b/gi, fix: 'to' },
      { rx: /\bhas the ability to\b/gi, fix: 'can' },
      { rx: /\bis able to\b/gi, fix: 'can' },
      { rx: /\bwas able to\b/gi, fix: 'could' },
      { rx: /\bmade the decision to\b/gi, fix: 'decided to' },
      { rx: /\bcame to the conclusion\b/gi, fix: 'concluded' },
      { rx: /\bwith regard to\b/gi, fix: 'about' },
      { rx: /\bwith regards to\b/gi, fix: 'about' },
      { rx: /\bin regards to\b/gi, fix: 'regarding' },
      { rx: /\bplays a role in\b/gi, fix: 'contributes to' },
      { rx: /\butili[sz]e\b/gi, fix: 'use' }
    ];
    wordy.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        push('style', 'minor', 'Wordy phrase', 'Simpler is clearer — try "' + item.fix + '".', item.fix, h.index, h.match.length);
      });
    });

    // ---- "There is/are" openings (write-good) ----
    indexOfWithRegex(text, /(^|[.!?]\s+)(There\s+(is|are|was|were))\b/g).forEach(function (h) {
      var startIdx = h.index + (h.groups[1] || '').length;
      push('style', 'minor', 'Weak opening ("There is/are…")', 'Try restructuring with a stronger subject.', null, startIdx, h.groups[2].length);
    });

    // ---- Adverbs ending in -ly (style) ----
    // (Limit to a curated set so we do not over-flag scientific/common adverbs.)
    var lyOverused = ['basically', 'actually', 'literally', 'simply', 'really', 'honestly', 'frankly', 'obviously', 'absolutely', 'totally', 'completely', 'extremely'];
    lyOverused.forEach(function (w) {
      var rx = new RegExp('\\b' + w + '\\b', 'gi');
      indexOfWithRegex(text, rx).forEach(function (h) {
        push('style', 'minor', 'Overused adverb', '"' + w + '" rarely adds meaning. Consider removing it.', '', h.index, h.match.length);
      });
    });

    // ---- Sentence length flags ----
    var sentences = splitSentences(text);
    sentences.forEach(function (sentence) {
      var w = countWords(sentence);
      if (w >= 45) {
        var idx = text.indexOf(sentence);
        if (idx >= 0) push('style', 'minor', 'Very long sentence', 'This sentence has ' + w + ' words. Break it up.', null, idx, sentence.length);
      }
    });

    // ---- Expanded subject-verb agreement (high-impact IELTS errors) ----
    // "each / every / everyone / everybody / everything / no one / nobody /
    // nothing" — always singular.
    var singularQuantifiers = [
      { rx: /\b(each|every|everyone|everybody|everything|anyone|anybody|anything|nobody|no one|nothing|someone|somebody|something)\s+(have|do|are|were)\b/gi, map: { have: 'has', do: 'does', are: 'is', were: 'was' } }
    ];
    singularQuantifiers.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var subj = h.groups[1];
        var verb = h.groups[2].toLowerCase();
        var fix = item.map[verb] || verb;
        push('grammar', 'major', 'Subject-verb agreement',
          '"' + subj + ' ' + verb + '" — "' + subj.toLowerCase() + '" is singular. Use "' + subj + ' ' + fix + '".',
          subj + ' ' + fix, h.index, h.match.length);
      });
    });

    // "each / every + noun" must take a singular noun, not a plural.
    indexOfWithRegex(text, /\b(each|every)\s+([a-z]+s)\b/gi).forEach(function (h) {
      var quantifier = h.groups[1];
      var noun = h.groups[2];
      // Skip a small whitelist of nouns that legitimately end in -s (e.g. "process").
      if (/^(this|these|those|status|series|species|news|means|crisis|analysis|basis)$/i.test(noun)) return;
      // Skip if it's actually a singular noun ending in -s (heuristic: very short -s words).
      if (noun.length <= 4) return;
      push('grammar', 'major', 'Quantifier + plural noun',
        '"' + quantifier + ' ' + noun + '" — "' + quantifier.toLowerCase() + '" is followed by a singular noun.',
        null, h.index, h.match.length);
    });

    // Collective/plural-only nouns that frequently confuse learners.
    var collectives = [
      { rx: /\b(people|police|cattle|children|women|men)\s+(is|was|has|becomes|makes|wants|needs|knows|thinks|feels|goes|comes|takes|gives)\b/gi,
        map: { is: 'are', was: 'were', has: 'have',
               becomes: 'become', makes: 'make', wants: 'want', needs: 'need',
               knows: 'know', thinks: 'think', feels: 'feel',
               goes: 'go', comes: 'come', takes: 'take', gives: 'give' } },
      { rx: /\bthe number of\s+[a-z]+s?\s+(are|were|have)\b/gi,
        map: { are: 'is', were: 'was', have: 'has' },
        message: '"The number of …" is a singular subject.' }
    ];
    collectives.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var verb = (h.groups[2] || h.groups[1]).toLowerCase();
        var fix = item.map[verb];
        if (!fix) return;
        push('grammar', 'major', 'Subject-verb agreement',
          item.message || ('"' + h.match + '" — subject is plural. Use "' + fix + '".'),
          null, h.index, h.match.length);
      });
    });

    // Singular mass nouns wrongly given a plural verb. We intentionally
    // restrict to a short, high-confidence list to keep false positives low.
    var massSingular = [
      { rx: /\b(technology|information|research|equipment|furniture|knowledge|advice|software|hardware|education|society|nature|literature|history|news|traffic|pollution|weather|water|electricity|money)\s+(have|are|were|do)\b/gi,
        map: { have: 'has', are: 'is', were: 'was', do: 'does' } }
    ];
    massSingular.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var subj = h.groups[1];
        var verb = h.groups[2].toLowerCase();
        var fix = item.map[verb] || verb;
        push('grammar', 'major', 'Subject-verb agreement',
          '"' + h.match + '" — "' + subj + '" is treated as singular. Use "' + subj + ' ' + fix + '".',
          subj + ' ' + fix, h.index, h.match.length);
      });
    });

    // ---- Comma splice ----
    // Heuristic: ", " followed by a subject pronoun + finite verb that begins
    // a new independent clause. Conservative — we only fire on the safest
    // patterns to avoid false positives.
    var commaSpliceVerbs = '(is|are|was|were|do|does|did|will|would|can|could|should|must|have|has|had|am|makes?|gets?|comes?|goes|takes?|gives?|helps?|works?|lives?|plays?|uses?|wants?|needs?|seems?|looks?|feels?|thinks?|knows?|believes?|tries|tries?|begins?|starts?|stops?|allows?|enables?|provides?|requires?|causes?|affects?|increases?|decreases?|improves?|reduces?|prevents?|teaches?|learns?|shows?|tells?|sees?|finds?|leaves?|brings?|builds?|spends?|saves?|earns?|costs?|chooses?|decides?|happens?|exists?|matters?|depends?|differs?|appears?|continues?|remains?|grows?|changes?|develops?|creates?|enjoys?|hates?|loves?|likes?)';
    var commaSpliceRx = new RegExp('([a-z]),\\s+(I|We|They|He|She|It|This|These|Those|There|You)\\s+' + commaSpliceVerbs + '\\b', 'g');
    indexOfWithRegex(text, commaSpliceRx).forEach(function (h) {
      var commaIdx = h.index + 1; // position of the comma
      push('grammar', 'major', 'Comma splice',
        'Two complete sentences joined only by a comma. Use a full stop, semicolon, or a connector like "and / however / because".',
        '.', commaIdx, 1);
    });

    // ---- Missing "the" before clearly definite phrases ----
    // "in past" / "in future" — must be "in the past / in the future".
    var missingTheRx = [
      { rx: /\bin\s+past\b/gi,    fix: 'in the past' },
      { rx: /\bin\s+future\b/gi,  fix: 'in the future' },
      { rx: /\bin\s+morning\b/gi, fix: 'in the morning' },
      { rx: /\bin\s+evening\b/gi, fix: 'in the evening' },
      { rx: /\bin\s+afternoon\b/gi, fix: 'in the afternoon' },
      { rx: /\bat\s+(beginning|end)\s+of\b/gi, fix: 'at the $1 of' },
      { rx: /\bplay\s+(piano|guitar|violin|drums|flute|saxophone)\b/gi, fix: 'play the $1' },
      { rx: /\bsame\s+(time|place|way|thing)\b(?!\s+as)/gi, fix: 'the same $1' },  // unless followed by "as"
      { rx: /\bon\s+other\s+hand\b/gi, fix: 'on the other hand' },
      { rx: /\bin\s+contrary\b/gi, fix: 'on the contrary' },
      { rx: /\b(in|on)\s+last\s+(year|month|week|decade|century)\b/gi, fix: '$1 the last $2' },
      { rx: /\bin\s+(north|south|east|west)\s+of\b/gi, fix: 'in the $1 of' },
      { rx: /\bcross\s+world\b/gi, fix: 'across the world' },
      { rx: /\baccross\s+world\b/gi, fix: 'across the world' },
      { rx: /\bacross\s+world\b/gi, fix: 'across the world' }
    ];
    missingTheRx.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        // Skip if there's already an article right before the match.
        var pre = text.slice(Math.max(0, h.index - 4), h.index);
        if (/\b(the|a|an)\s$/i.test(pre)) return;
        var fix = item.fix.replace(/\$1/g, h.groups[1] || '');
        push('grammar', 'major', 'Missing article ("the")',
          '"' + h.match + '" — this phrase needs a definite article. Try "' + fix + '".',
          fix, h.index, h.match.length);
      });
    });

    // "the most / first / best / second / oldest / largest …" — superlatives
    // and ordinals usually require "the" but learners drop it.
    var superlativeRx = /(^|[^A-Za-z])(most|first|second|third|best|worst|largest|smallest|oldest|youngest|biggest|main)\s+([a-z]+)\b/g;
    indexOfWithRegex(text, superlativeRx).forEach(function (h) {
      var leadIdx = h.index + (h.groups[1] || '').length;
      var lead = text.slice(Math.max(0, leadIdx - 4), leadIdx);
      if (/\b(the|a|an|my|his|her|its|their|our|your)\s$/i.test(lead)) return;
      var sup = h.groups[2];
      var noun = h.groups[3];
      // Skip when "most" is a quantifier ("most people", "most of the").
      if (sup.toLowerCase() === 'most' && /^(people|countries|students|of|cases|times|men|women|children|adults)$/i.test(noun)) return;
      push('grammar', 'minor', 'Missing article ("the")',
        '"' + sup + ' ' + noun + '" — superlatives and ordinals usually need "the". Try "the ' + sup + ' ' + noun + '".',
        'the ' + sup + ' ' + noun, leadIdx, sup.length + 1 + noun.length);
    });

    // ---- Double negative ----
    indexOfWithRegex(text, /\b(don't|doesn't|didn't|can't|cannot|won't|wouldn't|shouldn't|couldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|never)\s+(\w+\s+){0,3}(nothing|nobody|no one|none|nowhere|never)\b/gi).forEach(function (h) {
      push('grammar', 'major', 'Double negative',
        '"' + h.match.replace(/\s+/g, ' ') + '" contains two negatives. Use one negative only (e.g., "I have nothing" or "I don\'t have anything").',
        null, h.index, h.match.length);
    });

    // ---- Indirect-question word order ----
    // After "I asked / I know / I wonder / She told me / Tell me / I don't know"
    // the embedded clause should be statement order, not question order.
    indexOfWithRegex(text, /\b(asked|wondered?|tell me|told me|know|knew|don't know|do not know|wonder)\s+(what|where|when|why|how|who|whether|if)\s+(is|are|was|were|do|does|did|can|could|will|would|should)\s+(he|she|it|they|we|you|I|the\s+\w+|this|that)\b/gi).forEach(function (h) {
      push('grammar', 'minor', 'Indirect question word order',
        '"' + h.match + '" — in indirect questions, put the subject *before* the verb (e.g., "where he is", not "where is he").',
        null, h.index, h.match.length);
    });

    // ---- A few more high-frequency confusions ----
    var moreConfusions = [
      { rx: /\baffect\s+(on|in)\b/gi, fix: 'affect', rule: 'Verb confusion (affect)' },
      { rx: /\beffect\s+(by|of)\b/gi, fix: 'effect of', rule: 'Verb confusion (effect)' },
      { rx: /\bnowdays\b/gi, fix: 'nowadays', rule: 'Spelling (nowadays)' },
      { rx: /\bnow days?\b/gi, fix: 'nowadays', rule: 'Spelling (nowadays)' },
      { rx: /\beveryday\s+(life|activity|activities|routine|use)\b/gi, fix: 'everyday $1', rule: null }, // legitimate adj
      { rx: /\bevery day\s+(people|life|routine)\b/gi, fix: 'everyday $1', rule: 'Word form (everyday)' },
      { rx: /\bevery\s+a\s+/gi, fix: 'every ', rule: 'Article (no "a" after "every")' },
      { rx: /\bthe\s+a\s+/gi, fix: 'a ', rule: 'Double article' },
      { rx: /\bthe\s+the\s+/gi, fix: 'the ', rule: 'Repeated article' },
      { rx: /\ba\s+the\s+/gi, fix: 'the ', rule: 'Double article' },
      { rx: /\bmany\s+(information|advice|research|equipment|furniture|knowledge|homework|traffic|software)\b/gi, fix: 'much $1', rule: 'Quantifier (uncountable)' },
      { rx: /\bmuch\s+(people|students|cars|children|hours|days|years|countries|jobs|options)\b/gi, fix: 'many $1', rule: 'Quantifier (countable)' },
      { rx: /\bin\s+nowadays\b/gi, fix: 'nowadays', rule: 'Preposition (no "in" before nowadays)' },
      { rx: /\bsince\s+a\s+long\s+time\b/gi, fix: 'for a long time', rule: 'Preposition (since vs for)' }
    ];
    moreConfusions.forEach(function (item) {
      if (!item.rule) return;
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var fix = item.fix.replace(/\$1/g, h.groups[1] || '');
        push('grammar', 'major', item.rule,
          '"' + h.match + '" — try "' + fix + '".',
          fix, h.index, h.match.length);
      });
    });

    // ---- Word-form errors (verb / adjective / noun confusion) ----
    var wordForm = [
      { rx: /\b(is|are|was|were|am|been|being|be)\s+depend\b/gi, fix: '$1 dependent', rule: 'Word form (depend vs dependent)' },
      { rx: /\bdepend\s+on\s+from\b/gi, fix: 'depend on', rule: 'Preposition (depend on)' },
      { rx: /\b(is|are|was|were|am|been|being|be)\s+rely\b/gi, fix: '$1 reliant', rule: 'Word form (rely vs reliant)' },
      { rx: /\b(am|is|are|was|were|been|being|be)\s+interesting\s+in\b/gi, fix: '$1 interested in', rule: 'Word form (interesting vs interested)' },
      { rx: /\bI\s+am\s+boring\b/gi, fix: 'I am bored', rule: 'Word form (boring vs bored)' },
      { rx: /\bvery\s+boring\s+(of|with)\b/gi, fix: 'very bored $1', rule: 'Word form (boring vs bored)' },
      { rx: /\b(am|is|are|was|were|been|being|be)\s+confidence\b/gi, fix: '$1 confident', rule: 'Word form (confidence vs confident)' },
      { rx: /\b(am|is|are|was|were|been|being|be)\s+difference\b/gi, fix: '$1 different', rule: 'Word form (difference vs different)' },
      { rx: /\b(am|is|are|was|were|been|being|be)\s+importance\b(?!\s+of)/gi, fix: '$1 important', rule: 'Word form (importance vs important)' },
      { rx: /\b(am|is|are|was|were|been|being|be)\s+success\b(?!\s+of)/gi, fix: '$1 successful', rule: 'Word form (success vs successful)' },
      { rx: /\bmake\s+a\s+research\b/gi, fix: 'do research', rule: 'Collocation (do research)' },
      { rx: /\bdo\s+a\s+mistake\b/gi, fix: 'make a mistake', rule: 'Collocation (make a mistake)' },
      { rx: /\bdo\s+a\s+decision\b/gi, fix: 'make a decision', rule: 'Collocation (make a decision)' },
      { rx: /\bmake\s+(a\s+)?homework\b/gi, fix: 'do homework', rule: 'Collocation (do homework)' },
      { rx: /\bmake\s+(a\s+)?exercise\b/gi, fix: 'do exercise', rule: 'Collocation (do exercise)' }
    ];
    wordForm.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var fix = item.fix.replace(/\$1/g, h.groups[1] || '');
        push('grammar', 'major', item.rule,
          '"' + h.match + '" — try "' + fix + '".',
          fix, h.index, h.match.length);
      });
    });

    // ---- Double comparatives / superlatives ----
    var doubleComp = [
      { rx: /\bmore\s+(better|worse|easier|harder|bigger|smaller|faster|slower|higher|lower|cheaper|safer|nicer|kinder|stronger|weaker|happier|wiser|simpler|prettier|funnier|sadder|busier|earlier|later|cleaner|brighter|darker|sweeter|hotter|colder|warmer|cooler|larger|longer|shorter|older|younger|richer|poorer|fewer|further|farther)\b/gi,
        rule: 'Double comparative' },
      { rx: /\b(the\s+)?most\s+(best|worst|easiest|hardest|biggest|smallest|fastest|slowest|highest|lowest|cheapest|safest|nicest|kindest|strongest|weakest|happiest|wisest|simplest|prettiest|funniest|saddest|busiest|earliest|latest|cleanest|brightest|darkest|sweetest|hottest|coldest|warmest|coolest|largest|longest|shortest|oldest|youngest|richest|poorest|fewest|furthest|farthest)\b/gi,
        rule: 'Double superlative' }
    ];
    doubleComp.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var word = h.groups[h.groups.length - 1] || h.groups[1];
        push('grammar', 'major', item.rule,
          '"' + h.match + '" — "' + word + '" is already comparative/superlative. Drop "more"/"most".',
          word, h.index, h.match.length);
      });
    });

    // ---- Conditional form errors ----
    // First conditional should never have "will" in the IF clause.
    indexOfWithRegex(text, /\b(If|if)\s+(I|you|he|she|it|we|they|the\s+\w+|this|that)\s+(will|would)\b/g).forEach(function (h) {
      var subj = h.groups[2];
      var aux = h.groups[3];
      push('grammar', 'major', 'Conditional form',
        '"' + h.match + '" — do not use "' + aux + '" after "if". Use the present simple in the if-clause (e.g. "if she works hard, she will succeed").',
        null, h.index, h.match.length);
    });
    // Second/third conditional: "If I would have" is wrong; should be "If I had".
    indexOfWithRegex(text, /\b(If|if)\s+(I|you|he|she|it|we|they)\s+would\s+have\b/g).forEach(function (h) {
      push('grammar', 'major', 'Conditional form',
        '"' + h.match + '" — use "had", not "would have", in the if-clause of a third conditional.',
        null, h.index, h.match.length);
    });

    // ---- "had better / would rather" must take a bare infinitive ----
    indexOfWithRegex(text, /\b(had\s+better|would\s+rather)\s+to\s+(\w+)/gi).forEach(function (h) {
      var phrase = h.groups[1];
      var verb = h.groups[2];
      push('grammar', 'major', 'Modal phrase (no "to")',
        '"' + h.match + '" — no "to" after "' + phrase + '". Try "' + phrase + ' ' + verb + '".',
        phrase + ' ' + verb, h.index, h.match.length);
    });

    // ---- More preposition rules (time / place / instrument) ----
    var prepRules = [
      { rx: /\bin\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, fix: 'on $1', rule: 'Preposition (on + weekday)' },
      { rx: /\bon\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, fix: 'in $1', rule: 'Preposition (in + month)' },
      { rx: /\bin\s+(\d{4})\s+year\b/gi, fix: 'in $1', rule: 'Preposition (in + year)' },
      { rx: /\bat\s+home\s+at\b/gi, fix: 'at home', rule: 'Preposition (at home)' },
      { rx: /\bin\s+home\b/gi, fix: 'at home', rule: 'Preposition (at home)' },
      { rx: /\bin\s+the\s+home\b(?=\s+of)/gi, fix: 'at home', rule: null }, // legitimate when "the home of X"
      { rx: /\bby\s+foot\b/gi, fix: 'on foot', rule: 'Preposition (on foot)' },
      { rx: /\bwith\s+(bus|car|train|plane|taxi|bicycle|bike|boat|ferry|subway|metro)\b/gi, fix: 'by $1', rule: 'Preposition (by + transport)' },
      { rx: /\blisten\s+(?!to\b)([a-z]+)/gi, fix: null, rule: null }, // we want "listen to" — handled below
      { rx: /\b(listen|listens|listened|listening)\s+(music|the\s+radio|him|her|them|me|us|you)\b/gi, fix: '$1 to $2', rule: 'Preposition (listen to)' },
      { rx: /\b(go|going|went|gone|goes)\s+to\s+(school|university|work|hospital|prison|church|college|bed|sleep)\s+at\b/gi, fix: null, rule: null }, // OK as is
      { rx: /\b(arrive|arrived|arriving|arrives)\s+to\s+(\w+)/gi, fix: '$1 at $2', rule: 'Preposition (arrive at/in)' },
      { rx: /\b(discuss|discusses|discussed|discussing)\s+about\b/gi, fix: '$1', rule: 'Preposition (no "about" after discuss)' },
      { rx: /\b(explain|explains|explained|explaining)\s+me\b/gi, fix: '$1 to me', rule: 'Preposition (explain to me)' },
      { rx: /\b(tell|told|telling|tells)\s+to\s+(me|him|her|us|them|you)\b/gi, fix: '$1 $2', rule: 'Preposition (tell + object, no "to")' },
      { rx: /\b(suggest|suggested|suggests|suggesting)\s+me\b/gi, fix: '$1 to me', rule: 'Preposition (suggest to)' },
      { rx: /\b(advice|advised|advises|advising)\s+to\s+me\b/gi, fix: 'advised me', rule: 'Preposition (advise me)' }
    ];
    prepRules.forEach(function (item) {
      if (!item.rule || !item.fix) return;
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        var fix = item.fix.replace(/\$1/g, h.groups[1] || '').replace(/\$2/g, h.groups[2] || '');
        push('grammar', 'major', item.rule,
          '"' + h.match + '" — try "' + fix + '".',
          fix, h.index, h.match.length);
      });
    });

    // ---- Article "the" for specific unique entities ----
    var theEntities = [
      { rx: /\b(?:^|[^\w])(?:in|on|to|from|across|throughout|via)\s+(Internet|World\s+Wide\s+Web|web|United\s+States|United\s+Kingdom|UK|US|USA|EU|UN|Netherlands|Philippines|Sahara|Amazon|Atlantic|Pacific|Mediterranean)\b/g,
        rule: 'Missing article "the"' }
    ];
    theEntities.forEach(function (item) {
      indexOfWithRegex(text, item.rx).forEach(function (h) {
        // Skip if "the" already precedes the entity within the captured group.
        var match = h.match;
        if (/\bthe\b/i.test(match)) return;
        push('grammar', 'minor', item.rule,
          '"' + match.trim() + '" — this proper noun normally takes "the".',
          null, h.index, h.match.length);
      });
    });

    // ---- Wrong relative pronoun ----
    // "the person which" → who; "the city / book / car who" → which.
    indexOfWithRegex(text, /\b(person|people|man|woman|boy|girl|student|teacher|child|children|friend|colleague|family|parent|parents|sister|brother|mother|father|writer|author|doctor|driver|guest|host|customer)\s+which\b/gi).forEach(function (h) {
      push('grammar', 'major', 'Relative pronoun (who, not which)',
        '"' + h.match + '" — use "who" for people, not "which".',
        h.groups[1] + ' who', h.index, h.match.length);
    });
    indexOfWithRegex(text, /\b(city|country|town|book|car|building|object|item|thing|machine|computer|phone|product|company|business|school|company|university|government|policy|idea|reason|method|system|technology|movie|film|song|website|app)\s+who\b/gi).forEach(function (h) {
      push('grammar', 'major', 'Relative pronoun (which/that, not who)',
        '"' + h.match + '" — use "which" or "that" for things, not "who".',
        h.groups[1] + ' which', h.index, h.match.length);
    });

    // ---- Tense consistency (paragraph-level) ----
    // Lightweight heuristic: in each paragraph, count past-tense and
    // present-tense verb signatures. If both are common and not in a
    // "narrative + commentary" pattern, flag the paragraph.
    var pastIndicators = /\b(was|were|had|did|went|came|saw|took|gave|made|said|told|got|knew|thought|felt|found|left|kept|brought|wrote|spoke|broke|chose|drove|grew|ate|forgot|ran|spent|swore|won|wore|began|stood|sat|met|put|cut|set|paid|sold|lost|lived|worked|played|tried|wanted|needed|liked|loved|believed|noticed|seemed|appeared|happened|continued|remained|stayed|opened|closed|started|stopped|asked|answered|replied|decided|discovered|realised|realized|considered|enjoyed|hated|preferred|expected|hoped|wished|allowed|prevented|caused|affected|increased|decreased|improved|reduced|changed|developed|created|provided|required|teached|learned|learnt|showed|tested|used|added|removed|moved)\b/gi;
    var presentIndicators = /\b(is|are|am|do|does|has|have|goes|comes|sees|takes|gives|makes|says|tells|gets|knows|thinks|feels|finds|leaves|keeps|brings|writes|speaks|breaks|chooses|drives|grows|eats|forgets|runs|spends|swears|wins|wears|begins|stands|sits|meets|puts|cuts|sets|pays|sells|loses|lives|works|plays|tries|wants|needs|likes|loves|believes|notices|seems|appears|happens|continues|remains|stays|opens|closes|starts|stops|asks|answers|replies|decides|discovers|realises|realizes|considers|enjoys|hates|prefers|expects|hopes|wishes|allows|prevents|causes|affects|increases|decreases|improves|reduces|changes|develops|creates|provides|requires|teaches|learns|shows|tests|uses|adds|removes|moves)\b/gi;
    var paraText = text.split(/\n{1,}/);
    var paraStart = 0;
    paraText.forEach(function (para) {
      var paraTrim = para.trim();
      if (paraTrim.length < 80) { paraStart += para.length + 1; return; }
      var past = (paraTrim.match(pastIndicators) || []).length;
      var pres = (paraTrim.match(presentIndicators) || []).length;
      // Both must be substantial AND roughly balanced for it to look like
      // accidental switching (not deliberate narrative+commentary).
      if (past >= 4 && pres >= 4 && Math.min(past, pres) / Math.max(past, pres) > 0.45) {
        var idx = text.indexOf(paraTrim, paraStart);
        if (idx >= 0) {
          push('grammar', 'minor', 'Tense consistency',
            'This paragraph mixes ' + past + ' past-tense and ' + pres + ' present-tense verbs. Pick one tense and stay with it (unless you are deliberately contrasting times).',
            null, idx, Math.min(paraTrim.length, 80));
        }
      }
      paraStart += para.length + 1;
    });

    return issues;
  }

  // ---------------- statistics ----------------
  function computeStatistics(text) {
    var trimmed = String(text || '').trim();
    var sentences = splitSentences(trimmed);
    var words = wordsOf(trimmed);
    var totalWords = words.length;
    var totalSentences = sentences.length;
    var paragraphs = trimmed ? trimmed.split(/\n{1,}/).map(function (p) { return p.trim(); }).filter(Boolean) : [];
    var sentenceLengths = sentences.map(function (s) { return countWords(s); });
    var avgSentenceLen = totalSentences ? (totalWords / totalSentences) : 0;
    var sentenceLenStdDev = 0;
    if (totalSentences > 1) {
      var mean = avgSentenceLen;
      var variance = sentenceLengths.reduce(function (acc, n) { return acc + (n - mean) * (n - mean); }, 0) / totalSentences;
      sentenceLenStdDev = Math.sqrt(variance);
    }
    var unique = {};
    var freq = {};
    words.forEach(function (w) {
      unique[w] = true;
      if (!STOP_WORDS[w] && w.length > 2) freq[w] = (freq[w] || 0) + 1;
    });
    var lexicalDiversity = totalWords ? Object.keys(unique).length / totalWords : 0;
    var topRepeats = Object.keys(freq)
      .map(function (w) { return { word: w, count: freq[w] }; })
      .filter(function (entry) { return entry.count >= 4 && entry.word.length > 3; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 6);
    var lowerText = trimmed.toLowerCase();
    var transitionsUsed = TRANSITION_WORDS.filter(function (t) {
      var rx = new RegExp('(^|[^a-z])' + t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-z]|$)', 'i');
      return rx.test(lowerText);
    });
    return {
      totalWords: totalWords,
      totalSentences: totalSentences,
      totalParagraphs: paragraphs.length,
      avgSentenceLen: Math.round(avgSentenceLen * 10) / 10,
      sentenceLenStdDev: Math.round(sentenceLenStdDev * 10) / 10,
      lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000,
      uniqueWords: Object.keys(unique).length,
      topRepeats: topRepeats,
      transitionsUsed: transitionsUsed,
      sentenceLengths: sentenceLengths
    };
  }

  // ---------------- LanguageTool ----------------
  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('fetch not supported'));
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    options = options || {};
    if (controller) options.signal = controller.signal;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);
    return fetch(url, options).then(function (res) { clearTimeout(timer); return res; },
                                    function (err) { clearTimeout(timer); throw err; });
  }

  function callLanguageTool(text) {
    if (!text || !text.trim()) return Promise.resolve([]);
    var truncated = text.length > LT_MAX_CHARS ? text.slice(0, LT_MAX_CHARS) : text;
    var body = 'text=' + encodeURIComponent(truncated) +
               '&language=' + encodeURIComponent(LT_LANGUAGE) +
               '&enabledOnly=false';
    return fetchWithTimeout(LT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }, LT_TIMEOUT_MS).then(function (res) {
      if (!res.ok) throw new Error('LanguageTool HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var matches = (data && data.matches) || [];
      return matches.map(function (m) {
        var rule = m.rule || {};
        var category = (rule.category && rule.category.name) || 'Grammar';
        var lowCat = category.toLowerCase();
        var kind = 'grammar';
        if (lowCat.indexOf('typograph') >= 0 || lowCat.indexOf('punctuation') >= 0 || lowCat.indexOf('capitalisation') >= 0 || lowCat.indexOf('capitalization') >= 0) kind = 'mechanics';
        else if (lowCat.indexOf('style') >= 0 || lowCat.indexOf('redundanc') >= 0 || lowCat.indexOf('register') >= 0) kind = 'style';
        var first = (m.replacements || [])[0];
        var ruleLabel = first && first.value ? 'Replace with' : (rule.description || category);
        return {
          kind: kind,
          severity: (rule.issueType === 'misspelling' || lowCat.indexOf('grammar') >= 0) ? 'major' : 'minor',
          rule: ruleLabel,
          message: m.message || rule.description || category,
          replacement: first && first.value ? first.value : null,
          offset: m.offset || 0,
          length: m.length || 0,
          source: 'languagetool'
        };
      });
    });
  }

  // ---------------- GrammarBot (second free grammar API) ----------------
  // Public endpoint mirrors the LanguageTool match schema. Free tier allows
  // ~100 requests per IP per day; if it fails we just degrade silently.
  var GB_ENDPOINT = 'https://www.grammarbot.io/v2/check';
  function callGrammarBot(text) {
    if (!text || !text.trim()) return Promise.resolve([]);
    var truncated = text.length > LT_MAX_CHARS ? text.slice(0, LT_MAX_CHARS) : text;
    var body = 'text=' + encodeURIComponent(truncated) + '&language=en-US';
    return fetchWithTimeout(GB_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }, LT_TIMEOUT_MS).then(function (res) {
      if (!res.ok) throw new Error('GrammarBot HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var matches = (data && data.matches) || [];
      return matches.map(function (m) {
        var rule = m.rule || {};
        var category = (rule.category && rule.category.name) || 'Grammar';
        var lowCat = String(category).toLowerCase();
        var kind = 'grammar';
        if (lowCat.indexOf('typograph') >= 0 || lowCat.indexOf('punctuation') >= 0 || lowCat.indexOf('capital') >= 0) kind = 'mechanics';
        else if (lowCat.indexOf('style') >= 0 || lowCat.indexOf('redundanc') >= 0) kind = 'style';
        var first = (m.replacements || [])[0];
        return {
          kind: kind,
          severity: 'major',
          rule: first && first.value ? 'Replace with' : (rule.description || category),
          message: m.message || rule.description || category,
          replacement: first && first.value ? first.value : null,
          offset: m.offset || 0,
          length: m.length || 0,
          source: 'grammarbot'
        };
      });
    });
  }

  // ---------------- analyze (multi-engine) ----------------
  // Runs every available grammar engine in parallel and merges the results.
  // Per-engine status (success / failure / issue count) is returned with the
  // report so we can show the student exactly which checkers ran.
  function analyzeText(text, opts) {
    opts = opts || {};
    text = String(text || '');
    var stats = computeStatistics(text);
    var localIssues = runHeuristicChecks(text);

    function runEngine(name, factory) {
      var t0 = (window.performance && performance.now ? performance.now() : Date.now());
      var p;
      try { p = factory(); } catch (e) { p = Promise.reject(e); }
      return Promise.resolve(p).then(function (issues) {
        return { name: name, ok: true, issues: issues || [], ms: Math.round(((window.performance && performance.now ? performance.now() : Date.now()) - t0)) };
      }, function (err) {
        return { name: name, ok: false, issues: [], error: (err && err.message) || String(err), ms: Math.round(((window.performance && performance.now ? performance.now() : Date.now()) - t0)) };
      });
    }

    var jobs = [
      runEngine('Local NLP rules', function () { return localIssues; })
    ];
    if (opts.useLanguageTool !== false) {
      jobs.push(runEngine('LanguageTool', function () { return callLanguageTool(text); }));
      jobs.push(runEngine('GrammarBot',   function () { return callGrammarBot(text); }));
    }

    return Promise.all(jobs).then(function (results) {
      var merged = [];
      var seen = {};
      results.forEach(function (r) {
        (r.issues || []).forEach(function (i) {
          var key = i.offset + ':' + i.length + ':' + (i.rule || '') + ':' + (i.replacement || '');
          if (seen[key]) return;
          seen[key] = true;
          merged.push(i);
        });
      });
      merged.sort(function (a, b) { return a.offset - b.offset; });
      var counter = 1;
      merged.forEach(function (i) { i.id = 'iss-' + (counter++); });
      var engineStatus = results.map(function (r) {
        return { name: r.name, ok: r.ok, count: (r.issues || []).length, error: r.error || '', ms: r.ms };
      });
      return {
        stats: stats,
        issues: merged,
        engineStatus: engineStatus,
        languageToolUsed: results.some(function (r) { return r.name === 'LanguageTool' && r.ok && r.issues.length > 0; }),
        text: text
      };
    });
  }

  // ---------------- IELTS band estimator ----------------
  // Returns the four official IELTS Writing criteria on a 1.0-9.0 scale (in
  // half-band steps), plus an overall band (average of the four, rounded to
  // the nearest 0.5 — matches the official rounding rule).
  //
  // The estimator is heuristic — based on objective text features — and is
  // clearly labelled as such in the UI. It cannot read meaning, so Task
  // Response is conservative; we credit observable structural signals
  // (length, paragraphs, opening/conclusion markers) and dock for obvious
  // problems (under-length, no body paragraphs).
  // Clamped to [0, 9] in half-band steps. 0 is reserved for "did not attempt".
  function roundHalf(n) { return Math.max(0, Math.min(9, Math.round(n * 2) / 2)); }

  // Academic Word List (Coxhead's AWL) — sublist 1+2 condensed to high-yield
  // forms. Used as a coarse "lexical sophistication" signal.
  var AWL_ROOTS = [
    'analy', 'approach', 'area', 'assess', 'assum', 'authorit', 'avail', 'benefit',
    'concept', 'consist', 'constitut', 'context', 'contract', 'creat', 'data',
    'defin', 'deriv', 'distribut', 'econom', 'environ', 'establish', 'estim',
    'evalu', 'evid', 'export', 'factor', 'financ', 'formul', 'function', 'identif',
    'income', 'indicat', 'individu', 'interpret', 'involv', 'issue', 'labour',
    'legal', 'legislat', 'major', 'method', 'occur', 'percent', 'period', 'policy',
    'principl', 'proceed', 'process', 'require', 'research', 'respons', 'role',
    'section', 'sector', 'signific', 'similar', 'source', 'specific', 'structur',
    'theor', 'vari', 'achiev', 'acquir', 'administr', 'affect', 'appropr', 'aspect',
    'assist', 'categor', 'chapter', 'commiss', 'community', 'complex', 'comput',
    'conclud', 'conduct', 'consequ', 'construct', 'consum', 'credit', 'cultur',
    'design', 'distinct', 'element', 'equat', 'eviden', 'feature', 'final',
    'focus', 'impact', 'injure', 'institut', 'invest', 'item', 'journal',
    'maintain', 'normal', 'obtain', 'particip', 'perceiv', 'positive', 'potential',
    'previous', 'primary', 'purchase', 'range', 'reaction', 'register', 'reli',
    'remove', 'scheme', 'sequenc', 'sex', 'shift', 'specifi', 'sufficient', 'task',
    'technic', 'technique', 'technology', 'valid', 'volume'
  ];
  function awlCoverage(words) {
    if (!words.length) return 0;
    var hits = 0;
    var seen = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      for (var k = 0; k < AWL_ROOTS.length; k++) {
        if (w.indexOf(AWL_ROOTS[k]) === 0) {
          if (!seen[AWL_ROOTS[k]]) hits++;
          seen[AWL_ROOTS[k]] = true;
          break;
        }
      }
    }
    return hits;
  }

  // Words a Band 6 student over-relies on. Penalise heavy reuse — they
  // signal weak lexical resource.
  var BASIC_WORDS = ['good', 'bad', 'big', 'small', 'nice', 'thing', 'things', 'people', 'a lot', 'lots'];

  // Heuristic check for a "conclusion" paragraph — looks for explicit
  // signposts in the last paragraph.
  function hasConclusionSignal(text) {
    if (!text) return false;
    var paras = text.split(/\n{1,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (paras.length < 2) return false;
    var last = paras[paras.length - 1].toLowerCase();
    return /\b(in conclusion|to conclude|to sum up|overall|in summary|in short|all things considered)\b/.test(last);
  }
  function hasIntroductionSignal(text) {
    if (!text) return false;
    var paras = text.split(/\n{1,}/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paras.length) return false;
    var first = paras[0].toLowerCase();
    // Very loose — a real intro reframes the prompt. We accept "this essay
    // will / it is often said / nowadays / in recent years" style openers.
    return /\b(this essay|in recent years|nowadays|it is often said|some people (?:argue|believe)|there is no doubt|it is widely)\b/.test(first);
  }

  function computeIeltsBands(task) {
    var stats = task.stats || {};
    var issues = task.issues || [];
    var text = task.text || '';
    var target = task.target || 250;

    var grammarErrors = issues.filter(function (i) { return i.kind === 'grammar' && i.severity === 'major'; }).length;
    var mechErrors    = issues.filter(function (i) { return i.kind === 'mechanics'; }).length;
    var styleNotes    = issues.filter(function (i) { return i.kind === 'style'; }).length;

    var words = (stats.totalWords || 0);

    // ---- "Did not attempt" — Band 0 across the board ----
    // An empty task (no text, or only whitespace) means the student did not
    // attempt this part of the exam. IELTS marks this as Band 0 on every
    // criterion. We do this before any other computation so the heuristic
    // formulas can't accidentally lift the score above zero.
    if (!text || !text.trim() || words === 0) {
      return {
        tr: 0, cc: 0, lr: 0, gra: 0, overall: 0,
        errorDensity: 0, awl: 0, basicReuse: 0, complexSentenceRatio: 0,
        empty: true,
        notes: {
          tr: 'No response written. Task Achievement is 0 — you must attempt every task.',
          cc: 'No response to assess.',
          lr: 'No vocabulary to assess.',
          gra: 'No grammar to assess.'
        }
      };
    }

    // ---- Very short attempts are capped low across all criteria ----
    // A handful of words can't demonstrate any of the four criteria, so we
    // cap them aggressively. This stops a 1-word answer from accidentally
    // pulling a 5.0 average from the formulas below.
    var veryShortCap = null;
    if (words <= 10)      veryShortCap = 1.5;
    else if (words <= 20) veryShortCap = 2.5;
    else if (words <= 40) veryShortCap = 3.5;

    var sentences = (stats.totalSentences || 0);
    var paragraphs = (stats.totalParagraphs || 0);
    var transitions = (stats.transitionsUsed || []).length;
    var avgSent = stats.avgSentenceLen || 0;
    var sentVar = stats.sentenceLenStdDev || 0;
    var diversity = stats.lexicalDiversity || 0;
    var basicReuse = (stats.topRepeats || []).filter(function (r) {
      return BASIC_WORDS.indexOf(r.word.toLowerCase()) >= 0;
    }).length;
    var awl = awlCoverage(wordsOf(text));
    var errorDensity = words ? (grammarErrors + mechErrors) / words * 100 : 0;  // errors per 100 words
    var complexSentenceRatio = 0;
    if (sentences) {
      var complexHits = (text.match(/\b(although|though|because|since|while|whereas|whilst|if|unless|when|whenever|after|before|despite|in spite of|provided that|so that|even though|even if|so as to)\b/gi) || []).length;
      complexSentenceRatio = Math.min(1, complexHits / sentences);
    }

    // ---- Task Response (TR) ----
    // Anchors: meets word count, has multiple paragraphs, has introduction
    // and conclusion signposts. We cannot judge whether the response
    // *answers the prompt*, so cap heuristic TR at 7.5.
    var tr = 5.0;
    if (words >= target)        tr += 1.0;
    else if (words >= target - 30) tr += 0.5;
    else if (words < target - 60)  tr -= 1.0;
    if (paragraphs >= 4)        tr += 1.0;
    else if (paragraphs >= 3)   tr += 0.5;
    else if (paragraphs <= 1 && words >= 100) tr -= 1.0;
    if (hasIntroductionSignal(text)) tr += 0.5;
    if (hasConclusionSignal(text))   tr += 0.5;
    tr = Math.min(7.5, tr);
    if (words < 50)             tr = Math.min(tr, 4.0);  // very short answers are capped low

    // ---- Coherence & Cohesion (CC) ----
    var cc = 5.0;
    if (paragraphs >= 4)        cc += 1.0;
    else if (paragraphs >= 3)   cc += 0.5;
    else if (paragraphs <= 1 && words >= 100) cc -= 1.0;
    if (transitions >= 6)       cc += 1.5;
    else if (transitions >= 4)  cc += 1.0;
    else if (transitions >= 2)  cc += 0.5;
    else if (words >= 150)      cc -= 0.5;
    if (hasConclusionSignal(text)) cc += 0.5;
    cc = Math.min(8.5, cc);

    // ---- Lexical Resource (LR) ----
    var lr = 5.0;
    if (diversity >= 0.65)      lr += 1.5;
    else if (diversity >= 0.55) lr += 1.0;
    else if (diversity >= 0.45) lr += 0.5;
    else if (diversity < 0.35 && words >= 100) lr -= 0.5;
    if (awl >= 12)              lr += 1.5;
    else if (awl >= 8)          lr += 1.0;
    else if (awl >= 5)          lr += 0.5;
    if (basicReuse >= 3)        lr -= 0.5;
    // Spelling errors heavily punish lexical resource.
    var spellingMistakes = issues.filter(function (i) { return /spelling/i.test(i.rule || ''); }).length;
    if (spellingMistakes >= 8)   lr -= 1.5;
    else if (spellingMistakes >= 5) lr -= 1.0;
    else if (spellingMistakes >= 2) lr -= 0.5;
    // Hard cap: a student misspelling ~5+ words cannot demonstrate Band 7
    // lexical resource regardless of diversity.
    if (spellingMistakes >= 8)  lr = Math.min(lr, 5.0);
    else if (spellingMistakes >= 5) lr = Math.min(lr, 5.5);
    lr = Math.min(8.5, lr);

    // ---- Grammatical Range & Accuracy (GRA) ----
    var gra = 5.0;
    if (errorDensity === 0 && words >= 150) gra += 2.0;
    else if (errorDensity < 1)  gra += 1.5;
    else if (errorDensity < 2)  gra += 1.0;
    else if (errorDensity < 4)  gra += 0.5;
    else if (errorDensity >= 8) gra -= 1.5;
    else if (errorDensity >= 6) gra -= 1.0;
    else if (errorDensity >= 4) gra -= 0.5;
    if (complexSentenceRatio >= 0.5) gra += 0.5;
    else if (complexSentenceRatio >= 0.3) gra += 0.25;
    if (sentVar >= 6)           gra += 0.5;
    if (avgSent >= 35 || (avgSent < 7 && words >= 100)) gra -= 0.5;

    // Bonus for demonstrating range: well-formed conditionals + relative
    // clauses + passive voice all signal grammatical range. Each is small
    // (0.25-0.5) and they cap GRA from creeping too high without errors.
    var rangeSignals = 0;
    if (/\bif\s+(I|you|he|she|it|we|they|\w+)\s+(were|had|did|could|would|might|should)\b/i.test(text)) rangeSignals++;
    if (/\b(who|which|that|whose|whom)\s+(is|are|was|were|has|have|had|do|does|did|will|would|can|could)\b/i.test(text)) rangeSignals++;
    if (/\b(is|are|was|were|been|being|be)\s+\w+(ed|en|wn|ought|aught|elt|ought|ept|ent|ost|old)\s+by\b/i.test(text)) rangeSignals++;
    if (/\b(having|while|after|before|despite|in\s+spite\s+of)\s+\w+ing\b/i.test(text)) rangeSignals++;
    if (rangeSignals >= 3)      gra += 0.5;
    else if (rangeSignals >= 2) gra += 0.25;

    // Hard caps for chronic errors — student cannot reach a Band 7 GRA
    // while making errors every ~10 words, even if structures look complex.
    if (errorDensity >= 8)  gra = Math.min(gra, 4.5);
    else if (errorDensity >= 6) gra = Math.min(gra, 5.5);
    gra = Math.min(8.5, gra);

    // Apply the very-short-essay cap to every criterion, not just TR.
    if (veryShortCap !== null) {
      tr  = Math.min(tr,  veryShortCap);
      cc  = Math.min(cc,  veryShortCap);
      lr  = Math.min(lr,  veryShortCap);
      gra = Math.min(gra, veryShortCap);
    }

    tr = roundHalf(tr);
    cc = roundHalf(cc);
    lr = roundHalf(lr);
    gra = roundHalf(gra);
    var overall = roundHalf((tr + cc + lr + gra) / 4);

    var notes = {
      tr: words < target ? ('Below the ' + target + '-word target (' + words + ' words).')
        : !hasConclusionSignal(text) ? 'Add a clear conclusion paragraph with a signpost ("In conclusion,…").'
        : paragraphs < 3 ? 'Use at least 3-4 paragraphs (intro, body, conclusion).'
        : 'Length and structure look on track.',
      cc: transitions < 3
            ? 'Use more linking words (however, moreover, for example, in conclusion).'
            : paragraphs < 3
              ? 'Break ideas into more paragraphs.'
              : 'Cohesion looks good.',
      lr: diversity < 0.45
            ? 'Vocabulary is repetitive — vary your nouns and verbs.'
            : awl < 5
              ? 'Try to use more academic vocabulary (e.g., establish, significant, factor, evidence).'
              : 'Good vocabulary range.',
      gra: errorDensity >= 4
            ? 'Frequent grammar/punctuation errors — proofread carefully.'
            : complexSentenceRatio < 0.2
              ? 'Use more complex sentences (although/because/while/if…).'
              : 'Grammar use is largely accurate.'
    };

    return {
      tr: tr, cc: cc, lr: lr, gra: gra, overall: overall,
      errorDensity: Math.round(errorDensity * 10) / 10,
      awl: awl, basicReuse: basicReuse,
      complexSentenceRatio: Math.round(complexSentenceRatio * 100) / 100,
      notes: notes
    };
  }

  // ---------------- grammar revision recommendations ----------------
  // Aggregates the student's mistakes into topical revision suggestions so
  // the Recommendations panel tells them which grammar areas to study.
  var GRAMMAR_TOPICS = {
    'Article (a/an)': {
      topic: 'Articles (a / an / the)',
      priority: 90,
      tip: 'Use "a" before consonant sounds, "an" before vowel sounds. Use "the" only when the noun is specific or already known to the reader.',
      study: [
        'Watch how IELTS Band 7+ essays mix "a/an/the" with general vs specific nouns.',
        'Practice: rewrite five paragraphs from a Cambridge IELTS book and underline every article.'
      ]
    },
    'Subject-verb agreement': {
      topic: 'Subject-Verb Agreement',
      priority: 95,
      tip: 'Singular subjects (he, she, it, the student) take singular verbs (has, does, is). Plural subjects (they, we, students) take plural verbs (have, do, are).',
      study: [
        'Drill present-simple conjugations for he/she/it vs they/we.',
        'Watch for tricky subjects: "everyone", "each of the", and compound subjects with "and" vs "or".'
      ]
    },
    'Possible spelling error': {
      topic: 'Spelling of common IELTS words',
      priority: 70,
      tip: 'Misspellings cost lexical resource marks. Memorise the high-frequency words IELTS testers see most often (government, environment, definitely, separate, receive, etc.).',
      study: [
        'Make a personal "spelling log" of every word the checker flags and review it daily.',
        'Use the Cambridge IELTS Vocabulary list and quiz yourself.'
      ]
    },
    'Capitalise "I"': {
      topic: 'Capitalisation',
      priority: 60,
      tip: 'Always capitalise the pronoun "I" and the first letter of every sentence, proper noun, and country/language name.',
      study: ['Re-read your draft and check every "i" is "I" and every sentence starts with a capital letter.']
    },
    'Sentence start capitalisation': {
      topic: 'Capitalisation',
      priority: 60,
      tip: 'Every new sentence after a full stop, question mark, or exclamation mark must start with a capital letter.',
      study: ['Slow down at every full stop and verify the next word starts with a capital.']
    },
    'Avoid contractions': {
      topic: 'Formal register (no contractions)',
      priority: 55,
      tip: 'IELTS essays are formal — write "do not" instead of "don\'t", "it is" instead of "it\'s". Contractions cost band marks.',
      study: ['Memorise: cannot, do not, does not, will not, is not, are not, it is, I am.']
    },
    'Remove extra spaces': {
      topic: 'Typing & spacing',
      priority: 30,
      tip: 'Use exactly one space between words and one space after punctuation.',
      study: ['Proof-read by reading aloud to catch double spaces and stuck-together words.']
    },
    'Repeated punctuation': {
      topic: 'Punctuation',
      priority: 40,
      tip: 'Use one full stop, one comma — never doubled. Avoid "!!" or "-" in academic writing.',
      study: ['Review when to use a comma vs a semicolon vs a full stop.']
    },
    'Missing space after punctuation': {
      topic: 'Punctuation',
      priority: 40,
      tip: 'Always put a space after a comma, full stop, semicolon, or colon.',
      study: ['Set spell-check on and read your draft from end to start to catch missing spaces.']
    },
    'Very long sentence': {
      topic: 'Sentence structure',
      priority: 50,
      tip: 'Long sentences (40+ words) usually contain run-on errors. Aim for a mix of short, medium, and complex sentences.',
      study: ['Practice splitting long sentences using full stops, semicolons, and linking words like "however" and "therefore".']
    }
  };

  function rankExamples(issues, limit) {
    return issues.slice(0, limit || 3).map(function (i) {
      return { offset: i.offset, length: i.length, replacement: i.replacement || '' };
    });
  }

  function generateRecommendations(task) {
    var recs = [];
    var nextId = 1;
    var issues = task.issues || [];
    var stats = task.stats || {};
    var target = task.target || 0;
    var seenTopic = {};

    // Group grammar/mechanics issues by rule.
    var byRule = {};
    issues.forEach(function (i) {
      var key = i.rule || 'Other';
      byRule[key] = byRule[key] || [];
      byRule[key].push(i);
    });

    // Map LanguageTool rule descriptions to broad categories too.
    function categoriseLTRule(rule) {
      var r = String(rule || '').toLowerCase();
      if (r.indexOf('article') >= 0) return 'Article (a/an)';
      if (r.indexOf('agreement') >= 0 || r.indexOf('subject') >= 0) return 'Subject-verb agreement';
      if (r.indexOf('spell') >= 0 || r.indexOf('typo') >= 0) return 'Possible spelling error';
      if (r.indexOf('comma') >= 0 || r.indexOf('punctuation') >= 0) return 'Repeated punctuation';
      if (r.indexOf('capital') >= 0) return 'Sentence start capitalisation';
      return null;
    }
    Object.keys(byRule).forEach(function (rule) {
      if (GRAMMAR_TOPICS[rule]) return;
      var mapped = categoriseLTRule(rule);
      if (mapped && GRAMMAR_TOPICS[mapped]) {
        byRule[mapped] = (byRule[mapped] || []).concat(byRule[rule]);
        delete byRule[rule];
      }
    });

    // Emit a recommendation card per matched topic.
    Object.keys(GRAMMAR_TOPICS).forEach(function (rule) {
      var hits = byRule[rule];
      if (!hits || !hits.length) return;
      var meta = GRAMMAR_TOPICS[rule];
      if (seenTopic[meta.topic]) {
        // Already emitted (e.g., Capitalisation has two source rules) — merge examples.
        var existing = seenTopic[meta.topic];
        existing.count += hits.length;
        existing.examples = existing.examples.concat(rankExamples(hits, 2)).slice(0, 4);
        return;
      }
      var rec = {
        id: 'rec-' + (nextId++),
        kind: 'recommendation',
        topic: meta.topic,
        priority: meta.priority,
        count: hits.length,
        tip: meta.tip,
        study: meta.study,
        examples: rankExamples(hits, 3),
        source: 'derived'
      };
      seenTopic[meta.topic] = rec;
      recs.push(rec);
    });

    // Statistics-driven recommendations (no inline issues backing them).
    if (target && stats.totalWords && stats.totalWords < target) {
      recs.push({
        id: 'rec-' + (nextId++),
        kind: 'recommendation',
        topic: 'Meet the IELTS word target',
        priority: 80,
        count: target - stats.totalWords,
        tip: 'You are ' + (target - stats.totalWords) + ' word(s) below the ' + target + '-word minimum. Under-length essays lose marks on Task Achievement.',
        study: ['Aim for 170-200 words on Task 1 and 270-290 words on Task 2 to have a safety margin.'],
        examples: [],
        source: 'stats'
      });
    }
    if (stats.totalParagraphs && stats.totalParagraphs < 3 && stats.totalWords >= 120) {
      recs.push({
        id: 'rec-' + (nextId++),
        kind: 'recommendation',
        topic: 'Paragraphing',
        priority: 75,
        count: stats.totalParagraphs,
        tip: 'You only have ' + stats.totalParagraphs + ' paragraph(s). A Band 7 IELTS essay typically has 4-5 short, well-organised paragraphs (introduction, 2-3 body paragraphs, conclusion).',
        study: ['Plan your essay first: one paragraph per main idea. Use a topic sentence at the start of each.'],
        examples: [],
        source: 'stats'
      });
    }
    if ((stats.transitionsUsed || []).length < 2 && stats.totalWords >= 120) {
      recs.push({
        id: 'rec-' + (nextId++),
        kind: 'recommendation',
        topic: 'Cohesive devices (linking words)',
        priority: 70,
        count: (stats.transitionsUsed || []).length,
        tip: 'You used very few linking words. Markers like "however", "moreover", "for example", "as a result", and "in conclusion" connect ideas and raise your Coherence band.',
        study: [
          'Memorise 10 connectors and use one in every paragraph.',
          'Avoid overusing "and" or "but" at sentence starts.'
        ],
        examples: [],
        source: 'stats'
      });
    }
    if ((stats.lexicalDiversity || 0) < 0.4 && stats.totalWords >= 100) {
      var repeats = (stats.topRepeats || []).slice(0, 3).map(function (r) { return r.word + ' (×' + r.count + ')'; }).join(', ');
      recs.push({
        id: 'rec-' + (nextId++),
        kind: 'recommendation',
        topic: 'Lexical resource (vocabulary range)',
        priority: 78,
        count: (stats.topRepeats || []).length,
        tip: 'Your vocabulary diversity is on the lower side' + (repeats ? ' — you repeated: ' + repeats + '.' : '.') + ' Replace repeated words with synonyms or paraphrases to lift Lexical Resource.',
        study: [
          'For each common noun you wrote, brainstorm 2-3 synonyms before the test.',
          'Use a thesaurus carefully — only swap words you fully understand in context.'
        ],
        examples: [],
        source: 'stats'
      });
    }

    recs.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
    return recs;
  }

  // ---------------- UI state ----------------
  var ui = {
    tasks: [],         // [{ key, label, target, text, issues, stats }]
    activeTask: null,  // 'task1' | 'task2'
    activeTab: 'all',  // 'all' | 'grammar' | 'recommendations'
    useLT: true,
    modal: null
  };

  function findTask(key) { for (var i = 0; i < ui.tasks.length; i++) if (ui.tasks[i].key === key) return ui.tasks[i]; return null; }
  function active() { return findTask(ui.activeTask); }
  function isGrammarIssue(i) { return i.kind === 'grammar'; }
  function isRecommendation(i) { return i.kind !== 'grammar'; }

  // ---------------- rendering ----------------
  function renderEssayHtml(task) {
    var text = task.text || '';
    // Empty-task: show a clear "did not attempt" notice instead of an
    // empty document area.
    if (!text.trim()) {
      return '<div class="ai-empty-task">' +
        '<div class="ai-empty-task-icon" aria-hidden="true">!</div>' +
        '<div class="ai-empty-task-title">No response written for this task</div>' +
        '<div class="ai-empty-task-body">' +
          'You did not write anything for <strong>' + escapeHtml(task.label || 'this task') + '</strong>. ' +
          'IELTS marks an unwritten task as <strong>Band 0</strong> on every criterion ' +
          '(Task Response, Coherence &amp; Cohesion, Lexical Resource, Grammar).' +
          ' Always attempt every task — even a short response earns marks.' +
        '</div>' +
      '</div>';
    }
    var sorted = task.issues.slice().sort(function (a, b) { return a.offset - b.offset; });
    var out = '';
    var pos = 0;
    var lastEnd = 0;
    sorted.forEach(function (iss) {
      if (iss.offset < lastEnd) return; // skip overlapping
      out += escapeHtml(text.slice(pos, iss.offset));
      var seg = text.slice(iss.offset, iss.offset + iss.length);
      var tipParts = [iss.rule || 'Issue'];
      if (iss.message) tipParts.push(iss.message);
      if (iss.replacement) tipParts.push('Suggest: ' + iss.replacement);
      var tip = tipParts.join(' — ');
      out += '<span class="ai-mark ai-mark-' + iss.kind + '" data-issue="' + iss.id + '" data-task="' + task.key + '" title="' + escapeHtml(tip) + '">' + escapeHtml(seg) + '</span>';
      pos = iss.offset + iss.length;
      lastEnd = pos;
    });
    out += escapeHtml(text.slice(pos));
    out = out.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<p>' + out + '</p>';
  }

  function trimWordBoundary(s, dir) {
    if (!s) return '';
    if (dir === 'left') {
      // keep only after the last space (so the cut starts on a word boundary)
      var idx = s.indexOf(' ');
      return idx >= 0 ? s.slice(idx + 1) : s;
    }
    var idx2 = s.lastIndexOf(' ');
    return idx2 >= 0 ? s.slice(0, idx2) : s;
  }

  function renderCardDiffHtml(task, iss) {
    var text = task.text || '';
    var before = text.slice(Math.max(0, iss.offset - 36), iss.offset);
    var after = text.slice(iss.offset + iss.length, Math.min(text.length, iss.offset + iss.length + 36));
    before = trimWordBoundary(before, 'left');
    after = trimWordBoundary(after, 'right');
    var segment = text.slice(iss.offset, iss.offset + iss.length);
    var diff = '<span class="ai-diff-strike">' + escapeHtml(segment) + '</span>';
    if (iss.replacement) {
      diff += ' <span class="ai-diff-add">' + escapeHtml(iss.replacement) + '</span>';
    }
    return escapeHtml(before) + diff + escapeHtml(after);
  }

  function renderCardHtml(task, iss) {
    var canAccept = !!iss.replacement && iss.replacement !== task.text.slice(iss.offset, iss.offset + iss.length);
    return '<article class="ai-card ai-card-' + iss.kind + '" data-card-id="' + iss.id + '" data-card-task="' + task.key + '">' +
      '<header class="ai-card-head"><span class="ai-card-dot ai-dot-' + iss.kind + '"></span><span class="ai-card-rule">' + escapeHtml(iss.rule || 'Issue') + '</span></header>' +
      '<div class="ai-card-diff">' + renderCardDiffHtml(task, iss) + '</div>' +
      (iss.message ? '<div class="ai-card-message">' + escapeHtml(iss.message) + '</div>' : '') +
      '<footer class="ai-card-actions">' +
        (canAccept ? '<button type="button" class="ai-btn ai-btn-accept" data-action="accept">✓ Accept</button>' : '') +
        '<button type="button" class="ai-btn ai-btn-ignore" data-action="ignore">Ignore</button>' +
        '<span class="ai-card-src">' + (iss.source === 'languagetool' ? 'LanguageTool' : 'Local NLP') + '</span>' +
      '</footer>' +
    '</article>';
  }

  function renderExampleSnippetHtml(task, ex) {
    var text = task.text || '';
    if (!text || ex.offset == null) return '';
    var before = text.slice(Math.max(0, ex.offset - 28), ex.offset);
    var after = text.slice(ex.offset + ex.length, Math.min(text.length, ex.offset + ex.length + 28));
    before = trimWordBoundary(before, 'left');
    after = trimWordBoundary(after, 'right');
    var segment = text.slice(ex.offset, ex.offset + ex.length);
    var line = (before ? '…' + escapeHtml(before) : '') +
               '<span class="ai-diff-strike">' + escapeHtml(segment) + '</span>' +
               (ex.replacement ? ' <span class="ai-diff-add">' + escapeHtml(ex.replacement) + '</span>' : '') +
               (after ? escapeHtml(after) + '…' : '');
    return '<li>' + line + '</li>';
  }

  function renderRecCardHtml(task, rec) {
    var examples = (rec.examples || []).map(function (ex) { return renderExampleSnippetHtml(task, ex); }).filter(Boolean).join('');
    var examplesBlock = examples
      ? '<div class="ai-rec-examples-title">From your essay:</div><ul class="ai-rec-examples">' + examples + '</ul>'
      : '';
    var studyHtml = (rec.study || []).map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('');
    var studyBlock = studyHtml ? '<div class="ai-rec-study-title">How to revise:</div><ul class="ai-rec-study">' + studyHtml + '</ul>' : '';
    var countLabel = rec.count ? '<span class="ai-rec-count">' + rec.count + (rec.source === 'derived' ? ' mistake' + (rec.count === 1 ? '' : 's') : '') + '</span>' : '';
    return '<article class="ai-rec-card" data-rec-id="' + rec.id + '" data-card-task="' + task.key + '">' +
      '<header class="ai-rec-head">' +
        '<span class="ai-rec-badge">📚 Revise</span>' +
        '<span class="ai-rec-topic">' + escapeHtml(rec.topic) + '</span>' +
        countLabel +
      '</header>' +
      '<div class="ai-rec-tip">' + escapeHtml(rec.tip || '') + '</div>' +
      examplesBlock +
      studyBlock +
      '<footer class="ai-rec-actions">' +
        '<button type="button" class="ai-btn ai-btn-ignore" data-action="dismiss-rec">Got it</button>' +
      '</footer>' +
    '</article>';
  }

  function renderCardsListHtml(task) {
    var html = '';
    var recs = task.recommendations || [];
    var nonGrammarIssues = task.issues.filter(isRecommendation);
    var grammarIssues = task.issues.filter(isGrammarIssue);

    if (ui.activeTab === 'grammar') {
      if (!grammarIssues.length) return '<div class="ai-empty">No grammar mistakes detected. Great work!</div>';
      return grammarIssues.map(function (iss) { return renderCardHtml(task, iss); }).join('');
    }

    if (ui.activeTab === 'recommendations') {
      if (!recs.length && !nonGrammarIssues.length) return '<div class="ai-empty">No revision topics or style notes for this task — your writing looks tidy.</div>';
      if (recs.length) html += recs.map(function (r) { return renderRecCardHtml(task, r); }).join('');
      if (nonGrammarIssues.length) html += nonGrammarIssues.map(function (i) { return renderCardHtml(task, i); }).join('');
      return html;
    }

    // 'all' tab — show topical revision recommendations first, then in-text issues.
    if (recs.length) html += recs.map(function (r) { return renderRecCardHtml(task, r); }).join('');
    if (task.issues.length) html += task.issues.map(function (i) { return renderCardHtml(task, i); }).join('');
    if (!html) html = '<div class="ai-empty">All clear! No suggestions for this task.</div>';
    return html;
  }

  function updateCounts() {
    var t = active(); if (!t) return;
    var recs = (t.recommendations || []).length;
    var grammar = t.issues.filter(isGrammarIssue).length;
    var nonGrammar = t.issues.filter(isRecommendation).length;
    var allCount = t.issues.length + recs;
    var recsTabCount = recs + nonGrammar;
    var modal = ui.modal;
    var setText = function (sel, txt) { var el = modal.querySelector(sel); if (el) el.textContent = txt; };
    setText('[data-tab="all"] .ai-tab-count', allCount);
    setText('[data-tab="grammar"] .ai-tab-count', grammar);
    setText('[data-tab="recommendations"] .ai-tab-count', recsTabCount);
    setText('.ai-suggestion-headline-count', allCount + ' suggestion' + (allCount === 1 ? '' : 's'));
    var acceptAllBtn = modal.querySelector('[data-accept-all]');
    var anyAcceptable = t.issues.some(function (i) { return !!i.replacement; });
    if (acceptAllBtn) acceptAllBtn.disabled = !anyAcceptable;
  }

  function formatBand(b) {
    // IELTS bands are reported in 0.5 steps; render with one decimal so 7
    // shows as 7.0.
    return (Math.round(b * 2) / 2).toFixed(1);
  }
  function bandTone(b) {
    if (b === 0)   return 'is-empty';
    if (b >= 7.0) return 'is-high';
    if (b >= 6.0) return 'is-mid';
    if (b >= 5.0) return 'is-low';
    return 'is-very-low';
  }
  function updateBands() {
    var t = active(); if (!t) return;
    var b = computeIeltsBands(t);
    t.bands = b;
    var modal = ui.modal;
    function setBand(criterion, value, note) {
      var card = modal.querySelector('[data-band="' + criterion + '"]');
      if (!card) return;
      card.setAttribute('class', 'ai-band ' + bandTone(value));
      card.setAttribute('data-band', criterion);
      var v = card.querySelector('.ai-band-val'); if (v) v.textContent = formatBand(value);
      var n = card.querySelector('.ai-band-note'); if (n) n.textContent = note || '';
    }
    setBand('tr',  b.tr,  b.notes.tr);
    setBand('cc',  b.cc,  b.notes.cc);
    setBand('lr',  b.lr,  b.notes.lr);
    setBand('gra', b.gra, b.notes.gra);
    var overall = modal.querySelector('.ai-band-overall');
    if (overall) {
      overall.setAttribute('class', 'ai-band-overall ' + bandTone(b.overall));
      var ov = overall.querySelector('.ai-band-overall-val');
      if (ov) ov.textContent = formatBand(b.overall);
      // Surface a clear "did not attempt" eyebrow when the essay is empty.
      var eyebrow = overall.querySelector('.ai-band-overall-eyebrow');
      if (eyebrow) {
        eyebrow.textContent = b.empty ? 'Did not attempt — Band 0' : 'Estimated overall band';
      }
    }
  }

  function updateTaskTabs() {
    var modal = ui.modal;
    var tabs = modal.querySelectorAll('[data-task-switch]');
    tabs.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-task-switch') === ui.activeTask);
    });
    var t = active();
    var title = modal.querySelector('.ai-doc-title');
    if (title && t) title.textContent = t.label;
  }

  function updateTabs() {
    var modal = ui.modal;
    modal.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === ui.activeTab);
    });
  }

  function updateEngineStatus() {
    var modal = ui.modal; if (!modal) return;
    var host = modal.querySelector('#aiEngineStatus'); if (!host) return;
    var t = active();
    var status = (t && t.engineStatus) || [];
    if (!status.length) { host.innerHTML = ''; return; }
    host.innerHTML = status.map(function (s) {
      var cls = 'ai-engine-pill ' + (s.ok ? 'is-ok' : 'is-fail');
      var label = escapeHtml(s.name);
      var details = s.ok
        ? '<span class="ai-engine-count">' + s.count + ' issue' + (s.count === 1 ? '' : 's') + '</span>'
        : '<span class="ai-engine-count ai-engine-fail">unavailable</span>';
      var tip = s.ok
        ? (s.name + ' returned ' + s.count + ' issue' + (s.count === 1 ? '' : 's') + ' in ' + s.ms + ' ms.')
        : (s.name + ' could not be reached: ' + (s.error || 'network error') + '.');
      return '<span class="' + cls + '" title="' + escapeHtml(tip) + '"><span class="ai-engine-name">' + label + '</span>' + details + '</span>';
    }).join('');
  }

  function rerender() {
    var modal = ui.modal; if (!modal) return;
    var t = active(); if (!t) return;
    var essay = modal.querySelector('.ai-doc-body');
    var cards = modal.querySelector('.ai-cards-list');
    if (essay) essay.innerHTML = renderEssayHtml(t);
    if (cards) cards.innerHTML = renderCardsListHtml(t);
    updateCounts();
    updateBands();
    updateTabs();
    updateTaskTabs();
    updateEngineStatus();
    updateLaunchBadge();
  }

  function updateLaunchBadge() {
    var t = active();
    if (!t) return;
    var btn = document.getElementById('aiFeedbackLaunch');
    if (!btn) return;
    var total = (t.issues || []).length + ((t.recommendations || []).length);
    var badge = btn.querySelector('.ai-launch-badge');
    if (!total) { if (badge) badge.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ai-launch-badge';
      btn.appendChild(badge);
    }
    badge.textContent = total;
  }

  // ---------------- mutations ----------------
  function applyEdit(task, issue) {
    var before = task.text.slice(0, issue.offset);
    var after = task.text.slice(issue.offset + issue.length);
    var rep = issue.replacement;
    task.text = before + rep + after;
    var delta = rep.length - issue.length;
    var endOfOld = issue.offset + issue.length;
    task.issues = task.issues
      .filter(function (i) { return i.id !== issue.id; })
      .map(function (i) {
        // strictly after — shift
        if (i.offset >= endOfOld) {
          var copy = Object.assign({}, i);
          copy.offset = i.offset + delta;
          return copy;
        }
        // strictly before — keep
        if (i.offset + i.length <= issue.offset) return i;
        // overlapping — drop (it's no longer valid)
        return null;
      })
      .filter(Boolean);
  }

  function acceptIssue(taskKey, issueId) {
    var task = findTask(taskKey); if (!task) return;
    var iss = null;
    for (var i = 0; i < task.issues.length; i++) if (task.issues[i].id === issueId) { iss = task.issues[i]; break; }
    if (!iss || !iss.replacement) return;
    applyEdit(task, iss);
    rerender();
  }

  function ignoreIssue(taskKey, issueId) {
    var task = findTask(taskKey); if (!task) return;
    task.issues = task.issues.filter(function (i) { return i.id !== issueId; });
    rerender();
  }

  function dismissRecommendation(taskKey, recId) {
    var task = findTask(taskKey); if (!task) return;
    task.recommendations = (task.recommendations || []).filter(function (r) { return r.id !== recId; });
    rerender();
  }

  function acceptAll(taskKey) {
    var task = findTask(taskKey); if (!task) return;
    // Apply from rightmost to leftmost so offsets stay valid for unprocessed ones.
    var actionable = task.issues.filter(function (i) { return !!i.replacement; }).sort(function (a, b) { return b.offset - a.offset; });
    actionable.forEach(function (iss) {
      // Re-find the issue in case overlapping edits removed it.
      var current = null;
      for (var i = 0; i < task.issues.length; i++) if (task.issues[i].id === iss.id) { current = task.issues[i]; break; }
      if (current) applyEdit(task, current);
    });
    rerender();
  }

  function copyRevised(taskKey) {
    var task = findTask(taskKey); if (!task) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(task.text).catch(function () {});
    }
  }

  // ---------------- modal scaffolding ----------------
  function buildModal() {
    var existing = document.getElementById('aiFeedbackModal');
    if (existing) { ui.modal = existing; return existing; }
    var modal = document.createElement('div');
    modal.id = 'aiFeedbackModal';
    modal.className = 'ai-feedback-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="ai-feedback-shell" role="dialog" aria-modal="true" aria-labelledby="aiFeedbackTitle">' +
        '<header class="ai-shell-head">' +
          '<div class="ai-shell-title-wrap">' +
            '<div class="ai-shell-eyebrow" id="aiFeedbackTitle">AI Writing Feedback</div>' +
            '<div class="ai-doc-title">Task 1</div>' +
          '</div>' +
          '<div class="ai-task-switcher" role="tablist">' +
            '<button type="button" class="ai-task-tab is-active" data-task-switch="task1" role="tab">Task 1</button>' +
            '<button type="button" class="ai-task-tab" data-task-switch="task2" role="tab">Task 2</button>' +
          '</div>' +
          '<button type="button" class="ai-shell-close" aria-label="Close">&times;</button>' +
        '</header>' +
        '<div class="ai-shell-main">' +
          '<section class="ai-doc-panel">' +
            '<div class="ai-doc-body" id="aiDocBody"><div class="ai-empty">Analysing…</div></div>' +
          '</section>' +
          '<aside class="ai-side-panel">' +
            '<div class="ai-side-tabs" role="tablist">' +
              '<button type="button" class="ai-side-tab is-active" data-tab="all" role="tab"><span>All</span><span class="ai-tab-count">0</span></button>' +
              '<button type="button" class="ai-side-tab" data-tab="grammar" role="tab"><span>Grammar</span><span class="ai-tab-count">0</span></button>' +
              '<button type="button" class="ai-side-tab" data-tab="recommendations" role="tab"><span>Recommendations</span><span class="ai-tab-count">0</span></button>' +
            '</div>' +
            '<div class="ai-suggestion-headline">' +
              '<span class="ai-suggestion-headline-count">0 suggestions</span>' +
              '<button type="button" class="ai-btn-accept-all" data-accept-all>✓ Accept all</button>' +
            '</div>' +
            '<div class="ai-engine-status" id="aiEngineStatus" aria-label="Grammar engines used"></div>' +
            '<div class="ai-cards-list" id="aiCardsList"></div>' +
          '</aside>' +
        '</div>' +
        '<footer class="ai-shell-foot">' +
          '<div class="ai-band-card">' +
            '<div class="ai-band-overall is-mid">' +
              '<div class="ai-band-overall-eyebrow">Estimated overall band</div>' +
              '<div class="ai-band-overall-val">--</div>' +
              '<div class="ai-band-overall-scale">/ 9.0</div>' +
            '</div>' +
            '<div class="ai-bands">' +
              '<div class="ai-band" data-band="tr">' +
                '<div class="ai-band-head"><span class="ai-band-tag">TR</span><span class="ai-band-label">Task Response</span></div>' +
                '<div class="ai-band-val">--</div>' +
                '<div class="ai-band-note"></div>' +
              '</div>' +
              '<div class="ai-band" data-band="cc">' +
                '<div class="ai-band-head"><span class="ai-band-tag">CC</span><span class="ai-band-label">Coherence &amp; Cohesion</span></div>' +
                '<div class="ai-band-val">--</div>' +
                '<div class="ai-band-note"></div>' +
              '</div>' +
              '<div class="ai-band" data-band="lr">' +
                '<div class="ai-band-head"><span class="ai-band-tag">LR</span><span class="ai-band-label">Lexical Resource</span></div>' +
                '<div class="ai-band-val">--</div>' +
                '<div class="ai-band-note"></div>' +
              '</div>' +
              '<div class="ai-band" data-band="gra">' +
                '<div class="ai-band-head"><span class="ai-band-tag">GRA</span><span class="ai-band-label">Grammar Range &amp; Accuracy</span></div>' +
                '<div class="ai-band-val">--</div>' +
                '<div class="ai-band-note"></div>' +
              '</div>' +
            '</div>' +
            '<div class="ai-band-disclaimer">' +
              '<i class="fas fa-info-circle" aria-hidden="true"></i> ' +
              'Heuristic estimate from text features (length, structure, vocabulary range, error density). ' +
              'Not an official examiner score.' +
            '</div>' +
          '</div>' +
          '<div class="ai-foot-actions">' +
            '<label class="ai-foot-toggle"><input type="checkbox" id="aiUseLT" checked> Use LanguageTool</label>' +
            '<button type="button" class="ai-foot-btn" data-action="copy">Copy revised</button>' +
            '<button type="button" class="ai-foot-btn ai-foot-btn-primary" data-action="rerun">Re-analyse</button>' +
          '</div>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(modal);
    ui.modal = modal;
    attachEvents();
    return modal;
  }

  function attachEvents() {
    var modal = ui.modal;
    if (modal.__aiBound) return;
    modal.__aiBound = true;
    modal.addEventListener('click', function (e) {
      var target = e.target;
      if (target === modal || target.classList.contains('ai-shell-close')) { closeModal(); return; }

      var taskBtn = target.closest && target.closest('[data-task-switch]');
      if (taskBtn) { ui.activeTask = taskBtn.getAttribute('data-task-switch'); rerender(); return; }

      var tabBtn = target.closest && target.closest('[data-tab]');
      if (tabBtn) { ui.activeTab = tabBtn.getAttribute('data-tab'); rerender(); return; }

      var recCard = target.closest && target.closest('.ai-rec-card');
      var actionBtn = target.closest && target.closest('[data-action]');
      if (recCard && actionBtn && actionBtn.getAttribute('data-action') === 'dismiss-rec') {
        var rtk = recCard.getAttribute('data-card-task');
        var rid = recCard.getAttribute('data-rec-id');
        dismissRecommendation(rtk, rid);
        return;
      }

      var card = target.closest && target.closest('.ai-card');
      if (card && actionBtn) {
        var act = actionBtn.getAttribute('data-action');
        var cid = card.getAttribute('data-card-id');
        var ctk = card.getAttribute('data-card-task');
        if (act === 'accept') acceptIssue(ctk, cid);
        else if (act === 'ignore') ignoreIssue(ctk, cid);
        return;
      }

      var acceptAllBtn = target.closest && target.closest('[data-accept-all]');
      if (acceptAllBtn) { acceptAll(ui.activeTask); return; }

      if (actionBtn) {
        var a = actionBtn.getAttribute('data-action');
        if (a === 'rerun') reanalyse();
        else if (a === 'copy') copyRevised(ui.activeTask);
      }

      var mark = target.closest && target.closest('.ai-mark');
      if (mark) {
        var id = mark.getAttribute('data-issue');
        var listCard = modal.querySelector('.ai-card[data-card-id="' + id + '"]');
        if (listCard) {
          listCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          listCard.classList.add('is-focused');
          setTimeout(function () { listCard.classList.remove('is-focused'); }, 1400);
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }

  function closeModal() {
    if (!ui.modal) return;
    ui.modal.classList.remove('is-open');
    ui.modal.setAttribute('aria-hidden', 'true');
  }

  function showLoading() {
    var modal = buildModal();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    var essay = modal.querySelector('.ai-doc-body');
    var cards = modal.querySelector('.ai-cards-list');
    if (essay) essay.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div><div>Analysing your writing for grammar mistakes…</div></div>';
    if (cards) cards.innerHTML = '';
  }

  var lastOpts = null;
  function reanalyse() {
    if (!lastOpts) return;
    openFeedback(lastOpts);
  }

  function openFeedback(opts) {
    opts = opts || {};
    if (typeof opts.getTasks !== 'function') return;
    lastOpts = opts;
    showLoading();
    var modal = ui.modal;
    var useLTBox = modal.querySelector('#aiUseLT');
    ui.useLT = useLTBox ? useLTBox.checked : true;
    var tasks = opts.getTasks();
    var jobs = tasks.map(function (t, idx) {
      return analyzeText(t.text || '', { useLanguageTool: ui.useLT }).then(function (rep) {
        var built = {
          key: 'task' + (idx + 1),
          label: t.label || ('Task ' + (idx + 1)),
          target: t.target || 0,
          text: rep.text,
          issues: rep.issues,
          stats: rep.stats,
          engineStatus: rep.engineStatus || []
        };
        built.recommendations = generateRecommendations(built);
        return built;
      });
    });
    Promise.all(jobs).then(function (built) {
      ui.tasks = built;
      // Pick the task with content; if both empty, just stay on task1.
      var firstWithContent = null;
      for (var i = 0; i < built.length; i++) if ((built[i].text || '').trim()) { firstWithContent = built[i].key; break; }
      ui.activeTask = firstWithContent || built[0].key;
      ui.activeTab = 'all';
      // Sync the task tab labels to reflect provided labels.
      modal.querySelectorAll('[data-task-switch]').forEach(function (btn, idx) {
        if (built[idx]) btn.textContent = 'Task ' + (idx + 1);
      });
      rerender();
    }).catch(function (err) {
      var body = modal.querySelector('.ai-doc-body');
      if (body) body.innerHTML = '<div class="ai-error">Sorry, the analyser could not run: ' + escapeHtml(err && err.message || String(err)) + '</div>';
    });
  }

  // ---------------- launch button ----------------
  function mountButton(opts) {
    opts = opts || {};
    if (typeof opts.getTasks !== 'function') return null;
    buildModal();
    var btn = document.getElementById('aiFeedbackLaunch');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'aiFeedbackLaunch';
    btn.className = 'ai-feedback-launch';
    btn.innerHTML = '<span aria-hidden="true">✨</span><span>AI Feedback</span>';
    btn.addEventListener('click', function () { openFeedback(opts); });
    (opts.host || document.body).appendChild(btn);
    return btn;
  }

  window.IELTSAIWritingFeedback = {
    analyzeText: analyzeText,
    computeStatistics: computeStatistics,
    runHeuristicChecks: runHeuristicChecks,
    mountButton: mountButton,
    openFeedback: openFeedback
  };
})();
