const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Hosting = require('../models/Hosting');
const HostingMonitor = require('../models/HostingMonitor');
const HostingCheck = require('../models/HostingCheck');
const SSLCert = require('../models/SSLCert');
const Task = require('../models/Task');
const sslMonitor = require('../services/sslMonitor');

const router = express.Router();

const clientNoteUploadsDir = path.join(__dirname, '../../uploads/tasks');
if (!fs.existsSync(clientNoteUploadsDir)) {
  fs.mkdirSync(clientNoteUploadsDir, { recursive: true });
}

const clientNoteStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, clientNoteUploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `client-note-${uniqueSuffix}${ext}`);
  }
});

const clientNoteUpload = multer({
  storage: clientNoteStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => cb(null, true)
});

// Public client portal by token
router.get('/:token', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });
    const [projects, hostings] = await Promise.all([
      Project.find({ client: client._id }).select('name status offerType generatedOfferUrl workSummaryUrl workSummaryPdfUrl documents createdAt _id'),
      Hosting.find({ client: client._id }).select('domain status monthlyPrice nextPaymentDate lastPaymentDate')
    ]);
    const projectIds = projects.map((project) => project._id);
    const tasks = projectIds.length
      ? await Task.find({
          project: { $in: projectIds },
          isRecurrenceTemplate: { $ne: true },
          status: { $ne: 'cancelled' }
        })
          .select('title description status dueDate completedAt project clientNotes createdAt')
          .sort({ status: 1, dueDate: 1, createdAt: 1 })
          .lean()
      : [];
    const publicTasksByProject = tasks.reduce((acc, task) => {
      const projectId = task.project?.toString();
      if (!projectId) return acc;
      if (!acc[projectId]) acc[projectId] = [];
      acc[projectId].push({
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        clientNotes: (task.clientNotes || []).map((note) => ({
          _id: note._id,
          text: note.text,
          createdAt: note.createdAt,
          attachments: (note.attachments || []).map((att) => ({
            _id: att._id,
            originalName: att.originalName || att.filename,
            mimetype: att.mimetype,
            size: att.size,
            url: `/uploads/tasks/${att.filename}`
          }))
        }))
      });
      return acc;
    }, {});
    const projectsWithTasks = projects.map((project) => ({
      ...project.toObject(),
      tasks: publicTasksByProject[project._id.toString()] || []
    }));
    
    // Get SSL status for each hosting domain
    const hostingsWithSSL = await Promise.all(hostings.map(async (h) => {
      // Try to find SSL cert by exact domain match first
      let sslCert = await SSLCert.findOne({ domain: h.domain }).lean();
      
      // If not found, try variations (www.domain, without www)
      if (!sslCert) {
        const domainVariations = [
          h.domain,
          h.domain.startsWith('www.') ? h.domain.replace('www.', '') : `www.${h.domain}`,
        ];
        
        for (const variant of domainVariations) {
          sslCert = await SSLCert.findOne({ domain: variant }).lean();
          if (sslCert) break;
        }
      }
      
      // If still not found in DB, try to check certificate directly from filesystem
      if (!sslCert) {
        try {
          // This will check the certificate and add it to DB if found
          // First, try to find certificate path - this scans all certs
          const certPath = await sslMonitor.findCertificatePath(h.domain);
          if (certPath) {
            // Found certificate, check it and add to DB
            await sslMonitor.checkCertificate(h.domain);
            // Try to find it again
            sslCert = await SSLCert.findOne({ domain: h.domain }).lean();
            
            // If still not found by exact domain, try to find by certificate path
            if (!sslCert) {
              // Get all domains from certificate and try to match
              const certDomains = await sslMonitor.getCertificateDomains(certPath);
              for (const certDomain of certDomains) {
                const normalizedCertDomain = certDomain.toLowerCase().replace(/^www\./, '');
                const normalizedHostingDomain = h.domain.toLowerCase().replace(/^www\./, '');
                if (normalizedCertDomain === normalizedHostingDomain || 
                    certDomain.toLowerCase() === h.domain.toLowerCase() ||
                    certDomain.toLowerCase() === `www.${h.domain.toLowerCase()}` ||
                    `www.${certDomain.toLowerCase()}` === h.domain.toLowerCase()) {
                  // Create entry for hosting domain
                  await sslMonitor.checkCertificate(h.domain);
                  sslCert = await SSLCert.findOne({ domain: h.domain }).lean();
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.log(`[ClientPortal] Could not check SSL for ${h.domain}:`, e.message);
        }
      }
      
      return {
        ...h.toObject(),
        sslStatus: sslCert ? {
          status: sslCert.status,
          daysUntilExpiry: sslCert.daysUntilExpiry,
          validTo: sslCert.validTo,
          isExpiringSoon: sslCert.isExpiringSoon,
          isExpired: sslCert.isExpired
        } : {
          status: 'not_found',
          daysUntilExpiry: null,
          validTo: null,
          isExpiringSoon: false,
          isExpired: false
        }
      };
    }));
    
    res.json({ client: { name: client.name, email: client.email, phone: client.phone, company: client.company }, projects: projectsWithTasks, hostings: hostingsWithSSL });
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania danych klienta' });
  }
});

router.post('/:token/tasks/:taskId/client-note', clientNoteUpload.array('files', 10), async (req, res) => {
  const cleanupUploads = () => {
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        try { fs.unlinkSync(path.join(clientNoteUploadsDir, f.filename)); } catch (e) { /* ignore */ }
      }
    }
  };
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) {
      cleanupUploads();
      return res.status(404).json({ message: 'Nie znaleziono klienta' });
    }

    const text = (req.body.text || '').trim();
    const files = Array.isArray(req.files) ? req.files : [];
    if (!text && files.length === 0) {
      cleanupUploads();
      return res.status(400).json({ message: 'Dodaj treść notatki lub załącz plik' });
    }
    if (text.length > 1200) {
      cleanupUploads();
      return res.status(400).json({ message: 'Notatka jest za długa' });
    }

    const task = await Task.findById(req.params.taskId).populate('project', 'client name');
    if (!task || !task.project) {
      cleanupUploads();
      return res.status(404).json({ message: 'Zadanie nie znalezione' });
    }
    if (task.project.client?.toString() !== client._id.toString()) {
      cleanupUploads();
      return res.status(403).json({ message: 'Zadanie nie należy do projektu tego klienta' });
    }

    const attachments = files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      uploadedAt: new Date()
    }));

    task.clientNotes = task.clientNotes || [];
    task.clientNotes.push({
      text,
      client: client._id,
      attachments,
      createdAt: new Date()
    });
    await task.save();

    res.status(201).json({ message: 'Notatka została dodana' });
  } catch (e) {
    cleanupUploads();
    console.error('Client task note error:', e);
    res.status(500).json({ message: 'Błąd dodawania notatki' });
  }
});

