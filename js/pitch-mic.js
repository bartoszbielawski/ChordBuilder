/*
 * ChordBuilder — wysokość śpiewanego dźwięku z mikrofonu (algorytm YIN).
 * Wspólne dla stroika (rozśpiewka) i śpiewania z nutami (fragment). Dźwięk jest analizowany
 * tylko w przeglądarce — nic nie jest nagrywane ani wysyłane.
 */
(function (global) {
  'use strict';

  /** Częstotliwość podstawowa (Hz) fragmentu sygnału albo null (cisza / brak wyraźnej wysokości). */
  function detect(buf, sr) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    // Próg ciszy niski: bez automatycznej regulacji głośności mikrofony (zwłaszcza na Linuksie) dają cichy sygnał.
    if (Math.sqrt(rms / buf.length) < 0.002) return null;
    const W = 1024, minTau = Math.floor(sr / 1100), maxTau = Math.min(Math.floor(sr / 70), buf.length - W - 1);
    const d = new Float32Array(maxTau + 2);
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
      d[tau] = s;
    }
    // Skumulowana, znormalizowana funkcja różnicowa: pierwsze minimum poniżej progu to okres.
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= maxTau + 1; tau++) { run += d[tau]; d[tau] = run ? (d[tau] * tau) / run : 1; }
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (d[t] < 0.15) { while (t + 1 <= maxTau && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 2) return null;
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = 2 * (2 * b - c - a);
    return sr / (den ? tau + (c - a) / den : tau);
  }

  /**
   * Włącza mikrofon. Zwraca { label, read(), close() }; read() → { midi (ułamkowe) | null, rms, db }.
   * Rzuca Error z komunikatem dla użytkownika (po polsku). Wywoływać bezpośrednio po kliknięciu.
   */
  async function open() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Ta przeglądarka nie udostępnia mikrofonu (potrzebna strona https lub localhost).');
    }
    const AC = global.AudioContext || global.webkitAudioContext;
    // Kontekst audio tworzony od razu po kliknięciu — inaczej przeglądarka może go wstrzymać (autoodtwarzanie).
    let ctx = new AC();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      ctx.close();
      throw new Error(e && e.name === 'NotFoundError' ? 'Nie znaleziono mikrofonu — podłącz go albo wybierz w ustawieniach systemu.'
        : e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'Brak dostępu do mikrofonu — zezwól na niego w ustawieniach przeglądarki i spróbuj ponownie.'
          : `Mikrofon jest niedostępny (${(e && e.name) || 'błąd'}). Być może używa go inny program.`);
    }
    let an, buf;
    try {
      let src;
      try {
        src = ctx.createMediaStreamSource(stream);
      } catch (e) {
        // Firefox: mikrofon z inną częstotliwością próbkowania niż kontekst — kontekst z częstotliwością mikrofonu.
        const tr = stream.getAudioTracks()[0];
        const rate = tr && tr.getSettings().sampleRate;
        ctx.close();
        ctx = rate ? new AC({ sampleRate: rate }) : new AC();
        src = ctx.createMediaStreamSource(stream);
      }
      if (ctx.state === 'suspended') await ctx.resume();
      an = ctx.createAnalyser();
      an.fftSize = 4096;
      buf = new Float32Array(an.fftSize);
      src.connect(an);
      // Analizator podłączony do wyjścia przez wyciszenie — niektóre przeglądarki nie przetwarzają „wiszących” węzłów.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      an.connect(mute).connect(ctx.destination);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      throw new Error(`Nie udało się uruchomić analizy dźwięku (${(e && e.message) || e}).`);
    }
    const track = stream.getAudioTracks()[0];
    return {
      label: track && track.label ? track.label : '',
      read() {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const f = detect(buf, ctx.sampleRate);
        let midi = f ? 69 + 12 * Math.log2(f / 440) : null;
        if (midi != null && (midi < 28 || midi > 96)) midi = null;
        return { midi, rms, db: rms > 0 ? 20 * Math.log10(rms) : -100 };
      },
      close() { stream.getTracks().forEach((t) => t.stop()); ctx.close(); },
    };
  }

  /** Szerokość paska poziomu (0–100 %) dla poziomu w dBFS: −60 dB → 0, 0 dB → 100. */
  const levelPct = (db) => Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

  global.PitchMic = { detect, open, levelPct, QUIET_RMS: 0.002 };
})(typeof window !== 'undefined' ? window : globalThis);
