/*
 * ChordBuilder — dział „Rytm”: wartości, kropka, metrum z metronomem, układanie taktu.
 */
(function () {
  'use strict';
  const R = window.Rhythm;
  const { h } = window.Common;
  const $ = (id) => document.getElementById(id);
  const st = { bpm: 80, meter: '4/4', kind: 'note', bar: [], stop: null, metro: null };
  const M = () => R.meterById(st.meter);
  const stopAll = () => { if (st.stop) st.stop(); st.stop = null; };

  function play(elems, meter = R.meterById('4/4')) {
    stopAll();
    st.stop = R.playRhythm(elems, meter, st.bpm, { countIn: true });
  }

  function renderValues() {
    $('tree').replaceChildren(...R.VALUES.map((v) => {
      const n = 16 / v.units;
      const els = Array.from({ length: n }, () => ({ v: v.id }));
      return h('button', { type: 'button', class: 'rh-row', title: 'Posłuchaj', onclick: () => play(els) },
        h('span', { class: 'rh-label' }, `${n} × ${v.name}`),
        h('span', { class: 'rh-glyphs' }, els.map(() => h('span', { class: 'rh-g', style: `flex:1` }, v.note))));
    }));
    $('values').replaceChildren(...R.VALUES.map((v) => h('tr', {},
      h('td', { class: 'rh-g big' }, v.note), h('td', { class: 'rh-g big' }, v.rest),
      h('td', {}, v.name), h('td', { class: 'mono' }, String(v.units / 4).replace('.', ',')),
      h('td', {}, v.units === 16 ? 'cały takt' : `${16 / v.units} w takcie`))));
    const ex = [
      ['Dwie ćwierćnuty', [{ v: 'q' }, { v: 'q' }, { v: 'h' }]],
      ['Ćwierćnuta z kropką + ósemka', [{ v: 'q.' }, { v: 'e' }, { v: 'h' }]],
      ['Półnuta z kropką + ćwierćnuta', [{ v: 'h.' }, { v: 'q' }]],
      ['Ósemka z kropką + szesnastka (×2)', [{ v: 'e.' }, { v: 's' }, { v: 'e.' }, { v: 's' }, { v: 'h' }]],
    ];
    $('dots').replaceChildren(...ex.map(([label, els]) => h('button', { type: 'button', class: 'rh-row', onclick: () => play(els) },
      h('span', { class: 'rh-label' }, label), h('span', { class: 'rh-glyphs' }, els.map((e) => h('span', { class: 'rh-g' }, R.glyph(e)))))));
  }

  function renderMeter() {
    const m = M();
    $('meter').replaceChildren(...R.METERS.map((x) => new Option(`${x.id} (${x.kind})`, x.id, false, x.id === st.meter)));
    const [a, b] = m.id.split('/');
    $('meter-sig').replaceChildren(h('span', {}, a), h('span', {}, b));
    $('meter-desc').textContent = `Metrum ${m.kind}. ${m.desc}`;
    $('beats').replaceChildren(...m.accents.map((acc, i) => h('span', { class: 'rh-beat a' + acc, 'data-i': i })));
    $('metro').textContent = st.metro ? '■ Zatrzymaj' : '▶ Metronom';
  }

  function toggleMetro() {
    if (st.metro) { clearInterval(st.metro); st.metro = null; renderMeter(); return; }
    const m = M();
    const beatMs = (60 / st.bpm) * (m.unit / 4) * 1000; // tempo w ćwierćnutach
    let i = 0;
    const tick = () => {
      const acc = m.accents[i % m.beats];
      Sound.play([acc === 2 ? 96 : acc === 1 ? 91 : 89], 'chord', 'piano', 0.08);
      for (const b of document.querySelectorAll('.rh-beat')) b.classList.toggle('on', +b.dataset.i === i % m.beats);
      i++;
    };
    tick();
    st.metro = setInterval(tick, beatMs);
    renderMeter();
  }

  function renderBar() {
    const m = M();
    const need = R.barUnits(m);
    const used = st.bar.reduce((s, e) => s + R.units(e), 0);
    const opts = [...R.VALUES.map((v) => v.id), ...R.DOTTED.map((d) => d.id)];
    $('palette').replaceChildren(...opts.map((v) => {
      const el = { v, rest: st.kind === 'rest' };
      return h('button', { type: 'button', class: 'quiz-answer rh-pal', disabled: used + R.units(el) > need, title: R.valueName(el),
        onclick: () => { st.bar.push(el); renderBar(); } }, h('span', { class: 'rh-g big' }, R.glyph(el)), h('small', {}, R.valueName(el)));
    }));
    $('bar').replaceChildren(h('span', { class: 'rh-sig small' }, h('span', {}, m.id.split('/')[0]), h('span', {}, m.id.split('/')[1])),
      ...st.bar.map((e) => h('span', { class: 'rh-g big' }, R.glyph(e))), h('span', { class: 'rh-barline' }, '|'));
    $('fill').style.width = Math.min(100, (100 * used) / need) + '%';
    const left = need - used;
    $('bar-msg').textContent = left === 0 ? '✓ Takt pełny!' : `Brakuje jeszcze ${left} ${left === 1 ? 'szesnastki' : 'szesnastek'} (= ${String(left / 4).replace('.', ',')} ${window.Common.plural(left / 4, 'ćwierćnuta', 'ćwierćnuty', 'ćwierćnut')}).`;
  }

  function bind() {
    $('bpm').value = st.bpm; $('bpm-val').textContent = st.bpm;
    $('bpm').addEventListener('input', (e) => { st.bpm = +e.target.value; $('bpm-val').textContent = st.bpm; if (st.metro) { toggleMetro(); toggleMetro(); } });
    $('meter').addEventListener('change', (e) => { st.meter = e.target.value; st.bar = []; if (st.metro) toggleMetro(); renderMeter(); renderBar(); });
    $('metro').addEventListener('click', toggleMetro);
    window.Common.seg($('kind'), st.kind, (v) => { st.kind = v; renderBar(); });
    $('bar-play').addEventListener('click', () => play(st.bar, M()));
    $('bar-undo').addEventListener('click', () => { st.bar.pop(); renderBar(); });
    $('bar-clear').addEventListener('click', () => { st.bar = []; renderBar(); });
    $('bar-random').addEventListener('click', () => {
      st.bar = R.randomBar(M(), ['h', 'q', 'e', 'q.', 'h.'], 0.15);
      renderBar(); play(st.bar, M());
    });
  }

  bind();
  renderValues();
  renderMeter();
  renderBar();
  window.Common.registerSW();
})();
