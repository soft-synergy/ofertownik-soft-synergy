const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireScope } = require('../middleware/auth');
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

function normalizeType(value) {
  return value === 'playbook' ? 'playbook' : 'document';
}

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return [...new Set(input
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean))];
  }

  if (typeof input === 'string') {
    return [...new Set(input
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean))];
  }

  return [];
}

// Lista dokumentów (chronologicznie)
router.get('/', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const { q, type, tag, slug, includeContent, limit = 100 } = req.query;
    const query = {};

    if (type) {
      query.type = normalizeType(type);
    }
    if (tag) {
      query.tags = String(tag).trim().toLowerCase();
    }
    if (slug) {
      query.slug = String(slug).trim().toLowerCase();
    }
    if (q) {
      const search = String(q).trim();
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const limitNum = Math.min(Number.parseInt(limit, 10) || 100, 500);
    const projection = includeContent === 'true' ? '' : '-content';

    const list = await Document.find(query)
      .select(projection)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .limit(limitNum)
      .lean();
    res.json(list);
  } catch (e) {
    console.error('List documents error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania dokumentów' });
  }
});

// Pojedynczy dokument po slug (stabilny identyfikator dla integracji)
router.get('/slug/:slug', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const doc = await Document.findOne({ slug: String(req.params.slug).trim().toLowerCase() })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();
    if (!doc) {
      return res.status(404).json({ message: 'Dokument nie został znaleziony' });
    }
    res.json(doc);
  } catch (e) {
    console.error('Get document by slug error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania dokumentu' });
  }
});

// Pojedynczy dokument (do edycji)
router.get('/:id', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
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
      requireScope('documents:write'),
      body('title').trim().isLength({ min: 1 }).withMessage('Tytuł jest wymagany'),
      body('type').optional().isIn(['document', 'playbook']),
      body('summary').optional(),
      body('tags').optional(),
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
        type: normalizeType(req.body.type),
        content: (req.body.content || '').trim(),
        summary: (req.body.summary || '').trim(),
        tags: normalizeTags(req.body.tags),
        createdBy: req.user._id,
        updatedBy: req.user._id
      });

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
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
    requireScope('documents:write'),
    body('title').trim().isLength({ min: 1 }).withMessage('Tytuł jest wymagany'),
    body('type').optional().isIn(['document', 'playbook']),
    body('summary').optional(),
    body('tags').optional(),
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
      doc.type = normalizeType(req.body.type ?? doc.type);
      doc.content = (req.body.content ?? doc.content).trim();
      doc.summary = (req.body.summary ?? doc.summary).trim();
      if (req.body.tags !== undefined) {
        doc.tags = normalizeTags(req.body.tags);
      }
      if (req.body.slug !== undefined) {
        const rawSlug = req.body.slug.trim() || slugify(doc.title);
        doc.slug = await ensureUniqueSlug(rawSlug, doc._id);
      }
      doc.updatedBy = req.user._id;
      await doc.save();

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      res.json(populated);
    } catch (e) {
      console.error('Update document error:', e);
      res.status(500).json({ message: 'Błąd podczas aktualizacji dokumentu' });
    }
  }
);

// Częściowa aktualizacja dokumentu
router.patch(
  '/:id',
  [
    auth,
    requireScope('documents:write'),
    body('title').optional().trim().isLength({ min: 1 }).withMessage('Tytuł nie może być pusty'),
    body('type').optional().isIn(['document', 'playbook']),
    body('summary').optional(),
    body('tags').optional(),
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

      if (req.body.title !== undefined) {
        doc.title = req.body.title.trim();
      }
      if (req.body.type !== undefined) {
        doc.type = normalizeType(req.body.type);
      }
      if (req.body.summary !== undefined) {
        doc.summary = String(req.body.summary || '').trim();
      }
      if (req.body.content !== undefined) {
        doc.content = String(req.body.content || '').trim();
      }
      if (req.body.tags !== undefined) {
        doc.tags = normalizeTags(req.body.tags);
      }
      if (req.body.slug !== undefined) {
        const rawSlug = req.body.slug.trim() || slugify(doc.title);
        doc.slug = await ensureUniqueSlug(rawSlug, doc._id);
      }

      doc.updatedBy = req.user._id;
      await doc.save();

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      res.json(populated);
    } catch (e) {
      console.error('Patch document error:', e);
      res.status(500).json({ message: 'Błąd podczas aktualizacji dokumentu' });
    }
  }
);

// Upsert dokumentu po slug - wygodne dla Claude
router.put(
  '/slug/:slug',
  [
    auth,
    requireScope('documents:write'),
    body('title').optional().trim(),
    body('type').optional().isIn(['document', 'playbook']),
    body('summary').optional(),
    body('tags').optional(),
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

      const rawSlug = String(req.params.slug || '').trim().toLowerCase();
      if (!rawSlug) {
        return res.status(400).json({ message: 'Slug jest wymagany' });
      }

      const normalizedSlug = slugify(rawSlug);
      if (!normalizedSlug) {
        return res.status(400).json({ message: 'Slug jest nieprawidłowy' });
      }

      let doc = await Document.findOne({ slug: normalizedSlug });

      if (!doc) {
        const title = String(req.body.title || normalizedSlug).trim() || normalizedSlug;
        doc = await Document.create({
          title,
          slug: normalizedSlug,
          type: normalizeType(req.body.type),
          summary: String(req.body.summary || '').trim(),
          tags: normalizeTags(req.body.tags),
          content: String(req.body.content || '').trim(),
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        const populatedCreated = await Document.findById(doc._id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email')
          .lean();
        return res.status(201).json(populatedCreated);
      }

      if (req.body.title !== undefined) doc.title = req.body.title.trim();
      if (req.body.type !== undefined) doc.type = normalizeType(req.body.type);
      if (req.body.summary !== undefined) doc.summary = String(req.body.summary || '').trim();
      if (req.body.tags !== undefined) doc.tags = normalizeTags(req.body.tags);
      if (req.body.content !== undefined) doc.content = String(req.body.content || '').trim();
      doc.updatedBy = req.user._id;
      await doc.save();

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      return res.json(populated);
    } catch (e) {
      console.error('Upsert document by slug error:', e);
      return res.status(500).json({ message: 'Błąd podczas zapisu dokumentu' });
    }
  }
);

// Usunięcie dokumentu
router.delete('/:id', auth, requireScope('documents:write'), async (req, res) => {
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