router.delete('/:token/tasks/:taskId/client-note/:noteId', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });

    const task = await Task.findById(req.params.taskId).populate('project', 'client name');
    if (!task || !task.project) return res.status(404).json({ message: 'Zadanie nie znalezione' });
    if (task.project.client?.toString() !== client._id.toString()) {
      return res.status(403).json({ message: 'Zadanie nie należy do projektu tego klienta' });
    }

    const note = (task.clientNotes || []).find((n) => n._id.toString() === req.params.noteId);
    if (!note) return res.status(404).json({ message: 'Notatka nie została znaleziona' });
    if (!note.client || note.client.toString() !== client._id.toString()) {
      return res.status(403).json({ message: 'Możesz usuwać tylko swoje notatki' });
    }

    for (const att of note.attachments || []) {
      const fpath = path.join(clientNoteUploadsDir, att.filename);
      if (fs.existsSync(fpath)) {
        try { fs.unlinkSync(fpath); } catch (e) { /* ignore */ }
      }
    }
    task.clientNotes.pull(req.params.noteId);
    await task.save();

    res.json({ message: 'Notatka została usunięta' });
  } catch (e) {
    console.error('Client task note delete error:', e);
    res.status(500).json({ message: 'Błąd usuwania notatki' });
  }
});

// Accept project offer (via portal token)
router.post('/:token/accept-project/:projectId', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });
    
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Projekt nie znaleziony' });
    
    if (project.client?.toString() !== client._id.toString()) {
      return res.status(403).json({ message: 'Projekt nie należy do tego klienta' });
    }
    
    if (project.status === 'accepted') {
      return res.status(400).json({ message: 'Oferta została już zaakceptowana' });
    }
    
    project.status = 'accepted';
    await project.save();

    // Usuń taski offer workflow (projekt zakończony)
    try {
      const { deleteOfferWorkflowTasks } = require('../utils/offerWorkflowTasks');
      await deleteOfferWorkflowTasks(project._id);
    } catch (e) {}

    // Log activity
    try {
      const Activity = require('../models/Activity');
      await Activity.create({
        action: 'project.accepted.via_portal',
        entityType: 'project',
        entityId: project._id,
        author: null, // client portal acceptance
        message: `Oferta "${project.name}" zaakceptowana przez klienta ${client.name} przez portal`
      });
    } catch (e) {}
    
    res.json({ message: 'Oferta została zaakceptowana', project });
  } catch (e) {
    console.error('Accept project error:', e);
    res.status(500).json({ message: 'Błąd akceptacji oferty' });
  }
});

