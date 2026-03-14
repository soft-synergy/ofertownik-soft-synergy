const Anthropic = require('@anthropic-ai/sdk');
const { fetchOfferDetail, BIZNES_POLSKA_COOKIES } = require('./biznesPolskaScraper');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const COMPANY_PROFILE = `Jesteśmy firmą zajmującą się projektowaniem oraz wdrażaniem stron internetowych, systemów webowych oraz materiałów graficznych dla firm i instytucji publicznych. Specjalizujemy się w tworzeniu nowoczesnych interfejsów użytkownika, serwisów informacyjnych, landing page oraz portali internetowych.

Zakres naszych usług:
- projektowanie graficzne (UI/UX) serwisów internetowych i aplikacji
- tworzenie stron internetowych i portali informacyjnych
- wdrożenia CMS (WordPress, WooCommerce i inne systemy zarządzania treścią)
- projektowanie identyfikacji wizualnej oraz materiałów graficznych
- modernizację i redesign istniejących serwisów
- tworzenie landing page i stron kampanijnych
- przygotowanie stron zgodnych z WCAG
- optymalizację wydajności i SEO dla stron internetowych
- integracje stron internetowych z zewnętrznymi API oraz systemami informatycznymi

AUTOMATYCZNIE ODPADAJĄ zamówienia wymagające:
- autoryzacji producenta konkretnego systemu informatycznego
- licencji na serwisowanie zamkniętych systemów uczelnianych/administracyjnych (USOS, ERP, dedykowane systemy dziedzinowe)
- certyfikacji partnera producenta oprogramowania
- utrzymania infrastruktury IT lub zarządzania serwerownią
- dostawy sprzętu komputerowego lub infrastruktury sieciowej
- wdrożeń dużych systemów ERP, CRM lub systemów finansowo-księgowych
- wieloletniego doświadczenia w utrzymaniu systemów dziedzinowych administracji publicznej

MOŻEMY realizować zamówienia dotyczące:
- wykonania nowej strony internetowej dla urzędu lub instytucji
- modernizacji istniejących stron www
- wykonania portalu informacyjnego lub serwisu tematycznego
- przygotowania projektów graficznych i identyfikacji wizualnej
- stworzenia landing page dla projektów unijnych
- dostosowania strony do standardu WCAG
- integracji strony z zewnętrznymi systemami (formularze, API, systemy płatności)
- przygotowania materiałów graficznych i elementów UI
- udziału jako podwykonawca odpowiedzialny za część graficzną/frontendową`;

function getClient() {
  if (!ANTHROPIC_API_KEY) throw new Error('Brak ANTHROPIC_API_KEY w .env');
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

// ───────────────────────────────────────────────────────────────
// FAZA 1 – Batch filter (Haiku, tanie ~$0.001/batch po 20 zleceń)
//   Wysyłamy tytuł + krótki opis 20 zleceń, AI zwraca JSON:
//   [{ id, relevant: true/false, reason: "..." }]
// ───────────────────────────────────────────────────────────────

async function batchFilter(orders) {
  const client = getClient();

  const ordersSummary = orders.map((o) => ({
    id: o.biznesPolskaId || o._id.toString(),
    title: (o.title || '').slice(0, 300),
    description: (o.description || o.detailFullText || '').slice(0, 500),
    category: o.category || '',
    investor: (o.investor || '').slice(0, 150),
    branches: (o.branches || []).join(', ')
  }));

  const userMessage = `Oto lista ${ordersSummary.length} zamówień publicznych. Dla KAŻDEGO oceń, czy nasza firma mogłaby je realizować (relevant=true) czy NIE (relevant=false).

Zamówienia:
${JSON.stringify(ordersSummary, null, 0)}

Odpowiedz WYŁĄCZNIE poprawnym JSON (tablica):
[{"id":"...","relevant":true/false,"reason":"max 1 zdanie"}]`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    temperature: 0,
    system: `Jesteś ekspertem od zamówień publicznych. Oceniasz czy podane zamówienia pasują do profilu firmy.

${COMPANY_PROFILE}

Zasady:
- Jeśli zamówienie dotyczy stron www, portali, landing page, projektowania graficznego, UI/UX, CMS, WCAG, SEO, materiałów graficznych → relevant=true
- Jeśli zamówienie wymaga autoryzacji producenta, serwisowania zamkniętych systemów, dostawy sprzętu, ERP/CRM, infrastruktury IT, utrzymania systemów dziedzinowych → relevant=false
- W razie wątpliwości (może częściowo pasować) → relevant=true
- Odpowiadaj TYLKO JSON, bez markdown, bez komentarzy.`,
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = response.content[0]?.text || '[]';
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error('[AI batchFilter] Parse error:', text.slice(0, 500));
    return orders.map((o) => ({
      id: o.biznesPolskaId || o._id.toString(),
      relevant: true,
      reason: 'Błąd parsowania – oznaczono jako kandydat do ręcznej weryfikacji'
    }));
  }
}

