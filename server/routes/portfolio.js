const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Portfolio = require('../models/Portfolio');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Multer destination called');
    console.log('Current working directory:', process.cwd());
    console.log('Target directory:', 'uploads/portfolio/');
    
    // Ensure directory exists
    const fs = require('fs');
    const uploadDir = 'uploads/portfolio/';
    
    if (!fs.existsSync(uploadDir)) {
      console.log('Creating directory:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB for fields
    fields: 50, // Maximum number of non-file fields
    fieldNameSize: 100, // Maximum field name size
    files: 1 // Maximum number of file fields
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer fileFilter called for:', file.originalname);
    console.log('File mimetype:', file.mimetype);
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      console.log('File accepted:', file.originalname);
      return cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, 'mimetype:', file.mimetype);
      cb(new Error('Tylko pliki obrazów są dozwolone!'));
    }
  }
}).single('image');

// Wrapper for multer upload to handle errors properly
const uploadMiddleware = (req, res, next) => {
  console.log('Upload middleware called');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  
  upload(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      console.error('Multer error code:', err.code);
      console.error('Multer error message:', err.message);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: 'Plik jest zbyt duży. Maksymalny rozmiar to 10MB.' 
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ 
          message: 'Nieoczekiwane pole pliku' 
        });
      }
      if (err.message) {
        return res.status(400).json({ 
          message: err.message 
        });
      }
      return res.status(400).json({ 
        message: 'Błąd podczas przetwarzania pliku' 
      });
    }
    console.log('Upload middleware success, file:', req.file);
    next();
  });
};

// Get API documentation
router.get('/documentation', (req, res) => {
  res.json({
    title: 'Portfolio API Documentation',
    version: '1.0.0',
    baseUrl: '/api/portfolio',
    endpoints: [
      {
        method: 'GET',
        path: '/',
        description: 'Get all portfolio items',
        auth: false,
        queryParams: {
          category: 'Filter by category (web, mobile, desktop, api, other)',
          active: 'Filter by active status (true, false)'
        },
        response: {
          type: 'array',
          example: [
            {
              _id: 'string',
              title: 'string',
              description: 'string',
              category: 'web|mobile|desktop|api|other',
              technologies: ['string'],
              image: '/uploads/portfolio/filename.jpg',
              client: 'string',
              duration: 'string',
              results: 'string',
              projectLink: 'string (URL)',
              apiLink: 'string (URL)',
              documentationLink: 'string (URL)',
              isActive: true,
              order: 0,
              createdBy: { _id: 'string', firstName: 'string', lastName: 'string' },
              createdAt: 'ISO date',
              updatedAt: 'ISO date'
            }
          ]
        }
      },
      {
        method: 'GET',
        path: '/:id',
        description: 'Get single portfolio item by ID',
        auth: false,
        response: {
          type: 'object',
          example: {
            _id: 'string',
            title: 'string',
            description: 'string',
            category: 'web',
            technologies: ['React', 'Node.js'],
            image: '/uploads/portfolio/filename.jpg',
            client: 'Example Client',
            duration: '3 months',
            results: 'Increased conversion by 40%',
            projectLink: 'https://example.com',
            apiLink: 'https://api.example.com/docs',
            documentationLink: 'https://docs.example.com',
            isActive: true,
            order: 0,
            createdBy: { _id: 'string', firstName: 'John', lastName: 'Doe' },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        }
      },
      {
        method: 'POST',
        path: '/',
        description: 'Create new portfolio item',
        auth: true,
        role: ['admin', 'manager'],
        contentType: 'multipart/form-data',
        body: {
          title: 'string (required, min 3 chars)',
          description: 'string (required, min 10 chars)',
          category: 'web|mobile|desktop|api|other (required)',
          technologies: 'JSON array of strings (required)',
          client: 'string (optional)',
          duration: 'string (optional)',
          results: 'string (optional)',
          projectLink: 'string (optional, URL)',
          apiLink: 'string (optional, URL)',
          documentationLink: 'string (optional, URL)',
          image: 'file (required, jpeg|jpg|png|webp, max 10MB)',
          isActive: 'boolean (optional, default: true)'
        }
      },
      {
        method: 'PUT',
        path: '/:id',
        description: 'Update portfolio item',
        auth: true,
        role: ['admin', 'manager'],
        contentType: 'multipart/form-data',
        body: {
          title: 'string (optional, min 3 chars)',
          description: 'string (optional, min 10 chars)',
          category: 'web|mobile|desktop|api|other (optional)',
          technologies: 'JSON array of strings (optional)',
          client: 'string (optional)',
          duration: 'string (optional)',
          results: 'string (optional)',
          projectLink: 'string (optional, URL)',
          apiLink: 'string (optional, URL)',
          documentationLink: 'string (optional, URL)',
          image: 'file (optional, jpeg|jpg|png|webp, max 10MB)',
          isActive: 'boolean (optional)'
        }
      },
      {
        method: 'DELETE',
        path: '/:id',
        description: 'Delete portfolio item',
        auth: true,
        role: ['admin', 'manager']
      },
      {
        method: 'PUT',
        path: '/:id/order',
        description: 'Update portfolio item order',
        auth: true,
        role: ['admin', 'manager'],
        body: {
          order: 'number (required)'
        }
      },
      {
        method: 'PUT',
        path: '/:id/toggle-status',
        description: 'Toggle portfolio item active status',
        auth: true,
        role: ['admin', 'manager']
      }
    ],
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Token is obtained from /api/auth/login endpoint'
    },
    errors: {
      400: 'Bad Request - Invalid data',
      401: 'Unauthorized - Missing or invalid token',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Portfolio item not found',
      500: 'Internal Server Error'
    }
  });
});

