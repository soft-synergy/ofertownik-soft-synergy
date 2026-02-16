const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const portfolioRoutes = require('./routes/portfolio');
const offerRoutes = require('./routes/offers');
const hostingRoutes = require('./routes/hosting');
const clientsRoutes = require('./routes/clients');
const clientPortalRoutes = require('./routes/clientPortal');
const sslRoutes = require('./routes/ssl');
const waitlistRoutes = require('./routes/waitlist');

const app = express();
const PORT = process.env.PORT || 5000;

// Increase server timeout for file uploads (5 minutes)
app.timeout = 300000; // 5 minutes in milliseconds
if (app.server) {
  app.server.timeout = 300000;
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "*"],
      connectSrc: ["'self'", "*"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Rate limiting - exclude static files from limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs (increased 3x for better tolerance)
  skip: (req) => {
    // Skip rate limiting for static files (images, generated offers, etc.)
    return req.path.startsWith('/uploads/') || 
           req.path.startsWith('/generated-offers/') ||
           req.path.startsWith('/js/') ||
           req.path.startsWith('/img/');
  }
});
app.use(limiter);

// Body parsing middleware
// Note: These parsers should NOT process multipart/form-data (multer handles that)
// But we increase limits to match file upload limits
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static files with CORS headers
const setCorsHeaders = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};

app.use('/uploads/portfolio', setCorsHeaders, express.static(path.join(__dirname, '../uploads/portfolio')));
app.use('/uploads/documents', setCorsHeaders, express.static(path.join(__dirname, '../uploads/documents')));
app.use('/uploads/monitoring', setCorsHeaders, express.static(path.join(__dirname, '../uploads/monitoring')));

// Generated offers with cache-busting and CORS
app.use('/generated-offers', (req, res, next) => {
  // Add cache-busting headers for offer files
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'generated-offers')));

