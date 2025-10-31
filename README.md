Interaktywny Kalkulator Funkcji — wykresy 2D/3D, całki i analiza (Plotly, JS)
 
Wizualizuj funkcje w trybach kartezjańskim, parametrycznym, biegunowym oraz 3D. Licz całki oznaczone, długość krzywej, pola w biegunowych i obszar między krzywymi. Aplikacja działa płynnie na komputerze i telefonie — cięższe obliczenia są wykonywane w Web Workerze, więc UI pozostaje responsywny.

Demo (GitHub Pages)
- https://nevillkw.github.io/kalkulator-funkcji/

Najważniejsze funkcje
- Tryby: kartezjański (y=f(x)), parametryczny (x(t), y(t)), biegunowy (r(t)), 3D (z=f(x,y))
- Analiza: zera, ekstrema, przecięcia, punkty przegięcia (2D)
- Całki i pola: całka oznaczona z cieniowaniem, długość krzywej (parametryczny), pole obszaru (biegunowy)
- Obszar między krzywymi: automatyczne wyznaczanie i cieniowanie dla f₁ i f₂
- π w granicach: wpisuj pi, 2*pi, -pi/2 w całkach i zakresach
- Startowy widok 10×10: domyślnie −5…5 na obu osiach w kartezjańskim
- Mobile UX: fullscreen z pływającym przełącznikiem, start z minimalnym dockiem (opcjonalnie), sticky nagłówek panelu, resizer “insights”

Technologie
- JavaScript (vanilla) — logika i UI
- Plotly.js — rendering wykresów 2D/3D
- Web Worker — cięższe obliczenia poza głównym wątkiem
- Math.js — parsowanie wyrażeń (w tym π)
- LocalStorage — zapamiętywanie preferencji
- CSS — responsywny layout, fullscreen mobile

Kulisy i wyzwania
- Wydajność 3D i analizy: przeniesienie obliczeń do Web Workera, kontrola rozdzielczości, debouncing wejść
- Ergonomia na telefonie: pływający toggle panelu, zminimalizowany dock, sticky nagłówek, mniejszy dock w fullscreenie
- Czytelne starty bez trygonometrii: proste presety (np. x^3−3x), π w granicach

Struktura katalogu
- index.html — UI i meta (SEO/OG)
- style.css — stylowanie, responsywność
- script.js — logika, rysowanie, analiza, Web Worker
- calculator-worker.js — obliczenia w tle

Jak uruchomić lokalnie
1. Pobierz repozytorium (Clone/Download ZIP)
2. Otwórz index.html w przeglądarce
	- Tip: dla poprawnego działania niektórych przeglądarek uruchom prosty serwer HTTP (np. Python `python -m http.server` lub VS Code Live Server)

Publikacja na GitHub Pages
1. W ustawieniach repo (Settings → Pages) wybierz Source: Deploy from a branch
2. Branch: `main`, folder `/ (root)` i Zapisz
3. Strona będzie dostępna pod adresem: https://<twoj-user>.github.io/<nazwa-repo>/ (dla tego repo: https://nevillkw.github.io/kalkulator-funkcji/)

Kontrybucje
Chętnie przyjmę zgłoszenia błędów i propozycje funkcji. Otwórz Issue, a jeśli chcesz wysłać PR — opisz krótko zmianę i dołącz zrzut ekranu/animację, jeśli to UI.

Bezpieczeństwo
Jeśli znajdziesz podatność, skorzystaj z sekcji Security Advisories lub zgłoś przez Issues (oznaczając jako “security”).

Licencja
MIT — szczegóły w pliku LICENSE.