// Get all portfolio items
router.get('/', async (req, res) => {
  try {
    const { category, active } = req.query;
    
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const portfolio = await Portfolio.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ order: 1, createdAt: -1 });

    res.json(portfolio);
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania portfolio' });
  }
});

// Get single portfolio item
router.get('/:id', async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Element portfolio nie został znaleziony' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Get portfolio item error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania elementu portfolio' });
  }
});

// Create new portfolio item
router.post('/', [
  auth,
  requireRole(['admin', 'manager']),
  (req, res, next) => {
    // Increase timeout for this specific route (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);
    next();
  },
  uploadMiddleware,
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 10 }),
  body('category').isIn(['web', 'mobile', 'desktop', 'api', 'other'])
], async (req, res) => {
  console.log('POST /portfolio - Request received');
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'content-encoding': req.headers['content-encoding']
  });
  console.log('Files:', req.files);
  console.log('File:', req.file);
  console.log('Body:', req.body);
  
  if (!req.file) {
    console.log('No file received in request');
    return res.status(400).json({ message: 'Obraz jest wymagany' });
  }
  
  console.log('File saved successfully:', req.file.filename);
  console.log('File path:', req.file.path);
  console.log('File size:', req.file.size, 'bytes');
  console.log('File mimetype:', req.file.mimetype);
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane portfolio',
        errors: errors.array() 
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Obraz jest wymagany' });
    }

    // Parse technologies from JSON string if needed
    let technologies = [];
    console.log('Received technologies:', req.body.technologies);
    console.log('Type of technologies:', typeof req.body.technologies);
    
    if (req.body.technologies) {
      try {
        if (typeof req.body.technologies === 'string') {
          technologies = JSON.parse(req.body.technologies);
        } else {
          technologies = req.body.technologies;
        }
        console.log('Parsed technologies:', technologies);
      } catch (error) {
        console.error('Error parsing technologies:', error);
        return res.status(400).json({ 
          message: 'Nieprawidłowy format technologii',
          errors: [{ type: 'field', value: req.body.technologies, msg: 'Invalid technologies format', path: 'technologies', location: 'body' }]
        });
      }
    }

    // Validate technologies array
    if (!Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({ 
        message: 'Technologie są wymagane',
        errors: [{ type: 'field', value: req.body.technologies, msg: 'Technologies are required', path: 'technologies', location: 'body' }]
      });
    }

    const portfolioData = {
      ...req.body,
      technologies: technologies.filter(tech => tech.trim() !== ''),
      image: `/uploads/portfolio/${req.file.filename}`,
      createdBy: req.user._id
    };

    const portfolio = new Portfolio(portfolioData);
    await portfolio.save();

    const populatedPortfolio = await Portfolio.findById(portfolio._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      message: 'Element portfolio został utworzony pomyślnie',
      portfolio: populatedPortfolio
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia elementu portfolio' });
  }
});

