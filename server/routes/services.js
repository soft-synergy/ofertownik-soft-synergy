const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

/** Zwraca obiekt usługi z polami name, description, priceLabel, image w wybranym języku (pl/en). Bez lang zwraca surowe pola _pl/_en. */
function resolveServiceForLang(service, lang) {
  if (!lang || !['pl', 'en'].includes(lang)) {
    return service;
  }
  const doc = service.toObject ? service.toObject() : { ...service };
  const name = lang === 'pl' ? (doc.namePl || doc.name) : (doc.nameEn || doc.name);
  const description = lang === 'pl' ? (doc.descriptionPl || doc.description) : (doc.descriptionEn || doc.description);
  const priceLabel = lang === 'pl' ? (doc.priceLabelPl || doc.priceLabel || '') : (doc.priceLabelEn || doc.priceLabel || '');
  const image = lang === 'pl' ? (doc.imagePl || doc.image) : (doc.imageEn || doc.image);
  return { ...doc, name: name || '', description: description || '', priceLabel, image: image || null };
}

const uploadDir = 'uploads/services/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (mime && ext) return cb(null, true);
    cb(new Error('Tylko pliki obrazów (jpeg, jpg, png, webp) są dozwolone.'));
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'imagePl', maxCount: 1 },
  { name: 'imageEn', maxCount: 1 }
]);

const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Plik jest zbyt duży. Maksymalny rozmiar to 10MB.' });
      }
      return res.status(400).json({ message: err.message || 'Błąd podczas przetwarzania pliku' });
    }
    next();
  });
};

// GET /api/services/documentation
router.get('/documentation', (req, res) => {
  res.json({
    title: 'Services API Documentation',
    version: '1.0.0',
    baseUrl: '/api/services',
    endpoints: [
      {
        method: 'GET',
        path: '/',
        description: 'Pobierz listę usług',
        auth: false,
        queryParams: {
          category: 'Filtruj po kategorii (development, consulting, hosting, maintenance, other)',
          active: 'Filtruj po statusie (true, false)',
          lang: 'pl | en – zwraca name, description, priceLabel w wybranym języku; bez lang zwraca namePl, nameEn, descriptionPl, descriptionEn, priceLabelPl, priceLabelEn'
        },
        response: { type: 'array', items: 'Service' }
      },
      {
        method: 'GET',
        path: '/:id',
        description: 'Pobierz pojedynczą usługę po ID',
        auth: false,
        response: { type: 'object', item: 'Service' }
      },
      {
        method: 'POST',
        path: '/',
        description: 'Utwórz nową usługę',
        auth: true,
        role: ['admin', 'manager'],
        contentType: 'multipart/form-data',
        body: {
          name: 'string (wymagane, min 2 znaki)',
          description: 'string (wymagane, min 10 znaków)',
          category: 'development|consulting|hosting|maintenance|other (wymagane)',
          image: 'file (opcjonalne, jpeg|jpg|png|webp, max 10MB)',
          priceMin: 'number (opcjonalne)',
          priceMax: 'number (opcjonalne)',
          priceLabel: 'string (opcjonalne, np. "od 500 zł")',
          isActive: 'boolean (opcjonalne, domyślnie true)'
        }
      },
      {
        method: 'PUT',
        path: '/:id',
        description: 'Aktualizuj usługę',
        auth: true,
        role: ['admin', 'manager'],
        contentType: 'multipart/form-data',
        body: {
          name: 'string (opcjonalne)',
          description: 'string (opcjonalne)',
          category: 'string (opcjonalne)',
          image: 'file (opcjonalne)',
          priceMin: 'number (opcjonalne)',
          priceMax: 'number (opcjonalne)',
          priceLabel: 'string (opcjonalne)',
          isActive: 'boolean (opcjonalne)'
        }
      },
      {
        method: 'DELETE',
        path: '/:id',
        description: 'Usuń usługę',
        auth: true,
        role: ['admin', 'manager']
      },
      {
        method: 'PUT',
        path: '/order/batch',
        description: 'Zaktualizuj kolejność usług (tablica { id, order })',
        auth: true,
        role: ['admin', 'manager'],
        body: { updates: 'array of { id: string, order: number }' }
      },
      {
        method: 'PATCH',
        path: '/:id/toggle',
        description: 'Przełącz status aktywności usługi',
        auth: true,
        role: ['admin', 'manager']
      }
    ],
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Token z endpointu /api/auth/login'
    },
    errors: {
      400: 'Bad Request – nieprawidłowe dane',
      401: 'Unauthorized – brak lub nieprawidłowy token',
      403: 'Forbidden – brak uprawnień',
      404: 'Not Found – usługa nie znaleziona',
      500: 'Internal Server Error'
    }
  });
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { category, active, lang } = req.query;
    const query = {};
    if (category) query.category = category;
    if (active !== undefined) query.isActive = active === 'true';

    const services = await Service.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ order: 1, createdAt: -1 });
    const list = services.map((s) => (lang === 'pl' || lang === 'en' ? resolveServiceForLang(s, lang) : s));
    res.json(list);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania usług' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    const service = await Service.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    if (!service) {
      return res.status(404).json({ message: 'Usługa nie została znaleziona' });
    }
    const out = lang === 'pl' || lang === 'en' ? resolveServiceForLang(service, lang) : service;
    res.json(out);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania usługi' });
  }
});

