const express = require('express');
const { body, validationResult } = require('express-validator');
const Hosting = require('../models/Hosting');
const { auth, requireRole } = require('../middleware/auth');
const Activity = require('../models/Activity');

const router = express.Router();

// Wszystkie routes wymagają autoryzacji i roli admin
router.use(auth);
router.use(requireRole(['admin']));

// Get all hosting entries
router.get('/', async (req, res) => {
  try {
    const { status, overdue, search } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (overdue === 'true') {
      query.status = { $in: ['active', 'overdue'] };
      query.nextPaymentDate = { $lt: new Date() };
    }

    if (search) {
      query.$or = [
        { domain: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { clientEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const hosting = await Hosting.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('paymentHistory.recordedBy', 'firstName lastName')
      .sort({ nextPaymentDate: 1, createdAt: -1 });

    res.json(hosting);
  } catch (error) {
    console.error('Get hosting error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania hostingu' });
  }
});

// Get single hosting entry
router.get('/:id', async (req, res) => {
  try {
    const hosting = await Hosting.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('paymentHistory.recordedBy', 'firstName lastName');

    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    res.json(hosting);
  } catch (error) {
    console.error('Get hosting error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania hostingu' });
  }
});

// Create new hosting entry
router.post('/', [
  body('domain').trim().isLength({ min: 3 }).isLowercase(),
  body('clientName').trim().isLength({ min: 2 }),
  body('clientEmail').optional({ checkFalsy: true }).isEmail(),
  body('monthlyPrice').isFloat({ min: 0 }),
  body('startDate').optional().isISO8601(),
  body('nextPaymentDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane hostingu',
        errors: errors.array() 
      });
    }

    const hostingData = {
      ...req.body,
      createdBy: req.user._id
    };

    const hosting = new Hosting(hostingData);
    await hosting.save();

    // Log activity
    try {
      await Activity.create({
        action: 'hosting.created',
        entityType: 'hosting',
        entityId: hosting._id,
        author: req.user._id,
        message: `Hosting created: "${hosting.domain}" for ${hosting.clientName}`
      });
    } catch (e) {}

    const populatedHosting = await Hosting.findById(hosting._id)
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      message: 'Hosting został utworzony pomyślnie',
      hosting: populatedHosting
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Domena już istnieje w systemie' });
    }
    console.error('Create hosting error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia hostingu' });
  }
});

// Update hosting entry
router.put('/:id', [
  body('domain').optional().trim().isLength({ min: 3 }).isLowercase(),
  body('clientName').optional().trim().isLength({ min: 2 }),
  body('clientEmail').optional({ checkFalsy: true }).isEmail(),
  body('monthlyPrice').optional().isFloat({ min: 0 }),
  body('nextPaymentDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane hostingu',
        errors: errors.array() 
      });
    }

    const hosting = await Hosting.findById(req.params.id);
    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    Object.assign(hosting, req.body);
    await hosting.save();

    // Log activity
    try {
      await Activity.create({
        action: 'hosting.updated',
        entityType: 'hosting',
        entityId: hosting._id,
        author: req.user._id,
        message: `Hosting updated: "${hosting.domain}"`
      });
    } catch (e) {}

    const populatedHosting = await Hosting.findById(hosting._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('paymentHistory.recordedBy', 'firstName lastName');

    res.json({
      message: 'Hosting został zaktualizowany pomyślnie',
      hosting: populatedHosting
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Domena już istnieje w systemie' });
    }
    console.error('Update hosting error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji hostingu' });
  }
});

