/*
 * ChordBuilder — strona „Interwały”: kalkulator, tabela i zasady.
 * Stan w adresie: #lo=C4&hi=E4&tr=C
 */
(function () {
  'use strict';
  const T = window.Theory;
  const I = window.Instruments;
  const { h, NOTE_KEYS, midiOf, noteOfMidi, octaveName } = window.Common;
  const $ = (id) => document.getElementById(id);

  const prefs = window.Common.loadPrefs();
  const state = {
    notation: prefs.notation === 'H' ? 'H' : 'intl',
    lo: { key: 'C', oct: 4 }, hi: { key: 'E', oct: 4 },
    tableRoot: 'C', click: 'high',
  };
  const nn = (n) => T.noteName(n, state.notation);
  const KEYS = [...NOTE_KEYS, 'Cb', 'B#', 'E#', 'Fb'];
  const OCTS = [2, 3, 4, 5, 6];

  function parseHashNote(v) {
    const m = /^([A-G](?:#{1,2}|b{1,2})?)(\d)$/.exec(v || '');
    return m ? { key: m[1], oct: Math.max(1, Math.min(7, +m[2])) } : null;
  }
  function loadHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.lo = parseHashNote(p.get('lo')) || state.lo;
    state.hi = parseHashNote(p.get('hi')) || state.hi;
    if (/^[A-G](#|b)?$/.test(p.get('tr') || '')) state.tableRoot = p.get('tr');
  }
  function saveHash() {
    history.replaceState(null, '', '#' + new URLSearchParams({
      lo: state.lo.key + state.lo.oct, hi: state.hi.key + state.hi.oct, tr: state.tableRoot,
    }));
  }

  const lowNote = () => T.parseNote(state.lo.key);
  const highNote = () => T.parseNote(state.hi.key);
  const lowMidi = () => midiOf(lowNote(), state.lo.oct);
  const highMidi = () => midiOf(highNote(), state.hi.oct);

  function fill(sel, items, value) {
    sel.replaceChildren(...items.map(([v, label]) => new Option(label, v, false, String(v) === String(value))));
  }

  /** Stan z wysokości MIDI (wybór z klawiatury) — z domyślną pisownią. */
  function fromMidi(m) {
    const note = noteOfMidi(m);
    return { key: T.noteKey(note), oct: octaveName(note, m) };
  }

  /** Ustaw górny dźwięk tak, by tworzył interwał iv nad dolnym. */
  function buildFromLow(sym) {
    const iv = T.parseInterval(sym);
    const note = T.transpose(lowNote(), iv);
    const m = lowMidi() + iv.semi;
    state.hi = { key: T.noteKey(note), oct: octaveName(note, m) };
  }

  function analyze() {
    const ln = lowNote(), hn = highNote();
    let lm = lowMidi(), hm = highMidi();
    let swapped = false;
    if (hm < lm || (hm === lm && T.staffStep(hn, hm) < T.staffStep(ln, lm))) swapped = true;
    const [a, am, b, bm] = swapped ? [hn, hm, ln, lm] : [ln, lm, hn, hm];
    const info = T.intervalOf(a, am, b, bm);
    return { a, am, b, bm, info, swapped };
  }

  function render() {
    // Selekty
    const keyItems = KEYS.map((k) => [k, nn(T.parseNote(k))]);
    fill($('low-note'), keyItems, state.lo.key);
    fill($('high-note'), keyItems, state.hi.key);
    fill($('low-oct'), OCTS.map((o) => [o, String(o)]), state.lo.oct);
    fill($('high-oct'), OCTS.map((o) => [o, String(o)]), state.hi.oct);
    fill($('table-root'), NOTE_KEYS.map((k) => [k, nn(T.parseNote(k))]), state.tableRoot);
    fill($('build-iv'), [['', '— wybierz interwał —'], ...T.INTERVALS.filter((x) => x.semi > 0).map((x) => [x.sym, `${x.info.name} (${x.info.pl})`])], '');

    const r = analyze();
    renderResult(r);
    renderVisual(r);
    renderTable();
    saveHash();
  }

  function renderResult(r) {
    const box = $('iv-result');
    const { info } = r;
    if (!info) { box.replaceChildren(h('p', { class: 'muted' }, 'Wybierz dwa różne dźwięki.')); return; }
    const semi = info.semi;
    const tones = semi / 2;
    const tonesText = semi === 0 ? '0 tonów' : Number.isInteger(tones) ? `${tones} ${tones === 1 ? 'cały ton' : tones < 5 ? 'całe tony' : 'całych tonów'}` : `${String(tones).replace('.', ',')} tonu`;
    const cons = T.consonance(info);
    const compound = info.deg > 8;
    const simpleDeg = compound ? ((info.deg - 1) % 7) + 1 : info.deg;
    const simple = compound ? T.describeInterval(simpleDeg, semi - 12 * Math.floor((info.deg - 1) / 7)) : null;
    const inv = info.deg <= 8 ? T.invertInterval(info.deg, semi) : T.invertInterval(simpleDeg, simple.semi);
    const enh = info.deg <= 8 ? T.enharmonicIntervals(semi).filter((d) => d.abbr !== info.abbr) : [];
    const oct = (n, m) => nn(n) + octaveName(n, m);

    box.replaceChildren(
      h('div', { class: 'iv-head' },
        h('div', { class: 'iv-big' }, info.pl),
        h('div', {},
          h('div', { class: 'iv-name' }, info.name.replace(/^./, (c) => c.toUpperCase())),
          h('div', { class: 'muted' }, `${oct(r.a, r.am)} → ${oct(r.b, r.bm)} · skrót międzynarodowy ${info.abbr}` +
            (r.swapped ? ' · (dźwięki zamienione: dolny jest wyżej niż górny)' : '')))),
      h('dl', { class: 'info-dl iv-dl' },
        h('dt', {}, 'Liczba'), h('dd', {}, `${info.deg} — licząc nazwy literowe: ${letters(r.a, r.b, info.deg)}`),
        h('dt', {}, 'Półtony'), h('dd', {}, `${semi} (${tonesText})`),
        h('dt', {}, 'Brzmienie'), h('dd', {}, h('span', { class: 'cons cons-' + cons.id }, cons.name), ' — ' + cons.why),
        compound ? h('dt', {}, 'Interwał złożony') : null,
        compound ? h('dd', {}, `${simple.name} + ${Math.floor((info.deg - 1) / 7) === 1 ? 'oktawa' : Math.floor((info.deg - 1) / 7) + ' oktawy'} (${simple.pl} + 8)`) : null,
        h('dt', {}, 'Przewrót'), h('dd', {}, `${inv.name} (${inv.pl}) — ${simpleDeg} + ${inv.deg} = 9, ${compound ? simple.semi : semi} + ${inv.semi} = 12 półtonów`),
        enh.length ? h('dt', {}, 'Enharmonicznie') : null,
        enh.length ? h('dd', {}, enh.map((d) => {
          const other = T.transpose(r.a, T.parseInterval(d.symbol === '1' ? '1' : d.symbol.replace(/♭/g, 'b').replace(/♯/g, '#')));
          return `${d.name} (${d.pl}, np. ${nn(r.a)}→${nn(other)})`;
        }).join('; ') + ' — brzmi tak samo, ale inaczej się zapisuje') : null));
  }

  function letters(a, b, deg) {
    const out = [];
    for (let i = 0; i < Math.min(deg, 15); i++) out.push(T.noteName(T.makeNote((a.letter + i) % 7, 0), state.notation).replace(/[♯♭]/g, ''));
    return out.join(', ');
  }

  function renderVisual(r) {
    const cols = [[{ midi: r.am, note: r.a, role: 'root' }], [{ midi: r.bm, note: r.b, role: 'third' }],
      [{ midi: r.am, note: r.a, role: 'root' }, { midi: r.bm, note: r.b, role: 'third' }]];
    const avg = (r.am + r.bm) / 2;
    I.renderMelody($('iv-staff'), cols, {
      clef: avg < 57 ? 'bass' : 'treble', gap: 46,
      labels: [nn(r.a), nn(r.b), r.info ? r.info.pl : ''],
      ariaLabel: 'Interwał na pięciolinii: osobno i razem',
      onColumn: (i) => (i === 2 ? play('harm') : Sound.play([i === 0 ? r.am : r.bm])),
    });

    const lo = Math.min(r.am, r.bm), hi = Math.max(r.am, r.bm);
    let start = Math.min(48, Math.floor(lo / 12) * 12);
    const octaves = Math.max(3, Math.ceil((hi - start + 1) / 12));
    const hl = new Map();
    hl.set(r.am, { label: nn(r.a), role: 'root' });
    hl.set(r.bm, { label: r.am === r.bm ? nn(r.a) : nn(r.b), role: r.am === r.bm ? 'root' : 'third' });
    // Półtony między dźwiękami — liczby na klawiszach pośrednich.
    const between = new Map();
    for (let m = lo + 1; m < hi; m++) between.set(m, String(m - lo));
    I.renderPiano($('iv-piano'), {
      startMidi: start, octaves, highlights: hl, scalePcs: new Set(),
      keyName: (m) => between.get(m) || null,
      keyTitle: (m) => { const n = noteOfMidi(m); return nn(n) + octaveName(n, m); },
      onKey: (m) => {
        Sound.play([m]);
        state[state.click === 'low' ? 'lo' : 'hi'] = fromMidi(m);
        state.click = state.click === 'low' ? 'high' : 'low';
        syncClick(state.click);
        render();
      },
    });
  }

  let syncClick = () => {};

  function renderTable() {
    const root = T.parseNote(state.tableRoot);
    const base = midiOf(root, 4) > 66 ? 3 : 4;
    const rm = midiOf(root, base);
    $('iv-tbody').replaceChildren(...T.INTERVALS.map((x) => {
      const d = x.info;
      const top = T.transpose(root, x);
      const cons = T.consonance(d);
      const inv = x.deg <= 8 ? T.invertInterval(x.deg, x.semi) : null;
      const select = () => {
        state.lo = { key: T.noteKey(root), oct: base };
        state.hi = { key: T.noteKey(top), oct: octaveName(top, rm + x.semi) };
        render();
        $('calc-section').scrollIntoView({ behavior: 'smooth' });
      };
      return h('tr', { class: 'clickable', onclick: select, title: 'Pokaż w kalkulatorze' },
        h('td', { class: 'mono' }, String(x.semi)),
        h('td', {}, d.name),
        h('td', { class: 'mono' }, `${d.pl} (${d.abbr})`),
        h('td', {}, `${nn(root)} → ${nn(top)}`),
        h('td', {}, h('span', { class: 'cons cons-' + cons.id }, cons.name)),
        h('td', { class: 'mono' }, inv ? inv.pl : '—'),
        h('td', {}, h('button', {
          type: 'button', class: 'btn small ghost', 'aria-label': 'Zagraj ' + d.name,
          onclick: (e) => { e.stopPropagation(); Sound.play([rm, rm + x.semi], 'arp', 'piano', 1.2); },
        }, '▶')));
    }));
  }

  function play(mode) {
    const r = analyze();
    if (mode === 'harm') Sound.play([r.am, r.bm], 'chord', 'piano', 2);
    else {
      Sound.play([r.am], 'chord', 'piano', 1.2);
      setTimeout(() => Sound.play([r.bm], 'chord', 'piano', 1.4), 600);
    }
  }

  function bind() {
    window.Common.seg($('notation'), state.notation, (v) => { state.notation = v; window.Common.savePref('notation', v); render(); });
    syncClick = window.Common.seg($('click-target'), state.click, (v) => { state.click = v; });
    $('low-note').addEventListener('change', (e) => { state.lo.key = e.target.value; render(); });
    $('high-note').addEventListener('change', (e) => { state.hi.key = e.target.value; render(); });
    $('low-oct').addEventListener('change', (e) => { state.lo.oct = +e.target.value; render(); });
    $('high-oct').addEventListener('change', (e) => { state.hi.oct = +e.target.value; render(); });
    $('swap').addEventListener('click', () => { [state.lo, state.hi] = [state.hi, state.lo]; render(); });
    $('build-iv').addEventListener('change', (e) => { if (e.target.value) { buildFromLow(e.target.value); render(); play('mel'); } });
    $('table-root').addEventListener('change', (e) => { state.tableRoot = e.target.value; render(); });
    $('play-mel').addEventListener('click', () => play('mel'));
    $('play-harm').addEventListener('click', () => play('harm'));
    window.addEventListener('hashchange', () => { loadHash(); render(); });
  }

  loadHash();
  bind();
  render();
  window.Common.registerSW();
})();
