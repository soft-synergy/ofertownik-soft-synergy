const express = require('express');
const { body, validationResult } = require('express-validator');
const ReviewRequest = require('../models/ReviewRequest');
const { auth } = require('../middleware/auth');
const {
  createReviewToken,
  getReviewUrl,
  sendReviewRequestEmail,
  sendReviewThankYouEmail
} = require('../utils/reviewRequests');

const router = express.Router();

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof input === 'string') {
    return input.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
  }
  return [];
}

function buildSummary(items) {
  const responded = items.filter((item) => item.status === 'responded');
  const testimonials = responded.filter((item) => item.response?.testimonial && item.response?.allowPublicUse);
  const avgRatingBase = responded.filter((item) => Number.isFinite(item.response?.rating));
  const avgNpsBase = responded.filter((item) => Number.isFinite(item.response?.likelyToRecommend));
  const improvementMap = new Map();

  responded.forEach((item) => {
    const text = String(item.response?.whatCanBeImproved || '').trim();
    if (!text) return;
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .forEach((line) => {
        improvementMap.set(line, (improvementMap.get(line) || 0) + 1);
      });
  });

  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    responded: responded.length,
    declined: items.filter((item) => item.status === 'declined').length,
    paused: items.filter((item) => item.status === 'paused').length,
    publicTestimonials: testimonials.length,
    avgRating: avgRatingBase.length
      ? Number((avgRatingBase.reduce((sum, item) => sum + Number(item.response.rating), 0) / avgRatingBase.length).toFixed(2))
      : null,
    avgNps: avgNpsBase.length
      ? Number((avgNpsBase.reduce((sum, item) => sum + Number(item.response.likelyToRecommend), 0) / avgNpsBase.length).toFixed(2))
      : null,
    latestTestimonials: testimonials
      .sort((a, b) => new Date(b.response.respondedAt || 0) - new Date(a.response.respondedAt || 0))
      .slice(0, 5)
      .map((item) => ({
        id: item._id,
        clientName: item.response.clientName || item.clientName || item.email,
        companyName: item.response.companyName || item.companyName || '',
        testimonial: item.response.testimonial,
        rating: item.response.rating,
        projectName: item.projectName || '',
        respondedAt: item.response.respondedAt
      })),
    topImprovementThemes: Array.from(improvementMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }))
  };
}

router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { email: pattern },
        { clientName: pattern },
        { companyName: pattern },
        { projectName: pattern },
        { sourceLabel: pattern },
        { 'response.testimonial': pattern },
        { 'response.whatCanBeImproved': pattern }
      ];
    }

    const items = await ReviewRequest.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      items,
      summary: buildSummary(items),
      publicBaseUrl: `${process.env.APP_URL || 'https://ofertownik.soft-synergy.com'}/opinie`
    });
  } catch (error) {
    console.error('Review list error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania opinii' });
  }
});

router.post('/', [
  auth,
  body('email').isEmail().normalizeEmail(),
  body('clientName').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('companyName').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('projectName').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('sourceLabel').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane prośby o opinię', errors: errors.array() });
    }

    const review = new ReviewRequest({
      email: req.body.email,
      clientName: req.body.clientName || '',
      companyName: req.body.companyName || '',
      projectName: req.body.projectName || '',
      sourceLabel: req.body.sourceLabel || '',
      notes: req.body.notes || '',
      token: createReviewToken(),
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await sendReviewRequestEmail(review, 'initial');
    await review.save();

    res.status(201).json({
      message: 'Prośba o opinię została utworzona i wysłana',
      item: review,
      publicUrl: getReviewUrl(review.token)
    });
  } catch (error) {
    console.error('Review create error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia prośby o opinię' });
  }
});

