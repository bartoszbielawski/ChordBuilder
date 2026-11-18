/*
 * ChordBuilder — prosty syntezator Web Audio (bez próbek).
 */
(function (global) {
  'use strict';
  let ctx = null, master = null;

  function ensure() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function voice(midi, when, dur, vol, timbre) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, when + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(timbre === 'guitar' ? 3200 : 5000, when);
    lp.frequency.exponentialRampToValueAtTime(900, when + dur);
    g.connect(lp).connect(master);

    const partials = timbre === 'guitar' ? [[1, 'sawtooth', 0.35], [2, 'triangle', 0.25]] : [[1, 'triangle', 0.7], [2, 'sine', 0.2], [3, 'sine', 0.06]];
    for (const [mult, type, amp] of partials) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = freq(midi) * mult;
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  /** mode: 'chord' | 'arp' | 'strum' */
  function play(midis, mode = 'chord', timbre = 'piano') {
    if (!ensure() || !midis.length) return;
    const now = ctx.currentTime + 0.03;
    const vol = 0.5 / Math.sqrt(midis.length);
    const step = mode === 'arp' ? 0.28 : mode === 'strum' ? 0.035 : 0;
    const seq = mode === 'arp' ? [...midis, ...midis.slice(0, -1).reverse()] : midis;
    seq.forEach((m, i) => voice(m, now + i * step, mode === 'arp' ? 1.4 : 2.6, mode === 'arp' ? 0.35 : vol, timbre));
  }

  global.Sound = { play };
})(window);
