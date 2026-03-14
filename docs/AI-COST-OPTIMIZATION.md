# Optymalizacja kosztów AI (analiza zleceń publicznych)

## Obecny pipeline (Anthropic)

| Faza | Model | Tokeny (szac.) | Koszt/zlecenie (szac.) |
|------|--------|----------------|------------------------|
| 1. Batch filter | Claude Haiku | ~3–5k in, ~0.5k out (×20 zleceń) | ~\$0.001–0.002 per batch |
| 2. Scoring | Claude Haiku | **~30–35k in** (cały HTML 120k znaków), ~0.2k out | **~\$0.03–0.04** |
| 3. Deep analysis | Claude Sonnet | ~35k in, ~2–3k out | **~\$0.10–0.15** |

**Główny koszt:** wysyłanie pełnego HTML (~120k znaków ≈ 30k tokenów) przy **każdym** scoringu i deep analysis. Sonnet jest drogi (input \$3/1M, output \$15/1M).

Ceny (per 1M tokenów, przybliżone):
- **Claude Haiku:** \$1 in / \$5 out  
- **Claude Sonnet:** \$3 in / \$15 out  
- **GPT-4o-mini (OpenAI):** \$0.15 in / \$0.60 out  
- **Gemini 1.5 Flash (Google):** \$0.075–0.35 in / \$0.30–1.05 out  

---

## Strategie obniżenia kosztów (z zachowaniem jakości)

### 1. Nie wysyłać HTML do scoringu (najszybszy zysk)

- **Obecnie:** do scoringu leci cała strona HTML (120k znaków).
- **Propozycja:** scoring tylko na tekście: **Opis + Wymagania + detailFullText** (już mamy to w bazie). HTML nie jest do tego potrzebny – wszystkie kluczowe informacje są w wyciągniętym tekście.
- **Efekt:** spadek tokenów z ~30k do ~4–8k na zlecenie → **ok. 80% taniej** faza scoringu, przy tej samej lub lepszej jakości (mniej szumu).

**Wdrożone:** domyślnie scoring **nie wysyła HTML** – używa tylko Opis + Wymagania + detailFullText. Aby wrócić do starego zachowania (pełny HTML), ustaw w `.env`: `USE_HTML_FOR_SCORING=true`.

---

### 2. Deep analysis: tekst zamiast HTML (opcjonalnie)

- **Obecnie:** do Sonneta trafia cały HTML.
- **Propozycja:** do deep analysis wysyłać **detailFullText + Opis + Wymagania** (np. do 30k znaków). To nadal pełny kontekst merytoryczny, bez zbędnego HTML.
- **Efekt:** mniej tokenów wejściowych, podobna jakość analizy i draftu oferty.

Można to włączyć jako drugi krok po optymalizacji scoringu.

---

### 3. Migracja na tańszy provider (zachowanie jakości)

| Zadanie | Obecnie | Propozycja | Jakość |
|---------|--------|------------|--------|
| Batch filter | Claude Haiku | **GPT-4o-mini** lub **Gemini 1.5 Flash** | porównywalna (klasyfikacja tak/nie) |
| Scoring | Claude Haiku | **GPT-4o-mini** lub **Gemini 1.5 Flash** | porównywalna (skala 1–10 + krótka analiza) |
| Deep analysis | Claude Sonnet | **GPT-4o** lub **Gemini 1.5 Pro** | porównywalna lub lepsza (długi draft, reasoning) |

**Szacunek:** przy tym samym wolumenie koszt z OpenAI (4o-mini + 4o) lub Google (Flash + Pro) może być **3–5× niższy** niż przy obecnym stosie Anthropic.

---

### 3b. DeepSeek i inne „hinczyki” (najniższy koszt)

Modele z Chin / open-source przez agregatory są często **znacznie tańsze** przy dobrej jakości do klasyfikacji i krótkiej analizy. API DeepSeek jest **kompatybilne z OpenAI** (ten sam format `chat/completions`) – migracja to zmiana `base_url` + `api_key`.

