const { OpenRouter } = require('@openrouter/sdk');

const OR_OFFER_FULL_MODEL =
  process.env.OPENROUTER_MODEL_OFFER_FULL || 'xiaomi/mimo-v2-pro';

const MODULE_COLORS = new Set(['blue', 'green', 'purple', 'orange', 'red']);

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    const err = new Error('Brak OPENROUTER_API_KEY w środowisku');
    err.code = 'NO_OPENROUTER';
    throw err;
  }
  return new OpenRouter({
    apiKey,
    defaultHeaders: { 'X-OpenRouter-Title': 'ofertownik-soft-synergy' }
  });
}

function extractJsonObject(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  let s = trimmed;
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const match = s.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function generateFullOfferDraftFromPreliminary(project) {
  const client = getOpenRouter();
  const contextNotes = [
    project.consultationNotes,
    project.description &&
    project.description !== 'Konsultacja wstępna' &&
    project.description !== (project.consultationNotes || '').trim()
      ? project.description
      : ''
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  const system = `Jesteś ekspertem od ofert IT. Tworzysz finalną ofertę handlową dla klienta końcowego, który nie jest programistą.
Pisz prostym, zrozumiałym językiem biznesowym, profesjonalnie i konkretnie.
Nie używaj emotek.
Nie używaj słowa "spółka".
W wiadomości do klienta nie ujawniaj żadnych wewnętrznych zasad kalkulacji ani narzutów.

Przygotuj finalną ofertę po polsku i odpowiedz WYŁĄCZNIE jednym obiektem JSON (bez markdown, bez komentarzy, bez tekstu przed ani po), struktura:
{
  "description": "string, szczegółowy opis finalnej oferty (zawiera: nazwę/tytuł projektu, cel projektu, zakres prac prostym językiem, 4-8 akapitów oddzielonych \\n\\n)",
  "mainBenefit": "string, jedna konkretna korzyść biznesowa dla klienta",
  "modules": [ { "name": "string", "description": "string (spójny opis modułu, bez list punktowanych)", "color": "blue" } ],
  "timeline": {
    "phase1": { "name": "string (nazwa fazy inna niż nazwy modułów)", "duration": "string (dni robocze lub tygodnie robocze)" },
    "phase2": { "name": "string (nazwa fazy inna niż nazwy modułów)", "duration": "string (dni robocze lub tygodnie robocze)" },
    "phase3": { "name": "string (nazwa fazy inna niż nazwy modułów)", "duration": "string (dni robocze lub tygodnie robocze)" },
    "phase4": { "name": "string (nazwa fazy inna niż nazwy modułów)", "duration": "string (dni robocze lub tygodnie robocze)" }
  },
  "pricing": { "phase1": number, "phase2": number, "phase3": number, "phase4": number },
  "priceRange": { "min": number|null, "max": number|null },
  "customPaymentTerms": "string — profesjonalne warunki płatności dla oferty finalnej",
  "customReservations": ["string", "..."],
  "technologies": { "stack": ["string"], "methodologies": ["string"] },
  "technologyExplanation": "string, opis technologii jako normalny tekst (bez punktów): jak budujemy, dlaczego ten wybór, jaka alternatywa i jak zostanie użyta"
}

Zasady biznesowe i format:
- "color" modułu: jeden z blue, green, purple, orange, red.
- Moduły wypisz jako lista obiektów, ale opis każdego modułu ma być jedną spójną treścią.
- W technologies.stack wpisz konkretne nazwy technologii (np. React, Node.js, PostgreSQL, Docker, AWS).
- W technologies.methodologies używaj wyłącznie technicznych nazw metodyk (np. Agile, Scrum, Kanban, CI/CD, TDD).
- Podaj dokładnie 4 fazy projektu i przypisz im kwoty tak, aby suma faz = całość wyceny.
- Timeline ma być wydłużony 1.5x względem typowej realizacji software house dla podobnego zakresu.
- Wycena ma odpowiadać stawce 100 PLN/h i poziomowi cenowemu 60% typowej oferty software house, ale NIE WOLNO o tym wspominać w treści oferty.
- Ceny podawaj jako wartości netto w PLN, realistyczne i spójne z zakresem.
- Całość ma brzmieć bardzo profesjonalnie i budować zaufanie klienta.
- Nie zwracaj żadnych dodatkowych pól poza wymaganym JSON.`;
  const forcedTotal = optionalPositiveNumber(project.finalEstimateTotal);
  const knownRisks = Array.isArray(project.finalOfferRisks)
    ? project.finalOfferRisks.map((r) => String(r).trim()).filter(Boolean)
    : [];
  const user = `Nazwa projektu: ${project.name || ''}
Klient: ${project.clientName || ''}
Kontakt: ${project.clientContact || ''}, ${project.clientEmail || ''}, ${project.clientPhone || ''}
Strona: https://soft-synergy.com/
Kontakt handlowy: rizka.amelia@soft-synergy.com, +48 793 868 886

Wymagania, które muszą znaleźć odzwierciedlenie w treści:
- Nazwa/tytuł projektu
- Główna korzyść biznesowa
- Cel projektu
- Główne moduły projektu z krótkim, spójnym opisem każdego modułu
- Opis technologii (bez punktów)
- Metodologie techniczne
- 4 fazy projektu z wyceną i harmonogramem
${forcedTotal ? `- WYMÓG CENOWY: suma pricing.phase1 + phase2 + phase3 + phase4 MUSI wynosić dokładnie ${forcedTotal} PLN netto` : ''}
${knownRisks.length ? `- Uwzględnij te ryzyka niedoprecyzowania w customReservations:\n${knownRisks.map((r) => `  - ${r}`).join('\n')}` : ''}

Notatki i kontekst:
${contextNotes}`;

  const completion = await client.chat.send({
    chatGenerationParams: {
      model: OR_OFFER_FULL_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.35,
      max_tokens: 8192,
      stream: false
    }
  });
  const content = completion?.choices?.[0]?.message?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c) => c?.text || '').join('')
        : '';
  const draft = extractJsonObject(text);
  if (!draft || typeof draft !== 'object') {
    const err = new Error('Model nie zwrócił poprawnego JSON oferty');
    err.code = 'AI_PARSE';
    throw err;
  }
  return draft;
}

