/*
 * ChordBuilder — „Ścieżka nauki”: lekcje w kolejności, z odnośnikami i postępem z ćwiczeń.
 */
(function () {
  'use strict';
  const { h, loadJSON } = window.Common;
  const $ = (id) => document.getElementById(id);

  // [tytuł, opis, [[etykieta, adres]], [id ćwiczeń do zaliczenia]]
  const LESSONS = [
    ['Dźwięki, klawiatura i półtony', 'Siedem nazw dźwięków (C D E F G A H), oktawy, półton i cały ton. Czarne klawisze to dźwięki z krzyżykiem lub bemolem.',
      [['Klawiatura z nazwami', './#t=C&s=major'], ['Słowniczek: półton', 'glossary.html']], []],
    ['Pięciolinia i klucze', 'Linie i pola, klucz wiolinowy i basowy, linie dodane.',
      [['Słowniczek: klucze', 'glossary.html']], ['read-note']],
    ['Wartości rytmiczne i metrum', 'Nuty i pauzy, kropka przy nucie, takt i metrum (2/4, 3/4, 4/4, 6/8).',
      [['Rytm', 'rhythm.html']], ['rhythm-values', 'rhythm-meter', 'rhythm-ear']],
    ['Interwały', 'Liczba i rodzaj interwału, półtony, przewroty, konsonanse i dysonanse.',
      [['Interwały', 'intervals.html']], ['name-interval', 'ear-interval']],
    ['Skala durowa', 'Budowa 2 2 1 2 2 2 1, stopnie skali i ich nazwy (tonika, dominanta…).',
      [['Skala C-dur', './#t=C&s=major'], ['Skala na klawiaturze', 'quiz.html#ex=piano-scale&lv=0']], ['piano-scale', 'ear-degree']],
    ['Znaki przykluczowe i koło kwintowe', 'Kolejność krzyżyków i bemoli, wyznaczanie tonacji, tonacje równoległe i jednoimienne.',
      [['Koło kwintowe i tabela tonacji', './#t=G&s=major']], ['key-sig', 'key-relations']],
    ['Trójdźwięki', 'Dur, moll, zmniejszony, zwiększony — budowane z tercji.',
      [['Budowa akordu', './#r=C&c=maj']], ['build-chord', 'chord-name', 'ear-chord', 'piano-chord']],
    ['Akordy w tonacji', 'Akordy na stopniach skali, cyfry rzymskie (I, ii, iii, IV, V, vi, vii°).',
      [['Akordy w skali', './#t=C&s=major']], ['diatonic']],
    ['Przewroty i bas cyfrowany', 'Postać zasadnicza, I i II przewrót, oznaczenia 6 i 6/4.',
      [['Przewroty', './#r=C&c=maj&i=1']], ['ear-inversion']],
    ['Kadencje i progresje', 'T–S–D–T, kadencja doskonała, plagalna, zawieszona, zwodnicza; popularne progresje.',
      [['Progresje', './#t=C&s=major&p=perfect']], ['ear-progression']],
    ['Skale molowe', 'Moll naturalny, harmoniczny i melodyczny; tonacja równoległa.',
      [['a-moll', './#t=A&s=minor'], ['moll harmoniczny', './#t=A&s=harmonicMinor']], ['name-scale', 'ear-scale']],
    ['Akordy septymowe', 'D7, maj7, m7, półzmniejszony i zmniejszony; rozwiązanie dominanty.',
      [['Akordy septymowe', './#t=C&s=major&n=4']], []],
    ['Harmonizacja i dźwięki obce', 'Dobór akordów do melodii, dźwięki przejściowe i pomocnicze, prowadzenie głosów.',
      [['Harmonizacja melodii', './#t=C&s=major&m=334554321123322']], ['nct']],
    ['Słuch: melodia', 'Dyktando melodyczne — zapis usłyszanej melodii stopniami skali.',
      [['Ćwiczenie', 'quiz.html#ex=dictation&lv=0']], ['dictation']],
    ['Modusy i akordy zapożyczone', 'Siedem modusów, dźwięki charakterystyczne, mieszanie trybów, dominanty wtrącone.',
      [['Modusy', 'modes.html'], ['Analiza harmoniczna', './#t=C&s=major']], []],
  ];

  const stats = loadJSON('chordbuilder.quiz', {});
  const exTitle = (id) => ((window.QuizExercises || []).find((e) => e.id === id) || { title: id }).title;
  const status = (id) => {
    const s = stats[id];
    if (!s || !s.total) return { done: false, text: 'nie ćwiczone' };
    const pct = Math.round((100 * s.ok) / s.total);
    return { done: s.total >= 10 && pct >= 80, text: `${s.ok}/${s.total} (${pct}%)` };
  };

  let doneCount = 0;
  $('lessons').replaceChildren(...LESSONS.map(([title, desc, links, exs], i) => {
    const st = exs.map(status);
    const done = exs.length > 0 && st.every((x) => x.done);
    if (done) doneCount++;
    return h('li', { class: 'lesson' + (done ? ' done' : '') },
      h('div', { class: 'lesson-num' }, done ? '✓' : String(i + 1)),
      h('div', { class: 'lesson-body' },
        h('h3', {}, title),
        h('p', {}, desc),
        h('div', { class: 'lesson-links' },
          links.map(([l, href]) => h('a', { href }, l + ' →')),
          exs.map((id, k) => h('a', { href: `quiz.html#ex=${id}&lv=0`, class: 'lesson-ex' + (st[k].done ? ' ok' : '') },
            `${st[k].done ? '✓' : '✎'} `, h('span', {}, exTitle(id)), ' · ', h('span', {}, st[k].text))))));
  }));
  const withEx = LESSONS.filter((l) => l[3].length).length;
  $('progress-text').textContent = `Zaliczone lekcje: ${doneCount} z ${withEx} (z ćwiczeniami). Lekcja jest zaliczona, gdy w każdym jej ćwiczeniu masz co najmniej 10 odpowiedzi i 80% poprawnych.`;
  $('progress-bar').style.width = `${(100 * doneCount) / withEx}%`;
  window.Common.registerSW();
})();
