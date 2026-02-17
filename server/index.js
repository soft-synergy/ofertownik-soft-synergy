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
const tasksRoutes = require('./routes/tasks');

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
app.use('/api/tasks', tasksRoutes);

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

// Hosting payment notifications → info@soft-synergy.com (3 days before, due today, 3 days overdue)
const setupHostingNotificationScheduler = () => {
  const Hosting = require('./models/Hosting');
  const { sendEmail } = require('./utils/emailService');
  const {
    hostingReminder3DaysBeforeTemplate,
    hostingReminderDueTodayTemplate,
    hostingReminder3DaysOverdueTemplate
  } = require('./utils/emailTemplates');

  const HOSTING_RECIPIENT = 'info@soft-synergy.com';
  const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';
  const HOSTING_LIST_URL = `${APP_URL}/hosting`;

  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const startOfDay = (d) => {
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
  };
  const endOfDay = (d) => {
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const runHostingCheck = async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const in3DaysStart = startOfDay(addDays(now, 3));
      const in3DaysEnd = endOfDay(addDays(now, 3));
      const threeDaysAgoStart = startOfDay(addDays(now, -3));
      const threeDaysAgoEnd = endOfDay(addDays(now, -3));

      const formatDate = (date) => new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

      // 1) Za 3 dni – nextPaymentDate = today + 3
      const dueIn3Days = await Hosting.find({
        status: { $in: ['active', 'overdue'] },
        nextPaymentDate: { $gte: in3DaysStart, $lte: in3DaysEnd }
      }).lean();

      const toNotify3dBefore = dueIn3Days.filter((h) => {
        const key = toDateKey(h.nextPaymentDate);
        const sent = (h.reminders || []).some((r) => r.type === 'hosting_3d_before' && r.notes === key);
        return !sent;
      });

      if (toNotify3dBefore.length > 0) {
        const hostingsForEmail = toNotify3dBefore.map((h) => ({
          domain: h.domain,
          clientName: h.clientName,
          monthlyPrice: h.monthlyPrice,
          billingCycle: h.billingCycle,
          dueDateFormatted: formatDate(h.nextPaymentDate)
        }));
        const html = hostingReminder3DaysBeforeTemplate({ hostings: hostingsForEmail, hostingUrl: HOSTING_LIST_URL });
        await sendEmail({
          to: HOSTING_RECIPIENT,
          subject: `📅 Hosting: za 3 dni płatność (${toNotify3dBefore.length} ${toNotify3dBefore.length === 1 ? 'pozycja' : 'pozycje'})`,
          html
        });
        for (const h of toNotify3dBefore) {
          await Hosting.findByIdAndUpdate(h._id, {
            $push: { reminders: { type: 'hosting_3d_before', notes: toDateKey(h.nextPaymentDate), sentAt: new Date() } }
          });
        }
        console.log(`[Hosting notifications] Wysłano "za 3 dni" do ${HOSTING_RECIPIENT} (${toNotify3dBefore.length} pozycji)`);
      }

      // 2) Dzisiaj – nextPaymentDate = today
      const dueToday = await Hosting.find({
        status: { $in: ['active', 'overdue'] },
        nextPaymentDate: { $gte: todayStart, $lte: todayEnd }
      }).lean();

      const toNotifyDueToday = dueToday.filter((h) => {
        const key = toDateKey(h.nextPaymentDate);
        const sent = (h.reminders || []).some((r) => r.type === 'hosting_due_today' && r.notes === key);
        return !sent;
      });

      if (toNotifyDueToday.length > 0) {
        const hostingsForEmail = toNotifyDueToday.map((h) => ({
          domain: h.domain,
          clientName: h.clientName,
          monthlyPrice: h.monthlyPrice,
          dueDateFormatted: formatDate(h.nextPaymentDate)
        }));
        const html = hostingReminderDueTodayTemplate({ hostings: hostingsForEmail, hostingUrl: HOSTING_LIST_URL });
        await sendEmail({
          to: HOSTING_RECIPIENT,
          subject: `⚠️ Hosting: płatność dzisiaj (${toNotifyDueToday.length} ${toNotifyDueToday.length === 1 ? 'pozycja' : 'pozycje'})`,
          html
        });
        for (const h of toNotifyDueToday) {
          await Hosting.findByIdAndUpdate(h._id, {
            $push: { reminders: { type: 'hosting_due_today', notes: toDateKey(h.nextPaymentDate), sentAt: new Date() } }
          });
        }
        console.log(`[Hosting notifications] Wysłano "dzisiaj" do ${HOSTING_RECIPIENT} (${toNotifyDueToday.length} pozycji)`);
      }

      // 3) 3 dni po terminie, brak płatności – nextPaymentDate = 3 days ago, brak wpłaty
      const overdue3dAgo = await Hosting.find({
        status: { $in: ['active', 'overdue'] },
        nextPaymentDate: { $gte: threeDaysAgoStart, $lte: threeDaysAgoEnd }
      }).lean();

      const toNotifyOverdue = overdue3dAgo.filter((h) => {
        const nextPay = h.nextPaymentDate ? new Date(h.nextPaymentDate) : null;
        const lastPay = h.lastPaymentDate ? new Date(h.lastPaymentDate) : null;
        const noPayment = !lastPay || (nextPay && lastPay < nextPay);
        const key = toDateKey(h.nextPaymentDate);
        const sent = (h.reminders || []).some((r) => r.type === 'hosting_3d_overdue' && r.notes === key);
        return noPayment && !sent;
      });

      if (toNotifyOverdue.length > 0) {
        const hostingsForEmail = toNotifyOverdue.map((h) => ({
          domain: h.domain,
          clientName: h.clientName,
          dueDateFormatted: formatDate(h.nextPaymentDate)
        }));
        const html = hostingReminder3DaysOverdueTemplate({ hostings: hostingsForEmail, hostingUrl: HOSTING_LIST_URL });
        await sendEmail({
          to: HOSTING_RECIPIENT,
          subject: `🚨 Hosting: brak płatności od 3 dni (${toNotifyOverdue.length} ${toNotifyOverdue.length === 1 ? 'pozycja' : 'pozycje'})`,
          html
        });
        for (const h of toNotifyOverdue) {
          await Hosting.findByIdAndUpdate(h._id, {
            $push: { reminders: { type: 'hosting_3d_overdue', notes: toDateKey(h.nextPaymentDate), sentAt: new Date() } }
          });
        }
        console.log(`[Hosting notifications] Wysłano "3 dni po terminie" do ${HOSTING_RECIPIENT} (${toNotifyOverdue.length} pozycji)`);
      }
    } catch (e) {
      console.error('[Hosting notifications] Błąd:', e);
    }
  };

  // Uruchom raz dziennie o 9:00 (względem startu serwera: pierwsze po 60 s, potem co 24 h)
  const runInOneMinute = 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  setTimeout(runHostingCheck, runInOneMinute);
  setInterval(runHostingCheck, oneDay);
};

