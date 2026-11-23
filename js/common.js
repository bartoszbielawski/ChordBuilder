/*
 * ChordBuilder — wspólne pomocnicze funkcje dla podstron (interwały, modusy, ćwiczenia).
 */
(function (global) {
  'use strict';
  const T = global.Theory;
  const PREFS = 'chordbuilder.prefs';

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch (e) { return {}; }
  }
  function savePref(key, value) {
    try {
      const p = loadPrefs();
      p[key] = value;
      localStorage.setItem(PREFS, JSON.stringify(p));
    } catch (e) { /* brak localStorage */ }
  }

  function loadJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignoruj */ }
  }

  /** Przełącznik segmentowy: przyciski [data-value] w kontenerze. */
  function seg(box, value, onChange) {
    const sync = (v) => {
      for (const b of box.querySelectorAll('button[data-value]')) {
        const on = b.dataset.value === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      }
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      sync(b.dataset.value);
      onChange(b.dataset.value);
    });
    sync(value);
    return sync;
  }

  const NOTE_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const DEFAULT_SPELLING = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  /** Dźwięk o domyślnej pisowni dla numeru MIDI. */
  const noteOfMidi = (m) => T.parseNote(DEFAULT_SPELLING[T.mod(m, 12)]);

  /** MIDI dźwięku literowego w danej oktawie naukowej (C4 = 60; B♯3 = 60, C♭4 = 59). */
  function midiOf(note, octave) {
    return (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][note.letter] + note.acc;
  }

  const octaveName = (note, midi) => Math.floor((midi - note.acc) / 12) - 1;

  /* ---------- Widok: profil użytkownika, poziom szczegółowości, głos w chórze ---------- */

  // Profil decyduje, które instrumenty widać; poziom (1 podstawy, 2 więcej, 3 wszystko) — ile narzędzi.
  // Sekcje oznacza się w HTML: data-lv="2|3" (od którego poziomu widać) i data-not="choir piano…"
  // (w jakich profilach ukryć). Ukrywanie robi CSS na podstawie atrybutów <html data-level data-profile>.
  const PROFILES = [['all', 'wszystko'], ['choir', 'śpiewam w chórze'], ['piano', 'gram na pianinie'], ['guitar', 'gram na gitarze']];
  const VOICES = [['S', 'sopran'], ['A', 'alt'], ['T', 'tenor'], ['B', 'bas']];
  // Typowe zakresy głosów chóru amatorskiego (MIDI): S C4–G5, A G3–D5, T C3–G4, B F2–D4.
  const VOICE_RANGES = { S: [60, 79], A: [55, 74], T: [48, 67], B: [41, 62] };

  function getView() {
    const p = loadPrefs();
    const profile = PROFILES.some(([id]) => id === p.profile) ? p.profile : null;
    const level = [1, 2, 3].includes(p.level) ? p.level : (profile && profile !== 'all' ? 1 : 3);
    const voice = VOICE_RANGES[p.voice] ? p.voice : null;
    return { profile, level, voice };
  }

  /** Ustawia atrybuty widoku na <html>; minLevel — np. gdy link prowadzi do zaawansowanego narzędzia. */
  function applyView(minLevel = 1) {
    const v = getView();
    const root = document.documentElement;
    root.dataset.profile = v.profile || 'all';
    root.dataset.level = String(Math.max(v.level, minLevel));
    return v;
  }

  /**
   * Podłącza (jeśli są na stronie) przełączniki #profile, #level, #voice i kartę powitalną #welcome.
   * onChange(view, chosenProfile) — wołane po każdej zmianie (chosenProfile przy wyborze profilu).
   */
  function bindView(onChange = () => {}) {
    const $ = (id) => document.getElementById(id);
    const root = document.documentElement;
    const sync = () => {
      const v = getView();
      if ($('profile')) $('profile').value = v.profile || 'all';
      if ($('voice')) $('voice').value = v.voice || '';
      if (levelSeg) levelSeg(root.dataset.level);
      updateMoreHint();
    };
    const setLevel = (lv) => { savePref('level', lv); root.dataset.level = String(lv); sync(); onChange(getView()); };
    const setProfile = (id) => {
      savePref('profile', id);
      savePref('level', id === 'all' ? 3 : 1);
      applyView();
      sync();
      onChange(getView(), id);
    };
    let levelSeg = null;
    if ($('profile')) {
      $('profile').replaceChildren(...PROFILES.map(([id, label]) => new Option(label, id)));
      $('profile').addEventListener('change', (e) => setProfile(e.target.value));
    }
    if ($('voice')) {
      $('voice').replaceChildren(new Option('—', ''), ...VOICES.map(([id, label]) => new Option(label, id)));
      $('voice').addEventListener('change', (e) => { savePref('voice', e.target.value || null); onChange(getView()); });
    }
    if ($('level')) {
      seg($('level'), root.dataset.level, (v) => setLevel(+v));
      levelSeg = (v) => { for (const b of $('level').querySelectorAll('button[data-value]')) { const on = b.dataset.value === String(v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); } };
    }
    // Ile sekcji jest schowanych przez poziom — zachęta „Pokaż więcej”.
    function updateMoreHint() {
      const box = $('more-hint');
      if (!box) return;
      const lv = +root.dataset.level;
      const hiddenCount = [...document.querySelectorAll('main > section[data-lv]')]
        .filter((s) => +s.dataset.lv > lv && !(s.dataset.not || '').split(' ').includes(root.dataset.profile)).length;
      box.hidden = !hiddenCount;
      if (!hiddenCount) return;
      box.replaceChildren(
        h('span', {}, `Na wyższym poziomie jest więcej narzędzi (${hiddenCount}).`), ' ',
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => setLevel(Math.min(3, lv + 1)) }, 'Pokaż więcej'));
    }
    // Karta powitalna przy pierwszej wizycie (brak wybranego profilu).
    const w = $('welcome');
    if (w) {
      w.hidden = !!getView().profile;
      w.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.profile) {
          setProfile(b.dataset.profile);
          if (b.dataset.profile === 'choir') { $('welcome-start').hidden = true; $('welcome-voice').hidden = false; }
          else w.hidden = true;
        } else if (b.dataset.voice !== undefined) {
          savePref('voice', b.dataset.voice || null);
          sync();
          onChange(getView());
          $('welcome-voice').hidden = true;
          $('welcome-next').hidden = false;
        } else if (b.dataset.close !== undefined) w.hidden = true;
      });
    }
    sync();
  }

  /** Pasek „Dostępna jest nowa wersja strony” z przyciskiem odświeżenia. */
  function showUpdateBar() {
    if (document.querySelector('.update-bar')) return;
    const bar = h('div', { class: 'update-bar', role: 'status' },
      h('span', {}, 'Dostępna jest nowa wersja strony.'),
      h('button', { type: 'button', class: 'btn small', onclick: () => location.reload() }, 'Odśwież'),
      h('button', { type: 'button', class: 'btn ghost small', 'aria-label': 'Zamknij', title: 'Zamknij', onclick: () => bar.remove() }, '✕'));
    document.body.append(bar);
  }

  function registerSW() {
    let dev = false;
    try { dev = localStorage.getItem('chordbuilder.nosw') === '1'; } catch (e) { /* ignoruj */ }
    if (!dev && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      global.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
      // Nowa wersja service workera przejęła stronę → zaproponuj odświeżenie (bez samoczynnego
      // przeładowania, które mogłoby przerwać np. rozwiązywane ćwiczenie). Online pliki i tak idą
      // z sieci („najpierw sieć”), więc odłożenie odświeżenia jest bezpieczne.
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', showUpdateBar);
      }
    }
  }

  /**
   * Wejście MIDI (Web MIDI API — Chrome, Edge, Firefox; nie Safari).
   * handlers: { on(midi), off(midi), status(text) }. Zwraca Promise<boolean>.
   */
  function connectMidi(handlers) {
    if (!navigator.requestMIDIAccess) {
      handlers.status('Ta przeglądarka nie obsługuje MIDI (spróbuj Chrome lub Edge).');
      return Promise.resolve(false);
    }
    return navigator.requestMIDIAccess().then((access) => {
      const attach = () => {
        let n = 0;
        for (const input of access.inputs.values()) {
          n++;
          input.onmidimessage = (e) => {
            const [st, note, vel] = e.data;
            const cmd = st & 0xf0;
            if (cmd === 0x90 && vel > 0) handlers.on(note);
            else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) handlers.off(note);
          };
        }
        handlers.status(n ? `MIDI: połączono (${[...access.inputs.values()].map((i) => i.name).join(', ')})` : 'MIDI: nie wykryto urządzenia — podłącz klawiaturę.');
      };
      access.onstatechange = attach;
      attach();
      return true;
    }).catch(() => { handlers.status('MIDI: brak zgody na dostęp.'); return false; });
  }

  /**
   * Klawiatura komputera jako pianino (układ jak w programach muzycznych):
   * A W S E D F T G Y H U J K O L P ; → C4 … E5 (litery Z / X zmieniają oktawę).
   * handler(midi) — wywoływany przy wciśnięciu; zwraca funkcję odpinającą.
   */
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
  function computerPiano(handler, base = 60) {
    let shift = 0;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { shift = Math.max(-24, shift - 12); return; }
      if (k === 'x') { shift = Math.min(24, shift + 12); return; }
      if (!(k in KEYMAP)) return;
      e.preventDefault();
      handler(base + shift + KEYMAP[k]);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  /**
   * Plik MIDI (typ 0) z listy akordów: chords = [[midi, …], …], każdy trwa `beats` ćwierćnut.
   * Zwraca Uint8Array do pobrania jako .mid.
   */
  function midiFile(chords, bpm = 90, beats = 4) {
    const PPQ = 480;
    const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
    const ev = [];
    const us = Math.round(60000000 / bpm);
    ev.push(0x00, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff); // tempo
    ev.push(0x00, 0xc0, 0x00); // program: fortepian
    const len = PPQ * beats;
    for (const notes of chords) {
      notes.forEach((m) => ev.push(0x00, 0x90, m & 0x7f, 80));
      notes.forEach((m, i) => ev.push(...vlq(i === 0 ? len : 0), 0x80, m & 0x7f, 0));
    }
    ev.push(0x00, 0xff, 0x2f, 0x00); // koniec ścieżki
    const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
    const n = ev.length;
    const trk = [0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    return new Uint8Array([...head, ...trk, ...ev]);
  }

  /**
   * Plik MIDI (typ 0) z listy zdarzeń { at, dur, notes[] } w ćwierćnutach (np. melodia + akordy).
   */
  function midiEvents(events, bpm = 90) {
    const PPQ = 480;
    const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
    const raw = [];
    for (const e of events) for (const m of e.notes) {
      raw.push({ t: Math.round(e.at * PPQ), on: true, m });
      raw.push({ t: Math.round((e.at + e.dur) * PPQ), on: false, m });
    }
    raw.sort((a, b) => a.t - b.t || (a.on === b.on ? 0 : a.on ? 1 : -1));
    const us = Math.round(60000000 / bpm);
    const ev = [0x00, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff, 0x00, 0xc0, 0x00];
    let last = 0;
    for (const r of raw) { ev.push(...vlq(r.t - last), r.on ? 0x90 : 0x80, r.m & 0x7f, r.on ? 80 : 0); last = r.t; }
    ev.push(0x00, 0xff, 0x2f, 0x00);
    const n = ev.length;
    return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff,
      0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...ev]);
  }

  /** Pobranie danych jako plik (inicjowane kliknięciem użytkownika). */
  function saveFile(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Losowy element tablicy. */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Polska odmiana rzeczownika po liczebniku: plural(2, 'półton', 'półtony', 'półtonów') → 'półtony'.
   * Dla ułamków (1,5) zwraca `frac` (domyślnie formę `few`, np. „1,5 ćwierćnuty”).
   */
  function plural(n, one, few, many, frac = few) {
    if (!Number.isInteger(n)) return frac;
    const a = Math.abs(n);
    if (a === 1) return one;
    if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return few;
    return many;
  }
  const semitones = (n) => n + ' ' + plural(n, 'półton', 'półtony', 'półtonów');

  global.Common = {
    plural, semitones, showUpdateBar, getView, applyView, bindView, PROFILES, VOICES, VOICE_RANGES,
    h, loadPrefs, savePref, loadJSON, saveJSON, seg, NOTE_KEYS, DEFAULT_SPELLING,
    noteOfMidi, midiOf, octaveName, registerSW, pick, shuffle, connectMidi, computerPiano, midiFile, midiEvents, saveFile,
  };
})(window);
