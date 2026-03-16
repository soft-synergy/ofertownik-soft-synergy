const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PublicOrder = require('../models/PublicOrder');
const PublicOrderPrompts = require('../models/PublicOrderPrompts');
const Task = require('../models/Task');
const { auth, requireRole } = require('../middleware/auth');
const { runSync, fetchOfferDetail, SEARCH_URL, BIZNES_POLSKA_COOKIES } = require('../services/biznesPolskaScraper');
const { runAiAnalysis, deepAnalyzeOrder } = require('../services/aiOrderAnalyzer');
const { getSectionsSync, setSectionsCache } = require('../config/companyProfile');
const { notifyPublicOrderSubscribers } = require('../utils/publicOrderNotifications');
const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/public-orders');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

/** Lista zleceń publicznych (z paginacją) */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, region, search, aiStatus, weDoIt } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (region) query.region = new RegExp(region, 'i');
    if (aiStatus && aiStatus !== 'all') query.aiStatus = aiStatus;
    if (weDoIt === 'true' || weDoIt === true) query.weDoIt = true;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { investor: new RegExp(search, 'i') },
        { biznesPolskaId: search }
      ];
    }

    const sortRule = weDoIt === 'true' || weDoIt === true
      ? { customDeadline: 1, addedDate: -1 }
      : aiStatus === 'scored'
        ? { aiScore: -1, addedDate: -1 }
        : { addedDate: -1, createdAt: -1 };

    const [items, total, aiCounts, weDoItCount] = await Promise.all([
      PublicOrder.find(query)
        .sort(sortRule)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      PublicOrder.countDocuments(query),
      PublicOrder.aggregate([
        { $group: { _id: '$aiStatus', count: { $sum: 1 } } }
      ]),
      PublicOrder.countDocuments({ weDoIt: true })
    ]);

    const counts = { pending: 0, rejected: 0, candidate: 0, scored: 0 };
    for (const c of aiCounts) counts[c._id] = c.count;

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
      aiCounts: counts,
      weDoItCount
    });
  } catch (e) {
    console.error('Public orders list error:', e);
    res.status(500).json({ message: 'Błąd pobierania listy zleceń' });
  }
});

/** Usuń wszystkie zlecenia publiczne. Tylko admin. */
router.delete('/all', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await PublicOrder.deleteMany({});
    res.json({
      message: `Usunięto ${result.deletedCount} zleceń publicznych`,
      deletedCount: result.deletedCount
    });
  } catch (e) {
    console.error('Public orders delete all error:', e);
    res.status(500).json({ message: 'Błąd usuwania zleceń' });
  }
});

/** Ponowne pobranie szczegółów z biznes-polska.pl dla wybranych lub wszystkich zleceń (tylko admin). */
router.post('/refresh-details', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { ids } = req.body || {};
    const filter = Array.isArray(ids) && ids.length > 0 ? { _id: { $in: ids } } : {};
    const orders = await PublicOrder.find(filter).select('_id detailUrl').lean();
    let updated = 0;
    const errors = [];
    for (const order of orders) {
      if (!order.detailUrl) {
        errors.push(`${order._id}: brak linku`);
        continue;
      }
      try {
        const detail = await fetchOfferDetail(order.detailUrl, process.env.BIZNES_POLSKA_COOKIES || BIZNES_POLSKA_COOKIES);
        await PublicOrder.updateOne(
          { _id: order._id },
          {
            $set: {
              category: detail.category,
              addedDate: detail.addedDate,
              title: detail.title || '',
              region: detail.region || '',
              investor: detail.investor || '',
              address: detail.address || '',
              voivodeshipDistrict: detail.voivodeshipDistrict || '',
              country: detail.country || '',
              nip: detail.nip || '',
              phoneFax: detail.phoneFax || '',
              email: detail.email || '',
              website: detail.website || '',
              description: detail.description || '',
              requirements: detail.requirements || '',
              submissionPlaceAndDeadline: detail.submissionPlaceAndDeadline || '',
              placeAndTerm: detail.placeAndTerm || '',
              remarks: detail.remarks || '',
              contact: detail.contact || '',
              source: detail.source || '',
              branches: detail.branches || [],
              originalContentUrl: detail.originalContentUrl || '',
              offerStatus: detail.offerStatus || '',
              detailFullText: detail.detailFullText || '',
              detailRawHtml: detail.detailRawHtml || ''
            }
          }
        );
        updated++;
      } catch (e) {
        errors.push(`${order._id}: ${e.message || String(e)}`);
      }
    }
    res.json({
      message: `Zaktualizowano szczegóły dla ${updated} z ${orders.length} zleceń.`,
      updated,
      total: orders.length,
      errors: errors.length ? errors : undefined
    });
  } catch (e) {
    console.error('Refresh details error:', e);
    res.status(500).json({ message: e.message || 'Błąd odświeżania szczegółów' });
  }
});

