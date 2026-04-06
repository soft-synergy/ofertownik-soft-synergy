# Claude <-> Ofertownik API

Ten dokument opisuje, jak Claude ma komunikowac sie z Ofertownikiem przez API.

## Cel integracji

Claude ma miec dostep do:

- odczytu projektow
- pelnego zarzadzania taskami
- odczytu listy pracownikow, aby przypisywac taski do konkretnych osob

Klucz **nie daje uprawnien do edycji projektow**. Projektami mozna tylko czytac.

## Bazowy adres API

Produkcja:

```text
https://oferty.soft-synergy.com
```

Wszystkie endpointy sa pod prefiksem:

```text
/api
```

## Autoryzacja

Claude powinien uzywac stalego klucza API przekazywanego w naglowku:

```http
X-API-Key: <CLAUDE_API_KEY>
```

Klucz jest zapisany lokalnie w pliku `.env` jako:

```text
CLAUDE_API_KEY=...
```

Do integracji przypisany jest techniczny uzytkownik:

```text
CLAUDE_API_USER_EMAIL=claude-api@soft-synergy.local
```

Dostepne scope dla tego klucza:

```text
tasks:read,tasks:write,projects:read,users:read
```

## Zasady pracy Claude

Claude powinien:

- zawsze wysylac `Content-Type: application/json`
- zawsze wysylac `X-API-Key`
- przed przypisaniem taska pobrac liste uzytkownikow z `/api/auth/users`
- przy operacjach na taskach operowac na `_id`
- przy odczycie projektow traktowac API jako read-only
- przy bledzie `401` uznac, ze klucz jest niepoprawny albo nie zostal wyslany
- przy bledzie `403` uznac, ze operacja wykracza poza scope klucza

## Najwazniejsze endpointy

### 1. Lista uzytkownikow

Pobranie pracownikow potrzebnych do przypisywania taskow.

```http
GET /api/auth/users
```

Przyklad:

```bash
curl -H "X-API-Key: $CLAUDE_API_KEY" \
  https://oferty.soft-synergy.com/api/auth/users
```

Typowa odpowiedz:

```json
[
  {
    "_id": "67f123...",
    "firstName": "Jan",
    "lastName": "Kowalski",
    "fullName": "Jan Kowalski",
    "email": "jan@soft-synergy.com",
    "role": "employee",
    "avatar": null
  }
]
```

### 2. Lista projektow

```http
GET /api/projects
```

Obslugiwane query params:

- `page`
- `limit`
- `status`
- `search`
- `offerType`
- `owner`

Przyklad:

```bash
curl -H "X-API-Key: $CLAUDE_API_KEY" \
  "https://oferty.soft-synergy.com/api/projects?limit=50&status=active"
```

Typowa odpowiedz:

```json
{
  "projects": [],
  "totalPages": 1,
  "currentPage": 1,
  "total": 0
}
```

### 3. Szczegoly projektu

```http
GET /api/projects/:id
```

Przyklad:

```bash
curl -H "X-API-Key: $CLAUDE_API_KEY" \
  https://oferty.soft-synergy.com/api/projects/PROJECT_ID
```

Projekt zawiera m.in.:

- dane klienta
- status
- pricing
- notes
- followUps
- teamMembers
- changelog

## Taski

### 4. Lista taskow

```http
GET /api/tasks
```

Obslugiwane query params:

- `assignee`
- `project`
- `publicOrder`
- `status`
- `priority`
- `dateFrom`
- `dateTo`
- `limit`
- `includeTemplates`

Uwagi:

- `assignee=me` filtruje po aktualnym uzytkowniku integracyjnym
- domyslnie ukryte sa taski szablonow cyklicznych

Przyklad:

```bash
curl -H "X-API-Key: $CLAUDE_API_KEY" \
  "https://oferty.soft-synergy.com/api/tasks?status=todo&limit=100"
```

### 5. Szczegoly taska

```http
GET /api/tasks/:id
```

Zwraca task z `updates`, `assignees`, `watchers`, `project`, `createdBy`.

### 6. Tworzenie taska

```http
POST /api/tasks
Content-Type: application/json
```

Minimalny payload:

```json
{
  "title": "Przygotowac brief",
  "dueDate": "2026-04-07T09:00:00.000Z"
}
```

