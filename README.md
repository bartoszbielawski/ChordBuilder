# ChordBuilder

Interaktywna strona pokazująca, **jak zbudowane są akordy** w różnych skalach:
które dźwięki wchodzą do akordu, jakie są między nimi interwały (nazwy i liczba
półtonów) oraz jak akord wygląda na **pianinie** i **gitarze**.

Oprócz strony głównej są działy do nauki teorii: **Interwały**,
**Modusy**, **Ćwiczenia** (kształcenie słuchu i quizy) oraz **Słowniczek**.

Strona jest w pełni statyczna (HTML + CSS + JavaScript, bez frameworków i bez
kroku budowania), więc działa od razu na GitHub Pages.

## Co potrafi

### Działy do nauki

- **Interwały** (`intervals.html`): kalkulator — dwa dźwięki (lub dźwięk +
  interwał) → nazwa (np. „seksta mała”, skróty 6m / m6), liczba półtonów i tonów,
  konsonans/dysonans z wyjaśnieniem, przewrót (reguła 9 i 12), interwały złożone,
  odpowiedniki enharmoniczne; zapis nutowy, klawiatura z policzonymi półtonami,
  odsłuch melodyczny i harmoniczny. Tabela wszystkich interwałów od wybranego
  dźwięku i zasady nazywania krok po kroku.
- **Modusy** (`modes.html`): siedem modusów od wspólnej toniki — od lidyjskiego
  (najjaśniejszego) do lokryckiego, z dźwiękami obniżanymi kolejno wg koła kwintowego,
  dźwiękiem charakterystycznym i akordem tonicznym; odsłuch na tle burdonu toniki.
  Modusy względne jednej tonacji (te same dźwięki, inny początek) z zapisem nutowym
  i układem półtonów.
- **Ćwiczenia** (`quiz.html`): 15 rodzajów ćwiczeń w 3 poziomach trudności —
  ze słuchu: interwały, akordy, skale/modusy, stopnie skali na tle kadencji,
  progresje akordów i dyktando melodyczne (zapis stopniami); czytanie nut (klucz wiolinowy i basowy),
  znaki przykluczowe (dur i moll), nazywanie interwałów i akordów z nut, budowanie
  akordów z poprawną pisownią, akordy na stopniach tonacji, a na instrumentach:
  zaznaczanie akordu i skali na klawiaturze oraz szukanie dźwięków na gryfie. Każda odpowiedź ma
  wyjaśnienie z zapisem nutowym; elementy, w których się mylisz, wracają częściej;
  statystyki zapisują się w przeglądarce; obsługa klawiaturą (1–9, spacja, Enter).
- **Słowniczek** (`glossary.html`): ponad 50 pojęć (akord, tryton, tonacja
  równoległa, kadencja, przewrót…) z krótkimi definicjami, wyszukiwarką
  i odnośnikami do miejsc na stronie, gdzie można je zobaczyć i usłyszeć.
- **Karta ćwiczeń do druku** (`worksheet.html`) dla nauczycieli: wybierasz rodzaje
  zadań (czytanie nut, znaki przykluczowe, interwały i akordy z nut, budowa akordów,
  akordy w tonacji), poziom i liczbę — strona losuje zestaw z miejscem na odpowiedź
  (lub odpowiedziami do wyboru) i kluczem odpowiedzi na osobnej stronie. Każde
  losowanie daje inną wersję.

### Strona główna

- **Skale i tryby:** durowa, molowe (naturalna, harmoniczna, melodyczna), tryby
  kościelne (dorycki, frygijski, lidyjski, miksolidyjski, lokrycki), frygijska
  dominantowa, pentatoniki, bluesowa, całotonowa — z odległościami w półtonach.
- **Skala na pięciolinii** ze znakami przykluczowymi (dźwięki spoza nich jako
  znaki przygodne), tonacją macierzystą, porównaniem z durową (np. dorycka: ♭3, ♭7),
  dźwiękiem charakterystycznym, nazwami stopni (tonika, supertonika, medianta…)
  i opisem brzmienia; odsłuch skali.
- **Akordy diatoniczne:** trójdźwięki i akordy septymowe na każdym stopniu skali,
  z oznaczeniem rzymskim (I, ii, iii°, V7…).
