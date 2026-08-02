# AI Organizer 360

Lokalna aplikacja desktopowa dla Windows: organizer (kalendarz, zadania, notatki, projekty, biblioteki plikow,
finanse, statystyki) z wbudowanym czatem AI, baza wiedzy RAG i generatorem dokumentow.

Dwa silniki AI, przelaczane jednym kliknieciem:

- **Ollama** - model uruchamiany lokalnie, zadne dane nie opuszczaja komputera,
- **OpenRouter** - modele w chmurze, wlasny klucz API (szyfrowany Windows DPAPI).

Wszystkie dane sa trzymane lokalnie w jednym pliku SQLite - bez konta, bez abonamentu, bez chmury.

## Gotowe pliki .exe

Po zbudowaniu znajduja sie w katalogu `release/`:

| Plik | Opis |
| --- | --- |
| `AI-Organizer-360-1.0.0-x64.exe` | instalator (NSIS, wybor katalogu, skrot na pulpicie) |
| `AI-Organizer-360-1.0.0-portable.exe` | wersja przenosna, uruchamiana bez instalacji |

Windows SmartScreen pokaze ostrzezenie, bo pliki nie sa podpisane certyfikatem - "Wiecej informacji" -> "Uruchom mimo to".

## Moduly

| Modul | Co robi |
| --- | --- |
| Kalendarz | siatka miesiaca, wydarzenia, powiazanie z projektem, **automatyczne planowanie dnia (AI)** |
| Zadania | priorytety, terminy, projekty, szybkie dodawanie, **inteligentne przypomnienia (AI)** |
| Notatki | edytor Markdown z podgladem, tagi, **podsumowania (AI)**, wysylka do bazy wiedzy |
| Projekty | status, postep zadan, kolor, licznik notatek |
| Dokumenty / Muzyka / E-booki / Zdjecia | skanowanie folderow, wyszukiwanie, **automatyczna kategoryzacja plikow (AI)** |
| Finanse | przychody i wydatki, kategorie, bilans miesieczny |
| Statystyki | KPI, wykresy 30-dniowe, **analiza produktywnosci (AI)** |
| Czat AI | streaming odpowiedzi, historia rozmow, tryb **rozmowy z wlasnymi dokumentami (RAG)** |
| Baza wiedzy | indeksowanie PDF/DOCX/TXT/MD/CSV/HTML, **wyszukiwanie semantyczne** |
| Generator | dokumenty, teksty i e-maile, opcjonalnie na bazie wlasnych dokumentow |
| Eksport | PDF, DOCX, Markdown - z kazdego wyniku AI i z notatek |

## Pierwsze uruchomienie

1. Zainstaluj [Ollame](https://ollama.com) i pobierz modele:
   ```bash
   ollama pull llama3.2:3b
   ```
   ```bash
   ollama pull nomic-embed-text
   ```
2. Uruchom aplikacje - domyslnie dziala w trybie lokalnym (Ollama, `http://localhost:11434`,
   model `llama3.2:3b`). Kazdy inny pobrany model wybierzesz w Ustawieniach z listy.
3. Opcjonalnie: **Ustawienia -> OpenRouter** -> wklej klucz API, zeby korzystac z modeli w chmurze.

`nomic-embed-text` jest uzywany do bazy wiedzy - modele czatowe zwykle nie obsluguja embeddingow
(serwer zwraca wtedy HTTP 501). Kolejnosc awaryjna: model embeddingow -> model czatu -> tryb leksykalny
offline, ktory dziala zawsze, ale mniej trafnie niz embeddingi semantyczne.

## Praca ze zrodlami

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run dist
```

`npm run dist` buduje bundle i pakuje oba pliki `.exe` do `release/`.

## Architektura

```
src/
  main/            proces glowny Electrona (Node)
    db.ts          SQLite (node-sqlite3-wasm) + generyczne CRUD z whitelista kolumn
    settings.ts    ustawienia; klucz API szyfrowany przez safeStorage (DPAPI)
    ai/
      provider.ts  wspolny interfejs LLMProvider - zaden modul nie wola API bezposrednio
      ollama.ts    /api/chat (NDJSON streaming), /api/embed
      openrouter.ts /chat/completions (SSE streaming)
      embeddings.ts embeddingi + awaryjny tryb leksykalny
      tasks.ts     funkcje AI korzystajace z danych z bazy
    rag.ts         chunking, indeksowanie, wyszukiwanie kosinusowe
    extract.ts     ekstrakcja tekstu z PDF (pdfjs), DOCX (mammoth), plikow tekstowych
    library.ts     skanowanie folderow z plikami
    exporter.ts    eksport PDF (printToPDF), DOCX (docx), Markdown
    ipc.ts         wszystkie kanaly IPC
  preload/         kontekstowo izolowany most (contextBridge)
  renderer/        interfejs React
  shared/          typy i parser Markdown wspoldzielone miedzy procesami
```

Bezpieczenstwo: `contextIsolation: true`, `nodeIntegration: false`, CSP w `index.html`, linki zewnetrzne
otwierane w przegladarce systemowej, zapisy do bazy przez whiteliste kolumn.

## Gdzie sa dane

```
%APPDATA%\ai-organizer-360\data\organizer.db
```

Kopia zapasowa = skopiowanie tego pliku. Aplikacja nie wysyla nigdzie danych w trybie Ollama.
W trybie OpenRouter do API trafiaja tresc zapytania i - przy wlaczonym RAG - fragmenty dokumentow.