function numOr(x, fallback = 0) {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function optionalPositiveNumber(x) {
  if (x == null || x === '') return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function normalizePricingToTargetTotal(rawPricing, targetTotal) {
  const computed = {
    phase1: numOr(rawPricing?.phase1, 0),
    phase2: numOr(rawPricing?.phase2, 0),
    phase3: numOr(rawPricing?.phase3, 0),
    phase4: numOr(rawPricing?.phase4, 0)
  };

  const forcedTotal = optionalPositiveNumber(targetTotal);
  if (!forcedTotal) {
    computed.total =
      computed.phase1 + computed.phase2 + computed.phase3 + computed.phase4;
    return computed;
  }

  const base = [
    Math.max(0, Number(rawPricing?.phase1) || 0),
    Math.max(0, Number(rawPricing?.phase2) || 0),
    Math.max(0, Number(rawPricing?.phase3) || 0),
    Math.max(0, Number(rawPricing?.phase4) || 0)
  ];
  const baseSum = base.reduce((a, b) => a + b, 0);
  const ratios = baseSum > 0 ? base.map((v) => v / baseSum) : [0.25, 0.25, 0.3, 0.2];

  const allocated = ratios.map((r) => Math.floor(forcedTotal * r));
  let diff = forcedTotal - allocated.reduce((a, b) => a + b, 0);
  for (let i = 0; i < allocated.length && diff > 0; i += 1) {
    allocated[i] += 1;
    diff -= 1;
  }

  return {
    phase1: allocated[0],
    phase2: allocated[1],
    phase3: allocated[2],
    phase4: allocated[3],
    total: forcedTotal
  };
}

function normalizeModules(draft) {
  const raw = draft.modules;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      {
        name: 'Realizacja projektu',
        description: 'Zakres zgodnie z ustaleniami konsultacyjnymi.',
        color: 'blue'
      }
    ];
  }
  return raw.map((m) => ({
    name: String(m.name || 'Moduł').trim().slice(0, 200) || 'Moduł',
    description: String(m.description || '').trim().slice(0, 4000),
    color: MODULE_COLORS.has(m.color) ? m.color : 'blue'
  }));
}

