/*
 * ChordBuilder — ściąga do druku: wszystkie akordy wybranej tonacji/skali.
 * Parametry w adresie: #t=<tonika>&s=<skala>&nt=<intl|H>&tu=<strój>
 */
(function () {
  'use strict';
  const T = window.Theory;
  const I = window.Instruments;
  const $ = (id) => document.getElementById(id);

  const p = new URLSearchParams(location.hash.slice(1));
  const isNote = (v) => /^[A-G](#{1,2}|b{1,2})?$/.test(v || '');
  const tonic = T.parseNote(isNote(p.get('t')) ? p.get('t') : 'C');
  const scaleId = T.SCALES.some((s) => s.id === p.get('s')) ? p.get('s') : 'major';
  const notation = p.get('nt') === 'H' ? 'H' : 'intl';
  const tuning = T.tuningById(p.get('tu') || 'standard');
  const nn = (n) => T.noteName(n, notation);

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v; else e.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) e.append(c);
    return e;
  }

  const sc = T.buildScale(tonic, scaleId);
  const scaleName = `${nn(tonic)} ${sc.scale.name.toLowerCase()}`;
  document.title = `Ściąga: ${scaleName} — ChordBuilder`;
  $('sheet-title').textContent = `Akordy: ${scaleName}`;
  $('sheet-sub').textContent = sc.notes.length === 7
    ? 'Akordy diatoniczne — budowane co tercję z dźwięków skali.'
    : 'Akordy zbudowane wyłącznie z dźwięków skali.';
  $('back').href = './#t=' + encodeURIComponent(T.noteKey(tonic)) + '&s=' + scaleId;
  $('sheet-url').textContent = location.href.split('#')[0].replace(/sheet\.html$/, '');

  $('sheet-scale').replaceChildren(...sc.notes.flatMap((sn, i) => {
    const info = T.describeInterval(sn.iv.deg, sn.iv.semi);
    const next = i + 1 < sc.notes.length ? sc.notes[i + 1].iv.semi : 12;
    return [
      h('span', { class: 'ss-note' }, h('small', {}, info.symbol), h('b', {}, nn(sn.note))),
      h('span', { class: 'ss-gap' }, '+' + (next - sn.iv.semi)),
    ];
  }), h('span', { class: 'ss-note' }, h('small', {}, '8'), h('b', {}, nn(tonic))));

  function chordCard(chord, roman) {
    const card = h('article', { class: 'sheet-card' });
    card.append(h('div', { class: 'sc-head' },
      roman ? h('span', { class: 'sc-roman' }, roman) : null,
      h('span', { class: 'sc-sym' }, T.chordSymbol(chord, notation)),
      h('span', { class: 'sc-name' }, chord.type.name)));
    card.append(h('div', { class: 'sc-notes' }, chord.notes.map((n) =>
      h('span', { class: 'pill role-' + n.role }, nn(n.note), h('small', {}, n.info.symbol)))));
    card.append(h('div', { class: 'sc-formula' },
      h('span', {}, 'półtony: ', h('code', {}, chord.notes.map((n) => n.iv.semi).join('–'))),
      h('span', {}, 'tercje: ', h('code', {}, stackText(chord)))));

    const media = h('div', { class: 'sc-media' });
    const voiced = T.inversion(chord, 0);
    const midis = voiced.map((n) => 48 + chord.root.pc + n.semiAbs);

    const piano = h('div', { class: 'sc-piano opt-piano' });
    const hl = new Map(midis.map((m, i) => [m, { label: nn(voiced[i].note), role: voiced[i].role }]));
    I.renderPiano(piano, { startMidi: 48, octaves: Math.max(2, Math.ceil((Math.max(...midis) - 47) / 12)), highlights: hl, scalePcs: sc.pcs });

    const staff = h('div', { class: 'sc-staff opt-staff' });
    I.renderStaff(staff, voiced.map((n, i) => ({ midi: midis[i], note: n.note, role: n.role, name: nn(n.note) })), { width: 200, noteX: 112 });

    const guitar = h('div', { class: 'sc-guitar opt-guitar' });
    const v = T.findVoicings(chord, chord.root.pc, tuning)[0];
    if (v) {
      const byPc = new Map(chord.notes.map((n) => [n.note.pc, n]));
      const at = (s) => byPc.get(T.mod(tuning.midi[s] + v.frets[s], 12));
      guitar.append(I.renderChordDiagram(v, (s) => (at(s) ? at(s).role : 'ext'),
        (s) => (at(s) ? nn(at(s).note).replace('♯', '#').replace('♭', 'b') : '')));
    } else {
      guitar.append(h('p', { class: 'muted small' }, 'brak wygodnego chwytu'));
    }

    media.append(staff, guitar);
    card.append(media, piano);
    return card;
  }

  function stackText(chord) {
    const sorted = [...chord.notes].sort((a, b) => a.iv.semi - b.iv.semi);
    const parts = [];
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i].iv.semi - sorted[i - 1].iv.semi;
      parts.push(d === 3 ? 'm3' : d === 4 ? 'M3' : d + ' pt');
    }
    return parts.join(' + ');
  }

  function section(title, cards, cls) {
    return h('section', { class: 'sheet-section ' + cls }, h('h2', {}, title), h('div', { class: 'sheet-grid' }, cards));
  }

  const body = $('sheet-body');
  if (sc.notes.length === 7) {
    body.append(
      section('Trójdźwięki', T.diatonicChords(sc, 3).map((d) => chordCard(d.chord, d.roman)), 'opt-triads'),
      section('Akordy septymowe', T.diatonicChords(sc, 4).map((d) => chordCard(d.chord, d.roman)), 'opt-sevenths'));
  } else {
    const cards = [];
    for (const row of T.fittingChords(sc)) {
      for (const c of row.chords.filter((c) => c.type.id !== '5').slice(0, 2)) cards.push(chordCard(c, null));
    }
    body.append(section('Akordy z dźwięków skali', cards, 'opt-triads'));
    $('opt-sevenths').closest('label').hidden = true;
  }

  for (const id of ['triads', 'sevenths', 'piano', 'guitar', 'staff']) {
    const box = $('opt-' + id);
    const apply = () => document.body.classList.toggle('hide-' + id, !box.checked);
    box.addEventListener('change', apply);
    apply();
  }
  $('print').addEventListener('click', () => window.print());

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