// ───────────────────────────────────────────────────────────────
// FAZA 2 – Scoring (Haiku)
//   Do AI przekazywany jest CAŁY HTML strony ogłoszenia z biznes-polska.pl,
//   żeby model miał 100% kontekstu (wszystkie tabele, opisy, wymagania, załączniki).
// ───────────────────────────────────────────────────────────────

const MAX_HTML_CHARS = 120000;

async function scoreOrder(order, options = {}) {
  const client = getClient();
  const { fullPageHtmlOverride, fullTextOverride } = options;

  const hasFullHtml = fullPageHtmlOverride && fullPageHtmlOverride.trim().length > 0;
  const htmlForPrompt = hasFullHtml
    ? fullPageHtmlOverride.trim().slice(0, MAX_HTML_CHARS)
    : '';
  const fallbackText = (fullTextOverride || order.detailFullText || '').trim().slice(0, 14000);
  const textFallback = !hasFullHtml
    ? `Tytuł: ${order.title}\nOpis: ${order.description || ''}\nUwagi: ${order.remarks || ''}\nKontakt: ${order.contact || ''}\nInwestor: ${order.investor || ''}\nBranże: ${(order.branches || []).join(', ')}`
    : '';

  const userMessage = `Przeanalizuj to zamówienie publiczne i oceń w skali 1-10:
- 1-3: słabo pasuje, duże ryzyko/niskie szanse
- 4-6: częściowo pasuje, wymaga dokładnej analizy 
- 7-9: dobrze pasuje do naszego profilu
- 10: idealnie pasuje

${hasFullHtml
  ? `Poniżej CAŁA strona HTML ogłoszenia z biznes-polska.pl. Wszystkie dane (przedmiot, organizator, opis, wymagania, termin, załączniki, kontakt) są w treści. Zignoruj skrypty i style – skup się na treści w <table>, <article>, sekcjach z danymi.

ID zlecenia: ${order.biznesPolskaId}
URL: ${order.detailUrl || ''}

--- POCZĄTEK HTML STRONY ---
${htmlForPrompt}
--- KONIEC HTML STRONY ---`
  : `Dane zamówienia (bez pełnego HTML):
ID: ${order.biznesPolskaId}
Tytuł: ${order.title}
Kategoria: ${order.category || ''}
Województwo: ${order.region || ''}
Inwestor/Zamawiający: ${order.investor || ''}

Treść:
${fallbackText || textFallback}`}

Odpowiedz WYŁĄCZNIE poprawnym JSON:
{"score":N,"analysis":"2-3 zdania: co dokładnie obejmuje zamówienie, dlaczego pasuje/nie pasuje, jakie są ryzyka"}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    temperature: 0,
    system: `Jesteś ekspertem od zamówień publicznych w Polsce. Oceniasz dopasowanie zamówienia do profilu firmy web-designowej.

${COMPANY_PROFILE}

Scoring:
1-2: Zupełnie nie pasuje (wymaga autoryzacji producenta, sprzęt, ERP itp.)
3-4: Raczej nie pasuje (główna część jest poza zakresem, ale fragment mógłby)
5-6: Częściowo pasuje (mieszane wymagania, część realizowalna)
7-8: Dobrze pasuje (strona www, portal, grafika, landing page, WCAG)
9-10: Idealnie pasuje (dokładnie to co robimy, prosty zakres, realne szanse)

Odpowiadaj TYLKO JSON, bez markdown.`,
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = response.content[0]?.text || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      score: Math.max(1, Math.min(10, parseInt(parsed.score, 10) || 5)),
      analysis: parsed.analysis || ''
    };
  } catch (e) {
    console.error('[AI scoreOrder] Parse error:', text.slice(0, 500));
    return { score: 5, analysis: 'Błąd parsowania odpowiedzi AI – wymaga ręcznej weryfikacji' };
  }
}

// ───────────────────────────────────────────────────────────────
// FAZA 3 – Deep Analysis (Sonnet – ~$0.03-0.05/zlecenie, TYLKO score ≥ 5)
//   Pobiera cały HTML strony, wysyła do Sonnet z promptem do:
//   - analizy zakresu prac
//   - listy kroków do złożenia oferty
//   - wymaganych dokumentów
//   - trudności / ryzyk
//   - draftu oferty zgodnej z wymogami urzędowymi
// ───────────────────────────────────────────────────────────────

const DEEP_ANALYSIS_MIN_SCORE = 5;

async function deepAnalyzeOrder(order, options = {}) {
  const client = getClient();
  const { rawPageHtml } = options;

  let pageHtml = rawPageHtml || '';
  if (!pageHtml && order.detailUrl) {
    const cookies = process.env.BIZNES_POLSKA_COOKIES || BIZNES_POLSKA_COOKIES;
    try {
      const fresh = await fetchOfferDetail(order.detailUrl, cookies);
      pageHtml = (fresh.rawPageHtml || '').trim();
    } catch (e) {
      console.error(`[deepAnalyze] Fetch failed for ${order.biznesPolskaId}:`, e.message);
    }
  }

  const htmlContent = pageHtml.slice(0, MAX_HTML_CHARS);
  const fallbackContent = !htmlContent.trim()
    ? `Tytuł: ${order.title || ''}\nOpis: ${order.description || ''}\nWymagania: ${order.requirements || ''}\nUwagi: ${order.remarks || ''}\nKontakt: ${order.contact || ''}\nOrganizator: ${order.investor || ''}\nBranże: ${(order.branches || []).join(', ')}\nTermin: ${order.submissionPlaceAndDeadline || ''}\nPełna treść:\n${(order.detailFullText || '').slice(0, 20000)}`
    : '';

  const systemPrompt = `Jesteś seniorem konsultantem zamówień publicznych w Polsce z 20-letnim doświadczeniem. Pracujesz dla firmy web-designowej i pomagasz przygotowywać oferty na przetargi, zlecenia i zamówienia publiczne.

${COMPANY_PROFILE}

Twoje zadanie: na podstawie PEŁNEGO HTML strony ogłoszenia z biznes-polska.pl przeprowadzić dogłębną analizę zamówienia i przygotować materiały dla osoby decyzyjnej, tak żeby miała czarno na białym co trzeba zrobić.

WAŻNE:
- Pisz po polsku, profesjonalnie, konkretnie, bez lania wody
- Wyciągnij WSZYSTKIE informacje ze strony HTML (tabele, opisy, wymagania, załączniki, terminy, kryteria, kody CPV)
- Jeśli w HTML są linki do zewnętrznych źródeł (np. bazakonkurencyjnosci.funduszeeuropejskie.gov.pl) – zanotuj je
- Draft oferty musi być zgodny z polskim prawem zamówień publicznych (PZP) i wymogami zamawiającego
- Bądź szczery co do trudności – nie upiększaj

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown, bez bloków kodu), w strukturze:
{
  "summary": "2-3 zdania: co to za zamówienie, kto zamawiający, czego szuka",
  "scope": ["punkt 1: konkretna czynność do wykonania", "punkt 2: ...", "..."],
  "requiredActions": ["krok 1: co zrobić żeby złożyć ofertę", "krok 2: ...", "..."],
  "requiredDocuments": ["dokument 1", "dokument 2", "..."],
  "deadlines": [{"label": "opis terminu", "date": "YYYY-MM-DD lub tekst"}, ...],
  "evaluationCriteria": [{"criterion": "nazwa kryterium", "weight": "waga %", "description": "jak jest oceniane"}],
  "potentialDifficulties": ["trudność 1", "trudność 2", "..."],
  "estimatedValue": "szacowana wartość zamówienia jeśli podana, inaczej null",
  "keyContacts": "imię, telefon, email osoby kontaktowej",
  "recommendation": "1-2 zdania: czy startować, na co uważać, jaka strategia",
  "offerDraft": "Pełny DRAFT oferty handlowej (min. 300 słów) zgodny z wymaganiami zamawiającego. Zawiera: dane oferenta [DO UZUPEŁNIENIA], odniesienie do nr ogłoszenia, przedmiot oferty, proponowane podejście/metodologię, harmonogram, cenę [DO UZUPEŁNIENIA], oświadczenia wymagane przez zamawiającego, podpis [DO UZUPEŁNIENIA]. Draft powinien być gotowy do edycji przez człowieka – miejsca do uzupełnienia oznacz [DO UZUPEŁNIENIA]."
}`;

  const userMessage = hasContentForDeep(htmlContent)
    ? `Przeanalizuj dogłębnie to zamówienie publiczne. Poniżej cała strona HTML z biznes-polska.pl:

