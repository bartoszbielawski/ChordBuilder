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

    /* ---------- Interwały ---------- */
    ['Interwały między dźwiękami (także złożone)', (T, eq) => {
      const iv = (a, am, b, bm) => T.intervalOf(T.parseNote(a), am, T.parseNote(b), bm).abbr;
      eq(iv('C', 60, 'E', 64), 'M3');
      eq(iv('C', 60, 'Eb', 63), 'm3');
      eq(iv('C', 60, 'D#', 63), 'A2');
      eq(iv('F', 65, 'B', 71), 'A4');
      eq(iv('B', 59, 'F', 65), 'd5');
      eq(iv('C', 60, 'C', 72), 'P8');
      eq(iv('C', 60, 'D', 74), 'M9');
      eq(iv('E', 64, 'C', 72), 'm6');
      eq(iv('B', 71, 'C', 72), 'm2');
      eq(iv('Cb', 59, 'B#', 72), 'AA7');
    }],
    ['Przewroty interwałów', (T, eq) => {
      const inv = (d, s) => T.invertInterval(d, s).abbr;
      eq(inv(3, 4), 'm6');
      eq(inv(3, 3), 'M6');
      eq(inv(4, 6), 'd5');
      eq(inv(5, 7), 'P4');
      eq(inv(2, 1), 'M7');
      eq(inv(1, 0), 'P8');
      eq(inv(8, 12), 'P1');
      eq(inv(10, 16), 'm6');
    }],
    ['Konsonanse i dysonanse', (T, eq) => {
      const c = (d, s) => T.consonance(T.describeInterval(d, s)).id;
      eq(c(5, 7), 'perfect');
      eq(c(8, 12), 'perfect');
      eq(c(3, 3), 'imperfect');
      eq(c(6, 9), 'imperfect');
      eq(c(4, 5), 'fourth');
      eq(c(2, 2), 'dis');
      eq(c(4, 6), 'dis');
      eq(c(2, 3), 'dis');
    }],
    ['Enharmonia interwałów', (T, eq) => {
      const e = (s) => T.enharmonicIntervals(s).map((d) => d.abbr).join(' ');
      eq(e(6), 'A4 d5');
      eq(e(3), 'A2 m3');
      eq(e(0), 'P1 d2');
      eq(e(12), 'A7 P8');
    }],

    /* ---------- Znaki przykluczowe ---------- */
    ['Znaki przykluczowe', (T, eq) => {
      const ks = (t, s) => {
        const k = T.keySignature(T.parseNote(t), s);
        return k.notes.map((n) => T.noteName(n)).join(' ');
      };
      eq(ks('C', 'major'), '');
      eq(ks('D', 'major'), 'F♯ C♯');
      eq(ks('F', 'major'), 'B♭');
      eq(ks('Eb', 'major'), 'B♭ E♭ A♭');
      eq(ks('C#', 'major'), 'F♯ C♯ G♯ D♯ A♯ E♯ B♯');
      eq(ks('A', 'minor'), '');
      eq(ks('G', 'minor'), 'B♭ E♭');
      eq(ks('A', 'harmonicMinor'), '');
      eq(ks('D', 'dorian'), '');
      eq(ks('E', 'phrygian'), '');
      eq(ks('G', 'mixolydian'), '');
      eq(ks('F#', 'minor'), 'F♯ C♯ G♯');
      eq(T.keySignature(T.parseNote('C'), 'wholeTone'), null);
    }],
    ['Skale vs durowa', (T, eq) => {
      const alt = (id) => T.alterationsVsMajor(T.scaleById(id)).map((d) => d.symbol).join(' ');
      eq(alt('dorian'), '♭3 ♭7');
      eq(alt('lydian'), '♯4');
      eq(alt('locrian'), '♭2 ♭3 ♭5 ♭6 ♭7');
      eq(alt('major'), '');
    }],

    /* ---------- Prowadzenie głosów ---------- */
    ['Płynne prowadzenie głosów C → F → G', (T, eq, ok) => {
      const c = (r, t) => T.buildChord(T.parseNote(r), t);
      const a = T.smoothVoicing(c('C', 'maj'), null);
      ok(a.midis.every((m) => m >= 52 && m <= 79), 'zakres');
      const b = T.smoothVoicing(c('F', 'maj'), a.midis);
      const moves = T.voiceMoves(a.midis, b.midis);
      ok(moves.some((m) => m.semis === 0), 'C→F: dźwięk wspólny');
      ok(moves.every((m) => Math.abs(m.semis) <= 2), 'C→F: ruchy o max sekundę');
      const g = T.smoothVoicing(c('G', 'maj'), a.midis);
      const mg = T.voiceMoves(a.midis, g.midis).map((m) => m.semis).sort((x, y) => x - y);
      eq(mg, [-2, -1, 0], 'C→G: C→B, E→D, G zostaje');
      const g7 = T.smoothVoicing(c('G', '7'), a.midis);
      ok(g7.midis.length === 4 && T.voiceMoves(a.midis, g7.midis).every((m) => Math.abs(m.semis) <= 2), 'C→G7 blisko');
      eq(c('C', 'maj').pcs.size, 3);
    }],
    ['Akordy zapożyczone', (T, eq) => {
      const b = (t, id) => T.borrowedChords(T.buildScale(T.parseNote(t), id)).map((d) => d.roman + '=' + T.chordSymbol(d.chord)).join(' ');
      eq(b('C', 'major'), 'i=Cm ii°=D° ♭III=E♭ iv=Fm v=Gm ♭VI=A♭ ♭VII=B♭');
      eq(b('A', 'minor'), 'I=A ii=Bm iii=C♯m IV=D V=E vi=F♯m vii°=G♯°');
    }],
    ['Nazwy stopni', (T, eq) => {
      eq(T.buildScale(T.parseNote('C'), 'major').notes.map((n) => T.degreeName(n.iv)).join(','),
        'tonika,supertonika,medianta,subdominanta,dominanta,submedianta,dźwięk prowadzący');
      eq(T.degreeName(T.parseInterval('b7')), 'subtonika');
    }],
    ['Parsowanie symboli akordów', (T, eq) => {
      const sym = (x, nt) => { const r = T.parseChordSymbol(x, nt); return r ? T.chordSymbol(r.chord) + (r.bass ? '/' + T.noteName(r.bass) : '') : null; };
      eq(sym('F#m7'), 'F♯m7');
      eq(sym('Bb'), 'B♭');
      eq(sym('Ebmaj7'), 'E♭maj7');
      eq(sym('C/E'), 'C/E');
      eq(sym('Bdim'), 'B°');
      eq(sym('Am7b5'), 'Am7♭5');
      eq(sym('Hm', 'H'), 'Bm');
      eq(sym('B', 'H'), 'B♭');
      eq(sym('Hm'), null);
      eq(sym('Xyz'), null);
    }],
    ['Rozpoznawanie tonacji z akordów', (T, eq) => {
      const key = (s, nt) => {
        const cs = s.split(' ').map((x) => T.parseChordSymbol(x, nt).chord);
        const k = T.analyzeKey(cs)[0];
        return T.noteName(k.tonic) + (k.mode === 'major' ? '-dur' : '-moll') + ' ' + k.analysis.map((a) => a.roman).join(' ');
      };
      eq(key('G D Em C'), 'G-dur I V vi IV');
      eq(key('Am F C G'), 'A-moll i ♭VI ♭III ♭VII');
      eq(key('Dm7 G7 Cmaj7'), 'C-dur ii7 V7 Imaj7');
      eq(key('Am Dm E7 Am'), 'A-moll i iv V7 i');
      eq(key('C A7 Dm G7 C'), 'C-dur I VI7 ii V7 I');
      eq(key('C Am Dm G7 C E7 Am Fm C'), 'C-dur I vi ii V7 I III7 vi iv I');
      eq(key('Bb F Gm Eb'), 'B♭-dur I V vi IV');
      eq(key('A# F Gm D#'), 'B♭-dur I V vi IV');
      const k = T.analyzeKey(['C', 'Fm', 'C'].map((x) => T.parseChordSymbol(x).chord))[0];
      eq(k.analysis[1].note, 'zapożyczony z molowej jednoimiennej');
    }],
    ['Bas cyfrowany i transpozycja', (T, eq) => {
      const c = (r, t) => T.buildChord(T.parseNote(r), t);
      eq([0, 1, 2].map((i) => T.figuredBass(c('C', 'maj'), i)).join(' '), '5/3 6 6/4');
      eq([0, 1, 2, 3].map((i) => T.figuredBass(c('G', '7'), i)).join(' '), '7 6/5 4/3 2');
      eq(T.figuredBass(c('C', 'sus4'), 0), null);
      const tr = T.transposeChords([c('C', 'maj'), c('A', 'min'), c('F', 'maj'), c('G', '7')], T.parseNote('C'), T.parseNote('Eb'));
      eq(tr.map((x) => T.chordSymbol(x)).join(' '), 'E♭ Cm A♭ B♭7');
      const tr2 = T.transposeChords([c('C', 'maj'), c('G', 'maj')], T.parseNote('C'), T.parseNote('F#'));
      eq(tr2.map((x) => T.chordSymbol(x)).join(' '), 'F♯ C♯');
    }],
    ['Kwinty i oktawy równoległe', (T, eq) => {
      eq(T.parallels([48, 55, 64], [50, 57, 65]).map((p) => p.kind).join(','), 'kwinty');
      eq(T.parallels([48, 60, 64], [50, 62, 65]).map((p) => p.kind).join(','), 'oktawy');
      eq(T.parallels([48, 55, 64], [43, 55, 62]).length, 0);
      eq(T.parallels([48, 55], [55, 62]).map((p) => p.kind).join(','), 'kwinty');
      eq(T.parallels([48, 55], [47, 54]).length, 1);
      eq(T.parallels([48, 55], [50, 55]).length, 0);
    }],
    ['Ukulele i bas: chwyty na 4 strunach', (T, eq, ok) => {
      const uke = T.tuningById('ukulele');
      const fr4 = (v) => v.frets.join('');
      const best = (r, t) => fr4(T.findVoicings(T.buildChord(T.parseNote(r), t), T.parseNote(r).pc, uke)[0]);
      eq(best('C', 'maj'), '0003');
      eq(best('A', 'min'), '2000');
      eq(best('F', 'maj'), '2010');
      eq(best('G', 'maj'), '0232');
      for (const t of ['maj', 'min', '7', 'm7']) for (const r of ['C', 'D', 'E', 'F', 'G', 'A', 'Bb']) {
        const c = T.buildChord(T.parseNote(r), t);
        ok(T.findVoicings(c, c.root.pc, uke).length > 0, `ukulele ${r}${t}`);
        ok(T.findVoicings(c, c.root.pc, T.tuningById('bass')).every((v) => v.frets.length === 4), `bas ${r}${t}`);
      }
    }],
    ['Kształty CAGED', (T, eq) => {
      const std = T.TUNINGS[0];
      const sh = (r, t, frets) => T.cagedShape({ frets }, T.buildChord(T.parseNote(r), t), std);
      eq(sh('C', 'maj', [-1, 3, 2, 0, 1, 0]), 'C');
      eq(sh('A', 'maj', [-1, 0, 2, 2, 2, 0]), 'A');
      eq(sh('G', 'maj', [3, 2, 0, 0, 0, 3]), 'G');
      eq(sh('E', 'maj', [0, 2, 2, 1, 0, 0]), 'E');
      eq(sh('D', 'maj', [-1, -1, 0, 2, 3, 2]), 'D');
      eq(sh('F', 'maj', [1, 3, 3, 2, 1, 1]), 'E');
      eq(sh('Bb', 'maj', [-1, 1, 3, 3, 3, 1]), 'A');
      eq(sh('A', 'min', [-1, 0, 2, 2, 1, 0]), 'A');
    }],
    ['Harmonizacja melodii', (T, eq, ok) => {
      const sc = T.buildScale(T.parseNote('C'), 'major');
      const hz = (degs) => T.harmonize(sc, degs).choice.map((d) => d.roman).join(' ');
      // 3 2 1 → I V I ; 1 2 3 4 3 2 1
      eq(hz([2, 1, 0]), 'I V I');
      const r = T.harmonize(sc, [0, 1, 2, 3, 2, 1, 0]);
      eq(r.choice[0].roman, 'I'); eq(r.choice[6].roman, 'I'); eq(r.choice[5].roman, 'V');
      ok(r.choice.every((d, i) => d.chord.notes.some((n) => n.note.pc === sc.notes[[0, 1, 2, 3, 2, 1, 0][i]].note.pc)), 'akord zawiera nutę melodii');
      const am = T.buildScale(T.parseNote('A'), 'minor');
      eq(T.harmonize(am, [0, 1, 0]).choice.map((d) => T.chordSymbol(d.chord)).join(' '), 'Am E Am');
    }],
    ['Dźwięki obce w harmonizacji', (T, eq) => {
      const sc = T.buildScale(T.parseNote('C'), 'major');
      eq(T.nonChordTone(0, 1, 2), 'przejściowy');
      eq(T.nonChordTone(2, 3, 2), 'pomocniczy');
      const r = T.harmonizeGroups(sc, [0, 1, 2, 1, 0, 0], 2);
      eq(r.choice.map((d) => d.roman).join(' '), 'I I I I I I');
      eq(r.nct, [null, 'przejściowy', null, 'przejściowy', null, null]);
    }],
    ['Nazwy po angielsku (setLang)', (T, eq) => {
      T.setLang('en');
      try {
        eq(T.describeInterval(3, 4).name, 'major third');
        eq(T.describeInterval(4, 6).name, 'augmented fourth (tritone)');
        eq(T.describeInterval(8, 12).name, 'perfect octave');
        eq(T.describeInterval(9, 13).name, 'minor ninth');
        eq(T.degreeName(T.parseInterval('7')), 'leading tone');
        eq(T.consonance(T.describeInterval(5, 7)).name, 'perfect consonance');
        eq(T.INTERVALS.find((x) => x.sym === 'b3').info.name, 'minor third');
      } finally { T.setLang('pl'); }
      eq(T.describeInterval(3, 4).name, 'tercja wielka');
    }],
    ['Skale pasujące do akordu', (T, eq) => {
      const cs = (r, t) => T.chordScales(T.buildChord(T.parseNote(r), t)).map((s) => s.scale.id).join(' ');
      eq(cs('D', 'm7'), 'minor dorian phrygian blues');
      eq(cs('C', 'maj7'), 'major lydian');
      eq(cs('G', '7'), 'mixolydian phrygianDominant');
      eq(cs('B', 'm7b5'), 'locrian blues');
      eq(cs('C', 'aug7'), 'phrygianDominant wholeTone');
    }],
    ['Solmizacja względna', (T, eq) => {
      const sol = (t, id) => { const sc = T.buildScale(T.parseNote(t), id); return sc.notes.map((n) => T.solfege(sc.tonic, n.note)).join(' '); };
      eq(sol('G', 'major'), 'do re mi fa sol la si');
      eq(sol('A', 'minor'), 'do re mi♭ fa sol la♭ si♭');
      eq(sol('D', 'dorian'), 'do re mi♭ fa sol la si♭');
    }],
    ['Polskie nazwy tonacji', (T, eq) => {
      const k = (n, m) => T.polishKeyName(T.parseNote(n), m);
      eq(k('Eb', 'major'), 'Es-dur'); eq(k('Ab', 'major'), 'As-dur'); eq(k('Bb', 'major'), 'B-dur');
      eq(k('B', 'major'), 'H-dur'); eq(k('F#', 'minor'), 'fis-moll'); eq(k('Db', 'major'), 'Des-dur');
      eq(k('C#', 'minor'), 'cis-moll'); eq(k('Gb', 'major'), 'Ges-dur'); eq(k('Cb', 'major'), 'Ces-dur');
      eq(k('D#', 'minor'), 'dis-moll'); eq(k('Bbb', 'major'), 'Heses-dur');
    }],
    ['Dominanty wtrącone', (T, eq) => {
      eq(T.chordSymbol(T.secondaryDominant(T.parseNote('D'))), 'A7');
      eq(T.chordSymbol(T.secondaryDominant(T.parseNote('Bb'))), 'F7');
      eq(T.chordSymbol(T.secondaryDominant(T.parseNote('E'))), 'B7');
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
