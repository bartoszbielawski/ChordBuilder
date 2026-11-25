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
      [['Koło kwintowe i tabela tonacji', './#t=G&s=major&lv=2']], ['key-sig', 'key-relations']],
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
      [['Modusy', 'modes.html'], ['Analiza harmoniczna', './#t=C&s=major&lv=3']], []],
  ];

  // Ścieżka dla chóru (amatorski chór, cztery głosy z nut, z akompaniamentem).
  const CHOIR_LESSONS = [
    ['Partytura chóralna', 'Cztery głosy na dwóch pięcioliniach: sopran i alt w kluczu wiolinowym (sopran ma laseczki w górę, alt w dół), tenor i bas w basowym. W partyturze z osobną pięciolinią dla każdego głosu tenor śpiewa z klucza wiolinowego z ósemką pod spodem — oktawę niżej, niż wygląda. Akompaniament ma własne dwie pięciolinie.',
      [['Słowniczek: partytura chóralna', 'glossary.html'], ['Słowniczek: klucze', 'glossary.html']], []],
    ['Czytanie nut w swoim kluczu', 'Linie i pola w kluczu Twojego głosu, linie dodane nad i pod pięciolinią. Ćwiczenie pokazuje dźwięki z zakresu wybranego głosu.',
      [['Ćwiczenie: czytanie nut', 'quiz.html#ex=read-note&lv=0']], ['read-note']],
    ['Rytm i metrum', 'Wartości nut i pauz, kropka przy nucie, metrum 3/4 i 4/4 (najczęstsze w pieśniach) oraz alla breve (2/2). Licz miary razem z metronomem.',
      [['Rytm', 'rhythm.html']], ['rhythm-values', 'rhythm-meter', 'rhythm-ear']],
    ['Oznaczenia w nutach', 'Dynamika (p, mf, f, „widełki”), tempo i jego zmiany (rit., fermata), łuki, oddech, repetycje i skoki (volty, D.C., D.S., coda) — żeby nie zgubić się w nutach.',
      [['Słowniczek: dynamika', 'glossary.html'], ['Słowniczek: repetycja i volty', 'glossary.html']], ['marks']],
    ['W jakiej tonacji śpiewamy?', 'Znaki przykluczowe wyznaczają tonację; tonika to „do” — punkt, do którego melodia wraca. Ćwicz rozpoznawanie stopni po kadencji.',
      [['Skala i tonacja', './#t=G&s=major']], ['key-sig', 'ear-degree']],
    ['Interwały ze słuchu', 'Najpierw tercja, kwarta, kwinta i oktawa, potem sekundy i seksty — w górę i w dół. Pomaga trafiać w dźwięk po skoku w swojej linii.',
      [['Interwały', 'intervals.html']], ['ear-interval']],
    ['Dyktando melodyczne', 'Usłyszana krótka melodia zapisana stopniami skali (do re mi…). Ćwiczy pamięć melodii i czyste śpiewanie od toniki.',
      [['Ćwiczenie', 'quiz.html#ex=dictation&lv=0']], ['dictation']],
    ['Trójdźwięk i strojenie', 'Akord to pryma, tercja i kwinta — każdy głos śpiewa jeden z tych dźwięków (czasem dwa głosy ten sam). Tercję akordu durowego śpiewa się minimalnie niżej niż na fortepianie, a dźwięk prowadzący — raczej wyżej; wtedy akord „brzmi”.',
      [['Budowa akordu', './#r=C&c=maj'], ['Przewroty', './#r=C&c=maj&i=1']], ['ear-chord', 'ear-inversion']],
    ['Kadencje — zakończenia fraz', 'Doskonała (V–I) to „kropka” na końcu zwrotki, plagalna (IV–I) — „amen”, zawieszona (na V) — „przecinek” w środku. Słuchaj, czy fraza się kończy, czy prowadzi dalej.',
      [['Kadencja doskonała', './#t=C&s=major&p=perfect'], ['Plagalna („amen”)', './#t=C&s=major&p=plagal'], ['Zawieszona', './#t=C&s=major&p=half']], []],
  ];

  const stats = loadJSON('chordbuilder.quiz', {});
  const exTitle = (id) => ((window.QuizExercises || []).find((e) => e.id === id) || { title: id }).title;
  const status = (id) => {
    const s = stats[id];
    if (!s || !s.total) return { done: false, text: 'nie ćwiczone' };
    const pct = Math.round((100 * s.ok) / s.total);
    return { done: s.total >= 10 && pct >= 80, text: `${s.ok}/${s.total} (${pct}%)` };
  };

  // Wybór ścieżki: #path=choir w adresie, inaczej wg profilu (chór → ścieżka dla chóru).
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('path');
  let path = fromHash === 'choir' || fromHash === 'general' ? fromHash
    : window.Common.getView().profile === 'choir' ? 'choir' : 'general';
  window.Common.seg($('path'), path, (v) => { path = v; history.replaceState(null, '', '#path=' + v); render(); });
  window.addEventListener('hashchange', () => {
    const p = new URLSearchParams(location.hash.slice(1)).get('path');
    if (p === 'choir' || p === 'general') { path = p; render(); }
  });

  function render() {
  const list = path === 'choir' ? CHOIR_LESSONS : LESSONS;
  $('path-intro-choir').hidden = path !== 'choir';
  $('path-intro-general').hidden = path === 'choir';
  for (const b of $('path').querySelectorAll('button[data-value]')) { const on = b.dataset.value === path; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
  let doneCount = 0;
  $('lessons').replaceChildren(...list.map(([title, desc, links, exs], i) => {
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
  const withEx = list.filter((l) => l[3].length).length;
  $('progress-text').textContent = `Zaliczone lekcje: ${doneCount} z ${withEx} (z ćwiczeniami). Lekcja jest zaliczona, gdy w każdym jej ćwiczeniu masz co najmniej 10 odpowiedzi i 80% poprawnych.`;
  $('progress-bar').style.width = `${(100 * doneCount) / withEx}%`;
  }
  render();
  window.Common.registerSW();
})();
