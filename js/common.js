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

  function registerSW() {
    let dev = false;
    try { dev = localStorage.getItem('chordbuilder.nosw') === '1'; } catch (e) { /* ignoruj */ }
    if (!dev && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      global.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
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

  global.Common = {
    h, loadPrefs, savePref, loadJSON, saveJSON, seg, NOTE_KEYS, DEFAULT_SPELLING,
    noteOfMidi, midiOf, octaveName, registerSW, pick, shuffle, connectMidi,
  };
})(window);
