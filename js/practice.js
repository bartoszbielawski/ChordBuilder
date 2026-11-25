/*
 * ChordBuilder — „Fragment do nauczenia”: krótki fragment partii (do czterech głosów S/A/T/B)
 * wpisywany z klawiatury, odtwarzany wolno, w pętli, sam albo na tle pozostałych głosów.
 * Stan w adresie (część po #, nie trafia do serwera):
 *   #k=C:major&m=4/4&bpm=70&me=S&on=SA&S=64-4.64-4.r-4…&A=…
 * Element: „midi-długość” (długość w szesnastkach, 16 = cała nuta) albo „r-długość” (pauza).
 */
(function () {
  'use strict';
  const T = window.Theory, I = window.Instruments, C = window.Common, R = window.Rhythm;
  const { h } = C;
  const $ = (id) => document.getElementById(id);
  const VOICES = ['S', 'A', 'T', 'B'];
  const VN = Object.fromEntries(C.VOICES);
  const KEYS = [
    ...['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].map((k) => `${k}:major`),
    ...['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'].map((k) => `${k}:minor`),
  ];
  const METERS = ['2/4', '3/4', '4/4', '2/2', '3/8', '6/8'];
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SAVE_KEY = 'chordbuilder.fragment';

  const prefs = C.loadPrefs();
  const myVoice = C.getView().voice || 'S';
  const st = {
    notation: prefs.notation === 'H' ? 'H' : 'intl',
    key: 'C:major', meter: '4/4', bpm: 70, me: myVoice, on: new Set([myVoice]), edit: myVoice,
    notes: { S: [], A: [], T: [], B: [] },
    dur: 4, dot: false, mode: 'mine', loop: true, countIn: true, chord: true,
  };

  /* ---------- Zapis i odczyt ---------- */

  const enc = (list) => list.map((e) => `${e.rest ? 'r' : e.midi}-${e.units}`).join('.');
  function dec(s) {
    return (s || '').split('.').filter(Boolean).map((t) => {
      const [a, b] = t.split('-');
      const units = +b;
      if (![1, 2, 3, 4, 6, 8, 12, 16].includes(units)) return null;
      if (a === 'r') return { rest: true, units };
      const midi = +a;
      return midi >= 24 && midi <= 96 ? { midi, units } : null;
    }).filter(Boolean);
  }
  function params() {
    const q = new URLSearchParams({ k: st.key, m: st.meter, bpm: st.bpm, me: st.me, on: VOICES.filter((v) => st.on.has(v)).join('') });
    for (const v of VOICES) if (st.on.has(v) && st.notes[v].length) q.set(v, enc(st.notes[v]));
    return q;
  }
  function apply(p) {
    if (KEYS.includes(p.get('k'))) st.key = p.get('k');
    if (METERS.includes(p.get('m'))) st.meter = p.get('m');
    if (+p.get('bpm') >= 30 && +p.get('bpm') <= 160) st.bpm = +p.get('bpm');
    if (VOICES.includes(p.get('me'))) st.me = p.get('me');
    if (p.get('on')) { const on = [...p.get('on')].filter((v) => VOICES.includes(v)); if (on.length) st.on = new Set(on); }
    for (const v of VOICES) st.notes[v] = dec(p.get(v));
    if (!st.on.has(st.me)) st.on.add(st.me);
    st.edit = st.on.has(st.edit) ? st.edit : st.me;
  }
  function save() {
    const q = params();
    try { localStorage.setItem(SAVE_KEY, q.toString()); } catch (e) { /* ignoruj */ }
    history.replaceState(null, '', '#' + q);
  }

  /* ---------- Teoria: tonacja, pisownia, takty ---------- */

  const keyParts = () => { const [k, mode] = st.key.split(':'); return { tonic: T.parseNote(k), mode }; };
  const keySig = () => { const { tonic, mode } = keyParts(); return T.keySignature(tonic, mode); };
  const nn = (n) => T.noteName(n, st.notation);
  const keyLabel = (key) => {
    const [k, mode] = key.split(':'); const t = T.parseNote(k);
    return st.notation === 'H' ? T.polishKeyName(t, mode) : mode === 'major' ? `${nn(t)}-dur` : `${nn(t).toLowerCase()}-moll`;
  };
  /** Pisownia dźwięku w tonacji: najpierw dźwięki skali (w molu także podwyższony VII), potem wg rodzaju znaków. */
  function spell(midi) {
    const { tonic, mode } = keyParts();
    const pc = T.mod(midi, 12);
    const cands = T.buildScale(tonic, mode === 'major' ? 'major' : 'minor').notes.map((n) => n.note);
    if (mode === 'minor') cands.push(T.buildScale(tonic, 'harmonicMinor').notes[6].note);
    const hit = cands.find((n) => n.pc === pc);
    if (hit) return hit;
    return T.parseNote((keySig().type === 'flat' ? FLAT : SHARP)[pc]);
  }
  const meter = () => R.meterById(st.meter);
  const barUnits = () => R.barUnits(meter());
  const restGlyph = (units) => { const base = [12, 6, 3].includes(units) ? units / 1.5 : units; return (R.VALUES.find((v) => v.units === base) || R.VALUES[2]).rest; };
  const clefOf = (v) => (v === 'S' || v === 'A' ? 'treble' : 'bass');

  /* ---------- Rysowanie ---------- */

  let playing = null; // { col: { voice: index } }

  function renderStaves() {
    const sig = keySig();
    $('staves').replaceChildren(...VOICES.filter((v) => st.on.has(v)).map((v) => {
      const list = st.notes[v];
      const box = h('div', { class: 'melody-wrap pr-staff' });
      let acc = 0;
      const barAfter = new Set();
      list.forEach((e, i) => { acc += e.units; if (acc % barUnits() === 0 && i < list.length - 1) barAfter.add(i); });
      if (list.length) {
        I.renderMelody(box, list.map((e) => (e.rest ? [] : [{ midi: e.midi, note: spell(e.midi), role: v === st.me ? 'root' : null }])), {
          clef: clefOf(v), keySig: sig, gap: 34, scale: 1.2, minWidth: 220, barAfter,
          durations: list.map((e) => ({ units: e.units, rest: !!e.rest, glyph: restGlyph(e.units) })),
          activeCol: playing && playing[v] != null ? playing[v] : undefined,
          onColumn: (i) => { if (!list[i].rest) Sound.play([list[i].midi], 'chord', 'piano', 0.8); },
          ariaLabel: `${VN[v]}: ${list.length} nut`,
        });
      } else {
        box.append(h('p', { class: 'muted small-text' }, 'Brak nut — wpisz je klawiaturą poniżej.'));
      }
      return h('div', { class: 'pr-voice' + (v === st.edit ? ' editing' : '') + (v === st.me ? ' mine' : '') },
        h('div', { class: 'pr-vname' }, h('b', {}, VN[v]), v === st.me ? h('span', { class: 'tag' }, 'mój głos') : null,
          h('button', { type: 'button', class: 'btn ghost small', onclick: () => { st.edit = v; render(); } }, v === st.edit ? '✎ wpisuję' : '✎ wpisuj')),
        box);
    }));
  }

  function renderBarInfo() {
    const list = st.notes[st.edit];
    const used = list.reduce((s, e) => s + e.units, 0);
    const bu = barUnits();
    const bars = Math.floor(used / bu), left = (bu - (used % bu)) % bu;
    const quarters = (u) => String(u / 4).replace('.', ',');
    $('bar-info').textContent = !list.length ? `${VN[st.edit]}: jeszcze nic nie wpisano.`
      : left === 0 ? `${VN[st.edit]}: ${bars} ${C.plural(bars, 'pełny takt', 'pełne takty', 'pełnych taktów')}.`
        : `${VN[st.edit]}: takt ${bars + 1} — brakuje jeszcze ${quarters(left)} ${C.plural(left / 4, 'ćwierćnuty', 'ćwierćnut', 'ćwierćnut', 'ćwierćnuty')} do pełnego taktu.`;
  }

  function renderPiano() {
    const [lo, hi] = C.VOICE_RANGES[st.edit];
    const start = lo - T.mod(lo, 12);
    const octaves = Math.ceil((hi + 1 - start) / 12);
    const sc = new Set(T.buildScale(keyParts().tonic, keyParts().mode === 'major' ? 'major' : 'minor').notes.map((n) => n.note.pc));
    I.renderPiano($('piano'), {
      startMidi: start, octaves, scalePcs: sc, highlights: new Map(),
      keyName: (m) => (m >= lo && m <= hi ? nn(spell(m)) : null),
      keyTitle: (m) => nn(spell(m)) + C.octaveName(spell(m), m),
      onKey: (m) => { Sound.play([m], 'chord', 'piano', 0.6); add({ midi: m }); },
    });
  }

  function renderControls() {
    $('key').replaceChildren(...KEYS.map((k) => new Option(keyLabel(k), k, false, k === st.key)));
    $('meter').replaceChildren(...METERS.map((m) => new Option(m, m, false, m === st.meter)));
    $('me').replaceChildren(...VOICES.map((v) => new Option(VN[v], v, false, v === st.me)));
    $('voices-on').replaceChildren(...VOICES.map((v) => h('button', {
      type: 'button', class: st.on.has(v) ? 'on' : '', 'aria-pressed': st.on.has(v), title: VN[v],
      onclick: () => {
        if (st.on.has(v)) { if (v === st.me || st.on.size === 1) return; st.on.delete(v); if (st.edit === v) st.edit = st.me; } else st.on.add(v);
        render();
      },
    }, v)));
    $('edit-voice').replaceChildren(...VOICES.filter((v) => st.on.has(v)).map((v) => h('button', {
      type: 'button', class: v === st.edit ? 'on' : '', 'aria-pressed': v === st.edit, onclick: () => { st.edit = v; render(); },
    }, VN[v])));
    $('dur').replaceChildren(...R.VALUES.map((v) => h('button', {
      type: 'button', class: v.units === st.dur ? 'on' : '', 'aria-pressed': v.units === st.dur, title: v.name, onclick: () => { st.dur = v.units; renderControls(); },
    }, h('span', { class: 'rh-g' }, v.note))));
    $('dot').checked = st.dot;
    $('bpm').value = st.bpm;
    $('bpm-val').textContent = st.bpm;
    $('loop').checked = st.loop;
    $('countin').checked = st.countIn;
    $('chord').checked = st.chord;
    for (const b of $('mode').querySelectorAll('button')) { const on = b.dataset.value === st.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
  }

  function render() {
    renderControls();
    renderStaves();
    renderBarInfo();
    renderPiano();
    save();
  }

  /* ---------- Wpisywanie ---------- */

  function add(e) {
    const units = st.dot && st.dur > 1 ? st.dur * 1.5 : st.dur;
    st.notes[st.edit].push({ ...e, units });
    renderStaves();
    renderBarInfo();
    save();
  }

  /* ---------- Odtwarzanie ---------- */

  let timers = [];
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    playing = null;
    $('play').disabled = false;
    $('stop').disabled = true;
    renderStaves();
  }
  function play() {
    stop();
    const voices = VOICES.filter((v) => st.on.has(v) && st.notes[v].length);
    const audible = voices.filter((v) => (st.mode === 'mine' ? v === st.me : st.mode === 'others' ? v !== st.me : true));
    if (!voices.length) return;
    $('play').disabled = true;
    $('stop').disabled = false;
    const unit = 60 / st.bpm / 4; // szesnastka w sekundach (tempo w ćwierćnutach)
    const m = meter();
    const pre = st.countIn ? barUnits() : 0;
    const ms = (u) => u * unit * 1000;
    playing = {};
    if (st.chord) {
      const { tonic, mode } = keyParts();
      const t = 55 + T.mod(tonic.pc - 7, 12);
      Sound.play([t - 12, t, t + (mode === 'major' ? 4 : 3), t + 7], 'chord', 'piano', Math.max(1.2, pre * unit));
    }
    for (let u = 0; u < pre; u += m.unit) {
      const acc = m.accents[(u / m.unit) % m.beats];
      timers.push(setTimeout(() => Sound.play([acc === 2 ? 96 : 89], 'click'), ms(u)));
    }
    let end = 0;
    for (const v of voices) {
      let u = pre;
      st.notes[v].forEach((e, i) => {
        const at = u;
        timers.push(setTimeout(() => {
          if (!e.rest && audible.includes(v)) Sound.play([e.midi], 'chord', 'piano', Math.max(0.15, e.units * unit * 0.92));
          playing[v] = i;
          renderStaves();
        }, ms(at)));
        u += e.units;
      });
      end = Math.max(end, u);
    }
    timers.push(setTimeout(() => { if (st.loop) play(); else stop(); }, ms(end) + 400));
  }

  /* ---------- Przykład ---------- */

  function example() {
    stop();
    st.key = 'C:major';
    st.meter = '4/4';
    st.on = new Set(['S', st.me]);
    // „Oda do radości” (L. van Beethoven) — początek melodii; sopran.
    const q = (m) => ({ midi: m, units: 4 });
    st.notes.S = [q(64), q(64), q(65), q(67), q(67), q(65), q(64), q(62), q(60), q(60), q(62), q(64), { midi: 64, units: 6 }, { midi: 62, units: 2 }, { midi: 62, units: 8 }];
    if (st.me !== 'S') st.notes[st.me] = [];
    st.edit = st.me;
    render();
  }

  /* ---------- Zdarzenia ---------- */

  $('key').addEventListener('change', (e) => { st.key = e.target.value; render(); });
  $('meter').addEventListener('change', (e) => { st.meter = e.target.value; render(); });
  $('me').addEventListener('change', (e) => { st.me = e.target.value; st.on.add(st.me); st.edit = st.me; render(); });
  $('dot').addEventListener('change', (e) => { st.dot = e.target.checked; });
  $('rest').addEventListener('click', () => add({ rest: true }));
  $('undo').addEventListener('click', () => { st.notes[st.edit].pop(); renderStaves(); renderBarInfo(); save(); });
  $('clear').addEventListener('click', () => { st.notes[st.edit] = []; renderStaves(); renderBarInfo(); save(); });
  $('clear-all').addEventListener('click', () => { if (!confirm('Usunąć nuty wszystkich głosów?')) return; stop(); for (const v of VOICES) st.notes[v] = []; render(); });
  $('example').addEventListener('click', example);
  $('bpm').addEventListener('input', (e) => { st.bpm = +e.target.value; $('bpm-val').textContent = st.bpm; save(); });
  $('loop').addEventListener('change', (e) => { st.loop = e.target.checked; });
  $('countin').addEventListener('change', (e) => { st.countIn = e.target.checked; });
  $('chord').addEventListener('change', (e) => { st.chord = e.target.checked; });
  C.seg($('mode'), st.mode, (v) => { st.mode = v; });
  $('play').addEventListener('click', play);
  $('stop').addEventListener('click', stop);
  $('share').addEventListener('click', () => {
    save();
    const url = location.href;
    const done = () => { $('share').textContent = '✓ Skopiowano link'; setTimeout(() => { $('share').textContent = '🔗 Link do fragmentu'; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Link do fragmentu:', url));
    else prompt('Link do fragmentu:', url);
  });
  C.seg($('notation'), st.notation, (v) => { st.notation = v; C.savePref('notation', v); render(); });

  try { const saved = localStorage.getItem(SAVE_KEY); if (saved) apply(new URLSearchParams(saved)); } catch (e) { /* ignoruj */ }
  if (location.hash.length > 1) apply(new URLSearchParams(location.hash.slice(1)));
  render();
  C.registerSW();
})();
