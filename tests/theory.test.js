/*
 * Testy logiki teorii muzyki (js/theory.js).
 * Działają w przeglądarce (tests/index.html) i w Node (tests/run-node.js).
 * Każdy test: [nazwa, (T, eq, ok) => { ... }].
 */
(function (root) {
  'use strict';

  const names = (T, list, notation) => list.map((n) => T.noteName(n.note || n, notation)).join(' ');
  const scaleNames = (T, tonic, id) => names(T, T.buildScale(T.parseNote(tonic), id).notes);
  const chordNames = (T, root, type) => names(T, T.buildChord(T.parseNote(root), type).notes);
  const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const fr = (v) => v.frets.map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : f)).join('');
  const recog = (T, midis) => T.recognize(midis).map((c) =>
    PC[c.rootPc] + c.type.symbol + (c.bassPc !== c.rootPc ? '/' + PC[c.bassPc] : '') + (c.kind === 'no5' ? '(no5)' : ''));

  const tests = [
    /* ---------- Pisownia skal ---------- */
    ['C-dur', (T, eq) => eq(scaleNames(T, 'C', 'major'), 'C D E F G A B')],
    ['F-dur ma B♭', (T, eq) => eq(scaleNames(T, 'F', 'major'), 'F G A B♭ C D E')],
    ['C♯-dur ma E♯ i B♯', (T, eq) => eq(scaleNames(T, 'C#', 'major'), 'C♯ D♯ E♯ F♯ G♯ A♯ B♯')],
    ['G♭-dur ma C♭', (T, eq) => eq(scaleNames(T, 'Gb', 'major'), 'G♭ A♭ B♭ C♭ D♭ E♭ F')],
    ['d-moll harmoniczna ma C♯', (T, eq) => eq(scaleNames(T, 'D', 'harmonicMinor'), 'D E F G A B♭ C♯')],
    ['E♭ dorycka', (T, eq) => eq(scaleNames(T, 'Eb', 'dorian'), 'E♭ F G♭ A♭ B♭ C D♭')],
    ['A pentatonika molowa', (T, eq) => eq(scaleNames(T, 'A', 'minorPentatonic'), 'A C D E G')],
    ['Skale 7-dźwiękowe mają 7 różnych liter (wszystkie toniki)', (T, eq, ok) => {
      const tonics = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      for (const s of T.SCALES.filter((x) => x.intervals.length === 7)) {
        for (const t of tonics) {
          const sc = T.buildScale(T.parseNote(t), s.id);
          ok(new Set(sc.notes.map((n) => n.note.letter)).size === 7, `${t} ${s.id}`);
          ok(sc.notes.every((n) => Math.abs(n.note.acc) <= 2), `${t} ${s.id}: maks. podwójny znak`);
        }
      }
    }],

    /* ---------- Notacja ---------- */
    ['Notacja H: B→H, B♭→B', (T, eq) => {
      eq(T.noteName(T.parseNote('B'), 'H'), 'H');
      eq(T.noteName(T.parseNote('Bb'), 'H'), 'B');
      eq(T.noteName(T.parseNote('Bbb'), 'H'), 'B♭');
      eq(T.noteName(T.parseNote('B#'), 'H'), 'H♯');
      eq(T.noteName(T.parseNote('A'), 'H'), 'A');
    }],

    /* ---------- Interwały ---------- */
    ['Nazwy interwałów', (T, eq) => {
      const n = (d, s) => T.describeInterval(d, s).name;
      eq(n(1, 0), 'pryma czysta');
      eq(n(3, 4), 'tercja wielka');
      eq(n(3, 3), 'tercja mała');
      eq(n(5, 7), 'kwinta czysta');
      eq(n(5, 6), 'kwinta zmniejszona (tryton)');
      eq(n(4, 6), 'kwarta zwiększona (tryton)');
      eq(n(5, 8), 'kwinta zwiększona');
      eq(n(7, 9), 'septyma zmniejszona');
      eq(n(7, 10), 'septyma mała');
      eq(n(9, 13), 'nona mała');
      eq(n(11, 18), 'undecyma zwiększona');
      eq(n(13, 21), 'tercdecyma wielka');
    }],
    ['Symbole i skróty interwałów', (T, eq) => {
      eq(T.describeInterval(3, 3).symbol, '♭3');
      eq(T.describeInterval(7, 9).symbol, '♭♭7');
      eq(T.describeInterval(9, 15).symbol, '♯9');
      eq(T.describeInterval(7, 11).abbr, 'M7');
      eq(T.describeInterval(5, 7).abbr, 'P5');
    }],
    ['Interwał między dźwiękami', (T, eq) => {
      const iv = (a, b) => T.intervalBetween(T.parseNote(a), T.parseNote(b)).name;
      eq(iv('C', 'E'), 'tercja wielka');
      eq(iv('E', 'G'), 'tercja mała');
      eq(iv('B', 'F'), 'kwinta zmniejszona (tryton)');
      eq(iv('F', 'B'), 'kwarta zwiększona (tryton)');
      eq(iv('C', 'D#'), 'sekunda zwiększona');
      eq(iv('C', 'Eb'), 'tercja mała');
    }],

    /* ---------- Akordy ---------- */
    ['Budowa akordów', (T, eq) => {
      eq(chordNames(T, 'C', 'maj7'), 'C E G B');
      eq(chordNames(T, 'C', 'dim7'), 'C E♭ G♭ B♭♭');
      eq(chordNames(T, 'F#', 'm7b5'), 'F♯ A C E');
      eq(chordNames(T, 'Bb', '7s9'), 'B♭ D F A♭ C♯');
      eq(chordNames(T, 'Eb', 'aug'), 'E♭ G B');
      eq(chordNames(T, 'G', '13'), 'G B D F A E');
    }],
    ['Przewroty', (T, eq) => {
      const c = T.buildChord(T.parseNote('C'), 'maj');
      eq(T.inversion(c, 0).map((n) => n.semiAbs), [0, 4, 7]);
      eq(T.inversion(c, 1).map((n) => n.semiAbs), [4, 7, 12]);
      eq(T.inversion(c, 2).map((n) => n.semiAbs), [7, 12, 16]);
      const c9 = T.buildChord(T.parseNote('C'), 'add9');
      eq(T.inversion(c9, 3).map((n) => n.semiAbs), [14, 24, 28, 31]);
    }],
    ['Akordy diatoniczne C-dur (trójdźwięki)', (T, eq) => {
      const d = T.diatonicChords(T.buildScale(T.parseNote('C'), 'major'), 3);
      eq(d.map((x) => x.roman + ':' + T.chordSymbol(x.chord)).join(' '), 'I:C ii:Dm iii:Em IV:F V:G vi:Am vii°:B°');
    }],
    ['Akordy diatoniczne a-moll harmonicznej (septymowe)', (T, eq) => {
      const d = T.diatonicChords(T.buildScale(T.parseNote('A'), 'harmonicMinor'), 4);
      eq(d.map((x) => x.roman + ':' + T.chordSymbol(x.chord)).join(' '),
        'i(maj7):Am(maj7) iiø7:Bm7♭5 III+maj7:C+maj7 iv7:Dm7 V7:E7 VImaj7:Fmaj7 vii°7:G♯°7');
    }],
    ['Oznaczenia rzymskie', (T, eq) => {
      const t = (id) => T.chordTypeById(id);
      eq(T.romanFor(7, -1, t('maj')), '♭VII');
      eq(T.romanFor(6, 0, t('min')), 'vi');
      eq(T.romanFor(1, 0, t('m6')), 'i6');
      eq(T.romanFor(2, 0, t('m7b5')), 'iiø7');
      eq(T.romanFor(5, 0, t('7')), 'V7');
      eq(T.romanFor(4, 1, t('dim')), '♯iv°');
    }],
    ['Akordy pasujące do skali', (T, eq, ok) => {
      const f = T.fittingChords(T.buildScale(T.parseNote('F'), 'major'));
      const d = f[5].chords.map((c) => T.chordSymbol(c));
      ok(d.includes('Dm') && d.includes('Dm7') && d.includes('Dsus4'), d.join(','));
      ok(!d.includes('Dm6') && !d.includes('D'), 'Dm6 i D nie pasują do F-dur');
    }],

    /* ---------- Rozpoznawanie ---------- */
    ['Rozpoznawanie akordów', (T, eq) => {
      eq(recog(T, [48, 52, 55])[0], 'C');
      eq(recog(T, [52, 55, 60])[0], 'C/E');
      eq(recog(T, [48, 52, 55, 57])[0], 'C6');
      eq(recog(T, [45, 48, 52, 55])[0], 'Am7');
      eq(recog(T, [48, 52, 58])[0], 'C7(no5)');
      eq(recog(T, [50, 60, 64, 67])[0], 'Cadd9/D');
      eq(recog(T, [48, 55])[0], 'C5');
      // °7 jest symetryczny: 4 dokładne odczytania (+ np. D°/B jako akord z obcym basem).
      eq(T.recognize([47, 50, 53, 56]).filter((c) => c.kind === 'exact').length, 4);
      eq(recog(T, [48, 49, 50]).length, 0);
      eq(recog(T, [60]).length, 0);
    }],

    /* ---------- Chwyty gitarowe ---------- */
    ['Klasyczne chwyty są na pierwszym miejscu', (T, eq) => {
      const best = (r, t) => { const c = T.buildChord(T.parseNote(r), t); return fr(T.findVoicings(c, c.root.pc, T.TUNINGS[0])[0]); };
      eq(best('C', 'maj'), 'x32010');
      eq(best('G', 'maj'), '320003');
      eq(best('E', 'min'), '022000');
      eq(best('A', 'm7'), 'x02010');
      eq(best('F', 'maj'), '133211');
      eq(best('D', 'maj'), 'xx0232');
    }],
    ['Każdy chwyt ma poprawny bas i dźwięki akordu', (T, eq, ok) => {
      const tuning = T.TUNINGS[0].midi;
      for (const type of ['maj', 'min', '7', 'maj7', 'm7', 'dim', 'sus4', '9']) {
        for (const r of ['C', 'Eb', 'F#', 'A']) {
          const c = T.buildChord(T.parseNote(r), type);
          for (const inv of [0, 1]) {
            const bass = T.inversion(c, inv)[0].note.pc;
            for (const v of T.findVoicings(c, bass, T.TUNINGS[0])) {
              const sounding = v.frets.map((f, s) => (f >= 0 ? T.mod(tuning[s] + f, 12) : null)).filter((x) => x !== null);
              ok(sounding[0] === bass, `${r}${type} inv${inv} ${fr(v)}: bas`);
              ok(sounding.every((pc) => c.pcs.has(pc)), `${r}${type} ${fr(v)}: obce dźwięki`);
              const fretted = v.frets.filter((f) => f > 0);
              ok(!fretted.length || Math.max(...fretted) - Math.min(...fretted) <= 3, `${r}${type} ${fr(v)}: rozpiętość`);
            }
          }
        }
      }
    }],

    /* ---------- Progresje ---------- */
    ['Progresje budują się we wszystkich tonacjach', (T, eq, ok) => {
      for (const p of T.PROGRESSIONS) {
        for (const t of ['C', 'G', 'F', 'Bb', 'F#', 'Db', 'A', 'E']) {
          const tonic = T.parseNote(t);
          for (const s of p.steps) {
            const c = T.buildChord(T.transpose(tonic, s.iv), s.type);
            ok(c.type.id === s.type && c.notes.every((n) => Math.abs(n.note.acc) <= 2), `${p.id} w ${t}`);
          }
        }
      }
    }],
    ['Blues w E: E7 A7 B7', (T, eq) => {
      const p = T.PROGRESSIONS.find((x) => x.id === 'blues');
      const syms = p.steps.map((s) => T.chordSymbol(T.buildChord(T.transpose(T.parseNote('E'), s.iv), s.type)));
      eq([...new Set(syms)].join(' '), 'E7 A7 B7');
    }],
  ];

  /** Uruchamia testy; zwraca listę wyników { name, ok, errors[] }. */
  function run(T) {
    return tests.map(([name, fn]) => {
      const errors = [];
      const eq = (a, b, msg) => {
        const sa = JSON.stringify(a), sb = JSON.stringify(b);
        if (sa !== sb) errors.push(`${msg ? msg + ': ' : ''}oczekiwano ${sb}, jest ${sa}`);
      };
      const ok = (cond, msg) => { if (!cond) errors.push(msg || 'warunek niespełniony'); };
      try { fn(T, eq, ok); } catch (e) { errors.push('wyjątek: ' + (e && e.message)); }
      return { name, ok: errors.length === 0, errors };
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { run, tests };
  else root.TheoryTests = { run, tests };
})(typeof window !== 'undefined' ? window : globalThis);