app.use('/js', setCorsHeaders, express.static(path.join(__dirname, 'public/js')));
app.use('/img', setCorsHeaders, express.static(path.join(__dirname, 'public/img')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/hosting', hostingRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/ssl', sslRoutes);
app.use('/api/waitlist', waitlistRoutes);

// Activities endpoint (recent)
const Activity = require('./models/Activity');
const { auth } = require('./middleware/auth');
app.get('/api/activities/recent', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }
    const items = await Activity.find({})
      .populate('author', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: 'Błąd serwera podczas pobierania aktywności' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple reminder scheduler for follow-ups (runs every 30 minutes)
const setupFollowUpReminderScheduler = () => {
  const Project = require('./models/Project');
  const { getTransporter, sendEmail } = require('./utils/emailService');
  const { followUpReminderTemplate } = require('./utils/emailTemplates');

  const FOLLOW_UP_RECIPIENT = 'jakub.czajka@soft-synergy.com';

  const trans = getTransporter();
  if (trans) {
    trans.verify().then(() => console.log('[SMTP] Połączenie zweryfikowane'))
      .catch((err) => console.error('[SMTP] Błąd weryfikacji:', err.message));
  } else {
    console.warn('[SMTP] Nie skonfigurowano - ustaw SMTP_HOST, SMTP_USER, SMTP_PASS w .env');
  }

  const runCheck = async () => {
    try {
      const now = new Date();
      const projects = await Project.find({
        status: { $in: ['draft', 'active'] },
        $or: [
          { followUps: { $exists: false } },
          { $where: 'this.followUps.length < 3' }
        ],
        nextFollowUpDueAt: { $ne: null, $lte: now }
      }).limit(50);

      for (const p of projects) {
        const lastReminder = p.lastFollowUpReminderAt ? new Date(p.lastFollowUpReminderAt) : null;
        // Avoid spamming: remind once per day at most
        if (lastReminder && (now.getTime() - lastReminder.getTime()) < (24 * 60 * 60 * 1000)) continue;

        const numSent = Array.isArray(p.followUps) ? p.followUps.length : 0;
        const subject = `⏰ Przypomnienie: follow-up #${numSent + 1} dla oferty ${p.name}`;
        const dueDate = p.nextFollowUpDueAt ? new Date(p.nextFollowUpDueAt).toLocaleString('pl-PL') : null;
        const html = followUpReminderTemplate({
          projectName: p.name,
          clientName: p.clientName || '-',
          followUpNumber: numSent + 1,
          dueDate,
          projectId: p._id.toString()
        });
        try {
          await sendEmail({ to: FOLLOW_UP_RECIPIENT, subject, html });
          p.lastFollowUpReminderAt = now;
          await p.save();
        } catch (e) {
          console.error('Reminder email error:', e);
        }
      }
    } catch (e) {
      console.error('Follow-up reminder check failed:', e);
    }
  };

  // initial delay then interval
  setTimeout(runCheck, 10 * 1000);
  setInterval(runCheck, 30 * 60 * 1000);
};

// Test uploads directory
app.get('/api/test-uploads', (req, res) => {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, '../uploads');
  const portfolioPath = path.join(uploadsPath, 'portfolio');
  
  res.json({
    uploadsPath,
    uploadsExists: fs.existsSync(uploadsPath),
    portfolioExists: fs.existsSync(portfolioPath),
    uploadsFiles: fs.existsSync(uploadsPath) ? fs.readdirSync(uploadsPath) : [],
    portfolioFiles: fs.existsSync(portfolioPath) ? fs.readdirSync(portfolioPath) : []
  });
});

// URL rewriting for offers - make them look professional
app.get('/oferta-finalna/:projectName', async (req, res) => {
  try {
    const { projectName } = req.params;
    
    // Find project by name (case insensitive)
    const Project = require('./models/Project');
    const project = await Project.findOne({
      name: { $regex: new RegExp(projectName.replace(/-/g, ' '), 'i') }
    });
    
    if (!project || !project.generatedOfferUrl) {
      return res.status(404).json({ message: 'Oferta nie została znaleziona' });
    }
    
    // Extract the HTML file path from generatedOfferUrl
    const htmlFileName = project.generatedOfferUrl.split('/').pop();
    const htmlPath = path.join(__dirname, 'generated-offers', htmlFileName);
    
    // Check if HTML file exists
    const fs = require('fs');
    if (!fs.existsSync(htmlPath)) {
      return res.status(404).json({ message: 'Plik oferty nie został znaleziony' });
    }
    
    // Read and serve the HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    // Add cache-busting headers to prevent caching of old offers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(htmlContent);
    
  } catch (error) {
    console.error('Offer redirect error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas ładowania oferty' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Wystąpił błąd serwera',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint nie został znaleziony' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Połączono z bazą danych MongoDB');
  app.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
    console.log(`📱 Frontend: https:///ofertownik.soft-synergy.com`);
    console.log(`🔧 API: https:///oferty.soft-synergy.com/api`);
  });
  // Start reminder scheduler after server is up
  try {
    setupFollowUpReminderScheduler();
    console.log('⏰ Harmonogram przypomnień follow-up uruchomiony');
  } catch (e) {
    console.error('Nie udało się uruchomić harmonogramu follow-up:', e);
  }
  // Start hosting uptime monitor (every 5 minutes)
  try {
    const hostingMonitor = require('./services/hostingMonitor');
    hostingMonitor.start(5 * 60 * 1000);
    console.log('🖥️  Monitoring hostingu uruchomiony (co 5 minut)');
  } catch (e) {
    console.error('Nie udało się uruchomić monitoringu hostingu:', e);
  }
  // Start SSL certificate monitor (once per day, checks every 24 hours)
  try {
    const sslMonitor = require('./services/sslMonitor');
    sslMonitor.start(24 * 60 * 60 * 1000); // Check every 24 hours
    console.log('🔒 Monitoring certyfikatów SSL uruchomiony (co 24 godziny)');
  } catch (e) {
    console.error('Nie udało się uruchomić monitoringu certyfikatów SSL:', e);
  }
})
.catch((err) => {
  console.error('❌ Błąd połączenia z bazą danych:', err);
  process.exit(1);
}); 