| Provider / model | Input (per 1M) | Output (per 1M) | Uwagi |
|------------------|----------------|-----------------|--------|
| **DeepSeek Chat** (api.deepseek.com) | \$0.28 | \$0.42 | Bardzo tani, 128k kontekst, dobry PL |
| **DeepSeek Reasoner** (thinking) | \$0.55 | \$2.19 | Do deep analysis (reasoning) |
| **OpenRouter: DeepSeek R1 Distill Llama 8B** | \$0.04 | \$0.04 | Ekstremalnie tani, jeden endpoint do wielu modeli |
| **OpenRouter: Llama 3.3 70B** | \$0.10 | \$0.32 | Tańszy niż Haiku, dobra jakość |
| **Groq (Llama 3.3 70B)** | Free tier: limity | 1k req/dzień free | Darmowy tier do testów / mały ruch |

**DeepSeek (natywnie):**
- Rejestracja: [platform.deepseek.com](https://platform.deepseek.com), API key.
- Endpoint: `https://api.deepseek.com`, model: `deepseek-chat` (albo `deepseek-reasoner` dla deep analysis).
- W Node: używasz **OpenAI SDK** z `baseURL: 'https://api.deepseek.com'` i `apiKey: process.env.DEEPSEEK_API_KEY` – wywołania `client.chat.completions.create()` zostają takie same.

**OpenRouter (jeden klucz, wiele modeli):**
- Jeden API key, wybór modelu w polu `model`: np. `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`, `deepseek/deepseek-r1-distill-llama-8b` (najtaniej).
- Base URL: `https://openrouter.ai/api/v1`. Świetnie się nadaje do A/B testów (dziś DeepSeek, jutro Llama) bez zmiany kodu poza nazwą modelu.

**Rekomendacja „hinczyk”:**
- **Batch filter + Scoring:** DeepSeek Chat lub OpenRouter (DeepSeek / Llama 8B) – koszt nawet **ok. 10× niższy** niż Haiku.
- **Deep analysis:** albo DeepSeek Reasoner (tańszy niż Sonnet), albo zostawić GPT-4o / Sonnet jeśli draft oferty ma być maksymalnie dopracowany.
- Jakość dla **klasyfikacji i scoringu** (relevant tak/nie, skala 1–10) jest u DeepSeeka/Llama zwykle bardzo dobra; dla **długiego draftu oferty po polsku** warto porównać na 5–10 zleceniach z obecnym Sonnetem przed pełnym przełączeniem.

---

### 4. Prompt caching (jeśli zostajesz przy Anthropic)

- System prompt + profil firmy są **identyczne** przy każdym wywołaniu.
- Anthropic oferuje **prompt caching**: pierwsze wywołanie zapisuje kontekst, kolejne płacą ~\$0.10/1M (zamiast \$1–3).
- Wymaga użycia odpowiedniego API (cache control) – warto włączyć, jeśli nie migrujesz od razu.

---

### 5. Batch API (Anthropic)

- Dla zadań nietime-sensitive (np. nocny batch) Anthropic daje **50% zniżki** na input/output.
- Batch filter już działa na paczkach; scoring i deep analysis można kolejno wsadzić do batchów i uruchamiać np. raz dziennie.

---

### 6. Ograniczenie deep analysis do „pewniaków”

- **Obecnie:** deep analysis dla score ≥ 5.
- **Opcja:** uruchamiać deep tylko dla score ≥ 7 (lub ręczny wybór użytkownika). Mniej wywołań Sonneta/drogiego modelu, przy zachowaniu pełnej analizy tam, gdzie jest najbardziej potrzebna.

---

## Rekomendowana kolejność

1. **Od razu:** scoring bez HTML (włączone w kodzie jako domyślne).
2. **Krótki horyzont:** abstrakcja providera (jedna warstwa wywołań `chat.completions`) i przerzucenie batch + scoring na:
   - **GPT-4o-mini / Gemini Flash** (3–5× taniej), albo
   - **DeepSeek / OpenRouter** (nawet ~10× taniej, „hinczyk”).
3. **Średni horyzont:** deep analysis na tekście zamiast HTML (opcjonalnie) + przeniesienie deep na GPT-4o, Gemini Pro albo **DeepSeek Reasoner**.
4. **Opcjonalnie:** prompt caching i Batch API, jeśli zostajesz przy Anthropic.

Dzięki temu możesz **znacząco obniżyć koszty** (nawet o 60–80%) przy zachowaniu lub lekkiej poprawie jakości. DeepSeek / OpenRouter daje dodatkowe 5–10× na batch + scoring przy dobrej jakości do klasyfikacji i oceny.