ID: ${order.biznesPolskaId}
URL: ${order.detailUrl || ''}
Poprzednia ocena AI: ${order.aiScore || '?'}/10
Poprzednia analiza AI: ${order.aiAnalysis || 'brak'}

--- POCZĄTEK HTML STRONY ---
${htmlContent}
--- KONIEC HTML STRONY ---`
    : `Przeanalizuj dogłębnie to zamówienie publiczne:

ID: ${order.biznesPolskaId}
URL: ${order.detailUrl || ''}
Poprzednia ocena AI: ${order.aiScore || '?'}/10
Poprzednia analiza AI: ${order.aiAnalysis || 'brak'}

${fallbackContent}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = response.content[0]?.text || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    const requiredFields = ['summary', 'scope', 'requiredActions', 'offerDraft'];
    for (const f of requiredFields) {
      if (!parsed[f]) throw new Error(`Brak pola "${f}" w odpowiedzi AI`);
    }

    return {
      ...parsed,
      model: 'claude-sonnet-4-20250514',
      analyzedAt: new Date().toISOString()
    };
  } catch (e) {
    console.error('[AI deepAnalyze] Parse error:', text.slice(0, 1000));
    return {
      summary: 'Błąd parsowania głębokiej analizy AI – wymagana ręczna analiza',
      scope: [],
      requiredActions: [],
      requiredDocuments: [],
      deadlines: [],
      evaluationCriteria: [],
      potentialDifficulties: ['Nie udało się przetworzyć odpowiedzi AI: ' + e.message],
      estimatedValue: null,
      keyContacts: '',
      recommendation: 'Wymaga ręcznej analizy',
      offerDraft: '',
      rawAiResponse: text.slice(0, 3000),
      model: 'claude-sonnet-4-20250514',
      analyzedAt: new Date().toISOString(),
      error: true
    };
  }
}