/** Pobierz sekcje promptów (profil firmy dla AI). Tylko admin. */
router.get('/prompts', auth, requireRole(['admin']), async (req, res) => {
  try {
    const sections = getSectionsSync();
    res.json({ sections });
  } catch (e) {
    console.error('Prompts get error:', e);
    res.status(500).json({ message: 'Błąd pobierania promptów' });
  }
});

/** Zapisz sekcje promptów. Tylko admin. */
router.put('/prompts', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { sections } = req.body || {};
    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({ message: 'Wymagane body.sections (obiekt z polami: intro, uslugi, odpadaja, mozemy, dopiski)' });
    }
    const normalized = {
      intro: String(sections.intro ?? '').trim(),
      uslugi: String(sections.uslugi ?? '').trim(),
      odpadaja: String(sections.odpadaja ?? '').trim(),
      mozemy: String(sections.mozemy ?? '').trim(),
      dopiski: String(sections.dopiski ?? '').trim()
    };
    await PublicOrderPrompts.findByIdAndUpdate(
      'default',
      { $set: { sections: normalized, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    setSectionsCache(normalized);
    res.json({ message: 'Prompty zapisane', sections: normalized });
  } catch (e) {
    console.error('Prompts put error:', e);
    res.status(500).json({ message: 'Błąd zapisywania promptów' });
  }
});

/** Zadania przypisane do zlecenia (tylko dla „Robimy”) */
router.get('/:id/tasks', auth, async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id).select('weDoIt').lean();
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    if (!order.weDoIt) return res.json([]);
    const tasks = await Task.find({ publicOrder: req.params.id })
      .populate('assignee', 'firstName lastName email')
      .populate('assignees', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ dueDate: 1 })
      .lean();
    res.json(tasks);
  } catch (e) {
    console.error('Public order tasks error:', e);
    res.status(500).json({ message: 'Błąd pobierania zadań' });
  }
});

/** Aktualizacja zlecenia (Robimy, deadline, bez update’ów/załączników – te osobno) */
router.patch('/:id', auth, async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    const prevWeDoIt = order.weDoIt;
    const { weDoIt, customDeadline } = req.body || {};
    if (typeof weDoIt === 'boolean') order.weDoIt = weDoIt;
    if (customDeadline !== undefined) order.customDeadline = customDeadline ? new Date(customDeadline) : null;
    await order.save();
    if (weDoIt === true && !prevWeDoIt) {
      const lean = await PublicOrder.findById(order._id).lean();
      notifyPublicOrderSubscribers(lean, 'we_do_it', {
        changedBy: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : null
      }).catch(err => console.error('[PATCH public order] notify:', err));
    }
    const doc = await PublicOrder.findById(order._id).lean();
    res.json(doc);
  } catch (e) {
    console.error('Public order patch error:', e);
    res.status(500).json({ message: 'Błąd aktualizacji zlecenia' });
  }
});

/** Dodanie update’u (notatki) do zlecenia */
router.post('/:id/updates', auth, async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Treść update\'u jest wymagana' });
    order.internalUpdates = order.internalUpdates || [];
    order.internalUpdates.push({
      text,
      author: req.user._id,
      createdAt: new Date()
    });
    await order.save();
    await order.populate('internalUpdates.author', 'firstName lastName');
    const doc = await PublicOrder.findById(order._id).populate('internalUpdates.author', 'firstName lastName').lean();
    if (order.weDoIt) {
      notifyPublicOrderSubscribers(doc, 'update', {
        updateText: text,
        changedBy: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : null
      }).catch(err => console.error('[POST public order update] notify:', err));
    }
    res.status(201).json(doc);
  } catch (e) {
    console.error('Public order updates error:', e);
    res.status(500).json({ message: 'Błąd dodawania update\'u' });
  }
});

