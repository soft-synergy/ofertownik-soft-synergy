const express = require('express');
const Lead = require('../models/Lead');
const { auth } = require('../middleware/auth');

const router = express.Router();

/** GET /api/leads – lista leadów (auth). Query: status, archived, page, limit */
router.get('/', auth, async (req, res) => {
  try {
    const { status, archived, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status.trim()) query.status = status.trim();
    if (archived !== undefined && archived !== '') {
      query.archived = archived === 'true' || archived === true;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      Lead.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lead.countDocuments(query)
    ]);

    res.json({
      items,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: Math.max(1, parseInt(page, 10))
    });
  } catch (e) {
    console.error('Leads list error:', e);
    res.status(500).json({ message: 'Błąd pobierania listy leadów' });
  }
});

/** POST /api/leads – dodaj lead (auth) */
router.post('/', auth, async (req, res) => {
  try {
    const { sourceUrl, title, portal, notes } = req.body;
    if (!sourceUrl || !title || !String(sourceUrl).trim() || !String(title).trim()) {
      return res.status(400).json({ message: 'Podaj link (sourceUrl) i tytuł (title)' });
    }

    const lead = await Lead.create({
      sourceUrl: String(sourceUrl).trim(),
      title: String(title).trim(),
      portal: (portal && String(portal).trim()) || '',
      notes: (notes && String(notes).trim()) || '',
      status: 'pending_review',
      createdBy: req.user._id
    });

    const populated = await Lead.findById(lead._id)
      .populate('createdBy', 'firstName lastName email')
      .lean();

    res.status(201).json(populated);
  } catch (e) {
    console.error('Lead create error:', e);
    res.status(500).json({ message: 'Błąd dodawania leada' });
  }
});

/** PATCH /api/leads/:id/approve – zatwierdź lead (auth, admin lub twórca) */
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nie znaleziony' });

    const isAdmin = req.user.role === 'admin';
    const isCreator = lead.createdBy && lead.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator) return res.status(403).json({ message: 'Brak uprawnień' });

    const reviewComment = (req.body.reviewComment && String(req.body.reviewComment).trim()) || '';

    lead.status = 'approved';
    lead.reviewedBy = req.user._id;
    lead.reviewedAt = new Date();
    lead.reviewComment = reviewComment;
    lead.archived = false;
    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .lean();

    res.json(populated);
  } catch (e) {
    console.error('Lead approve error:', e);
    res.status(500).json({ message: 'Błąd zatwierdzania leada' });
  }
});

/** PATCH /api/leads/:id/reject – odrzuć lead (auth) */
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nie znaleziony' });

    const isAdmin = req.user.role === 'admin';
    const isCreator = lead.createdBy && lead.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator) return res.status(403).json({ message: 'Brak uprawnień' });

    const reviewComment = (req.body.reviewComment && String(req.body.reviewComment).trim()) || '';

    lead.status = 'rejected';
    lead.reviewedBy = req.user._id;
    lead.reviewedAt = new Date();
    lead.reviewComment = reviewComment;
    lead.archived = true;
    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .lean();

    res.json(populated);
  } catch (e) {
    console.error('Lead reject error:', e);
    res.status(500).json({ message: 'Błąd odrzucania leada' });
  }
});

/** PATCH /api/leads/:id/offer – zapisz dane wysłanej oferty (auth) */
router.patch('/:id/offer', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nie znaleziony' });

    const { content, valuePln, channel } = req.body;

    lead.offerDetails = lead.offerDetails || {};
    if (content !== undefined) lead.offerDetails.content = String(content || '').trim();
    if (valuePln !== undefined) lead.offerDetails.valuePln = valuePln == null ? null : Number(valuePln);
    if (channel !== undefined) lead.offerDetails.channel = String(channel || '').trim();
    lead.offerDetails.sentAt = lead.offerDetails.sentAt || new Date();
    lead.status = 'offer_sent';
    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .lean();

    res.json(populated);
  } catch (e) {
    console.error('Lead offer save error:', e);
    res.status(500).json({ message: 'Błąd zapisywania oferty' });
  }
});

module.exports = router;