function hasContentForDeep(html) {
  return html && html.trim().length > 500;
}

// ───────────────────────────────────────────────────────────────
// ORCHESTRATOR – uruchamia cały pipeline
// ───────────────────────────────────────────────────────────────

/** Warunek: tylko zlecenia jeszcze nie analizowane (nigdy nie re-walidujemy rejected/candidate/scored) */
const PENDING_CONDITION = {
  $or: [
    { aiStatus: 'pending' },
    { aiStatus: { $exists: false } },
    { aiStatus: null }
  ]
};

async function runAiAnalysis(options = {}) {
  const PublicOrder = require('../models/PublicOrder');
  const { limit = 10, batchSize = 20, orderIds } = options;

  const stats = { filtered: 0, rejected: 0, candidates: 0, scored: 0, deepAnalyzed: 0, errors: [] };

  let pending;
  if (orderIds && orderIds.length > 0) {
    // Tylko podane ID i tylko jeśli wciąż pending (zero re-walidacji)
    pending = await PublicOrder.find({
      _id: { $in: orderIds },
      ...PENDING_CONDITION
    })
      .sort({ createdAt: -1 })
      .lean();
  } else {
    pending = await PublicOrder.find(PENDING_CONDITION)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  if (!pending.length) return { ...stats, message: 'Brak zleceń do analizy (wszystkie już przetworzone lub brak rekordów)' };

  // FAZA 1: Batch filtering
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    let results;
    try {
      results = await batchFilter(batch);
    } catch (e) {
      stats.errors.push(`Batch ${i}-${i + batch.length}: ${e.message}`);
      continue;
    }

    const resultsMap = new Map();
    for (const r of results) resultsMap.set(String(r.id), r);

    for (const order of batch) {
      const key = order.biznesPolskaId || order._id.toString();
      const r = resultsMap.get(key);
      const relevant = r ? r.relevant : true;
      const reason = r ? r.reason : '';

      try {
        if (relevant) {
          await PublicOrder.findByIdAndUpdate(order._id, {
            aiStatus: 'candidate',
            aiBatchProcessedAt: new Date()
          });
          stats.candidates++;
        } else {
          await PublicOrder.findByIdAndUpdate(order._id, {
            aiStatus: 'rejected',
            aiRejectionReason: reason,
            aiBatchProcessedAt: new Date()
          });
          stats.rejected++;
        }
        stats.filtered++;
      } catch (e) {
        stats.errors.push(`Update ${key}: ${e.message}`);
      }
    }
  }

  // FAZA 2: Scoring kandydatów – tylko z tej puli (gdy orderIds: tylko nowe; inaczej wszystkie candidate)
  const candidateQuery = { aiStatus: 'candidate' };
  if (orderIds && orderIds.length > 0) {
    candidateQuery._id = { $in: orderIds };
  }
  const candidates = await PublicOrder.find(candidateQuery)
    .sort({ createdAt: -1 })
    .lean();

  const cookies = process.env.BIZNES_POLSKA_COOKIES || BIZNES_POLSKA_COOKIES;

  for (const order of candidates) {
    try {
      let fullPageHtmlForAi = '';
      let fullTextForAi = order.detailFullText || '';
      if (order.detailUrl) {
        try {
          const fresh = await fetchOfferDetail(order.detailUrl, cookies);
          fullPageHtmlForAi = (fresh.rawPageHtml || '').trim();
          fullTextForAi = (fresh.detailFullText || '').trim();
          if (fullTextForAi || fullPageHtmlForAi) {
            await PublicOrder.findByIdAndUpdate(order._id, {
              $set: {
                detailFullText: fresh.detailFullText || '',
                detailRawHtml: fresh.detailRawHtml || '',
                investor: fresh.investor || order.investor,
                description: fresh.description || order.description,
                requirements: fresh.requirements || order.requirements,
                submissionPlaceAndDeadline: fresh.submissionPlaceAndDeadline || order.submissionPlaceAndDeadline,
                contact: fresh.contact || order.contact,
                remarks: fresh.remarks || order.remarks
              }
            });
          }
        } catch (fetchErr) {
          stats.errors.push(`Fetch ${order.biznesPolskaId}: ${fetchErr.message}`);
        }
      }

      const { score, analysis } = await scoreOrder(order, {
        fullPageHtmlOverride: fullPageHtmlForAi || undefined,
        fullTextOverride: fullTextForAi || undefined
      });
      await PublicOrder.findByIdAndUpdate(order._id, {
        aiStatus: 'scored',
        aiScore: score,
        aiAnalysis: analysis,
        aiScoredAt: new Date()
      });
      stats.scored++;

      // FAZA 3: Deep analysis – automatycznie dla score >= 5
      if (score >= DEEP_ANALYSIS_MIN_SCORE) {
        try {
          console.log(`[AI] Deep analysis for ${order.biznesPolskaId} (score ${score})...`);
          const deepResult = await deepAnalyzeOrder(order, {
            rawPageHtml: fullPageHtmlForAi || undefined
          });
          await PublicOrder.findByIdAndUpdate(order._id, {
            aiDeepAnalysis: deepResult,
            aiDeepAnalyzedAt: new Date()
          });
          stats.deepAnalyzed++;
        } catch (deepErr) {
          stats.errors.push(`Deep ${order.biznesPolskaId}: ${deepErr.message}`);
        }
      }
    } catch (e) {
      stats.errors.push(`Score ${order.biznesPolskaId}: ${e.message}`);
    }
  }

  return stats;
}

module.exports = { batchFilter, scoreOrder, deepAnalyzeOrder, runAiAnalysis, COMPANY_PROFILE, DEEP_ANALYSIS_MIN_SCORE };
