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
  };

  /* ---------- Trwałość: preferencje + URL ---------- */

  const PREF_KEYS = ['notation', 'labels', 'tuning', 'showAll', 'showScale', 'pianoNames', 'fbNames'];
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
  }
  function saveHash() {
    const p = new URLSearchParams({ t: state.tonic, s: state.scale, r: state.root, c: state.type, i: state.inv, n: state.size });
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
  function pcNamer(chord, sc) {
    const map = new Map();
    for (const n of sc.notes) map.set(n.note.pc, n.note);
    for (const n of chord.notes) map.set(n.note.pc, n.note);
    const flats = sc.notes.some((n) => n.note.acc < 0) || (sc.notes.every((n) => n.note.acc === 0) && chord.root.acc < 0);
    const keys = flats ? FLAT_KEYS : SHARP_KEYS;
    return (pc) => nn(map.get(pc) || T.parseNote(keys[pc]));
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

    renderSelects(chord);
    renderScale(sc);
    renderDiatonic(sc, chord);
    renderFitting(sc, chord);
    const voiced = renderChord(sc, chord);
    renderPiano(sc, voiced);
    renderGuitar(sc, chord, voiced);
    saveHash();
  }

  function renderSelects(chord) {
    fillSelect($('tonic'), NOTE_KEYS.map((k) => [k, nameForKey(k)]), state.tonic);
    if (!NOTE_KEYS.includes(state.tonic)) $('tonic').prepend(new Option(nameForKey(state.tonic), state.tonic, true, true));

    fillSelect($('scale'), T.SCALES.map((s) => [s.id, s.name]), state.scale);

    fillSelect($('chord-root'), NOTE_KEYS.map((k) => [k, nameForKey(k)]), state.root);
    if (!NOTE_KEYS.includes(state.root)) $('chord-root').prepend(new Option(nameForKey(state.root), state.root, true, true));

    const typeSel = $('chord-type');
    typeSel.replaceChildren(...T.CHORD_GROUPS.map((g) => {
      const og = document.createElement('optgroup');
      og.label = g.name;
      for (const t of T.CHORD_TYPES.filter((t) => t.group === g.id)) {
        const o = new Option(`${nn(chord.root)}${t.symbol} — ${t.name}`, t.id, false, t.id === state.type);
        og.append(o);
      }
      return og;
    }));

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

  function renderPiano(sc, voiced) {
    const chord = currentChord();
    const midis = pianoMidis(chord, voiced);
    const highlights = new Map();
    midis.forEach((m, i) => highlights.set(m, { label: labelFor(voiced[i]), role: voiced[i].role }));
    const octaves = Math.max(3, Math.ceil((Math.max(...midis) - PIANO_START + 1) / 12));
    const name = pcNamer(chord, sc);
    I.renderPiano($('piano'), {
      startMidi: PIANO_START, octaves, highlights, scalePcs: sc.pcs,
      keyName: state.pianoNames ? (m) => name(T.mod(m, 12)) : null,
      keyTitle: (m) => midiTitle(name(T.mod(m, 12)), m, chord, sc),
      onKey: (m) => Sound.play([m]),
    });
  }

  let lastVoicings = [];
  function renderGuitar(sc, chord, voiced) {
    const tuning = T.tuningById(state.tuning);
    const bassPc = voiced[0].note.pc;
    const voicings = T.findVoicings(chord, bassPc, tuning).slice(0, 12);
    lastVoicings = voicings;
    if (state.voicing >= voicings.length) state.voicing = 0;
    const sel = voicings[state.voicing];
    const byPc = new Map(chord.notes.map((n) => [n.note.pc, n]));
    const stringNames = tuning.midi.map((m) => nameForKey(PC_KEYS[T.mod(m, 12)]));
    const scaleByPc = new Map(sc.notes.map((n) => [n.note.pc, n]));
    const name = pcNamer(chord, sc);

    I.renderFretboard($('fretboard'), {
      tuning: tuning.midi, frets: 15, stringNames,
      cellName: state.fbNames ? (s, f) => name(T.mod(tuning.midi[s] + f, 12)) : null,
      cellTitle: (s, f) => {
        const m = tuning.midi[s] + f;
        return `Struna ${6 - s} (${stringNames[s]}), ${f === 0 ? 'pusta' : 'próg ' + f}: ` + midiTitle(name(T.mod(m, 12)), m, chord, sc);
      },
      cell: (s, f) => {
        const pc = T.mod(tuning.midi[s] + f, 12);
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
      onCell: (s, f) => Sound.play([tuning.midi[s] + f], 'chord', 'guitar'),
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
