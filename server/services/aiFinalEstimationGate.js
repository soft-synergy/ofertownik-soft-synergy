const { OpenRouter } = require('@openrouter/sdk');

const OR_MODEL_GATE =
  process.env.OPENROUTER_MODEL_OFFER_FULL || 'xiaomi/mimo-v2-pro';

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

function parseJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function analyzeFinalEstimationReadiness(project) {
  const client = getOpenRouter();
  const notes = [
    project.consultationNotes || '',
    project.description && project.description !== 'Konsultacja wstępna'
      ? project.description
      : '',
    Array.isArray(project.notes)
      ? project.notes.map((n) => n?.text || '').filter(Boolean).join('\n')
      : ''
  ].filter(Boolean).join('\n\n---\n\n');

  const system = `Jesteś analitykiem presales IT. Oceniasz, czy można wykonać finalną wycenę bez ryzyka błędu.
Wykrywaj TYLKO twarde blokery (braki, które uniemożliwiają odpowiedzialną wycenę).
Nie traktuj drobnych braków jako blockerów (np. kolory strony, liczba podstron wizytówki) — to są ryzyka lub założenia.

Zwróć WYŁĄCZNIE JSON:
{
  "canEstimateFinalNow": boolean,
  "hardBlockers": ["string"],
  "risksToFlagAtFinalOffer": ["string"],
  "clarificationQuestions": ["string"],
  "proposedClientClarificationMessage": "string"
}

Definicja hard blocker:
- brak kluczowego zakresu uniemożliwiający policzenie prac,
- nieokreślone krytyczne integracje/systemy zewnętrzne,
- niejasny model danych/procesu, który może wielokrotnie zmienić estymację.

Jeśli zakres jest prosty (np. strona wizytówka), ustaw canEstimateFinalNow=true i hardBlockers=[].
Ryzyka wpisuj zwięźle (max 6).`;

  const user = `Projekt: ${project.name || ''}
Klient: ${project.clientName || ''}
Typ: ${project.offerType || ''}
Status: ${project.status || ''}

Kontekst:
${notes || '(brak dodatkowego kontekstu)'}`;

  const completion = await client.chat.send({
    chatGenerationParams: {
      model: OR_MODEL_GATE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.1,
      max_tokens: 2048,
      stream: false
    }
  });

  const content = completion?.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((c) => c?.text || '').join('')
      : '';

  const parsed = parseJson(text);
  if (!parsed || typeof parsed !== 'object') {
    const err = new Error('AI gate: niepoprawny JSON');
    err.code = 'AI_PARSE';
    throw err;
  }

  return {
    canEstimateFinalNow: Boolean(parsed.canEstimateFinalNow),
    hardBlockers: Array.isArray(parsed.hardBlockers)
      ? parsed.hardBlockers.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
      : [],
    risksToFlagAtFinalOffer: Array.isArray(parsed.risksToFlagAtFinalOffer)
      ? parsed.risksToFlagAtFinalOffer.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
      : [],
    clarificationQuestions: Array.isArray(parsed.clarificationQuestions)
      ? parsed.clarificationQuestions.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
      : [],
    proposedClientClarificationMessage: String(
      parsed.proposedClientClarificationMessage || ''
    ).trim()
  };
}

module.exports = {
  analyzeFinalEstimationReadiness
};

