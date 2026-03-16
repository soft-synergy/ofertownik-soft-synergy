# Usprawnienia procesu przetargowego – wygrywaj przetargi jak bułeczki

Krótki przewodnik po tym, co już jest w systemie, oraz pomysły na dalsze usprawnienia, żeby maksymalnie uprościć proces i zwiększyć szanse na wygraną.

---

## Co już mamy w systemie

1. **„Robimy”** – przycisk i zakładka tylko dla zleceń, na które na pewno składamy ofertę. Dzięki temu nie gubisz się w setkach ogłoszeń.
2. **Własny deadline** – możesz ustawić termin (np. ostateczny dzień wysłania oferty) i dostawać przypomnienia mailem.
3. **Update'y / notatki** – historia dopisków przy zleceniu (np. „Wycena gotowa”, „Wysłane”) + powiadomienia mailowe do zespołu.
4. **Załączniki** – trzymanie w jednym miejscu ofert roboczych, dokumentów, wersji PDF.
5. **Zadania tylko do „Robimy”** – przypisujesz taski wyłącznie do zleceń oznaczonych jako Robimy, więc lista zadań nie puchnie o setki pozycji.
6. **Powiadomienia mailowe** – przy zaznaczeniu „Robimy”, przy nowym update'ie oraz codzienne przypomnienia o zbliżającym się terminie (do 3 dni przed). Odbiorcy: `PUBLIC_ORDER_NOTIFY_EMAIL` lub wszyscy admini.

---

## Pomysły na dalsze usprawnienia

### Proces i nawyki

- **Jedna krótka stand-up dla przetargów** – raz w tygodniu 15 min: przegląd zakładki „Robimy”, przypisanie zadań, ustalenie kto co do kiedy.
- **Szablon checklisty z głębokiej analizy** – z kroków AI (required actions / wymagane dokumenty) automatycznie generować listę zadań pod przetarg (np. „Przygotować dokument X”, „Wysłać ofertę do Y”). *Można to zautomatyzować w kolejnej iteracji.*
- **Jedna osoba „owner” przetargu** – pole „Opiekun przetargu” (user) przy zleceniu „Robimy” + powiadomienia tylko do niego albo do niego + zespołu.
- **Status złożenia** – rozszerzenie o pole: „W przygotowaniu” / „Wysłane” / „Wygrane” / „Przegrane”, żeby od razu widać było, gdzie jesteśmy.

### Techniczne (na później)

- **Automatyczne tworzenie zadań z analizy AI** – po głębokiej analizie (Sonnet) zaproponować lub od razu utworzyć zadania z „Kroków do złożenia oferty” i „Wymaganych dokumentów”.
- **Eksport „Robimy” do PDF** – jedna strona z listą aktywnych przetargów, terminami i zadaniami na spotkanie / do wydruku.
- **Widok kanban dla „Robimy”** – kolumny np. Do zrobienia / W toku / Wysłane, przeciąganie zleceń między kolumnami.
- **Integracja kalendarza** – deadline'y „Robimy” jako wydarzenia w kalendarzu (np. Cal.com / Google) albo widok w jednym miejscu z zadaniami.
- **Szablony ofert** – zapisanie wersji „final” oferty jako szablonu do podobnych przetargów (np. jedna szablonowa oferta na „utrzymanie systemu”).

### Współpraca i wygrywanie

- **Retro po przetargu** – po „Wygrane” / „Przegrane” krótka notatka: co pomogło, co można poprawić. Pole „Wnioski” przy zleceniu.
- **Powiadomienie „Oferta wysłana”** – opcjonalny przycisk „Oznacz jako wysłane” + data wysłania + mail do zespołu.
- **Priorytet w liście zadań** – zadania z `publicOrder` mogą mieć domyślnie wyższy priorytet albo filtr „Zadania przetargowe” w widoku Zadań.

---

## Konfiguracja powiadomień

- **PUBLIC_ORDER_NOTIFY_EMAIL** (w `.env`) – adresy e-mail, na które trafiają powiadomienia (Robimy, update, przypomnienie deadline). Wiele adresów oddziel przecinkami. Jeśli puste – maile dostają wszyscy aktywni użytkownicy z rolą admin.
- Przypomnienia o terminie uruchamiane są raz na 24 h (cron); sprawdzane są zlecenia „Robimy” z `customDeadline` w ciągu najbliższych 3 dni.

---

*Dokument można rozbudować o kolejne pomysły po testach w zespole.*