// Monitoring details for a hosting (via portal token)
router.get('/:token/hosting/:hostingId/monitor', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });

    const hosting = await Hosting.findById(req.params.hostingId);
    if (!hosting) return res.status(404).json({ message: 'Hosting nie znaleziony' });
    if (hosting.client?.toString() !== client._id.toString()) {
      return res.status(403).json({ message: 'Hosting nie należy do tego klienta' });
    }

    const month = (req.query.month || '').trim();
    let start, end;
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    } else {
      // default: last 30 days
      end = new Date();
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const monitor = await HostingMonitor.findOne({ hosting: hosting._id });
    const checks = await HostingCheck.find({ hosting: hosting._id, timestamp: { $gte: start, $lt: end } })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    // Compute simple uptime percentage for the window
    const total = checks.length || 1;
    const upCount = checks.filter(c => c.isUp).length;
    const uptimePct = Math.round((upCount / total) * 100);

    res.json({
      monitor: monitor ? {
        domain: monitor.domain,
        url: monitor.url,
        isUp: monitor.isUp,
        isDown: monitor.isDown,
        lastCheckedAt: monitor.lastCheckedAt,
        lastStatusCode: monitor.lastStatusCode,
        lastResponseTimeMs: monitor.lastResponseTimeMs,
        lastError: monitor.lastError,
        lastHtmlPath: monitor.lastHtmlPath,
        alarmActive: monitor.alarmActive,
        acknowledged: monitor.acknowledged,
      } : null,
      stats: {
        from: start,
        to: end,
        totalChecks: checks.length,
        uptimePct,
        avgResponseMs: checks.length ? Math.round(checks.filter(c => typeof c.responseTimeMs === 'number').reduce((a, b) => a + (b.responseTimeMs || 0), 0) / checks.length) : null
      },
      checks: checks.map(c => ({
        timestamp: c.timestamp,
        isUp: c.isUp,
        statusCode: c.statusCode,
        responseTimeMs: c.responseTimeMs,
        error: c.error,
        htmlPath: c.htmlPath
      }))
    });
  } catch (e) {
    console.error('Portal monitor details error:', e);
    res.status(500).json({ message: 'Błąd pobierania danych monitoringu' });
  }
});

module.exports = router;

