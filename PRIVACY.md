# Polityka prywatności — AI Organizer 360

**Ostatnia aktualizacja: 30 sierpnia 2026**
**Wydawca: Marek Zettel - zetmar**

## Krótko

AI Organizer 360 przechowuje wszystkie Twoje dane wyłącznie na Twoim komputerze. Aplikacja nie ma
konta użytkownika, nie zbiera telemetrii, nie wyświetla reklam i nie wysyła nigdzie danych — z jednym
wyjątkiem, który opisujemy niżej i który włączasz samodzielnie.

## Jakie dane przetwarza aplikacja

Wszystko, co sam wprowadzisz albo wskażesz: wydarzenia kalendarza, zadania, notatki, projekty,
transakcje finansowe, rozmowy z asystentem AI, dokumenty dodane do bazy wiedzy oraz ścieżki i nazwy
plików wskazanych w modułach Dokumenty, Muzyka, E-booki i Zdjęcia.

Dane trafiają do jednego pliku bazy SQLite na Twoim dysku:

- wydanie z Microsoft Store: `%APPDATA%\ai-organizer-360-store\data\organizer.db`
  (Windows dodatkowo przekierowuje ten katalog do kontenera pakietu),
- wydanie instalowane z pliku: `%APPDATA%\ai-organizer-360\data\organizer.db`.

Aplikacja **odczytuje** wskazane przez Ciebie pliki, żeby zbudować indeks biblioteki albo bazę wiedzy.
Nie kopiuje ich, nie przenosi ani nie modyfikuje.

## Kiedy dane opuszczają komputer

Nigdy — dopóki nie włączysz trybu chmurowego.

Aplikacja ma dwa silniki AI, które przełączasz w Ustawieniach:

**Ollama (tryb domyślny, lokalny).** Model działa na Twoim komputerze. Żadne zapytanie ani fragment
dokumentu nie opuszcza urządzenia. Aplikacja łączy się wyłącznie z adresem lokalnym
(domyślnie `http://localhost:11434`).

**OpenRouter (tryb chmurowy, opcjonalny).** Po wpisaniu własnego klucza API i przełączeniu silnika
treść Twoich zapytań — a przy włączonej opcji „Odpowiadaj na podstawie moich dokumentów" także
fragmenty wskazanych dokumentów — jest wysyłana do serwisu OpenRouter w celu wygenerowania
odpowiedzi. Obowiązuje wtedy polityka prywatności OpenRouter: https://openrouter.ai/privacy

Aktywny tryb widać na każdym ekranie: kolor akcentu interfejsu jest ciepły (ochra) dla modelu
lokalnego i chłodny (stalowy) dla chmury.

## Klucz API

Klucz OpenRouter jest szyfrowany mechanizmem Windows DPAPI (`safeStorage`) kluczem Twojego konta
Windows i przechowywany w lokalnej bazie. Nie jest nigdzie przesyłany poza wywołania do samego
OpenRouter i nie da się go odczytać z interfejsu aplikacji po zapisaniu.

## Czego aplikacja nie robi

- nie zakłada kont i nie wymaga logowania,
- nie zbiera telemetrii, statystyk użycia ani raportów awarii,
- nie wyświetla reklam i nie korzysta z sieci reklamowych,
- nie udostępnia danych stronom trzecim,
- nie łączy się z żadnym serwerem wydawcy.

## Kopie zapasowe

Kopię zapasową tworzysz ręcznie (Ustawienia → Kopia zapasowa). Powstaje jeden plik `.db` w miejscu,
które sam wskażesz. Kopie nie są wysyłane do chmury ani nigdzie synchronizowane.

## Usunięcie danych

Odinstalowanie aplikacji usuwa jej katalog danych. Możesz też w każdej chwili usunąć bazę ręcznie —
ścieżkę pokazuje przycisk „Pokaż folder z danymi" w Ustawieniach.

## Dzieci

Aplikacja nie jest kierowana do dzieci i nie zbiera świadomie danych od osób poniżej 13. roku życia.

## Kontakt

Pytania dotyczące prywatności: zetmar@gmail.com

---

# Privacy Policy — AI Organizer 360 (English)

**Last updated: 30 August 2026**
**Publisher: Marek Zettel - zetmar**

## Summary

AI Organizer 360 stores all your data locally on your computer. The app has no user account, collects
no telemetry, shows no ads, and does not transmit your data anywhere — with one exception described
below, which you enable yourself.

## What data the app processes

Everything you enter or point it to: calendar events, tasks, notes, projects, financial transactions,
AI chat conversations, documents added to the knowledge base, and the paths and names of files
indexed in the Documents, Music, E-books and Photos modules.

Data is kept in a single local SQLite file:

- Microsoft Store edition: `%APPDATA%\ai-organizer-360-store\data\organizer.db`
  (Windows additionally redirects this folder into the package container),
- installer edition: `%APPDATA%\ai-organizer-360\data\organizer.db`.

The app **reads** the files you select in order to build a library index or knowledge base. It does
not copy, move or modify them.

## When data leaves your computer

Never — unless you enable cloud mode.

The app has two AI engines, switched in Settings:

**Ollama (default, local).** The model runs on your computer. No query or document fragment leaves the
device. The app only connects to a local address (`http://localhost:11434` by default).

**OpenRouter (optional, cloud).** After you enter your own API key and switch the engine, the content
of your queries — and, when "Answer from my documents" is enabled, fragments of the selected
documents — is sent to the OpenRouter service to generate a response. OpenRouter's privacy policy
then applies: https://openrouter.ai/privacy

The active mode is visible on every screen: the interface accent colour is warm (ochre) for the local
model and cool (steel) for the cloud.

## API key

The OpenRouter key is encrypted with Windows DPAPI (`safeStorage`) using your Windows account key and
stored in the local database. It is never transmitted anywhere except to OpenRouter itself, and it
cannot be read back from the app interface once saved.

## What the app does not do

- no accounts, no sign-in,
- no telemetry, usage analytics or crash reporting,
- no advertising and no ad networks,
- no data sharing with third parties,
- no connection to any publisher server.

## Backups

Backups are created manually (Settings → Backup). The result is a single `.db` file in a location you
choose. Backups are not uploaded or synchronised anywhere.

## Deleting your data

Uninstalling the app removes its data folder. You can also delete the database manually at any time —
the "Show data folder" button in Settings reveals its location.

## Children

The app is not directed at children and does not knowingly collect data from anyone under 13.

## Contact

Privacy questions: zetmar@gmail.com
