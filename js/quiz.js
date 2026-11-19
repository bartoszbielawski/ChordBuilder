/*
 * ChordBuilder — strona „Ćwiczenia”: trening słuchu i teorii.
 * Każde ćwiczenie: make(level, opts) → pytanie { prompt, answers[{key,label}], correct,
 * item (klucz do statystyk), play?(), show?(box), explain(box) }.
 * Statystyki i ustawienia w localStorage; błędnie odpowiedziane elementy wracają częściej.
 */
(function () {
  'use strict';
  const T = window.Theory;
  const I = window.Instruments;
  const C = window.Common;
  const { h, pick, shuffle, midiOf, noteOfMidi, octaveName } = C;
  const $ = (id) => document.getElementById(id);

  // Wspólny zestaw dla klasy: ?seed=… — te same pytania w tej samej kolejności u wszystkich.
  const SEED = (new URLSearchParams(location.search).get('seed') || '').replace(/[^\w-]/g, '').slice(0, 16);
  if (SEED) {
    let a = 0;
    for (const ch of SEED) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) >>> 0;
    Math.random = () => { // mulberry32
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const STATS_KEY = 'chordbuilder.quiz';
  const prefs = C.loadPrefs();
  const state = {
    notation: prefs.notation === 'H' ? 'H' : 'intl',
    ex: null, level: 1, opts: {}, q: null, answered: null, ok: false, sel: new Set(), seq: [], picked: null, test: null,
    session: { ok: 0, total: 0, streak: 0 },
  };
  const stats = C.loadJSON(STATS_KEY, {});
  const nn = (n) => T.noteName(n, state.notation);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /* ---------- Statystyki i dobór pytań ---------- */

  function exStats(id) {
    stats[id] = stats[id] || { ok: 0, total: 0, best: 0, items: {} };
    return stats[id];
  }
  function record(id, item, ok) {
    const s = exStats(id);
    s.total++;
    if (ok) s.ok++;
    const it = s.items[item] = s.items[item] || { ok: 0, bad: 0 };
    if (ok) it.ok++; else it.bad++;
    C.saveJSON(STATS_KEY, stats);
  }
  /** Losowanie z wagą: elementy z błędami pojawiają się częściej. */
  function weighted(id, list, keyOf = (x) => String(x)) {
    if (SEED) return list[Math.floor(Math.random() * list.length)]; // zestaw wspólny: bez dopasowania do ucznia
    const items = exStats(id).items;
    const w = list.map((x) => {
      const it = items[keyOf(x)];
      return it ? Math.max(0.4, 1 + 2 * it.bad - 0.25 * it.ok) : 1.2;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  /* ---------- Dźwięk ---------- */

  let timers = [];
  let midiOn = false;
  let stopRhythm = () => {};
  function seq(midis, gap = 0.62, dur = 1.1) {
    timers.forEach(clearTimeout);
    timers = midis.map((m, i) => setTimeout(() => Sound.play([].concat(m), 'chord', 'piano', dur), i * gap * 1000));
  }

  /* ---------- Pomocnicze dla nut ---------- */

  const ivInfo = (sym) => { const iv = T.parseInterval(sym); return T.describeInterval(iv.deg, iv.semi); };
  const ivLabel = (sym) => { const d = ivInfo(sym); return `${d.name.replace(' (tryton)', '')} (${d.pl})`; };
  const staffBox = () => h('div', { class: 'melody-wrap quiz-staff' });

  function noteAt(step) {
    const note = T.makeNote(T.mod(step, 7), 0);
    return { note, midi: midiOf(note, Math.floor(step / 7)) };
  }

  /** Opis położenia nuty na pięciolinii (linie i pola liczone od dołu). */
  function placeText(step, clef) {
    const bottom = clef === 'bass' ? 18 : 30;
    const d = step - bottom;
    if (d >= 0 && d <= 8) return d % 2 === 0 ? `${d / 2 + 1}. linia` : `${(d + 1) / 2}. pole`;
    if (d < 0) {
      const k = -d;
      return k % 2 === 0 ? `${k / 2}. linia dodana pod pięciolinią` : (k === 1 ? 'pod pięciolinią (pod 1. linią)' : `pod ${(k - 1) / 2}. linią dodaną`);
    }
    const k = d - 8;
    return k % 2 === 0 ? `${k / 2}. linia dodana nad pięciolinią` : (k === 1 ? 'nad pięciolinią (nad 5. linią)' : `nad ${(k - 1) / 2}. linią dodaną`);
  }

  /** Inna pisownia enharmoniczna (np. E♭ → D♯), o ile istnieje bez potrójnych znaków. */
  function respell(note, dir) {
    const letter = T.mod(note.letter + dir, 7);
    const acc = T.mod(note.pc - [0, 2, 4, 5, 7, 9, 11][letter] + 6, 12) - 6;
    return Math.abs(acc) <= 2 ? T.makeNote(letter, acc) : null;
  }

  const chordNotesLabel = (notes) => notes.map(nn).join(' – ');
  const chordMidis = (chord, inv = 0, base = 60) => {
    const v = T.inversion(chord, inv);
    const start = base + T.mod(v[0].note.pc - base, 12) - (T.mod(v[0].note.pc - base, 12) > 7 ? 12 : 0);
    return v.map((n) => ({ midi: start + n.semiAbs - v[0].semiAbs, note: n.note, role: n.role }));
  };

  function sigText(sig) {
    if (!sig.count) return 'brak znaków';
    return `${sig.count}${sig.type === 'sharp' ? '♯' : '♭'} (${sig.notes.map(nn).join(', ')})`;
  }


  /** Ustalenie tonacji: kadencja I–IV–V7–I (lub i–iv–V7–i). Zwraca czas trwania w s. */
  function playCadence(tonic, minor, tempo = 0.62) {
    const tm = 48 + tonic.pc;
    const iv = (sym) => T.transpose(tonic, T.parseInterval(sym));
    const chords = [T.buildChord(tonic, minor ? 'min' : 'maj'), T.buildChord(iv('4'), minor ? 'min' : 'maj'),
      T.buildChord(iv('5'), '7'), T.buildChord(tonic, minor ? 'min' : 'maj')];
    let prev = null;
    timers.forEach(clearTimeout);
    timers = chords.map((c, i) => {
      const v = T.smoothVoicing(c, prev, 64);
      prev = v.midis;
      return setTimeout(() => Sound.play([tm - 12 + T.mod(c.root.pc - tonic.pc, 12), ...v.midis], 'chord', 'piano', tempo + 0.3), i * tempo * 1000);
    });
    return chords.length * tempo;
  }
  const DEG_LABEL = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', 'b3': '♭3', 'b6': '♭6', 'b7': '♭7' };
  const ROMAN_DEG = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  /** Nazwa tonacji: w notacji A H C po polsku (Es-dur, fis-moll), inaczej E♭-dur, f♯-moll. */
  const keyLabel = (tonic, mode) => (state.notation === 'H' ? T.polishKeyName(tonic, mode)
    : mode === 'major' ? `${nn(tonic)}-dur` : `${nn(tonic).toLowerCase()}-moll`);
  const ROOTS_EASY = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const ROOTS_MED = [...ROOTS_EASY, 'Bb', 'Eb', 'F#', 'Ab', 'Db'];
  const ROOTS_ALL = [...ROOTS_MED, 'C#', 'Gb', 'G#', 'D#', 'A#'];

  /* ---------- Ćwiczenia ---------- */

  const EXERCISES = [
    {
      id: 'ear-interval', group: 'Słuch', title: 'Interwały ze słuchu',
      desc: 'Usłyszysz dwa dźwięki — nazwij odległość między nimi.',
      levels: ['3 i 5, 4 i 8', '+ sekundy i seksty', 'wszystkie w oktawie'],
      options: [{ id: 'dir', label: 'Sposób', values: [['up', 'w górę'], ['down', 'w dół'], ['harm', 'razem'], ['mix', 'losowo']] }],
      sets: [['b3', '3', '4', '5', '8'], ['2', 'b3', '3', '4', '5', 'b6', '6', '8'], ['b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7', '8']],
      make(level, o) {
        const set = this.sets[level];
        const sym = weighted(this.id, set);
        const iv = T.parseInterval(sym);
        const low = randInt(52, 67);
        const dir = o.dir === 'mix' ? pick(['up', 'down', 'harm']) : o.dir || 'up';
        const lowNote = noteOfMidi(low);
        const play = () => (dir === 'harm' ? seq([[low, low + iv.semi]]) : seq(dir === 'up' ? [low, low + iv.semi] : [low + iv.semi, low]));
        return {
          prompt: `Jaki to interwał? (${{ up: 'w górę', down: 'w dół', harm: 'zagrany razem' }[dir]})`,
          answers: set.map((s) => ({ key: s, label: ivLabel(s) })),
          correct: sym, item: sym, play,
          explain: (box) => {
            const top = T.transpose(lowNote, iv);
            const st = staffBox();
            I.renderMelody(st, [[{ midi: low, note: lowNote, role: 'root' }], [{ midi: low + iv.semi, note: top, role: 'third' }]], {
              labels: [nn(lowNote), nn(top)], onColumn: (i) => Sound.play([i ? low + iv.semi : low]),
            });
            box.append(h('p', {}, `${nn(lowNote)} → ${nn(top)}: ${ivInfo(sym).name}, ${iv.semi} półtonów. `, h('span', { class: 'muted' }, T.consonance(ivInfo(sym)).name)), st);
          },
        };
      },
    },
    {
      id: 'ear-chord', group: 'Słuch', title: 'Akordy ze słuchu',
      desc: 'Usłyszysz akord — rozpoznaj jego rodzaj.',
      levels: ['dur / moll', '+ zmniejszony, zwiększony', '+ septymowe, sus4'],
      options: [{ id: 'mode', label: 'Sposób', values: [['chord', 'razem'], ['arp', 'arpeggio'], ['both', 'oba']] },
        { id: 'inv', label: 'Przewroty', values: [['0', 'tylko zasadnicza'], ['1', 'losowe']] }],
      sets: [['maj', 'min'], ['maj', 'min', 'dim', 'aug'], ['maj', 'min', 'dim', 'aug', 'sus4', '7', 'maj7', 'm7', 'm7b5', 'dim7']],
      make(level, o) {
        const set = this.sets[level];
        const type = weighted(this.id, set);
        const root = T.parseNote(pick(ROOTS_MED));
        const chord = T.buildChord(root, type);
        const inv = o.inv === '1' ? randInt(0, chord.notes.length - 1) : 0;
        const notes = chordMidis(chord, inv, 57);
        const ms = notes.map((n) => n.midi);
        const play = () => {
          if (o.mode === 'arp') Sound.play(ms, 'arp', 'piano', 1.2);
          else if (o.mode === 'both') { Sound.play(ms, 'chord', 'piano', 1.6); timers.push(setTimeout(() => Sound.play(ms, 'arp', 'piano', 1.1), 1500)); }
          else Sound.play(ms, 'chord', 'piano', 2.2);
        };
        return {
          prompt: 'Jaki to akord?',
          answers: set.map((t) => ({ key: t, label: `${T.chordTypeById(t).name}${T.chordTypeById(t).symbol ? ' (' + T.chordTypeById(t).symbol + ')' : ''}` })),
          correct: type, item: type, play,
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [notes], { gap: 60, labels: [T.chordSymbol(chord, state.notation)] });
            box.append(h('p', {}, `${T.chordSymbol(chord, state.notation)} — akord ${chord.type.name}: ${chord.notes.map((n) => `${nn(n.note)} (${n.info.symbol})`).join(', ')}` +
              (inv ? ` · ${['', 'I', 'II', 'III'][inv]} przewrót` : '') + '.'), st,
            h('p', { class: 'muted' }, 'Budowa od prymy w półtonach: ' + chord.notes.map((n) => n.iv.semi).join('–')));
          },
        };
      },
    },
    {
      id: 'ear-scale', group: 'Słuch', title: 'Skale i modusy ze słuchu',
      desc: 'Usłyszysz skalę na tle toniki — rozpoznaj ją.',
      levels: ['dur / moll', '+ harmoniczna, pentatoniki', 'wszystkie modusy'],
      sets: [['major', 'minor'], ['major', 'minor', 'harmonicMinor', 'majorPentatonic', 'minorPentatonic'], ['lydian', 'major', 'mixolydian', 'dorian', 'minor', 'phrygian', 'locrian']],
      make(level) {
        const set = this.sets[level];
        const id = weighted(this.id, set);
        const tonic = T.parseNote(pick(['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'Eb']));
        const sc = T.buildScale(tonic, id);
        const start = 60 + tonic.pc - (tonic.pc > 6 ? 12 : 0);
        const ms = [...sc.notes.map((n) => start + n.iv.semi), start + 12];
        const play = () => {
          timers.forEach(clearTimeout);
          Sound.play([start - 24, start - 12], 'chord', 'piano', ms.length * 0.56 + 1.5);
          Sound.play(ms, 'arp', 'piano', 1.0);
        };
        return {
          prompt: 'Jaka to skala?',
          answers: set.map((s) => ({ key: s, label: T.scaleById(s).name })),
          correct: id, item: id, play,
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [...sc.notes.map((n, i) => [{ midi: ms[i], note: n.note, role: n.iv.sym === sc.scale.char ? 'ext' : null }]), [{ midi: ms[ms.length - 1], note: tonic }]], {
              keySig: T.keySignature(tonic, id), gap: 30, labels: [...sc.notes.map((n) => ivInfo(n.iv.sym).symbol), '8'],
            });
            box.append(h('p', {}, `${nn(tonic)} ${sc.scale.name.toLowerCase()}. ${sc.scale.mood}`), st);
          },
        };
      },
    },
    {
      id: 'ear-degree', group: 'Słuch', title: 'Stopnie skali ze słuchu',
      desc: 'Najpierw kadencja ustala tonację, potem jeden dźwięk — który to stopień?',
      levels: ['1, 3, 5 (dźwięki toniki)', 'wszystkie stopnie dur', 'dur i moll'],
      make(level) {
        const minor = level === 2 && Math.random() < 0.5;
        const sc = T.buildScale(T.parseNote(pick(['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'])), minor ? 'minor' : 'major');
        const idxs = level === 0 ? [0, 2, 4] : [0, 1, 2, 3, 4, 5, 6];
        const i = weighted(this.id, idxs, (x) => (minor ? 'm' : 'M') + x);
        const tm = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
        const target = tm + sc.notes[i].iv.semi + (Math.random() < 0.3 && i < 4 ? 12 : 0);
        const lbl = (k) => DEG_LABEL[sc.notes[k].iv.sym] || sc.notes[k].iv.sym;
        const play = () => {
          const t = playCadence(sc.tonic, minor);
          timers.push(setTimeout(() => Sound.play([target], 'chord', 'piano', 1.6), (t + 0.4) * 1000));
        };
        return {
          prompt: `Tonacja ${minor ? nn(sc.tonic).toLowerCase() + '-moll' : nn(sc.tonic) + '-dur'} — który stopień zabrzmiał po kadencji?`,
          answers: idxs.map((k) => ({ key: String(k), label: `${lbl(k)} — ${T.degreeName(sc.notes[k].iv)}` })),
          correct: String(i), item: (minor ? 'm' : 'M') + i, play,
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [[{ midi: tm, note: sc.tonic, role: 'root' }], [{ midi: target, note: sc.notes[i].note, role: 'third' }]], {
              keySig: T.keySignature(sc.tonic, minor ? 'minor' : 'major'), labels: ['1', lbl(i)], onColumn: (c) => Sound.play([c ? target : tm]),
            });
            const tips = ['tonika — punkt spoczynku, nic nie „ciągnie” dalej', 'supertonika — chce zejść do toniki', 'medianta — stabilna, „kolor” trybu (dur/moll)',
              'subdominanta — ciąży w dół do tercji', 'dominanta — stabilna, ale otwarta', 'submedianta — ciąży w dół do kwinty', 'dźwięk prowadzący — silnie ciągnie w górę do toniki'];
            box.append(h('p', {}, `To ${nn(sc.notes[i].note)}: ${lbl(i)} stopień (${tips[i]}).`), st,
              h('p', { class: 'muted' }, 'Wskazówka: zaśpiewaj w myślach drogę od usłyszanego dźwięku do toniki — liczba kroków podpowie stopień.'));
          },
        };
      },
    },
    {
      id: 'ear-progression', group: 'Słuch', title: 'Progresje ze słuchu',
      desc: 'Usłyszysz cztery akordy — rozpoznaj progresję.',
      levels: ['3 popularne progresje', '+ kadencje i progresje molowe', 'wszystkie (także jazzowe)'],
      sets: [['pop', 'doowop', 'cadence'], ['pop', 'doowop', 'cadence', 'sensitive', 'mixo', 'deceptive', 'minorPop', 'andalusian'],
        ['pop', 'doowop', 'cadence', 'sensitive', 'mixo', 'deceptive', 'plagal', 'half', 'minorPop', 'andalusian', 'minorCadence', 'epic', '251', 'turnaround']],
      make(level) {
        const set = this.sets[level].filter((id) => T.PROGRESSIONS.some((p) => p.id === id));
        const id = weighted(this.id, set);
        const prog = T.PROGRESSIONS.find((p) => p.id === id);
        const tonic = T.parseNote(pick(['C', 'D', 'E', 'F', 'G', 'A']));
        const chords = prog.steps.map((st) => T.buildChord(T.transpose(tonic, st.iv), st.type));
        const play = () => {
          let prev = null;
          timers.forEach(clearTimeout);
          timers = chords.map((c, i) => {
            const v = T.smoothVoicing(c, prev, 64);
            prev = v.midis;
            return setTimeout(() => Sound.play([36 + c.root.pc, ...v.midis], 'chord', 'piano', 1.2), i * 950);
          });
        };
        return {
          prompt: 'Jaka to progresja? (słuchaj, gdzie bas się porusza i czy akordy są durowe czy molowe)',
          answers: set.map((k) => ({ key: k, label: T.PROGRESSIONS.find((p) => p.id === k).name })), wide: true,
          correct: id, item: id, play,
          explain: (box) => {
            box.append(h('p', {}, `${prog.name} — w tonacji ${nn(tonic)}: ${chords.map((c) => T.chordSymbol(c, state.notation)).join(' – ')}. ${prog.desc}`),
              h('p', {}, h('a', { href: `./#t=${encodeURIComponent(T.noteKey(tonic))}&s=${chords[0].type.id === 'min' ? 'minor' : 'major'}&p=${id}` }, 'Otwórz tę progresję na stronie głównej →')));
          },
        };
      },
    },
    {
      id: 'dictation', group: 'Słuch', title: 'Dyktando melodyczne',
      desc: 'Usłyszysz krótką melodię — zapisz ją stopniami skali.',
      levels: ['3 dźwięki, stopnie 1–5, krokami', '4 dźwięki, cała skala', '5 dźwięków ze skokami'],
      make(level) {
        const sc = T.buildScale(T.parseNote(pick(['C', 'D', 'F', 'G', 'Bb', 'A', 'Eb'])), 'major');
        const len = [3, 4, 5][level];
        const top = level === 0 ? 4 : 7; // indeksy 0..top
        let mel = [0];
        // Melodia zaczyna się od toniki; kolejne dźwięki krokami (poziom 0–1) lub z krótkimi skokami.
        for (let i = 1; i < len; i++) {
          const prev = mel[i - 1];
          const steps = level === 2 ? [-4, -3, -2, -1, 1, 2, 3, 4] : level === 1 ? [-2, -1, 1, 2] : [-1, 1];
          const opts = steps.map((d) => prev + d).filter((x) => x >= 0 && x <= top);
          mel.push(pick(opts));
        }
        const tm = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
        const midiAt = (k) => tm + (k === 7 ? 12 : sc.notes[k].iv.semi);
        const choices = Array.from({ length: top === 7 ? 8 : top + 1 }, (_, k) => ({ key: k, label: k === 7 ? '8 (1↑)' : String(k + 1) }));
        const sounds = Object.fromEntries(choices.map((c) => [c.key, midiAt(c.key)]));
        const play = () => {
          const t = playCadence(sc.tonic, false, 0.5);
          timers.push(...mel.map((k, i) => setTimeout(() => Sound.play([midiAt(k)], 'chord', 'piano', 0.9), (t + 0.5 + i * 0.7) * 1000)));
        };
        const noteOf = (k) => (k === 7 ? sc.tonic : sc.notes[k].note);
        return {
          input: 'seq', length: len, choices, sounds, correctSeq: mel, answers: [], item: 'len' + len,
          prompt: `Tonacja ${nn(sc.tonic)}-dur (kadencja, potem melodia od toniki). Wpisz kolejne stopnie.`,
          correctLabel: mel.map((k) => (k === 7 ? '8' : k + 1)).join(' – '),
          check: (seq) => seq.length === mel.length && seq.every((k, i) => k === mel[i]),
          play,
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, mel.map((k) => [{ midi: midiAt(k), note: noteOf(k), role: k === 0 || k === 7 ? 'root' : null }]), {
              keySig: T.keySignature(sc.tonic, 'major'), labels: mel.map((k) => (k === 7 ? '8' : String(k + 1))), gap: 34,
              onColumn: (i) => Sound.play([midiAt(mel[i])]),
            });
            box.append(h('p', {}, `Melodia: ${mel.map((k) => nn(noteOf(k))).join(' – ')} (stopnie ${mel.map((k) => (k === 7 ? 8 : k + 1)).join('–')}).`), st,
              h('button', { type: 'button', class: 'btn small ghost', onclick: () => seq(mel.map(midiAt), 0.6, 0.9) }, '▶ Melodia jeszcze raz'));
          },
        };
      },
    },
    {
      id: 'rhythm-values', group: 'Rytm', title: 'Wartości rytmiczne',
      desc: 'Ile krótszych wartości mieści się w dłuższej?',
      levels: ['cała, półnuta, ćwierćnuta, ósemka', '+ szesnastki i kropki', '+ pauzy z kropką'],
      make(level) {
        const R = window.Rhythm;
        const big = [['w', 'h', 'q'], ['w', 'h', 'q', 'h.', 'q.'], ['w', 'h', 'q', 'h.', 'q.', 'e.']][level];
        const small = [['h', 'q', 'e'], ['h', 'q', 'e', 's'], ['h', 'q', 'e', 's']][level];
        let a, b;
        for (let t = 0; t < 100; t++) {
          a = { v: pick(big), rest: level === 2 && Math.random() < 0.4 };
          b = { v: pick(small), rest: false };
          const r = R.units(a) / R.units(b);
          if (Number.isInteger(r) && r >= 2) break;
        }
        const n = R.units(a) / R.units(b);
        const opts = shuffle([...new Set([n, n * 2, n / 2, n + 1, n - 1, n + 2].filter((x) => Number.isInteger(x) && x >= 1))]).slice(0, 5);
        if (!opts.includes(n)) opts[0] = n;
        return {
          prompt: window.I18N && window.I18N.lang === 'en'
            ? h('span', {}, 'How many ', h('b', {}, R.valueName(b) + 's '), h('span', { class: 'rh-g' }, R.glyph(b)), ' make one ', h('b', {}, R.valueName(a) + ' '), h('span', { class: 'rh-g' }, R.glyph(a)), '?')
            : h('span', {}, 'Ile ', h('b', {}, R.valueName(b) + ' '), h('span', { class: 'rh-g' }, R.glyph(b)), ' trwa tyle, co ', h('b', {}, R.valueName(a) + ' '), h('span', { class: 'rh-g' }, R.glyph(a)), '?'),
          answers: opts.sort((x, y) => x - y).map((x) => ({ key: String(x), label: String(x) })),
          correct: String(n), item: a.v + (a.rest ? 'r' : '') + '/' + b.v,
          explain: (box) => box.append(h('p', {}, `${cap(R.valueName(a))} = ${R.units(a)} szesnastek, ${R.valueName(b)} = ${R.units(b)} → ${R.units(a)} : ${R.units(b)} = ${n}.`,
            a.v.endsWith('.') ? ' ' : '', a.v.endsWith('.') ? 'Kropka wydłuża wartość o połowę.' : '', a.rest ? ' ' : '', a.rest ? 'Pauza trwa tyle samo co nuta o tej wartości.' : '')),
        };
      },
    },
    {
      id: 'rhythm-meter', group: 'Rytm', title: 'Metrum taktu',
      desc: 'Policz wartości w takcie i wskaż metrum.',
      levels: ['półnuty i ćwierćnuty', '+ ósemki i kropki', '+ szesnastki i pauzy'],
      make(level) {
        const R = window.Rhythm;
        const pool = ['2/4', '3/4', '4/4', '3/8', '5/4'];
        const id = weighted(this.id, pool);
        const meter = R.meterById(id);
        const allowed = [['h', 'q'], ['h', 'q', 'e', 'h.', 'q.'], ['h', 'q', 'e', 's', 'q.', 'e.']][level].filter((v) => R.units({ v }) <= R.barUnits(meter));
        const bar = R.randomBar(meter, id === '3/8' ? allowed.filter((v) => R.units({ v }) <= 6).concat(['e']) : allowed, level === 2 ? 0.2 : 0);
        return {
          prompt: h('span', {}, 'Jakie metrum ma ten takt?  ', h('span', { class: 'rh-g big' }, bar.map((e) => R.glyph(e)).join(' '))),
          answers: pool.map((m) => ({ key: m, label: m })),
          correct: id, item: id,
          play: () => { stopRhythm(); stopRhythm = R.playRhythm(bar, meter, 80, { countIn: false }); },
          explain: (box) => {
            const total = bar.reduce((s2, e) => s2 + R.units(e), 0);
            box.append(h('p', {}, `${bar.map((e) => R.valueName(e)).join(' + ')} = ${String(total / 4).replace('.', ',')} ćwierćnuty → ${id}`, ' ',
              id === '3/8' ? '(3 ósemki).' : `(${meter.beats} ${meter.unit === 4 ? 'ćwierćnuty' : 'ósemki'}).`),
            h('p', { class: 'muted' }, 'Uwaga: takt 3/4 i 6/8 trwa tyle samo, ale inaczej się go akcentuje (3 × ćwierćnuta vs 2 × ćwierćnuta z kropką).'));
          },
        };
      },
    },
    {
      id: 'rhythm-ear', group: 'Słuch', title: 'Dyktando rytmiczne',
      desc: 'Usłyszysz takt rytmu — wybierz jego zapis.',
      levels: ['4/4: półnuty, ćwierćnuty', '4/4: + ósemki i kropki', '3/4 lub 4/4, + szesnastki i pauzy'],
      make(level) {
        const R = window.Rhythm;
        const meter = R.meterById(level === 2 && Math.random() < 0.5 ? '3/4' : '4/4');
        const allowed = [['h', 'q'], ['h', 'q', 'e', 'q.'], ['h', 'q', 'e', 's', 'q.', 'e.']][level];
        const rest = level === 2 ? 0.15 : 0;
        const key = (b) => b.map((e) => e.v + (e.rest ? 'r' : '')).join(' ');
        const bar = R.randomBar(meter, allowed, rest);
        const bars = [bar];
        for (let t = 0; t < 200 && bars.length < 4; t++) {
          const o = R.randomBar(meter, allowed, rest);
          if (!bars.some((b) => key(b) === key(o))) bars.push(o);
        }
        const label = (b) => b.map((e) => R.glyph(e)).join(' ');
        return {
          prompt: `Który zapis odpowiada usłyszanemu rytmowi? (metrum ${meter.id}, najpierw takt metronomu)`,
          answers: shuffle(bars).map((b) => ({ key: key(b), label: label(b) })), rhythm: true,
          correct: key(bar), item: meter.id + level,
          play: () => { stopRhythm(); stopRhythm = R.playRhythm(bar, meter, 76, { countIn: true }); },
          explain: (box) => box.append(h('p', {}, `Rytm: ${bar.map((e) => R.valueName(e)).join(', ')}.`),
            h('p', { class: 'muted' }, 'Wskazówka: stukaj miary razem z metronomem i licz „raz-i, dwa-i…” — ósemki wypadają na „i”.')),
        };
      },
    },
    {
      id: 'ear-inversion', group: 'Słuch', title: 'Przewroty ze słuchu',
      desc: 'Usłyszysz akord — który dźwięk jest w basie?',
      levels: ['trójdźwięki durowe', 'dur i moll', '+ akordy septymowe (III przewrót)'],
      make(level) {
        const type = pick([['maj'], ['maj', 'min'], ['maj', 'min', '7', 'maj7', 'm7']][level]);
        const chord = T.buildChord(T.parseNote(pick(ROOTS_MED)), type);
        const n = Math.min(chord.notes.length, 4);
        const inv = weighted(this.id, Array.from({ length: n }, (_, i) => i), (i) => n + ':' + i);
        const notes = chordMidis(chord, inv, 55);
        const ms = notes.map((x) => x.midi);
        const names = ['postać zasadnicza (pryma w basie)', 'I przewrót (tercja w basie)', 'II przewrót (kwinta w basie)', 'III przewrót (septyma w basie)'];
        return {
          prompt: 'W jakiej postaci jest ten akord? (słuchaj najniższego dźwięku)',
          answers: names.slice(0, n).map((l, i) => ({ key: String(i), label: l })),
          correct: String(inv), item: n + ':' + inv,
          play: () => { Sound.play(ms, 'chord', 'piano', 1.8); timers.push(setTimeout(() => Sound.play([ms[0]], 'chord', 'piano', 1.2), 1900)); },
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [notes], { gap: 60, labels: [T.chordSymbol(chord, state.notation) + (inv ? '/' + nn(notes[0].note) : '')] });
            const fb = T.figuredBass(chord, inv);
            box.append(h('p', {}, `${T.chordSymbol(chord, state.notation)} — w basie ${nn(notes[0].note)}: ${names[inv]}` + (fb ? `, oznaczenie cyfrowe ${fb}.` : '.')), st,
              h('p', { class: 'muted' }, 'Po akordzie gra sam bas — porównaj go z prymą akordu. Przewroty brzmią mniej „stabilnie” niż postać zasadnicza; II przewrót (6/4) najmniej.'));
          },
        };
      },
    },
    {
      id: 'name-scale', group: 'Nuty', title: 'Rozpoznaj skalę z nut',
      desc: 'Skala zapisana na pięciolinii (bez znaków przykluczowych) — jaka to?',
      levels: ['dur i moll naturalny', '+ moll harmoniczny i melodyczny', 'modusy'],
      sets: [['major', 'minor'], ['major', 'minor', 'harmonicMinor', 'melodicMinor'], ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian']],
      make(level) {
        const id = weighted(this.id, this.sets[level]);
        const sc = T.buildScale(T.parseNote(pick(['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'Eb'])), id);
        const start = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
        const ms = [...sc.notes.map((x) => start + x.iv.semi), start + 12];
        const cols = ms.map((m, i) => [{ midi: m, note: i < 7 ? sc.notes[i].note : sc.tonic }]);
        return {
          prompt: `Jaka to skala od ${nn(sc.tonic)}? (policz półtony między kolejnymi dźwiękami)`,
          answers: this.sets[level].map((x) => ({ key: x, label: `${nn(sc.tonic)} ${T.scaleById(x).name.toLowerCase()}` })),
          correct: id, item: id,
          play: () => Sound.play(ms, 'arp', 'piano', 1.0),
          show: (box) => { const st = staffBox(); I.renderMelody(st, cols, { gap: 30 }); box.append(st); },
          explain: (box) => {
            const steps = sc.notes.map((x, i) => (i + 1 < 7 ? sc.notes[i + 1].iv.semi : 12) - x.iv.semi);
            const alts = T.alterationsVsMajor(sc.scale).map((d) => d.symbol);
            box.append(h('p', {}, `${nn(sc.tonic)} ${sc.scale.name.toLowerCase()}: odległości ${steps.join(' ')}`, alts.length ? `; względem durowej: ${alts.join(', ')}.` : ' — wzór skali durowej.'),
              h('p', { class: 'muted' }, sc.scale.mood || ''));
          },
        };
      },
    },
    {
      id: 'key-relations', group: 'Nuty', title: 'Pokrewieństwo tonacji',
      desc: 'Tonacja równoległa, jednoimienna, kwintę wyżej i niżej (koło kwintowe).',
      levels: ['równoległa (do 3 znaków)', '+ jednoimienna, wszystkie tonacje', '+ tonacje sąsiednie na kole kwintowym'],
      make(level) {
        const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
        const pool = level === 0 ? ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'] : majors;
        const kinds = [['rel'], ['rel', 'par'], ['rel', 'par', 'dom', 'sub']][level];
        const kind = weighted(this.id, kinds);
        const minor = Math.random() < 0.5;
        // Bez tonacji teoretycznych (np. ges-moll ma 9♭): wtedy losuj z pozostałych.
        const maj = T.parseNote(pick(kind === 'par' && !minor ? pool.filter((x) => !['Gb', 'Db'].includes(x)) : pool));
        const tonic = minor ? T.transpose(maj, T.parseInterval('6')) : maj;
        const mode = minor ? 'minor' : 'major';
        let target, tmode, q, why;
        const P = (sym) => T.parseInterval(sym);
        if (kind === 'rel') {
          target = minor ? T.transpose(tonic, P('b3')) : T.transpose(tonic, P('6')); tmode = minor ? 'major' : 'minor';
          q = 'równoległa'; why = minor ? 'Równoległa durowa leży tercję małą wyżej; te same znaki przykluczowe.' : 'Równoległa molowa leży tercję małą niżej (seksta wielka wyżej); te same znaki przykluczowe.';
        } else if (kind === 'par') {
          target = tonic; tmode = minor ? 'major' : 'minor';
          q = 'jednoimienna'; why = 'Jednoimienna ma tę samą tonikę i przeciwny tryb; różni się o 3 znaki przykluczowe.';
        } else if (kind === 'dom') {
          target = T.transpose(tonic, P('5')); tmode = mode;
          q = 'dominantowa (kwintę wyżej)'; why = 'Tonacja dominanty leży kwintę wyżej — na kole kwintowym sąsiad zgodnie z ruchem wskazówek; ma o jeden ♯ więcej (lub ♭ mniej).';
        } else {
          target = T.transpose(tonic, P('4')); tmode = mode;
          q = 'subdominantowa (kwintę niżej)'; why = 'Tonacja subdominanty leży kwintę niżej (kwartę wyżej) — sąsiad przeciwnie do ruchu wskazówek; ma o jeden ♭ więcej (lub ♯ mniej).';
        }
        const correct = keyLabel(target, tmode);
        const cand = [];
        const add = (n, m) => { const l = keyLabel(n, m); if (!cand.includes(l) && l !== correct && Math.abs(n.acc) <= 1) cand.push(l); };
        add(T.transpose(tonic, P('6')), 'minor'); add(T.transpose(tonic, P('b3')), 'major'); add(tonic, minor ? 'major' : 'minor');
        add(T.transpose(tonic, P('5')), mode); add(T.transpose(tonic, P('4')), mode); add(T.transpose(tonic, P('3')), tmode);
        add(T.transpose(tonic, P('b6')), tmode); add(T.transpose(tonic, P('2')), tmode);
        const answers = shuffle([correct, ...shuffle(cand).slice(0, 4)]).map((l) => ({ key: l, label: l }));
        const sig = (n, m) => { const k = T.keySignature(n, m); return k.count ? `${k.count}${k.type === 'sharp' ? '♯' : '♭'}` : 'bez znaków'; };
        return {
          prompt: h('span', {}, 'Jaka jest tonacja ', h('b', {}, q), ' do ', h('b', { class: 'big-sym' }, keyLabel(tonic, mode)), '?'),
          answers, correct, item: kind + mode,
          explain: (box) => box.append(h('p', {}, `${keyLabel(tonic, mode)} (${sig(tonic, mode)}) → ${correct} (${sig(target, tmode)}).`), h('p', { class: 'muted' }, why)),
        };
      },
    },
    {
      id: 'nct', group: 'Teoria', title: 'Dźwięki obce akordom',
      desc: 'Fragment melodii nad akordem — jaki to dźwięk obcy?',
      levels: ['przejściowy / pomocniczy', '+ dźwięk akordowy', '+ skokiem (inny obcy)'],
      make(level) {
        const sc = T.buildScale(T.parseNote(pick(['C', 'G', 'F', 'D', 'Bb'])), 'major');
        const dia = T.diatonicChords(sc, 3).filter((d) => d.degree !== 6);
        const kinds = [['przejściowy', 'pomocniczy'], ['przejściowy', 'pomocniczy', 'akordowy'], ['przejściowy', 'pomocniczy', 'akordowy', 'obcy']][level];
        const want = weighted(this.id, kinds);
        const inChord = (d, k) => d.chord.notes.some((n) => n.note.pc === sc.notes[T.mod(k, 7)].note.pc);
        let d, a, x, b, good = false;
        for (let t = 0; t < 300; t++) {
          d = pick(dia);
          a = pick([0, 1, 2, 3, 4, 5, 6].filter((k) => inChord(d, k)));
          if (want === 'przejściowy') { const dir = pick([1, -1]); x = a + dir; b = a + 2 * dir; }
          else if (want === 'pomocniczy') { x = a + pick([1, -1]); b = a; }
          else if (want === 'akordowy') { x = a + pick([2, -2]); b = x + pick([1, -1, 2]); }
          else { x = a + pick([3, -3, 4]); b = x + pick([1, -1]); }
          const ok = (want === 'akordowy' ? inChord(d, x) : !inChord(d, x)) && inChord(d, b) && [a, x, b].every((k) => k >= 0 && k <= 9);
          if (ok && (want !== 'obcy' || T.nonChordTone(a, x, b) === 'obcy')) { good = true; break; }
        }
        const tm = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
        const midi = (k) => tm + sc.notes[T.mod(k, 7)].iv.semi + 12 * Math.floor(k / 7);
        const note = (k) => sc.notes[T.mod(k, 7)].note;
        const v = T.smoothVoicing(d.chord, null, 52);
        const mel = [a, x, b];
        return {
          prompt: h('span', {}, `Akord `, h('b', {}, `${T.chordSymbol(d.chord, state.notation)} (${d.roman})`), `, melodia ${mel.map((k) => nn(note(k))).join(' – ')}. Czym jest środkowa nuta (${nn(note(x))})?`),
          answers: kinds.map((k) => ({ key: k, label: { przejściowy: 'dźwięk przejściowy', pomocniczy: 'dźwięk pomocniczy', akordowy: 'dźwięk akordowy', obcy: 'inny dźwięk obcy (skokiem)' }[k] })),
          correct: want, item: want, valid: good,
          play: () => { timers.forEach(clearTimeout); Sound.play([36 + d.chord.root.pc, ...v.midis], 'chord', 'piano', 2.4); timers = mel.map((k, i) => setTimeout(() => Sound.play([midi(k) + 12], 'chord', 'piano', 0.7), i * 600)); },
          show: (box) => { const st = staffBox(); I.renderMelody(st, mel.map((k, i) => [{ midi: midi(k) + 12, note: note(k), role: i === 1 ? 'ext' : null }]), { gap: 46, keySig: T.keySignature(sc.tonic, 'major'), labels: mel.map((k) => nn(note(k))) }); box.append(st); },
          explain: (box) => box.append(h('p', {}, `Akord ${T.chordSymbol(d.chord, state.notation)}: ${d.chord.notes.map((n) => nn(n.note)).join(' – ')}. ` +
            (want === 'akordowy' ? `${nn(note(x))} należy do akordu.` : want === 'przejściowy' ? `${nn(note(x))} łączy krokami dwa dźwięki akordu w jednym kierunku — to dźwięk przejściowy.`
              : want === 'pomocniczy' ? `${nn(note(x))} odchodzi o sekundę od dźwięku akordu i wraca — to dźwięk pomocniczy (ozdobnik).` : `${nn(note(x))} nie należy do akordu i pojawia się skokiem — nie jest ani przejściowy, ani pomocniczy.`))),
        };
      },
    },
    {
      id: 'read-note', group: 'Nuty', title: 'Czytanie nut',
      desc: 'Nazwij nutę na pięciolinii.',
      levels: ['na pięciolinii', '+ linie dodane', 'szeroki zakres'],
      options: [{ id: 'clef', label: 'Klucz', values: [['treble', 'wiolinowy'], ['bass', 'basowy'], ['mix', 'oba']] }],
      make(level, o) {
        const clef = o.clef === 'mix' ? pick(['treble', 'bass']) : o.clef || 'treble';
        const bottom = clef === 'bass' ? 18 : 30;
        const ext = [0, 3, 6][level];
        const steps = [];
        for (let s = bottom - ext; s <= bottom + 8 + ext; s++) steps.push(s);
        const step = weighted(this.id, steps, (s) => clef + s);
        const { note, midi } = noteAt(step);
        const letters = [0, 1, 2, 3, 4, 5, 6].map((l) => T.makeNote(l, 0));
        return {
          prompt: 'Jaka to nuta?',
          answers: letters.map((n) => ({ key: String(n.letter), label: nn(n) })),
          correct: String(note.letter), item: clef + step,
          play: () => Sound.play([midi]),
          show: (box) => {
            const st = staffBox();
            I.renderMelody(st, [[{ midi, note }]], { clef, gap: 60, minWidth: 150, scale: 1.5 });
            box.append(st);
          },
          explain: (box) => {
            box.append(h('p', {}, `To ${nn(note)}${octaveName(note, midi)} — ${placeText(step, clef)} w kluczu ${clef === 'bass' ? 'basowym' : 'wiolinowym'}.`),
              h('p', { class: 'muted' }, clef === 'bass'
                ? 'Klucz basowy (F): jego kropki obejmują 4. linię — to F3. Linie od dołu: G, H/B, D, F, A; pola: A, C, E, G.'
                : 'Klucz wiolinowy (G) zawija się wokół 2. linii — to G4. Linie od dołu: E, G, H/B, D, F; pola: F, A, C, E.'));
          },
        };
      },
    },
    {
      id: 'key-sig', group: 'Nuty', title: 'Znaki przykluczowe',
      desc: 'Rozpoznaj tonację po znakach przy kluczu.',
      levels: ['do 2 znaków (dur)', 'do 4 znaków, dur i moll', 'wszystkie, dur i moll'],
      make(level) {
        const max = [2, 4, 7][level];
        const keys = [];
        for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']) {
          const sig = T.keySignature(T.parseNote(k), 'major');
          if (sig.count > max) continue;
          keys.push({ key: k + ':major', tonic: T.parseNote(k), scale: 'major', sig });
          if (level > 0) {
            const rel = T.transpose(T.parseNote(k), T.parseInterval('6'));
            keys.push({ key: T.noteKey(rel) + ':minor', tonic: rel, scale: 'minor', sig });
          }
        }
        const q = weighted(this.id, keys, (x) => x.key);
        const name = (x) => keyLabel(x.tonic, x.scale);
        const pool = keys.filter((x) => x.key !== q.key);
        const rel = pool.find((x) => x.sig.count === q.sig.count && x.sig.type === q.sig.type);
        const near = pool.filter((x) => Math.abs(x.sig.count - q.sig.count) <= 1 && x !== rel);
        const others = shuffle([...(rel ? [rel] : []), ...shuffle(near).slice(0, 3), ...shuffle(pool)]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 5);
        const answers = shuffle([q, ...others]).map((x) => ({ key: x.key, label: name(x) }));
        return {
          prompt: level === 0 ? 'Jaka to tonacja durowa?' : 'Jaka to tonacja? Wskazówka: dur lub moll — w obu przypadkach znaki są te same, rozstrzyga tonika.',
          answers, correct: q.key, item: q.key,
          show: (box) => {
            const st = staffBox();
            const tm = midiOf(q.tonic, 4) > 69 ? midiOf(q.tonic, 3) : midiOf(q.tonic, 4);
            I.renderMelody(st, level > 0 ? [[{ midi: tm, note: q.tonic, role: 'root' }]] : [], { keySig: q.sig, gap: 50, minWidth: 170, scale: 1.4 });
            box.append(st);
            if (level > 0) box.append(h('p', { class: 'muted small-text' }, 'Nuta po znakach to tonika szukanej tonacji.'));
          },
          explain: (box) => {
            const maj = q.scale === 'major' ? q.tonic : q.sig.parent;
            const relMin = T.transpose(maj, T.parseInterval('6'));
            let rule;
            if (!q.sig.count) rule = 'Brak znaków: C-dur albo a-moll.';
            else if (q.sig.type === 'sharp') rule = `Ostatni krzyżyk (${nn(q.sig.notes[q.sig.count - 1])}) + półton w górę = tonika durowa ${nn(maj)}.`;
            else rule = q.sig.count === 1 ? 'Jeden bemol (B♭) to F-dur — warto zapamiętać.' : `Przedostatni bemol (${nn(q.sig.notes[q.sig.count - 2])}) to tonika durowa.`;
            box.append(h('p', {}, `${sigText(q.sig)} → ${nn(maj)}-dur lub równoległa ${nn(relMin).toLowerCase()}-moll (tercja mała niżej). Odpowiedź: ${name(q)}.`),
              h('p', { class: 'muted' }, rule));
          },
        };
      },
    },
    {
      id: 'name-interval', group: 'Teoria', title: 'Nazwij interwał z nut',
      desc: 'Odczytaj interwał z pięciolinii — liczba i rodzaj.',
      levels: ['od dźwięków bez znaków', '+ tryton, interwały ze znakami', '+ zwiększone i zmniejszone'],
      sets: [['b2', '2', 'b3', '3', '4', '5', 'b6', '6', 'b7', '7', '8'], ['b2', '2', 'b3', '3', '4', '#4', 'b5', '5', 'b6', '6', 'b7', '7', '8'],
        ['b2', '2', '#2', 'b3', '3', 'b4', '4', '#4', 'b5', '5', '#5', 'b6', '6', 'bb7', 'b7', '7', '8']],
      make(level) {
        const set = this.sets[level];
        let sym, low, top, lm;
        for (let tries = 0; tries < 50; tries++) {
          sym = weighted(this.id, set);
          low = T.parseNote(pick(level === 0 ? ROOTS_EASY : ROOTS_ALL));
          top = T.transpose(low, T.parseInterval(sym));
          if (Math.abs(top.acc) <= (level === 2 ? 2 : 1)) break;
        }
        lm = midiOf(low, 4);
        if (lm > 67) lm -= 12;
        const iv = T.parseInterval(sym);
        const sameDeg = set.filter((s) => T.parseInterval(s).deg === iv.deg && s !== sym);
        const near = set.filter((s) => Math.abs(T.parseInterval(s).semi - iv.semi) <= 1 && s !== sym);
        const distract = [...new Set([...sameDeg, ...shuffle(near), ...shuffle(set.filter((s) => s !== sym))])].slice(0, 5);
        return {
          prompt: 'Jaki to interwał?',
          answers: shuffle([sym, ...distract]).map((s) => ({ key: s, label: ivLabel(s) })),
          correct: sym, item: sym,
          play: () => seq([lm, lm + iv.semi]),
          show: (box) => {
            const st = staffBox();
            I.renderMelody(st, [[{ midi: lm, note: low }], [{ midi: lm + iv.semi, note: top }]], { gap: 56, minWidth: 180, scale: 1.4 });
            box.append(st);
          },
          explain: (box) => {
            const d = ivInfo(sym);
            const majTop = T.transpose(low, T.parseInterval(String(iv.deg)));
            box.append(h('p', {}, `${nn(low)} → ${nn(top)}: liczymy litery (${iv.deg}) i półtony (${iv.semi}) → ${d.name} (${d.pl}).`),
              h('p', { class: 'muted' }, `W skali ${nn(low)}-dur ${iv.deg}. stopień to ${nn(majTop)}`,
                (majTop.pc === top.pc && majTop.acc === top.acc ? ', więc interwał jest wielki/czysty.' : `; ${nn(top)} jest ${top.pc === T.mod(majTop.pc - 1, 12) ? 'o półton niżej' : top.pc === T.mod(majTop.pc + 1, 12) ? 'o półton wyżej' : 'o cały ton niżej'} → ${d.quality}.`)));
          },
        };
      },
    },
    {
      id: 'build-chord', group: 'Teoria', title: 'Zbuduj akord',
      desc: 'Wybierz dźwięki akordu o podanej nazwie — z poprawną pisownią.',
      levels: ['dur i moll', '+ zmniejszony, zwiększony, 7', '+ maj7, m7, m7♭5, °7, 6, 9'],
      sets: [['maj', 'min'], ['maj', 'min', 'dim', 'aug', '7'], ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'dim7', '6', 'm6', '9']],
      make(level) {
        const set = this.sets[level];
        const type = weighted(this.id, set);
        const root = T.parseNote(pick(level === 0 ? ROOTS_MED : ROOTS_ALL));
        const chord = T.buildChord(root, type);
        const correct = chord.notes.map((n) => n.note);
        const cands = [];
        const related = { maj: ['min', 'aug', 'sus4'], min: ['maj', 'dim', 'm7'], dim: ['min', 'm7b5', 'maj'], aug: ['maj', 'min', '7'],
          '7': ['maj7', 'm7', 'maj'], maj7: ['7', 'm7', 'mMaj7'], m7: ['7', 'm7b5', 'mMaj7'], m7b5: ['m7', 'dim7', '7'],
          dim7: ['m7b5', 'm7', '7'], '6': ['m6', 'maj7', '7'], m6: ['6', 'm7', 'min'], '9': ['maj9', 'm9', '7b9'] }[type] || ['maj', 'min'];
        for (const t of related) cands.push(T.buildChord(root, t).notes.map((n) => n.note));
        // Błędna pisownia: ten sam dźwięk pod inną nazwą (np. D♯ zamiast E♭).
        const idx = randInt(1, correct.length - 1);
        const alt = respell(correct[idx], pick([1, -1])) || respell(correct[idx], 1) || respell(correct[idx], -1);
        if (alt) cands.unshift(correct.map((n, i) => (i === idx ? alt : n)));
        const label = (ns) => chordNotesLabel(ns);
        const seen = new Set([label(correct)]);
        const opts = [];
        for (const c of cands) if (!seen.has(label(c)) && opts.length < 3) { seen.add(label(c)); opts.push(c); }
        const answers = shuffle([correct, ...opts]).map((ns) => ({ key: label(ns), label: label(ns) }));
        const notes = chordMidis(chord, 0, 60);
        return {
          prompt: h('span', {}, 'Z jakich dźwięków składa się akord ', h('b', { class: 'big-sym' }, T.chordSymbol(chord, state.notation)), '?'),
          answers, correct: label(correct), item: type, wide: true,
          play: () => Sound.play(notes.map((n) => n.midi), 'arp', 'piano', 1.2),
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [notes], { gap: 60 });
            box.append(h('p', {}, `${T.chordSymbol(chord, state.notation)} — akord ${chord.type.name}: wzór ${chord.notes.map((n) => n.info.symbol).join('–')}, półtony od prymy ${chord.notes.map((n) => n.iv.semi).join('–')}.`), st,
              h('p', { class: 'muted' }, 'Pamiętaj o pisowni: akord buduje się co tercję, więc nazwy literowe idą co drugą literę (np. C–E–G–B, E♭–G–B♭–D♭) — dlatego np. D♯ zamiast E♭ jest błędem, choć brzmi tak samo.'));
          },
        };
      },
    },
    {
      id: 'chord-name', group: 'Teoria', title: 'Nazwij akord z nut',
      desc: 'Odczytaj akord z pięciolinii i podaj jego symbol.',
      levels: ['trójdźwięki w postaci zasadniczej', '+ przewroty', '+ akordy septymowe'],
      sets: [['maj', 'min', 'dim', 'aug'], ['maj', 'min', 'dim', 'aug'], ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'dim7']],
      make(level) {
        const set = this.sets[level];
        const type = weighted(this.id, set);
        const root = T.parseNote(pick(level === 0 ? ROOTS_EASY : ROOTS_MED));
        const chord = T.buildChord(root, type);
        const inv = level === 0 ? 0 : randInt(0, chord.notes.length - 1);
        const notes = chordMidis(chord, inv, 60);
        const sym = (c) => T.chordSymbol(c, state.notation);
        const cands = shuffle(set.filter((t) => t !== type)).slice(0, 3).map((t) => T.buildChord(root, t));
        if (inv) cands.push(T.buildChord(T.inversion(chord, inv)[0].note, type));
        cands.push(T.buildChord(T.transpose(root, T.parseInterval('3')), type));
        const seen = new Set([sym(chord)]);
        const opts = [];
        for (const c of cands) if (!seen.has(sym(c)) && opts.length < 5) { seen.add(sym(c)); opts.push(c); }
        return {
          prompt: 'Jaki to akord?' + (inv ? ' (uwaga: może być w przewrocie — znajdź prymę, układając dźwięki tercjami)' : ''),
          answers: shuffle([chord, ...opts]).map((c) => ({ key: sym(c), label: sym(c) })),
          correct: sym(chord), item: type,
          play: () => Sound.play(notes.map((n) => n.midi), 'chord', 'piano', 2),
          show: (box) => {
            const st = staffBox();
            I.renderMelody(st, [notes.map((n) => ({ ...n, role: null }))], { gap: 60, minWidth: 150, scale: 1.4 });
            box.append(st);
          },
          explain: (box) => {
            const st = staffBox();
            I.renderMelody(st, [notes], { gap: 60, labels: [sym(chord)] });
            box.append(h('p', {}, `${sym(chord)} — ${chord.type.name}. Ułożone tercjami od prymy: ${chord.notes.map((n) => nn(n.note)).join(' – ')}`,
              inv ? `; w basie ${nn(T.inversion(chord, inv)[0].note)} (${['', 'I', 'II', 'III'][inv]} przewrót).` : '.'), st);
          },
        };
      },
    },
    {
      id: 'diatonic', group: 'Teoria', title: 'Akordy w tonacji',
      desc: 'Jaki akord leży na danym stopniu tonacji?',
      levels: ['tonacje durowe do 2 znaków', 'dur i moll, wszystkie', 'akordy septymowe'],
      make(level) {
        const keys = level === 0 ? ['C', 'G', 'D', 'F', 'Bb'] : ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
        const scaleId = level === 0 ? 'major' : pick(['major', 'major', 'minor']);
        const tonicKey = pick(keys);
        let tonic = T.parseNote(tonicKey);
        if (scaleId === 'minor') tonic = T.transpose(tonic, T.parseInterval('6'));
        const sc = T.buildScale(tonic, scaleId);
        const size = level === 2 ? 4 : 3;
        const dia = T.diatonicChords(sc, size);
        const d = weighted(this.id, dia, (x) => scaleId + x.degree);
        const types = size === 3 ? ['maj', 'min', 'dim', 'aug'] : ['maj7', '7', 'm7', 'm7b5'];
        const opts = types.map((t) => T.buildChord(d.chord.root, t));
        if (!opts.some((c) => c.type.id === d.chord.type.id)) opts[opts.length - 1] = d.chord;
        const keyName = keyLabel(tonic, scaleId);
        const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        return {
          prompt: h('span', {}, `Jaki ${size === 4 ? 'akord septymowy' : 'trójdźwięk'} leży na `, h('b', {}, `${ROM[d.degree]} stopniu`), ` tonacji `, h('b', {}, keyName), '?'),
          answers: opts.map((c) => ({ key: c.type.id, label: T.chordSymbol(c, state.notation) + ' — ' + c.type.name })),
          correct: d.chord.type.id, item: scaleId + d.degree,
          play: () => Sound.play(chordMidis(d.chord, 0, 60).map((n) => n.midi), 'chord', 'piano', 2),
          explain: (box) => {
            box.append(h('p', {}, `${ROM[d.degree]} stopień ${keyName} to ${nn(d.chord.root)}; dźwięki skali co tercję: ${d.chord.notes.map((n) => nn(n.note)).join(' – ')} → ${T.chordSymbol(d.chord, state.notation)} (${d.roman}).`),
              h('div', { class: 'chips' }, dia.map((x) => h('span', { class: 'chip' + (x === d ? ' active' : '') }, h('b', {}, x.roman + ' '), T.chordSymbol(x.chord, state.notation)))));
          },
        };
      },
    },
    {
      id: 'piano-chord', group: 'Instrumenty', title: 'Akord na klawiaturze',
      desc: 'Zaznacz na klawiaturze dźwięki podanego akordu (w dowolnym układzie).',
      levels: ['dur i moll', '+ zmniejszony, zwiększony, 7', '+ maj7, m7, m7♭5, °7, 6'],
      sets: [['maj', 'min'], ['maj', 'min', 'dim', 'aug', '7'], ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'dim7', '6', 'm6']],
      make(level) {
        const type = weighted(this.id, this.sets[level]);
        const root = T.parseNote(pick(level === 0 ? ROOTS_MED : ROOTS_ALL));
        const chord = T.buildChord(root, type);
        const notes = chordMidis(chord, 0, 60);
        return {
          input: 'piano', answers: [], item: type,
          prompt: h('span', {}, 'Zaznacz na klawiaturze akord ', h('b', { class: 'big-sym' }, T.chordSymbol(chord, state.notation)), ' i kliknij „Sprawdź”.'),
          correctLabel: chordNotesLabel(chord.notes.map((n) => n.note)),
          check: (sel) => {
            const pcs = new Set([...sel].map((m) => T.mod(m, 12)));
            return pcs.size === chord.pcs.size && [...chord.pcs].every((pc) => pcs.has(pc));
          },
          renderInput: (box, st) => pianoInput(box, st, (pc) => chord.pcs.has(pc), (pc) => {
            const n = chord.notes.find((x) => x.note.pc === pc); return n ? nn(n.note) : null;
          }),
          explain: (box) => {
            const hl = new Map(notes.map((n) => [n.midi, { label: nn(n.note), role: n.role }]));
            const pb = h('div', { class: 'quiz-piano' });
            I.renderPiano(pb, { startMidi: 48, octaves: 3, highlights: hl, onKey: (m) => Sound.play([m]) });
            box.append(h('p', {}, `${T.chordSymbol(chord, state.notation)}: ${chord.notes.map((n) => `${nn(n.note)} (${n.info.symbol}, ${n.iv.semi} pt)`).join(', ')}. Liczy się zestaw dźwięków — oktawa i przewrót są dowolne.`), pb);
            Sound.play(notes.map((n) => n.midi), 'chord', 'piano', 1.6);
          },
        };
      },
    },
    {
      id: 'piano-scale', group: 'Instrumenty', title: 'Skala na klawiaturze',
      desc: 'Zaznacz wszystkie dźwięki podanej skali.',
      levels: ['dur do 2 znaków', 'dur i moll naturalny', '+ moll harmoniczny i modusy'],
      make(level) {
        const ids = [['major'], ['major', 'minor'], ['major', 'minor', 'harmonicMinor', 'dorian', 'mixolydian', 'lydian', 'phrygian']][level];
        const roots = level === 0 ? ['C', 'G', 'D', 'F', 'Bb'] : ROOTS_MED;
        const id = weighted(this.id, ids);
        const sc = T.buildScale(T.parseNote(pick(roots)), id);
        const name = `${nn(sc.tonic)} ${sc.scale.name.toLowerCase()}`;
        const start = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
        const ms = [...sc.notes.map((n) => start + n.iv.semi), start + 12];
        return {
          input: 'piano', answers: [], item: id,
          prompt: h('span', {}, 'Zaznacz dźwięki skali ', h('b', {}, name), ' i kliknij „Sprawdź”.'),
          correctLabel: sc.notes.map((n) => nn(n.note)).join(' – '),
          check: (sel) => {
            const pcs = new Set([...sel].map((m) => T.mod(m, 12)));
            return pcs.size === sc.pcs.size && [...sc.pcs].every((pc) => pcs.has(pc));
          },
          renderInput: (box, st) => pianoInput(box, st, (pc) => sc.pcs.has(pc), (pc) => {
            const n = sc.notes.find((x) => x.note.pc === pc); return n ? nn(n.note) : null;
          }),
          explain: (box) => {
            const steps = sc.notes.map((n, i) => (i + 1 < sc.notes.length ? sc.notes[i + 1].iv.semi : 12) - n.iv.semi);
            const st = staffBox();
            I.renderMelody(st, ms.map((m, i) => [{ midi: m, note: i < sc.notes.length ? sc.notes[i].note : sc.tonic, role: i === 0 || i === ms.length - 1 ? 'root' : null }]), {
              keySig: T.keySignature(sc.tonic, id), gap: 30,
            });
            box.append(h('p', {}, `${name}: ${sc.notes.map((n) => nn(n.note)).join(' – ')}. Odległości w półtonach: ${steps.join(' ')}.`), st);
            Sound.play(ms, 'arp', 'piano', 1.0);
          },
        };
      },
    },
    {
      id: 'fret-note', group: 'Instrumenty', title: 'Dźwięki na gryfie',
      desc: 'Znajdź podany dźwięk na wskazanej strunie gitary.',
      levels: ['struny E i A, bez znaków', 'wszystkie struny, bez znaków', 'wszystkie struny, z ♯ i ♭'],
      make(level) {
        const tuning = T.TUNINGS[0].midi;
        const strings = level === 0 ? [0, 1] : [0, 1, 2, 3, 4, 5];
        const keys = level === 2 ? ROOTS_ALL : ROOTS_EASY;
        const pairs = [];
        for (const s of strings) for (const k of keys) pairs.push([s, k]);
        const [string, key] = weighted(this.id, pairs, (p) => p.join(':'));
        const note = T.parseNote(key);
        const fret = T.mod(note.pc - tuning[string], 12);
        const sName = (s) => nn(T.parseNote(['E', 'A', 'D', 'G', 'B', 'E'][s]));
        return {
          input: 'fret', answers: [], item: string + ':' + key,
          prompt: h('span', {}, 'Znajdź ', h('b', { class: 'big-sym' }, nn(note)), ` na strunie ${6 - string} (${sName(string)}).`),
          correctLabel: `próg ${fret}` + (fret + 12 <= 12 ? ` lub ${fret + 12}` : ''),
          check: (p) => p.s === string && T.mod(tuning[p.s] + p.f, 12) === note.pc,
          renderInput: (box, st) => {
            const fb = h('div', { class: 'scroll-x' }, h('div', { class: 'instrument' }));
            I.renderFretboard(fb.firstChild, {
              tuning, frets: 12, stringNames: [0, 1, 2, 3, 4, 5].map(sName),
              cell: (s, f) => {
                if (!st.answered) return null;
                const isTarget = s === string && T.mod(tuning[s] + f, 12) === note.pc;
                if (st.picked && st.picked.s === s && st.picked.f === f) return { label: nn(noteOfMidi(tuning[s] + f)), role: isTarget ? 'fifth' : 'root', strong: true };
                if (isTarget) return { label: nn(note), role: 'fifth', strong: true };
                if (T.mod(tuning[s] + f, 12) === note.pc) return { label: nn(note), role: 'scale', strong: false };
                return null;
              },
              cellTitle: (s, f) => `Struna ${6 - s}, ${f === 0 ? 'pusta' : 'próg ' + f}`,
              onCell: (s, f) => { Sound.play([tuning[s] + f], 'chord', 'guitar'); if (!st.answered) st.pick({ s, f }); },
            });
            box.append(fb);
          },
          explain: (box) => {
            box.append(h('p', {}, `${nn(note)} na strunie ${6 - string} (${sName(string)}) to próg ${fret}${fret + 12 <= 12 ? ` (i ${fret + 12})` : ''} — od pustej struny ${sName(string)} liczymy ${fret} półtonów w górę.`),
              h('p', { class: 'muted' }, 'Wskazówki: 12. próg to ta sama nazwa co pusta struna (oktawa wyżej). Ten sam dźwięk co na 5. progu jest na następnej (cieńszej) pustej strunie — poza struną G, gdzie trzeba wziąć 4. próg. Na szarych kropkach — ten sam dźwięk na innych strunach.'));
          },
        };
      },
    },
  ];

  /** Klawiatura do zaznaczania dźwięków; po sprawdzeniu: zielone dobre, czerwone błędne, kropki — brakujące. */
  function pianoInput(box, st, isRight, nameOf) {
    const pb = h('div', { class: 'quiz-piano' });
    const hl = new Map();
    for (const m of st.sel) {
      const pc = T.mod(m, 12);
      hl.set(m, st.answered ? { label: nameOf(pc) || nn(noteOfMidi(m)), role: isRight(pc) ? 'fifth' : 'root' } : { label: '●', role: 'sel' });
    }
    const missing = new Set();
    if (st.answered) {
      const chosen = new Set([...st.sel].map((m) => T.mod(m, 12)));
      for (let pc = 0; pc < 12; pc++) if (isRight(pc) && !chosen.has(pc)) missing.add(pc);
    }
    I.renderPiano(pb, {
      startMidi: 48, octaves: 2, highlights: hl, scalePcs: missing,
      onKey: (m) => { Sound.play([m]); if (!st.answered) st.toggle(m); },
    });
    box.append(pb);
    if (st.answered && missing.size) box.append(h('p', { class: 'muted small-text' }, 'Kropki na klawiszach — dźwięki, których zabrakło.'));
  }

  /* ---------- Interfejs ---------- */

  const exById = (id) => EXERCISES.find((e) => e.id === id);

  function loadHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const ex = exById(p.get('ex'));
    state.ex = ex ? ex.id : null;
    const lv = +p.get('lv');
    state.level = lv >= 0 && lv <= 2 ? lv : 0;
  }
  function saveHash() {
    history.replaceState(null, '', state.ex ? '#' + new URLSearchParams({ ex: state.ex, lv: state.level }) : location.pathname);
  }

  function optsFor(ex) {
    const saved = C.loadJSON('chordbuilder.quizopts', {});
    const o = {};
    for (const opt of ex.options || []) o[opt.id] = (saved[ex.id] && saved[ex.id][opt.id]) || opt.values[0][0];
    return o;
  }
  function saveOpt(exId, key, value) {
    const saved = C.loadJSON('chordbuilder.quizopts', {});
    saved[exId] = { ...(saved[exId] || {}), [key]: value };
    C.saveJSON('chordbuilder.quizopts', saved);
  }

  function renderMenu() {
    const groups = [...new Set(EXERCISES.map((e) => e.group))];
    $('menu').replaceChildren(...groups.map((g) => h('div', { class: 'quiz-group' },
      h('h3', {}, g),
      h('div', { class: 'quiz-tiles' }, EXERCISES.filter((e) => e.group === g).map((e) => {
        const s = exStats(e.id);
        return h('button', {
          type: 'button', class: 'quiz-tile' + (state.ex === e.id ? ' active' : ''),
          onclick: () => start(e.id),
        },
        h('span', { class: 'qt-title' }, e.title),
        h('span', { class: 'qt-desc' }, e.desc),
        h('span', { class: 'qt-stats' }, s.total ? `${s.ok}/${s.total} poprawnych (${Math.round((100 * s.ok) / s.total)}%) · najlepsza seria ${s.best}` : 'jeszcze nie ćwiczone'));
      })))));
  }

  function start(id) {
    state.test = null;
    state.ex = id;
    state.session = { ok: 0, total: 0, streak: 0 };
    state.opts = optsFor(exById(id));
    next();
    $('exercise').hidden = false;
    $('exercise').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function next() {
    const ex = exById(state.ex);
    timers.forEach(clearTimeout);
    stopRhythm();
    let q;
    for (let i = 0; i < 4; i++) {
      q = ex.make(state.level, state.opts);
      if (!state.q || q.item !== state.q.item) break; // unikaj powtórki z rzędu
    }
    state.q = q;
    state.answered = null;
    state.sel = new Set();
    state.seq = [];
    state.picked = null;
    render();
    if (q.play && (ex.group === 'Słuch')) q.play();
  }

  function seqPush(k) {
    const q = state.q;
    if (state.answered || !q || q.input !== 'seq') return;
    state.seq.push(k);
    const sc = q.sounds && q.sounds[k];
    if (sc != null) Sound.play([sc], 'chord', 'piano', 0.8);
    if (state.seq.length >= q.length) answer(state.seq.slice());
    else render();
  }

  function answer(key) {
    if (state.answered) return;
    const q = state.q;
    const ok = q.input ? q.check(key === undefined ? state.sel : key) : key === q.correct;
    state.answered = q.input ? 'input' : key;
    state.ok = ok;
    state.session.total++;
    if (ok) { state.session.ok++; state.session.streak++; } else state.session.streak = 0;
    record(state.ex, q.item, ok);
    const s = exStats(state.ex);
    if (state.session.streak > s.best) { s.best = state.session.streak; C.saveJSON(STATS_KEY, stats); }
    if (state.test && !state.test.done) {
      const t = state.test;
      const given = q.input ? '' : (q.answers.find((a) => a.key === key) || {}).label;
      t.log.push({ prompt: typeof q.prompt === 'string' ? q.prompt : q.prompt.textContent, given, correct: q.correctLabel || (q.answers.find((a) => a.key === q.correct) || {}).label, ok });
      if (ok) t.ok++;
      if (t.log.length >= t.n) t.done = true;
      render();
      if (!t.done) timers.push(setTimeout(next, 700));
      return;
    }
    render();
    const nb = $('next-btn');
    if (nb) nb.focus({ preventScroll: true });
  }

  function render() {
    renderMenu();
    saveHash();
    const box = $('exercise');
    if (!state.ex) { box.hidden = true; return; }
    const ex = exById(state.ex);
    const q = state.q;
    box.hidden = false;
    $('ex-title').textContent = ex.title;

    // Poziom i opcje
    const lv = $('ex-level');
    lv.replaceChildren(...ex.levels.map((l, i) => h('button', { type: 'button', 'data-value': i, class: i === state.level ? 'on' : '', 'aria-pressed': i === state.level, title: l }, ['Łatwy', 'Średni', 'Trudny'][i])));
    $('ex-level-desc').textContent = ex.levels[state.level];
    $('ex-options').replaceChildren(...(ex.options || []).map((opt) => h('label', { class: 'field' }, h('span', {}, opt.label),
      (() => {
        const sel = h('select', { onchange: (e) => { state.opts[opt.id] = e.target.value; saveOpt(ex.id, opt.id, e.target.value); next(); } });
        for (const [v, l] of opt.values) sel.append(new Option(l, v, false, state.opts[opt.id] === v));
        return sel;
      })())));

    $('ex-share').replaceChildren(SEED
      ? h('span', { class: 'share-note' }, `Zestaw wspólny: ${SEED} — wszyscy z tym linkiem dostają te same pytania.`)
      : h('button', { type: 'button', class: 'btn ghost small', title: 'Link, po którym cała klasa dostanie te same pytania w tej samej kolejności', onclick: shareLink }, '🔗 Link dla klasy'),
    state.test ? null : h('button', { type: 'button', class: 'btn ghost small', title: '10 pytań bez podpowiedzi; wynik i błędy na końcu', onclick: () => startTest() }, '📝 Sprawdzian (10 pytań)'));
    const sess = state.session;
    $('ex-score').textContent = sess.total ? `Ta sesja: ${sess.ok}/${sess.total} · seria ${sess.streak}` : 'Ta sesja: —';

    $('ex-prompt').replaceChildren(q.prompt);
    const media = $('ex-media');
    media.replaceChildren();
    if (q.show) q.show(media);
    if (q.play) {
      media.append(h('div', { class: 'controls tight' },
        h('button', { type: 'button', class: 'btn' + (ex.group === 'Słuch' ? '' : ' ghost'), onclick: () => q.play() }, ex.group === 'Słuch' ? '▶ Odtwórz ponownie (spacja)' : '▶ Posłuchaj')));
    }

    if (q.input && q.renderInput) {
      const ibox = h('div', { class: 'quiz-instrument' });
      q.renderInput(ibox, {
        sel: state.sel, picked: state.picked, answered: !!state.answered,
        toggle: (m) => { if (state.sel.has(m)) state.sel.delete(m); else state.sel.add(m); render(); },
        pick: (v) => { state.picked = v; answer(v); },
      });
      media.prepend(ibox);
    }

    $('midi-btn').hidden = q.input !== 'piano' || midiOn;
    $('ex-answers').className = 'quiz-answers' + (q.wide ? ' wide' : '') + (q.rhythm ? ' rhythm' : '');
    if (q.input === 'piano') {
      $('ex-answers').replaceChildren(
        h('button', { type: 'button', class: 'btn', disabled: !!state.answered || !state.sel.size, onclick: () => answer() }, '✓ Sprawdź (Enter)'),
        h('button', { type: 'button', class: 'btn ghost', disabled: !!state.answered || !state.sel.size, onclick: () => { state.sel.clear(); render(); } }, 'Wyczyść'));
      $('ex-answers').className = 'quiz-answers inline';
    } else if (q.input === 'seq') {
      const done = !!state.answered;
      const slots = h('div', { class: 'seq-slots' }, Array.from({ length: q.length }, (_, i) => {
        const v = state.seq[i];
        let cls = 'seq-slot' + (v != null ? ' filled' : '') + (i === state.seq.length && !done ? ' next' : '');
        if (done && v != null) cls += v === q.correctSeq[i] ? ' ok' : ' bad';
        return h('span', { class: cls }, v != null ? q.choices.find((c) => c.key === v).label : '');
      }));
      $('ex-answers').className = 'quiz-seq';
      $('ex-answers').replaceChildren(slots,
        h('div', { class: 'seq-keys' }, q.choices.map((c, i) => h('button', {
          type: 'button', class: 'quiz-answer seq-key', disabled: done,
          onclick: () => seqPush(c.key),
        }, h('kbd', {}, String(i + 1)), h('span', {}, c.label))),
        h('button', { type: 'button', class: 'btn ghost', disabled: done || !state.seq.length, onclick: () => { state.seq.pop(); render(); } }, '⌫ Cofnij')));
    } else if (q.input) {
      $('ex-answers').replaceChildren();
    } else
    $('ex-answers').replaceChildren(...q.answers.map((a, i) => {
      let cls = 'quiz-answer';
      if (state.answered) {
        if (a.key === q.correct) cls += ' correct';
        else if (a.key === state.answered) cls += ' wrong';
        else cls += ' dim';
      }
      return h('button', { type: 'button', class: cls, disabled: !!state.answered, onclick: () => answer(a.key) },
        i < 9 ? h('kbd', {}, String(i + 1)) : null, h('span', {}, a.label));
    }));

    const fb = $('ex-feedback');
    fb.replaceChildren();
    fb.hidden = !state.answered;
    if (state.test) {
      const t = state.test;
      $('ex-score').textContent = t.done ? `Sprawdzian: ${t.ok}/${t.n}` : `Sprawdzian: pytanie ${Math.min(t.log.length + (state.answered ? 0 : 1), t.n)} z ${t.n}`;
      if (state.answered && !t.done) {
        fb.className = 'quiz-feedback';
        fb.append(h('div', { class: 'qf-head' }, h('b', {}, 'Odpowiedź zapisana — następne pytanie…')));
        return;
      }
      if (t.done) {
        const pct = Math.round((100 * t.ok) / t.n);
        fb.className = 'quiz-feedback ' + (pct >= 50 ? 'ok' : 'bad');
        fb.append(h('div', { class: 'qf-head' }, h('b', {}, `Wynik sprawdzianu: ${t.ok}/${t.n} (${pct}%)`)),
          t.log.some((x) => !x.ok) ? h('p', {}, 'Błędne odpowiedzi:') : h('p', {}, 'Wszystko dobrze — gratulacje!'),
          h('ol', { class: 'test-log' }, t.log.map((x, i) => (x.ok ? null : h('li', { value: i + 1 },
            h('span', {}, x.prompt), ' — ', x.given ? h('span', { class: 'no' }, x.given) : null, x.given ? ' → ' : '', h('b', {}, x.correct))))),
          h('div', { class: 'controls tight' },
            h('button', { type: 'button', class: 'btn', id: 'next-btn', onclick: () => startTest() }, 'Nowy sprawdzian'),
            h('button', { type: 'button', class: 'btn ghost', onclick: (e) => copyResult(e.currentTarget) }, '📋 Kopiuj wynik'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.test = null; next(); } }, 'Wróć do ćwiczenia')));
        return;
      }
    }
    if (state.answered) {
      const ok = state.ok;
      fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
      const correctLabel = q.correctLabel || (q.answers.find((a) => a.key === q.correct) || {}).label;
      fb.append(h('div', { class: 'qf-head' }, h('b', {}, ok ? '✓ Dobrze!' : '✗ Niestety.'),
        ok || !correctLabel ? null : h('span', {}, ' Poprawna odpowiedź: ', h('b', {}, correctLabel))));
      q.explain(fb);
      fb.append(h('div', { class: 'controls tight' }, h('button', { type: 'button', class: 'btn', id: 'next-btn', onclick: next }, 'Dalej → (Enter)')));
    }
  }

  /** Tekst wyniku do wysłania nauczycielowi. */
  function copyResult(btn) {
    const t = state.test, ex = exById(state.ex);
    const en = window.I18N && window.I18N.lang === 'en';
    const lvl = (en ? ['Easy', 'Medium', 'Hard'] : ['Łatwy', 'Średni', 'Trudny'])[state.level];
    const title = window.I18N ? window.I18N.t(ex.title) : ex.title;
    const text = (en ? `ChordBuilder — test: ${title} (${lvl})` : `ChordBuilder — sprawdzian: ${title} (${lvl})`) +
      (SEED ? (en ? `, class set ${SEED}` : `, zestaw ${SEED}`) : '') +
      `\n${en ? 'Score' : 'Wynik'}: ${t.ok}/${t.n} (${Math.round((100 * t.ok) / t.n)}%) · ${new Date().toLocaleString(en ? 'en-GB' : 'pl-PL')}`;
    const done = () => { btn.textContent = en ? '✓ Copied' : '✓ Skopiowano'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt('', text));
    else prompt('', text);
  }

  function startTest() {
    state.test = { n: 10, ok: 0, log: [], done: false };
    state.session = { ok: 0, total: 0, streak: 0 };
    next();
  }

  function shareLink() {
    const code = Math.random().toString(36).slice(2, 8);
    const u = new URL(location.href);
    u.search = '?seed=' + code;
    u.hash = new URLSearchParams({ ex: state.ex, lv: state.level }).toString();
    const url = u.toString();
    const done = () => { $('ex-share').replaceChildren(h('span', { class: 'share-note' }, 'Skopiowano link: ', h('a', { href: url }, url))); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  }

  function bind() {
    C.seg($('notation'), state.notation, (v) => { state.notation = v; C.savePref('notation', v); if (state.ex) next(); else render(); });
    $('ex-level').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      state.level = +b.dataset.value;
      state.test = null;
      state.session = { ok: 0, total: 0, streak: 0 };
      next();
    });
    $('ex-close').addEventListener('click', () => { state.ex = null; state.q = null; timers.forEach(clearTimeout); render(); $('menu').scrollIntoView({ behavior: 'smooth' }); });
    $('reset-stats').addEventListener('click', () => {
      if (!confirm('Wyzerować statystyki wszystkich ćwiczeń zapisane w tej przeglądarce?')) return;
      for (const k of Object.keys(stats)) delete stats[k];
      C.saveJSON(STATS_KEY, stats);
      render();
    });
    $('midi-btn').addEventListener('click', () => {
      const held = new Set();
      C.connectMidi({
        status: (t) => { $('midi-status').textContent = t; },
        on: (m) => {
          if (!state.q || state.q.input !== 'piano' || state.answered) return;
          if (!held.size) state.sel.clear(); // nowy akord po puszczeniu klawiszy
          held.add(m);
          while (m < 48) m += 12; // na widoczną klawiaturę C3–H4
          while (m > 71) m -= 12;
          state.sel.add(m);
          render();
        },
        off: (m) => { held.delete(m); },
      }).then((ok) => { midiOn = ok; render(); });
    });
    window.addEventListener('hashchange', () => {
      const before = state.ex + '/' + state.level;
      loadHash();
      if (before === state.ex + '/' + state.level) return;
      if (state.ex) start(state.ex); else render();
    });
    document.addEventListener('keydown', (e) => {
      if (!state.ex || !state.q || e.target.closest('select, input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && !state.answered && state.q.input === 'seq') {
        const c = state.q.choices[+e.key - 1];
        if (c) { e.preventDefault(); seqPush(c.key); }
      } else if (e.key === 'Backspace' && !state.answered && state.q.input === 'seq' && state.seq.length) {
        e.preventDefault(); state.seq.pop(); render();
      } else if (/^[1-9]$/.test(e.key) && !state.answered && !state.q.input) {
        const a = state.q.answers[+e.key - 1];
        if (a) { e.preventDefault(); answer(a.key); }
      } else if (e.key === ' ' && state.q.play && !e.target.closest('button')) {
        e.preventDefault(); state.q.play();
      } else if (e.key === 'Enter' && !state.answered && state.q.input === 'piano' && state.sel.size && !e.target.closest('button')) {
        e.preventDefault(); answer();
      } else if (e.key === 'Enter' && state.answered && !(state.test) && !e.target.closest('button')) {
        e.preventDefault(); next();
      }
    });
  }

  // Generatory pytań dostępne też dla karty ćwiczeń do druku (worksheet.html) i testów.
  window.QuizExercises = EXERCISES;
  window.QuizSetNotation = (n) => { state.notation = n === 'H' ? 'H' : 'intl'; };
  if (!$('exercise')) return; // strona bez interfejsu ćwiczeń

  loadHash();
  bind();
  if (state.ex) {
    state.opts = optsFor(exById(state.ex));
    state.q = exById(state.ex).make(state.level, state.opts);
  }
  render();
  C.registerSW();
})();