- **Akordy zapożyczone** z tonacji jednoimiennej (iv, ♭VI, ♭VII… w dur;
  V, IV, tercja pikardyjska w moll).
- **Dominanty wtrącone** (V7/ii, V7/V…): z dźwiękami spoza skali, dźwiękiem
  prowadzącym i odsłuchem rozwiązania.
- **Wszystkie akordy pasujące do skali:** lista akordów zbudowanych wyłącznie
  z dźwięków wybranej skali (sus, 6, add9, 9, 13…).
- **Konstruktor akordów:** dowolna pryma + 30 typów akordów, przewroty.
  Dla każdego dźwięku: stopień, pełna polska nazwa interwału (np. „septyma mała”),
  skrót (m7), liczba półtonów od prymy oraz informacja, czy należy do skali.
- **Budowa krok po kroku:** stos interwałów między kolejnymi dźwiękami
  (np. C +4 tercja wielka → E +3 tercja mała → G).
- **Poprawna pisownia enharmoniczna:** F-dur ma B♭, nie A♯; C♯-dur ma E♯ i B♯.
- **Notacja A B C lub A H C** (polska/niemiecka, gdzie B = B♭).
- **Pianino:** akord w wybranym przewrocie, dźwięki skali zaznaczone kropkami.
- **Gitara:** gryf do 15. progu, kilka strojów, automatycznie wyszukiwane
  grywalne chwyty z diagramami (bas zgodny z przewrotem).
- **Koło kwintowe:** tonacje durowe i równoległe molowe ze znakami przykluczowymi;
  zaznacza wybraną tonację i jej akordy (I, IV, V, ii, iii, vi, vii°), kliknięcie
  zmienia tonację. Dla trybów (np. doryckiego) pokazuje tonację macierzystą.
- **Progresje akordów:** 19 gotowych schematów (pop, kanon, andaluzyjska, ii–V–I,
  12-taktowy blues, kadencje: doskonała, plagalna, zawieszona, zwodnicza,
  z tercją pikardyjską…) w wybranej tonacji, z oznaczeniami rzymskimi,
  odtwarzaniem (tempo, liczba uderzeń, zapętlenie) i pokazywaniem bieżącego
  akordu na pianinie i gryfie. Własne progresje: dodawanie, usuwanie, kopiowanie
  gotowego schematu do edycji, zapis w adresie URL. **Płynne prowadzenie głosów:**
  każdy akord w przewrocie najbliższym poprzedniemu, zapis całej progresji na
  pięciolinii i opis ruchu głosów (wspólne dźwięki, np. „E→F G→A”).
- **Rozpoznawanie akordu („✎ Wklikaj akord”):** wybierz dźwięki na pianinie
  albo na gryfie, a strona poda nazwę akordu (z przewrotem, np. C/E, wariantem
  bez kwinty lub akordem z obcym basem), interwały od basu i pozwoli przejść
  do pełnej budowy akordu.
- **Zapis nutowy:** akord na systemie wiolinowo-basowym (nuty całe, znaki
  chromatyczne, linie dodane), w tej samej oktawie co na pianinie.
- **Ściąga do druku** (`sheet.html`): wszystkie akordy tonacji — trójdźwięki
  i septymowe — z dźwiękami, półtonami, nutami, klawiaturą i chwytem gitarowym.
  Wydruk A4 lub zapis jako PDF z okna drukowania.
- **Działa offline i instaluje się jak aplikacja** (PWA) — na telefonie
  „Dodaj do ekranu głównego”, na komputerze ikona instalacji w pasku adresu.
- **Klawiatura MIDI** (Chrome, Edge, Firefox): zagraj akord na podłączonym
  instrumencie — strona go rozpozna; w ćwiczeniach na klawiaturze można
  odpowiadać, grając.
- **Nazwy wszystkich klawiszy i pozycji na gryfie** (można wyłączyć).
- **Dźwięk:** odtwarzanie akordu, arpeggia, pojedynczych klawiszy i strun
  (Web Audio, bez plików z próbkami).
- **Etykiety** na instrumentach: nazwy dźwięków / interwały / półtony.
- **Link do stanu:** aktualny wybór zapisuje się w adresie URL (`#t=F&s=major&r=Bb&c=maj7…`),
  więc można go wysłać komuś innemu.
