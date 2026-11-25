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

  /* ---------- Obsługa z klawiatury (dostępność) ---------- */

  /**
   * „Wędrujący” fokus: cały instrument to jeden przystanek klawisza Tab, strzałki
   * przechodzą między elementami, Enter lub spacja — jak kliknięcie.
   * nodes: [{ g, label, activate }]; cols — szerokość wiersza (gryf), inaczej jeden wiersz.
   * Po ponownym narysowaniu fokus wraca na ten sam element (data-nav).
   */
  function rovingFocus(container, svg, nodes, cols = nodes.length) {
    const prev = container.contains(document.activeElement) ? document.activeElement.getAttribute('data-nav') : null;
    let cur = prev != null && nodes[+prev] ? +prev : 0;
    svg.setAttribute('role', 'group');
    nodes.forEach((n, i) => {
      n.g.setAttribute('role', 'button');
      n.g.setAttribute('tabindex', i === cur ? '0' : '-1');
      n.g.setAttribute('aria-label', n.label);
      n.g.setAttribute('data-nav', i);
      n.g.addEventListener('focus', () => {
        if (nodes[cur]) nodes[cur].g.setAttribute('tabindex', '-1');
        cur = i;
        n.g.setAttribute('tabindex', '0');
      });
      n.g.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const row = Math.floor(i / cols);
        let j = null;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); n.activate(); return; }
        if (e.key === 'ArrowRight') j = i + 1;
        else if (e.key === 'ArrowLeft') j = i - 1;
        else if (e.key === 'ArrowUp') j = cols < nodes.length ? i + cols : i + 1;
        else if (e.key === 'ArrowDown') j = cols < nodes.length ? i - cols : i - 1;
        else if (e.key === 'Home') j = row * cols;
        else if (e.key === 'End') j = Math.min(nodes.length, (row + 1) * cols) - 1;
        else return;
        e.preventDefault();
        e.stopPropagation();
        const sameRow = !['ArrowRight', 'ArrowLeft'].includes(e.key) || Math.floor(j / cols) === row;
        if (j >= 0 && j < nodes.length && sameRow) nodes[j].g.focus();
      });
    });
    if (prev != null && nodes[cur]) nodes[cur].g.focus();
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
    const nav = [];
    const PC = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];

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
        if (nm) text(g, cx, k.black ? BH - 30 : H - 36, nm, 'key-name ' + (k.black ? 'on-black' : 'on-white') + (nm.length > 1 ? ' small' : ''));
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
      if (onKey) {
        g.addEventListener('click', () => onKey(midi));
        const name = keyTitle ? keyTitle(midi) : PC[mod(midi, 12)] + (Math.floor(midi / 12) - 1);
        const mark = h ? (h.label && h.label !== '●' ? `, zaznaczony: ${h.label}` : ', zaznaczony') : '';
        nav.push({ midi, g, activate: () => onKey(midi), label: `${name}, ${k.black ? 'czarny klawisz' : 'biały klawisz'}${mark}` });
      }
    }
    // Opis tekstowy dla czytników ekranu: które klawisze są zaznaczone.
    const marked = [...highlights.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x.label).filter((l) => l && l !== '●');
    if (marked.length) el('desc', {}, svg).textContent = 'Zaznaczone: ' + marked.join(', ');
    container.replaceChildren(svg);
    if (nav.length) rovingFocus(container, svg, nav.sort((a, b) => a.midi - b.midi));
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
    const N = tuning.length, L = N - 1;
    const x0 = 44, width = 900, top = 18, gap = 28;
    const h = top * 2 + gap * L;
    const svg = el('svg', {
      viewBox: `0 0 ${x0 + width + 16} ${h + 22}`, class: 'fretboard', role: 'img',
      'aria-label': N === 6 ? 'Gryf gitary z zaznaczonymi dźwiękami' : 'Gryf instrumentu z zaznaczonymi dźwiękami',
    });
    const yOf = (s) => top + (L - s) * gap;

    el('rect', { x: x0, y: top - 8, width, height: gap * L + 16, class: 'fb-wood', rx: 3 }, svg);
    for (const f of [3, 5, 7, 9, 15]) {
      const cx = (fretX(f - 1, frets, x0, width) + fretX(f, frets, x0, width)) / 2;
      if (f <= frets) el('circle', { cx, cy: top + gap * L / 2, r: 6, class: 'fb-inlay' }, svg);
    }
    if (frets >= 12) {
      const cx = (fretX(11, frets, x0, width) + fretX(12, frets, x0, width)) / 2;
      el('circle', { cx, cy: top + gap * (L / 2 - 1), r: 6, class: 'fb-inlay' }, svg);
      el('circle', { cx, cy: top + gap * (L / 2 + 1), r: 6, class: 'fb-inlay' }, svg);
    }
    for (let f = 0; f <= frets; f++) {
      const x = fretX(f, frets, x0, width);
      el('line', { x1: x, x2: x, y1: top - 8, y2: top + gap * L + 8, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
      if (f > 0) text(svg, (fretX(f - 1, frets, x0, width) + x) / 2, h + 10, String(f), 'fb-num');
    }
    for (let s = 0; s < N; s++) {
      el('line', { x1: x0, x2: x0 + width, y1: yOf(s), y2: yOf(s), class: 'fb-string', 'stroke-width': 0.8 + (L - s) * 0.35 }, svg);
      text(svg, 12, yOf(s), stringNames[s] || '', 'fb-sname');
    }

    const nav = [];
    for (let s = 0; s < N; s++) {
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
        if (onCell) {
          g.addEventListener('click', () => onCell(s, f));
          // cellTitle (jeśli jest) opisuje już pole w pełni; inaczej — struna, próg i zaznaczony dźwięk.
          const label = cellTitle ? cellTitle(s, f)
            : `Struna ${N - s}, ${f === 0 ? 'pusta' : 'próg ' + f}` + (c && c.strong ? `: ${c.label}` : '');
          nav.push({ g, activate: () => onCell(s, f), label });
        }
      }
    }
    container.replaceChildren(svg);
    if (nav.length) rovingFocus(container, svg, nav, frets + 1);
  }

  /* ---------- Diagram chwytu ---------- */

  /** voicing: { frets[6] }, roleAt(s) → role, labelAt(s) → string */
  function renderChordDiagram(voicing, roleAt, labelAt) {
    const frets = voicing.frets;
    const fretted = frets.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const minF = fretted.length ? Math.min(...fretted) : 1;
    const base = maxF <= 4 ? 1 : minF;
    const N = voicing.frets.length, L = N - 1;
    const x0 = 32, dx = 16, y0 = 26, dy = 20, rows = 4;
    const svg = el('svg', { viewBox: `0 0 ${x0 + dx * L + 16} ${y0 + dy * rows + 26}`, class: 'diagram' });

    for (let s = 0; s < N; s++) el('line', { x1: x0 + s * dx, x2: x0 + s * dx, y1: y0, y2: y0 + dy * rows, class: 'dg-line' }, svg);
    for (let r = 0; r <= rows; r++) {
      el('line', { x1: x0, x2: x0 + dx * L, y1: y0 + r * dy, y2: y0 + r * dy, class: r === 0 && base === 1 ? 'dg-nut' : 'dg-line' }, svg);
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
    const t = text(svg, x0 + dx * L / 2, y0 + dy * rows + 16, marks.join(wide ? ' ' : ''), 'dg-tab');
    if (wide) { t.setAttribute('textLength', dx * L + 16); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    return svg;
  }

  /* ---------- Pięciolinia (system fortepianowy) ---------- */

  const ACC_GLYPH = { '-2': '𝄫', '-1': '♭', '1': '♯', '2': '𝄪' };

  /**
   * notes: [{ midi, note: {letter, acc}, role, name }]
   * Rysuje akord nutami całymi na systemie wiolinowo-basowym, bez znaków
   * przykluczowych (znaki chromatyczne stoją przy nutach).
   */
  function renderStaff(container, notes, opts = {}) {
    const sp = 5; // pół odstępu między liniami
    const GAP = 30; // dodatkowy odstęp między pięciolinią wiolinową a basową
    const pos = notes.map((n) => {
      const natural = n.midi - n.note.acc;
      const octave = Math.floor(natural / 12) - 1;
      return { ...n, step: octave * 7 + n.note.letter, staff: n.midi >= 60 ? 'T' : 'B' };
    }).sort((a, b) => a.midi - b.midi || a.step - b.step);
    const top = Math.max(42, ...pos.filter((p) => p.staff === 'T').map((p) => p.step + 3));
    const bottom = Math.min(14, ...pos.filter((p) => p.staff === 'B').map((p) => p.step - 3));
    const W = opts.width || 230, x0 = opts.noteX || 132, left = 8;
    const y = (s, staff) => 8 + (top - s) * sp + (staff === 'B' ? GAP : 0);
    const H = y(bottom, 'B') + 8;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'staff', role: 'img', 'aria-label': 'Zapis nutowy akordu' });

    for (const s of [30, 32, 34, 36, 38]) el('line', { x1: left, x2: W - 6, y1: y(s, 'T'), y2: y(s, 'T'), class: 'st-line' }, svg);
    for (const s of [18, 20, 22, 24, 26]) el('line', { x1: left, x2: W - 6, y1: y(s, 'B'), y2: y(s, 'B'), class: 'st-line' }, svg);
    el('line', { x1: left, x2: left, y1: y(38, 'T'), y2: y(18, 'B'), class: 'st-line' }, svg);
    el('line', { x1: W - 6, x2: W - 6, y1: y(38, 'T'), y2: y(18, 'B'), class: 'st-line' }, svg);
    const clefG = el('text', { x: left + 5, y: y(32, 'T') + 9, class: 'st-clef g' }, svg); clefG.textContent = '𝄞';
    const clefF = el('text', { x: left + 5, y: y(24, 'B') + 8, class: 'st-clef f' }, svg); clefF.textContent = '𝄢';

    // Sekundy w obrębie jednej pięciolinii: wyższa nuta przesunięta w prawo.
    let prev = null;
    for (const p of pos) {
      p.dx = prev && prev.staff === p.staff && p.step - prev.step === 1 && !prev.dx ? 12 : 0;
      prev = p;
    }
    // Linie dodane.
    for (const p of pos) {
      const ledgers = [];
      if (p.staff === 'T') {
        for (let l = 40; l <= p.step; l += 2) ledgers.push(l);
        for (let l = 28; l >= p.step; l -= 2) ledgers.push(l);
      } else {
        for (let l = 28; l <= p.step; l += 2) ledgers.push(l);
        for (let l = 16; l >= p.step; l -= 2) ledgers.push(l);
      }
      for (const l of ledgers) {
        el('line', { x1: x0 - 10 + p.dx, x2: x0 + 10 + p.dx, y1: y(l, p.staff), y2: y(l, p.staff), class: 'st-line ledger' }, svg);
      }
    }
    // Znaki chromatyczne: kolumny od góry, w kolumnie min. 28 px odstępu.
    const cols = [];
    for (const p of [...pos].reverse()) {
      if (!p.note.acc) continue;
      const py = y(p.step, p.staff);
      let c = 0;
      while (cols[c] && cols[c].some((v) => Math.abs(v - py) < 28)) c++;
      (cols[c] = cols[c] || []).push(py);
      const t = el('text', { x: x0 - 17 - c * 12, y: py, class: 'st-acc role-' + p.role, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg);
      t.textContent = ACC_GLYPH[p.note.acc] || '';
    }
    for (const p of pos) {
      const cx = x0 + p.dx, cy = y(p.step, p.staff);
      el('ellipse', { cx, cy, rx: 6.4, ry: 4.4, transform: `rotate(-22 ${cx} ${cy})`, class: 'st-head role-' + p.role }, svg);
      if (p.name) {
        const t = el('text', { x: x0 + 30, y: cy, class: 'st-name role-' + p.role, 'dominant-baseline': 'central' }, svg);
        t.textContent = p.name;
      }
    }
    // Nazwy przy nutach mogą na siebie nachodzić przy sekundach — rozsuń je pionowo.
    const labels = [...svg.querySelectorAll('.st-name')];
    for (let i = labels.length - 2; i >= 0; i--) {
      const a = +labels[i].getAttribute('y'), b = +labels[i + 1].getAttribute('y');
      if (a - b < 10) labels[i].setAttribute('y', b + 10);
    }
    container.replaceChildren(svg);
  }

  /* ---------- Pięciolinia: jeden system, nuty w rzędzie ---------- */

  // Pozycje znaków przykluczowych w kluczu wiolinowym (kolejność F C G D A E B / B E A D G C F).
  const SIG_STEPS = { sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] };

  /**
   * columns: [[{ midi, note, role?, label? }], …] — każda kolumna to nuta lub współbrzmienie.
   * opts: { clef: 'treble' | 'bass' | 'auto', keySig (Theory.keySignature), gap, activeCol,
   *         onColumn(i), labels: [tekst pod kolumną], lyrics: [sylaba pod kolumną], ariaLabel, minWidth,
   *         durations: [{ units (szesnastki; 16 = cała), rest, glyph (znak pauzy) }] — rytm: główki,
   *         laseczki, chorągiewki, kropki i pauzy; barAfter: Set indeksów kolumn z kreską taktową po nich }
   * Znaki chromatyczne stawiane tylko tam, gdzie dźwięk różni się od obowiązującego
   * (znaki przykluczowe + wcześniejsze znaki w takcie).
   */
  function renderMelody(container, columns, opts = {}) {
    const all = columns.flat();
    const clef = opts.clef && opts.clef !== 'auto' ? opts.clef
      : (all.length && all.reduce((s, n) => s + n.midi, 0) / all.length < 57 ? 'bass' : 'treble');
    // Linie basowe: G2–A3 (12 stopni niżej niż E4–F5); znaki przykluczowe: o 2 oktawy (14) niżej.
    const lines = clef === 'bass' ? [18, 20, 22, 24, 26] : [30, 32, 34, 36, 38];
    const sigShift = clef === 'bass' ? -14 : 0;
    const steps = all.map((n) => global.Theory.staffStep(n.note, n.midi));
    const sp = 5;
    const top = Math.max(lines[4] + 4, ...steps.map((s) => s + 3));
    const bottom = Math.min(lines[0] - 4, ...steps.map((s) => s - 3));
    const pad = 4;
    const y = (s) => pad + (top - s) * sp;
    const hasLabels = opts.labels && opts.labels.some(Boolean);
    const hasLyrics = opts.lyrics && opts.lyrics.some(Boolean);
    const lyY = y(bottom) + (hasLabels ? 22 : 6) + 10;
    const H = y(bottom) + (hasLabels ? 22 : 6) + (hasLyrics ? 20 : 0);
    const sig = opts.keySig;
    const sigNotes = sig && sig.count <= 7 ? sig.notes : [];
    const gap = opts.gap || 38;
    const left = 6, clefW = 34, sigW = sigNotes.length * 9;
    const x0 = left + clefW + sigW + 22;
    const W = Math.max(opts.minWidth || 0, x0 + columns.length * gap);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W * (opts.scale || 1.15), class: 'staff melody', role: 'img', 'aria-label': opts.ariaLabel || 'Zapis nutowy' });

    for (const s of lines) el('line', { x1: left, x2: W - 2, y1: y(s), y2: y(s), class: 'st-line' }, svg);
    el('line', { x1: left, x2: left, y1: y(lines[4]), y2: y(lines[0]), class: 'st-line' }, svg);
    if (clef === 'treble') {
      const c = el('text', { x: left + 4, y: y(32) + 9, class: 'st-clef g' }, svg); c.textContent = '𝄞';
    } else {
      const c = el('text', { x: left + 4, y: y(24) + 8, class: 'st-clef f' }, svg); c.textContent = '𝄢';
    }
    sigNotes.forEach((n, i) => {
      const s = SIG_STEPS[n.acc > 0 ? 'sharp' : 'flat'][i] + sigShift;
      text(svg, left + clefW + 4 + i * 9, y(s) + (n.acc < 0 ? -2 : 0), ACC_GLYPH[n.acc], 'st-acc sig');
    });

    const current = new Map(); // stopień pięciolinii → obowiązujący znak
    const accAt = (step, letter) => (current.has(step) ? current.get(step) : sig ? sig.accOf(letter) : 0);
    columns.forEach((col, ci) => {
      const cx = x0 + ci * gap;
      const g = el('g', { class: 'st-col' + (opts.activeCol === ci ? ' active' : '') + (opts.onColumn ? ' clickable' : '') }, svg);
      if (opts.onColumn) {
        el('rect', { x: cx - gap / 2, y: 0, width: gap, height: H, class: 'st-hit' }, g);
        g.addEventListener('click', () => opts.onColumn(ci));
      }
      const pos = col.map((n) => ({ ...n, step: global.Theory.staffStep(n.note, n.midi) })).sort((a, b) => a.step - b.step);
      let prev = null;
      for (const p of pos) {
        p.dx = prev && p.step - prev.step === 1 && !prev.dx ? 11 : 0;
        prev = p;
        for (let l = lines[4] + 2; l <= p.step; l += 2) el('line', { x1: cx - 10 + p.dx, x2: cx + 10 + p.dx, y1: y(l), y2: y(l), class: 'st-line ledger' }, g);
        for (let l = lines[0] - 2; l >= p.step; l -= 2) el('line', { x1: cx - 10 + p.dx, x2: cx + 10 + p.dx, y1: y(l), y2: y(l), class: 'st-line ledger' }, g);
      }
      let accCol = 0;
      for (const p of [...pos].reverse()) {
        const want = p.note.acc;
        if (accAt(p.step, p.note.letter) !== want) {
          const glyph = want === 0 ? '♮' : ACC_GLYPH[want];
          text(g, cx - 15 - accCol * 11, y(p.step), glyph, 'st-acc role-' + (p.role || 'none'));
          accCol = accCol ? 0 : 1;
        }
        current.set(p.step, want);
      }
      const dur = opts.durations && opts.durations[ci];
      // Wartość bez kropki: 12 → 8 (półnuta), 6 → 4, 3 → 2.
      const dotted = dur && [12, 6, 3].includes(dur.units);
      const base = dur ? (dotted ? dur.units / 1.5 : dur.units) : 16;
      for (const p of pos) {
        const hx = cx + p.dx, hy = y(p.step);
        el('ellipse', { cx: hx, cy: hy, rx: 6.4, ry: 4.4, transform: `rotate(-22 ${hx} ${hy})`, class: 'st-head role-' + (p.role || 'none') + (dur && base <= 4 ? ' filled' : '') }, g);
        if (dotted) el('circle', { cx: hx + 11, cy: hy - (p.step % 2 === lines[0] % 2 ? 2.5 : 0), r: 1.7, class: 'st-dot' }, g);
      }
      if (dur && dur.rest) {
        text(g, cx, y(lines[2]), dur.glyph + (dotted ? '.' : ''), 'st-rest');
      } else if (dur && pos.length && base < 16) {
        // Laseczka: w górę, gdy nuty leżą poniżej środkowej linii; chorągiewki dla ósemek i szesnastek.
        const lo = pos[0].step, hi = pos[pos.length - 1].step;
        const up = (lo + hi) / 2 < lines[2];
        const sx = up ? cx + 5.8 : cx - 5.8;
        const y1 = up ? y(lo) : y(hi), y2 = up ? y(hi) - 32 : y(lo) + 32;
        el('line', { x1: sx, x2: sx, y1, y2, class: 'st-stem' }, g);
        const flags = base === 2 ? 1 : base === 1 ? 2 : 0;
        for (let f = 0; f < flags; f++) {
          const fy = y2 + (up ? f * 6 : -f * 6);
          el('path', { d: up ? `M${sx} ${fy} q 2 6 8 10` : `M${sx} ${fy} q 2 -6 8 -10`, class: 'st-flag' }, g);
        }
      }
      if (opts.barAfter && opts.barAfter.has(ci)) el('line', { x1: cx + gap / 2, x2: cx + gap / 2, y1: y(lines[4]), y2: y(lines[0]), class: 'st-line st-bar' }, g);
      if (hasLabels && opts.labels[ci]) text(g, cx, y(bottom) + 13, opts.labels[ci], 'st-label');
      if (hasLyrics && opts.lyrics[ci]) text(g, cx, lyY, opts.lyrics[ci], 'st-lyric', { translate: 'no' });
    });
    container.replaceChildren(svg);
    return svg;
  }

  /* ---------- Koło kwintowe ---------- */

  function arcPath(cx, cy, r1, r2, a0, a1) {
    const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x1, y1] = p(r2, a0), [x2, y2] = p(r2, a1), [x3, y3] = p(r1, a1), [x4, y4] = p(r1, a0);
    return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
  }

  /**
   * opts: { majors[12], minors[12]: {label, sub, cls, title}, center: [line, …],
   *         onMajor(i), onMinor(i), dimAt: index | null, dimLabel }
   * Pozycja 0 = C (u góry), dalej zgodnie z ruchem wskazówek zegara co kwintę.
   */
  function renderCircle(container, opts) {
    const S = 400, c = S / 2;
    const R = [56, 112, 158, 196]; // środek | moll | dur | znaki
    const svg = el('svg', { viewBox: `0 0 ${S} ${S}`, class: 'circle', role: 'img', 'aria-label': 'Koło kwintowe' });
    const step = (Math.PI * 2) / 12;
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI / 2 + (i - 0.5) * step, a1 = a0 + step, am = (a0 + a1) / 2;
      const pos = (r) => [c + r * Math.cos(am), c + r * Math.sin(am)];

      const M = opts.majors[i];
      const gM = el('g', { class: 'cof-seg major ' + (M.cls || '') }, svg);
      el('title', {}, gM).textContent = M.title;
      el('path', { d: arcPath(c, c, R[2] - 0, R[3], a0, a1) }, gM);
      const [mx, my] = pos((R[2] + R[3]) / 2);
      text(gM, mx, my - 6, M.label, 'cof-label' + (M.label.length > 3 ? ' small' : ''));
      text(gM, mx, my + 11, M.sub, 'cof-sub');
      gM.addEventListener('click', () => opts.onMajor(i));

      const m = opts.minors[i];
      const gm = el('g', { class: 'cof-seg minor ' + (m.cls || '') }, svg);
      el('title', {}, gm).textContent = m.title;
      el('path', { d: arcPath(c, c, R[1], R[2], a0, a1) }, gm);
      const [nx, ny] = pos((R[1] + R[2]) / 2);
      text(gm, nx, ny, m.label, 'cof-label minor' + (m.label.length > 3 ? ' small' : ''));
      gm.addEventListener('click', () => opts.onMinor(i));

      if (opts.dimAt === i) {
        const [dx, dy] = pos((R[0] + R[1]) / 2 + 4);
        el('circle', { cx: dx, cy: dy, r: 15, class: 'cof-dim' }, svg);
        text(svg, dx, dy, opts.dimLabel, 'cof-dim-label');
      }
    }
    el('circle', { cx: c, cy: c, r: R[0], class: 'cof-center' }, svg);
    opts.center.forEach((line, k) => {
      text(svg, c, c + (k - (opts.center.length - 1) / 2) * 17, line, k === 0 ? 'cof-c1' : 'cof-c2');
    });
    container.replaceChildren(svg);
  }

  global.Instruments = { renderPiano, renderFretboard, renderChordDiagram, renderCircle, renderStaff, renderMelody };
})(window);