// POST /
router.post('/', [
  auth,
  requireRole(['admin', 'manager']),
  (req, res, next) => { req.setTimeout(300000); res.setTimeout(300000); next(); },
  uploadMiddleware,
  body('name').optional().trim().isLength({ min: 2 }),
  body('namePl').optional().trim().isLength({ min: 2 }),
  body('nameEn').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('descriptionPl').optional().trim().isLength({ min: 10 }),
  body('descriptionEn').optional().trim().isLength({ min: 10 }),
  body('category').optional().isIn(['development', 'consulting', 'hosting', 'maintenance', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane usługi', errors: errors.array() });
    }
    const { name, namePl, nameEn, description, descriptionPl, descriptionEn, priceLabel, priceLabelPl, priceLabelEn } = req.body;
    const hasName = (name && name.trim().length >= 2) || (namePl && namePl.trim().length >= 2) || (nameEn && nameEn.trim().length >= 2);
    const hasDesc = (description && description.trim().length >= 10) || (descriptionPl && descriptionPl.trim().length >= 10) || (descriptionEn && descriptionEn.trim().length >= 10);
    if (!hasName) return res.status(400).json({ message: 'Wymagana nazwa (name, namePl lub nameEn, min. 2 znaki)' });
    if (!hasDesc) return res.status(400).json({ message: 'Wymagany opis (description, descriptionPl lub descriptionEn, min. 10 znaków)' });

    const maxOrder = await Service.findOne().sort({ order: -1 });
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    const data = { ...req.body, createdBy: req.user._id, order: newOrder };
    if (req.files?.image?.[0]) data.image = `/uploads/services/${req.files.image[0].filename}`;
    if (req.files?.imagePl?.[0]) data.imagePl = `/uploads/services/${req.files.imagePl[0].filename}`;
    if (req.files?.imageEn?.[0]) data.imageEn = `/uploads/services/${req.files.imageEn[0].filename}`;
    if (req.body.priceMin !== undefined && req.body.priceMin !== '') data.priceMin = Number(req.body.priceMin);
    if (req.body.priceMax !== undefined && req.body.priceMax !== '') data.priceMax = Number(req.body.priceMax);
    if (!data.namePl && data.name) data.namePl = data.name;
    if (!data.nameEn && data.name) data.nameEn = data.name;
    if (!data.descriptionPl && data.description) data.descriptionPl = data.description;
    if (!data.descriptionEn && data.description) data.descriptionEn = data.description;
    if (!data.priceLabelPl && data.priceLabel) data.priceLabelPl = data.priceLabel;
    if (!data.priceLabelEn && data.priceLabel) data.priceLabelEn = data.priceLabel;

    const service = new Service(data);
    await service.save();
    const populated = await Service.findById(service._id).populate('createdBy', 'firstName lastName');
    res.status(201).json({ message: 'Usługa została utworzona', service: populated });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia usługi' });
  }
});

