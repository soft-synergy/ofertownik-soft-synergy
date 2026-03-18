const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Document = require('../models/Document');

const router = express.Router();

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'dokument';
}

async function ensureUniqueSlug(slug, excludeId = null) {
  let base = slug;
  let candidate = base;
  let n = 0;
  const query = { slug: candidate };
  if (excludeId) query._id = { $ne: excludeId };
  while (await Document.findOne(query)) {
    n += 1;
    candidate = `${base}-${n}`;
    query.slug = candidate;
  }
  return candidate;
}

// Lista dokumentów (chronologicznie)
router.get('/', auth, async (req, res) => {
  try {
    const list = await Document.find({})
      .populate('createdBy', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(list);
  } catch (e) {
    console.error('List documents error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania dokumentów' });
  }
});

// Pojedynczy dokument (do edycji)
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    if (!doc) {
      return res.status(404).json({ message: 'Dokument nie został znaleziony' });
    }
    res.json(doc);
  } catch (e) {
    console.error('Get document error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania dokumentu' });
  }
});

// Utworzenie dokumentu
router.post(
  '/',
  [
    auth,
    body('title').trim().isLength({ min: 1 }).withMessage('Tytuł jest wymagany'),
    body('content').optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Nieprawidłowe dane',
          errors: errors.array()
        });
      }

      const title = req.body.title.trim();
      const rawSlug = (req.body.slug || '').trim() || slugify(title);
      const slug = await ensureUniqueSlug(rawSlug || slugify(title));

      const doc = await Document.create({
        title,
        slug,
        content: (req.body.content || '').trim(),
        createdBy: req.user._id
      });

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName')
        .lean();
      res.status(201).json(populated);
    } catch (e) {
      console.error('Create document error:', e);
      res.status(500).json({ message: 'Błąd podczas tworzenia dokumentu' });
    }
  }
);

// Aktualizacja dokumentu
router.put(
  '/:id',
  [
    auth,
    body('title').trim().isLength({ min: 1 }).withMessage('Tytuł jest wymagany'),
    body('content').optional(),
    body('slug').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Nieprawidłowe dane',
          errors: errors.array()
        });
      }

      const doc = await Document.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: 'Dokument nie został znaleziony' });
      }

      doc.title = req.body.title.trim();
      doc.content = (req.body.content ?? doc.content).trim();
      if (req.body.slug !== undefined) {
        const rawSlug = req.body.slug.trim() || slugify(doc.title);
        doc.slug = await ensureUniqueSlug(rawSlug, doc._id);
      }
      await doc.save();

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName')
        .lean();
      res.json(populated);
    } catch (e) {
      console.error('Update document error:', e);
      res.status(500).json({ message: 'Błąd podczas aktualizacji dokumentu' });
    }
  }
);

// Usunięcie dokumentu
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Dokument nie został znaleziony' });
    }
    res.json({ message: 'Dokument usunięty' });
  } catch (e) {
    console.error('Delete document error:', e);
    res.status(500).json({ message: 'Błąd podczas usuwania dokumentu' });
  }
});

module.exports = router;
