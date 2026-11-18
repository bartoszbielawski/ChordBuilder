/*
 * ChordBuilder — strona „Modusy”: równoległe (od jasnego do ciemnego) i względne.
 * Stan w adresie: #t=D&p=C
 */
(function () {
  'use strict';
  const T = window.Theory;
  const I = window.Instruments;
  const { h, NOTE_KEYS } = window.Common;
  const $ = (id) => document.getElementById(id);

  const BRIGHT = ['lydian', 'major', 'mixolydian', 'dorian', 'minor', 'phrygian', 'locrian'];
  const ORDER_IN_MAJOR = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'Gb', 'C#', 'Cb'];

  const prefs = window.Common.loadPrefs();
  const state = { notation: prefs.notation === 'H' ? 'H' : 'intl', tonic: 'C', parent: 'C', drone: true, playing: null };
  const nn = (n) => T.noteName(n, state.notation);

  function loadHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (NOTE_KEYS.includes(p.get('t'))) state.tonic = p.get('t');
    if (MAJOR_KEYS.includes(p.get('p'))) state.parent = p.get('p');
  }
  function saveHash() {
    history.replaceState(null, '', '#' + new URLSearchParams({ t: state.tonic, p: state.parent }));
  }

  function fill(sel, items, value) {
    sel.replaceChildren(...items.map(([v, label]) => new Option(label, v, false, v === value)));
  }

  /** Wysokości MIDI skali (z oktawą) od toniki w okolicy C4. */
  function scaleMidis(sc) {
    const start = 60 + sc.tonic.pc - (sc.tonic.pc > 6 ? 12 : 0);
    return [...sc.notes.map((n) => start + n.iv.semi), start + 12];
  }

  let timer = null;
  function playScale(sc, id) {
    clearTimeout(timer);
    const ms = scaleMidis(sc);
    const seq = [...ms, ...ms.slice(0, -1).reverse()];
    const step = 0.32;
    if (state.drone) Sound.play([ms[0] - 24, ms[0] - 12], 'chord', 'piano', seq.length * step + 1.2);
    Sound.play(ms, 'arp', 'piano', 1.0);
    state.playing = id;
    render();
    timer = setTimeout(() => { state.playing = null; render(); }, seq.length * 280 + 400);
  }

  function renderParallel() {
    const tonic = T.parseNote(state.tonic);
    let prev = null;
    $('parallel').replaceChildren(...BRIGHT.map((id) => {
      const sc = T.buildScale(tonic, id);
      const alts = new Set(T.alterationsVsMajor(sc.scale).map((d) => d.deg));
      const changed = prev ? sc.notes.find((n, i) => n.iv.semi !== prev.notes[i].iv.semi) : null;
      prev = sc;
      const triad = T.diatonicChords(sc, 3)[0];
      const cells = sc.notes.map((n) => {
        const isChar = sc.scale.char === n.iv.sym;
        const cls = ['mcell', alts.has(n.iv.deg) ? (n.iv.semi < T.MAJOR_SEMI[n.iv.deg - 1] ? 'flat' : 'sharp') : '', isChar ? 'char' : ''].join(' ');
        return h('td', { class: cls, title: T.describeInterval(n.iv.deg, n.iv.semi).name },
          h('b', {}, nn(n.note)), h('small', {}, T.describeInterval(n.iv.deg, n.iv.semi).symbol));
      });
      const link = `./#t=${encodeURIComponent(T.noteKey(tonic))}&s=${id}`;
      return h('tr', { class: state.playing === 'p-' + id ? 'playing' : '' },
        h('td', {}, h('a', { href: link, title: 'Otwórz na stronie głównej (akordy tej skali)' }, `${nn(tonic)} ${sc.scale.name.toLowerCase().replace(/ \(.*\)/, '')}`),
          h('div', { class: 'muted small-text' }, sc.scale.mood.split(/[.—]/)[0])),
        cells,
        h('td', { class: 'mono' }, changed ? T.describeInterval(changed.iv.deg, changed.iv.semi).symbol : '—'),
        h('td', {}, triad ? `${T.chordSymbol(triad.chord, state.notation)} (${triad.chord.type.name})` : ''),
        h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => playScale(sc, 'p-' + id) }, '▶')));
    }));
  }

  function renderRelative() {
    const parent = T.parseNote(state.parent);
    const ps = T.buildScale(parent, 'major');
    const sig = T.keySignature(parent, 'major');
    $('relative').replaceChildren(...ORDER_IN_MAJOR.map((id, deg) => {
      const tonic = ps.notes[deg].note;
      const sc = T.buildScale(tonic, id);
      const ms = scaleMidis(sc);
      const steps = sc.notes.map((n, i) => (i + 1 < sc.notes.length ? sc.notes[i + 1].iv.semi : 12) - n.iv.semi);
      const staff = h('div', { class: 'melody-wrap rel-staff' });
      I.renderMelody(staff, [...sc.notes.map((n, i) => [{ midi: ms[i], note: n.note, role: i === 0 ? 'root' : sc.scale.char === n.iv.sym ? 'ext' : null }]),
        [{ midi: ms[7], note: tonic, role: 'root' }]], {
        keySig: sig, gap: 30, ariaLabel: `${nn(tonic)} ${sc.scale.name}`,
        onColumn: (i) => Sound.play([ms[i]]),
      });
      return h('div', { class: 'rel-row' + (state.playing === 'r-' + id ? ' playing' : '') },
        h('div', { class: 'rel-head' },
          h('span', { class: 'roman' }, ROMAN[deg]),
          h('a', { href: `./#t=${encodeURIComponent(T.noteKey(tonic))}&s=${id}`, class: 'rel-name' }, `${nn(tonic)} ${sc.scale.name.toLowerCase().replace(/ \(.*\)/, '')}`),
          h('span', { class: 'rel-steps mono', title: 'Odległości między kolejnymi dźwiękami w półtonach' },
            steps.map((s) => h('span', { class: s === 1 ? 'half' : '' }, String(s)))),
          h('button', { type: 'button', class: 'btn small', onclick: () => playScale(sc, 'r-' + id) }, '▶')),
        staff);
    }));
  }

  function render() {
    fill($('tonic'), NOTE_KEYS.map((k) => [k, nn(T.parseNote(k))]), state.tonic);
    fill($('parent'), MAJOR_KEYS.map((k) => {
      const s = T.keySignature(T.parseNote(k), 'major');
      return [k, `${nn(T.parseNote(k))}-dur (${s.count ? s.count + (s.type === 'sharp' ? '♯' : '♭') : '0'})`];
    }), state.parent);
    $('drone').checked = state.drone;
    renderParallel();
    renderRelative();
    saveHash();
  }

  window.Common.seg($('notation'), state.notation, (v) => { state.notation = v; window.Common.savePref('notation', v); render(); });
  $('tonic').addEventListener('change', (e) => { state.tonic = e.target.value; render(); });
  $('parent').addEventListener('change', (e) => { state.parent = e.target.value; render(); });
  $('drone').addEventListener('change', (e) => { state.drone = e.target.checked; });
  window.addEventListener('hashchange', () => { loadHash(); render(); });

  loadHash();
  render();
  window.Common.registerSW();
})();