// Record payment
router.post('/:id/payment', [
  body('amount').isFloat({ min: 0 }),
  body('paidDate').isISO8601(),
  body('periodStart').isISO8601(),
  body('periodEnd').isISO8601(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane płatności',
        errors: errors.array() 
      });
    }

    const hosting = await Hosting.findById(req.params.id);
    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    // Add payment to history
    hosting.paymentHistory.push({
      amount: req.body.amount,
      paidDate: new Date(req.body.paidDate),
      periodStart: new Date(req.body.periodStart),
      periodEnd: new Date(req.body.periodEnd),
      notes: req.body.notes || '',
      recordedBy: req.user._id
    });

    // Update last payment date and next payment date
    hosting.lastPaymentDate = new Date(req.body.paidDate);
    
    // Calculate next payment date based on billing cycle
    const nextDate = new Date(req.body.periodEnd);
    if (hosting.billingCycle === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (hosting.billingCycle === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (hosting.billingCycle === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    hosting.nextPaymentDate = nextDate;

    // Update status if overdue
    if (hosting.status === 'overdue') {
      hosting.status = 'active';
    }

    await hosting.save();

    // Log activity
    try {
      await Activity.create({
        action: 'hosting.payment.recorded',
        entityType: 'hosting',
        entityId: hosting._id,
        author: req.user._id,
        message: `Payment recorded for "${hosting.domain}": ${req.body.amount} PLN`
      });
    } catch (e) {}

    const populatedHosting = await Hosting.findById(hosting._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('paymentHistory.recordedBy', 'firstName lastName');

    res.json({
      message: 'Płatność została zapisana',
      hosting: populatedHosting
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas zapisywania płatności' });
  }
});

// Add reminder
router.post('/:id/reminder', [
  body('type').isIn(['payment_due', 'overdue', 'suspension_warning']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane przypomnienia',
        errors: errors.array() 
      });
    }

    const hosting = await Hosting.findById(req.params.id);
    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    hosting.reminders.push({
      type: req.body.type,
      notes: req.body.notes || '',
      sentAt: new Date()
    });

    await hosting.save();

    res.json({
      message: 'Przypomnienie zostało dodane',
      hosting
    });
  } catch (error) {
    console.error('Add reminder error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas dodawania przypomnienia' });
  }
});

// Update status
router.put('/:id/status', [
  body('status').isIn(['active', 'overdue', 'suspended', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowy status',
        errors: errors.array() 
      });
    }

    const hosting = await Hosting.findById(req.params.id);
    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    hosting.status = req.body.status;
    
    if (req.body.status === 'suspended' && !hosting.suspendedAt) {
      hosting.suspendedAt = new Date();
    } else if (req.body.status !== 'suspended') {
      hosting.suspendedAt = null;
    }

    if (req.body.status === 'cancelled' && !hosting.cancelledAt) {
      hosting.cancelledAt = new Date();
    }

    await hosting.save();

    // Log activity
    try {
      await Activity.create({
        action: 'hosting.status.changed',
        entityType: 'hosting',
        entityId: hosting._id,
        author: req.user._id,
        message: `Hosting status changed: "${hosting.domain}" -> ${req.body.status}`
      });
    } catch (e) {}

    res.json({
      message: 'Status został zaktualizowany',
      hosting
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji statusu' });
  }
});

// Delete hosting entry
router.delete('/:id', async (req, res) => {
  try {
    const hosting = await Hosting.findById(req.params.id);
    if (!hosting) {
      return res.status(404).json({ message: 'Wpis hostingu nie został znaleziony' });
    }

    await Hosting.findByIdAndDelete(req.params.id);

    // Log activity
    try {
      await Activity.create({
        action: 'hosting.deleted',
        entityType: 'hosting',
        entityId: hosting._id,
        author: req.user._id,
        message: `Hosting deleted: "${hosting.domain}"`
      });
    } catch (e) {}

    res.json({ message: 'Hosting został usunięty' });
  } catch (error) {
    console.error('Delete hosting error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania hostingu' });
  }
});

// Get stats
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await Hosting.countDocuments();
    const active = await Hosting.countDocuments({ status: 'active' });
    const overdue = await Hosting.countDocuments({ status: 'overdue' });
    const suspended = await Hosting.countDocuments({ status: 'suspended' });
    
    const now = new Date();
    const overduePayments = await Hosting.countDocuments({
      status: { $in: ['active', 'overdue'] },
      nextPaymentDate: { $lt: now }
    });

    const totalMonthlyRevenue = await Hosting.aggregate([
      { $match: { status: { $in: ['active', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$monthlyPrice' } } }
    ]);

    res.json({
      total,
      active,
      overdue,
      suspended,
      overduePayments,
      totalMonthlyRevenue: totalMonthlyRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania statystyk' });
  }
});

module.exports = router;