const FALLBACK_TIMELINE = {
  phase1: { name: 'Faza I: Discovery', duration: 'Tydzień 1-2' },
  phase2: { name: 'Faza II: Design & Prototyp', duration: 'Tydzień 3-4' },
  phase3: { name: 'Faza III: Development', duration: 'Tydzień 5-12' },
  phase4: { name: 'Faza IV: Testy i Wdrożenie', duration: 'Tydzień 13-14' }
};

function normalizeTimeline(draft, existing) {
  const d = draft.timeline || {};
  const phases = ['phase1', 'phase2', 'phase3', 'phase4'];
  const out = {};
  for (const ph of phases) {
    const cur = existing?.[ph] || FALLBACK_TIMELINE[ph];
    const t = d[ph] || {};
    const name = String(t.name || cur.name || '').trim() || FALLBACK_TIMELINE[ph].name;
    const duration =
      String(t.duration || cur.duration || '').trim() || FALLBACK_TIMELINE[ph].duration;
    out[ph] = { name, duration };
  }
  return out;
}

/**
 * Zwraca płaski obiekt pól do zapisu w Project (offerType = final, projectManager ustawia route).
 */
function draftToProjectUpdate(project, draft) {
  const modules = normalizeModules(draft);
  const isHourlyEstimate = project.finalEstimateMode === 'hourly';
  const pricing = isHourlyEstimate
    ? {
        phase1: 0,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        total: 0
      }
    : normalizePricingToTargetTotal(
        draft.pricing,
        project.finalEstimateTotal
      );

  const pr = draft.priceRange || {};
  const priceRange = {
    min: optionalPositiveNumber(pr.min),
    max: optionalPositiveNumber(pr.max)
  };
  // Przy wycenie finalnej cena ma wynikać z `pricing.total` (dokładna kwota),
  // a nie z widełek `priceRange` wygenerowanych przez AI.
  if (optionalPositiveNumber(project.finalEstimateTotal) || isHourlyEstimate) {
    priceRange.min = null;
    priceRange.max = null;
  }

  const tech = draft.technologies;
  const technologies =
    tech && typeof tech === 'object'
      ? {
          stack: Array.isArray(tech.stack)
            ? tech.stack.map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
            : project.technologies?.stack || [],
          methodologies: Array.isArray(tech.methodologies)
            ? tech.methodologies.map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
            : project.technologies?.methodologies || []
        }
      : project.technologies;

  const customReservations = Array.isArray(draft.customReservations)
    ? draft.customReservations.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
    : [];
  const mergedReservations = [
    ...customReservations,
    ...(Array.isArray(project.finalOfferRisks) ? project.finalOfferRisks : []),
    ...(isHourlyEstimate
      ? ['Zadecydowaliśmy, że w tym projekcie możliwa jest wyłącznie wycena godzinowa 100 zł/h i nie ma możliwości przygotowania wyceny fixed price.']
      : [])
  ].map((s) => String(s).trim()).filter(Boolean).slice(0, 30);

  return {
    offerType: 'final',
    description:
      String(draft.description || '').trim() ||
      (project.consultationNotes || '').trim() ||
      'Opis projektu',
    mainBenefit:
      String(draft.mainBenefit || '').trim() || 'Realizacja projektu zgodnie z ustaleniami',
    modules,
    timeline: normalizeTimeline(draft, project.timeline),
    pricing,
    priceRange,
    customPaymentTerms:
      String(draft.customPaymentTerms || '').trim() ||
      project.customPaymentTerms ||
      '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.',
    customReservations: mergedReservations,
    technologies,
    technologyExplanation: String(draft.technologyExplanation || '').trim()
  };
}

module.exports = {
  generateFullOfferDraftFromPreliminary,
  draftToProjectUpdate,
  OR_OFFER_FULL_MODEL
};
