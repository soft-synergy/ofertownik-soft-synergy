# API Usług (Services)

Dokumentacja API do zarządzania usługami: zdjęcie, opis, zakres cenowy, kategoria, status.

**Bazowy URL:** `GET/POST/PUT/DELETE /api/services`  
**Dokumentacja JSON (endpoint):** `GET /api/services/documentation` – zwraca opis endpointów w formacie JSON.

---

## Autentykacja

Endpointy tworzenia, edycji i usuwania wymagają tokena JWT w nagłówku:

```http
Authorization: Bearer <token>
```

Token uzyskujesz z `POST /api/auth/login`. Role: `admin` lub `manager` dla operacji zapisu.

---

## Model usługi (Service)

| Pole        | Typ     | Wymagane | Opis |
|------------|---------|----------|------|
| `name`     | string  | tak      | Nazwa usługi (min. 2 znaki) |
| `description` | string | tak   | Opis (min. 10 znaków) |
| `category` | string  | tak      | `development` \| `consulting` \| `hosting` \| `maintenance` \| `other` |
| `image`    | string  | nie      | Ścieżka do zdjęcia (np. `/uploads/services/plik.jpg`) – ustawiana przez serwer przy uploadzie |
| `priceMin` | number  | nie      | Cena minimalna (zł) |
| `priceMax` | number  | nie      | Cena maksymalna (zł) |
| `priceLabel` | string | nie    | Dowolny tekst ceny (np. „od 500 zł”, „wycena indywidualna”) |
| `isActive` | boolean | nie     | Czy usługa jest aktywna (domyślnie `true`) |
| `order`    | number  | nie      | Kolejność wyświetlania (ustawiana przez serwer) |
| `createdBy`| ObjectId | tak    | ID użytkownika (ustawiane przez serwer) |
| `createdAt`, `updatedAt` | Date | – | Timestampy (automatyczne) |

---

## Endpointy

### 1. Pobierz listę usług

```http
GET /api/services
```

**Autentykacja:** nie  
**Query (opcjonalne):**

| Parametr   | Opis |
|------------|------|
| `category` | Filtruj po kategorii: `development`, `consulting`, `hosting`, `maintenance`, `other` |
| `active`   | `true` / `false` – tylko aktywne / nieaktywne |

**Odpowiedź (200):** tablica obiektów usług z `createdBy` (firstName, lastName).

---

### 2. Pobierz jedną usługę

```http
GET /api/services/:id
```

**Autentykacja:** nie  
**Odpowiedź (200):** obiekt usługi.  
**Błędy:** 404 – usługa nie znaleziona.

---

### 3. Utwórz usługę

```http
POST /api/services
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Autentykacja:** tak (admin / manager).

**Body (form-data):**

| Pole        | Typ    | Wymagane | Opis |
|------------|--------|----------|------|
| `name`     | string | tak      | Nazwa usługi |
| `description` | string | tak   | Opis |
| `category` | string | tak      | Kategoria (enum jak wyżej) |
| `image`    | file   | nie*     | Obraz (jpeg, jpg, png, webp, max 10 MB) – *wymagane przy tworzeniu, jeśli chcesz zdjęcie |
| `priceMin` | number | nie      | Cena min (zł) |
| `priceMax` | number | nie      | Cena max (zł) |
| `priceLabel` | string | nie    | Tekst ceny |
| `isActive` | boolean | nie     | Domyślnie `true` |

**Odpowiedź (201):**

```json
{
  "message": "Usługa została utworzona",
  "service": { ... }
}
```

**Błędy:** 400 – walidacja (np. za krótka nazwa/opis, zły format pliku), 401/403 – brak uprawnień.

---

### 4. Aktualizuj usługę

```http
PUT /api/services/:id
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Autentykacja:** tak (admin / manager).  
Wszystkie pola jak przy `POST` – opcjonalne; brak pola = bez zmiany.  
Nowy plik w `image` nadpisuje poprzedni.

**Odpowiedź (200):**

```json
{
  "message": "Usługa została zaktualizowana",
  "service": { ... }
}
```

**Błędy:** 404 – brak usługi, 400 – błąd walidacji.

---

### 5. Usuń usługę

```http
DELETE /api/services/:id
Authorization: Bearer <token>
```

**Autentykacja:** tak (admin / manager).  
**Odpowiedź (200):** `{ "message": "Usługa została usunięta" }`.  
**Błędy:** 404 – usługa nie znaleziona.

---

### 6. Zmień kolejność usług (batch)

```http
PUT /api/services/order/batch
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**

```json
{
  "updates": [
    { "id": "<id_uslugi_1>", "order": 0 },
    { "id": "<id_uslugi_2>", "order": 1 }
  ]
}
```

**Odpowiedź (200):** `{ "message": "Kolejność usług zaktualizowana", "services": [ ... ] }`.

---

### 7. Przełącz status aktywności

```http
PATCH /api/services/:id/toggle
Authorization: Bearer <token>
```

**Autentykacja:** tak (admin / manager).  
Odwraca wartość `isActive`.

**Odpowiedź (200):** `{ "message": "Usługa aktywowana" | "Usługa dezaktywowana", "service": { ... } }`.

---

## Dokumentacja w formacie JSON

```http
GET /api/services/documentation
```

Zwraca obiekt z listą endpointów, wymaganiami (auth, role), opisem body i kodami błędów – przydatne do generowania klientów API lub narzędzi.

---

## Obsługa zdjęć

- Zapisywane w katalogu `uploads/services/`.
- Serwer udostępnia je pod ścieżką: `/uploads/services/<nazwa_pliku>`.
- Dozwolone typy: jpeg, jpg, png, webp; maks. rozmiar: 10 MB.
- W odpowiedzi API pole `image` zawiera pełną ścieżkę, np. `/uploads/services/image-1234567890.jpg`. Po stronie frontu należy dopiąć bazowy URL API, jeśli zdjęcia serwowane są z innej domeny.

---

## Kody błędów

| Kod | Znaczenie |
|-----|-----------|
| 400 | Bad Request – nieprawidłowe dane lub plik |
| 401 | Unauthorized – brak lub nieprawidłowy token |
| 403 | Forbidden – brak uprawnień (rola) |
| 404 | Not Found – usługa nie znaleziona |
| 500 | Internal Server Error |
