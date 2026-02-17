const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const Activity = require('../models/Activity');

const router = express.Router();

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane logowania',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Konto jest nieaktywne' });
    }

    // Update last login and log activity
    user.lastLogin = new Date();
    await user.save();
    try {
      await Activity.create({
        action: 'user.login',
        entityType: 'user',
        entityId: user._id,
        author: user._id,
        message: `User logged in: ${user.email}`
      });
    } catch (e) {}

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Zalogowano pomyślnie',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas logowania' });
  }
});

// Register (tylko dla adminów)
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 2 }),
  body('lastName').trim().isLength({ min: 2 }),
  body('role').isIn(['admin', 'manager', 'employee'])
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane rejestracji',
        errors: errors.array() 
      });
    }

    // Sprawdź czy użytkownik ma uprawnienia admina
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień do rejestracji użytkowników' });
    }

    const { email, password, firstName, lastName, role } = req.body;

    // Sprawdź czy email już istnieje
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Użytkownik z tym emailem już istnieje' });
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role
    });

    await user.save();

    res.status(201).json({
      message: 'Użytkownik został utworzony pomyślnie',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas rejestracji' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('email firstName lastName role avatar lastLogin settings').lean();
    if (!user) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }
    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        settings: user.settings || {}
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Update current user settings (e.g. tasks filters). Merges into existing settings.
router.patch('/me/settings', auth, async (req, res) => {
  try {
    const updates = req.body;
    if (typeof updates !== 'object' || updates === null) {
      return res.status(400).json({ message: 'Nieprawidłowy format ustawień' });
    }
    const setKeys = {};
    if (typeof updates.tasksFilters === 'object' && updates.tasksFilters !== null) {
      setKeys['settings.tasksFilters'] = updates.tasksFilters;
    }
    if (Object.keys(setKeys).length === 0) {
      const user = await User.findById(req.user._id).select('settings').lean();
      return res.json({ settings: user.settings || {} });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: setKeys },
      { new: true }
    ).select('settings').lean();
    res.json({ settings: user.settings || {} });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Logout (client-side token removal)
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Wylogowano pomyślnie' });
});

// List users (basic data) for team selection
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName email role avatar')
      .sort({ firstName: 1, lastName: 1 });
    res.json(users.map(u => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
      avatar: u.avatar
    })));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania użytkowników' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Nie możesz usunąć samego siebie' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Użytkownik nie istnieje' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Użytkownik usunięty' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania użytkownika' });
  }
});

module.exports = router; 

// List users (basic data) for team selection
// Note: export an additional router is not valid; append before module.exports if needed.