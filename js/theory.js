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
    const plQ = { czysta: 'cz', 'mała': 'm', wielka: 'w', 'zwiększona': 'zw', zmniejszona: 'zmn',
      'podwójnie zwiększona': '2zw', 'podwójnie zmniejszona': '2zmn' }[quality] || '?';
    return { deg, semi, diff, quality, abbr: abbr + deg, pl: deg + plQ, symbol, name };
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

  // char — dźwięk charakterystyczny (odróżniający od najbliższej skali dur/moll), mood — opis brzmienia.
  const SCALES = [
    { id: 'major', name: 'Durowa (jońska)', ints: '1 2 3 4 5 6 7', char: '7',
      mood: 'Jasna, stabilna. Septyma wielka (dźwięk prowadzący) ciągnie do toniki.' },
    { id: 'minor', name: 'Molowa naturalna (eolska)', ints: '1 2 b3 4 5 b6 b7', char: 'b6',
      mood: 'Smutna, poważna. Mała seksta odróżnia ją od doryckiej.' },
    { id: 'harmonicMinor', name: 'Molowa harmoniczna', ints: '1 2 b3 4 5 b6 7', char: '7',
      mood: 'Moll z podwyższoną septymą — daje durową dominantę (V) i „orientalną” sekundę zwiększoną ♭6–7.' },
    { id: 'melodicMinor', name: 'Molowa melodyczna (jazzowa)', ints: '1 2 b3 4 5 6 7', char: '6',
      mood: 'Moll z wielką sekstą i septymą — gładka melodycznie; w klasyce tylko w górę, w jazzie w obie strony.' },
    { id: 'dorian', name: 'Dorycka', ints: '1 2 b3 4 5 6 b7', char: '6',
      mood: 'Moll z jaśniejszą, wielką sekstą — brzmi mniej smutno; częsta w funku, jazzie i folku.' },
    { id: 'phrygian', name: 'Frygijska', ints: '1 b2 b3 4 5 b6 b7', char: 'b2',
      mood: 'Ciemny moll z małą sekundą — brzmienie hiszpańskie, metalowe.' },
    { id: 'lydian', name: 'Lidyjska', ints: '1 2 3 #4 5 6 7', char: '#4',
      mood: 'Najjaśniejsza: dur z kwartą zwiększoną — „marzycielska”, filmowa.' },
    { id: 'mixolydian', name: 'Miksolidyjska', ints: '1 2 3 4 5 6 b7', char: 'b7',
      mood: 'Dur z małą septymą — rockowa, bluesowa, bez silnego dźwięku prowadzącego.' },
    { id: 'locrian', name: 'Lokrycka', ints: '1 b2 b3 4 b5 b6 b7', char: 'b5',
      mood: 'Najciemniejsza: zmniejszona kwinta sprawia, że tonika jest niestabilna; rzadko używana.' },
    { id: 'phrygianDominant', name: 'Frygijska dominantowa', ints: '1 b2 3 4 5 b6 b7', char: '3',
      mood: 'V stopień molowej harmonicznej: frygijska z wielką tercją — flamenco, muzyka bliskowschodnia.' },
    { id: 'majorPentatonic', name: 'Pentatonika durowa', ints: '1 2 3 5 6',
      mood: 'Durowa bez półtonów (bez 4 i 7) — nie da się w niej zagrać „źle”; folk, country, pop.' },
    { id: 'minorPentatonic', name: 'Pentatonika molowa', ints: '1 b3 4 5 b7',
      mood: 'Molowa bez półtonów (bez 2 i ♭6) — podstawa solówek rockowych i bluesowych.' },
    { id: 'blues', name: 'Bluesowa', ints: '1 b3 4 b5 5 b7',
      mood: 'Pentatonika molowa z dodaną „blue note” ♭5.' },
    { id: 'wholeTone', name: 'Całotonowa', ints: '1 2 3 #4 #5 b7',
      mood: 'Same całe tony — brak centrum tonalnego, brzmienie „senne” (Debussy).' },
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
    // Dla akordów molowych mała litera już mówi „moll”: vi7, i6, ii9 (nie „im6”).
    const sym = minorThird && /^m(?!aj)/.test(type.symbol) ? type.symbol.slice(1) : type.symbol;
    return r + (suffix !== undefined ? suffix : sym);
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

  /**
   * Oznaczenie rzymskie dla akordu na dowolnym (także chromatycznym) stopniu:
   * deg — stopień 1..7, diff — przesunięcie względem skali durowej (−1 = ♭).
   */
  function romanFor(deg, diff, type) {
    const prefix = diff < 0 ? '♭'.repeat(-diff) : '♯'.repeat(Math.max(0, diff));
    return prefix + romanNumeral(mod(deg - 1, 7), type);
  }

  /* ---------- Progresje ---------- */

  // Kroki: "interwał od toniki:typ akordu".
  const PROGRESSIONS = [
    { id: 'pop', group: 'Durowe', name: 'Pop: I–V–vi–IV', steps: '1:maj 5:maj 6:min 4:maj',
      desc: 'Najpopularniejsza progresja muzyki pop — „cztery akordy”, na których oparto setki przebojów.' },
    { id: 'doowop', group: 'Durowe', name: 'Lata 50.: I–vi–IV–V', steps: '1:maj 6:min 4:maj 5:maj',
      desc: 'Progresja doo-wop, typowa dla ballad lat 50. i 60.' },
    { id: 'cadence', group: 'Durowe', name: 'Kadencja: I–IV–V–I', steps: '1:maj 4:maj 5:maj 1:maj',
      desc: 'Podstawowa kadencja: tonika – subdominanta – dominanta – tonika (T–S–D–T).' },
    { id: 'sensitive', group: 'Durowe', name: 'vi–IV–I–V', steps: '6:min 4:maj 1:maj 5:maj',
      desc: 'Ta sama czwórka akordów co „pop”, ale zaczęta od vi — brzmi bardziej melancholijnie.' },
    { id: 'canon', group: 'Durowe', name: 'Kanon: I–V–vi–iii–IV–I–IV–V', steps: '1:maj 5:maj 6:min 3:min 4:maj 1:maj 4:maj 5:maj',
      desc: 'Ciąg harmoniczny znany z Kanonu D-dur Pachelbela; schodzący bas co kwartę i sekundę.' },
    { id: 'mixo', group: 'Durowe', name: 'Rock: I–♭VII–IV–I', steps: '1:maj b7:maj 4:maj 1:maj',
      desc: 'Brzmienie miksolidyjskie: akord na obniżonym VII stopniu, częsty w rocku.' },
    { id: 'minorPop', group: 'Molowe', name: 'i–♭VI–♭III–♭VII', steps: '1:min b6:maj b3:maj b7:maj',
      desc: 'Molowa progresja popowa (np. a – F – C – G).' },
    { id: 'andalusian', group: 'Molowe', name: 'Kadencja andaluzyjska: i–♭VII–♭VI–V', steps: '1:min b7:maj b6:maj 5:maj',
      desc: 'Schodzący bas z flamenco; V jest durowe dzięki podwyższonej septymie (moll harmoniczny).' },
    { id: 'minorCadence', group: 'Molowe', name: 'Kadencja molowa: i–iv–V–i', steps: '1:min 4:min 5:maj 1:min',
      desc: 'Kadencja w molu z durową dominantą (z molowej skali harmonicznej).' },
    { id: 'epic', group: 'Molowe', name: 'i–♭VI–♭VII–i', steps: '1:min b6:maj b7:maj 1:min',
      desc: 'Częsta w muzyce filmowej i metalu — „epickie” rozwiązanie przez ♭VI i ♭VII.' },
    { id: '251', group: 'Jazz i blues', name: 'ii–V–I', steps: '2:m7 5:7 1:maj7',
      desc: 'Podstawa harmonii jazzowej: subdominanta – dominanta – tonika z septymami.' },
    { id: '251minor', group: 'Jazz i blues', name: 'Molowe ii–V–i', steps: '2:m7b5 5:7 1:m6',
      desc: 'Wersja molowa: akord półzmniejszony, dominanta, molowa tonika.' },
    { id: 'turnaround', group: 'Jazz i blues', name: 'Turnaround: I–vi–ii–V', steps: '1:maj7 6:m7 2:m7 5:7',
      desc: 'Krótki ciąg prowadzący z powrotem do toniki, np. na końcu chorusu.' },
    { id: 'perfect', group: 'Kadencje', name: 'Doskonała (autentyczna): IV–V7–I', steps: '1:maj 4:maj 5:7 1:maj',
      desc: 'Najmocniejsze zakończenie: dominanta septymowa rozwiązuje się na tonikę — dźwięk prowadzący idzie o półton w górę, septyma o sekundę w dół.' },
    { id: 'plagal', group: 'Kadencje', name: 'Plagalna („amen”): IV–I', steps: '1:maj 4:maj 4:maj 1:maj',
      desc: 'Subdominanta prosto do toniki — łagodne, „kościelne” zakończenie (amen na końcu hymnów).' },
    { id: 'half', group: 'Kadencje', name: 'Zawieszona (półkadencja): …–V', steps: '1:maj 6:min 2:min 5:maj',
      desc: 'Fraza kończy się na dominancie — brzmi jak pytanie, które czeka na odpowiedź.' },
    { id: 'deceptive', group: 'Kadencje', name: 'Zwodnicza: V7–vi', steps: '1:maj 4:maj 5:7 6:min',
      desc: 'Dominanta zamiast na tonikę idzie na vi — słuchacz spodziewa się końca, a słyszy zaskoczenie (I i vi mają dwa wspólne dźwięki).' },
    { id: 'picardy', group: 'Kadencje', name: 'Z tercją pikardyjską: i–iv–V–I', steps: '1:min 4:min 5:maj 1:maj',
      desc: 'Utwór molowy kończy się akordem durowym — dawny barokowy zwyczaj, jasne zakończenie po smutnej frazie.' },
    { id: 'blues', group: 'Jazz i blues', name: '12-taktowy blues', steps: '1:7 1:7 1:7 1:7 4:7 4:7 1:7 1:7 5:7 4:7 1:7 5:7',
      desc: 'Klasyczny schemat bluesa: 12 taktów, trzy akordy dominantowe.' },
  ].map((p) => ({
    ...p,
    steps: p.steps.split(' ').map((s) => { const [iv, type] = s.split(':'); return { iv: parseInterval(iv), type }; }),
  }));

  /** Tradycyjne nazwy stopni skali (dla skal siedmiodźwiękowych). */
  function degreeName(iv) {
    const sd = mod(iv.deg - 1, 7);
    if (sd === 6) return iv.semi === 11 ? 'dźwięk prowadzący' : 'subtonika';
    return ['tonika', 'supertonika', 'medianta', 'subdominanta', 'dominanta', 'submedianta'][sd];
  }

  /**
   * Akordy zapożyczone: diatoniczne trójdźwięki (i septymowe) równoległej skali
   * dur/moll, których nie ma w bieżącej skali.
   */
  function borrowedChords(sc, size = 3) {
    if (sc.notes.length !== 7) return [];
    const minorThird = sc.notes[2].iv.semi === 3;
    const parallel = buildScale(sc.tonic, minorThird ? 'major' : 'minor');
    return diatonicChords(parallel, size)
      .filter((d) => ![...d.chord.pcs].every((pc) => sc.pcs.has(pc)))
      .map((d) => {
        const iv = intervalBetween(sc.tonic, d.chord.root);
        return { ...d, from: parallel.scale, roman: romanFor(iv.deg, iv.diff, d.chord.type) };
      });
  }

  /**
   * Oznaczenie cyfrowe (bas cyfrowany) przewrotu: trójdźwięk 5/3, 6, 6/4;
   * akord septymowy 7, 6/5, 4/3, 2. Dla innych akordów — null.
   */
  function figuredBass(chord, inv) {
    const n = chord.notes.length;
    const has7 = chord.notes.some((x) => x.iv.deg === 7);
    const tertian = chord.notes.every((x) => [1, 3, 5, 7].includes(x.iv.deg));
    if (!tertian) return null;
    if (n === 3 && !has7) return ['5/3', '6', '6/4'][inv] || null;
    if (n === 4 && has7) return ['7', '6/5', '4/3', '2'][inv] || null;
    return null;
  }

  /** Transpozycja listy akordów o interwał między tonikami (z poprawną pisownią). */
  function transposeChords(chords, fromTonic, toTonic) {
    const iv = intervalBetween(fromTonic, toTonic);
    const shift = { deg: iv.deg, semi: mod(toTonic.pc - fromTonic.pc, 12) };
    return chords.map((c) => buildChord(transpose(c.root, shift), c.type.id));
  }

  /* ---------- Analiza: symbol akordu → akord, akordy → tonacja ---------- */

  // Dodatkowe zapisy symboli (oprócz tych z CHORD_TYPES).
  const SYMBOL_ALIASES = {
    '': 'maj', M: 'maj', maj: 'maj', major: 'maj', m: 'min', min: 'min', '-': 'min', mi: 'min',
    dim: 'dim', '°': 'dim', o: 'dim', aug: 'aug', '+': 'aug', '#5': 'aug',
    M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', 'ma7': 'maj7', 'm7': 'm7', 'min7': 'm7', '-7': 'm7',
    'ø': 'm7b5', 'ø7': 'm7b5', 'm7b5': 'm7b5', 'm7♭5': 'm7b5', '-7b5': 'm7b5',
    dim7: 'dim7', '°7': 'dim7', o7: 'dim7', 'mmaj7': 'mMaj7', 'm(maj7)': 'mMaj7', 'mM7': 'mMaj7',
    '7#5': 'aug7', '7♯5': 'aug7', 'aug7': 'aug7', '+7': 'aug7', sus: 'sus4', '7sus': '7sus4',
    add9: 'add9', 'madd9': 'madd9', 'm(add9)': 'madd9', '6/9': '69', '69': '69', '7b9': '7b9', '7♭9': '7b9', '7#9': '7s9', '7♯9': '7s9',
  };

  /**
   * „F#m7”, „Bb”, „Hm” (notacja H), „C/E” → { chord, bass } lub null.
   * W notacji H: H = B, B = B♭ (także „Hes” nie jest obsługiwane — używaj ♭/b).
   */
  function parseChordSymbol(str, notation) {
    const m = /^\s*([A-Ha-h])(#|♯|b|♭|is|es|s)?(.*?)(?:\/([A-Ha-h])(#|♯|b|♭)?)?\s*$/.exec(str);
    if (!m) return null;
    const toNote = (L, acc) => {
      L = L.toUpperCase();
      let a = !acc ? 0 : /#|♯|is/.test(acc) ? 1 : -1;
      let letter;
      if (L === 'H') { if (notation !== 'H') return null; letter = 6; }
      else if (L === 'B' && notation === 'H') { letter = 6; a -= 1; }
      else letter = LETTERS.indexOf(L);
      return makeNote(letter, a);
    };
    const root = toNote(m[1], m[2]);
    if (!root) return null;
    let suf = m[3].trim().replace(/^\(|\)$/g, (x) => x);
    let typeId = SYMBOL_ALIASES[suf];
    if (typeId === undefined) {
      const t = CHORD_TYPES.find((c) => c.symbol === suf || c.id === suf || c.symbol.replace(/♭/g, 'b').replace(/♯/g, '#') === suf);
      typeId = t ? t.id : undefined;
    }
    if (typeId === undefined) return null;
    const bass = m[4] ? toNote(m[4], m[5]) : null;
    if (m[4] && !bass) return null;
    return { chord: buildChord(root, typeId), bass };
  }

  /**
   * Możliwe tonacje dla listy akordów: dur, moll (naturalny + harmoniczny dla V/vii°).
   * Zwraca listę od najlepszej: { tonic, mode: 'major'|'minor', fit, total, analysis[] }.
   * analysis[i]: { roman, inKey, note } — note: wyjaśnienie dla akordu spoza tonacji.
   */
  function analyzeKey(chords) {
    if (!chords.length) return [];
    const out = [];
    const tonics = 'C G D A E B F# C# F Bb Eb Ab Db Gb Cb'.split(' ');
    for (const t of tonics) {
      for (const mode of ['major', 'minor']) {
        const majorTonic = parseNote(t);
        const tonic = mode === 'major' ? majorTonic : transpose(majorTonic, parseInterval('6'));
        const scales = mode === 'major' ? [buildScale(tonic, 'major')] : [buildScale(tonic, 'minor'), buildScale(tonic, 'harmonicMinor')];
        // Przynależność z uwzględnieniem pisowni (A♭ ≠ G♯); pryma przepisana na pisownię skali.
        const respelled = (c, sc) => {
          const sn = sc.notes.find((n) => n.note.pc === c.root.pc);
          return sn ? buildChord(sn.note, c.type.id) : c;
        };
        const fitsSpelled = (c, sc) => respelled(c, sc).notes.every((n) => sc.notes.some((x) => x.note.letter === n.note.letter && x.note.acc === n.note.acc));
        const inScale = (c) => scales.some((sc) => fitsSpelled(c, sc));
        const parallel = buildScale(tonic, mode === 'major' ? 'minor' : 'major');
        let fit = 0;
        const analysis = chords.map((c) => {
          const home = scales.find((sc) => sc.notes.some((n) => n.note.pc === c.root.pc));
          const iv = intervalBetween(tonic, home ? respelled(c, home).root : c.root);
          // pisownia względem toniki (np. A♯ w B♭-dur traktujemy jak B♭)
          const roman = romanFor(iv.deg, iv.diff, c.type);
          if (inScale(c)) { fit++; return { roman, inKey: true }; }
          let note = 'spoza tonacji';
          if (fitsSpelled(c, parallel)) note = `zapożyczony z ${mode === 'major' ? 'molowej' : 'durowej'} jednoimiennej`;
          else if (['7', 'maj'].includes(c.type.id)) {
            const target = transpose(c.root, parseInterval('4'));
            const tc = scales[0].notes.findIndex((n) => n.note.pc === target.pc);
            if (tc > 0) note = `dominanta wtrącona do stopnia ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][tc]}`;
          }
          return { roman, inKey: false, note };
        });
        let score = fit * 10;
        const isTonic = (c) => c.root.pc === tonic.pc && (mode === 'major' ? !c.type.intervals.some((i) => i.semi === 3) : c.type.intervals.some((i) => i.deg === 3 && i.semi === 3));
        if (isTonic(chords[0])) score += 6;
        if (isTonic(chords[chords.length - 1])) score += 7;
        if (chords.some(isTonic)) score += 2;
        else score -= 6;
        // V → I na końcu wzmacnia tonację
        const n = chords.length;
        if (n >= 2 && isTonic(chords[n - 1]) && mod(chords[n - 2].root.pc - tonic.pc, 12) === 7) score += 3;
        // tonacje z mniejszą liczbą znaków lekko premiowane (enharmonia: Gb vs F#)
        score -= Math.abs(buildScale(mode === 'major' ? tonic : majorTonic, 'major').notes.reduce((a, x) => a + x.note.acc, 0)) * 0.05;
        out.push({ tonic, mode, fit, total: n, score, analysis });
      }
    }
    // Usuń enharmoniczne duplikaty (F♯-dur / G♭-dur) — zostaw lepszy wynik.
    out.sort((a, b) => b.score - a.score);
    const seen = new Set();
    return out.filter((k) => { const key = k.mode + k.tonic.pc; if (seen.has(key)) return false; seen.add(key); return true; });
  }

  /* ---------- Rozpoznawanie akordu ---------- */

  /**
   * Na podstawie listy wysokości MIDI zwraca możliwe nazwy akordu, od najbardziej
   * prawdopodobnej. kind: 'exact' (dokładnie te dźwięki), 'no5' (bez kwinty),
   * 'slash' (akord + obcy dźwięk w basie, np. C/D).
   */
  function recognize(midis) {
    const sorted = [...new Set(midis)].sort((a, b) => a - b);
    const pcs = new Set(sorted.map((m) => mod(m, 12)));
    if (pcs.size < 2) return [];
    const bassPc = mod(sorted[0], 12);
    const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    const rest = new Set([...pcs].filter((p) => p !== bassPc));
    const out = [];

    CHORD_TYPES.forEach((t, ti) => {
      for (let r = 0; r < 12; r++) {
        const at = (ivs) => new Set(ivs.map((i) => mod(r + i.semi, 12)));
        const full = at(t.intervals);
        let kind = null;
        if (pcs.has(r) && eq(full, pcs)) kind = 'exact';
        else if (pcs.has(r) && t.intervals.length >= 4 && t.intervals.some((i) => i.sym === '5') &&
          eq(at(t.intervals.filter((i) => i.sym !== '5')), pcs)) kind = 'no5';
        else if (rest.size >= 3 && !full.has(bassPc) && rest.has(r) && eq(full, rest)) kind = 'slash';
        if (!kind) continue;

        const bySemi = [...t.intervals].sort((a, b) => a.semi - b.semi);
        const bassIdx = bySemi.findIndex((i) => mod(r + i.semi, 12) === bassPc);
        const score = { exact: 0, no5: 2, slash: 3 }[kind] +
          (kind !== 'slash' && bassPc !== r ? 1 : 0) +
          (t.group === 'ext' ? 0.3 : 0) + ti * 0.01;
        const bassDeg = bassIdx >= 0 ? bySemi[bassIdx].deg : null;
        out.push({ rootPc: r, type: t, kind, bassPc, bassIdx, bassDeg, score });
      }
    });
    return out.sort((a, b) => a.score - b.score);
  }

  /* ---------- Gitara: wyszukiwanie chwytów ---------- */

  const TUNINGS = [
    { id: 'standard', name: 'Standardowy (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
    { id: 'halfDown', name: 'Pół tonu niżej (E♭ A♭ D♭ G♭ B♭ E♭)', midi: [39, 44, 49, 54, 58, 63] },
    { id: 'dropD', name: 'Drop D (D A D G B E)', midi: [38, 45, 50, 55, 59, 64] },
    { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
    { id: 'openG', name: 'Open G (D G D G B D)', midi: [38, 43, 50, 55, 59, 62] },
    { id: 'ukulele', name: 'Ukulele (G C E A)', midi: [67, 60, 64, 69], reentrant: true, strings: 4 },
    { id: 'ukuleleLow', name: 'Ukulele z niskim G (G C E A)', midi: [55, 60, 64, 69], strings: 4 },
    { id: 'bass', name: 'Gitara basowa (E A D G)', midi: [28, 33, 38, 43], strings: 4 },
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
    const N = strings.length;
    const minStrings = Math.min(allPcs.size >= 4 ? 4 : 3, N);
    const found = new Map();

    for (let start = 1; start <= maxFret - 3; start++) {
      const opts = strings.map((open) => {
        const o = [-1];
        if (start <= 3 && allPcs.has(mod(open, 12))) o.push(0);
        for (let f = start; f <= start + 3; f++) if (allPcs.has(mod(open + f, 12))) o.push(f);
        return o;
      });
      const cur = new Array(N);
      (function rec(s) {
        if (s === N) return evaluate(cur.slice());
        for (const f of opts[s]) { cur[s] = f; rec(s + 1); }
      })(0);
    }

    function evaluate(frets) {
      const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
      if (sounding.length < minStrings) return;
      const lo = sounding[0], hi = sounding[sounding.length - 1];
      if (hi - lo + 1 !== sounding.length) return; // wytłumiona struna w środku
      // Bas = najniższy brzmiący dźwięk (w stroju „re-entrant”, np. ukulele, nie musi to być struna 0).
      const lowest = sounding.reduce((a, i) => (strings[i] + frets[i] < strings[a] + frets[a] ? i : a), sounding[0]);
      if (!tuning.reentrant && mod(strings[lo] + frets[lo], 12) !== bassPc) return;
      if (tuning.reentrant && mod(strings[lowest] + frets[lowest], 12) !== bassPc && N > 4) return;
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
      const score = (N - sounding.length) * 1.2 + minF * 0.4 + fingers * 0.6 +
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

  /* ---------- Interwały: analiza dwóch dźwięków ---------- */

  /** Numer pozycji na pięciolinii (C4 = 28): oktawa · 7 + litera. */
  function staffStep(note, midi) {
    return (Math.floor((midi - note.acc) / 12) - 1) * 7 + note.letter;
  }

  /** Interwał między dwoma dźwiękami o konkretnej wysokości (także złożony). */
  function intervalOf(lowNote, lowMidi, highNote, highMidi) {
    const deg = staffStep(highNote, highMidi) - staffStep(lowNote, lowMidi) + 1;
    const semi = highMidi - lowMidi;
    if (deg < 1) return null;
    return describeInterval(deg, semi);
  }

  /** Przewrót interwału prostego: stopień 9 − n, półtony 12 − n (m↔M, A↔d, P↔P). */
  function invertInterval(deg, semi) {
    const oct = Math.floor((deg - 1) / 7);
    const isOctave = deg > 1 && mod(deg - 1, 7) === 0;
    // Sprowadź do interwału prostego (oktawę zostaw jako oktawę).
    const simpleDeg = isOctave ? 8 : deg - 7 * oct;
    const simpleSemi = isOctave ? semi - 12 * (oct - 1) : semi - 12 * oct;
    return describeInterval(9 - simpleDeg, 12 - simpleSemi);
  }

  /** Klasyfikacja brzmieniowa (harmonia klasyczna). */
  function consonance(info) {
    const sd = mod(info.deg - 1, 7) + 1;
    if (!['P', 'M', 'm'].includes(info.abbr.replace(/\d+$/, ''))) {
      return { id: 'dis', name: 'dysonans', why: 'Interwały zwiększone i zmniejszone traktuje się jako dysonanse — nawet gdy brzmią jak konsonans (np. sekunda zwiększona = 3 półtony).' };
    }
    if (sd === 1 || sd === 5) return { id: 'perfect', name: 'konsonans doskonały', why: 'Pryma, oktawa i kwinta czysta — brzmią „pusto” i stabilnie; dźwięki niemal się zlewają.' };
    if (sd === 4) return { id: 'fourth', name: 'konsonans doskonały*', why: 'Kwarta czysta: sama brzmi zgodnie, ale w harmonii klasycznej nad basem traktuje się ją jak dysonans, który wymaga rozwiązania (np. w akordzie sus4).' };
    if (sd === 3 || sd === 6) return { id: 'imperfect', name: 'konsonans niedoskonały', why: 'Tercje i seksty — brzmią ciepło i zgodnie; to z nich budujemy akordy.' };
    return { id: 'dis', name: 'dysonans', why: 'Sekundy i septymy brzmią napięciowo i „chcą” się rozwiązać do konsonansu.' };
  }

  /** Enharmoniczne odpowiedniki: te same półtony, inny stopień (np. 6 pt = A4 lub d5). */
  function enharmonicIntervals(semi) {
    const s = mod(semi, 12) === 0 && semi > 0 ? 12 : mod(semi, 12);
    const out = [];
    for (let deg = 1; deg <= 8; deg++) {
      const d = describeInterval(deg, s);
      if (d.quality !== '?' && !d.quality.startsWith('podwójnie')) {
        const base = MAJOR_SEMI[mod(deg - 1, 7)] + (deg === 8 ? 12 : 0);
        if (Math.abs(s - base) <= 2) out.push(d);
      }
    }
    return out;
  }

  // Interwały do tabel i ćwiczeń (proste + najczęstsze złożone).
  const INTERVALS = '1 b2 2 b3 3 4 #4 b5 5 #5 b6 6 b7 7 8 b9 9 #9 b10 10 11 #11 12 b13 13'.split(' ').map((sym) => {
    const iv = parseInterval(sym);
    return { ...iv, info: describeInterval(iv.deg, iv.semi) };
  });

  /* ---------- Znaki przykluczowe ---------- */

  // Stopień tonacji durowej (macierzystej), na którym zaczyna się skala.
  const PARENT_DEGREE = {
    major: '1', dorian: '2', phrygian: '3', lydian: '4', mixolydian: '5', minor: '6', locrian: '7',
    harmonicMinor: '6', melodicMinor: '6', phrygianDominant: '3',
    majorPentatonic: '1', minorPentatonic: '6', blues: '6',
  };
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F

  /**
   * Znaki przykluczowe dla skali: { parent (tonika durowa), type: 'sharp'|'flat'|null,
   * notes[] w kolejności zapisu, accOf(letter), theoretical }. null — skala spoza dur–moll.
   */
  function keySignature(tonic, scaleId) {
    const d = PARENT_DEGREE[scaleId];
    if (!d) return null;
    const iv = parseInterval(d);
    const letter = mod(tonic.letter - (iv.deg - 1), 7);
    const pc = mod(tonic.pc - iv.semi, 12);
    const parent = makeNote(letter, mod(pc - LETTER_PC[letter] + 6, 12) - 6);
    const notes = buildScale(parent, 'major').notes.map((n) => n.note).filter((n) => n.acc !== 0);
    const type = !notes.length ? null : notes[0].acc > 0 ? 'sharp' : 'flat';
    const order = type === 'flat' ? FLAT_ORDER : SHARP_ORDER;
    notes.sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));
    const accByLetter = new Map(notes.map((n) => [n.letter, n.acc]));
    return {
      parent, type, notes,
      count: notes.length,
      theoretical: notes.some((n) => Math.abs(n.acc) > 1) || (notes.length === 7 && notes.some((n) => n.acc !== notes[0].acc)),
      accOf: (l) => accByLetter.get(l) || 0,
    };
  }

  /** Stopnie skali różniące się od durowej (np. dorycka: ♭3, ♭7). */
  function alterationsVsMajor(scale) {
    return scale.intervals
      .filter((iv) => iv.semi !== MAJOR_SEMI[mod(iv.deg - 1, 7)])
      .map((iv) => describeInterval(iv.deg, iv.semi));
  }

  /* ---------- Prowadzenie głosów ---------- */

  /**
   * Układ akordu (w zwartej pozycji) najbliższy poprzedniemu: minimalizuje sumę
   * ruchów głosów. prev — wysokości MIDI poprzedniego akordu (lub null).
   * Zwraca { midis[], notes[] (pozycje akordu w tej samej kolejności), inv }.
   */
  function smoothVoicing(chord, prev, center = 62, penalty = null) {
    let best = null;
    for (let inv = 0; inv < chord.notes.length; inv++) {
      const voiced = inversion(chord, inv);
      for (let base = 48; base <= 72; base++) {
        if (mod(base, 12) !== voiced[0].note.pc) continue;
        const midis = voiced.map((v) => base + v.semiAbs - voiced[0].semiAbs);
        if (midis[midis.length - 1] > 79 || midis[0] < 52) continue;
        const avg = midis.reduce((a, b) => a + b, 0) / midis.length;
        let cost;
        if (prev && prev.length) {
          cost = voiceMoves(prev, midis).reduce((s, m) => s + Math.abs(m.semis), 0) + Math.abs(avg - center) * 0.15;
          if (prev.length !== midis.length) {
            // Różna liczba głosów: dolicz też drogę „porzuconych” dźwięków poprzedniego akordu.
            cost += prev.reduce((s, p) => s + Math.min(...midis.map((m) => Math.abs(p - m))), 0);
          }
        } else {
          cost = Math.abs(avg - center) + inv * 0.5;
        }
        if (penalty) cost += penalty(midis);
        if (!best || cost < best.cost) best = { cost, midis, notes: voiced, inv };
      }
    }
    return best;
  }

  /**
   * Opis przejścia między akordami: dźwięki wspólne i ruchy pozostałych głosów.
   * Zwraca [{ from, to, semis }] — każdy dźwięk nowego akordu z najbliższym poprzednim.
   */
  function voiceMoves(prev, next) {
    if (prev.length === next.length) {
      // Tyle samo głosów: każdy głos idzie do odpowiadającego mu (od dołu) dźwięku.
      const a = [...prev].sort((x, y) => x - y);
      return [...next].sort((x, y) => x - y).map((m, i) => ({ from: a[i], to: m, semis: m - a[i] }));
    }
    return next.map((m) => {
      let from = prev[0];
      for (const p of prev) if (Math.abs(p - m) < Math.abs(from - m)) from = p;
      return { from, to: m, semis: m - from };
    });
  }

  /**
   * Kwinty i oktawy równoległe między dwoma współbrzmieniami (głosy od dołu,
   * równa liczba). Zwraca [{ kind: 'kwinty'|'oktawy', lo, hi }] — indeksy głosów.
   */
  function parallels(prev, next) {
    if (!prev || prev.length !== next.length) return [];
    const a = [...prev].sort((x, y) => x - y), b = [...next].sort((x, y) => x - y);
    const out = [];
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) {
        const i1 = mod(a[j] - a[i], 12), i2 = mod(b[j] - b[i], 12);
        const mi = b[i] - a[i], mj = b[j] - a[j];
        if (!mi || !mj || Math.sign(mi) !== Math.sign(mj)) continue; // ruch równoległy tylko gdy oba głosy idą w tę samą stronę
        if (i1 === 7 && i2 === 7) out.push({ kind: 'kwinty', lo: i, hi: j });
        else if (i1 === 0 && i2 === 0) out.push({ kind: 'oktawy', lo: i, hi: j });
      }
    }
    return out;
  }

  /* ---------- Dominanty wtrącone ---------- */

  /** V7 (dominanta septymowa) dla akordu na danym dźwięku: kwinta wyżej. */
  function secondaryDominant(target) {
    return buildChord(transpose(target, parseInterval('5')), '7');
  }

  global.Theory = {
    staffStep, intervalOf, invertInterval, consonance, enharmonicIntervals,
    keySignature, alterationsVsMajor, smoothVoicing, voiceMoves, secondaryDominant,
    MAJOR_SEMI, INTERVALS, degreeName, borrowedChords, parseChordSymbol, analyzeKey, figuredBass, transposeChords, parallels,
    LETTERS, SCALES, CHORD_TYPES, CHORD_GROUPS, TUNINGS,
    mod, makeNote, parseNote, noteKey, noteName,
    parseInterval, describeInterval, intervalBetween, transpose,
    scaleById, buildScale, chordTypeById, buildChord, chordSymbol,
    identifyType, diatonicChords, fittingChords, inversion,
    tuningById, findVoicings, roleOf, recognize, romanFor, PROGRESSIONS,
  };
})(window);
