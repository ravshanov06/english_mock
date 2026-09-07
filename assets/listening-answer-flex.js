(function () {
  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, "'")
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ordinalize(day) {
    var number = Number(day);
    if (!number) return String(day);
    var mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) return number + 'th';
    var mod10 = number % 10;
    if (mod10 === 1) return number + 'st';
    if (mod10 === 2) return number + 'nd';
    if (mod10 === 3) return number + 'rd';
    return number + 'th';
  }

  function addVariant(set, value) {
    var normalized = normalizeText(value);
    if (normalized) set.add(normalized);
  }

  function addTimeVariants(set, value) {
    var normalized = normalizeText(value).replace(/\s+/g, '');
    // Strip optional trailing am/pm so "9:15am" and "9:15" produce the same set.
    var meridian = '';
    var meridianMatch = normalized.match(/^(.*?)(am|pm)$/);
    if (meridianMatch) {
      normalized = meridianMatch[1];
      meridian = meridianMatch[2];
    }
    var match = normalized.match(/^(\d{1,2})([:.])(\d{2})$/) || normalized.match(/^(\d{1,2})(\d{2})$/);
    if (!match) return;

    var hours = match[1];
    var minutes = match[3] || match[2];
    var paddedHours = hours.length === 1 ? ('0' + hours) : hours;

    var bases = [
      hours + ':' + minutes,
      hours + '.' + minutes,
      hours + minutes,
      paddedHours + ':' + minutes,
      paddedHours + '.' + minutes,
      paddedHours + minutes
    ];
    bases.forEach(function (base) {
      addVariant(set, base);
      if (meridian) {
        addVariant(set, base + meridian);
        addVariant(set, base + ' ' + meridian);
      }
    });
  }

  function addDateVariants(set, value) {
    var normalized = normalizeText(value).replace(/,/g, '');
    var tokens = normalized.split(' ').filter(Boolean);
    if (!tokens.length) return;

    var months = {
      january: 'january', jan: 'jan',
      february: 'february', feb: 'feb',
      march: 'march', mar: 'mar',
      april: 'april', apr: 'apr',
      may: 'may',
      june: 'june', jun: 'jun',
      july: 'july', jul: 'jul',
      august: 'august', aug: 'aug',
      september: 'september', sept: 'sept', sep: 'sep',
      october: 'october', oct: 'oct',
      november: 'november', nov: 'nov',
      december: 'december', dec: 'dec'
    };

    var monthToken = '';
    var monthIndex = -1;
    for (var i = 0; i < tokens.length; i++) {
      if (months[tokens[i]]) {
        monthToken = months[tokens[i]];
        monthIndex = i;
        break;
      }
    }
    if (!monthToken) return;

    var numberTokens = tokens
      .map(function (token) {
        return token.replace(/^(\d+)(st|nd|rd|th)$/i, '$1');
      })
      .filter(function (token) {
        return /^\d+$/.test(token);
      });

    if (!numberTokens.length) return;

    var day = '';
    var year = '';
    numberTokens.forEach(function (token) {
      var numeric = Number(token);
      if (!day && numeric >= 1 && numeric <= 31) {
        day = String(numeric);
        return;
      }
      if (!year && numeric >= 1000) {
        year = String(numeric);
      }
    });

    if (!day) return;

    var dayForms = [day, ordinalize(day)];
    dayForms.forEach(function (dayForm) {
      addVariant(set, dayForm + ' ' + monthToken);
      addVariant(set, monthToken + ' ' + dayForm);
      if (year) {
        addVariant(set, dayForm + ' ' + monthToken + ' ' + year);
        addVariant(set, monthToken + ' ' + dayForm + ' ' + year);
      }
    });

    if (year) {
      addVariant(set, day + '/' + monthToken + '/' + year);
      addVariant(set, monthToken + '/' + day + '/' + year);
    }
  }

  function buildVariants(value) {
    var set = new Set();
    var normalized = normalizeText(value);
    if (!normalized) return [];

    addVariant(set, normalized);
    addVariant(set, normalized.replace(/,/g, ''));
    addVariant(set, normalized.replace(/-/g, ' '));
    addVariant(set, normalized.replace(/-/g, ''));
    addVariant(set, normalized.replace(/\//g, ' '));
    addVariant(set, normalized.replace(/\//g, ''));
    addVariant(set, normalized.replace(/\./g, ':'));
    addVariant(set, normalized.replace(/:/g, '.'));
    addVariant(set, normalized.replace(/[:.]/g, ''));
    addVariant(set, normalized.replace(/(\d+)(st|nd|rd|th)\b/g, '$1'));
    addVariant(set, normalized.replace(/\s+/g, ''));

    addTimeVariants(set, normalized);
    addDateVariants(set, normalized);

    return Array.from(set);
  }

  function entriesFromRaw(rawCorrectAnswer) {
    if (Array.isArray(rawCorrectAnswer)) return rawCorrectAnswer;
    return String(rawCorrectAnswer || '').split('|');
  }

  function matches(userAnswer, rawCorrectAnswer) {
    var userVariants = buildVariants(userAnswer);
    if (!userVariants.length) return false;

    var compactUserLetters = normalizeText(userAnswer).replace(/[^a-z]/g, '').toUpperCase();
    var compactCorrectLetter = normalizeText(rawCorrectAnswer).replace(/[^a-z]/g, '').toUpperCase();
    if (/^[A-I]$/.test(compactCorrectLetter) && /^[A-I]{2,9}$/.test(compactUserLetters)) {
      return compactUserLetters.indexOf(compactCorrectLetter) !== -1;
    }

    var correctVariants = new Set();
    entriesFromRaw(rawCorrectAnswer).forEach(function (entry) {
      buildVariants(entry).forEach(function (variant) {
        correctVariants.add(variant);
      });
    });

    return userVariants.some(function (variant) {
      return correctVariants.has(variant);
    });
  }

  window.__listeningAnswerFlex = {
    normalize: normalizeText,
    variants: buildVariants,
    matches: matches
  };

  if (typeof window.matchesAnswer === 'function') {
    window.matchesAnswer = function (normalizedUser, rawCorrectAnswer) {
      return matches(normalizedUser, rawCorrectAnswer);
    };
  }
})();