Pelny przyklad:

```json
{
  "title": "Przygotowac brief dla klienta",
  "description": "Zebrac wymagania i dopisac pytania otwarte",
  "status": "todo",
  "priority": "high",
  "assignee": "USER_ID",
  "assignees": ["USER_ID"],
  "watchers": ["USER_ID"],
  "project": "PROJECT_ID",
  "dueDate": "2026-04-07T09:00:00.000Z",
  "dueTimeMinutes": 540,
  "durationMinutes": 60
}
```

Wazne pola:

- `title` i `dueDate` sa wymagane
- `status`: `todo`, `in_progress`, `done`, `cancelled`
- `priority`: `low`, `normal`, `high`, `urgent`
- `assignee` to starsze pole dla kompatybilnosci
- `assignees` to docelowa tablica przypisanych osob
- `watchers` dostaja powiadomienia o zmianach
- `project` opcjonalnie laczy task z projektem

### 7. Edycja taska

```http
PUT /api/tasks/:id
Content-Type: application/json
```

Claude moze zmieniac:

- `title`
- `description`
- `status`
- `priority`
- `assignee`
- `assignees`
- `watchers`
- `project`
- `publicOrder`
- `dueDate`
- `dueTimeMinutes`
- `durationMinutes`

Przyklad zmiany przypisania:

```json
{
  "assignees": ["USER_ID_1", "USER_ID_2"],
  "watchers": ["USER_ID_1"],
  "status": "in_progress"
}
```

### 8. Dodanie update do taska

```http
POST /api/tasks/:id/updates
Content-Type: application/json
```

Payload:

```json
{
  "text": "Kontakt z klientem wykonany, czekamy na materialy."
}
```

### 9. Usuniecie taska

```http
DELETE /api/tasks/:id
```

## Rekomendowany workflow dla Claude

### Odczyt projektow

1. Jesli uzytkownik nie podal ID projektu, najpierw wywolaj `GET /api/projects` z `search`.
2. Po znalezieniu rekordu pobierz `GET /api/projects/:id`.
3. Nie probuj modyfikowac projektu tym kluczem.

### Dodanie taska i przypisanie do osoby

1. Pobierz `GET /api/auth/users`.
2. Znajdz pracownika po `fullName` albo `email`.
3. Utworz task przez `POST /api/tasks`.
4. Jesli trzeba, dodaj komentarz progresu przez `POST /api/tasks/:id/updates`.

### Edycja taska

1. Pobierz aktualny task przez `GET /api/tasks/:id`.
2. Zmien tylko potrzebne pola przez `PUT /api/tasks/:id`.
3. Po zmianie statusu na `done` system moze automatycznie utworzyc kolejny task cykliczny, jesli task byl elementem serii.

## Kody odpowiedzi

- `200` OK
- `201` utworzono
- `400` niepoprawny payload
- `401` brak lub zly klucz
- `403` brak scope
- `404` rekord nie istnieje
- `500` blad serwera

## Szybkie przyklady dla Claude

### Odczyt aktywnych projektow

```bash
curl -H "X-API-Key: $CLAUDE_API_KEY" \
  "https://oferty.soft-synergy.com/api/projects?status=active&limit=20"
```

### Dodanie taska do projektu

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $CLAUDE_API_KEY" \
  -d '{
    "title": "Zadzwonic do klienta",
    "description": "Dopytac o brakujace materialy",
    "priority": "urgent",
    "project": "PROJECT_ID",
    "assignees": ["USER_ID"],
    "watchers": ["USER_ID"],
    "dueDate": "2026-04-07T08:00:00.000Z"
  }' \
  https://oferty.soft-synergy.com/api/tasks
```

### Zmiana statusu taska

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $CLAUDE_API_KEY" \
  -d '{
    "status": "done"
  }' \
  https://oferty.soft-synergy.com/api/tasks/TASK_ID
```

## Ograniczenia tego klucza

Ten klucz ma umozliwiac tylko:

- czytanie projektow
- czytanie uzytkownikow
- tworzenie, edycje, odczyt i usuwanie taskow
- dodawanie update'ow do taskow

Ten klucz nie powinien byc uzywany do:

- logowania przez `/api/auth/login`
- edycji projektow
- usuwania projektow
- zarzadzania pracownikami
