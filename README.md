# ChordBuilder

Interaktywna strona pokazująca, **jak zbudowane są akordy** w różnych skalach:
które dźwięki wchodzą do akordu, jakie są między nimi interwały (nazwy i liczba
półtonów) oraz jak akord wygląda na **pianinie** i **gitarze**.

Strona jest w pełni statyczna (HTML + CSS + JavaScript, bez frameworków i bez
kroku budowania), więc działa od razu na GitHub Pages.

## Co potrafi

- **Skale i tryby:** durowa, molowe (naturalna, harmoniczna, melodyczna), tryby
  kościelne (dorycki, frygijski, lidyjski, miksolidyjski, lokrycki), frygijska
  dominantowa, pentatoniki, bluesowa, całotonowa — z odległościami w półtonach.
- **Akordy diatoniczne:** trójdźwięki i akordy septymowe na każdym stopniu skali,
  z oznaczeniem rzymskim (I, ii, iii°, V7…).
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

## Struktura

| Plik | Zawartość |
|---|---|
| `index.html` | układ strony |
| `css/style.css` | wygląd (tokeny kolorów, tryb ciemny, wersja mobilna) |
| `js/theory.js` | teoria muzyki: dźwięki, interwały, skale, akordy, wyszukiwanie chwytów gitarowych |
| `js/instruments.js` | rysowanie SVG: klawiatura, gryf, diagram chwytu |
| `js/audio.js` | prosty syntezator Web Audio |
| `js/app.js` | stan, interfejs, zdarzenia |
| `ROADMAP.md` | plan dalszego rozwoju |

### Jak dodać skalę lub akord

W `js/theory.js` skale i akordy są zapisane jako listy interwałów:

```js
{ id: 'dorian', name: 'Dorycka', ints: '1 2 b3 4 5 6 b7' },
['m7b5', 'm7♭5', 'półzmniejszony (ø)', 'seventh', '1 b3 b5 b7'],
```

Wystarczy dopisać nową pozycję — pisownia dźwięków, nazwy interwałów,
pianino, gryf i chwyty wyliczą się automatycznie.
