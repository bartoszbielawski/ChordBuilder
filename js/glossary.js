/*
 * ChordBuilder — słowniczek pojęć z odnośnikami do odpowiednich miejsc strony.
 */
(function () {
  'use strict';
  const { h } = window.Common;
  const $ = (id) => document.getElementById(id);

  // [hasło, definicja, [[etykieta, adres], …], [synonimy do wyszukiwania]]
  const TERMS = [
    ['akord', 'Co najmniej trzy różne dźwięki brzmiące jednocześnie. W muzyce tonalnej buduje się go zwykle z tercji nałożonych na siebie (np. C–E–G).', [['Budowa akordu', './#c=maj'], ['Ćwiczenie: zbuduj akord', 'quiz.html#ex=build-chord&lv=0']]],
    ['akord dominantowy septymowy (D7, V7)', 'Akord durowy z dodaną septymą małą, np. G7 = G–H–D–F. Zawiera tryton (H–F), który silnie dąży do rozwiązania na tonikę.', [['G7', './#t=C&s=major&r=G&c=7'], ['Kadencja doskonała', './#t=C&s=major&p=perfect']]],
    ['akord półzmniejszony (m7♭5, ø)', 'Trójdźwięk zmniejszony z septymą małą, np. H–D–F–A. Leży na VII stopniu dur i II stopniu moll; w jazzie typowy w molowym ii–V–i.', [['Bm7♭5', './#t=C&s=major&r=B&c=m7b5']]],
    ['akord zapożyczony', 'Akord wzięty z tonacji jednoimiennej (o tej samej tonice, przeciwnym trybie), np. f-moll (iv) w C-dur. Daje „ciemniejszy” kolor bez zmiany tonacji.', [['Akordy zapożyczone w C-dur', './#t=C&s=major&lv=3']]],
    ['akord zawieszony (sus2, sus4)', 'Akord, w którym tercję zastąpiono sekundą (sus2) lub kwartą (sus4). Nie jest ani durowy, ani molowy; sus4 często rozwiązuje się na akord z tercją.', [['Csus4', './#r=C&c=sus4']]],
    ['akord zmniejszony (°)', 'Dwie tercje małe: pryma, tercja mała, kwinta zmniejszona (np. H–D–F). Brzmi napięciowo; leży na VII stopniu skali durowej.', [['B°', './#r=B&c=dim']]],
    ['akord zwiększony (+)', 'Dwie tercje wielkie: pryma, tercja wielka, kwinta zwiększona (np. C–E–G♯). Dzieli oktawę na trzy równe części — brzmi „zawieszony w powietrzu”.', [['C+', './#r=C&c=aug']]],
    ['arpeggio', 'Akord zagrany dźwięk po dźwięku zamiast jednocześnie.', []],
    ['bemol (♭)', 'Znak chromatyczny obniżający dźwięk o półton. Podwójny bemol (𝄫) obniża o cały ton. Po polsku: dźwięk z bemolem ma końcówkę -es (es, as, des…), wyjątek: B = H♭.', [['Kalkulator interwałów', 'intervals.html']], ['es', 'as']],
    ['burdon', 'Długo trzymany, niezmienny dźwięk (zwykle tonika) pod melodią. Na jego tle dobrze słychać charakter modusu.', [['Modusy z burdonem', 'modes.html']]],
    ['cały ton', 'Odległość dwóch półtonów, np. C–D. Sekunda wielka.', [['Interwały', 'intervals.html#lo=C4&hi=D4']]],
    ['dominanta (D, V)', 'V stopień skali i zbudowany na nim akord. Najsilniej dąży do toniki; zawiera dźwięk prowadzący.', [['Kadencja I–IV–V–I', './#t=C&s=major&p=cadence']]],
    ['dominanta wtrącona (V7/x)', 'Akord dominantowy septymowy prowadzący do innego akordu niż tonika, np. A7 → d-moll w C-dur (V7/ii). Zawiera dźwięk spoza skali.', [['Dominanty wtrącone w C-dur', './#t=C&s=major&lv=3']]],
    ['dur', 'Tryb (rodzaj skali/akordu) z tercją wielką od toniki — brzmi jasno. Skala durowa: 2 2 1 2 2 2 1 półtonów.', [['C-dur', './#t=C&s=major']], ['durowy', 'major']],
    ['dysonans', 'Współbrzmienie napięciowe, „chcące” się rozwiązać: sekundy, septymy, tryton i wszystkie interwały zwiększone i zmniejszone.', [['Tabela interwałów', 'intervals.html']]],
    ['dźwięk charakterystyczny', 'Dźwięk, który odróżnia modus od najbliższej skali dur lub moll, np. ♯4 w lidyjskim, wielka seksta w doryckim.', [['Modusy', 'modes.html']]],
    ['dźwięk prowadzący', 'VII stopień skali leżący półton pod toniką (np. H w C-dur). Silnie ciągnie do toniki. Gdy VII stopień leży cały ton niżej, nazywa się subtoniką.', [['Skala C-dur', './#t=C&s=major']]],
    ['enharmonia', 'Ten sam dźwięk (ten sam klawisz) zapisany na dwa sposoby, np. F♯ = G♭, albo ten sam interwał o różnych nazwach (kwarta zwiększona = kwinta zmniejszona).', [['Enharmonia interwałów', 'intervals.html#lo=C4&hi=F%234']]],
    ['funkcje harmoniczne (T, S, D)', 'Rola akordu w tonacji: tonika (spokój), subdominanta (oddalenie), dominanta (napięcie wracające do toniki).', [['Kadencja', './#t=C&s=major&p=cadence']]],
    ['interwał', 'Odległość między dwoma dźwiękami. Nazwa ma liczbę (ile nazw literowych, np. tercja = 3) i rodzaj (czysta, mała, wielka, zwiększona, zmniejszona).', [['Interwały', 'intervals.html'], ['Ćwiczenia', 'quiz.html#ex=name-interval&lv=0']]],
    ['interwał złożony', 'Interwał większy od oktawy, np. nona (sekunda + oktawa), decyma (tercja + oktawa).', [['Nona wielka', 'intervals.html#lo=C4&hi=D5']]],
    ['kadencja', 'Zakończenie frazy harmonicznej: doskonała (V–I), plagalna (IV–I), zawieszona (…–V), zwodnicza (V–vi).', [['Kadencje', './#t=C&s=major&p=perfect']]],
    ['kasownik (♮)', 'Znak odwołujący wcześniejszy krzyżyk lub bemol (także przykluczowy) — przywraca dźwięk naturalny.', []],
    ['klucz basowy (F)', 'Klucz, którego kropki obejmują 4. linię — to dźwięk F (f małe, F3). Linie od dołu: G, H, D, F, A.', [['Ćwiczenie: czytanie nut', 'quiz.html#ex=read-note&lv=0']]],
    ['klucz wiolinowy (G)', 'Klucz zawinięty wokół 2. linii — to dźwięk G (g¹, G4). Linie od dołu: E, G, H, D, F; pola: F, A, C, E.', [['Ćwiczenie: czytanie nut', 'quiz.html#ex=read-note&lv=0']]],
    ['koło kwintowe', 'Tonacje ułożone co kwintę: każda kolejna (w prawo) ma o jeden krzyżyk więcej, w lewo — o jeden bemol więcej.', [['Koło kwintowe', './#t=C&s=major&lv=2']]],
    ['konsonans', 'Współbrzmienie zgodne: doskonałe (pryma, oktawa, kwinta, kwarta) lub niedoskonałe (tercje i seksty).', [['Tabela interwałów', 'intervals.html']]],
    ['krzyżyk (♯)', 'Znak chromatyczny podwyższający dźwięk o półton; podwójny krzyżyk (𝄪) — o cały ton. Po polsku końcówka -is (cis, fis…).', [], ['is', 'fis', 'cis']],
    ['modus (skala modalna)', 'Jedna z siedmiu skal z dźwięków skali durowej zaczynanych od różnych stopni: jońska, dorycka, frygijska, lidyjska, miksolidyjska, eolska, lokrycka.', [['Modusy', 'modes.html'], ['Ćwiczenie ze słuchu', 'quiz.html#ex=ear-scale&lv=2']], ['tryb', 'skale kościelne']],
    ['moll', 'Tryb z tercją małą od toniki — brzmi ciemniej. Skala molowa naturalna: 2 1 2 2 1 2 2 półtonów; są też odmiany harmoniczna i melodyczna.', [['a-moll', './#t=A&s=minor'], ['moll harmoniczny', './#t=A&s=harmonicMinor']], ['molowy', 'minor']],
    ['notacja H (polska/niemiecka)', 'W Polsce i Niemczech dźwięk B nazywa się H, a B oznacza B♭. Przełącznik „A H C” w nagłówku.', []],
    ['oktawa', 'Interwał 12 półtonów — ten sam dźwięk wyżej lub niżej (np. C4–C5).', [['Oktawa', 'intervals.html#lo=C4&hi=C5']]],
    ['oznaczenia rzymskie', 'Akordy opisuje się stopniem skali: wielkie cyfry — akord durowy (I, IV, V), małe — molowy (ii, iii, vi), ° — zmniejszony. Dzięki temu progresja działa w każdej tonacji.', [['Akordy w skali', './#t=C&s=major']]],
    ['pentatonika', 'Skala pięciodźwiękowa bez półtonów: durowa (1 2 3 5 6) i molowa (1 ♭3 4 5 ♭7).', [['Pentatonika molowa', './#t=A&s=minorPentatonic']]],
    ['pięciolinia', 'Pięć poziomych linii, na których (i między którymi — w polach) zapisuje się nuty; wyżej = wyższy dźwięk. Linie dodane przedłużają ją w górę i w dół.', []],
    ['półton', 'Najmniejsza odległość w systemie równomiernie temperowanym — sąsiednie klawisze fortepianu, sąsiednie progi gitary. Zapisuje się go jako sekundę małą (E–F) lub prymę zwiększoną (C–C♯).', [['Interwały', 'intervals.html#lo=E4&hi=F4']]],
    ['progresja akordów', 'Następstwo akordów, np. I–V–vi–IV. Opisywana cyframi rzymskimi, więc można ją przenieść do dowolnej tonacji.', [['Progresje', './#t=C&s=major&p=pop']]],
    ['prowadzenie głosów', 'Sposób przechodzenia dźwięków jednego akordu do następnego: wspólne dźwięki zostają, pozostałe przesuwają się jak najmniej (zwykle o sekundę).', [['Progresja z prowadzeniem głosów', './#t=C&s=major&p=canon']]],
    ['przewrót akordu', 'Akord, w którym w basie nie ma prymy: w I przewrocie w basie jest tercja, w II — kwinta, w III — septyma. Zapis z ukośnikiem: C/E.', [['Przewroty', './#r=C&c=maj&i=1']]],
    ['przewrót interwału', 'Przeniesienie dolnego dźwięku o oktawę w górę. Liczby sumują się do 9, półtony do 12; mała ↔ wielka, zwiększona ↔ zmniejszona, czysta zostaje czystą.', [['Kalkulator interwałów', 'intervals.html']]],
    ['pryma', 'Dźwięk, od którego buduje się akord i który daje mu nazwę (w C-dur — C). Także interwał 0 półtonów (pryma czysta).', []],
    ['septyma', 'Interwał siedmiu nazw literowych: mała (10 półtonów), wielka (11) lub zmniejszona (9 — w akordzie zmniejszonym septymowym °7). Dodana do trójdźwięku tworzy akord septymowy.', [['Akordy septymowe', './#t=C&s=major&n=4']]],
    ['skala', 'Uporządkowany ciąg dźwięków w obrębie oktawy, np. durowa, molowa, pentatonika. Wyznacza materiał dźwiękowy utworu.', [['Skale', './#t=C&s=major']]],
    ['stopień skali', 'Pozycja dźwięku w skali, liczona od toniki: I tonika, II supertonika, III medianta, IV subdominanta, V dominanta, VI submedianta, VII dźwięk prowadzący.', [['Nazwy stopni', './#t=C&s=major']]],
    ['subdominanta (S, IV)', 'IV stopień skali i zbudowany na nim akord. Oddala od toniki, często prowadzi do dominanty.', [['Kadencja plagalna', './#t=C&s=major&p=plagal']]],
    ['tercja', 'Interwał trzech nazw literowych: mała (3 półtony) lub wielka (4). Tercja nad prymą decyduje, czy akord jest durowy, czy molowy.', [['Tercja wielka', 'intervals.html#lo=C4&hi=E4']]],
    ['tercja pikardyjska', 'Zakończenie utworu molowego akordem durowym (z tercją wielką) — zwyczaj renesansowy i barokowy.', [['Przykład', './#t=A&s=minor&p=picardy']]],
    ['tonacja', 'Układ dźwięków i akordów wokół jednego centrum (toniki), np. G-dur. Wyznaczają ją znaki przykluczowe i tonika.', [['Koło kwintowe', './#t=G&s=major&lv=2']]],
    ['tonacja jednoimienna', 'Tonacja o tej samej tonice i przeciwnym trybie, np. C-dur i c-moll (różne znaki przykluczowe).', [['c-moll', './#t=C&s=minor']]],
    ['tonacja równoległa', 'Tonacja o tych samych znakach przykluczowych i przeciwnym trybie: moll leży tercję małą niżej, np. C-dur i a-moll.', [['Koło kwintowe', './#t=C&s=major&lv=2']]],
    ['tonika (T, I)', 'I stopień skali, centrum tonacji, punkt spoczynku. Także akord zbudowany na tym stopniu.', []],
    ['trójdźwięk', 'Akord z trzech dźwięków ułożonych tercjami: durowy, molowy, zmniejszony, zwiększony.', [['Ćwiczenie ze słuchu', 'quiz.html#ex=ear-chord&lv=1']]],
    ['tryton', 'Interwał trzech całych tonów (6 półtonów): kwarta zwiększona lub kwinta zmniejszona. Dzieli oktawę na pół; jeden z najbardziej napięciowych interwałów.', [['Tryton', 'intervals.html#lo=F4&hi=B4']]],
    ['znaki przykluczowe', 'Krzyżyki lub bemole zapisane na początku każdej pięciolinii; obowiązują w całym utworze i wyznaczają tonację. Kolejność krzyżyków: F C G D A E H (fis, cis, gis, dis, ais, eis, his), bemoli: B E A D G C F (b, es, as, des, ges, ces, fes).', [['Ćwiczenie', 'quiz.html#ex=key-sig&lv=0'], ['Skala na pięciolinii', './#t=E&s=major']]],
    ['bas cyfrowany (oznaczenia cyfrowe)', 'Liczby przy basie mówiące, jakie interwały brzmią nad nim: 6 — I przewrót, 6/4 — II przewrót; dla akordów septymowych 7, 6/5, 4/3, 2. Dawny zapis akompaniamentu (basso continuo), dziś podstawa nauki harmonii.', [['Przykład: G7 4/3', './#r=G&c=7&i=2'], ['Przewroty ze słuchu', 'quiz.html#ex=ear-inversion&lv=0']]],
    ['kwinty i oktawy równoległe', 'Dwa głosy idące w tę samą stronę i tworzące kolejno dwie kwinty czyste (lub dwie oktawy). W harmonii klasycznej błąd — głosy tracą samodzielność; w rocku (power chordy) to celowy efekt.', [['Progresje z prowadzeniem głosów', './#t=C&s=major&p=andalusian']]],
    ['metrum', 'Regularny układ akcentów w takcie, zapisany jak ułamek: górna liczba — ile miar, dolna — jaka wartość jest miarą (4/4, 3/4, 6/8). Metrum proste ma jeden akcent mocny (2/4, 3/4, 3/8, 2/2); złożone powstaje z połączenia kilku jednakowych metrów prostych i ma też akcenty półmocne (4/4 = 2 × 2/4, 6/8 = 2 × 3/8, 9/8, 12/8); nieregularne łączy różne (5/4, 7/8).', [['Rytm', 'rhythm.html'], ['Ćwiczenie', 'quiz.html#ex=rhythm-meter&lv=0']]],
    ['takt', 'Odcinek utworu między kreskami taktowymi, mieszczący wartości rytmiczne o łącznej długości wyznaczonej przez metrum.', [['Ułóż takt', 'rhythm.html']]],
    ['kropka przy nucie', 'Wydłuża nutę lub pauzę o połowę jej wartości: półnuta z kropką = 3 ćwierćnuty, ćwierćnuta z kropką = 3 ósemki.', [['Rytm', 'rhythm.html']]],
    ['wartości rytmiczne', 'Długości nut i pauz: cała nuta, półnuta, ćwierćnuta, ósemka, szesnastka — każda dwa razy krótsza od poprzedniej.', [['Rytm', 'rhythm.html'], ['Ćwiczenie', 'quiz.html#ex=rhythm-values&lv=0']]],
    ['transpozycja', 'Przeniesienie utworu lub progresji do innej tonacji o stały interwał — wszystkie relacje (cyfry rzymskie) zostają te same.', [['Analiza i transpozycja', './#t=C&s=major&lv=3']]],
    ['dyktando', 'Ćwiczenie słuchowe: zapisanie usłyszanej melodii (dyktando melodyczne) lub rytmu (rytmiczne).', [['Dyktando melodyczne', 'quiz.html#ex=dictation&lv=0'], ['Dyktando rytmiczne', 'quiz.html#ex=rhythm-ear&lv=0']]],
    ['dźwięki obce (akordowi)', 'Dźwięki melodii spoza akordu: przejściowy (łączy krokami dwa dźwięki akordu), pomocniczy (krok od dźwięku i powrót), a także opóźnienie, antycypacja i inne.', [['Harmonizacja melodii', './#t=C&s=major&m=334554321123322'], ['Ćwiczenie', 'quiz.html#ex=nct&lv=0']]],
    ['harmonizacja', 'Dobranie akordów do melodii: każda (akcentowana) nuta melodii powinna należeć do akordu, a akordy tworzą sensowną progresję (np. kończą się kadencją).', [['Harmonizacja melodii', './#t=C&s=major&m=334554321123322']]],
    ['CAGED', 'System nauki gry na gitarze: każdy akord da się zagrać w pięciu kształtach przeniesionych z otwartych chwytów C, A, G, E, D — razem pokrywają cały gryf.', [['Chwyty G-dur', './#t=G&s=major&r=G&c=maj&lv=2']]],
    ['partytura chóralna (SATB)', 'Zapis czterech głosów chóru: S — sopran, A — alt, T — tenor, B — bas. Na dwóch pięcioliniach sopran i alt stoją w kluczu wiolinowym (sopran laseczki w górę, alt w dół), tenor i bas w basowym. Gdy każdy głos ma własną pięciolinię, tenor śpiewa z klucza wiolinowego z ósemką pod spodem — oktawę niżej, niż wygląda. Akompaniament (organy, fortepian) ma osobne dwie pięciolinie.', [['Ćwiczenie: czytanie nut', 'quiz.html#ex=read-note&lv=0'], ['Ścieżka dla chóru', 'learn.html#path=choir']], ['chór', 'SATB', 'sopran', 'alt', 'tenor', 'bas', 'głosy']],
    ['ciąg kwintowy (progresja po kole)', 'Następstwo akordów, w którym bas schodzi o kwintę (wznosi się o kwartę), np. vi–ii–V–I. Jedna z najsilniejszych progresji w muzyce tonalnej.', [['Progresja', './#t=C&s=major&p=circle']]],
  ];

  // Wersja angielska: hasła i definicje ze słownika i18n-en.js.
  const G = window.I18N && window.I18N.lang === 'en' && window.I18N_EN && window.I18N_EN.glossary;
  const pl = {}; // nazwa wyświetlana (np. angielska) → polskie hasło (klucz rysunku)
  if (G) for (const t of TERMS) if (G[t[0]]) { const k = t[0]; [t[0], t[1]] = G[t[0]]; pl[t[0]] = k; }

  /* ---------- Rysunki do haseł (SVG rysowane przez stronę; kliknięcie — dźwięk) ---------- */

  const T = window.Theory, I = window.Instruments, C = window.Common;
  const notation = C.loadPrefs().notation === 'H' ? 'H' : 'intl';
  const nn = (n) => T.noteName(n, notation);
  /** 'E4' → { midi, note } */
  const N = (s) => { const m = /^([A-G](?:#|b)?)(\d)$/.exec(s); const note = T.parseNote(m[1]); return { midi: C.midiOf(note, +m[2]), note }; };
  const play = (midis, mode = 'chord') => window.Sound && window.Sound.play(midis, mode, 'piano', 1.4);
  const fig = (body, caption) => h('figure', { class: 'gl-fig' }, body, caption ? h('figcaption', {}, caption) : null);

  /** Pięciolinia: kolumny 'C4 E4 G4' (spacja = współbrzmienie); role kolorują pryma/tercja/kwinta. */
  function staffFig(cols, caption, opts = {}) {
    const box = h('div', { class: 'melody-wrap gl-staff' });
    const columns = cols.map((c, i) => c.split(' ').filter(Boolean).map((x, k) => ({ ...N(x), role: opts.roles ? opts.roles[i] && opts.roles[i][k] : null })));
    I.renderMelody(box, columns, { gap: opts.gap || 34, clef: opts.clef, labels: opts.labels, keySig: opts.keySig, scale: 1, minWidth: opts.minWidth,
      onColumn: columns.length ? (i) => play(columns[i].map((n) => n.midi), columns[i].length > 1 ? 'chord' : 'chord') : null,
      ariaLabel: caption });
    return fig(box, caption);
  }
  /** Klawiatura (jedna oktawa od C4) z zaznaczonymi dźwiękami: [['E4', 'root'], …]. */
  function pianoFig(marks, caption, label) {
    const box = h('div', { class: 'gl-piano' });
    const hl = new Map(marks.map(([x, role, lab]) => { const n = N(x); return [n.midi, { label: lab || nn(n.note), role }]; }));
    I.renderPiano(box, { startMidi: 60, octaves: 1, highlights: hl, onKey: (m) => play([m]) });
    return fig(box, caption);
  }
  const R3 = ['root', 'third', 'fifth'];
  const textFig = (rows, caption) => fig(h('div', { class: 'gl-rows' }, rows.map((r) => h('div', { class: 'gl-row' }, r))), caption);

  /** Partytura chóralna: dwie pięciolinie, cztery głosy (S i T laseczki w górę, A i B w dół), kadencja V–I. */
  function satbFig() {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };
    const W = 300, H = 178, L = 34;
    const yT = (st) => 26 + (38 - st) * 5, yB = (st) => 106 + (26 - st) * 5;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'staff melody satb'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Partytura chóralna: sopran i alt w kluczu wiolinowym, tenor i bas w basowym');
    for (const st of [30, 32, 34, 36, 38]) el('line', { x1: L, x2: W - 4, y1: yT(st), y2: yT(st), class: 'st-line' }, svg);
    for (const st of [18, 20, 22, 24, 26]) el('line', { x1: L, x2: W - 4, y1: yB(st), y2: yB(st), class: 'st-line' }, svg);
    el('line', { x1: L, x2: L, y1: yT(38), y2: yB(18), class: 'st-line' }, svg);
    el('line', { x1: L - 6, x2: L - 6, y1: yT(38), y2: yB(18), class: 'st-line satb-bracket' }, svg);
    const t1 = el('text', { x: L + 4, y: yT(32) + 9, class: 'st-clef g' }, svg); t1.textContent = '𝄞';
    const t2 = el('text', { x: L + 4, y: yB(24) + 8, class: 'st-clef f' }, svg); t2.textContent = '𝄢';
    // V → I w C-dur: [krok pięciolinii, MIDI] dla S, A, T, B.
    const chords = [
      { label: 'V', v: [[34, 71], [29, 62], [25, 55], [18, 43]] },
      { label: 'I', v: [[35, 72], [30, 64], [25, 55], [21, 48]] },
    ];
    const VOICE = [['S', 'T', 1, 'role-root'], ['A', 'T', -1, 'role-third'], ['T', 'B', 1, 'role-fifth'], ['B', 'B', -1, 'role-seventh']];
    chords.forEach((c, ci) => {
      const x = 118 + ci * 110;
      const g = el('g', { class: 'st-col clickable' }, svg);
      el('rect', { x: x - 40, y: 0, width: 80, height: H, class: 'st-hit' }, g);
      g.addEventListener('click', () => play(c.v.map((v) => v[1])));
      c.v.forEach(([st, , ], vi) => {
        const [name, staff, dir, cls] = VOICE[vi];
        const y = staff === 'T' ? yT(st) : yB(st);
        if (staff === 'T' && st <= 28) for (let l = 28; l >= st; l -= 2) el('line', { x1: x - 10, x2: x + 10, y1: yT(l), y2: yT(l), class: 'st-line ledger' }, g);
        el('ellipse', { cx: x, cy: y, rx: 6.4, ry: 4.4, transform: `rotate(-22 ${x} ${y})`, class: 'st-head filled ' + cls }, g);
        const sx = dir > 0 ? x + 5.8 : x - 5.8;
        el('line', { x1: sx, x2: sx, y1: y, y2: y - dir * 32, class: 'st-stem ' + cls }, g);
        if (ci === 0) { const tl = el('text', { x: x - 30, y: y + 4, class: 'satb-name ' + cls }, g); tl.textContent = name; }
      });
      const lb = el('text', { x, y: H - 4, class: 'st-label', 'text-anchor': 'middle' }, g); lb.textContent = c.label;
    });
    return fig(h('div', { class: 'melody-wrap gl-staff' }, svg),
      'Kadencja V–I na cztery głosy: sopran (laseczki w górę) i alt (w dół) na pięciolinii z kluczem wiolinowym, tenor (w górę) i bas (w dół) — z basowym. Kliknij akord, aby go usłyszeć.');
  }

  const FIGS = {
    'pięciolinia': () => staffFig(['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'],
      'Nuty na liniach (1–5, liczonych od dołu) i w polach (1–4). Kliknij nutę, aby ją usłyszeć.', { labels: ['1', '2', '3', '4', '5', '1', '2', '3', '4'], clef: 'treble' }),
    'klucz wiolinowy (G)': () => staffFig(['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'],
      'Linie: E G H D F, pola: F A C E. Klucz zawija się wokół 2. linii — dźwięku G.', { clef: 'treble', labels: ['E4', 'G4', 'B4', 'D5', 'F5', 'F4', 'A4', 'C5', 'E5'].map((x) => nn(N(x).note)) }),
    'klucz basowy (F)': () => staffFig(['G2', 'B2', 'D3', 'F3', 'A3', 'A2', 'C3', 'E3', 'G3'],
      'Linie: G H D F A, pola: A C E G. Kropki klucza obejmują 4. linię — dźwięk F.', { clef: 'bass', labels: ['G2', 'B2', 'D3', 'F3', 'A3', 'A2', 'C3', 'E3', 'G3'].map((x) => nn(N(x).note)) }),
    'półton': () => pianoFig([['E4', 'root'], ['F4', 'third']], 'E–F: sąsiednie klawisze, bez klawisza pomiędzy — półton.'),
    'cały ton': () => pianoFig([['C4', 'root'], ['D4', 'third']], 'C–D: między nimi jest jeszcze jeden klawisz (C♯) — cały ton, czyli dwa półtony.'),
    'enharmonia': () => pianoFig([['F#4', 'ext', '♯/♭']], 'Jeden klawisz, dwie nazwy: F♯ = G♭.'),
    'interwał': () => staffFig(['C4', 'E4', 'C4 E4'], 'C–E: trzy nazwy literowe (C, D, E) i cztery półtony — tercja wielka; zagrana po kolei i razem.', { roles: [['root'], ['third'], ['root', 'third']] }),
    'tryton': () => staffFig(['F4', 'B4', 'F4 B4'], 'F–H: trzy całe tony (sześć półtonów) — kwarta zwiększona.', { roles: [['root'], ['ext'], ['root', 'ext']] }),
    'oktawa': () => staffFig(['C4', 'C5', 'C4 C5'], 'C4–C5: ta sama nazwa, osiem stopni wyżej (12 półtonów).', { roles: [['root'], ['root'], ['root', 'root']] }),
    'akord': () => staffFig(['C4 E4 G4'], 'Akord C-dur: pryma C, tercja E, kwinta G — ułożone tercjami.', { roles: [R3], gap: 60, minWidth: 140 }),
    'trójdźwięk': () => staffFig(['C4 E4 G4', 'C4 Eb4 G4', 'C4 Eb4 Gb4', 'C4 E4 G#4'], 'Durowy, molowy, zmniejszony i zwiększony — od tej samej prymy C.', { roles: [R3, R3, R3, R3], gap: 48, labels: ['C', 'Cm', 'C°', 'C+'] }),
    'przewrót akordu': () => staffFig(['C4 E4 G4', 'E4 G4 C5', 'G4 C5 E5'], 'Akord C-dur: postać zasadnicza, I przewrót (tercja w basie), II przewrót (kwinta w basie).', { roles: [R3, ['third', 'fifth', 'root'], ['fifth', 'root', 'third']], gap: 50, labels: ['C', 'C/E', 'C/G'] }),
    'kadencja': () => staffFig(['G4 B4 D5 F5', 'C5 E5 G5'], 'Kadencja doskonała w C-dur: dominanta septymowa (G7) rozwiązuje się na tonikę (C).', { gap: 56, labels: ['V7', 'I'], roles: [['root', 'third', 'fifth', 'seventh'], R3] }),
    'skala': () => staffFig(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], 'Skala C-dur ze stopniami i solmizacją. Kliknij nutę, aby ją usłyszeć.', { labels: ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', 'do'], gap: 30 }),
    'znaki przykluczowe': () => h('div', { class: 'gl-figs' },
      staffFig([], 'Krzyżyki w kolejności: F C G D A E H.', { keySig: T.keySignature(T.parseNote('C#'), 'major'), minWidth: 150 }),
      staffFig([], 'Bemole w kolejności: B E A D G C F.', { keySig: T.keySignature(T.parseNote('Cb'), 'major'), minWidth: 150 })),
    'wartości rytmiczne': () => textFig([
      h('span', { class: 'rh-g big' }, '𝅝'), h('span', { class: 'rh-g big' }, '𝅗𝅥 𝅗𝅥'), h('span', { class: 'rh-g big' }, '𝅘𝅥 𝅘𝅥 𝅘𝅥 𝅘𝅥'), h('span', { class: 'rh-g big' }, '𝅘𝅥𝅮 '.repeat(8).trim()),
    ], 'Cała nuta = 2 półnuty = 4 ćwierćnuty = 8 ósemek.'),
    'kropka przy nucie': () => textFig([h('span', { class: 'rh-g big' }, '𝅗𝅥. = 𝅗𝅥 + 𝅘𝅥'), h('span', { class: 'rh-g big' }, '𝅘𝅥. = 𝅘𝅥 + 𝅘𝅥𝅮')], 'Kropka dodaje połowę wartości nuty.'),
    'metrum': () => textFig([
      h('span', { class: 'gl-meter' }, h('b', {}, '3/4'), ' ', h('span', { class: 'acc2' }, '1'), h('span', {}, '2'), h('span', {}, '3')),
      h('span', { class: 'gl-meter' }, h('b', {}, '4/4'), ' ', h('span', { class: 'acc2' }, '1'), h('span', {}, '2'), h('span', { class: 'acc1' }, '3'), h('span', {}, '4')),
    ], 'Miary w takcie: duża — mocna, średnia — półmocna, mała — słaba.'),
    'partytura chóralna (SATB)': satbFig,
  };

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

  function render() {
    const q = norm($('search').value.trim());
    const list = TERMS.filter(([t, d, , syn]) => !q || norm(t).includes(q) || norm(d).includes(q) || (syn || []).some((s) => norm(s).includes(q)))
      .sort((a, b) => a[0].localeCompare(b[0], G ? 'en' : 'pl'));
    $('count').textContent = `${list.length} ${window.I18N && window.I18N.lang === 'en' ? 'of' : 'z'} ${TERMS.length}`;
    const groups = new Map();
    for (const item of list) {
      const L = item[0][0].toUpperCase();
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(item);
    }
    $('terms').replaceChildren(...[...groups].map(([L, items]) => h('section', { class: 'gl-letter' },
      h('h2', {}, L),
      h('dl', {}, items.flatMap(([t, d, links]) => [
        h('dt', { id: 'g-' + norm(t).replace(/[^a-z0-9]+/g, '-') }, t),
        h('dd', {}, d, links.length ? h('span', { class: 'gl-links' }, links.map(([label, href]) => h('a', { href }, label + ' →'))) : null,
          FIGS[pl[t] || t] ? FIGS[pl[t] || t]() : null),
      ])))));
    if (!list.length) $('terms').append(h('p', { class: 'muted' }, 'Nie znaleziono — spróbuj innego słowa.'));
  }

  $('search').addEventListener('input', render);
  render();
  window.Common.registerSW();
})();
