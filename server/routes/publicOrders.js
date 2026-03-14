const express = require('express');
const PublicOrder = require('../models/PublicOrder');
const { auth, requireRole } = require('../middleware/auth');
const { runSync, SEARCH_URL } = require('../services/biznesPolskaScraper');
const { runAiAnalysis } = require('../services/aiOrderAnalyzer');

const router = express.Router();

/** Lista zleceń publicznych (z paginacją) */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, region, search, aiStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (region) query.region = new RegExp(region, 'i');
    if (aiStatus && aiStatus !== 'all') query.aiStatus = aiStatus;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { investor: new RegExp(search, 'i') },
        { biznesPolskaId: search }
      ];
    }

    const sortRule = aiStatus === 'scored'
      ? { aiScore: -1, addedDate: -1 }
      : { addedDate: -1, createdAt: -1 };

    const [items, total, aiCounts] = await Promise.all([
      PublicOrder.find(query)
        .sort(sortRule)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      PublicOrder.countDocuments(query),
      PublicOrder.aggregate([
        { $group: { _id: '$aiStatus', count: { $sum: 1 } } }
      ])
    ]);

    const counts = { pending: 0, rejected: 0, candidate: 0, scored: 0 };
    for (const c of aiCounts) counts[c._id] = c.count;

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
      aiCounts: counts
    });
  } catch (e) {
    console.error('Public orders list error:', e);
    res.status(500).json({ message: 'Błąd pobierania listy zleceń' });
  }
});

/** Jedno zlecenie po ID (Mongo _id lub biznesPolskaId) */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = /^[a-fA-F0-9]{24}$/.test(id);
    const doc = isMongoId
      ? await PublicOrder.findById(id).lean()
      : await PublicOrder.findOne({ biznesPolskaId: id }).lean();
    if (!doc) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    res.json(doc);
  } catch (e) {
    console.error('Public order get error:', e);
    res.status(500).json({ message: 'Błąd pobierania zlecenia' });
  }
});

/** Ręczna synchronizacja z Grupą Biznes Polska (tylko admin). Cookies w kodzie. */
router.post('/sync', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await runSync(undefined, { maxListPages: 50 });
    res.json({
      message: `Dodano ${result.added} zleceń.`,
      added: result.added,
      updated: result.updated,
      errors: result.errors.length ? result.errors : undefined
    });
  } catch (e) {
    console.error('Public orders sync error:', e);
    res.status(500).json({
      message: e.message || 'Błąd synchronizacji.'
    });
  }
});

/** Uruchom analizę AI dla ostatnich N zleceń (domyślnie 10). Tylko admin. */
router.post('/ai-analyze', auth, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.body.limit, 10) || 10));
    const stats = await runAiAnalysis({ limit, batchSize: 20 });
    res.json({
      message: `AI: przefiltrowano ${stats.filtered}, odrzucono ${stats.rejected}, kandydatów ${stats.candidates}, ocenionych ${stats.scored}`,
      ...stats
    });
  } catch (e) {
    console.error('AI analysis error:', e);
    res.status(500).json({ message: e.message || 'Błąd analizy AI' });
  }
});

/** Reset statusu AI dla zleceń (np. żeby ponownie przeanalizować). Tylko admin. */
router.post('/ai-reset', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { ids } = req.body;
    const filter = ids?.length ? { _id: { $in: ids } } : {};
    const result = await PublicOrder.updateMany(filter, {
      $set: {
        aiStatus: 'pending',
        aiScore: null,
        aiAnalysis: '',
        aiRejectionReason: '',
        aiBatchProcessedAt: null,
        aiScoredAt: null
      }
    });
    res.json({ message: `Zresetowano AI dla ${result.modifiedCount} zleceń`, count: result.modifiedCount });
  } catch (e) {
    console.error('AI reset error:', e);
    res.status(500).json({ message: 'Błąd resetu AI' });
  }
});

/** Informacja o konfiguracji – tylko dla admina */
router.get('/config/status', auth, requireRole(['admin']), (req, res) => {
  res.json({
    searchUrl: SEARCH_URL,
    cookiesConfigured: true
  });
});

module.exports = router;
