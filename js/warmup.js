/*
 * ChordBuilder — rozśpiewka dla chóru.
 * Wokalizy (wzory na stopniach skali durowej) grane z akordem i transponowane co półton
 * w górę do granicy zakresu głosów i z powrotem; ćwiczenia zespołowe (akord od basu, „Amen”);
 * plan rozśpiewki do ułożenia i wysłania linkiem.
 * Stan w adresie: #plan=hum.vowels…&who=choir&bpm=80&reps=5&dir=updown&chord=1&mel=1
 */
(function () {
  'use strict';
  const T = window.Theory, I = window.Instruments, C = window.Common;
  const { h } = C;
  const $ = (id) => document.getElementById(id);
  const SEMI = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 };
  const KEY_SPELL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  // kind: 'text' (bez dźwięku), 'pattern' (wokaliza), 'chordbuild' (akord budowany od basu), 'amen' (kadencja IV–I).
  const EXERCISES = [
    { id: 'body', kind: 'text', title: 'Rozluźnienie i oddech', points: [
      'Stańcie swobodnie: stopy na szerokość bioder, kolana luźne, głowa „wisi” na czubku.',
      'Rozluźnijcie ramiona i kark — kilka powolnych krążeń barkami w tył.',
      'Wdech nosem nisko, do brzucha i boków (żebra się rozszerzają), wydech na „sss” przez 8–12 sekund.',
      'Kilka krótkich, energicznych wydechów na „f-f-f” lub „ts-ts-ts” — czujecie pracę przepony.',
    ] },
    { id: 'hum', kind: 'pattern', title: 'Mruczando', deg: [5, 4, 3, 2, 1], syl: ['mmm'],
      desc: 'Usta zamknięte, zęby lekko rozsunięte, dźwięk „w masce” — czuć wibrację przy nosie. Rozgrzewa głos bez wysiłku.' },
    { id: 'vowels', kind: 'pattern', title: 'Samogłoski', deg: [1, 2, 3, 2, 1], syl: ['ma', 'me', 'mi', 'mo', 'mu'],
      desc: 'Każda samogłoska na jednym dźwięku. Szczęka luźna, ta sama barwa na wszystkich samogłoskach.' },
    { id: 'legato', kind: 'pattern', title: 'Legato', deg: [1, 2, 3, 4, 5, 4, 3, 2, 1], syl: ['la'],
      desc: 'Płynnie, bez przerw między dźwiękami, na jednym oddechu.' },
    { id: 'arpeggio', kind: 'pattern', title: 'Arpeggio', deg: [1, 3, 5, 3, 1], syl: ['no'],
      desc: 'Skoki po dźwiękach akordu — trafiajcie czysto w tercję i kwintę, nie „podjeżdżajcie” do dźwięku.' },
    { id: 'octave', kind: 'pattern', title: 'Oktawa staccato', deg: [1, 3, 5, 8, 5, 3, 1], syl: ['ha'], staccato: true,
      desc: 'Krótko, z przepony — „ha” jak przy śmiechu. Górny dźwięk lekko, bez pchania.' },
    { id: 'diction', kind: 'pattern', title: 'Dykcja', deg: [1, 2, 3, 4, 5, 4, 3, 2, 1], syl: ['di', 'ga', 'di', 'ga', 'di', 'ga', 'di', 'ga', 'di'], fast: true,
      desc: 'Szybko i wyraźnie — pracują język i wargi. Jeśli trudno, zwolnijcie tempo.' },
    { id: 'chordbuild', kind: 'chordbuild', title: 'Akord od basu',
      desc: 'Wchodzą kolejno na „a”: bas (pryma), tenor (kwinta), alt (tercja), sopran (oktawa). Słuchajcie się nawzajem — tercję śpiewajcie minimalnie niżej, wtedy akord „brzmi”.' },
    { id: 'amen', kind: 'amen', title: '„Amen”',
      desc: 'Kadencja plagalna IV–I na cztery głosy, na „A-men”. Tenor trzyma wspólny dźwięk, pozostałe głosy przechodzą krokiem.' },
  ];
  const exById = (id) => EXERCISES.find((e) => e.id === id);
  const DEFAULT_PLAN = EXERCISES.map((e) => e.id);

  /* ---------- Stan ---------- */

  const prefs = C.loadPrefs();
  const voice = C.getView().voice;
  const st = {
    notation: prefs.notation === 'H' ? 'H' : 'intl',
    order: [...DEFAULT_PLAN], on: new Set(DEFAULT_PLAN),
    who: voice || 'choir', bpm: 80, reps: 5, dir: 'updown', chord: true, melody: true,
  };
  const SAVE_KEY = 'chordbuilder.warmup';

  function applyParams(p) {
    if (p.get('plan') !== null) {
      const ids = p.get('plan').split('.').filter(exById);
      st.on = new Set(ids);
      st.order = [...ids, ...DEFAULT_PLAN.filter((id) => !ids.includes(id))];
    }
    if (['choir', 'S', 'A', 'T', 'B'].includes(p.get('who'))) st.who = p.get('who');
    if (+p.get('bpm') >= 50 && +p.get('bpm') <= 150) st.bpm = +p.get('bpm');
    if ([3, 5, 7, 9].includes(+p.get('reps'))) st.reps = +p.get('reps');
    if (['up', 'updown'].includes(p.get('dir'))) st.dir = p.get('dir');
    if (p.has('chord')) st.chord = p.get('chord') === '1';
    if (p.has('mel')) st.melody = p.get('mel') === '1';
  }
  const params = () => new URLSearchParams({
    plan: st.order.filter((id) => st.on.has(id)).join('.'), who: st.who, bpm: st.bpm, reps: st.reps, dir: st.dir,
    chord: st.chord ? 1 : 0, mel: st.melody ? 1 : 0,
  });
  function save() {
    const q = params();
    try { localStorage.setItem(SAVE_KEY, q.toString()); } catch (e) { /* ignoruj */ }
    history.replaceState(null, '', '#' + q);
  }

  /* ---------- Pomocnicze ---------- */

  const nn = (n) => T.noteName(n, st.notation);
  const keyNote = (midi) => T.parseNote(KEY_SPELL[T.mod(midi, 12)]);
  const keyLabel = (midi) => (st.notation === 'H' ? T.polishKeyName(keyNote(midi), 'major') : `${nn(keyNote(midi))}-dur`);
  const pitchName = (midi) => { const n = C.noteOfMidi(midi); return nn(n) + C.octaveName(n, midi); };
  // Cały chór: rejestr głosów żeńskich A3–D5 (panowie śpiewają oktawę niżej: A2–D4).
  const range = () => (st.who === 'choir' ? [57, 74] : C.VOICE_RANGES[st.who]);
  const beatSec = () => 60 / st.bpm;
  const sylOf = (ex, i) => ex.syl[ex.syl.length === 1 ? 0 : i];
  const patternText = (ex) => (ex.kind === 'pattern' ? `${ex.deg.join('-')} · ${ex.syl.length === 1 ? ex.syl[0] : ex.syl.slice(0, 5).join('-') + (ex.syl.length > 5 ? '…' : '')}`
    : ex.kind === 'chordbuild' ? 'B → T → A → S · a' : ex.kind === 'amen' ? 'IV – I · A-men' : 'bez dźwięku');

  /** Toniki kolejnych powtórzeń: od dołu zakresu co półton w górę (i z powrotem), tak by wzór mieścił się w zakresie. */
  function keysFor(ex) {
    if (ex.kind === 'chordbuild') return [57, 58, 59, 60].slice(0, Math.min(st.reps, 4));
    if (ex.kind === 'amen') return [58, 59, 60].slice(0, Math.min(st.reps, 3));
    const semis = ex.deg.map((d) => SEMI[d]);
    const lo = Math.min(...semis), hi = Math.max(...semis);
    const [rLo, rHi] = range();
    let reps = st.reps;
    let start = rLo + 3 - lo; // start o tercję małą nad dołem zakresu (dla chóru: C-dur)
    const maxStart = rHi - hi - (reps - 1);
    if (start > maxStart) start = Math.max(rLo - lo, maxStart);
    reps = Math.max(1, Math.min(reps, rHi - hi - start + 1));
    const up = Array.from({ length: reps }, (_, i) => start + i);
    return st.dir === 'updown' ? [...up, ...up.slice(0, -1).reverse()] : up;
  }

  /* ---------- Widok bieżącego ćwiczenia ---------- */

  function showExercise(ex, info) {
    $('now-title').textContent = ex.title;
    const body = $('now-body');
    if (ex.kind === 'text') {
      body.replaceChildren(h('ul', { class: 'wu-points' }, ex.points.map((p) => h('li', {}, p))),
        ...(info.onNext ? [h('button', { type: 'button', class: 'btn', onclick: info.onNext }, 'Dalej ▶')] : []));
      return;
    }
    const keys = info.keys, k = keys[info.idx];
    const upCount = st.dir === 'updown' && ex.kind === 'pattern' ? Math.ceil(keys.length / 2) : keys.length;
    const staff = h('div', { class: 'melody-wrap wu-staff' });
    body.replaceChildren(
      h('p', { class: 'wu-key' }, h('b', {}, keyLabel(k)), ' ',
        h('span', { class: 'muted' }, `· ${info.idx + 1}/${keys.length} · ${info.idx < upCount ? 'w górę' : 'w dół'}`)),
      staff,
      h('p', { class: 'hint' }, ex.desc),
      ...(st.who === 'choir' && ex.kind === 'pattern' ? [h('p', { class: 'hint' }, 'Panowie śpiewają oktawę niżej.')] : []));
    drawStaff(staff, ex, k, info.active);
  }

  function drawStaff(box, ex, k, active) {
    const tonic = keyNote(k);
    if (ex.kind === 'pattern') {
      const sc = T.buildScale(tonic, 'major');
      const cols = ex.deg.map((d) => [{ midi: k + SEMI[d], note: d === 8 ? tonic : sc.notes[d - 1].note, role: d === 1 || d === 8 ? 'root' : null }]);
      I.renderMelody(box, cols, { keySig: T.keySignature(tonic, 'major'), labels: ex.deg.map((_, i) => sylOf(ex, i)), activeCol: active, gap: 40, scale: 1.3,
        onColumn: (i) => Sound.play([cols[i][0].midi]) });
      return;
    }
    const third = T.transpose(tonic, T.parseInterval('3')), fifth = T.transpose(tonic, T.parseInterval('5'));
    if (ex.kind === 'chordbuild') {
      const voices = [
        { midi: k - 12, note: tonic, role: 'root', name: 'B' }, { midi: k - 5, note: fifth, role: 'fifth', name: 'T' },
        { midi: k + 4, note: third, role: 'third', name: 'A' }, { midi: k + 12, note: tonic, role: 'root', name: 'S' },
      ];
      I.renderStaff(box, voices.slice(0, active == null || active < 0 ? 4 : active + 1));
      return;
    }
    // „Amen”: IV → I; tenor trzyma wspólny dźwięk (tonikę), bas schodzi o kwintę.
    const four = T.transpose(tonic, T.parseInterval('4')), six = T.transpose(tonic, T.parseInterval('6'));
    const chords = [
      [{ midi: k - 7, note: four, role: 'root', name: 'B' }, { midi: k, note: tonic, role: 'fifth', name: 'T' },
        { midi: k + 5, note: four, role: 'root', name: 'A' }, { midi: k + 9, note: six, role: 'third', name: 'S' }],
      [{ midi: k - 12, note: tonic, role: 'root', name: 'B' }, { midi: k, note: tonic, role: 'root', name: 'T' },
        { midi: k + 4, note: third, role: 'third', name: 'A' }, { midi: k + 7, note: fifth, role: 'fifth', name: 'S' }],
    ];
    box.classList.add('wu-amen');
    box.replaceChildren(...chords.map((ch, i) => {
      const d = h('div', { class: 'wu-amen-chord' + (active === i ? ' active' : '') });
      I.renderStaff(d, ch);
      return h('div', {}, d, h('p', { class: 'st-cap' }, i ? 'I · „men”' : 'IV · „A-”'));
    }));
  }

  /* ---------- Odtwarzanie ---------- */

  let timers = [];
  let run = null; // { queue: [id], pos }
  const at = (beat, fn) => timers.push(setTimeout(fn, beat * beatSec() * 1000));
  function stopSound() { timers.forEach(clearTimeout); timers = []; }

  function playExercise(ex, onDone) {
    stopSound();
    if (ex.kind === 'text') { showExercise(ex, { onNext: onDone }); return; }
    const keys = keysFor(ex);
    const B = beatSec();
    let b = 0;
    keys.forEach((k, idx) => {
      const show = (active) => () => showExercise(ex, { keys, idx, active });
      if (ex.kind === 'pattern') {
        at(b, show(-1));
        if (st.chord) { at(b, () => Sound.play([k - 12, k, k + 4, k + 7], 'chord', 'piano', 2 * B)); b += 2; }
        ex.deg.forEach((d, i) => {
          const last = i === ex.deg.length - 1;
          const dur = last ? 2 : ex.fast ? 0.5 : 1;
          at(b, () => {
            drawStaff(document.querySelector('.wu-staff'), ex, k, i);
            if (st.melody) Sound.play([k + SEMI[d]], 'chord', 'piano', ex.staccato && !last ? 0.25 * B : dur * B * 0.95);
            else if (!st.chord && i === 0) Sound.play([k - 12, k, k + 4, k + 7], 'chord', 'piano', 2 * B);
          });
          b += dur;
        });
        b += 1; // oddech
      } else if (ex.kind === 'chordbuild') {
        const v = [k - 12, k - 5, k + 4, k + 12];
        at(b, show(0));
        for (let n = 1; n <= 4; n++) {
          at(b, () => { drawStaff(document.querySelector('.wu-staff'), ex, k, n - 1); Sound.play(v.slice(0, n), 'chord', 'piano', (n === 4 ? 4 : 2) * B); });
          b += n === 4 ? 4 : 2;
        }
        b += 1.5;
      } else if (ex.kind === 'amen') {
        at(b, show(0));
        at(b, () => Sound.play([k - 7, k, k + 5, k + 9], 'chord', 'piano', 2 * B));
        b += 2;
        at(b, () => { drawStaff(document.querySelector('.wu-staff'), ex, k, 1); Sound.play([k - 12, k, k + 4, k + 7], 'chord', 'piano', 4 * B); });
        b += 5;
      }
    });
    at(b, onDone);
  }

  function setRunning(on) {
    $('stop').disabled = !on;
    $('skip').disabled = !on;
    $('play-all').disabled = on;
  }
  function startQueue(ids) {
    run = { queue: ids, pos: 0 };
    setRunning(true);
    nextInQueue();
  }
  function nextInQueue() {
    if (!run) return;
    if (run.pos >= run.queue.length) { finish(); return; }
    const ex = exById(run.queue[run.pos++]);
    renderPlan();
    playExercise(ex, nextInQueue);
  }
  function finish() {
    stopSound();
    const wasPlan = run && run.queue.length > 1;
    run = null;
    setRunning(false);
    renderPlan();
    $('now-title').textContent = wasPlan ? 'Koniec rozśpiewki' : 'Rozśpiewka';
    $('now-body').replaceChildren(h('p', { class: 'hint' }, wasPlan ? 'Gotowe — chór jest rozśpiewany. Można zaczynać próbę.' : 'Wybierz kolejne ćwiczenie z planu albo uruchom całą rozśpiewkę.'));
  }

  /* ---------- Plan ---------- */

  function renderPlan() {
    const current = run && run.pos > 0 ? run.queue[run.pos - 1] : null;
    $('plan').replaceChildren(...st.order.map((id, i) => {
      const ex = exById(id);
      const move = (d) => { const j = i + d; if (j < 0 || j >= st.order.length) return; [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; save(); renderPlan(); };
      return h('li', { class: 'wu-item' + (st.on.has(id) ? '' : ' off') + (current === id ? ' playing' : '') },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.on.has(id), onchange: (e) => { if (e.target.checked) st.on.add(id); else st.on.delete(id); save(); renderPlan(); } }),
          h('span', { class: 'wu-title' }, ex.title)),
        h('span', { class: 'wu-pattern mono' }, patternText(ex)),
        h('span', { class: 'wu-btns' },
          h('button', { type: 'button', class: 'btn small', title: 'Zagraj tylko to ćwiczenie', onclick: () => startQueue([id]) }, '▶'),
          h('button', { type: 'button', class: 'btn ghost small', title: 'Wyżej w planie', 'aria-label': 'Wyżej w planie', disabled: i === 0, onclick: () => move(-1) }, '↑'),
          h('button', { type: 'button', class: 'btn ghost small', title: 'Niżej w planie', 'aria-label': 'Niżej w planie', disabled: i === st.order.length - 1, onclick: () => move(1) }, '↓')));
    }));
  }

  function renderSettings() {
    $('who').replaceChildren(new Option('cały chór', 'choir', false, st.who === 'choir'), ...C.VOICES.map(([id, l]) => new Option(l, id, false, st.who === id)));
    $('bpm').value = st.bpm;
    $('bpm-val').textContent = st.bpm;
    $('reps').value = String(st.reps);
    $('dir').value = st.dir;
    $('chord').checked = st.chord;
    $('melody').checked = st.melody;
    const [lo, hi] = range();
    $('who-hint').textContent = st.who === 'choir'
      ? `Strona gra w rejestrze głosów żeńskich (${pitchName(lo)}–${pitchName(hi)}); panowie śpiewają oktawę niżej (${pitchName(lo - 12)}–${pitchName(hi - 12)}).`
      : `Zakres głosu: ${pitchName(lo)}–${pitchName(hi)}. Strona gra w tym rejestrze.`;
  }

  function bind() {
    const set = (k, v) => { st[k] = v; save(); renderSettings(); };
    $('who').addEventListener('change', (e) => set('who', e.target.value));
    $('bpm').addEventListener('input', (e) => set('bpm', +e.target.value));
    $('reps').addEventListener('change', (e) => set('reps', +e.target.value));
    $('dir').addEventListener('change', (e) => set('dir', e.target.value));
    $('chord').addEventListener('change', (e) => set('chord', e.target.checked));
    $('melody').addEventListener('change', (e) => set('melody', e.target.checked));
    $('play-all').addEventListener('click', () => {
      const ids = st.order.filter((id) => st.on.has(id));
      if (ids.length) startQueue(ids);
    });
    $('stop').addEventListener('click', finish);
    $('skip').addEventListener('click', () => { stopSound(); nextInQueue(); });
    $('share').addEventListener('click', () => {
      save();
      const url = location.href;
      const done = () => { $('share').textContent = '✓ Skopiowano link'; setTimeout(() => { $('share').textContent = '🔗 Link do planu'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Link do planu:', url));
      else prompt('Link do planu:', url);
    });
    $('reset').addEventListener('click', () => { st.order = [...DEFAULT_PLAN]; st.on = new Set(DEFAULT_PLAN); save(); renderPlan(); });
    C.seg($('notation'), st.notation, (v) => { st.notation = v; C.savePref('notation', v); renderSettings(); });
  }

  // Kolejność: zapisany plan, potem parametry z linku (mają pierwszeństwo).
  try { const saved = localStorage.getItem(SAVE_KEY); if (saved) applyParams(new URLSearchParams(saved)); } catch (e) { /* ignoruj */ }
  if (location.hash.length > 1) applyParams(new URLSearchParams(location.hash.slice(1)));
  bind();
  renderSettings();
  renderPlan();
  save();
  window.Common.registerSW();
})();
