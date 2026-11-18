/*
 * ChordBuilder — logika interfejsu.
 */
(function () {
  'use strict';
  const T = window.Theory;
  const I = window.Instruments;
  const $ = (id) => document.getElementById(id);

  const NOTE_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const PC_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const PIANO_START = 48; // C3

  const state = {
    tonic: 'C', scale: 'major', size: 3,
    root: 'C', type: 'maj', inv: 0,
    notation: 'intl', labels: 'note',
    tuning: 'standard', showAll: true, showScale: false, voicing: 0,
    pianoNames: true, fbNames: true,
    prog: 'pop', custom: [], bpm: 90, beats: 4, loop: true,
  };

  // Tryb „wklikaj akord”: dźwięki wybrane na pianinie albo na gryfie.
  const input = { on: false, source: 'piano', piano: new Set(), guitar: [-1, -1, -1, -1, -1, -1] };

  /* ---------- Trwałość: preferencje + URL ---------- */

  const PREF_KEYS = ['notation', 'labels', 'tuning', 'showAll', 'showScale', 'pianoNames', 'fbNames', 'bpm', 'beats', 'loop'];
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('chordbuilder.prefs') || '{}');
      for (const k of PREF_KEYS) if (k in p) state[k] = p[k];
    } catch (e) { /* brak dostępu do localStorage */ }
  }
  function savePrefs() {
    try {
      const p = {};
      for (const k of PREF_KEYS) p[k] = state[k];
      localStorage.setItem('chordbuilder.prefs', JSON.stringify(p));
    } catch (e) { /* ignoruj */ }
  }
  function loadHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const isNote = (v) => /^[A-G](#{1,2}|b{1,2})?$/.test(v || '');
    if (isNote(p.get('t'))) state.tonic = p.get('t');
    if (p.get('s') && T.SCALES.some((s) => s.id === p.get('s'))) state.scale = p.get('s');
    if (isNote(p.get('r'))) state.root = p.get('r');
    if (p.get('c') && T.CHORD_TYPES.some((c) => c.id === p.get('c'))) state.type = p.get('c');
    if (p.get('i')) state.inv = Math.max(0, Math.min(3, +p.get('i') || 0));
    if (p.get('n') === '4') state.size = 4;
    if (p.get('p') && (p.get('p') === 'custom' || T.PROGRESSIONS.some((x) => x.id === p.get('p')))) state.prog = p.get('p');
    if (p.get('pc')) {
      state.custom = p.get('pc').split(',').filter((k) => {
        const [r, t] = k.split('.');
        return isNote(r) && T.CHORD_TYPES.some((c) => c.id === t);
      });
    }
  }
  function saveHash() {
    const p = new URLSearchParams({ t: state.tonic, s: state.scale, r: state.root, c: state.type, i: state.inv, n: state.size, p: state.prog });
    if (state.custom.length) p.set('pc', state.custom.join(','));
    history.replaceState(null, '', '#' + p.toString());
  }

  /* ---------- Pomocnicze ---------- */

  const nn = (note) => T.noteName(note, state.notation);
  const nameForKey = (k) => nn(T.parseNote(k));

  const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  /**
   * Nazwa dowolnej klasy wysokości w kontekście: najpierw pisownia z akordu,
   * potem ze skali, a dla pozostałych — krzyżyki lub bemole zależnie od tonacji.
   */
  function noteFor(sc, chord) {
    const map = new Map();
    for (const n of sc.notes) map.set(n.note.pc, n.note);
    if (chord) for (const n of chord.notes) map.set(n.note.pc, n.note);
    const flats = sc.notes.some((n) => n.note.acc < 0) ||
      (chord && sc.notes.every((n) => n.note.acc === 0) && chord.root.acc < 0);
    const keys = flats ? FLAT_KEYS : SHARP_KEYS;
    return (pc) => map.get(pc) || T.parseNote(keys[pc]);
  }
  function pcNamer(chord, sc) {
    const nf = noteFor(sc, chord);
    return (pc) => nn(nf(pc));
  }

  function midiTitle(name, midi, chord, sc) {
    const pc = T.mod(midi, 12);
    const parts = [name + (Math.floor(midi / 12) - 1)];
    const cn = chord.notes.find((n) => n.note.pc === pc);
    if (cn) parts.push(`${cn.info.name} akordu (${cn.info.symbol})`);
    else if (sc.pcs.has(pc)) parts.push('dźwięk skali');
    return parts.join(' — ');
  }

  function labelFor(entry) {
    if (state.labels === 'interval') return entry.info.symbol;
    if (state.labels === 'semi') return String(entry.iv.semi);
    return nn(entry.note);
  }

  function fillSelect(sel, items, value) {
    sel.replaceChildren(...items.map(([v, label, group]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      if (v === value) o.selected = true;
      return o;
    }));
  }

  function setupSeg(id, key, cast = (v) => v) {
    const box = $(id);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      state[key] = cast(b.dataset.value);
      if (PREF_KEYS.includes(key)) savePrefs();
      if (key === 'size') selectFirstChord();
      render();
    });
  }
  function syncSeg(id, value) {
    for (const b of $(id).querySelectorAll('button[data-value]')) {
      const on = b.dataset.value === String(value);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    }
  }

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) e.append(c);
    return e;
  }

  const currentScale = () => T.buildScale(T.parseNote(state.tonic), state.scale);
  const currentChord = () => T.buildChord(T.parseNote(state.root), state.type);

  function selectChord(rootNote, typeId) {
    state.root = T.noteKey(rootNote);
    state.type = typeId;
    state.inv = 0;
    state.voicing = 0;
    render();
  }

  function selectFirstChord() {
    const sc = currentScale();
    const dia = T.diatonicChords(sc, state.size);
    const first = dia[0] ? dia[0].chord : (T.fittingChords(sc)[0].chords[0] || T.buildChord(sc.tonic, 'maj'));
    state.root = T.noteKey(first.root);
    state.type = first.type.id;
    state.inv = 0;
    state.voicing = 0;
  }

  /* ---------- Render ---------- */

  function render() {
    const sc = currentScale();
    const chord = currentChord();
    syncSeg('notation', state.notation);
    syncSeg('labels', state.labels);
    syncSeg('chord-size', state.size);

    renderSelects(chord, sc);
    renderScale(sc);
    renderCircle(sc);
    renderProgression(sc);
    renderDiatonic(sc, chord);
    renderFitting(sc, chord);
    const voiced = renderChord(sc, chord);
    const rec = recognition(sc);
    renderPiano(sc, voiced, rec);
    renderGuitar(sc, chord, voiced, rec);
    renderRecognize(sc, rec);
    saveHash();
  }

  function renderSelects(chord, sc) {
    fillSelect($('tonic'), NOTE_KEYS.map((k) => [k, nameForKey(k)]), state.tonic);
    if (!NOTE_KEYS.includes(state.tonic)) $('tonic').prepend(new Option(nameForKey(state.tonic), state.tonic, true, true));

    fillSelect($('scale'), T.SCALES.map((s) => [s.id, s.name]), state.scale);

    // Pryma: ✓ przy dźwiękach skali (w pisowni skali, np. B♭ w F-dur, a nie A♯).
    const scaleKeys = new Set(sc.notes.map((n) => T.noteKey(n.note)));
    const rootKeys = [...NOTE_KEYS];
    for (const k of scaleKeys) if (!rootKeys.includes(k)) rootKeys.push(k);
    fillSelect($('chord-root'), rootKeys.map((k) => [k, (scaleKeys.has(k) ? '✓ ' : ' ') + nameForKey(k)]), state.root);
    if (!rootKeys.includes(state.root)) $('chord-root').prepend(new Option(nameForKey(state.root), state.root, true, true));

    // Rodzaj akordu: ✓ przy akordach, których wszystkie dźwięki należą do skali.
    const fits = (t) => [...T.buildChord(chord.root, t.id).pcs].every((pc) => sc.pcs.has(pc));
    let fitCount = 0;
    const typeSel = $('chord-type');
    typeSel.replaceChildren(...T.CHORD_GROUPS.map((g) => {
      const og = document.createElement('optgroup');
      og.label = g.name;
      for (const t of T.CHORD_TYPES.filter((t) => t.group === g.id)) {
        const ok = fits(t);
        if (ok) fitCount++;
        const o = new Option(`${ok ? '✓ ' : ' '}${nn(chord.root)}${t.symbol} — ${t.name}`, t.id, false, t.id === state.type);
        og.append(o);
      }
      return og;
    }));
    const scaleName = `${nn(sc.tonic)} ${sc.scale.name.toLowerCase()}`;
    $('chord-list-hint').textContent = !sc.pcs.has(chord.root.pc)
      ? `${nn(chord.root)} nie należy do skali ${scaleName}, więc żaden akord z tą prymą nie mieści się w skali. ✓ na liście prym oznacza dźwięki skali.`
      : `✓ — wszystkie dźwięki akordu należą do skali ${scaleName}. Z prymą ${nn(chord.root)} pasuje ${fitCount} z ${T.CHORD_TYPES.length} rodzajów akordów.`;

    const invBox = $('inversion');
    const maxInv = Math.min(3, chord.notes.length - 1);
    if (state.inv > maxInv) state.inv = maxInv;
    const invNames = ['zasadnicza', 'I', 'II', 'III'];
    invBox.replaceChildren(...invNames.slice(0, maxInv + 1).map((label, i) =>
      h('button', { type: 'button', 'data-value': i, title: i === 0 ? 'Postać zasadnicza' : `${label} przewrót` }, label)));
    syncSeg('inversion', state.inv);

    fillSelect($('tuning'), T.TUNINGS.map((t) => [t.id, t.name]), state.tuning);
    $('show-all').checked = state.showAll;
    $('show-scale').checked = state.showScale;
    $('piano-names').checked = state.pianoNames;
    $('fb-names').checked = state.fbNames;
  }

  function renderScale(sc) {
    const box = $('scale-notes');
    const items = [];
    sc.notes.forEach((sn, i) => {
      const info = T.describeInterval(sn.iv.deg, sn.iv.semi);
      items.push(h('button', {
        type: 'button', class: 'scale-note' + (sn.note.pc === T.parseNote(state.root).pc ? ' active' : ''),
        title: `${nn(sn.note)} — ${info.name} od toniki (${sn.iv.semi} półt.)`,
        onclick: () => {
          const fit = T.fittingChords(sc)[i];
          const dia = T.diatonicChords(sc, state.size).find((d) => d.degree === i);
          const c = dia ? dia.chord : (fit.chords[0] || T.buildChord(sn.note, 'maj'));
          selectChord(c.root, c.type.id);
        },
      },
      h('span', { class: 'deg' }, info.symbol),
      h('span', { class: 'nm' }, nn(sn.note)),
      h('span', { class: 'sm' }, sn.iv.semi + ' pt')));
      const next = i + 1 < sc.notes.length ? sc.notes[i + 1].iv.semi : 12;
      const step = next - sn.iv.semi;
      items.push(h('span', { class: 'step-gap' + (step === 1 ? ' half' : step >= 3 ? ' wide' : ''), title: step + ' półtonów' }, '+' + step));
    });
    items.push(h('span', { class: 'scale-note octave' },
      h('span', { class: 'deg' }, '8'), h('span', { class: 'nm' }, nn(sc.tonic)), h('span', { class: 'sm' }, '12 pt')));
    box.replaceChildren(...items);
  }

  function isActive(chord) {
    return T.noteKey(chord.root) === state.root && chord.type.id === state.type;
  }

  function renderDiatonic(sc, active) {
    const box = $('diatonic');
    const dia = T.diatonicChords(sc, state.size);
    const hint = $('diatonic-hint');
    if (!dia.length) {
      hint.textContent = `Skala ${sc.scale.name.toLowerCase()} ma ${sc.notes.length} dźwięków — akordy diatoniczne (budowane co tercję) tworzy się w skalach siedmiodźwiękowych. Poniżej znajdziesz akordy zbudowane z jej dźwięków.`;
      box.replaceChildren();
      document.querySelector('.fitting').open = true;
      return;
    }
    hint.textContent = state.size === 3
      ? 'Każdy akord powstaje przez nałożenie tercji: stopień skali + co drugi dźwięk (1–3–5).'
      : 'Akordy czterodźwiękowe: stopień skali + 3, 5 i 7 dźwięk liczony od niego (1–3–5–7).';
    box.replaceChildren(...dia.map((d) => h('button', {
      type: 'button', class: 'chord-card' + (isActive(d.chord) ? ' active' : ''),
      onclick: () => selectChord(d.chord.root, d.chord.type.id),
    },
    h('span', { class: 'roman' }, d.roman),
    h('span', { class: 'sym' }, T.chordSymbol(d.chord, state.notation)),
    h('span', { class: 'notes' }, d.chord.notes.map((n) => nn(n.note)).join(' · ')),
    h('span', { class: 'qual' }, d.chord.type.name))));
  }

  function renderFitting(sc, active) {
    const rows = T.fittingChords(sc);
    $('fitting').replaceChildren(...rows.map((r) => h('div', { class: 'fit-row' },
      h('span', { class: 'fit-root' }, T.describeInterval(sc.notes[r.degree].iv.deg, sc.notes[r.degree].iv.semi).symbol + ' · ' + nn(r.root)),
      h('div', { class: 'chips' }, r.chords.length ? r.chords.map((c) => h('button', {
        type: 'button', class: 'chip' + (isActive(c) ? ' active' : ''), title: c.type.name,
        onclick: () => selectChord(c.root, c.type.id),
      }, T.chordSymbol(c, state.notation))) : h('span', { class: 'muted' }, '—')))));
  }

  function renderChord(sc, chord) {
    const voiced = T.inversion(chord, state.inv);
    $('chord-symbol').textContent = T.chordSymbol(chord, state.notation);
    const bass = voiced[0];
    $('chord-name').textContent = `${nn(chord.root)} — akord ${chord.type.name}` +
      (state.inv > 0 ? ` · ${['', 'I', 'II', 'III'][state.inv]} przewrót (bas: ${nn(bass.note)})` : '');

    const outside = chord.notes.filter((n) => !sc.pcs.has(n.note.pc));
    const fit = $('chord-fit');
    fit.className = 'fit ' + (outside.length ? 'out' : 'in');
    fit.textContent = outside.length
      ? `Spoza skali ${nn(sc.tonic)} ${sc.scale.name.toLowerCase()}: ${outside.map((n) => nn(n.note)).join(', ')}`
      : `Wszystkie dźwięki należą do skali ${nn(sc.tonic)} ${sc.scale.name.toLowerCase()}`;

    $('chord-tbody').replaceChildren(...chord.notes.map((n) => h('tr', {},
      h('td', {}, h('span', { class: 'pill role-' + n.role }, nn(n.note))),
      h('td', { class: 'mono' }, n.info.symbol),
      h('td', {}, n.info.name),
      h('td', { class: 'mono' }, n.iv.deg === 1 ? '—' : n.info.abbr),
      h('td', { class: 'mono' }, String(n.iv.semi)),
      h('td', {}, sc.pcs.has(n.note.pc) ? h('span', { class: 'ok' }, '✓') : h('span', { class: 'no' }, '✗')))));

    // Stos interwałów w kolejności przewrotu.
    const parts = [];
    voiced.forEach((n, i) => {
      parts.push(h('span', { class: 'pill big role-' + n.role }, nn(n.note), h('small', {}, n.info.symbol)));
      if (i < voiced.length - 1) {
        const m = voiced[i + 1];
        const semis = m.semiAbs - n.semiAbs;
        let deg = T.mod(m.note.letter - n.note.letter, 7) + 1;
        if (semis >= 12) deg += 7;
        const d = T.describeInterval(deg, semis);
        parts.push(h('span', { class: 'gap' }, h('b', {}, `+${semis}`), h('span', {}, d.name)));
      }
    });
    $('chord-stack').replaceChildren(...parts);

    $('chord-formula').replaceChildren(
      h('div', {}, h('span', { class: 'lbl' }, 'Wzór: '), h('code', {}, chord.notes.map((n) => n.info.symbol).join(' – '))),
      h('div', {}, h('span', { class: 'lbl' }, 'Półtony od prymy: '), h('code', {}, chord.notes.map((n) => n.iv.semi).join(' – '))),
      h('div', {}, h('span', { class: 'lbl' }, 'Klasy wysokości (0 = C): '), h('code', {}, chord.notes.map((n) => n.note.pc).join(', '))));
    return voiced;
  }

  function pianoMidis(chord, voiced) {
    return voiced.map((n) => PIANO_START + chord.root.pc + n.semiAbs);
  }

  /* ---------- Koło kwintowe ---------- */

  const COF_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const COF_MINOR = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'];
  const COF_ENH = { major: 'Gb', minor: 'Eb' }; // pozycja 6: 6♯ = 6♭
  // O ile półtonów tonika skali leży powyżej toniki „macierzystej” tonacji durowej.
  const PARENT_OFFSET = {
    major: 0, dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7, minor: 9, locrian: 11,
    harmonicMinor: 9, melodicMinor: 9, phrygianDominant: 4,
    majorPentatonic: 0, minorPentatonic: 9, blues: 9,
  };
  const cofPos = (pc) => T.mod(pc * 7, 12);

  function signature(pos) {
    if (pos === 0) return { short: '0', notes: [] };
    const sharps = 'F C G D A E B'.split(' '), flats = 'B E A D G C F'.split(' ');
    if (pos === 6) return { short: '6♯/6♭', notes: sharps.slice(0, 6).map((l) => l + '#') };
    if (pos < 6) return { short: pos + '♯', notes: sharps.slice(0, pos).map((l) => l + '#') };
    return { short: (12 - pos) + '♭', notes: flats.slice(0, 12 - pos).map((l) => l + 'b') };
  }

  function renderCircle(sc) {
    const off = PARENT_OFFSET[sc.scale.id];
    const parentPos = off === undefined ? null : cofPos(sc.tonic.pc - off);
    const minorTonic = sc.notes.some((n) => n.iv.deg === 3 && n.iv.semi === 3);
    const tonicPos = minorTonic ? cofPos(sc.tonic.pc + 3) : cofPos(sc.tonic.pc);
    const near = (i) => parentPos !== null && [11, 0, 1].includes(T.mod(i - parentPos, 12));
    const keyName = (list, i, minor) => {
      const a = nn(T.parseNote(list[i]));
      const s = i === 6 ? a + '/' + nn(T.parseNote(minor ? COF_ENH.minor : COF_ENH.major)) : a;
      return minor ? s.toLowerCase() : s;
    };

    const majors = COF_MAJOR.map((k, i) => ({
      label: keyName(COF_MAJOR, i, false), sub: signature(i).short,
      title: `${keyName(COF_MAJOR, i, false)}-dur — ${signature(i).short}`,
      cls: (!minorTonic && i === tonicPos ? 'active ' : '') + (near(i) ? 'dia' : ''),
    }));
    const minors = COF_MINOR.map((k, i) => ({
      label: keyName(COF_MINOR, i, true),
      title: `${keyName(COF_MINOR, i, true)}-moll — ${signature(i).short}`,
      cls: (minorTonic && i === tonicPos ? 'active ' : '') + (near(i) ? 'dia' : ''),
    }));

    const infoPos = parentPos !== null ? parentPos : tonicPos;
    const sig = signature(infoPos);
    const majName = keyName(COF_MAJOR, infoPos, false), minName = keyName(COF_MINOR, infoPos, true);
    const dimRoot = parentPos !== null ? T.transpose(T.parseNote(COF_MAJOR[parentPos]), T.parseInterval('7')) : null;

    I.renderCircle($('circle'), {
      majors, minors,
      dimAt: parentPos !== null ? (parentPos + 2) % 12 : null,
      dimLabel: dimRoot ? nn(dimRoot) + '°' : '',
      center: [majName + '-dur', minName + '-moll', sig.short],
      onMajor: (i) => { stopProg(); state.tonic = COF_MAJOR[i]; state.scale = 'major'; selectFirstChord(); render(); },
      onMinor: (i) => { stopProg(); state.tonic = COF_MINOR[i]; state.scale = 'minor'; selectFirstChord(); render(); },
    });

    const info = $('circle-info');
    if (parentPos === null) {
      info.replaceChildren(h('p', {}, `Skala ${sc.scale.name.toLowerCase()} nie należy do systemu dur–moll, więc nie ma swojego miejsca na kole. Pokazano pozycję toniki.`));
      return;
    }
    const parentNote = T.parseNote(COF_MAJOR[parentPos]);
    const ps = T.buildScale(parentNote, 'major');
    const dia = T.diatonicChords(ps, 3);
    const k = (i) => keyName(COF_MAJOR, T.mod(i, 12), false);
    const rows = [
      ['Tonacje', `${majName}-dur i równoległa ${minName}-moll`],
      ['Znaki przykluczowe', sig.notes.length ? `${sig.short}: ${sig.notes.map(nameForKey).join(', ')}` : 'brak (same białe klawisze)'],
      ['Sąsiedzi', `subdominanta ${k(parentPos - 1)}-dur (${signature(T.mod(parentPos - 1, 12)).short}), dominanta ${k(parentPos + 1)}-dur (${signature(T.mod(parentPos + 1, 12)).short})`],
    ];
    if (sc.scale.id !== 'major' && sc.scale.id !== 'minor') {
      rows.unshift(['Skala', `${nn(sc.tonic)} ${sc.scale.name.toLowerCase()} używa znaków tonacji ${majName}-dur`]);
    }
    info.replaceChildren(
      h('dl', { class: 'circle-dl' }, rows.flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)])),
      h('div', { class: 'chips' }, dia.map((d) => h('button', {
        type: 'button', class: 'chip' + (isActive(d.chord) ? ' active' : ''),
        onclick: () => selectChord(d.chord.root, d.chord.type.id),
      }, h('b', {}, d.roman + ' '), T.chordSymbol(d.chord, state.notation)))));
  }

  /* ---------- Progresje ---------- */

  const player = { playing: false, idx: -1, timer: null };

  function progSteps(sc) {
    if (state.prog === 'custom') {
      return state.custom.map((key) => {
        const [r, t] = key.split('.');
        const chord = T.buildChord(T.parseNote(r), t);
        const iv = T.intervalBetween(sc.tonic, chord.root);
        return { chord, roman: T.romanFor(iv.deg, iv.diff, chord.type) };
      });
    }
    const p = T.PROGRESSIONS.find((x) => x.id === state.prog) || T.PROGRESSIONS[0];
    return p.steps.map((s) => {
      const chord = T.buildChord(T.transpose(sc.tonic, s.iv), s.type);
      const d = T.describeInterval(s.iv.deg, s.iv.semi);
      return { chord, roman: T.romanFor(s.iv.deg, d.diff, chord.type) };
    });
  }

  /** Przewrót, który trzyma akord blisko środka klawiatury (płynniejsze przejścia). */
  function centeredInversion(chord) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= Math.min(3, chord.notes.length - 1); i++) {
      const ms = pianoMidis(chord, T.inversion(chord, i));
      const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
      const d = Math.abs(avg - 62);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function playStep(i) {
    const steps = progSteps(currentScale());
    if (!steps.length) return stopProg();
    if (i >= steps.length) {
      if (!state.loop) return stopProg();
      i = 0;
    }
    player.idx = i;
    const c = steps[i].chord;
    state.root = T.noteKey(c.root);
    state.type = c.type.id;
    state.inv = centeredInversion(c);
    state.voicing = 0;
    render();
    const dur = (60 / state.bpm) * state.beats;
    Sound.play([36 + c.root.pc, ...pianoMidis(c, T.inversion(c, state.inv))], 'chord', 'piano', dur + 0.4);
    player.timer = setTimeout(() => playStep(i + 1), dur * 1000);
  }

  function startProg() {
    stopProg(false);
    player.playing = true;
    playStep(0);
  }

  function stopProg(rerender = true) {
    clearTimeout(player.timer);
    const was = player.playing;
    player.playing = false;
    player.idx = -1;
    if (rerender && was) render();
  }

  function renderProgression(sc) {
    const sel = $('prog');
    const groups = [...new Set(T.PROGRESSIONS.map((p) => p.group))];
    sel.replaceChildren(
      ...groups.map((g) => {
        const og = document.createElement('optgroup');
        og.label = g;
        for (const p of T.PROGRESSIONS.filter((x) => x.group === g)) og.append(new Option(p.name, p.id, false, p.id === state.prog));
        return og;
      }),
      (() => {
        const og = document.createElement('optgroup');
        og.label = 'Własna';
        og.append(new Option(`Własna progresja (${state.custom.length})`, 'custom', false, state.prog === 'custom'));
        return og;
      })());

    $('bpm').value = state.bpm;
    $('bpm-val').textContent = state.bpm;
    $('beats').value = String(state.beats);
    $('loop').checked = state.loop;
    $('prog-play').textContent = player.playing ? '■ Zatrzymaj' : '▶ Odtwórz';

    const steps = progSteps(sc);
    const p = T.PROGRESSIONS.find((x) => x.id === state.prog);
    $('prog-desc').textContent = state.prog === 'custom'
      ? 'Twoja progresja. Wybierz akord (np. w „Akordach w skali” lub w sekcji 3) i dodaj go przyciskiem poniżej. Oznaczenia rzymskie liczone są od toniki ' + nn(sc.tonic) + '.'
      : p.desc + ` W tonacji ${nn(sc.tonic)} — zmień tonikę w sekcji 1 lub na kole kwintowym, aby przetransponować.`;

    const outside = (c) => c.notes.some((n) => !sc.pcs.has(n.note.pc));
    $('prog-steps').replaceChildren(...steps.map((st, i) => {
      const playing = player.playing && player.idx === i;
      const card = h('div', {
        class: 'chord-card prog-card' + (playing ? ' playing' : '') + (!player.playing && isActive(st.chord) ? ' active' : ''),
        role: 'button', tabindex: '0', title: 'Pokaż i zagraj ten akord',
        onclick: () => {
          stopProg(false);
          selectChord(st.chord.root, st.chord.type.id);
          Sound.play(pianoMidis(st.chord, T.inversion(st.chord, 0)));
        },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
      },
      h('span', { class: 'bar' }, String(i + 1)),
      h('span', { class: 'roman' }, st.roman),
      h('span', { class: 'sym' }, T.chordSymbol(st.chord, state.notation)),
      h('span', { class: 'notes' }, st.chord.notes.map((n) => nn(n.note)).join(' · ')),
      outside(st.chord) ? h('span', { class: 'qual out' }, 'spoza skali ' + sc.scale.name.toLowerCase()) : null);
      if (state.prog === 'custom') {
        card.append(h('button', {
          type: 'button', class: 'remove', title: 'Usuń z progresji', 'aria-label': 'Usuń z progresji',
          onclick: (e) => { e.stopPropagation(); stopProg(false); state.custom.splice(i, 1); render(); },
        }, '×'));
      }
      return card;
    }));
    if (!steps.length) $('prog-steps').append(h('p', { class: 'muted' }, 'Progresja jest pusta.'));

    const cur = currentChord();
    const tools = state.prog === 'custom'
      ? [
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.custom.push(state.root + '.' + state.type); render(); } },
          `+ Dodaj wybrany akord (${T.chordSymbol(cur, state.notation)})`),
        state.custom.length ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { stopProg(false); state.custom = []; render(); } }, 'Wyczyść') : null,
      ]
      : [h('button', {
        type: 'button', class: 'btn ghost small',
        onclick: () => { stopProg(false); state.custom = steps.map((s) => T.noteKey(s.chord.root) + '.' + s.chord.type.id); state.prog = 'custom'; render(); },
      }, 'Skopiuj jako własną (do edycji)')];
    $('prog-tools').replaceChildren(...tools.filter(Boolean));
  }

  /* ---------- Rozpoznawanie akordu (tryb „wklikaj”) ---------- */

  function inputMidis() {
    if (input.source === 'piano') return [...input.piano];
    const t = T.tuningById(state.tuning);
    return input.guitar.map((f, s) => (f >= 0 ? t.midi[s] + f : null)).filter((m) => m != null);
  }

  function recognition(sc) {
    const midis = input.on ? inputMidis().sort((a, b) => a - b) : [];
    const nf = noteFor(sc);
    const cands = T.recognize(midis).slice(0, 8).map((c) => {
      const chord = T.buildChord(nf(c.rootPc), c.type.id);
      const be = chord.notes.find((n) => n.note.pc === c.bassPc);
      return { ...c, chord, bassNote: be ? be.note : nf(c.bassPc) };
    });
    const best = cands[0] || null;
    const entryOf = (pc) => (best ? best.chord.notes.find((n) => n.note.pc === pc) : null);
    const noteOf = (pc) => { const e = entryOf(pc); return e ? e.note : nf(pc); };
    return { midis, pcs: new Set(midis.map((m) => T.mod(m, 12))), cands, best, entryOf, noteOf };
  }

  /** Etykieta i rola wybranego dźwięku w trybie wklikiwania. */
  function inputMark(rec, midi) {
    const pc = T.mod(midi, 12);
    const e = rec.entryOf(pc);
    if (e) return { label: labelFor(e), role: e.role };
    const label = state.labels === 'semi' ? String(midi - rec.midis[0]) : nn(rec.noteOf(pc));
    return { label, role: 'sel' };
  }

  function toggleInput(source) {
    if (input.on && input.source === source) input.on = false;
    else { input.on = true; input.source = source; }
    render();
  }

  function clearInput() {
    input.piano.clear();
    input.guitar = [-1, -1, -1, -1, -1, -1];
  }

  function renderRecognize(sc, rec) {
    for (const src of ['piano', 'guitar']) {
      const btn = $('input-' + src);
      const on = input.on && input.source === src;
      btn.textContent = on ? '✓ Zakończ wklikiwanie' : '✎ Wklikaj akord';
      btn.classList.toggle('ghost', !on);
      $('recognize-' + src).replaceChildren();
      $('recognize-' + src).hidden = true;
    }
    $('voicings-wrap').hidden = input.on;
    $('piano-hint').hidden = input.on;
    if (!input.on) return;

    const box = $('recognize-' + input.source);
    box.hidden = false;
    const how = input.source === 'piano'
      ? 'Klikaj klawisze, aby dodać lub usunąć dźwięk.'
      : 'Klikaj progi — na każdej strunie jeden dźwięk (pusta struna: kliknij przy nazwie struny). Ponowne kliknięcie usuwa dźwięk.';
    if (!rec.midis.length) {
      box.append(h('p', { class: 'hint' }, how + ' Rozpoznam akord, gdy wybierzesz co najmniej dwa różne dźwięki.'));
      return;
    }

    const octName = (m) => nn(rec.noteOf(T.mod(m, 12))) + (Math.floor(m / 12) - 1);
    const timbre = input.source === 'piano' ? 'piano' : 'guitar';
    box.append(h('div', { class: 'rec-notes' },
      h('span', { class: 'lbl' }, 'Wybrane dźwięki (od basu):'),
      rec.midis.map((m) => { const k = inputMark(rec, m); return h('span', { class: 'pill role-' + k.role }, octName(m)); }),
      h('button', { type: 'button', class: 'btn small', onclick: () => Sound.play(rec.midis, timbre === 'guitar' ? 'strum' : 'chord', timbre) }, '▶ Zagraj'),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => { clearInput(); render(); } }, 'Wyczyść')));

    // Interwały od basu.
    const bass = rec.midis[0];
    const bassNote = rec.noteOf(T.mod(bass, 12));
    const ivs = rec.midis.slice(1).map((m) => {
      const n = rec.noteOf(T.mod(m, 12));
      const semis = m - bass;
      const oct = Math.floor(semis / 12);
      const simpleDeg = T.mod(n.letter - bassNote.letter, 7) + 1;
      let name;
      if (simpleDeg === 1 && T.mod(semis, 12) === 0) name = oct === 1 ? 'oktawa czysta' : `${oct} oktawy`;
      else {
        const deg = oct === 1 && simpleDeg <= 6 ? simpleDeg + 7 : simpleDeg;
        const d = T.describeInterval(deg, deg > 7 ? T.mod(semis, 12) + 12 : T.mod(semis, 12));
        name = d.name + (oct >= 2 || (oct === 1 && deg <= 7) ? ' + oktawa' : '');
      }
      return h('li', {}, h('b', {}, `${nn(bassNote)} → ${nn(n)}`), ` ${name} `, h('span', { class: 'muted' }, `(${semis} pt)`));
    });
    if (ivs.length) box.append(h('ul', { class: 'rec-ivs' }, ivs));

    if (!rec.cands.length) {
      box.append(h('p', { class: 'rec-none' }, rec.pcs.size < 2
        ? 'To jeden dźwięk (ew. w kilku oktawach) — dodaj kolejne.'
        : 'Nie rozpoznaję tego zestawu jako znanego akordu. Spróbuj dodać lub usunąć dźwięk.'));
      return;
    }

    const invText = (c) => {
      const sym = T.chordSymbol(c.chord, state.notation);
      if (c.kind === 'slash') return `akord ${sym} z obcym dźwiękiem ${nn(c.bassNote)} w basie`;
      const invByDeg = { 3: 'I', 5: 'II', 7: 'III' }[c.bassDeg];
      const bassIv = c.chord.notes.find((n) => n.note.pc === c.bassPc);
      const base = c.bassIdx === 0 ? 'postać zasadnicza'
        : invByDeg ? `${invByDeg} przewrót (bas: ${nn(c.bassNote)})`
        : `w basie ${bassIv ? bassIv.info.name : ''} (${nn(c.bassNote)})`;
      return base + (c.kind === 'no5' ? ' · bez kwinty' : '');
    };

    box.append(h('div', { class: 'rec-cands' }, rec.cands.map((c, i) => h('button', {
      type: 'button', class: 'rec-card' + (i === 0 ? ' best' : ''),
      title: 'Pokaż budowę tego akordu',
      onclick: () => {
        state.root = T.noteKey(c.chord.root);
        state.type = c.type.id;
        state.inv = c.kind !== 'slash' && c.bassIdx > 0 && c.bassIdx <= 3 ? c.bassIdx : 0;
        state.voicing = 0;
        input.on = false;
        render();
        $('chord-section').scrollIntoView({ behavior: 'smooth' });
      },
    },
    i === 0 ? h('span', { class: 'rec-tag' }, 'najbardziej prawdopodobny') : null,
    h('span', { class: 'sym' }, T.chordSymbol(c.chord, state.notation) + (c.bassPc !== c.rootPc ? '/' + nn(c.bassNote) : '')),
    h('span', { class: 'qual' }, 'akord ' + c.type.name),
    h('span', { class: 'inv' }, invText(c)),
    h('span', { class: 'go' }, 'Pokaż budowę →')))));
  }

  function renderPiano(sc, voiced, rec) {
    const chord = currentChord();
    const highlights = new Map();
    let startMidi = PIANO_START, octaves;
    let name = pcNamer(chord, sc);
    if (input.on) {
      // Szerszy zakres (C2–C6), żeby zmieściły się też dźwięki z gryfu.
      startMidi = 36; octaves = 4;
      for (const m of rec.midis) highlights.set(m, inputMark(rec, m));
      name = (pc) => nn(rec.noteOf(pc));
    } else {
      const midis = pianoMidis(chord, voiced);
      midis.forEach((m, i) => highlights.set(m, { label: labelFor(voiced[i]), role: voiced[i].role }));
      octaves = Math.max(3, Math.ceil((Math.max(...midis) - PIANO_START + 1) / 12));
    }
    I.renderPiano($('piano'), {
      startMidi, octaves, highlights, scalePcs: input.on ? new Set() : sc.pcs,
      keyName: state.pianoNames ? (m) => name(T.mod(m, 12)) : null,
      keyTitle: (m) => input.on ? nn(rec.noteOf(T.mod(m, 12))) + (Math.floor(m / 12) - 1) : midiTitle(name(T.mod(m, 12)), m, chord, sc),
      onKey: (m) => {
        Sound.play([m]);
        if (!input.on) return;
        if (input.source !== 'piano') { clearInput(); input.source = 'piano'; }
        if (input.piano.has(m)) input.piano.delete(m); else input.piano.add(m);
        render();
      },
    });
  }

  let lastVoicings = [];
  function renderGuitar(sc, chord, voiced, rec) {
    const tuning = T.tuningById(state.tuning);
    const bassPc = voiced[0].note.pc;
    const voicings = T.findVoicings(chord, bassPc, tuning).slice(0, 12);
    lastVoicings = voicings;
    if (state.voicing >= voicings.length) state.voicing = 0;
    const sel = voicings[state.voicing];
    const byPc = new Map(chord.notes.map((n) => [n.note.pc, n]));
    const stringNames = tuning.midi.map((m) => nameForKey(PC_KEYS[T.mod(m, 12)]));
    const scaleByPc = new Map(sc.notes.map((n) => [n.note.pc, n]));
    const name = input.on ? (pc) => nn(rec.noteOf(pc)) : pcNamer(chord, sc);

    I.renderFretboard($('fretboard'), {
      tuning: tuning.midi, frets: 15, stringNames,
      cellName: state.fbNames ? (s, f) => name(T.mod(tuning.midi[s] + f, 12)) : null,
      cellTitle: (s, f) => {
        const m = tuning.midi[s] + f;
        const pos = `Struna ${6 - s} (${stringNames[s]}), ${f === 0 ? 'pusta' : 'próg ' + f}: `;
        return pos + (input.on ? name(T.mod(m, 12)) + (Math.floor(m / 12) - 1) : midiTitle(name(T.mod(m, 12)), m, chord, sc));
      },
      cell: (s, f) => {
        const pc = T.mod(tuning.midi[s] + f, 12);
        if (input.on) {
          const m = tuning.midi[s] + f;
          if (input.source === 'guitar' && input.guitar[s] === f) return { ...inputMark(rec, m), strong: true };
          if (state.showAll && rec.pcs.has(pc)) return { ...inputMark(rec, m), strong: false };
          return null;
        }
        const n = byPc.get(pc);
        if (n && sel && sel.frets[s] === f) return { label: labelFor(n), role: n.role, strong: true };
        if (n && state.showAll) return { label: labelFor(n), role: n.role, strong: false };
        if (state.showScale && scaleByPc.has(pc)) {
          const sn = scaleByPc.get(pc);
          const lab = state.labels === 'note' ? nn(sn.note)
            : state.labels === 'semi' ? String(T.mod(pc - chord.root.pc, 12))
            : T.intervalBetween(chord.root, sn.note).symbol;
          return { label: lab, role: 'scale', strong: false };
        }
        return null;
      },
      onCell: (s, f) => {
        Sound.play([tuning.midi[s] + f], 'chord', 'guitar');
        if (!input.on) return;
        if (input.source !== 'guitar') { clearInput(); input.source = 'guitar'; }
        input.guitar[s] = input.guitar[s] === f ? -1 : f;
        render();
      },
    });

    $('voicing-count').textContent = voicings.length ? `(${voicings.length})` : '';
    const box = $('voicings');
    if (!voicings.length) {
      box.replaceChildren(h('p', { class: 'muted' }, 'Nie znaleziono wygodnego chwytu w zakresie 15 progów dla tego akordu i basu. Spróbuj innego przewrotu lub stroju.'));
      return;
    }
    box.replaceChildren(...voicings.map((v, i) => {
      const roleAt = (s) => { const n = byPc.get(T.mod(tuning.midi[s] + v.frets[s], 12)); return n ? n.role : 'ext'; };
      const labelAt = (s) => {
        const n = byPc.get(T.mod(tuning.midi[s] + v.frets[s], 12));
        if (!n) return '';
        return state.labels === 'note' ? nn(n.note).replace('♯', '#').replace('♭', 'b') : state.labels === 'semi' ? String(T.mod(n.iv.semi, 12)) : n.info.symbol.replace('♯', '#').replace('♭', 'b');
      };
      return h('button', {
        type: 'button', class: 'voicing' + (i === state.voicing ? ' active' : ''),
        title: v.complete ? 'Wszystkie dźwięki akordu' : 'Bez dźwięków opcjonalnych (np. kwinty)',
        onclick: () => { state.voicing = i; render(); playVoicing(v, tuning); },
      }, I.renderChordDiagram(v, roleAt, labelAt), v.complete ? null : h('span', { class: 'tag' }, 'bez ' + missingNames(chord, v, tuning)));
    }));
  }

  function missingNames(chord, v, tuning) {
    const pcs = new Set(v.frets.map((f, s) => (f >= 0 ? T.mod(tuning.midi[s] + f, 12) : -1)));
    return chord.notes.filter((n) => !pcs.has(n.note.pc)).map((n) => n.info.symbol).join(', ');
  }

  function playVoicing(v, tuning) {
    Sound.play(v.frets.map((f, s) => (f >= 0 ? tuning.midi[s] + f : null)).filter((m) => m != null), 'strum', 'guitar');
  }

  /* ---------- Zdarzenia ---------- */

  function bind() {
    setupSeg('notation', 'notation');
    setupSeg('labels', 'labels');
    setupSeg('chord-size', 'size', Number);
    $('inversion').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      state.inv = +b.dataset.value; state.voicing = 0; render();
    });
    $('tonic').addEventListener('change', (e) => { state.tonic = e.target.value; selectFirstChord(); render(); });
    $('scale').addEventListener('change', (e) => { state.scale = e.target.value; selectFirstChord(); render(); });
    $('chord-root').addEventListener('change', (e) => { state.root = e.target.value; state.voicing = 0; render(); });
    $('chord-type').addEventListener('change', (e) => { state.type = e.target.value; state.inv = 0; state.voicing = 0; render(); });
    $('tuning').addEventListener('change', (e) => { state.tuning = e.target.value; state.voicing = 0; savePrefs(); render(); });
    $('show-all').addEventListener('change', (e) => { state.showAll = e.target.checked; savePrefs(); render(); });
    $('show-scale').addEventListener('change', (e) => { state.showScale = e.target.checked; savePrefs(); render(); });
    $('piano-names').addEventListener('change', (e) => { state.pianoNames = e.target.checked; savePrefs(); render(); });
    $('fb-names').addEventListener('change', (e) => { state.fbNames = e.target.checked; savePrefs(); render(); });
    $('prog').addEventListener('change', (e) => { stopProg(false); state.prog = e.target.value; render(); });
    $('bpm').addEventListener('input', (e) => { state.bpm = +e.target.value; $('bpm-val').textContent = state.bpm; savePrefs(); });
    $('beats').addEventListener('change', (e) => { state.beats = +e.target.value; savePrefs(); });
    $('loop').addEventListener('change', (e) => { state.loop = e.target.checked; savePrefs(); });
    $('prog-play').addEventListener('click', () => (player.playing ? stopProg() : startProg()));
    $('input-piano').addEventListener('click', () => toggleInput('piano'));
    $('input-guitar').addEventListener('click', () => toggleInput('guitar'));
    $('play-chord').addEventListener('click', () => {
      const c = currentChord();
      Sound.play(pianoMidis(c, T.inversion(c, state.inv)), 'chord');
    });
    $('play-arp').addEventListener('click', () => {
      const c = currentChord();
      Sound.play(pianoMidis(c, T.inversion(c, state.inv)), 'arp');
    });
    window.addEventListener('hashchange', () => { loadHash(); render(); });
  }

  loadPrefs();
  const hadHash = location.hash.length > 1;
  loadHash();
  if (!hadHash) selectFirstChord();
  bind();
  render();
})();
