/*
 * ChordBuilder — zapis i odczyt plików MIDI (Standard MIDI File), bez zależności.
 * write: typ 1 — ścieżka 0 z tempem, metrum i tonacją, potem po jednej ścieżce na głos.
 * read: typ 0 i 1; zwraca nuty z czasem w tickach, tempo, metrum, tonację i nazwy ścieżek.
 * Działa w przeglądarce i w Node (testy).
 */
(function (global) {
  'use strict';

  const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const text = (s) => [...unescape(encodeURIComponent(s))].map((c) => c.charCodeAt(0)); // UTF-8
  const chunk = (id, data) => [...[...id].map((c) => c.charCodeAt(0)), ...u32(data.length), ...data];

  /**
   * opts: { ppq = 480, bpm = 90, time: [licznik, mianownik], key: { sf: −7..7, minor: bool },
   *         tracks: [{ name, channel, program, notes: [{ start, dur, midi, vel }] }] } — czasy w tickach.
   */
  function write(opts) {
    const ppq = opts.ppq || 480;
    const meta = [];
    const us = Math.round(60000000 / (opts.bpm || 90));
    meta.push(0x00, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff);
    if (opts.time) meta.push(0x00, 0xff, 0x58, 0x04, opts.time[0], Math.round(Math.log2(opts.time[1])), 24, 8);
    if (opts.key) meta.push(0x00, 0xff, 0x59, 0x02, opts.key.sf & 0xff, opts.key.minor ? 1 : 0);
    meta.push(0x00, 0xff, 0x2f, 0x00);
    const tracks = [chunk('MTrk', meta)];
    for (const t of opts.tracks) {
      const ch = (t.channel || 0) & 0x0f;
      const name = text(t.name || '');
      const ev = [0x00, 0xff, 0x03, ...vlq(name.length), ...name, 0x00, 0xc0 | ch, (t.program || 0) & 0x7f];
      const raw = [];
      for (const n of t.notes) {
        raw.push({ t: n.start, on: true, m: n.midi, v: n.vel || 80 });
        raw.push({ t: n.start + n.dur, on: false, m: n.midi, v: 0 });
      }
      // W tym samym czasie najpierw wyłączenia, potem włączenia (powtórzony dźwięk się nie urywa).
      raw.sort((a, b) => a.t - b.t || (a.on === b.on ? 0 : a.on ? 1 : -1));
      let last = 0;
      for (const r of raw) { ev.push(...vlq(r.t - last), (r.on ? 0x90 : 0x80) | ch, r.m & 0x7f, r.v & 0x7f); last = r.t; }
      ev.push(0x00, 0xff, 0x2f, 0x00);
      tracks.push(chunk('MTrk', ev));
    }
    const head = chunk('MThd', [0, 1, 0, tracks.length, (ppq >> 8) & 0xff, ppq & 0xff]);
    return new Uint8Array([...head, ...tracks.flat()]);
  }

  /** Odczyt pliku MIDI. Rzuca błąd dla danych, które nie są plikiem MIDI. */
  function read(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let p = 0;
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[p + i]); return s; };
    const num = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[p + i]; p += n; return v; };
    const readVlq = () => { let v = 0, c; do { c = b[p++]; v = v * 128 + (c & 0x7f); } while (c & 0x80 && p < b.length); return v; };
    if (str(4) !== 'MThd') throw new Error('To nie jest plik MIDI.');
    p += 4;
    const hlen = num(4);
    const start = p;
    const format = num(2), ntrk = num(2), div = num(2);
    if (div & 0x8000) throw new Error('Pliki MIDI z czasem SMPTE nie są obsługiwane.');
    p = start + hlen;
    const out = { format, ppq: div, bpm: null, time: null, key: null, tracks: [] };
    for (let ti = 0; ti < ntrk && p < b.length; ti++) {
      const id = str(4); p += 4;
      const len = num(4);
      const end = Math.min(b.length, p + len);
      if (id !== 'MTrk') { p = end; continue; }
      const track = { name: '', notes: [], channels: new Set() };
      const open = new Map(); // (kanał, wysokość) → [nuta, …]
      let t = 0, status = 0;
      while (p < end) {
        t += readVlq();
        let s = b[p];
        if (s & 0x80) { p++; status = s; } else s = status; // running status
        if (s === 0xff) {
          const type = b[p++]; const l = readVlq(); const d = b.subarray(p, p + l); p += l;
          if (type === 0x03 && !track.name) track.name = decodeURIComponent(escape(String.fromCharCode(...d)));
          else if (type === 0x51 && out.bpm == null && l === 3) out.bpm = 60000000 / ((d[0] << 16) | (d[1] << 8) | d[2]);
          else if (type === 0x58 && !out.time && l >= 2) out.time = [d[0], 2 ** d[1]];
          else if (type === 0x59 && !out.key && l === 2) out.key = { sf: d[0] > 127 ? d[0] - 256 : d[0], minor: d[1] === 1 };
          if (type === 0x2f) break;
          continue;
        }
        if (s === 0xf0 || s === 0xf7) { const l = readVlq(); p += l; continue; }
        const hi = s & 0xf0, ch = s & 0x0f;
        if (hi === 0xc0 || hi === 0xd0) { p += 1; continue; }
        const d1 = b[p++], d2 = b[p++];
        if (hi === 0x90 && d2 > 0) {
          const n = { start: t, dur: 0, midi: d1, vel: d2, channel: ch };
          const k = ch * 128 + d1;
          if (!open.has(k)) open.set(k, []);
          open.get(k).push(n);
          track.notes.push(n);
          track.channels.add(ch);
        } else if (hi === 0x80 || hi === 0x90) {
          const q = open.get(ch * 128 + d1);
          if (q && q.length) { const n = q.shift(); n.dur = t - n.start; }
        }
      }
      for (const q of open.values()) for (const n of q) if (!n.dur) n.dur = Math.max(1, t - n.start);
      track.notes = track.notes.filter((n) => n.dur > 0);
      p = end;
      out.tracks.push(track);
    }
    return out;
  }

  global.MidiIO = { write, read };
})(typeof window !== 'undefined' ? window : globalThis);
