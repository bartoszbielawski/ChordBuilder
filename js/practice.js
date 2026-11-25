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

  /* ---------- MIDI: eksport i import ---------- */

  const TRACK_NAME = { S: 'Sopran', A: 'Alt', T: 'Tenor', B: 'Bas' };
  const ALLOWED = [16, 12, 8, 6, 4, 3, 2, 1];
  const t = (s) => (window.I18N && window.I18N.t ? window.I18N.t(s) : s);
  const msg = (s) => { $('io-msg').textContent = s; };

  function exportMidi() {
    const ppq = 480, u = ppq / 4;
    const voices = VOICES.filter((v) => st.on.has(v) && st.notes[v].length);
    if (!voices.length) { msg('Fragment jest pusty — nie ma czego eksportować.'); return; }
    const tracks = voices.map((v, i) => {
      let at = 0;
      const notes = [];
      for (const e of st.notes[v]) { if (!e.rest) notes.push({ start: at * u, dur: e.units * u, midi: e.midi }); at += e.units; }
      return { name: TRACK_NAME[v], channel: i, notes };
    });
    const { mode } = keyParts();
    const sig = keySig();
    const [num, den] = st.meter.split('/').map(Number);
    C.saveFile(window.MidiIO.write({ ppq, bpm: st.bpm, time: [num, den], key: { sf: sig.type === 'flat' ? -sig.count : sig.count, minor: mode === 'minor' }, tracks }),
      'fragment.mid', 'audio/midi');
    msg(`Zapisano plik fragment.mid (${voices.map((v) => VN[v]).join(', ')}).`);
  }

  /** Głos na podstawie nazwy ścieżki (polskiej lub angielskiej), inaczej null. */
  function voiceFromName(name) {
    const n = (name || '').toLowerCase().trim();
    if (/sopr|^s\d?$/.test(n)) return 'S';
    if (/^alt|alto|^a\d?$/.test(n)) return 'A';
    if (/ten/.test(n) || /^t\d?$/.test(n)) return 'T';
    if (/bas|bass|^b\d?$/.test(n)) return 'B';
    return null;
  }
  /** Podział długości (w szesnastkach) na dozwolone wartości, od największej. */
  function split(units) {
    const out = [];
    while (units > 0) { const a = ALLOWED.find((x) => x <= units); out.push(a); units -= a; }
    return out;
  }

  let lastMidi = null;
  function importMidi(mid, quiet) {
    // Ścieżki z nutami; ścieżka z kilkoma kanałami (plik typu 0) dzielona na kanały; kanał 10 (perkusja) pomijany.
    const parts = [];
    for (const tr of mid.tracks) {
      const notes = tr.notes.filter((n) => n.channel !== 9);
      const chs = [...new Set(notes.map((n) => n.channel))];
      if (chs.length > 1) for (const c of chs) parts.push({ name: tr.name, notes: notes.filter((n) => n.channel === c) });
      else if (notes.length) parts.push({ name: tr.name, notes });
    }
    if (!parts.length) { msg('W pliku nie ma nut.'); return; }
    const avg = (p) => p.notes.reduce((s, n) => s + n.midi, 0) / p.notes.length;
    const assign = new Map(); // głos → część
    for (const p of parts) { const v = voiceFromName(p.name); if (v && !assign.has(v)) assign.set(v, p); }
    if (!assign.size) {
      // Bez nazw głosów: pomiń akompaniament (nazwa lub dużo współbrzmień), resztę ułóż od najwyższej.
      const poly = (p) => { const st0 = new Map(); for (const n of p.notes) st0.set(n.start, (st0.get(n.start) || 0) + 1); return [...st0.values()].filter((c) => c > 1).length / st0.size; };
      let cand = parts.filter((p) => !/pian|organ|fortep|akomp|accomp|keyboard|klawisz/i.test(p.name || ''));
      if (cand.length > 4) { const mono = cand.filter((p) => poly(p) < 0.3); if (mono.length) cand = mono; }
      if (!cand.length) cand = parts;
      if (cand.length === 1) assign.set(st.me, cand[0]);
      else cand.sort((a, b) => avg(b) - avg(a)).slice(0, 4).forEach((p, i) => assign.set(VOICES[i], p));
    }
    // Metrum, tonacja, tempo z pliku (jeśli są i strona je obsługuje).
    const notes = [];
    if (mid.time) {
      const ms = `${mid.time[0]}/${mid.time[1]}`;
      if (METERS.includes(ms)) st.meter = ms; else notes.push(`metrum ${ms} nie jest obsługiwane — użyto ${st.meter}`);
    }
    if (mid.key) {
      const k = KEYS.find((key) => { const [tk, mode] = key.split(':'); const s = T.keySignature(T.parseNote(tk), mode);
        return (mode === 'minor') === mid.key.minor && (s.type === 'flat' ? -s.count : s.count) === mid.key.sf; });
      if (k) st.key = k;
    }
    if (mid.bpm) st.bpm = Math.max(30, Math.min(160, Math.round(mid.bpm / 5) * 5));
    const [num, den] = st.meter.split('/').map(Number);
    const unit = mid.ppq / 4;
    const barU = (16 * num) / den;
    const from = Math.max(1, +$('imp-from').value || 1), count = Math.max(1, Math.min(32, +$('imp-count').value || 8));
    // Liczba taktów w pliku; okno nie wychodzi poza ostatni takt z nutami.
    let totalBars = 0;
    for (const p of assign.values()) totalBars = Math.max(totalBars, Math.ceil(Math.max(...p.notes.map((n) => (n.start + n.dur) / unit)) / barU - 1e-9));
    if (from > totalBars) { msg(`Plik ma tylko ${totalBars} ${C.plural(totalBars, 'takt', 'takty', 'taktów')} — wybierz wcześniejszy takt początkowy.`); return; }
    const ws = (from - 1) * barU, we = Math.min(ws + count * barU, totalBars * barU);
    const lastBar = we / barU;
    let simplified = 0;
    for (const v of VOICES) st.notes[v] = [];
    for (const [v, p] of assign) {
      // Kwantyzacja do szesnastek, wybór okna taktów, jeden dźwięk naraz (górny dla S/A, dolny dla T/B).
      const byStart = new Map();
      for (const n of p.notes) {
        const s = Math.round(n.start / unit);
        if (s < ws || s >= we) continue;
        const e = Math.min(we, Math.max(s + 1, Math.round((n.start + n.dur) / unit)));
        const prev = byStart.get(s);
        if (prev) simplified++;
        if (!prev || (['S', 'A'].includes(v) ? n.midi > prev.midi : n.midi < prev.midi)) byStart.set(s, { s, e, midi: n.midi });
      }
      const list = [...byStart.values()].sort((a, b) => a.s - b.s);
      const seq = [];
      let cur = ws;
      list.forEach((n, i) => {
        const end = Math.min(n.e, i + 1 < list.length ? list[i + 1].s : we);
        if (n.s > cur) split(n.s - cur).forEach((u) => seq.push({ rest: true, units: u }));
        const parts2 = split(end - n.s);
        if (parts2.length > 1) simplified++;
        seq.push({ midi: Math.max(24, Math.min(96, n.midi)), units: parts2[0] });
        parts2.slice(1).forEach((u) => seq.push({ rest: true, units: u }));
        cur = end;
      });
      if (seq.length && cur < we) split(we - cur).forEach((u) => seq.push({ rest: true, units: u }));
      st.notes[v] = seq;
    }
    st.on = new Set([...assign.keys(), st.me]);
    st.edit = assign.has(st.me) ? st.me : [...assign.keys()][0];
    lastMidi = mid;
    stop();
    render();
    const names = [...assign.entries()].map(([v, p]) => `${VN[v]}${p.name ? ` („${p.name}”)` : ''}`).join(', ');
    msg(`Wczytano: ${names}; takty ${from}–${lastBar} z ${totalBars}.` +
      (simplified ? ` Uproszczono ${simplified} ${C.plural(simplified, 'miejsce', 'miejsca', 'miejsc')} (akordy w jednym głosie lub nietypowe długości).` : '') +
      (notes.length ? ' Uwaga: ' + notes.join('; ') + '.' : '') +
      (totalBars > lastBar - from + 1 ? ' Inne takty wybierzesz polami „od taktu” i „liczba taktów”.' : ''));
    if (!quiet) $('staves').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('midi-export').addEventListener('click', exportMidi);
  $('midi-import').addEventListener('click', () => {
    if (VOICES.some((v) => st.notes[v].length) && !confirm(t('Zastąpić obecny fragment nutami z pliku?'))) return;
    $('midi-file').click();
  });
  $('midi-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { importMidi(window.MidiIO.read(new Uint8Array(await f.arrayBuffer()))); } catch (err) { msg(`Nie udało się wczytać pliku: ${err.message}`); }
  });
  for (const id of ['imp-from', 'imp-count']) $(id).addEventListener('change', () => { if (lastMidi) importMidi(lastMidi, true); });

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