// PUT /:id
router.put('/:id', [
  auth,
  requireRole(['admin', 'manager']),
  (req, res, next) => { req.setTimeout(300000); res.setTimeout(300000); next(); },
  uploadMiddleware,
  body('name').optional().trim().isLength({ min: 2 }),
  body('namePl').optional().trim().isLength({ min: 2 }),
  body('nameEn').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('descriptionPl').optional().trim().isLength({ min: 10 }),
  body('descriptionEn').optional().trim().isLength({ min: 10 }),
  body('category').optional().isIn(['development', 'consulting', 'hosting', 'maintenance', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane usługi', errors: errors.array() });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Usługa nie została znaleziona' });
    }

    const updateData = { ...req.body };
    if (req.files?.image?.[0]) updateData.image = `/uploads/services/${req.files.image[0].filename}`;
    if (req.files?.imagePl?.[0]) updateData.imagePl = `/uploads/services/${req.files.imagePl[0].filename}`;
    if (req.files?.imageEn?.[0]) updateData.imageEn = `/uploads/services/${req.files.imageEn[0].filename}`;
    if (req.body.priceMin !== undefined && req.body.priceMin !== '') updateData.priceMin = Number(req.body.priceMin);
    if (req.body.priceMax !== undefined && req.body.priceMax !== '') updateData.priceMax = Number(req.body.priceMax);
    if (req.body.priceMin === '') updateData.priceMin = null;
    if (req.body.priceMax === '') updateData.priceMax = null;
    if (updateData.name && !updateData.namePl) updateData.namePl = updateData.name;
    if (updateData.name && !updateData.nameEn) updateData.nameEn = updateData.name;
    if (updateData.description && !updateData.descriptionPl) updateData.descriptionPl = updateData.description;
    if (updateData.description && !updateData.descriptionEn) updateData.descriptionEn = updateData.description;
    if (updateData.priceLabel && !updateData.priceLabelPl) updateData.priceLabelPl = updateData.priceLabel;
    if (updateData.priceLabel && !updateData.priceLabelEn) updateData.priceLabelEn = updateData.priceLabel;

    Object.assign(service, updateData);
    await service.save();
    const populated = await Service.findById(service._id).populate('createdBy', 'firstName lastName');
    res.json({ message: 'Usługa została zaktualizowana', service: populated });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji usługi' });
  }
});

// DELETE /:id
router.delete('/:id', [auth, requireRole(['admin', 'manager'])], async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Usługa nie została znaleziona' });
    }
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usługa została usunięta' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania usługi' });
  }
});

// PUT /order/batch
router.put('/order/batch', [
  auth,
  requireRole(['admin', 'manager']),
  body('updates').isArray(),
  body('updates.*.id').notEmpty(),
  body('updates.*.order').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane', errors: errors.array() });
    }
    const { updates } = req.body;
    await Promise.all(updates.map(({ id, order }) => Service.findByIdAndUpdate(id, { order }, { new: true })));
    const services = await Service.find().sort({ order: 1 });
    res.json({ message: 'Kolejność usług zaktualizowana', services });
  } catch (error) {
    console.error('Batch order services error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji kolejności' });
  }
});

// PATCH /:id/toggle
router.patch('/:id/toggle', [auth, requireRole(['admin', 'manager'])], async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Usługa nie została znaleziona' });
    }
    service.isActive = !service.isActive;
    await service.save();
    res.json({ message: service.isActive ? 'Usługa aktywowana' : 'Usługa dezaktywowana', service });
  } catch (error) {
    console.error('Toggle service error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas zmiany statusu' });
  }
});

module.exports = router;