// Tasks daily digest notifications (per assignee)
const setupTasksDigestScheduler = () => {
  const Task = require('./models/Task');
  const User = require('./models/User');
  const { sendEmail } = require('./utils/emailService');
  const { tasksDailyDigestTemplate, tasksOverdueTemplate } = require('./utils/emailTemplates');

  const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';
  const TASKS_URL = `${APP_URL}/tasks`;

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const priorityLabel = (p) => ({ low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny' }[p] || p || '');
  const formatDate = (date) => new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  const runDigest = async () => {
    try {
      const now = new Date();
      const rangeStart = startOfDay(now);
      const rangeEnd = endOfDay(addDays(now, 7)); // next 7 days

      const users = await User.find({ isActive: true }).select('_id email firstName lastName').lean();
      for (const u of users) {
        if (!u.email) continue;
        // eslint-disable-next-line no-await-in-loop
        const tasks = await Task.find({
          isRecurrenceTemplate: { $ne: true },
          assignee: u._id,
          status: { $nin: ['done', 'cancelled'] },
          dueDate: { $gte: rangeStart, $lte: rangeEnd }
        })
          .populate('project', 'name')
          .sort({ dueDate: 1, dueTimeMinutes: 1, createdAt: 1 })
          .limit(50)
          .lean();

        if (!tasks || tasks.length === 0) continue;

        const payloadTasks = tasks.map((t) => ({
          title: t.title,
          dueDateFormatted: t.dueDate ? formatDate(t.dueDate) : '-',
          priorityLabel: priorityLabel(t.priority),
          projectName: t.project?.name || null
        }));
        const dateLabel = formatDate(now);
        const html = tasksDailyDigestTemplate({
          recipientName: u.firstName,
          tasks: payloadTasks,
          tasksUrl: TASKS_URL,
          dateLabel
        });
        const subject = `🗓️ Zadania (najbliższe 7 dni) – ${dateLabel}`;
        // eslint-disable-next-line no-await-in-loop
        await sendEmail({ to: u.email, subject, html });
      }
    } catch (e) {
      console.error('[Tasks digest] Błąd:', e);
    }
  };

  const runOverdue = async () => {
    try {
      const now = new Date();
      const rangeEnd = startOfDay(now);

      const overdueTasks = await Task.find({
        isRecurrenceTemplate: { $ne: true },
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: rangeEnd },
        assignee: { $ne: null }
      })
        .populate('assignee', 'email firstName lastName')
        .populate('project', 'name')
        .sort({ dueDate: 1 })
        .limit(200)
        .lean();

      const byAssignee = {};
      for (const t of overdueTasks) {
        const uid = t.assignee?._id?.toString?.() || t.assignee?.toString?.();
        if (!uid || !t.assignee?.email) continue;
        if (!byAssignee[uid]) byAssignee[uid] = { user: t.assignee, tasks: [] };
        byAssignee[uid].tasks.push(t);
      }

      for (const { user, tasks } of Object.values(byAssignee)) {
        if (!user.email || tasks.length === 0) continue;
        const payloadTasks = tasks.map((t) => ({
          title: t.title,
          dueDateFormatted: t.dueDate ? formatDate(t.dueDate) : '-',
          priorityLabel: priorityLabel(t.priority),
          projectName: t.project?.name || null
        }));
        const dateLabel = formatDate(now);
        const html = tasksOverdueTemplate({
          recipientName: user.firstName,
          tasks: payloadTasks,
          tasksUrl: TASKS_URL,
          dateLabel
        });
        const subject = `⚠️ Zadania po terminie (${tasks.length}) – ${dateLabel}`;
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (e) {
      console.error('[Tasks overdue] Błąd:', e);
    }
  };

  // First run after 2 minutes, then every 24h
  setTimeout(runDigest, 2 * 60 * 1000);
  setInterval(runDigest, 24 * 60 * 60 * 1000);
  setTimeout(runOverdue, 3 * 60 * 1000);
  setInterval(runOverdue, 24 * 60 * 60 * 1000);
};

// Recurring tasks scheduler: ensures instances exist for upcoming period
const setupRecurringTasksScheduler = () => {
  const Task = require('./models/Task');

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const addMonths = (d, n) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  const run = async () => {
    try {
      const now = new Date();
      const horizon = addDays(now, 60);
      const templates = await Task.find({
        isRecurrenceTemplate: true,
        'recurrence.enabled': true,
        'recurrence.frequency': { $in: ['daily', 'weekly', 'monthly'] }
      }).lean();

      for (const tpl of templates) {
        const frequency = tpl.recurrence?.frequency;
        const interval = Number(tpl.recurrence?.interval ?? 1) || 1;
        const until = tpl.recurrence?.untilDate ? new Date(tpl.recurrence.untilDate) : null;
        const effectiveUntil = until && until < horizon ? until : horizon;

        // Find latest instance dueDate (if any)
        // eslint-disable-next-line no-await-in-loop
        const last = await Task.findOne({ recurrenceParent: tpl._id })
          .sort({ dueDate: -1 })
          .select('dueDate')
          .lean();

        let cursor = last?.dueDate ? new Date(last.dueDate) : new Date(tpl.dueDate);
        // move to next occurrence
        if (frequency === 'daily') cursor = addDays(cursor, interval);
        else if (frequency === 'weekly') cursor = addDays(cursor, 7 * interval);
        else cursor = addMonths(cursor, interval);

        const toCreate = [];
        while (cursor <= effectiveUntil) {
          const dayStart = startOfDay(cursor);
          const dayEnd = endOfDay(cursor);
          // eslint-disable-next-line no-await-in-loop
          const exists = await Task.findOne({
            recurrenceParent: tpl._id,
            dueDate: { $gte: dayStart, $lte: dayEnd }
          }).select('_id').lean();
          if (!exists) {
            toCreate.push({
              title: tpl.title,
              description: tpl.description,
              status: 'todo',
              priority: tpl.priority,
              assignee: tpl.assignee || null,
              project: tpl.project || null,
              dueDate: new Date(cursor),
              dueTimeMinutes: tpl.dueTimeMinutes ?? null,
              durationMinutes: tpl.durationMinutes ?? 60,
              createdBy: tpl.createdBy,
              isRecurrenceTemplate: false,
              recurrenceParent: tpl._id,
              recurrence: { enabled: false, frequency: null, interval: 1, untilDate: null }
            });
          }
          if (frequency === 'daily') cursor = addDays(cursor, interval);
          else if (frequency === 'weekly') cursor = addDays(cursor, 7 * interval);
          else cursor = addMonths(cursor, interval);
        }
        if (toCreate.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await Task.insertMany(toCreate);
        }
      }
    } catch (e) {
      console.error('[Recurring tasks] Błąd:', e);
    }
  };

  // First run after 3 minutes, then daily
  setTimeout(run, 3 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
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
  try {
    setupHostingNotificationScheduler();
    console.log('📧 Powiadomienia hostingu (info@) uruchomione – co 24 h');
  } catch (e) {
    console.error('Nie udało się uruchomić powiadomień hostingu:', e);
  }
  try {
    setupRecurringTasksScheduler();
    console.log('🔁 Powtarzające zadania – generator uruchomiony (co 24 h)');
  } catch (e) {
    console.error('Nie udało się uruchomić generatora zadań cyklicznych:', e);
  }
  try {
    setupTasksDigestScheduler();
    console.log('📨 Powiadomienia mailowe zadań – digest uruchomiony (co 24 h)');
  } catch (e) {
    console.error('Nie udało się uruchomić digestu zadań:', e);
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