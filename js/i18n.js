/*
 * ChordBuilder — wersja angielska.
 * Język: localStorage chordbuilder.prefs.lang ('pl' | 'en') lub ?lang=en w adresie.
 * Dla 'en':
 *  1) teoria (nazwy interwałów, stopni, opisy brzmień) — Theory.setLang('en') + podmiana danych po id;
 *  2) interfejs — tłumaczenie DOM na żywo: całe bloki statycznego HTML (słownik I18N_EN.blocks),
 *     pojedyncze teksty (I18N_EN.text, także szablony z {0}), na końcu frazy wewnątrz tekstu.
 * Ładowany zaraz po theory.js; słownik (i18n-en.js) — zaraz po nim.
 */
(function (global) {
  'use strict';
  const PREFS = 'chordbuilder.prefs';
  let lang = 'pl';
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || '{}') || {};
    lang = p.lang === 'en' ? 'en' : 'pl';
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'pl') { lang = q; p.lang = q; localStorage.setItem(PREFS, JSON.stringify(p)); }
  } catch (e) { /* brak localStorage */ }

  function setLang(l) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) || '{}') || {};
      p.lang = l;
      localStorage.setItem(PREFS, JSON.stringify(p));
    } catch (e) { /* ignoruj */ }
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.replace(u.toString());
  }

  const I18N = { lang, setLang, t: (s) => s, patchRhythm: () => {}, applyData: () => {} };
  global.I18N = I18N;

  /** Przełącznik PL/EN w nagłówku (na każdej stronie). */
  function addSwitch() {
    const host = document.querySelector('.site-header .settings') || document.querySelector('.site-header .header-inner');
    if (!host || document.getElementById('lang-switch')) return;
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.innerHTML = `<span>${lang === 'en' ? 'Language' : 'Język'}</span><div class="seg" id="lang-switch" role="radiogroup" aria-label="Język / Language">` +
      `<button type="button" data-value="pl" class="${lang === 'pl' ? 'on' : ''}">PL</button><button type="button" data-value="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (b && b.dataset.value !== lang) setLang(b.dataset.value);
    });
    host.prepend(wrap);
  }
  document.addEventListener('DOMContentLoaded', addSwitch);
  if (lang !== 'en') return;

  document.documentElement.lang = 'en';
  if (global.Theory) global.Theory.setLang('en');

  const D = () => global.I18N_EN || { text: {}, blocks: {}, data: {} };

  /* ---------- Dane teorii po id ---------- */
  function patchData() {
    const T = global.Theory, d = D().data || {};
    if (!T) return;
    for (const s of T.SCALES) if (d.scales && d.scales[s.id]) { s.name = d.scales[s.id][0]; s.mood = d.scales[s.id][1]; }
    for (const c of T.CHORD_TYPES) if (d.chords && d.chords[c.id]) c.name = d.chords[c.id];
    for (const g of T.CHORD_GROUPS) if (d.groups && d.groups[g.id]) g.name = d.groups[g.id];
    for (const p of T.PROGRESSIONS) if (d.progs && d.progs[p.id]) { [p.name, p.desc] = d.progs[p.id]; p.group = (d.progGroups || {})[p.group] || p.group; }
    for (const t of T.TUNINGS) if (d.tunings && d.tunings[t.id]) t.name = d.tunings[t.id];
  }
  I18N.patchRhythm = (R) => {
    const d = D().data || {};
    for (const v of R.VALUES) if (d.values && d.values[v.id]) [v.name, v.restName] = d.values[v.id];
    for (const v of R.DOTTED) if (d.dotted && d.dotted[v.id]) v.name = d.dotted[v.id];
    for (const m of R.METERS) if (d.meters && d.meters[m.id]) { m.desc = d.meters[m.id]; m.kind = (d.kinds || {})[m.kind] || m.kind; }
  };

  /* ---------- Tłumaczenie tekstów ---------- */
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  let exact = null, templates = null, phrases = null;
  const cache = new Map();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function build() {
    const text = D().text || {};
    exact = new Map();
    templates = [];
    for (const [pl, en] of Object.entries(text)) {
      const k = norm(pl);
      if (/\{\d\}/.test(k)) {
        const re = new RegExp('^' + esc(k).replace(/\\\{(\d)\\\}/g, '(.*?)') + '$');
        const order = [...k.matchAll(/\{(\d)\}/g)].map((m) => +m[1]);
        templates.push({ re, en, order, len: k.length });
      } else exact.set(k, en);
    }
    templates.sort((a, b) => b.len - a.len);
    // Frazy do podmiany wewnątrz dłuższych tekstów: tylko wielowyrazowe lub długie, całymi słowami.
    phrases = [...exact.entries()].filter(([k]) => k.includes(' ') || k.length >= 9)
      .sort((a, b) => b[0].length - a[0].length)
      .map(([k, en]) => [new RegExp('(?<![\\p{L}])' + esc(k) + '(?![\\p{L}])', 'gu'), en]);
  }

  const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(akord|dźwię|skal|tonacj|nut|ćwicz|progres|przewr|zapis|metrum|tercj|kwint|kwart|sekund|sept|sekst|oktaw|pryma|mała|wielka|czysta|dur|moll|takt|pauz|ósemk|struna|próg|chwyt|brak|poziom|dalej|lub|oraz|jest|nie|na|do|od|w|z|ze|i|bez|po|co|to|jak|się)\b/i;

  /** Angielskie konwencje: „D♯ minor” (wielka litera), „second inversion”, „st” = semitones. */
  function polish(t) {
    return t
      .replace(/(^|[\s(—–-])([a-g])([♯♭𝄪𝄫]*) (minor|major)\b(?! (second|third|sixth|seventh|ninth|tenth|thirteenth|chord|triad|scale|key|mode|pentatonic|dominant|tonic|subdominant))/g,
        (_, a, l, acc, m) => a + l.toUpperCase() + acc + ' ' + m)
      .replace(/\b(III|II|I) inversion/g, (_, r) => ({ I: 'first', II: 'second', III: 'third' }[r]) + ' inversion')
      .replace(/(\d) pt\b/g, '$1 st');
  }

  function tx(s, depth = 0) {
    if (!s || depth > 4) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const core = norm(s);
    if (!core) return s;
    if (cache.has(core)) return lead + cache.get(core) + trail;
    if (!exact) build();
    let out = exact.get(core);
    if (out === undefined && !/[a-ząćęłńóśźż]{2}/i.test(core)) return s;
    if (out === undefined) {
      for (const t of templates) {
        const m = t.re.exec(core);
        if (!m) continue;
        out = t.en.replace(/\{(\d)\}/g, (_, i) => {
          const idx = t.order.indexOf(+i);
          return idx >= 0 ? tx(m[idx + 1], depth + 1) : '';
        });
        break;
      }
    }
    if (out === undefined) {
      out = core;
      for (const [re, en] of phrases) { re.lastIndex = 0; if (re.test(out)) { re.lastIndex = 0; out = out.replace(re, () => en); } }
    }
    out = polish(out);
    cache.set(core, out);
    return lead + out + trail;
  }
  I18N.t = tx;

  const BLOCK_SEL = 'p, li, summary, h1, h2, h3, dt, dd, th, td, label > span, .field > span, button, a, option, small, span.hint, span.qual, figcaption';
  const INLINE = /^(B|I|EM|STRONG|A|CODE|KBD|SMALL|BR|SPAN|SUB|SUP)$/;
  const ATTRS = ['title', 'placeholder', 'aria-label'];

  function translateBlocks(root) {
    const blocks = D().blocks || {};
    const list = root.querySelectorAll ? root.querySelectorAll(BLOCK_SEL) : [];
    for (const el of [root, ...list]) {
      if (!el.matches || !el.matches(BLOCK_SEL) || el.dataset.i18n) continue;
      if (![...el.children].every((c) => INLINE.test(c.tagName) && !c.children.length)) continue;
      const key = norm(el.textContent);
      const en = blocks[key];
      if (en !== undefined) { el.innerHTML = en; el.dataset.i18n = '1'; }
    }
  }
  function translateNode(root) {
    if (root.nodeType === 3) {
      const v = tx(root.nodeValue);
      if (v !== root.nodeValue) root.nodeValue = v;
      return;
    }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.tagName)) return;
    translateBlocks(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    const nodes = [];
    while ((n = tw.nextNode())) nodes.push(n);
    for (const t of nodes) {
      if (t.parentElement && /^(SCRIPT|STYLE)$/.test(t.parentElement.tagName)) continue;
      const v = tx(t.nodeValue);
      if (v !== t.nodeValue) t.nodeValue = v;
    }
    for (const el of [root, ...root.querySelectorAll('[title],[placeholder],[aria-label]')]) {
      for (const a of ATTRS) {
        if (!el.hasAttribute || !el.hasAttribute(a)) continue;
        const v = el.getAttribute(a), w = tx(v);
        if (w !== v) el.setAttribute(a, w);
      }
    }
  }

  let observer = null;
  function translateAll() {
    document.title = tx(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', tx(desc.getAttribute('content')));
    translateNode(document.body);
  }
  function observe() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      observer.disconnect();
      for (const m of muts) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'attributes') {
          const v = m.target.getAttribute(m.attributeName), w = v && tx(v);
          if (v && w !== v) m.target.setAttribute(m.attributeName, w);
        } else for (const n of m.addedNodes) translateNode(n);
      }
      if (document.title) { const t = tx(document.title); if (t !== document.title) document.title = t; }
      start();
    });
    start();
  }
  function start() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  I18N.applyData = patchData; // wywoływane na końcu i18n-en.js (przed skryptami stron)
  document.addEventListener('DOMContentLoaded', () => { translateAll(); observe(); });
})(window);
