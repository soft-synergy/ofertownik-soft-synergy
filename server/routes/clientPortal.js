const express = require('express');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Hosting = require('../models/Hosting');
const HostingMonitor = require('../models/HostingMonitor');
const HostingCheck = require('../models/HostingCheck');
const SSLCert = require('../models/SSLCert');
const sslMonitor = require('../services/sslMonitor');

const router = express.Router();

// Public client portal by token
router.get('/:token', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });
    const [projects, hostings] = await Promise.all([
      Project.find({ client: client._id }).select('name status offerType generatedOfferUrl workSummaryUrl workSummaryPdfUrl documents createdAt _id'),
      Hosting.find({ client: client._id }).select('domain status monthlyPrice nextPaymentDate lastPaymentDate')
    ]);
    
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
          await sslMonitor.checkCertificate(h.domain);
          // Try to find it again
          sslCert = await SSLCert.findOne({ domain: h.domain }).lean();
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
    
    res.json({ client: { name: client.name, email: client.email, phone: client.phone, company: client.company }, projects, hostings: hostingsWithSSL });
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania danych klienta' });
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


