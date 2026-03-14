# Wielojęzyczność (PL/EN) – Usługi i Portfolio

Krótki opis zmian w API umożliwiających integrację języków z frontem.

---

## 1. Parametr zapytania `lang`

Dla **odczytu** (GET) list i pojedynczych zasobów możesz przekazać parametr `lang`:

- **`lang=pl`** – odpowiedź zawiera pola w języku polskim (`name`, `title`, `description`, `priceLabel`, `results`).
- **`lang=en`** – odpowiedź zawiera te same pola w języku angielskim.
- **Brak `lang`** – odpowiedź zwraca **surowe** pola w obu językach: `namePl`, `nameEn`, `descriptionPl`, `descriptionEn` itd. (przydatne w panelu do edycji).

---

## 2. Usługi (Services)

### GET

- **`GET /api/services?lang=pl`** lub **`GET /api/services?lang=en`**  
  Każdy element tablicy ma: `name`, `description`, `priceLabel` (oraz pozostałe pola bez zmian). Wartości pochodzą z wersji PL lub EN.
- **`GET /api/services`** (bez `lang`)  
  Każdy element ma: `namePl`, `nameEn`, `descriptionPl`, `descriptionEn`, `priceLabelPl`, `priceLabelEn` (oraz legacy `name`, `description`, `priceLabel`, jeśli istnieją).

- **`GET /api/services/:id?lang=pl`** (lub `?lang=en`)  
  Jedna usługa z polami `name`, `description`, `priceLabel` w wybranym języku.
- **`GET /api/services/:id`** (bez `lang`)  
  Pełny obiekt z polami `namePl`, `nameEn`, `descriptionPl`, `descriptionEn`, `priceLabelPl`, `priceLabelEn` – do formularza edycji.

### POST / PUT

Body (np. `multipart/form-data`) może zawierać:

- **Wersje językowe:**  
  `namePl`, `nameEn`, `descriptionPl`, `descriptionEn`, `priceLabelPl`, `priceLabelEn`
- **Wymaganie:** co najmniej jedna para nazwy (np. `namePl` lub `nameEn`, min. 2 znaki) i co najmniej jedna para opisu (min. 10 znaków).

Stare pola `name`, `description`, `priceLabel` nadal są akceptowane; jeśli podasz tylko je, serwer uzupełni odpowiednio `namePl`/`nameEn` itd. (kompatybilność wsteczna).

---

## 3. Portfolio

### GET

- **`GET /api/portfolio?lang=pl`** lub **`GET /api/portfolio?lang=en`**  
  Każdy element: `title`, `description`, `results` w wybranym języku.
- **`GET /api/portfolio`** (bez `lang`)  
  Surowe: `titlePl`, `titleEn`, `descriptionPl`, `descriptionEn`, `resultsPl`, `resultsEn` (oraz legacy `title`, `description`, `results`).

- **`GET /api/portfolio/:id?lang=pl`** (lub `?lang=en`)  
  Jedna pozycja z `title`, `description`, `results` w danym języku.
- **`GET /api/portfolio/:id`** (bez `lang`)  
  Pełny obiekt z polami PL/EN – do edycji.

### POST / PUT

Body może zawierać:

- **Wersje językowe:**  
  `titlePl`, `titleEn`, `descriptionPl`, `descriptionEn`, `resultsPl`, `resultsEn`
- **Wymaganie:** co najmniej jeden tytuł (PL lub EN, min. 3 znaki) i co najmniej jeden opis (min. 10 znaków).

Legacy `title`, `description`, `results` są nadal obsługiwane; serwer uzupełni brakujące `*Pl`/`*En`.

---

## 4. Integracja z frontem

1. **Język UI**  
   Ustal aktualny język użytkownika (np. z `useI18n().lang` lub zapisanego w `localStorage`).

2. **Listy (karty, listy usług/portfolio)**  
   Wywołuj:
   - `GET /api/services?lang=pl` lub `?lang=en` (plus ewentualne `category`, `active`),
   - `GET /api/portfolio?lang=pl` lub `?lang=en`.  
   Używaj w odpowiedzi pól `name`/`title`, `description`, `priceLabel`/`results` – są już w wybranym języku.

3. **Formularze edycji (admin)**  
   Wywołuj:
   - `GET /api/services/:id` i `GET /api/portfolio/:id` **bez** `lang`,  
   żeby otrzymać `namePl`, `nameEn`, `descriptionPl`, `descriptionEn` itd. i wypełnić pola PL/EN w formularzu.

4. **Zapisy (POST/PUT)**  
   Wysyłaj z formularza pola w obu językach, np. `namePl`, `nameEn`, `descriptionPl`, `descriptionEn`, `priceLabelPl`, `priceLabelEn` (services) oraz `titlePl`, `titleEn`, `descriptionPl`, `descriptionEn`, `resultsPl`, `resultsEn` (portfolio).

5. **Oferty / inne widoki publiczne**  
   Jeśli generujesz ofertę w konkretnym języku, pobierz portfolio (i ewentualnie usługi) z parametrem `lang=pl` lub `lang=en`, aby w szablonie mieć od razu `title`, `description`, `results` w tym języku.

---

## 5. Podsumowanie

| Endpoint | Z `lang=pl` lub `lang=en` | Bez `lang` |
|----------|---------------------------|------------|
| GET /api/services, GET /api/services/:id | `name`, `description`, `priceLabel` w jednym języku | `namePl`, `nameEn`, `descriptionPl`, `descriptionEn`, `priceLabelPl`, `priceLabelEn` |
| GET /api/portfolio, GET /api/portfolio/:id | `title`, `description`, `results` w jednym języku | `titlePl`, `titleEn`, `descriptionPl`, `descriptionEn`, `resultsPl`, `resultsEn` |

Do wyświetlania treści w jednym języku używaj `?lang=pl` lub `?lang=en`. Do edycji w panelu pobieraj bez `lang` i wysyłaj z powrotem pola `*Pl` i `*En`.