// Update portfolio item
router.put('/:id', [
  auth,
  requireRole(['admin', 'manager']),
  (req, res, next) => {
    // Increase timeout for this specific route (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);
    next();
  },
  uploadMiddleware,
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 10 }),
  body('category').isIn(['web', 'mobile', 'desktop', 'api', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane portfolio',
        errors: errors.array() 
      });
    }

    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Element portfolio nie został znaleziony' });
    }

    const updateData = { ...req.body };
    
    // Parse technologies from JSON string if needed
    if (req.body.technologies) {
      console.log('Update - Received technologies:', req.body.technologies);
      console.log('Update - Type of technologies:', typeof req.body.technologies);
      
      try {
        if (typeof req.body.technologies === 'string') {
          updateData.technologies = JSON.parse(req.body.technologies);
        } else {
          updateData.technologies = req.body.technologies;
        }
        // Filter out empty technologies
        updateData.technologies = updateData.technologies.filter(tech => tech.trim() !== '');
        console.log('Update - Parsed technologies:', updateData.technologies);
      } catch (error) {
        console.error('Update - Error parsing technologies:', error);
        return res.status(400).json({ 
          message: 'Nieprawidłowy format technologii',
          errors: [{ type: 'field', value: req.body.technologies, msg: 'Invalid technologies format', path: 'technologies', location: 'body' }]
        });
      }
    }
    
    if (req.file) {
      updateData.image = `/uploads/portfolio/${req.file.filename}`;
    }

    Object.assign(portfolio, updateData);
    await portfolio.save();

    const updatedPortfolio = await Portfolio.findById(portfolio._id)
      .populate('createdBy', 'firstName lastName');

    res.json({
      message: 'Element portfolio został zaktualizowany pomyślnie',
      portfolio: updatedPortfolio
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji elementu portfolio' });
  }
});

// Delete portfolio item
router.delete('/:id', [
  auth,
  requireRole(['admin', 'manager'])
], async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Element portfolio nie został znaleziony' });
    }

    await Portfolio.findByIdAndDelete(req.params.id);

    res.json({ message: 'Element portfolio został usunięty pomyślnie' });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania elementu portfolio' });
  }
});

// Update portfolio order
router.put('/:id/order', [
  auth,
  requireRole(['admin', 'manager']),
  body('order').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowa kolejność',
        errors: errors.array() 
      });
    }

    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Element portfolio nie został znaleziony' });
    }

    portfolio.order = req.body.order;
    await portfolio.save();

    res.json({
      message: 'Kolejność została zaktualizowana pomyślnie',
      portfolio
    });
  } catch (error) {
    console.error('Update portfolio order error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji kolejności' });
  }
});

// Toggle portfolio item active status
router.patch('/:id/toggle', [
  auth,
  requireRole(['admin', 'manager'])
], async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ message: 'Element portfolio nie został znaleziony' });
    }

    portfolio.isActive = !portfolio.isActive;
    await portfolio.save();

    res.json({
      message: `Element portfolio został ${portfolio.isActive ? 'aktywowany' : 'dezaktywowany'} pomyślnie`,
      portfolio
    });
  } catch (error) {
    console.error('Toggle portfolio error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas zmiany statusu elementu portfolio' });
  }
});

module.exports = router; 