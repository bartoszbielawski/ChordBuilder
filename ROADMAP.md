# ChordBuilder — plan rozwoju

Wersja 1.0 (gotowa): skale i tryby, akordy diatoniczne, konstruktor akordów
z przewrotami, nazwy interwałów i półtony, pianino, gryf gitary z wyszukiwaniem
chwytów, dźwięk, notacja A B C / A H C, stan w URL.

Wersja 1.1 (gotowa): nazwy wszystkich klawiszy i pozycji na gryfie,
rozpoznawanie akordu wklikanego na pianinie lub gryfie (punkt 2.1).

Poniżej propozycje rozszerzeń, pogrupowane w etapy od najbardziej przydatnych
i najtańszych w realizacji.

## Etap 2 — rozumienie harmonii (największa wartość edukacyjna)

| # | Funkcja | Opis | Nakład |
|---|---|---|---|
| 2.1 | ~~**Rozpoznawanie akordu**~~ ✓ | Klikasz klawisze lub progi → strona mówi, jaki to akord (z przewrotem, np. „C/E”). Odwrotność obecnego widoku. | M |
| 2.2 | **Funkcje harmoniczne** | Przy akordach diatonicznych: T, S, D, Tp, Sp, Dp…, oraz kolorowanie wg funkcji. | S |
| 2.3 | **Koło kwintowe** | Interaktywne koło: wybór toniki, pokazanie tonacji pokrewnych, liczby znaków przykluczowych i akordów diatonicznych. | M |
| 2.4 | **Progresje akordów** | Gotowe schematy (I–V–vi–IV, ii–V–I, 12-taktowy blues, kadencja andaluzyjska) w wybranej tonacji, z odtwarzaniem i chwytami. Własna progresja z klocków. | M |
| 2.5 | **Akordy zapożyczone i wtrącone dominanty** | Np. ♭VI, ♭VII, iv w dur; V/V, V/vi — z oznaczeniem, skąd pochodzą. | M |
| 2.6 | **Porównanie trybów** | Tabela 7 trybów od tej samej toniki z zaznaczonymi „charakterystycznymi” dźwiękami (np. ♯4 w lidyjskim). | S |

## Etap 3 — gitara i pianino na poważnie

| # | Funkcja | Opis | Nakład |
|---|---|---|---|
| 3.1 | **Pozycje skali na gryfie** | System CAGED i 3-nuty-na-strunę, przełączanie pozycji. | M |
| 3.2 | **Kształty CAGED dla akordów** | Pokazanie, z którego kształtu (C, A, G, E, D) pochodzi chwyt. | M |
| 3.3 | **Gitara leworęczna, odwrócony gryf, więcej progów** | Ustawienia widoku. | S |
| 3.4 | **Inne instrumenty strunowe** | Ukulele (GCEA), gitara basowa, mandolina, gitara 7-strunowa, własny strój. | S |
| 3.5 | **Wybór wariantu chwytu** | Filtry: tylko otwarte / tylko barré / drop 2 / drop 3 / określone struny. | M |
| 3.6 | **Układy pianistyczne** | Close / open / drop 2, układy lewa+prawa ręka, rootless voicings (jazz), prowadzenie głosów między akordami. | L |

## Etap 4 — ćwiczenia i słuch

| # | Funkcja | Opis | Nakład |
|---|---|---|---|
| 4.1 | **Quiz: zbuduj akord** | „Zaznacz dźwięki Am7” — sprawdzanie na pianinie/gryfie. | M |
| 4.2 | **Kształcenie słuchu** | Rozpoznawanie interwałów i rodzajów akordów ze słuchu, statystyki postępów. | M |
| 4.3 | **Lepsze brzmienie** | Próbki pianina i gitary (np. Salamander Piano, licencja CC) zamiast syntezatora. | S |
| 4.4 | **Wejście MIDI** | Web MIDI: zagraj akord na klawiaturze → rozpoznanie i podświetlenie. | M |

## Etap 5 — wygoda i zasięg

| # | Funkcja | Opis | Nakład |
|---|---|---|---|
| 5.1 | **Wersja angielska** | Przełącznik PL/EN (teksty w jednym słowniku). | S |
| 5.2 | **PWA / offline** | Manifest + service worker: instalacja na telefonie, działanie bez sieci. | S |
| 5.3 | **Eksport** | Zapis diagramu chwytu / klawiatury jako PNG lub SVG, wydruk „ściągi” akordów tonacji. | S |
| 5.4 | **Pięciolinia** | Akord zapisany nutami (np. biblioteka VexFlow). | M |
| 5.5 | **Testy i CI** | Testy jednostkowe teorii (pisownia, interwały, chwyty) + GitHub Actions. | S |
| 5.6 | **Więcej skal** | Zmniejszona (półton–cały ton), bebop, skale harmoniczna durowa, węgierska, japońskie (hirajōshi, in-sen). | S |

**Nakład:** S — do kilku godzin, M — dzień–dwa, L — więcej.

## Proponowana kolejność

1. **2.2 Funkcje harmoniczne** + **2.6 Porównanie trybów** — szybkie, duża wartość dydaktyczna.
2. ~~**2.1 Rozpoznawanie akordu**~~ — zrobione w wersji 1.1.
3. **2.4 Progresje** + **2.3 Koło kwintowe** — spinają skale i akordy w całość.
4. **5.5 Testy** — zanim logika teorii zacznie się rozrastać.
5. **3.1 / 3.2 CAGED i pozycje skal** — dla gitarzystów.
6. Reszta wg potrzeb (quiz, MIDI, PWA, wersja EN).
