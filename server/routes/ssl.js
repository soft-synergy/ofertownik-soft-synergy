const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SSLCert = require('../models/SSLCert');
const sslMonitor = require('../services/sslMonitor');

// Get all SSL certificates (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const certificates = await SSLCert.find({})
      .sort({ domain: 1 })
      .populate('acknowledgedBy', 'firstName lastName email');

    res.json(certificates);
  } catch (error) {
    console.error('Error fetching SSL certificates:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania certyfikatów SSL' });
  }
});

// Get single SSL certificate by domain
router.get('/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const certificate = await SSLCert.findOne({ domain })
      .populate('acknowledgedBy', 'firstName lastName email');

    if (!certificate) {
      return res.status(404).json({ message: 'Certyfikat nie został znaleziony' });
    }

    res.json(certificate);
  } catch (error) {
    console.error('Error fetching SSL certificate:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania certyfikatu SSL' });
  }
});

// Check certificate status (manual trigger)
router.post('/check/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const result = await sslMonitor.checkCertificate(domain);

    res.json({
      message: 'Sprawdzanie certyfikatu zakończone',
      result
    });
  } catch (error) {
    console.error('Error checking SSL certificate:', error);
    res.status(500).json({ message: 'Błąd serwera podczas sprawdzania certyfikatu SSL', error: error.message });
  }
});

// Check all certificates (manual trigger)
router.post('/check-all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const results = await sslMonitor.runOnce();

    res.json({
      message: 'Sprawdzanie wszystkich certyfikatów zakończone',
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Error checking SSL certificates:', error);
    res.status(500).json({ message: 'Błąd serwera podczas sprawdzania certyfikatów SSL', error: error.message });
  }
});

