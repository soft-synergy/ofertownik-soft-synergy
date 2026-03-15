const Anthropic = require('@anthropic-ai/sdk');
const { OpenRouter } = require('@openrouter/sdk');
const { fetchOfferDetail, BIZNES_POLSKA_COOKIES } = require('./biznesPolskaScraper');
const { getCompanyProfile, COMPANY_PROFILE } = require('../config/companyProfile');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const AI_PROVIDER = (process.env.AI_PROVIDER || (OPENROUTER_API_KEY ? 'openrouter' : 'anthropic')).toLowerCase();

// OpenRouter models (możesz override w .env)
const OR_MODEL_FAST = process.env.OPENROUTER_MODEL_FAST || 'deepseek/deepseek-chat';
const OR_MODEL_DEEP = process.env.OPENROUTER_MODEL_DEEP || 'deepseek/deepseek-r1';
// Fallback models (używane tylko przy błędzie requestu)
const OR_MODEL_FAST_FALLBACK = process.env.OPENROUTER_MODEL_FAST_FALLBACK || 'meta-llama/llama-3.3-70b-instruct';
const OR_MODEL_DEEP_FALLBACK = process.env.OPENROUTER_MODEL_DEEP_FALLBACK || 'deepseek/deepseek-chat';

function getClient() {
  if (AI_PROVIDER === 'openrouter') {
    if (!OPENROUTER_API_KEY) throw new Error('Brak OPENROUTER_API_KEY w .env');
    return new OpenRouter({
      apiKey: OPENROUTER_API_KEY,
      defaultHeaders: {
        // opcjonalnie, ale pomaga przy debugowaniu i rankingach
        'X-OpenRouter-Title': 'ofertownik-soft-synergy'
      }
    });
  }

  if (!ANTHROPIC_API_KEY) throw new Error('Brak ANTHROPIC_API_KEY w .env');
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

async function llmCreate({ client, provider, model, system, messages, max_tokens, temperature }) {
  if (provider === 'openrouter') {
    // @openrouter/sdk
    const combinedMessages = system
      ? [{ role: 'system', content: system }, ...(messages || [])]
      : (messages || []);
    const pickFallback = (m) => {
      if (m === OR_MODEL_FAST) return OR_MODEL_FAST_FALLBACK;
      if (m === OR_MODEL_DEEP) return OR_MODEL_DEEP_FALLBACK;
      return '';
    };

    const sendOnce = async (m) => {
      const request = {
        chatGenerationParams: {
          model: m,
          messages: combinedMessages,
          temperature,
          max_tokens,
          stream: false
        }
      };
      const completion = await client.chat.send(request);
      const content = completion?.choices?.[0]?.message?.content;
      return typeof content === 'string'
        ? content
        : (Array.isArray(content) ? content.map((c) => c?.text || '').join('') : '');
    };

    try {
      return await sendOnce(model);
    } catch (err) {
      const fallbackModel = pickFallback(model);
      if (!fallbackModel || fallbackModel === model) throw err;
      return await sendOnce(fallbackModel);
    }
  }

  // Anthropic
  const response = await client.messages.create({
    model,
    max_tokens,
    temperature,
    system,
    messages
  });
  return response.content?.[0]?.text || '';
}

// ───────────────────────────────────────────────────────────────
// FAZA 1 – Batch filter (Haiku, tanie ~$0.001/batch po 20 zleceń)
//   Wysyłamy tytuł + krótki opis 20 zleceń, AI zwraca JSON:
//   [{ id, relevant: true/false, reason: "..." }]
// ───────────────────────────────────────────────────────────────

async function batchFilter(orders) {
  const client = getClient();
  const provider = AI_PROVIDER;
  const companyProfile = await getCompanyProfile();

  const ordersSummary = orders.map((o) => ({
    id: o.biznesPolskaId || o._id.toString(),
    title: (o.title || '').slice(0, 300),
    description: (o.description || '').trim().slice(0, 800),
    requirements: (o.requirements || '').trim().slice(0, 800),
    category: o.category || '',
    investor: (o.investor || '').slice(0, 150),
    branches: (o.branches || []).join(', ')
  }));

  const userMessage = `Oto lista ${ordersSummary.length} zamówień publicznych. Dla KAŻDEGO masz: title, description (OPIS), requirements (WYMAGANIA), investor, branches. Na tej podstawie oceń, czy nasza firma mogłaby je realizować (relevant=true) czy NIE (relevant=false).

Zamówienia:
${JSON.stringify(ordersSummary, null, 0)}

Odpowiedz WYŁĄCZNIE poprawnym JSON (tablica):
[{"id":"...","relevant":true/false,"reason":"max 1 zdanie"}]`;

  const systemPrompt = `Jesteś ekspertem od zamówień publicznych. Oceniasz czy podane zamówienia pasują do profilu firmy.

${companyProfile}

Zasady:
- Jeśli zamówienie dotyczy stron www, portali, landing page, projektowania graficznego, UI/UX, CMS, WCAG, SEO, materiałów graficznych → relevant=true
- Jeśli zamówienie wymaga autoryzacji producenta, serwisowania zamkniętych systemów, dostawy sprzętu, ERP/CRM, infrastruktury IT, utrzymania systemów dziedzinowych → relevant=false
- W razie wątpliwości (może częściowo pasować) → relevant=true
- Odpowiadaj TYLKO JSON, bez markdown, bez komentarzy.`;
  const text = await llmCreate({
    client,
    provider,
    model: provider === 'openrouter' ? OR_MODEL_FAST : 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

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
//   Domyślnie: tylko tekst (Opis + Wymagania + detailFullText) – ~80% taniej, ta sama jakość.
//   USE_HTML_FOR_SCORING=true w .env włącza wysyłanie pełnego HTML (drożej, ~30k tokenów/zlecenie).
// ───────────────────────────────────────────────────────────────

const MAX_HTML_CHARS = 120000;

async function scoreOrder(order, options = {}) {
  const client = getClient();
  const provider = AI_PROVIDER;
  const companyProfile = await getCompanyProfile();
  const { fullPageHtmlOverride, fullTextOverride } = options;

  const hasFullHtml = fullPageHtmlOverride && fullPageHtmlOverride.trim().length > 0;
  const htmlForPrompt = hasFullHtml
    ? fullPageHtmlOverride.trim().slice(0, MAX_HTML_CHARS)
    : '';
  const fallbackText = (fullTextOverride || order.detailFullText || '').trim().slice(0, 14000);
  const opis = (order.description || '').trim();
  const wymagania = (order.requirements || '').trim();
  const textFallback = !hasFullHtml
    ? `Tytuł: ${order.title}
Opis: ${opis || '(brak)'}
Wymagania: ${wymagania || '(brak)'}
Uwagi: ${order.remarks || ''}
Kontakt: ${order.contact || ''}
Inwestor: ${order.investor || ''}
Branże: ${(order.branches || []).join(', ')}`
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

--- OPIS (kluczowy) ---
${opis || '(brak)'}

--- WYMAGANIA (kluczowe) ---
${wymagania || '(brak)'}

--- Pełna treść ---
${fallbackText || textFallback}`}

Odpowiedz WYŁĄCZNIE poprawnym JSON:
{"score":N,"analysis":"2-3 zdania: co dokładnie obejmuje zamówienie, dlaczego pasuje/nie pasuje, jakie są ryzyka"}`;

  const systemPrompt = `Jesteś ekspertem od zamówień publicznych w Polsce. Oceniasz dopasowanie zamówienia do profilu firmy web-designowej.

${companyProfile}

Scoring:
1-2: Zupełnie nie pasuje (wymaga autoryzacji producenta, sprzęt, ERP itp.)
3-4: Raczej nie pasuje (główna część jest poza zakresem, ale fragment mógłby)
5-6: Częściowo pasuje (mieszane wymagania, część realizowalna)
7-8: Dobrze pasuje (strona www, portal, grafika, landing page, WCAG)
9-10: Idealnie pasuje (dokładnie to co robimy, prosty zakres, realne szanse)

Odpowiadaj TYLKO JSON, bez markdown.`;
  const text = await llmCreate({
    client,
    provider,
    model: provider === 'openrouter' ? OR_MODEL_FAST : 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });
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
/** Przy ocenie >= 8 wysyłamy pełny raport na maila (na 100% składamy). */
const SCORE_EMAIL_THRESHOLD = 8;

function buildReportHtml(order, score, analysis, deep) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const list = (arr) => (Array.isArray(arr) && arr.length ? `<ul>${arr.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>—</p>');
  const lines = [
    `<h2>Zlecenie: ${esc(order.title)}</h2>`,
    `<p><strong>ID:</strong> ${esc(order.biznesPolskaId)} &bull; <strong>Ocena AI:</strong> ${score}/10</p>`,
    order.detailUrl ? `<p><a href="${order.detailUrl}">Link do ogłoszenia</a></p>` : '',
    `<h3>Krótka analiza AI</h3><p>${esc(analysis)}</p>`,
    deep.summary ? `<h3>Podsumowanie</h3><p>${esc(deep.summary)}</p>` : '',
    deep.scope ? `<h3>Zakres</h3>${list(deep.scope)}` : '',
    deep.requiredActions ? `<h3>Kroki do złożenia oferty</h3>${list(deep.requiredActions)}` : '',
    deep.requiredDocuments ? `<h3>Wymagane dokumenty</h3>${list(deep.requiredDocuments)}` : '',
    deep.deadlines && deep.deadlines.length ? `<h3>Terminy</h3><ul>${deep.deadlines.map((d) => `<li>${esc(d.label)}: ${esc(d.date)}</li>`).join('')}</ul>` : '',
    deep.evaluationCriteria && deep.evaluationCriteria.length ? `<h3>Kryteria oceny</h3><ul>${deep.evaluationCriteria.map((c) => `<li>${esc(c.criterion)} (${esc(c.weight)}) – ${esc(c.description)}</li>`).join('')}</ul>` : '',
    deep.potentialDifficulties ? `<h3>Trudności / ryzyka</h3>${list(deep.potentialDifficulties)}` : '',
    deep.estimatedValue ? `<p><strong>Szacowana wartość zamówienia:</strong> ${esc(deep.estimatedValue)}</p>` : '',
    deep.keyContacts ? `<p><strong>Kontakt:</strong> ${esc(deep.keyContacts)}</p>` : '',
    deep.recommendation ? `<h3>Rekomendacja</h3><p>${esc(deep.recommendation)}</p>` : '',
    (() => {
      const ps = deep.pricingScenarios;
      if (!ps || typeof ps !== 'object') return '';
      const s = (key, title) => {
        const x = ps[key];
        if (!x || typeof x !== 'object') return '';
        const a = esc(x.amount || '—');
        const d = esc(x.description || '');
        const r = esc(x.rationale || '');
        return `<div style="margin-bottom:1em; padding:1em; border:1px solid #e5e7eb; border-radius:8px;"><strong>${title}</strong><p style="margin:0.25em 0;"><strong>Kwota:</strong> ${a}</p>${d ? `<p style="margin:0.25em 0;">${d}</p>` : ''}${r ? `<p style="margin:0.25em 0; font-size:0.95em; color:#4b5563;">${r}</p>` : ''}</div>`;
      };
      return `<h3>Scenariusze wyceny</h3>${s('ekstremalnieAgresywna', 'Ekstremalnie agresywna (ok. 99% szans na wygraną)')}${s('agresywna', 'Agresywna')}${s('standardowa', 'Standardowa')}`;
    })(),
    deep.offerDraft ? `<h3>Draft oferty</h3><div style="white-space:pre-wrap; background:#f5f5f5; padding:1em; border-radius:6px;">${esc(deep.offerDraft)}</div>` : ''
  ];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif; max-width:720px; margin:0 auto; padding:20px;">${lines.join('')}</body></html>`;
}

async function sendReportEmail(order, score, analysis, deepResult) {
  const to = process.env.PUBLIC_ORDER_REPORT_EMAIL || process.env.NOTIFY_EMAIL;
  if (!to || !to.trim()) {
    console.log('[AI] PUBLIC_ORDER_REPORT_EMAIL nie ustawiony – pomijam wysyłkę raportu');
    return;
  }
  const { sendEmail } = require('../utils/emailService');
  const subject = `[Zlecenie ${score}/10] ${(order.title || '').slice(0, 60)} – raport AI`;
  const html = buildReportHtml(order, score, analysis, deepResult);
  await sendEmail({ to: to.trim(), subject, html });
}

async function deepAnalyzeOrder(order, options = {}) {
  const client = getClient();
  const provider = AI_PROVIDER;
  const companyProfile = await getCompanyProfile();
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
  const opis = (order.description || '').trim();
  const wymagania = (order.requirements || '').trim();
  const fallbackContent = !htmlContent.trim()
    ? `Tytuł: ${order.title || ''}

--- OPIS (pełny) ---
${opis || '(brak)'}

--- WYMAGANIA (pełne) ---
${wymagania || '(brak)'}

Uwagi: ${order.remarks || ''}
Kontakt: ${order.contact || ''}
Organizator: ${order.investor || ''}
Branże: ${(order.branches || []).join(', ')}
Termin: ${order.submissionPlaceAndDeadline || ''}

--- Pełna treść (detailFullText) ---
${(order.detailFullText || '').slice(0, 20000)}`
    : '';

  const systemPrompt = `Jesteś seniorem konsultantem zamówień publicznych w Polsce z 20-letnim doświadczeniem. Pracujesz dla firmy web-designowej i pomagasz przygotowywać oferty na przetargi, zlecenia i zamówienia publiczne.

${companyProfile}

Twoje zadanie: na podstawie PEŁNEGO HTML strony ogłoszenia z biznes-polska.pl przeprowadzić dogłębną analizę zamówienia i przygotować materiały dla osoby decyzyjnej, tak żeby miała czarno na białym co trzeba zrobić.

WAŻNE:
- Pisz po polsku, profesjonalnie, konkretnie, bez lania wody
- Wyciągnij WSZYSTKIE informacje ze strony HTML (tabele, opisy, wymagania, załączniki, terminy, kryteria, kody CPV)
- Jeśli w HTML są linki do zewnętrznych źródeł (np. bazakonkurencyjnosci.funduszeeuropejskie.gov.pl) – zanotuj je
- Draft oferty musi być zgodny z polskim prawem zamówień publicznych (PZP) i wymogami zamawiającego
- Bądź szczery co do trudności – nie upiększaj
- OBLIGATORYJNIE przygotuj 3 scenariusze wyceny (patrz pricingScenarios poniżej) – na podstawie opisu zamówienia i kryteriów oceny zaplanuj konkretne kwoty/strategię.

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
  "pricingScenarios": {
    "ekstremalnieAgresywna": { "amount": "konkretna kwota lub przedział w PLN netto", "description": "1-2 zdania: na czym polega ta strategia", "rationale": "dlaczego szansa na wygraną ok. 99%" },
    "agresywna": { "amount": "konkretna kwota lub przedział w PLN netto", "description": "1-2 zdania: na czym polega", "rationale": "szansa na wygraną, kompromis cena/ryzyko" },
    "standardowa": { "amount": "konkretna kwota lub przedział w PLN netto", "description": "1-2 zdania: wycena standardowa", "rationale": "kiedy wybrać ten wariant" }
  },
  "offerDraft": "Pełny DRAFT oferty handlowej (min. 300 słów) zgodny z wymaganiami zamawiającego. Zawiera: dane oferenta [DO UZUPEŁNIENIA], odniesienie do nr ogłoszenia, przedmiot oferty, proponowane podejście/metodologię, harmonogram, cenę [DO UZUPEŁNIENIA] – możesz wpisać wybrany scenariusz wyceny, oświadczenia wymagane przez zamawiającego, podpis [DO UZUPEŁNIENIA]. Draft gotowy do edycji – miejsca do uzupełnienia oznacz [DO UZUPEŁNIENIA]."
}`;

  const opisForDeep = (order.description || '').trim();
  const wymaganiaForDeep = (order.requirements || '').trim();
  const userMessage = hasContentForDeep(htmlContent)
    ? `Przeanalizuj dogłębnie to zamówienie publiczne. Poniżej wyciągnięte z bazy OPIS i WYMAGANIA (kluczowe), a potem cała strona HTML z biznes-polska.pl.

ID: ${order.biznesPolskaId}
URL: ${order.detailUrl || ''}
Poprzednia ocena AI: ${order.aiScore || '?'}/10
Poprzednia analiza AI: ${order.aiAnalysis || 'brak'}

--- OPIS (z bazy – pełny) ---
${opisForDeep || '(brak)'}

--- WYMAGANIA (z bazy – pełne) ---
${wymaganiaForDeep || '(brak)'}

--- POCZĄTEK HTML STRONY ---
${htmlContent}
--- KONIEC HTML STRONY ---`
    : `Przeanalizuj dogłębnie to zamówienie publiczne:

ID: ${order.biznesPolskaId}
URL: ${order.detailUrl || ''}
Poprzednia ocena AI: ${order.aiScore || '?'}/10
Poprzednia analiza AI: ${order.aiAnalysis || 'brak'}

${fallbackContent}`;

  const text = await llmCreate({
    client,
    provider,
    model: provider === 'openrouter' ? OR_MODEL_DEEP : 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    const requiredFields = ['summary', 'scope', 'requiredActions', 'offerDraft'];
    for (const f of requiredFields) {
      if (!parsed[f]) throw new Error(`Brak pola "${f}" w odpowiedzi AI`);
    }
    if (!parsed.pricingScenarios || typeof parsed.pricingScenarios !== 'object') {
      parsed.pricingScenarios = { ekstremalnieAgresywna: {}, agresywna: {}, standardowa: {} };
    }

    return {
      ...parsed,
      model: provider === 'openrouter' ? OR_MODEL_DEEP : 'claude-sonnet-4-20250514',
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
      pricingScenarios: { ekstremalnieAgresywna: {}, agresywna: {}, standardowa: {} },
      offerDraft: '',
      rawAiResponse: text.slice(0, 3000),
      model: provider === 'openrouter' ? OR_MODEL_DEEP : 'claude-sonnet-4-20250514',
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

  const useHtmlForScoring = process.env.USE_HTML_FOR_SCORING === 'true';
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
        fullPageHtmlOverride: useHtmlForScoring ? (fullPageHtmlForAi || undefined) : undefined,
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
          // Przy 8/10 lub więcej – wysyłka pełnego raportu na maila (na 100% składamy)
          if (score >= SCORE_EMAIL_THRESHOLD && deepResult && !deepResult.error) {
            sendReportEmail(order, score, analysis, deepResult).catch((e) => {
              console.error(`[AI] Email raportu ${order.biznesPolskaId}:`, e.message);
              stats.errors.push(`Email raportu ${order.biznesPolskaId}: ${e.message}`);
            });
          }
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

module.exports = { batchFilter, scoreOrder, deepAnalyzeOrder, runAiAnalysis, COMPANY_PROFILE, DEEP_ANALYSIS_MIN_SCORE, SCORE_EMAIL_THRESHOLD };
