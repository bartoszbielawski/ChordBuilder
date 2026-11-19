/*
 * ChordBuilder — syntezator Web Audio (bez plików z próbkami).
 * Pianino: kilka lekko nieharmonicznych składowych, szybki atak, zanik zależny od wysokości.
 * Gitara: synteza Karplusa–Stronga (model drgającej struny), generowana raz na wysokość i zapamiętywana.
 * Kliknięcia metronomu: krótki szum filtrowany.
 */
(function (global) {
  'use strict';
  let ctx = null, master = null;
  const pluckCache = new Map();

  function ensure() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /** Pianino: składowe z lekką nieharmonicznością (struny fortepianu są sztywne). */
  function piano(midi, when, dur, vol) {
    const f0 = freq(midi);
    const g = ctx.createGain();
    // Wyższe dźwięki gasną szybciej.
    const decay = Math.max(0.6, Math.min(dur, 3.2 - (midi - 48) * 0.035));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.45, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f0 * 9), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, f0 * 2), when + decay);
    g.connect(lp).connect(master);
    const B = 0.0004; // współczynnik nieharmoniczności
    [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5, 0.05], [6, 0.03]].forEach(([n, amp]) => {
      const f = f0 * n * Math.sqrt(1 + B * n * n);
      if (f > 12000) return;
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      // Wyższe składowe gasną szybciej niż podstawowa.
      og.gain.setValueAtTime(amp, when);
      og.gain.exponentialRampToValueAtTime(amp * 0.05 + 0.0001, when + decay / n);
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + decay + 0.05);
    });
  }

  /** Gitara: Karplus–Strong — szum przepuszczany przez linię opóźniającą z uśrednianiem. */
  function pluckBuffer(midi, seconds) {
    const key = midi + ':' + seconds;
    if (pluckCache.has(key)) return pluckCache.get(key);
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const period = sr / freq(midi);
    const N = Math.max(2, Math.round(period));
    const line = new Float32Array(N);
    // Pobudzenie: szum lekko wygładzony (miękkie szarpnięcie).
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.5 + r * 0.5; line[i] = prev; }
    const damp = 0.996 - Math.max(0, midi - 52) * 0.0004;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % N;
      const v = line[idx];
      out[i] = v;
      line[idx] = damp * 0.5 * (v + line[next]);
      idx = next;
    }
    pluckCache.set(key, buf);
    return buf;
  }

  function guitar(midi, when, dur, vol) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(midi, Math.min(3, Math.max(1, dur)));
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 1.6, when);
    g.gain.setValueAtTime(vol * 1.6, when + Math.max(0.05, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const body = ctx.createBiquadFilter(); // „pudło” gitary
    body.type = 'peaking';
    body.frequency.value = 220;
    body.gain.value = 5;
    body.Q.value = 1;
    src.connect(body).connect(g).connect(master);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  /** Kliknięcie metronomu (wysokie midi = akcent). */
  function click(midi, when) {
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq(midi);
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = midi >= 96 ? 1.6 : 1.0;
    src.connect(bp).connect(g).connect(master);
    src.start(when);
  }

  /** mode: 'chord' | 'arp' | 'strum' | 'click' */
  function play(midis, mode = 'chord', timbre = 'piano', dur) {
    if (!ensure() || !midis.length) return;
    const now = ctx.currentTime + 0.03;
    if (mode === 'click' || (dur !== undefined && dur <= 0.1 && midis.every((m) => m >= 84))) {
      midis.forEach((m) => click(m, now));
      return;
    }
    const vol = 0.5 / Math.sqrt(midis.length);
    const step = mode === 'arp' ? 0.28 : mode === 'strum' ? 0.035 : 0;
    const seq = mode === 'arp' ? [...midis, ...midis.slice(0, -1).reverse()] : midis;
    const voice = timbre === 'guitar' ? guitar : piano;
    seq.forEach((m, i) => voice(m, now + i * step, dur || (mode === 'arp' ? 1.4 : 2.6), mode === 'arp' ? 0.35 : vol));
  }

  global.Sound = { play };
})(window);
