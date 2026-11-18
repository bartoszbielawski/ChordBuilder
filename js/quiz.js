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

  const STATS_KEY = 'chordbuilder.quiz';
  const prefs = C.loadPrefs();
  const state = {
    notation: prefs.notation === 'H' ? 'H' : 'intl',
    ex: null, level: 1, opts: {}, q: null, answered: null, ok: false, sel: new Set(), picked: null,
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
        const name = (x) => x.scale === 'major' ? `${nn(x.tonic)}-dur` : `${nn(x.tonic).toLowerCase()}-moll`;
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
              h('p', { class: 'muted' }, `W skali ${nn(low)}-dur ${iv.deg}. stopień to ${nn(majTop)}` +
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
            box.append(h('p', {}, `${sym(chord)} — ${chord.type.name}. Ułożone tercjami od prymy: ${chord.notes.map((n) => nn(n.note)).join(' – ')}` +
              (inv ? `; w basie ${nn(T.inversion(chord, inv)[0].note)} (${['', 'I', 'II', 'III'][inv]} przewrót).` : '.')), st);
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
        const keyName = scaleId === 'major' ? `${nn(tonic)}-dur` : `${nn(tonic).toLowerCase()}-moll`;
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
    let q;
    for (let i = 0; i < 4; i++) {
      q = ex.make(state.level, state.opts);
      if (!state.q || q.item !== state.q.item) break; // unikaj powtórki z rzędu
    }
    state.q = q;
    state.answered = null;
    state.sel = new Set();
    state.picked = null;
    render();
    if (q.play && (ex.group === 'Słuch')) q.play();
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

    if (q.input) {
      const ibox = h('div', { class: 'quiz-instrument' });
      q.renderInput(ibox, {
        sel: state.sel, picked: state.picked, answered: !!state.answered,
        toggle: (m) => { if (state.sel.has(m)) state.sel.delete(m); else state.sel.add(m); render(); },
        pick: (v) => { state.picked = v; answer(v); },
      });
      media.prepend(ibox);
    }

    $('ex-answers').className = 'quiz-answers' + (q.wide ? ' wide' : '');
    if (q.input === 'piano') {
      $('ex-answers').replaceChildren(
        h('button', { type: 'button', class: 'btn', disabled: !!state.answered || !state.sel.size, onclick: () => answer() }, '✓ Sprawdź (Enter)'),
        h('button', { type: 'button', class: 'btn ghost', disabled: !!state.answered || !state.sel.size, onclick: () => { state.sel.clear(); render(); } }, 'Wyczyść'));
      $('ex-answers').className = 'quiz-answers inline';
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

  function bind() {
    C.seg($('notation'), state.notation, (v) => { state.notation = v; C.savePref('notation', v); if (state.ex) next(); else render(); });
    $('ex-level').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      state.level = +b.dataset.value;
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
    window.addEventListener('hashchange', () => {
      const before = state.ex + '/' + state.level;
      loadHash();
      if (before === state.ex + '/' + state.level) return;
      if (state.ex) start(state.ex); else render();
    });
    document.addEventListener('keydown', (e) => {
      if (!state.ex || !state.q || e.target.closest('select, input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && !state.answered && !state.q.input) {
        const a = state.q.answers[+e.key - 1];
        if (a) { e.preventDefault(); answer(a.key); }
      } else if (e.key === ' ' && state.q.play && !e.target.closest('button')) {
        e.preventDefault(); state.q.play();
      } else if (e.key === 'Enter' && !state.answered && state.q.input === 'piano' && state.sel.size && !e.target.closest('button')) {
        e.preventDefault(); answer();
      } else if (e.key === 'Enter' && state.answered && !e.target.closest('button')) {
        e.preventDefault(); next();
      }
    });
  }

  loadHash();
  bind();
  if (state.ex) {
    state.opts = optsFor(exById(state.ex));
    state.q = exById(state.ex).make(state.level, state.opts);
  }
  render();
  C.registerSW();

  // Do testów: dostęp do generatorów pytań.
  window.QuizExercises = EXERCISES;
})();
