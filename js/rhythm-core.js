/*
 * ChordBuilder — rytm: wartości rytmiczne, metrum, odtwarzanie (wspólne dla działu Rytm i ćwiczeń).
 * Czas liczony w szesnastkach (cała nuta = 16).
 */
(function (global) {
  'use strict';

  const VALUES = [
    { id: 'w', units: 16, note: '𝅝', rest: '𝄻', name: 'cała nuta', restName: 'pauza całonutowa' },
    { id: 'h', units: 8, note: '𝅗𝅥', rest: '𝄼', name: 'półnuta', restName: 'pauza półnutowa' },
    { id: 'q', units: 4, note: '𝅘𝅥', rest: '𝄽', name: 'ćwierćnuta', restName: 'pauza ćwierćnutowa' },
    { id: 'e', units: 2, note: '𝅘𝅥𝅮', rest: '𝄾', name: 'ósemka', restName: 'pauza ósemkowa' },
    { id: 's', units: 1, note: '𝅘𝅥𝅯', rest: '𝄿', name: 'szesnastka', restName: 'pauza szesnastkowa' },
  ];
  const DOTTED = [
    { id: 'h.', units: 12, base: 'h', name: 'półnuta z kropką' },
    { id: 'q.', units: 6, base: 'q', name: 'ćwierćnuta z kropką' },
    { id: 'e.', units: 3, base: 'e', name: 'ósemka z kropką' },
  ];
  const byId = (id) => VALUES.find((v) => v.id === id.replace('.', ''));

  /** Element rytmu: { v: 'q' | 'q.' …, rest: bool } → glif i długość. */
  function glyph(el) {
    const v = byId(el.v);
    return (el.rest ? v.rest : v.note) + (el.v.endsWith('.') ? '.' : '');
  }
  function units(el) {
    const v = byId(el.v);
    return el.v.endsWith('.') ? v.units * 1.5 : v.units;
  }
  function valueName(el) {
    const v = byId(el.v);
    const base = el.rest ? v.restName : v.name;
    return el.v.endsWith('.') ? base + ' z kropką' : base;
  }

  // Metrum: beats — liczba miar, unit — wartość miary (w szesnastkach), accents — siła miar.
  const METERS = [
    { id: '2/4', beats: 2, unit: 4, accents: [2, 0], kind: 'proste', desc: 'Dwie ćwierćnuty w takcie: mocna – słaba. Marsz, polka.' },
    { id: '3/4', beats: 3, unit: 4, accents: [2, 0, 0], kind: 'proste', desc: 'Trzy ćwierćnuty: mocna – słaba – słaba. Walc, mazurek, polonez.' },
    { id: '4/4', beats: 4, unit: 4, accents: [2, 0, 1, 0], kind: 'proste', desc: 'Cztery ćwierćnuty: mocna – słaba – średnia – słaba. Najczęstsze metrum w muzyce rozrywkowej (oznaczane też C).' },
    { id: '2/2', beats: 2, unit: 8, accents: [2, 0], kind: 'proste', desc: 'Alla breve: dwie półnuty w takcie (oznaczane też ¢) — liczymy „na dwa”, choć nut jest tyle co w 4/4.' },
    { id: '3/8', beats: 3, unit: 2, accents: [2, 0, 0], kind: 'proste', desc: 'Trzy ósemki: mocna – słaba – słaba; szybkie, lekkie (często liczone „na raz”).' },
    { id: '6/8', beats: 6, unit: 2, accents: [2, 0, 0, 1, 0, 0], kind: 'złożone', desc: 'Sześć ósemek w dwóch grupach po trzy: wyczuwamy dwie miary (ćwierćnuty z kropką). Kołysanki, barkarole, tarantela.' },
    { id: '9/8', beats: 9, unit: 2, accents: [2, 0, 0, 1, 0, 0, 1, 0, 0], kind: 'złożone', desc: 'Trzy grupy po trzy ósemki — trzy miary ćwierćnuty z kropką.' },
    { id: '12/8', beats: 12, unit: 2, accents: [2, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], kind: 'złożone', desc: 'Cztery grupy po trzy ósemki — typowe dla bluesa i ballad (shuffle).' },
    { id: '5/4', beats: 5, unit: 4, accents: [2, 0, 0, 1, 0], kind: 'nieregularne', desc: 'Pięć ćwierćnut, zwykle grupowane 3 + 2 (lub 2 + 3). Brzmi „kulejąco”, nieparzyście.' },
    { id: '7/8', beats: 7, unit: 2, accents: [2, 0, 1, 0, 1, 0, 0], kind: 'nieregularne', desc: 'Siedem ósemek, np. 2 + 2 + 3 — częste w muzyce bałkańskiej.' },
  ];
  const meterById = (id) => METERS.find((m) => m.id === id) || METERS[2];
  const barUnits = (m) => m.beats * m.unit;

  /**
   * Odtwarza rytm: kliknięcia na tle metronomu. elems — lista {v, rest};
   * bpm — ćwierćnuty na minutę. Zwraca funkcję zatrzymującą.
   */
  function playRhythm(elems, meter, bpm, opts = {}) {
    const timers = [];
    const unitSec = 60 / bpm / 4; // bpm w ćwierćnutach → sekundy na szesnastkę
    const countIn = opts.countIn ? barUnits(meter) : 0;
    const total = elems.reduce((s, e) => s + units(e), 0);
    const bars = Math.max(1, Math.ceil(total / barUnits(meter)));
    if (opts.metronome !== false) {
      for (let u = 0; u < countIn + bars * barUnits(meter); u += meter.unit) {
        const beat = (u / meter.unit) % meter.beats;
        const acc = meter.accents[beat];
        timers.push(setTimeout(() => global.Sound.play([acc === 2 ? 96 : acc === 1 ? 91 : 89], 'chord', 'piano', 0.08), u * unitSec * 1000));
      }
    }
    let t = countIn;
    for (const e of elems) {
      const d = units(e);
      if (!e.rest) {
        const at = t;
        timers.push(setTimeout(() => {
          global.Sound.play([opts.pitch || 72], 'chord', 'piano', Math.max(0.12, d * unitSec * 0.9));
          if (opts.onNote) opts.onNote(elems.indexOf(e));
        }, at * unitSec * 1000));
      }
      t += d;
    }
    if (opts.onEnd) timers.push(setTimeout(opts.onEnd, (countIn + bars * barUnits(meter)) * unitSec * 1000 + 200));
    return () => timers.forEach(clearTimeout);
  }

  /** Losowy takt wypełniający metrum (z dostępnych wartości), bez szesnastek z kropką itp. */
  function randomBar(meter, allowed, restChance = 0) {
    const need = barUnits(meter);
    for (let tries = 0; tries < 200; tries++) {
      const out = [];
      let left = need;
      while (left > 0) {
        const opts = allowed.filter((v) => {
          const u = units({ v });
          return u <= left;
        });
        if (!opts.length) break;
        const v = opts[Math.floor(Math.random() * opts.length)];
        out.push({ v, rest: Math.random() < restChance && out.length > 0 });
        left -= units({ v });
      }
      if (left === 0) return out;
    }
    // Awaryjnie: wypełnij zachłannie dowolnymi wartościami (zawsze dokładnie cały takt).
    const out = [];
    let left = need;
    for (const v of VALUES) while (v.units <= left) { out.push({ v: v.id, rest: false }); left -= v.units; }
    return out;
  }

  global.Rhythm = { VALUES, DOTTED, METERS, meterById, barUnits, glyph, units, valueName, playRhythm, randomBar };
})(window);