// Generate new certificate
router.post('/generate/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const { email } = req.body;
    
    // Check if certbot is available
    const certbotAvailable = await sslMonitor.isCertbotAvailable();
    if (!certbotAvailable) {
      return res.status(503).json({ 
        message: 'Certbot nie jest dostępny. Zainstaluj certbot aby móc generować certyfikaty.',
        certbotAvailable: false
      });
    }

    const result = await sslMonitor.generateCertificate(domain, email);
    
    // Wait a bit for certificate files to be written
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Discover all certificates (including the newly generated one)
    console.log(`[SSL Monitor] Discovering certificates after generation for ${domain}...`);
    const discoveredDomains = await sslMonitor.discoverCertificates();
    console.log(`[SSL Monitor] Discovered ${discoveredDomains.length} domains: ${discoveredDomains.join(', ')}`);
    
    // Check certificate for the requested domain
    let checkResult = null;
    try {
      checkResult = await sslMonitor.checkCertificate(domain);
      console.log(`[SSL Monitor] Certificate check result for ${domain}:`, checkResult.status);
    } catch (checkError) {
      console.error(`[SSL Monitor] Error checking certificate for ${domain}:`, checkError.message);
      // Try checking all discovered domains to find the one that matches
      for (const discoveredDomain of discoveredDomains) {
        const normalizedDiscovered = discoveredDomain.toLowerCase().replace(/^www\./, '');
        const normalizedRequested = domain.toLowerCase().replace(/^www\./, '');
        if (normalizedDiscovered === normalizedRequested) {
          try {
            checkResult = await sslMonitor.checkCertificate(discoveredDomain);
            console.log(`[SSL Monitor] Found certificate for ${domain} under ${discoveredDomain}`);
            break;
          } catch (e) {
            // Continue searching
          }
        }
      }
    }
    
    // If still not found, try variations
    if (!checkResult || checkResult.status === 'not_found') {
      const variations = [
        domain,
        domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`,
      ];
      for (const variant of variations) {
        if (variant !== domain) {
          try {
            const variantCheck = await sslMonitor.checkCertificate(variant);
            if (variantCheck && variantCheck.status !== 'not_found') {
              checkResult = variantCheck;
              console.log(`[SSL Monitor] Found certificate for ${domain} under variant ${variant}`);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }

    res.json({
      message: 'Generowanie certyfikatu zakończone',
      generation: result,
      certificate: checkResult || { domain, status: 'not_found', error: 'Certyfikat został wygenerowany, ale nie został wykryty w systemie monitoringu' },
      discoveredDomains
    });
  } catch (error) {
    console.error('Error generating SSL certificate:', error);
    res.status(500).json({ 
      message: 'Błąd serwera podczas generowania certyfikatu SSL', 
      error: error.message 
    });
  }
});

// Renew certificate manually
router.post('/renew/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    
    // Check if certbot is available
    const certbotAvailable = await sslMonitor.isCertbotAvailable();
    if (!certbotAvailable) {
      return res.status(503).json({ 
        message: 'Certbot nie jest dostępny. Zainstaluj certbot aby móc odnawiać certyfikaty.',
        certbotAvailable: false
      });
    }

    const result = await sslMonitor.renewCertificate(domain);
    
    // Re-check certificate after renewal
    const checkResult = await sslMonitor.checkCertificate(domain);

    res.json({
      message: 'Odnowienie certyfikatu zakończone',
      renewal: result,
      certificate: checkResult
    });
  } catch (error) {
    console.error('Error renewing SSL certificate:', error);
    res.status(500).json({ 
      message: 'Błąd serwera podczas odnawiania certyfikatu SSL', 
      error: error.message 
    });
  }
});

// Add or update certificate domain (primary method - adds domain to monitoring)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain, autoRenew, renewalThreshold } = req.body;

    if (!domain) {
      return res.status(400).json({ message: 'Domena jest wymagana' });
    }

    console.log(`[SSL API] Adding domain to monitoring: ${domain}`);

    // Check certificate immediately (this will add it to DB with current status)
    // Uses network check - doesn't rely on filesystem
    let checkResult;
    try {
      checkResult = await sslMonitor.checkCertificate(domain);
      console.log(`[SSL API] Certificate check result for ${domain}: ${checkResult.status}`);
    } catch (checkError) {
      console.error(`[SSL API] Error checking certificate for ${domain}:`, checkError.message);
      // Even if check fails, we still want to add it to monitoring
      // It will be checked again during next scheduled check
      checkResult = {
        domain,
        status: 'error',
        error: checkError.message
      };
    }

    // Update or create certificate entry
    const certificate = await SSLCert.findOneAndUpdate(
      { domain },
      {
        domain,
        autoRenew: autoRenew !== undefined ? autoRenew : true,
        renewalThreshold: renewalThreshold || 30,
        // Update status from check if available
        ...(checkResult.status && { status: checkResult.status }),
        ...(checkResult.error && { lastError: checkResult.error })
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Domena dodana do monitoringu SSL',
      certificate,
      checkResult
    });
  } catch (error) {
    console.error('Error adding SSL certificate:', error);
    res.status(500).json({ message: 'Błąd serwera podczas dodawania certyfikatu SSL', error: error.message });
  }
});

// Update certificate settings
router.put('/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const { autoRenew, renewalThreshold } = req.body;

    const certificate = await SSLCert.findOneAndUpdate(
      { domain },
      {
        ...(autoRenew !== undefined && { autoRenew }),
        ...(renewalThreshold !== undefined && { renewalThreshold })
      },
      { new: true }
    );

    if (!certificate) {
      return res.status(404).json({ message: 'Certyfikat nie został znaleziony' });
    }

    res.json({
      message: 'Ustawienia certyfikatu zaktualizowane',
      certificate
    });
  } catch (error) {
    console.error('Error updating SSL certificate:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji certyfikatu SSL', error: error.message });
  }
});

// Acknowledge alarm
router.post('/:domain/acknowledge', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const certificate = await SSLCert.findOneAndUpdate(
      { domain },
      {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user._id
      },
      { new: true }
    ).populate('acknowledgedBy', 'firstName lastName email');

    if (!certificate) {
      return res.status(404).json({ message: 'Certyfikat nie został znaleziony' });
    }

    res.json({
      message: 'Alarm potwierdzony',
      certificate
    });
  } catch (error) {
    console.error('Error acknowledging SSL certificate alarm:', error);
    res.status(500).json({ message: 'Błąd serwera podczas potwierdzania alarmu', error: error.message });
  }
});

// Delete certificate from monitoring
router.delete('/:domain', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const { domain } = req.params;
    const certificate = await SSLCert.findOneAndDelete({ domain });

    if (!certificate) {
      return res.status(404).json({ message: 'Certyfikat nie został znaleziony' });
    }

    res.json({
      message: 'Certyfikat usunięty z monitoringu',
      certificate
    });
  } catch (error) {
    console.error('Error deleting SSL certificate:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania certyfikatu SSL', error: error.message });
  }
});

// Discover certificates from filesystem
router.post('/discover', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const domains = await sslMonitor.discoverCertificates();
    
    // Check certificates for all discovered domains (this will add them to DB)
    const results = [];
    for (const domain of domains) {
      try {
        const result = await sslMonitor.checkCertificate(domain);
        results.push(result);
      } catch (error) {
        console.error(`Error checking certificate for ${domain}:`, error);
        results.push({ domain, status: 'error', error: error.message });
      }
    }

    res.json({
      message: 'Wykrywanie certyfikatów zakończone',
      domains,
      count: domains.length,
      results
    });
  } catch (error) {
    console.error('Error discovering SSL certificates:', error);
    res.status(500).json({ message: 'Błąd serwera podczas wykrywania certyfikatów SSL', error: error.message });
  }
});

// Get SSL status summary
router.get('/stats/summary', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const total = await SSLCert.countDocuments();
    const valid = await SSLCert.countDocuments({ status: 'valid' });
    const expiringSoon = await SSLCert.countDocuments({ status: 'expiring_soon' });
    const expired = await SSLCert.countDocuments({ status: 'expired' });
    const errors = await SSLCert.countDocuments({ status: 'error' });
    const notFound = await SSLCert.countDocuments({ status: 'not_found' });
    const alarms = await SSLCert.countDocuments({ alarmActive: true, acknowledged: false });
    
    const certbotAvailable = await sslMonitor.isCertbotAvailable();
    const certbotPath = certbotAvailable ? await sslMonitor.getCertbotPath() : null;

    res.json({
      total,
      valid,
      expiringSoon,
      expired,
      errors,
      notFound,
      alarms,
      certbotAvailable,
      certbotPath
    });
  } catch (error) {
    console.error('Error fetching SSL stats:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania statystyk SSL', error: error.message });
  }
});

module.exports = router;

