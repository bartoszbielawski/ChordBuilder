/*
 * ChordBuilder — teoria muzyki.
 * Dźwięki są reprezentowane literowo (litera + znak chromatyczny), dzięki
 * czemu pisownia jest poprawna enharmonicznie (np. F-dur ma B♭, a nie A♯).
 */
(function (global) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  // Liczba półtonów dla interwałów wielkich/czystych wg stopnia prostego (1..7).
  const MAJOR_SEMI = [0, 2, 4, 5, 7, 9, 11];
  const PERFECT_SIMPLE = [0, 3, 4]; // pryma, kwarta, kwinta (indeksy 0-based)

  const DEGREE_NAMES = [
    'pryma', 'sekunda', 'tercja', 'kwarta', 'kwinta', 'seksta', 'septyma',
    'oktawa', 'nona', 'decyma', 'undecyma', 'duodecyma', 'tercdecyma',
  ];

  const mod = (n, m) => ((n % m) + m) % m;

  /* ---------- Dźwięki ---------- */

  function makeNote(letter, acc) {
    return { letter, acc, pc: mod(LETTER_PC[letter] + acc, 12) };
  }

  function parseNote(str) {
    const m = /^([A-G])(#{1,2}|b{1,2})?$/.exec(str);
    if (!m) throw new Error('Nieprawidłowa nazwa dźwięku: ' + str);
    const acc = m[2] ? (m[2][0] === '#' ? 1 : -1) * m[2].length : 0;
    return makeNote(LETTERS.indexOf(m[1]), acc);
  }

  /** Klucz ASCII (do URL i selectów), np. "Bb", "F#". */
  function noteKey(n) {
    return LETTERS[n.letter] + (n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc));
  }

  /**
   * Nazwa do wyświetlenia.
   * notation: 'intl' (C D E F G A B) lub 'H' (polska/niemiecka: H = B, B = B♭).
   */
  function noteName(n, notation) {
    const accStr = n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc);
    if (notation === 'H' && n.letter === 6) {
      if (n.acc === 0) return 'H';
      if (n.acc === -1) return 'B';
      if (n.acc < -1) return 'B' + '♭'.repeat(-n.acc - 1);
      return 'H' + accStr;
    }
    return LETTERS[n.letter] + accStr;
  }

  /* ---------- Interwały ---------- */

  /** "b3", "#11", "bb7", "5" → { sym, deg, semi } */
  function parseInterval(sym) {
    const m = /^(b{1,2}|#{1,2})?(\d{1,2})$/.exec(sym);
    if (!m) throw new Error('Nieprawidłowy interwał: ' + sym);
    const deg = +m[2];
    const acc = m[1] ? (m[1][0] === '#' ? 1 : -1) * m[1].length : 0;
    const simple = mod(deg - 1, 7);
    const oct = Math.floor((deg - 1) / 7);
    return { sym, deg, semi: MAJOR_SEMI[simple] + 12 * oct + acc };
  }

  /** Pełny opis interwału na podstawie stopnia i liczby półtonów. */
  function describeInterval(deg, semi) {
    const simple = mod(deg - 1, 7);
    const oct = Math.floor((deg - 1) / 7);
    const base = MAJOR_SEMI[simple] + 12 * oct;
    let diff = semi - base;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    const perfect = PERFECT_SIMPLE.includes(simple);

    let quality, abbr;
    if (perfect) {
      ({ quality, abbr } = {
        '-2': { quality: 'podwójnie zmniejszona', abbr: 'dd' },
        '-1': { quality: 'zmniejszona', abbr: 'd' },
        '0': { quality: 'czysta', abbr: 'P' },
        '1': { quality: 'zwiększona', abbr: 'A' },
        '2': { quality: 'podwójnie zwiększona', abbr: 'AA' },
      }[diff] || { quality: '?', abbr: '?' });
    } else {
      ({ quality, abbr } = {
        '-3': { quality: 'podwójnie zmniejszona', abbr: 'dd' },
        '-2': { quality: 'zmniejszona', abbr: 'd' },
        '-1': { quality: 'mała', abbr: 'm' },
        '0': { quality: 'wielka', abbr: 'M' },
        '1': { quality: 'zwiększona', abbr: 'A' },
        '2': { quality: 'podwójnie zwiększona', abbr: 'AA' },
      }[diff] || { quality: '?', abbr: '?' });
    }

    const accSym = diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff);
    // Dla interwałów czystych/wielkich symbol bez znaku; dla małych „♭”.
    const symbol = (deg === 1 ? '1' : accSym + deg);
    let name = (DEGREE_NAMES[deg - 1] || deg + '.') + ' ' + quality;
    if (mod(semi, 12) === 6 && deg <= 7) name += ' (tryton)';
    return { deg, semi, diff, quality, abbr: abbr + deg, symbol, name };
  }

  /** Interwał (prosty, w górę) między dwoma dźwiękami literowymi. */
  function intervalBetween(a, b) {
    const deg = mod(b.letter - a.letter, 7) + 1;
    let semi = mod(b.pc - a.pc, 12);
    return describeInterval(deg, semi);
  }

  function transpose(n, iv) {
    const letter = mod(n.letter + iv.deg - 1, 7);
    const targetPc = mod(n.pc + iv.semi, 12);
    const acc = mod(targetPc - LETTER_PC[letter] + 6, 12) - 6;
    return makeNote(letter, acc);
  }

  /* ---------- Skale ---------- */

  const SCALES = [
    { id: 'major', name: 'Durowa (jońska)', ints: '1 2 3 4 5 6 7' },
    { id: 'minor', name: 'Molowa naturalna (eolska)', ints: '1 2 b3 4 5 b6 b7' },
    { id: 'harmonicMinor', name: 'Molowa harmoniczna', ints: '1 2 b3 4 5 b6 7' },
    { id: 'melodicMinor', name: 'Molowa melodyczna (jazzowa)', ints: '1 2 b3 4 5 6 7' },
    { id: 'dorian', name: 'Dorycka', ints: '1 2 b3 4 5 6 b7' },
    { id: 'phrygian', name: 'Frygijska', ints: '1 b2 b3 4 5 b6 b7' },
    { id: 'lydian', name: 'Lidyjska', ints: '1 2 3 #4 5 6 7' },
    { id: 'mixolydian', name: 'Miksolidyjska', ints: '1 2 3 4 5 6 b7' },
    { id: 'locrian', name: 'Lokrycka', ints: '1 b2 b3 4 b5 b6 b7' },
    { id: 'phrygianDominant', name: 'Frygijska dominantowa', ints: '1 b2 3 4 5 b6 b7' },
    { id: 'majorPentatonic', name: 'Pentatonika durowa', ints: '1 2 3 5 6' },
    { id: 'minorPentatonic', name: 'Pentatonika molowa', ints: '1 b3 4 5 b7' },
    { id: 'blues', name: 'Bluesowa', ints: '1 b3 4 b5 5 b7' },
    { id: 'wholeTone', name: 'Całotonowa', ints: '1 2 3 #4 #5 b7' },
  ].map((s) => ({ ...s, intervals: s.ints.split(' ').map(parseInterval) }));

  const scaleById = (id) => SCALES.find((s) => s.id === id) || SCALES[0];

  function buildScale(tonic, scaleId) {
    const scale = scaleById(scaleId);
    const notes = scale.intervals.map((iv) => ({ note: transpose(tonic, iv), iv }));
    return { scale, tonic, notes, pcs: new Set(notes.map((n) => n.note.pc)) };
  }

  /* ---------- Akordy ---------- */

  const CHORD_GROUPS = [
    { id: 'triad', name: 'Trójdźwięki' },
    { id: 'seventh', name: 'Akordy septymowe' },
    { id: 'ext', name: 'Akordy z dodanymi dźwiękami i rozszerzone' },
    { id: 'other', name: 'Inne' },
  ];

  const CHORD_TYPES = [
    // id, symbol, nazwa, grupa, interwały, [opcjonalne na gitarze]
    ['maj', '', 'durowy', 'triad', '1 3 5'],
    ['min', 'm', 'molowy', 'triad', '1 b3 5'],
    ['dim', '°', 'zmniejszony', 'triad', '1 b3 b5'],
    ['aug', '+', 'zwiększony', 'triad', '1 3 #5'],
    ['sus2', 'sus2', 'z sekundą zamiast tercji', 'triad', '1 2 5'],
    ['sus4', 'sus4', 'z kwartą zamiast tercji', 'triad', '1 4 5'],
    ['7', '7', 'dominantowy septymowy', 'seventh', '1 3 5 b7'],
    ['maj7', 'maj7', 'durowy z septymą wielką', 'seventh', '1 3 5 7'],
    ['m7', 'm7', 'molowy z septymą małą', 'seventh', '1 b3 5 b7'],
    ['m7b5', 'm7♭5', 'półzmniejszony (ø)', 'seventh', '1 b3 b5 b7'],
    ['dim7', '°7', 'zmniejszony septymowy', 'seventh', '1 b3 b5 bb7'],
    ['mMaj7', 'm(maj7)', 'molowy z septymą wielką', 'seventh', '1 b3 5 7'],
    ['augMaj7', '+maj7', 'zwiększony z septymą wielką', 'seventh', '1 3 #5 7'],
    ['aug7', '7♯5', 'zwiększony z septymą małą', 'seventh', '1 3 #5 b7'],
    ['7sus4', '7sus4', 'septymowy z kwartą', 'seventh', '1 4 5 b7'],
    ['6', '6', 'durowy z sekstą', 'ext', '1 3 5 6'],
    ['m6', 'm6', 'molowy z sekstą', 'ext', '1 b3 5 6'],
    ['add9', 'add9', 'durowy z dodaną noną', 'ext', '1 3 5 9'],
    ['madd9', 'm(add9)', 'molowy z dodaną noną', 'ext', '1 b3 5 9'],
    ['69', '6/9', 'durowy z sekstą i noną', 'ext', '1 3 5 6 9'],
    ['9', '9', 'dominantowy nonowy', 'ext', '1 3 5 b7 9'],
    ['maj9', 'maj9', 'durowy nonowy z septymą wielką', 'ext', '1 3 5 7 9'],
    ['m9', 'm9', 'molowy nonowy', 'ext', '1 b3 5 b7 9'],
    ['7b9', '7♭9', 'dominantowy z noną małą', 'ext', '1 3 5 b7 b9'],
    ['7s9', '7♯9', 'dominantowy z noną zwiększoną („Hendrix”)', 'ext', '1 3 5 b7 #9'],
    ['11', '11', 'dominantowy undecymowy', 'ext', '1 3 5 b7 9 11', ['5', '3']],
    ['m11', 'm11', 'molowy undecymowy', 'ext', '1 b3 5 b7 9 11', ['5', '9']],
    ['13', '13', 'dominantowy tercdecymowy (bez 11)', 'ext', '1 3 5 b7 9 13', ['5', '9']],
    ['maj13', 'maj13', 'durowy tercdecymowy (bez 11)', 'ext', '1 3 5 7 9 13', ['5', '9']],
    ['5', '5', 'kwintowy („power chord”)', 'other', '1 5'],
  ].map(([id, symbol, name, group, ints, optional]) => {
    const intervals = ints.split(' ').map(parseInterval);
    return {
      id, symbol, name, group, intervals,
      optional: optional || (intervals.length >= 4 ? ['5'] : []),
    };
  });

  const chordTypeById = (id) => CHORD_TYPES.find((t) => t.id === id) || CHORD_TYPES[0];

  /** Rola dźwięku w akordzie — do kolorowania. */
  function roleOf(deg) {
    const s = mod(deg - 1, 7) + 1;
    return { 1: 'root', 3: 'third', 5: 'fifth', 7: 'seventh' }[s] || 'ext';
  }

  function buildChord(root, typeId) {
    const type = chordTypeById(typeId);
    const notes = type.intervals.map((iv) => {
      const d = describeInterval(iv.deg, iv.semi);
      return { note: transpose(root, iv), iv, info: d, role: roleOf(iv.deg) };
    });
    return { root, type, notes, pcs: new Set(notes.map((n) => n.note.pc)) };
  }

  function chordSymbol(chord, notation) {
    return noteName(chord.root, notation) + chord.type.symbol;
  }

  /** Rozpoznaj typ akordu z listy półtonów od prymy (posortowanej). */
  function identifyType(semis) {
    const key = semis.join(',');
    return CHORD_TYPES.find((t) => t.intervals.map((i) => i.semi).join(',') === key) || null;
  }

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function romanNumeral(degreeIdx, type) {
    const minorThird = type.intervals.some((i) => i.deg === 3 && i.semi === 3);
    let r = ROMAN[degreeIdx];
    if (minorThird) r = r.toLowerCase();
    const suffix = {
      maj: '', min: '', dim: '°', aug: '+',
      '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7',
      mMaj7: '(maj7)', augMaj7: '+maj7', aug7: '+7',
    }[type.id];
    return r + (suffix !== undefined ? suffix : type.symbol);
  }

  /**
   * Akordy diatoniczne (budowane tercjami z dźwięków skali) —
   * tylko dla skal siedmiodźwiękowych.
   */
  function diatonicChords(sc, size) {
    if (sc.notes.length !== 7) return [];
    const out = [];
    for (let i = 0; i < 7; i++) {
      const idxs = [0, 2, 4, 6].slice(0, size).map((k) => (i + k) % 7);
      const root = sc.notes[i].note;
      const semis = idxs.map((j) => mod(sc.notes[j].note.pc - root.pc, 12));
      const type = identifyType(semis);
      if (!type) continue;
      out.push({ degree: i, roman: romanNumeral(i, type), chord: buildChord(root, type.id) });
    }
    return out;
  }

  /** Wszystkie znane akordy, których dźwięki w całości należą do skali. */
  function fittingChords(sc) {
    return sc.notes.map((sn, degree) => ({
      degree,
      root: sn.note,
      chords: CHORD_TYPES
        .map((t) => buildChord(sn.note, t.id))
        .filter((c) => [...c.pcs].every((pc) => sc.pcs.has(pc))),
    }));
  }

  /** Lista dźwięków akordu w danym przewrocie (rosnąco w półtonach). */
  function inversion(chord, inv) {
    const sorted = [...chord.notes].sort((a, b) => a.iv.semi - b.iv.semi);
    const k = Math.min(inv, sorted.length - 1);
    const moved = sorted.slice(0, k).map((n) => ({ ...n, offset: 12 }));
    const rest = sorted.slice(k).map((n) => ({ ...n, offset: 0 }));
    const seq = [...rest, ...moved];
    // Zapewnij kolejność rosnącą (dla rozszerzeń > oktawy).
    let prev = -Infinity;
    return seq.map((n) => {
      let s = n.iv.semi + n.offset;
      while (s <= prev) s += 12;
      prev = s;
      return { ...n, semiAbs: s };
    });
  }

  /* ---------- Gitara: wyszukiwanie chwytów ---------- */

  const TUNINGS = [
    { id: 'standard', name: 'Standardowy (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
    { id: 'halfDown', name: 'Pół tonu niżej (E♭ A♭ D♭ G♭ B♭ E♭)', midi: [39, 44, 49, 54, 58, 63] },
    { id: 'dropD', name: 'Drop D (D A D G B E)', midi: [38, 45, 50, 55, 59, 64] },
    { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
    { id: 'openG', name: 'Open G (D G D G B D)', midi: [38, 43, 50, 55, 59, 62] },
  ];
  const tuningById = (id) => TUNINGS.find((t) => t.id === id) || TUNINGS[0];

  /**
   * Szuka grywalnych chwytów: rozpiętość ≤ 4 progi, ≤ 4 palce (barré liczone
   * jako 1 palec), brak wytłumionych strun w środku, bas = zadany dźwięk.
   */
  function findVoicings(chord, bassPc, tuning, maxFret = 15) {
    const strings = tuning.midi;
    const allPcs = chord.pcs;
    const optionalPcs = new Set(
      chord.notes.filter((n) => chord.type.optional.includes(n.iv.sym)).map((n) => n.note.pc)
    );
    const required = [...allPcs].filter((pc) => !optionalPcs.has(pc) || pc === bassPc);
    const minStrings = Math.min(allPcs.size >= 4 ? 4 : 3, 6);
    const found = new Map();

    for (let start = 1; start <= maxFret - 3; start++) {
      const opts = strings.map((open) => {
        const o = [-1];
        if (start <= 3 && allPcs.has(mod(open, 12))) o.push(0);
        for (let f = start; f <= start + 3; f++) if (allPcs.has(mod(open + f, 12))) o.push(f);
        return o;
      });
      const cur = new Array(6);
      (function rec(s) {
        if (s === 6) return evaluate(cur.slice());
        for (const f of opts[s]) { cur[s] = f; rec(s + 1); }
      })(0);
    }

    function evaluate(frets) {
      const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
      if (sounding.length < minStrings) return;
      const lo = sounding[0], hi = sounding[sounding.length - 1];
      if (hi - lo + 1 !== sounding.length) return; // wytłumiona struna w środku
      if (mod(strings[lo] + frets[lo], 12) !== bassPc) return;
      const pcs = new Set(sounding.map((i) => mod(strings[i] + frets[i], 12)));
      if (!required.every((pc) => pcs.has(pc))) return;
      const fretted = frets.filter((f) => f > 0);
      const hasOpen = frets.some((f) => f === 0);
      let fingers = fretted.length, minF = 0, maxF = 0;
      if (fretted.length) {
        minF = Math.min(...fretted);
        maxF = Math.max(...fretted);
        if (maxF - minF > 3) return;
        // Puste struny tylko w pozycji otwartej (dźwięki do 4. progu).
        if (hasOpen && maxF > 4) return;
        // Barré: palec wskazujący leży od pierwszej struny na najniższym progu
        // aż do najwyższej brzmiącej struny — po drodze nic nie może być niżej.
        const first = frets.findIndex((f) => f === minF);
        const atMin = fretted.filter((f) => f === minF).length;
        const barreOk = atMin >= 2 && frets.slice(first, hi + 1).every((f) => f >= minF);
        if (barreOk) fingers = 1 + fretted.filter((f) => f > minF).length;
      }
      if (fingers > 4) return;
      const complete = pcs.size === allPcs.size;
      const openPosition = hasOpen && maxF <= 3;
      const score = (6 - sounding.length) * 1.2 + minF * 0.4 + fingers * 0.6 +
        (complete ? 0 : 1.5) - (openPosition ? 1 : 0);
      const key = frets.join(',');
      if (!found.has(key)) found.set(key, { frets, score, minF, complete, fingers });
    }

    // Usuń warianty, które są tylko „przyciętą” wersją pełniejszego chwytu.
    const list = [...found.values()];
    const sounding = (v) => v.frets.filter((f) => f >= 0).length;
    const pruned = list.filter((v) => !list.some((w) => w !== v &&
      sounding(w) > sounding(v) && (w.complete || !v.complete) &&
      v.frets.every((f, s) => f < 0 || w.frets[s] === f)));
    return pruned.sort((a, b) => a.score - b.score);
  }

  global.Theory = {
    LETTERS, SCALES, CHORD_TYPES, CHORD_GROUPS, TUNINGS,
    mod, makeNote, parseNote, noteKey, noteName,
    parseInterval, describeInterval, intervalBetween, transpose,
    scaleById, buildScale, chordTypeById, buildChord, chordSymbol,
    identifyType, diatonicChords, fittingChords, inversion,
    tuningById, findVoicings, roleOf,
  };
})(window);
