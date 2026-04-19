const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireScope } = require('../middleware/auth');
const Document = require('../models/Document');
const DocumentFolder = require('../models/DocumentFolder');

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

function normalizeFolder(input) {
  return String(input || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function getFolderNameFromPath(folderPath) {
  const normalized = normalizeFolder(folderPath);
  if (!normalized) return '';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

function getParentFolderPath(folderPath) {
  const normalized = normalizeFolder(folderPath);
  if (!normalized || !normalized.includes('/')) return '';
  return normalized.split('/').slice(0, -1).join('/');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureFolderExists(folderPath, userId) {
  const normalized = normalizeFolder(folderPath);
  if (!normalized) return null;

  const parts = normalized.split('/');
  let current = '';
  let lastFolder = null;

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const parentPath = getParentFolderPath(current);
    const name = getFolderNameFromPath(current);

    const existing = await DocumentFolder.findOne({ path: current });
    if (existing) {
      if (existing.parentPath !== parentPath || existing.name !== name) {
        existing.parentPath = parentPath;
        existing.name = name;
        existing.updatedBy = userId;
        await existing.save();
      }
      lastFolder = existing;
      continue;
    }

    lastFolder = await DocumentFolder.create({
      name,
      path: current,
      parentPath,
      createdBy: userId,
      updatedBy: userId
    });
  }

  return lastFolder;
}

async function buildFolderTree() {
  const [folders, docCountsRaw] = await Promise.all([
    DocumentFolder.find({})
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ path: 1 })
      .lean(),
    Document.aggregate([
      {
        $group: {
          _id: '$folder',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const directDocCounts = new Map(
    docCountsRaw.map((row) => [normalizeFolder(row._id), row.count])
  );

  const nodesByPath = new Map();
  const roots = [];

  folders.forEach((folder) => {
    nodesByPath.set(folder.path, {
      ...folder,
      children: [],
      documentCount: directDocCounts.get(folder.path) || 0,
      totalDocumentCount: directDocCounts.get(folder.path) || 0,
      childFolderCount: 0
    });
  });

  folders.forEach((folder) => {
    const node = nodesByPath.get(folder.path);
    if (!folder.parentPath) {
      roots.push(node);
      return;
    }
    const parent = nodesByPath.get(folder.parentPath);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const finalizeNode = (node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    node.childFolderCount = node.children.length;
    node.totalDocumentCount = node.documentCount;
    node.children.forEach((child) => {
      finalizeNode(child);
      node.totalDocumentCount += child.totalDocumentCount;
    });
  };

  roots.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  roots.forEach(finalizeNode);

  return roots;
}

// Lista dokumentów (chronologicznie)
router.get('/', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const { q, type, tag, slug, folder, folderPrefix, includeContent, limit = 100 } = req.query;
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
    if (folder !== undefined) {
      query.folder = normalizeFolder(folder);
    }
    if (folderPrefix) {
      const prefix = normalizeFolder(folderPrefix);
      if (prefix) {
        query.folder = { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|$)` };
      }
    }
    if (q) {
      const search = String(q).trim();
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { folder: { $regex: search, $options: 'i' } },
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

// Lista istniejących folderów
router.get('/folders/list', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const { type } = req.query;
    const query = { folder: { $ne: '' } };
    if (type) {
      query.type = normalizeType(type);
    }

    const folders = await Document.distinct('folder', query);
    const sorted = folders
      .map((folder) => normalizeFolder(folder))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pl'));

    res.json(sorted);
  } catch (e) {
    console.error('List document folders error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania folderów' });
  }
});

// Drzewo folderów do explorera
router.get('/folders/tree', auth, requireScope('documents:read'), async (req, res) => {
  try {
    const tree = await buildFolderTree();
    res.json(tree);
  } catch (e) {
    console.error('Get document folder tree error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania drzewa folderów' });
  }
});

// Tworzenie folderu
router.post(
  '/folders',
  [
    auth,
    requireScope('documents:write'),
    body('path').optional(),
    body('parentPath').optional(),
    body('name').optional().trim()
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

      const parentPath = normalizeFolder(req.body.parentPath);
      const name = String(req.body.name || '').trim();
      const derivedPath = req.body.path ? normalizeFolder(req.body.path) : normalizeFolder(parentPath ? `${parentPath}/${name}` : name);
      if (!derivedPath) {
        return res.status(400).json({ message: 'Podaj path albo parentPath + name' });
      }

      const existing = await DocumentFolder.findOne({ path: derivedPath })
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      if (existing) {
        return res.status(200).json(existing);
      }

      await ensureFolderExists(derivedPath, req.user._id);
      const folder = await DocumentFolder.findOne({ path: derivedPath })
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      res.status(201).json(folder);
    } catch (e) {
      console.error('Create document folder error:', e);
      res.status(500).json({ message: 'Błąd podczas tworzenia folderu' });
    }
  }
);

// Zmiana nazwy / przeniesienie folderu
router.patch(
  '/folders',
  [
    auth,
    requireScope('documents:write'),
    body('fromPath').trim().notEmpty().withMessage('fromPath jest wymagany'),
    body('toPath').trim().notEmpty().withMessage('toPath jest wymagany')
  ],
  async (req, res) => {
    const session = await Document.startSession();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Nieprawidłowe dane',
          errors: errors.array()
        });
      }

      const fromPath = normalizeFolder(req.body.fromPath);
      const toPath = normalizeFolder(req.body.toPath);
      if (!fromPath || !toPath) {
        return res.status(400).json({ message: 'Ścieżki folderów są wymagane' });
      }
      if (fromPath === toPath) {
        return res.status(400).json({ message: 'Folder docelowy musi być inny niż źródłowy' });
      }
      if (toPath === fromPath || toPath.startsWith(`${fromPath}/`)) {
        return res.status(400).json({ message: 'Nie można przenieść folderu do jego własnego wnętrza' });
      }

      const sourceFolder = await DocumentFolder.findOne({ path: fromPath });
      if (!sourceFolder) {
        return res.status(404).json({ message: 'Folder źródłowy nie istnieje' });
      }

      const targetExists = await DocumentFolder.findOne({ path: toPath });
      if (targetExists) {
        return res.status(400).json({ message: 'Folder docelowy już istnieje' });
      }

      const targetParent = getParentFolderPath(toPath);
      if (targetParent) {
        await ensureFolderExists(targetParent, req.user._id);
      }

      const folderRegex = new RegExp(`^${escapeRegex(fromPath)}(?:/|$)`);

      await session.withTransaction(async () => {
        const foldersToMove = await DocumentFolder.find({ path: folderRegex }).session(session);

        for (const folder of foldersToMove) {
          const suffix = folder.path === fromPath ? '' : folder.path.slice(fromPath.length);
          const nextPath = normalizeFolder(`${toPath}${suffix}`);
          folder.path = nextPath;
          folder.name = getFolderNameFromPath(nextPath);
          folder.parentPath = getParentFolderPath(nextPath);
          folder.updatedBy = req.user._id;
          await folder.save({ session });
        }

        const docsToMove = await Document.find({ folder: folderRegex }).session(session);
        for (const doc of docsToMove) {
          const suffix = doc.folder === fromPath ? '' : doc.folder.slice(fromPath.length);
          doc.folder = normalizeFolder(`${toPath}${suffix}`);
          doc.updatedBy = req.user._id;
          await doc.save({ session });
        }
      });

      const updatedFolder = await DocumentFolder.findOne({ path: toPath })
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      res.json(updatedFolder);
    } catch (e) {
      console.error('Move document folder error:', e);
      res.status(500).json({ message: 'Błąd podczas zmiany folderu' });
    } finally {
      await session.endSession();
    }
  }
);

// Usunięcie folderu - tylko pusty
router.delete('/folders', auth, requireScope('documents:write'), async (req, res) => {
  try {
    const folderPath = normalizeFolder(req.body.path || req.query.path);
    if (!folderPath) {
      return res.status(400).json({ message: 'path jest wymagany' });
    }

    const folder = await DocumentFolder.findOne({ path: folderPath });
    if (!folder) {
      return res.status(404).json({ message: 'Folder nie istnieje' });
    }

    const [childFolderCount, documentCount] = await Promise.all([
      DocumentFolder.countDocuments({ parentPath: folderPath }),
      Document.countDocuments({ folder: folderPath })
    ]);

    if (childFolderCount > 0 || documentCount > 0) {
      return res.status(400).json({
        message: 'Można usunąć tylko pusty folder',
        childFolderCount,
        documentCount
      });
    }

    await DocumentFolder.deleteOne({ _id: folder._id });
    res.json({ message: 'Folder usunięty' });
  } catch (e) {
    console.error('Delete document folder error:', e);
    res.status(500).json({ message: 'Błąd podczas usuwania folderu' });
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
      body('folder').optional(),
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
        folder: normalizeFolder(req.body.folder),
        content: (req.body.content || '').trim(),
        summary: (req.body.summary || '').trim(),
        tags: normalizeTags(req.body.tags),
        createdBy: req.user._id,
        updatedBy: req.user._id
      });

      if (doc.folder) {
        await ensureFolderExists(doc.folder, req.user._id);
      }

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
    body('folder').optional(),
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
      doc.folder = normalizeFolder(req.body.folder ?? doc.folder);
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
      if (doc.folder) {
        await ensureFolderExists(doc.folder, req.user._id);
      }

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
    body('folder').optional(),
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
      if (req.body.folder !== undefined) {
        doc.folder = normalizeFolder(req.body.folder);
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
      if (doc.folder) {
        await ensureFolderExists(doc.folder, req.user._id);
      }

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
    body('folder').optional(),
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
          folder: normalizeFolder(req.body.folder),
          summary: String(req.body.summary || '').trim(),
          tags: normalizeTags(req.body.tags),
          content: String(req.body.content || '').trim(),
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        if (doc.folder) {
          await ensureFolderExists(doc.folder, req.user._id);
        }
        const populatedCreated = await Document.findById(doc._id)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email')
          .lean();
        return res.status(201).json(populatedCreated);
      }

      if (req.body.title !== undefined) doc.title = req.body.title.trim();
      if (req.body.type !== undefined) doc.type = normalizeType(req.body.type);
      if (req.body.folder !== undefined) doc.folder = normalizeFolder(req.body.folder);
      if (req.body.summary !== undefined) doc.summary = String(req.body.summary || '').trim();
      if (req.body.tags !== undefined) doc.tags = normalizeTags(req.body.tags);
      if (req.body.content !== undefined) doc.content = String(req.body.content || '').trim();
      doc.updatedBy = req.user._id;
      await doc.save();
      if (doc.folder) {
        await ensureFolderExists(doc.folder, req.user._id);
      }

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

// Przeniesienie dokumentu do folderu
router.patch(
  '/:id/move',
  [
    auth,
    requireScope('documents:write'),
    body('folder').optional()
  ],
  async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: 'Dokument nie został znaleziony' });
      }

      doc.folder = normalizeFolder(req.body.folder);
      doc.updatedBy = req.user._id;
      await doc.save();
      if (doc.folder) {
        await ensureFolderExists(doc.folder, req.user._id);
      }

      const populated = await Document.findById(doc._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .lean();
      res.json(populated);
    } catch (e) {
      console.error('Move document error:', e);
      res.status(500).json({ message: 'Błąd podczas przenoszenia dokumentu' });
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
