const express = require('express');
const PublicOrder = require('../models/PublicOrder');
const { auth, requireRole } = require('../middleware/auth');
const { runSync, SEARCH_URL } = require('../services/biznesPolskaScraper');

const router = express.Router();

/** Lista zleceń publicznych (z paginacją) */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, region, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (region) query.region = new RegExp(region, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { investor: new RegExp(search, 'i') },
        { biznesPolskaId: search }
      ];
    }

    const [items, total] = await Promise.all([
      PublicOrder.find(query)
        .sort({ addedDate: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      PublicOrder.countDocuments(query)
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum
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

/** Informacja o konfiguracji – tylko dla admina */
router.get('/config/status', auth, requireRole(['admin']), (req, res) => {
  res.json({
    searchUrl: SEARCH_URL,
    cookiesConfigured: true
  });
});

module.exports = router;
