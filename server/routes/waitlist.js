const express = require('express');
const router = express.Router();
const Waitlist = require('../models/Waitlist');
const { auth } = require('../middleware/auth');

// Public endpoint - add to waitlist
router.post('/', async (req, res) => {
  try {
    const { email, name, company, notes } = req.body;

    // Validate email
    if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
      return res.status(400).json({ message: 'Proszę podać prawidłowy adres email' });
    }

    // Check if email already exists
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({ 
        message: 'Ten adres email jest już na liście oczekujących',
        alreadyExists: true
      });
    }

    // Create waitlist entry
    const waitlistEntry = await Waitlist.create({
      email: email.toLowerCase(),
      name: name?.trim() || '',
      company: company?.trim() || '',
      notes: notes?.trim() || '',
      source: 'landing_page',
      status: 'pending'
    });

    res.status(201).json({
      message: 'Dziękujemy! Zostałeś dodany do listy oczekujących.',
      success: true,
      data: {
        email: waitlistEntry.email,
        createdAt: waitlistEntry.createdAt
      }
    });
  } catch (error) {
    console.error('Waitlist signup error:', error);
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(200).json({ 
        message: 'Ten adres email jest już na liście oczekujących',
        alreadyExists: true
      });
    }
    res.status(500).json({ message: 'Wystąpił błąd podczas dodawania do listy oczekujących' });
  }
});

// Protected endpoint - get all waitlist entries (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { status, page = 1, limit = 50 } = req.query;
    const query = status ? { status } : {};

    const entries = await Waitlist.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Waitlist.countDocuments(query);

    res.json({
      entries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Waitlist fetch error:', error);
    res.status(500).json({ message: 'Błąd podczas pobierania listy oczekujących' });
  }
});

// Protected endpoint - update waitlist entry status (admin only)
router.patch('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { status, notes } = req.body;
    const updateData = {};

    if (status) {
      updateData.status = status;
      if (status === 'contacted' || status === 'invited') {
        updateData.notifiedAt = new Date();
      }
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const entry = await Waitlist.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ message: 'Wpis nie został znaleziony' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Waitlist update error:', error);
    res.status(500).json({ message: 'Błąd podczas aktualizacji wpisu' });
  }
});

// Protected endpoint - delete waitlist entry (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const entry = await Waitlist.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Wpis nie został znaleziony' });
    }

    res.json({ message: 'Wpis został usunięty' });
  } catch (error) {
    console.error('Waitlist delete error:', error);
    res.status(500).json({ message: 'Błąd podczas usuwania wpisu' });
  }
});

module.exports = router;