/** Upload załącznika do zlecenia */
router.post('/:id/attachments', auth, upload.single('file'), async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    if (!req.file) return res.status(400).json({ message: 'Brak pliku' });
    const name = (req.body?.name || req.file.originalname || req.file.filename || 'plik').trim() || 'plik';
    order.attachments = order.attachments || [];
    order.attachments.push({
      name,
      path: `/uploads/public-orders/${req.file.filename}`,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    });
    await order.save();
    const doc = await PublicOrder.findById(order._id).lean();
    res.status(201).json(doc);
  } catch (e) {
    console.error('Public order attachment upload error:', e);
    res.status(500).json({ message: 'Błąd dodawania załącznika' });
  }
});

/** Usunięcie załącznika (index w tablicy) */
router.delete('/:id/attachments/:index', auth, async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx) || idx < 0 || !order.attachments || !order.attachments[idx]) {
      return res.status(400).json({ message: 'Nieprawidłowy indeks załącznika' });
    }
    const filePath = path.join(__dirname, '..', order.attachments[idx].path.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    order.attachments.splice(idx, 1);
    await order.save();
    const doc = await PublicOrder.findById(order._id).lean();
    res.json(doc);
  } catch (e) {
    console.error('Public order attachment delete error:', e);
    res.status(500).json({ message: 'Błąd usuwania załącznika' });
  }
});

/** Jedno zlecenie po ID (Mongo _id lub biznesPolskaId) */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = /^[a-fA-F0-9]{24}$/.test(id);
    const doc = isMongoId
      ? await PublicOrder.findById(id).populate('internalUpdates.author', 'firstName lastName').lean()
      : await PublicOrder.findOne({ biznesPolskaId: id }).populate('internalUpdates.author', 'firstName lastName').lean();
    if (!doc) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });
    res.json(doc);
  } catch (e) {
    console.error('Public order get error:', e);
    res.status(500).json({ message: 'Błąd pobierania zlecenia' });
  }
});

/** Ręczna synchronizacja z Grupą Biznes Polska (tylko admin). Po syncu od razu AI dla nowych. */
router.post('/sync', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await runSync(undefined, { maxListPages: 50 });
    if (result.addedIds?.length > 0) {
      try {
        const aiStats = await runAiAnalysis({ orderIds: result.addedIds, batchSize: 20 });
        result.ai = aiStats;
      } catch (aiErr) {
        console.error('AI po sync:', aiErr.message);
        result.aiError = aiErr.message;
      }
    }
    res.json({
      message: `Dodano ${result.added} zleceń.${result.ai ? ` AI: ${result.ai.scored} ocenionych, ${result.ai.rejected} odrzuconych.` : ''}`,
      added: result.added,
      updated: result.updated,
      errors: result.errors.length ? result.errors : undefined,
      ai: result.ai,
      aiError: result.aiError
    });
  } catch (e) {
    console.error('Public orders sync error:', e);
    res.status(500).json({
      message: e.message || 'Błąd synchronizacji.'
    });
  }
});

/** Ręczna głęboka analiza AI dla jednego zlecenia (Sonnet). Tylko admin. */
router.post('/deep-analyze/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const order = await PublicOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: 'Nie znaleziono zlecenia' });

    const result = await deepAnalyzeOrder(order);
    await PublicOrder.findByIdAndUpdate(order._id, {
      aiDeepAnalysis: result,
      aiDeepAnalyzedAt: new Date()
    });

    res.json({
      message: 'Głęboka analiza zakończona',
      deepAnalysis: result
    });
  } catch (e) {
    console.error('Deep analyze error:', e);
    res.status(500).json({ message: e.message || 'Błąd głębokiej analizy AI' });
  }
});

/** Uruchom analizę AI dla ostatnich N zleceń (domyślnie 10). Tylko admin. */
router.post('/ai-analyze', auth, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.body.limit, 10) || 10));
    const stats = await runAiAnalysis({ limit, batchSize: 20 });
    res.json({
      message: `AI: przefiltrowano ${stats.filtered}, odrzucono ${stats.rejected}, kandydatów ${stats.candidates}, ocenionych ${stats.scored}, głęboko: ${stats.deepAnalyzed || 0}`,
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
