/*
 * ChordBuilder — oznaczenia w nutach (dynamika, tempo, artykulacja, łuki, oddech, repetycje i skoki).
 * Wspólne dla słowniczka (tabele z rysunkami) i ćwiczenia „Oznaczenia w nutach”.
 */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // group: dyn | tempo | art | slur | breath | repeat | jump; level: od którego poziomu ćwiczenia (0–2).
  // draw: 'dyn:mf' (litery dynamiki), 'text:rit.' (napis), 'glyph:𝄐' (symbol muzyczny), lub nazwa rysunku SVG.
  const MARKS = [
    { id: 'pp', group: 'dyn', level: 0, draw: 'dyn:pp', name: 'pianissimo', meaning: 'bardzo cicho' },
    { id: 'p', group: 'dyn', level: 0, draw: 'dyn:p', name: 'piano', meaning: 'cicho' },
    { id: 'mp', group: 'dyn', level: 0, draw: 'dyn:mp', name: 'mezzo piano', meaning: 'średnio cicho' },
    { id: 'mf', group: 'dyn', level: 0, draw: 'dyn:mf', name: 'mezzo forte', meaning: 'średnio głośno' },
    { id: 'f', group: 'dyn', level: 0, draw: 'dyn:f', name: 'forte', meaning: 'głośno' },
    { id: 'ff', group: 'dyn', level: 0, draw: 'dyn:ff', name: 'fortissimo', meaning: 'bardzo głośno' },
    { id: 'cresc', group: 'dyn', level: 0, draw: 'cresc', name: 'crescendo (cresc.)', meaning: 'stopniowo coraz głośniej' },
    { id: 'dim', group: 'dyn', level: 0, draw: 'dim', name: 'diminuendo (dim., decresc.)', meaning: 'stopniowo coraz ciszej' },
    { id: 'largo', group: 'tempo', level: 0, draw: 'text:Largo', name: 'Largo, Adagio', meaning: 'wolno, szeroko' },
    { id: 'andante', group: 'tempo', level: 0, draw: 'text:Andante', name: 'Andante', meaning: 'spokojnie, w tempie kroku' },
    { id: 'moderato', group: 'tempo', level: 0, draw: 'text:Moderato', name: 'Moderato', meaning: 'umiarkowanie' },
    { id: 'allegro', group: 'tempo', level: 0, draw: 'text:Allegro', name: 'Allegro', meaning: 'szybko, żywo' },
    { id: 'rit', group: 'tempo', level: 0, draw: 'text:rit.', name: 'ritardando (rit., rall.)', meaning: 'stopniowo zwalniać' },
    { id: 'accel', group: 'tempo', level: 1, draw: 'text:accel.', name: 'accelerando', meaning: 'stopniowo przyspieszać' },
    { id: 'atempo', group: 'tempo', level: 1, draw: 'text:a tempo', name: 'a tempo', meaning: 'wrócić do poprzedniego tempa' },
    { id: 'fermata', group: 'tempo', level: 0, draw: 'fermata', name: 'fermata', meaning: 'przetrzymać dźwięk dłużej — tak długo, jak pokaże dyrygent' },
    { id: 'staccato', group: 'art', level: 1, draw: 'staccato', name: 'staccato', meaning: 'krótko, z odstępem przed następnym dźwiękiem' },
    { id: 'accent', group: 'art', level: 1, draw: 'accent', name: 'akcent', meaning: 'zaakcentować — zaśpiewać ten dźwięk mocniej' },
    { id: 'tenuto', group: 'art', level: 2, draw: 'tenuto', name: 'tenuto', meaning: 'wytrzymać pełną wartość, lekko podkreślić' },
    { id: 'slur', group: 'slur', level: 1, draw: 'slur', name: 'łuk legato', meaning: 'płynnie, bez przerw; w śpiewie zwykle kilka nut na jednej sylabie' },
    { id: 'tie', group: 'slur', level: 1, draw: 'tie', name: 'łuk łączący', meaning: 'dwie nuty tej samej wysokości śpiewa się jako jedną, dłuższą' },
    { id: 'breath', group: 'breath', level: 1, draw: 'breath', name: 'znak oddechu', meaning: 'tu wziąć szybki oddech' },
    { id: 'caesura', group: 'breath', level: 2, draw: 'caesura', name: 'cezura', meaning: 'krótka przerwa — chwila ciszy przed dalszym śpiewem' },
    { id: 'repeat', group: 'repeat', level: 1, draw: 'repeat', name: 'znaki repetycji', meaning: 'powtórzyć fragment między znakami (bez lewego znaku — od początku)' },
    { id: 'volta', group: 'repeat', level: 2, draw: 'volta', name: 'volty (1. i 2. zakończenie)', meaning: 'za pierwszym razem zakończenie 1., przy powtórce przeskoczyć do 2.' },
    { id: 'dc', group: 'jump', level: 2, draw: 'text:D.C.', name: 'Da capo (D.C.)', meaning: 'wrócić na początek utworu' },
    { id: 'ds', group: 'jump', level: 2, draw: 'segno', name: 'Dal segno (D.S.), znak segno', meaning: 'wrócić do znaku segno' },
    { id: 'fine', group: 'jump', level: 2, draw: 'text:Fine', name: 'Fine', meaning: 'koniec utworu — po powrocie (D.C. al Fine, D.S. al Fine) śpiewa się do tego miejsca' },
    { id: 'coda', group: 'jump', level: 2, draw: 'coda', name: 'coda', meaning: 'przy znaku „do cody” przeskoczyć do zakończenia oznaczonego tym znakiem' },
  ];

  const GROUPS = {
    dyn: 'Dynamika — głośność', tempo: 'Tempo i jego zmiany', art: 'Artykulacja — sposób zaśpiewania dźwięku',
    slur: 'Łuki', breath: 'Oddech i przerwy', repeat: 'Repetycje', jump: 'Skoki: D.C., D.S., Fine, coda',
  };

  function svg(w, hgt, label) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    s.setAttribute('class', 'mk-svg');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', label);
    return s;
  }
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  }
  function staff(s, x1, x2) { for (let i = 0; i < 5; i++) el('line', { x1, x2, y1: 10 + i * 6, y2: 10 + i * 6, class: 'mk-line' }, s); }
  /** Nuta (ćwierćnuta) z laseczką w górę: główka w (x, y). */
  function note(s, x, y) {
    el('ellipse', { cx: x, cy: y, rx: 4.2, ry: 3, transform: `rotate(-22 ${x} ${y})`, class: 'mk-head' }, s);
    el('line', { x1: x + 3.9, x2: x + 3.9, y1: y, y2: y - 20, class: 'mk-stem' }, s);
  }
  function glyph(s, x, y, ch, cls = 'mk-glyph') { const t = el('text', { x, y, class: cls, 'text-anchor': 'middle' }, s); t.textContent = ch; return t; }

  /** Rysunek oznaczenia: element HTML (span) lub SVG. */
  function draw(mark) {
    const d = mark.draw;
    if (d.startsWith('dyn:')) { const e = document.createElement('span'); e.className = 'mk-dyn'; e.textContent = d.slice(4); return e; }
    if (d.startsWith('text:')) { const e = document.createElement('span'); e.className = 'mk-text'; e.textContent = d.slice(5); return e; }
    let s;
    switch (d) {
      case 'cresc': s = svg(70, 30, mark.name); el('path', { d: 'M66 6 L6 15 L66 24', class: 'mk-stroke' }, s); break;
      case 'dim': s = svg(70, 30, mark.name); el('path', { d: 'M6 6 L66 15 L6 24', class: 'mk-stroke' }, s); break;
      case 'fermata': s = svg(50, 46, mark.name); staff(s, 4, 46); note(s, 22, 25); el('path', { d: 'M12 -1 Q25 -12 38 -1', class: 'mk-stroke', transform: 'translate(0 6)' }, s); el('circle', { cx: 25, cy: 3, r: 1.8, class: 'mk-fill' }, s); break;
      case 'staccato': s = svg(50, 46, mark.name); staff(s, 4, 46); note(s, 22, 22); el('circle', { cx: 22, cy: 31, r: 1.8, class: 'mk-fill' }, s); break;
      case 'accent': s = svg(50, 46, mark.name); staff(s, 4, 46); note(s, 22, 22); el('path', { d: 'M16 33 L28 36 L16 39', class: 'mk-stroke' }, s); break;
      case 'tenuto': s = svg(50, 46, mark.name); staff(s, 4, 46); note(s, 22, 22); el('line', { x1: 16, x2: 28, y1: 31, y2: 31, class: 'mk-stroke' }, s); break;
      case 'slur': s = svg(70, 46, mark.name); staff(s, 4, 66); note(s, 20, 28); note(s, 44, 19); el('path', { d: 'M20 34 Q34 44 50 26', class: 'mk-stroke' }, s); break;
      case 'tie': s = svg(70, 46, mark.name); staff(s, 4, 66); note(s, 20, 22); note(s, 46, 22); el('path', { d: 'M22 27 Q33 34 44 27', class: 'mk-stroke' }, s); break;
      case 'breath': s = svg(70, 46, mark.name); staff(s, 4, 66); note(s, 18, 22); note(s, 50, 22); glyph(s, 35, 10, '’', 'mk-glyph big'); break;
      case 'caesura': s = svg(70, 46, mark.name); staff(s, 4, 66); note(s, 18, 22); note(s, 54, 22); el('line', { x1: 31, x2: 37, y1: 12, y2: 2, class: 'mk-stroke' }, s); el('line', { x1: 35, x2: 41, y1: 12, y2: 2, class: 'mk-stroke' }, s); break;
      case 'repeat': s = svg(96, 40, mark.name); staff(s, 4, 92);
        el('line', { x1: 8, x2: 8, y1: 10, y2: 34, class: 'mk-bar thick' }, s); el('line', { x1: 13, x2: 13, y1: 10, y2: 34, class: 'mk-bar' }, s);
        el('circle', { cx: 18, cy: 19, r: 1.7, class: 'mk-fill' }, s); el('circle', { cx: 18, cy: 25, r: 1.7, class: 'mk-fill' }, s);
        note(s, 38, 22); note(s, 60, 22);
        el('circle', { cx: 78, cy: 19, r: 1.7, class: 'mk-fill' }, s); el('circle', { cx: 78, cy: 25, r: 1.7, class: 'mk-fill' }, s);
        el('line', { x1: 83, x2: 83, y1: 10, y2: 34, class: 'mk-bar' }, s); el('line', { x1: 88, x2: 88, y1: 10, y2: 34, class: 'mk-bar thick' }, s); break;
      case 'volta': s = svg(130, 46, mark.name);
        for (let i = 0; i < 5; i++) el('line', { x1: 4, x2: 126, y1: 18 + i * 6, y2: 18 + i * 6, class: 'mk-line' }, s);
        el('path', { d: 'M8 14 V4 H60 V14', class: 'mk-stroke thin' }, s); glyph(s, 18, 12, '1.', 'mk-num');
        el('path', { d: 'M68 14 V4 H122', class: 'mk-stroke thin' }, s); glyph(s, 78, 12, '2.', 'mk-num');
        el('line', { x1: 59, x2: 59, y1: 18, y2: 42, class: 'mk-bar' }, s); el('line', { x1: 63, x2: 63, y1: 18, y2: 42, class: 'mk-bar thick' }, s);
        el('circle', { cx: 54, cy: 27, r: 1.7, class: 'mk-fill' }, s); el('circle', { cx: 54, cy: 33, r: 1.7, class: 'mk-fill' }, s);
        note(s, 32, 30); note(s, 94, 30); break;
      case 'segno': s = svg(40, 40, mark.name); glyph(s, 20, 31, '𝄋'); break;
      case 'coda': s = svg(40, 40, mark.name); glyph(s, 20, 33, '𝄌', 'mk-glyph coda'); break;
      default: { const e = document.createElement('span'); e.textContent = mark.name; return e; }
    }
    return s;
  }

  // Teksty (nazwy, znaczenia) tłumaczy na angielski i18n.js — tak jak resztę strony.
  global.Marks = { MARKS, GROUPS, draw, byGroup: (g) => MARKS.filter((m) => m.group === g) };
})(window);
