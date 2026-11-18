/*
 * ChordBuilder — wizualizacje SVG: klawiatura, gryf gitary, diagram chwytu.
 */
(function (global) {
  'use strict';
  const { mod } = global.Theory;
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls, extra = {}) {
    const t = el('text', { x, y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...extra }, parent);
    t.textContent = str;
    return t;
  }

  /* ---------- Pianino ---------- */

  const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_AFTER = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // pc czarnego → indeks białego po lewej

  /**
   * opts: { startMidi (C), octaves, highlights: Map(midi → {label, role}),
   *         scalePcs: Set, onKey(midi) }
   */
  function renderPiano(container, opts) {
    const { startMidi = 48, octaves = 3, highlights = new Map(), scalePcs = new Set(), onKey, keyName, keyTitle } = opts;
    const W = 34, H = 150, BW = 20, BH = 94;
    const whiteCount = octaves * 7 + 1;
    const svg = el('svg', {
      viewBox: `0 0 ${whiteCount * W + 2} ${H + 24}`, class: 'piano', role: 'img',
      'aria-label': 'Klawiatura fortepianu z zaznaczonymi dźwiękami akordu',
    });
    const whites = el('g', {}, svg), blacks = el('g', {}, svg);

    const keyX = {};
    for (let i = 0; i < whiteCount; i++) {
      const midi = startMidi + Math.floor(i / 7) * 12 + WHITE_PCS[i % 7];
      keyX[midi] = { x: 1 + i * W, black: false };
    }
    for (let o = 0; o < octaves; o++) {
      for (const [pc, wi] of Object.entries(BLACK_AFTER)) {
        const midi = startMidi + o * 12 + +pc;
        keyX[midi] = { x: 1 + (o * 7 + wi + 1) * W - BW / 2, black: true };
      }
    }

    for (const [midiStr, k] of Object.entries(keyX)) {
      const midi = +midiStr;
      const h = highlights.get(midi);
      const g = el('g', { class: 'key-g', 'data-midi': midi }, k.black ? blacks : whites);
      el('rect', {
        x: k.x, y: 1, width: k.black ? BW : W, height: k.black ? BH : H, rx: 4,
        class: (k.black ? 'key black' : 'key white') + (h ? ' on role-' + h.role : ''),
      }, g);
      const cx = k.x + (k.black ? BW : W) / 2;
      if (keyTitle) el('title', {}, g).textContent = keyTitle(midi);
      if (!h && keyName) {
        const nm = keyName(midi);
        text(g, cx, k.black ? BH - 30 : H - 36, nm, 'key-name ' + (k.black ? 'on-black' : 'on-white') + (nm.length > 1 ? ' small' : ''));
      }
      if (h) {
        const cy = k.black ? BH - 16 : H - 20;
        el('circle', { cx, cy, r: k.black ? 9 : 12, class: 'dot role-' + h.role }, g);
        text(g, cx, cy, h.label, 'dot-label' + (h.label.length > 2 ? ' small' : ''));
      } else if (scalePcs.has(mod(midi, 12))) {
        el('circle', { cx, cy: k.black ? BH - 12 : H - 14, r: 3.5, class: 'scale-dot' }, g);
      }
      if (!k.black && mod(midi, 12) === 0) {
        text(svg, cx, H + 12, 'C' + (Math.floor(midi / 12) - 1), 'octave-label');
      }
      if (onKey) g.addEventListener('click', () => onKey(midi));
    }
    container.replaceChildren(svg);
  }

  /* ---------- Gryf gitary ---------- */

  function fretX(f, frets, x0, width) {
    return x0 + (width * (1 - Math.pow(2, -f / 12))) / (1 - Math.pow(2, -frets / 12));
  }

  /**
   * opts: { tuning (midi[]), frets, cell(stringIdx, fret) → {label, role, strong} | null,
   *         stringNames[], onCell(s, f) }
   * Struny: indeks 0 = najniższa (E), rysowana na dole.
   */
  function renderFretboard(container, opts) {
    const { tuning, frets = 15, cell, stringNames = [], onCell, cellName, cellTitle } = opts;
    const x0 = 44, width = 900, top = 18, gap = 28;
    const h = top * 2 + gap * 5;
    const svg = el('svg', {
      viewBox: `0 0 ${x0 + width + 16} ${h + 22}`, class: 'fretboard', role: 'img',
      'aria-label': 'Gryf gitary z zaznaczonymi dźwiękami akordu',
    });
    const yOf = (s) => top + (5 - s) * gap;

    el('rect', { x: x0, y: top - 8, width, height: gap * 5 + 16, class: 'fb-wood', rx: 3 }, svg);
    for (const f of [3, 5, 7, 9, 15]) {
      const cx = (fretX(f - 1, frets, x0, width) + fretX(f, frets, x0, width)) / 2;
      if (f <= frets) el('circle', { cx, cy: top + gap * 2.5, r: 6, class: 'fb-inlay' }, svg);
    }
    if (frets >= 12) {
      const cx = (fretX(11, frets, x0, width) + fretX(12, frets, x0, width)) / 2;
      el('circle', { cx, cy: top + gap * 1.5, r: 6, class: 'fb-inlay' }, svg);
      el('circle', { cx, cy: top + gap * 3.5, r: 6, class: 'fb-inlay' }, svg);
    }
    for (let f = 0; f <= frets; f++) {
      const x = fretX(f, frets, x0, width);
      el('line', { x1: x, x2: x, y1: top - 8, y2: top + gap * 5 + 8, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
      if (f > 0) text(svg, (fretX(f - 1, frets, x0, width) + x) / 2, h + 10, String(f), 'fb-num');
    }
    for (let s = 0; s < 6; s++) {
      el('line', { x1: x0, x2: x0 + width, y1: yOf(s), y2: yOf(s), class: 'fb-string', 'stroke-width': 0.8 + (5 - s) * 0.35 }, svg);
      text(svg, 12, yOf(s), stringNames[s] || '', 'fb-sname');
    }

    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= frets; f++) {
        const cx = f === 0 ? x0 - 16 : (fretX(f - 1, frets, x0, width) + fretX(f, frets, x0, width)) / 2;
        const cy = yOf(s);
        const c = cell(s, f);
        const g = el('g', { class: 'fb-cell' }, svg);
        el('rect', { x: cx - 14, y: cy - 13, width: 28, height: 26, class: 'fb-hit' }, g);
        if (cellTitle) el('title', {}, g).textContent = cellTitle(s, f);
        if (c) {
          el('circle', { cx, cy, r: 11, class: 'dot role-' + c.role + (c.strong ? '' : ' faint') }, g);
          text(g, cx, cy, c.label, 'dot-label' + (c.label.length > 2 ? ' small' : '') + (c.strong ? '' : ' faint'));
        } else if (cellName && f > 0) {
          const nm = cellName(s, f);
          el('rect', { x: cx - 10, y: cy - 7, width: 20, height: 14, rx: 7, class: 'fb-name-bg' }, g);
          text(g, cx, cy, nm, 'fb-name' + (nm.length > 1 ? ' small' : ''));
        }
        if (onCell) g.addEventListener('click', () => onCell(s, f));
      }
    }
    container.replaceChildren(svg);
  }

  /* ---------- Diagram chwytu ---------- */

  /** voicing: { frets[6] }, roleAt(s) → role, labelAt(s) → string */
  function renderChordDiagram(voicing, roleAt, labelAt) {
    const frets = voicing.frets;
    const fretted = frets.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const minF = fretted.length ? Math.min(...fretted) : 1;
    const base = maxF <= 4 ? 1 : minF;
    const x0 = 32, dx = 16, y0 = 26, dy = 20, rows = 4;
    const svg = el('svg', { viewBox: `0 0 ${x0 + dx * 5 + 16} ${y0 + dy * rows + 26}`, class: 'diagram' });

    for (let s = 0; s < 6; s++) el('line', { x1: x0 + s * dx, x2: x0 + s * dx, y1: y0, y2: y0 + dy * rows, class: 'dg-line' }, svg);
    for (let r = 0; r <= rows; r++) {
      el('line', { x1: x0, x2: x0 + dx * 5, y1: y0 + r * dy, y2: y0 + r * dy, class: r === 0 && base === 1 ? 'dg-nut' : 'dg-line' }, svg);
    }
    if (base > 1) text(svg, 13, y0 + dy / 2, base + 'fr', 'dg-base');

    // Barré: najniższy próg na ≥2 strunach, bez strun pustych pomiędzy.
    if (fretted.length) {
      const idx = frets.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
      if (idx.length >= 2) {
        const a = idx[0], b = idx[idx.length - 1];
        const between = frets.slice(a, b + 1);
        if (between.every((f) => f >= minF)) {
          el('rect', { x: x0 + a * dx - 6, y: y0 + (minF - base) * dy + dy / 2 - 6, width: (b - a) * dx + 12, height: 12, rx: 6, class: 'dg-barre' }, svg);
        }
      }
    }

    frets.forEach((f, s) => {
      const x = x0 + s * dx;
      if (f < 0) text(svg, x, y0 - 10, '×', 'dg-mark');
      else if (f === 0) el('circle', { cx: x, cy: y0 - 10, r: 4.5, class: 'dg-open role-' + roleAt(s) }, svg);
      else {
        const cy = y0 + (f - base) * dy + dy / 2;
        el('circle', { cx: x, cy, r: 7, class: 'dot role-' + roleAt(s) }, svg);
        const lab = labelAt(s);
        text(svg, x, cy, lab, 'dot-label tiny');
      }
    });
    const marks = frets.map((f) => (f < 0 ? 'x' : String(f)));
    const wide = frets.some((f) => f > 9);
    const t = text(svg, x0 + dx * 2.5, y0 + dy * rows + 16, marks.join(wide ? ' ' : ''), 'dg-tab');
    if (wide) { t.setAttribute('textLength', dx * 5 + 16); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    return svg;
  }

  global.Instruments = { renderPiano, renderFretboard, renderChordDiagram };
})(window);
