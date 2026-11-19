/*
 * ChordBuilder — karta ćwiczeń do druku (z kluczem odpowiedzi).
 * Korzysta z generatorów pytań z quiz.js. Ustawienia w adresie:
 * #t=read-note,key-sig&lv=1&n=8&mc=0&key=1&nt=intl&title=…
 */
(function () {
  'use strict';
  const { h } = window.Common;
  const $ = (id) => document.getElementById(id);
  const EX = window.QuizExercises;

  const TYPES = [
    ['read-note', 'Podpisz nuty (nazwą literową).'],
    ['key-sig', 'Podaj tonację wyznaczoną przez znaki przykluczowe.'],
    ['name-interval', 'Nazwij interwały (np. 3w — tercja wielka, 5cz — kwinta czysta).'],
    ['chord-name', 'Podaj symbol akordu zapisanego na pięciolinii.'],
    ['build-chord', 'Wypisz dźwięki akordów — z poprawną pisownią (akord buduje się co tercję).'],
    ['diatonic', 'Podaj akord leżący na wskazanym stopniu tonacji.'],
    ['key-relations', 'Podaj tonację pokrewną (równoległą, jednoimienną, sąsiednią na kole kwintowym).'],
    ['name-scale', 'Nazwij skale zapisane na pięciolinii.'],
    ['rhythm-values', 'Odpowiedz, ile krótszych wartości mieści się w dłuższej.'],
    ['rhythm-meter', 'Wpisz metrum taktu (policz wartości).'],
  ];
  const exById = (id) => EX.find((e) => e.id === id);

  const prefs = window.Common.loadPrefs();
  const st = {
    types: ['read-note', 'name-interval', 'build-chord'], level: 0, count: 6, mc: false, key: true,
    notation: prefs.notation === 'H' ? 'H' : 'intl', title: 'Karta ćwiczeń z teorii muzyki',
  };

  function loadHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('t')) st.types = p.get('t').split(',').filter((t) => TYPES.some(([id]) => id === t));
    if (p.has('lv')) st.level = Math.max(0, Math.min(2, +p.get('lv') || 0));
    if (p.has('n')) st.count = [4, 6, 8, 12, 16].includes(+p.get('n')) ? +p.get('n') : 6;
    if (p.has('mc')) st.mc = p.get('mc') === '1';
    if (p.has('key')) st.key = p.get('key') !== '0';
    if (p.get('nt')) st.notation = p.get('nt') === 'H' ? 'H' : 'intl';
    if (p.get('title')) st.title = p.get('title').slice(0, 120);
  }
  function saveHash() {
    history.replaceState(null, '', '#' + new URLSearchParams({
      t: st.types.join(','), lv: st.level, n: st.count, mc: st.mc ? 1 : 0, key: st.key ? 1 : 0, nt: st.notation, title: st.title,
    }));
  }

  function settings() {
    $('ws-types').replaceChildren(...TYPES.map(([id]) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: st.types.includes(id), onchange: (e) => {
        st.types = TYPES.map(([t]) => t).filter((t) => (t === id ? e.target.checked : st.types.includes(t)));
        build();
      } }), ' ' + exById(id).title)));
    $('ws-level').value = String(st.level);
    $('ws-count').value = String(st.count);
    $('ws-notation').value = st.notation;
    $('ws-title').value = st.title;
    $('ws-mc').checked = st.mc;
    $('ws-key').checked = st.key;
  }

  const answerText = (q) => q.correctLabel || (q.answers.find((a) => a.key === q.correct) || {}).label || '';

  function build() {
    window.QuizSetNotation(st.notation);
    saveHash();
    $('ws-h1').textContent = st.title;
    document.title = st.title + ' — ChordBuilder';
    const body = $('ws-body');
    const key = [];
    let num = 0;
    body.replaceChildren(...st.types.map((id) => {
      const ex = exById(id);
      const instr = TYPES.find(([t]) => t === id)[1];
      const seen = new Set();
      const items = [];
      for (let i = 0; i < st.count; i++) {
        let q;
        for (let tries = 0; tries < 30; tries++) {
          q = ex.make(st.level, { clef: 'mix' });
          const sig = q.item + '|' + answerText(q) + '|' + (typeof q.prompt === 'string' ? q.prompt : q.prompt.textContent);
          if (!seen.has(sig)) { seen.add(sig); break; }
        }
        num++;
        key.push([num, answerText(q)]);
        const card = h('div', { class: 'ws-item' + (q.show ? '' : ' text') }, h('span', { class: 'ws-num' }, num + '.'));
        if (q.show) {
          const media = h('div', { class: 'ws-media' });
          q.show(media);
          for (const p of media.querySelectorAll('p')) p.remove();
          card.append(media);
        } else {
          const p = typeof q.prompt === 'string' ? h('span', {}, q.prompt) : q.prompt.cloneNode(true);
          card.append(h('div', { class: 'ws-prompt' }, p));
        }
        if (st.mc && q.answers.length) {
          card.append(h('div', { class: 'ws-choices' }, q.answers.map((a) => h('span', {}, '☐ ' + a.label))));
        } else {
          card.append(h('div', { class: 'ws-line' }));
        }
        items.push(card);
      }
      return h('section', { class: 'ws-section' },
        h('h2', {}, ex.title), h('p', { class: 'muted ws-instr' }, instr + (id === 'key-sig' && st.level > 0 ? ' Nuta po znakach to tonika (dur lub moll).' : '')),
        h('div', { class: 'ws-grid ws-' + id }, items));
    }));
    $('ws-total').textContent = String(num);
    const ans = $('ws-answers');
    ans.hidden = !st.key || !num;
    ans.replaceChildren(h('h2', {}, 'Klucz odpowiedzi — ' + st.title),
      h('ol', { class: 'ws-key' }, key.map(([n, a]) => h('li', { value: n }, a))));
    $('ws-url').textContent = location.href.split('#')[0].replace(/worksheet\.html$/, '');
  }

  loadHash();
  settings();
  build();
  $('ws-level').addEventListener('change', (e) => { st.level = +e.target.value; build(); });
  $('ws-count').addEventListener('change', (e) => { st.count = +e.target.value; build(); });
  $('ws-notation').addEventListener('change', (e) => { st.notation = e.target.value; build(); });
  $('ws-title').addEventListener('input', (e) => { st.title = e.target.value || 'Karta ćwiczeń'; $('ws-h1').textContent = st.title; saveHash(); });
  $('ws-mc').addEventListener('change', (e) => { st.mc = e.target.checked; build(); });
  $('ws-key').addEventListener('change', (e) => { st.key = e.target.checked; build(); });
  $('ws-new').addEventListener('click', build);
  $('print').addEventListener('click', () => window.print());
  window.Common.registerSW();
})();