router.post('/:id/resend', auth, async (req, res) => {
  try {
    const review = await ReviewRequest.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Nie znaleziono prośby o opinię' });
    }

    if (review.status === 'responded' || review.status === 'declined' || review.status === 'archived') {
      return res.status(400).json({ message: 'Nie można wysłać przypomnienia dla zamkniętej prośby' });
    }

    review.updatedBy = req.user._id;
    await sendReviewRequestEmail(review, 'manual_reminder');
    await review.save();

    res.json({
      message: 'Przypomnienie zostało wysłane',
      item: review
    });
  } catch (error) {
    console.error('Review resend error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas wysyłki przypomnienia' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const review = await ReviewRequest.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Nie znaleziono prośby o opinię' });
    }

    const allowedStatuses = ['pending', 'responded', 'declined', 'paused', 'archived'];
    if (req.body.status && allowedStatuses.includes(req.body.status)) {
      review.status = req.body.status;
      if (req.body.status !== 'pending') {
        review.nextFollowUpAt = null;
      }
    }
    if (req.body.notes != null) review.notes = String(req.body.notes).trim().slice(0, 1000);
    if (req.body.internalTags != null) review.internalTags = normalizeTags(req.body.internalTags);
    review.updatedBy = req.user._id;
    await review.save();

    res.json({
      message: 'Prośba o opinię została zaktualizowana',
      item: review
    });
  } catch (error) {
    console.error('Review patch error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji opinii' });
  }
});

router.get('/public/:token', async (req, res) => {
  try {
    const item = await ReviewRequest.findOne({ token: req.params.token }).lean();
    if (!item || item.status === 'archived') {
      return res.status(404).json({ message: 'Ten link do opinii jest nieaktywny' });
    }

    res.json({
      item: {
        email: item.email,
        clientName: item.clientName,
        companyName: item.companyName,
        projectName: item.projectName,
        sourceLabel: item.sourceLabel,
        status: item.status,
        alreadyResponded: item.status === 'responded',
        response: item.response || null
      }
    });
  } catch (error) {
    console.error('Review public get error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania formularza opinii' });
  }
});

router.post('/public/:token/submit', [
  body('mode').isIn(['testimonial', 'feedback_only']),
  body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('likelyToRecommend').optional({ nullable: true }).isInt({ min: 0, max: 10 }),
  body('testimonial').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('whatWorkedWell').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('whatCanBeImproved').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('clientName').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('clientRole').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('companyName').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('allowPublicUse').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane opinii', errors: errors.array() });
    }

    const review = await ReviewRequest.findOne({ token: req.params.token });
    if (!review || review.status === 'archived') {
      return res.status(404).json({ message: 'Ten link do opinii jest nieaktywny' });
    }

    review.response = {
      mode: req.body.mode,
      rating: req.body.rating != null && req.body.rating !== '' ? Number(req.body.rating) : null,
      likelyToRecommend: req.body.likelyToRecommend != null && req.body.likelyToRecommend !== '' ? Number(req.body.likelyToRecommend) : null,
      testimonial: String(req.body.testimonial || '').trim(),
      whatWorkedWell: String(req.body.whatWorkedWell || '').trim(),
      whatCanBeImproved: String(req.body.whatCanBeImproved || '').trim(),
      clientName: String(req.body.clientName || review.clientName || '').trim(),
      clientRole: String(req.body.clientRole || '').trim(),
      companyName: String(req.body.companyName || review.companyName || '').trim(),
      allowPublicUse: !!req.body.allowPublicUse,
      respondedAt: new Date()
    };

    if (
      review.response.mode === 'feedback_only' &&
      !review.response.whatCanBeImproved &&
      !review.response.whatWorkedWell
    ) {
      return res.status(400).json({ message: 'Dodaj choć krótką informację, co mogliśmy zrobić lepiej lub co zadziałało dobrze.' });
    }

    review.status = review.response.mode === 'feedback_only' ? 'declined' : 'responded';
    review.nextFollowUpAt = null;
    await review.save();
    await sendReviewThankYouEmail(review);

    res.json({
      message: 'Dziękujemy za opinię',
      item: {
        status: review.status,
        response: review.response
      }
    });
  } catch (error) {
    console.error('Review public submit error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas zapisu opinii' });
  }
});

module.exports = router;