- Tryb jasny i ciemny, układ dopasowany do telefonu.

## Uruchomienie lokalne

Wystarczy otworzyć `index.html` w przeglądarce. Wygodniej z lokalnym serwerem:

```bash
python3 -m http.server 8765
```

i wejść na <http://localhost:8765>.

## Publikacja na GitHub Pages

1. Utwórz repozytorium na GitHubie (np. `ChordBuilder`) i wypchnij do niego ten katalog:

   ```bash
   git init
   git add .
   git commit -m "ChordBuilder: pierwsza wersja"
   git branch -M main
   git remote add origin git@github.com:<twoj-login>/ChordBuilder.git
   git push -u origin main
   ```

2. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   gałąź `main`, katalog `/ (root)`.
3. Po minucie strona będzie pod adresem `https://<twoj-login>.github.io/ChordBuilder/`.

Plik `.nojekyll` wyłącza przetwarzanie przez Jekyll (strona jest serwowana bez zmian).

## Testy

Testy logiki teorii muzyki (pisownia skal, interwały, akordy, rozpoznawanie,
chwyty gitarowe, progresje) są w `tests/theory.test.js`:

- w przeglądarce: otwórz `tests/index.html` (np. <http://localhost:8765/tests/>),
- w Node: `node tests/run-node.js`,
- na macOS bez Node można użyć wbudowanego JavaScriptCore (`jsc`).

GitHub Actions (`.github/workflows/test.yml`) uruchamia je przy każdym pushu
i pull requeście.

## Tryb offline (service worker)

`sw.js` zapisuje pliki strony w pamięci przeglądarki. Gdy jest sieć, zawsze
pobiera świeże pliki (wszystkie z tego samego wdrożenia), a bez sieci serwuje
kopię z pamięci. Po instalacji nowej wersji service workera strona przeładowuje
się raz. Przy zmianie listy plików podbij `VERSION` w `sw.js`. Do pracy lokalnej
można go wyłączyć: w konsoli `localStorage.setItem('chordbuilder.nosw', '1')`,
a potem wyrejestrować w narzędziach deweloperskich (Application → Service Workers).

## Struktura

| Plik | Zawartość |
|---|---|
| `index.html` | strona główna: skale, akordy, progresje, instrumenty |
| `intervals.html`, `js/intervals.js` | dział „Interwały” |
| `modes.html`, `js/modes.js` | dział „Modusy” |
| `quiz.html`, `js/quiz.js` | dział „Ćwiczenia” (generatory pytań, statystyki) |
| `worksheet.html`, `js/worksheet.js` | karta ćwiczeń do druku z kluczem odpowiedzi |
| `glossary.html`, `js/glossary.js` | słowniczek pojęć |
| `js/common.js` | wspólne pomocnicze funkcje podstron |
| `sheet.html`, `js/sheet.js`, `css/sheet.css` | ściąga do druku |
| `css/style.css` | wygląd (tokeny kolorów, tryb ciemny, wersja mobilna) |
| `js/theory.js` | teoria muzyki: dźwięki, interwały, skale, akordy, znaki przykluczowe, prowadzenie głosów, wyszukiwanie chwytów gitarowych |
| `js/instruments.js` | rysowanie SVG: klawiatura, gryf, diagram chwytu, pięciolinia (akord i melodia ze znakami przykluczowymi), koło kwintowe |
| `js/audio.js` | prosty syntezator Web Audio |
| `js/app.js` | stan, interfejs, zdarzenia |
| `sw.js`, `manifest.webmanifest`, `icons/` | tryb offline i instalacja (PWA) |
| `tests/` | testy logiki (przeglądarka i Node) |
| `ROADMAP.md` | plan dalszego rozwoju |

### Jak dodać skalę lub akord

W `js/theory.js` skale i akordy są zapisane jako listy interwałów:

```js
{ id: 'dorian', name: 'Dorycka', ints: '1 2 b3 4 5 6 b7' },
['m7b5', 'm7♭5', 'półzmniejszony (ø)', 'seventh', '1 b3 b5 b7'],
```

Wystarczy dopisać nową pozycję — pisownia dźwięków, nazwy interwałów,
pianino, gryf i chwyty wyliczą się automatycznie.
