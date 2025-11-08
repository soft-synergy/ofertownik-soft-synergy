const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const SSLCert = require('../models/SSLCert');

const execAsync = promisify(exec);

// Standard Let's Encrypt paths
const LETSENCRYPT_BASE = '/etc/letsencrypt/live';
const CERTBOT_PATH = '/usr/bin/certbot'; // Standard path for certbot

/**
 * Check if certificate file exists
 */
async function certificateExists(certPath) {
  try {
    await fs.access(certPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read certificate file and parse it using openssl
 */
async function readCertificate(certPath) {
  try {
    // Try using openssl command (more compatible across Node.js versions)
    try {
      const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -dates -subject -issuer -serial -fingerprint -sha256`, { timeout: 10000 });
      
      // Parse openssl output
      const lines = stdout.split('\n');
      const result = {
        validFrom: null,
        validTo: null,
        issuer: null,
        subject: null,
        serialNumber: null,
        fingerprint: null
      };

      for (const line of lines) {
        if (line.startsWith('notBefore=')) {
          result.validFrom = line.replace('notBefore=', '').trim();
        } else if (line.startsWith('notAfter=')) {
          result.validTo = line.replace('notAfter=', '').trim();
        } else if (line.startsWith('subject=')) {
          result.subject = line.replace('subject=', '').trim();
        } else if (line.startsWith('issuer=')) {
          result.issuer = line.replace('issuer=', '').trim();
        } else if (line.startsWith('serial=')) {
          result.serialNumber = line.replace('serial=', '').trim();
        } else if (line.startsWith('SHA256 Fingerprint=')) {
          result.fingerprint = line.replace('SHA256 Fingerprint=', '').trim();
        }
      }

      // Convert dates from OpenSSL format (e.g., "Nov 28 12:00:00 2024 GMT") to ISO format
      if (result.validFrom) {
        try {
          const date = new Date(result.validFrom);
          result.validFrom = date.toISOString();
        } catch (e) {
          console.warn(`[SSL Monitor] Could not parse validFrom date: ${result.validFrom}`);
        }
      }
      if (result.validTo) {
        try {
          const date = new Date(result.validTo);
          result.validTo = date.toISOString();
        } catch (e) {
          console.warn(`[SSL Monitor] Could not parse validTo date: ${result.validTo}`);
        }
      }

      return result;
    } catch (opensslError) {
      // Fallback to Node.js crypto if openssl fails
      if (crypto.X509Certificate) {
        const certContent = await fs.readFile(certPath, 'utf8');
        const cert = new crypto.X509Certificate(certContent);
        
        return {
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          issuer: cert.issuer,
          subject: cert.subject,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint
        };
      } else {
        throw new Error(`OpenSSL command failed and X509Certificate is not available: ${opensslError.message}`);
      }
    }
  } catch (error) {
    throw new Error(`Failed to read certificate: ${error.message}`);
  }
}

/**
 * Calculate days until expiry
 */
function getDaysUntilExpiry(validTo) {
  const expiryDate = new Date(validTo);
  const now = new Date();
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine certificate status
 */
function getCertificateStatus(daysUntilExpiry, renewalThreshold = 30) {
  if (daysUntilExpiry < 0) {
    return { status: 'expired', isExpired: true, isExpiringSoon: false };
  } else if (daysUntilExpiry <= renewalThreshold) {
    return { status: 'expiring_soon', isExpired: false, isExpiringSoon: true };
  } else {
    return { status: 'valid', isExpired: false, isExpiringSoon: false };
  }
}

/**
 * Extract all domains from certificate (subject + SAN)
 */
async function getCertificateDomains(certPath) {
  try {
    // Get full certificate text
    const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -text`, { timeout: 10000 });
    const allDomains = new Set();
    
    // Extract CN from subject - simpler approach
    const subjectLine = stdout.split('\n').find(line => line.includes('Subject:'));
    if (subjectLine) {
      const cnMatch = subjectLine.match(/CN\s*=\s*([^,/\n]+)/);
      if (cnMatch && cnMatch[1]) {
        const cnDomain = cnMatch[1].trim();
        if (cnDomain) allDomains.add(cnDomain.replace(/\*/g, ''));
      }
    }
    
    // Extract SAN domains - look for DNS: patterns
    const lines = stdout.split('\n');
    let inSanSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('X509v3 Subject Alternative Name')) {
        inSanSection = true;
        continue;
      }
      if (inSanSection) {
        // Match DNS:domain patterns
        const dnsMatches = line.matchAll(/DNS:([^,\s]+)/gi);
        for (const match of dnsMatches) {
          if (match[1]) {
            allDomains.add(match[1].trim().replace(/\*/g, ''));
          }
        }
        // Stop when we hit another section
        if (line.trim() && !line.includes('DNS:') && !line.match(/^\s/)) {
          inSanSection = false;
        }
      }
    }
    
    // Fallback: try to read from certificate info if we found nothing
    if (allDomains.size === 0) {
      try {
        const certInfo = await readCertificate(certPath);
        if (certInfo.subject) {
          const cnMatch = certInfo.subject.match(/CN=([^,]+)/);
          if (cnMatch) {
            allDomains.add(cnMatch[1].replace(/\*/g, '').trim());
          }
        }
      } catch (e) {
        // Ignore
      }
    }
    
    return Array.from(allDomains).filter(d => d && d.length > 0);
  } catch (error) {
    console.warn(`[SSL Monitor] Error extracting domains from certificate: ${error.message}`);
    // Last fallback: try to read from certificate info
    try {
      const certInfo = await readCertificate(certPath);
      const domains = [];
      if (certInfo.subject) {
        const cnMatch = certInfo.subject.match(/CN=([^,]+)/);
        if (cnMatch) {
          domains.push(cnMatch[1].replace(/\*/g, '').trim());
        }
      }
      return domains;
    } catch (e) {
      return [];
    }
  }
}

/**
 * Normalize domain for comparison (remove www, lowercase)
 */
function normalizeDomain(domain) {
  if (!domain) return '';
  return domain.toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Check if certificate covers domain
 */
async function certificateCoversDomain(certPath, domain) {
  try {
    const certDomains = await getCertificateDomains(certPath);
    const normalizedDomain = normalizeDomain(domain);
    
    for (const certDomain of certDomains) {
      const normalizedCertDomain = normalizeDomain(certDomain);
      // Exact match
      if (normalizedCertDomain === normalizedDomain) return true;
      // Wildcard match (e.g., *.example.com matches example.com)
      if (normalizedCertDomain.startsWith('*.') && normalizedDomain.endsWith(normalizedCertDomain.slice(2))) return true;
      // www variant match
      if (normalizedCertDomain === `www.${normalizedDomain}` || normalizedDomain === `www.${normalizedCertDomain}`) return true;
    }
    return false;
  } catch (error) {
    console.warn(`[SSL Monitor] Error checking if certificate covers domain ${domain}:`, error.message);
    return false;
  }
}

/**
 * Find certificate path for domain - scan all certificates
 */
async function findCertificatePath(domain) {
  // Try standard Let's Encrypt path first
  const standardPath = path.join(LETSENCRYPT_BASE, domain, 'fullchain.pem');
  if (await certificateExists(standardPath)) {
    return standardPath;
  }
  
  // Try directory name variations
  const domainVariations = [
    domain,
    domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`,
  ];
  
  for (const variant of domainVariations) {
    const variantPath = path.join(LETSENCRYPT_BASE, variant, 'fullchain.pem');
    if (await certificateExists(variantPath)) {
      return variantPath;
    }
  }
  
  // Scan all certificates in Let's Encrypt directory
  try {
    const entries = await fs.readdir(LETSENCRYPT_BASE, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const certPath = path.join(LETSENCRYPT_BASE, entry.name, 'fullchain.pem');
        if (await certificateExists(certPath)) {
          // Check if this certificate covers the domain
          const covers = await certificateCoversDomain(certPath, domain);
          if (covers) {
            return certPath;
          }
        }
      }
    }
  } catch (error) {
    console.error(`[SSL Monitor] Error searching for certificate: ${error.message}`);
  }
  
  return null;
}

/**
 * Check if certbot is available
 */
async function isCertbotAvailable() {
  try {
    await fs.access(CERTBOT_PATH);
    return true;
  } catch {
    // Try to find certbot in PATH
    try {
      const { stdout } = await execAsync('which certbot');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Get certbot path
 */
async function getCertbotPath() {
  if (await certificateExists(CERTBOT_PATH)) {
    return CERTBOT_PATH;
  }
  try {
    const { stdout } = await execAsync('which certbot');
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Generate new certificate using certbot
 */
async function generateCertificate(domain, email = null) {
  const certbotPath = await getCertbotPath();
  if (!certbotPath) {
    throw new Error('Certbot nie jest zainstalowany lub nie można go znaleźć');
  }

  try {
    // Check if certificate already exists
    const existingCert = await findCertificatePath(domain);
    if (existingCert) {
      throw new Error(`Certyfikat dla domeny ${domain} już istnieje`);
    }

    // Default email for Let's Encrypt
    const certbotEmail = email || 'admin@soft-synergy.com';
    
    // Use certbot certonly with nginx plugin or standalone
    // Try nginx plugin first, fallback to standalone
    let command = `sudo ${certbotPath} certonly --nginx -d ${domain} --non-interactive --agree-tos --email ${certbotEmail} --quiet`;
    
    console.log(`[SSL Monitor] Generating certificate for ${domain}...`);
    let result;
    try {
      result = await execAsync(command, { timeout: 300000 }); // 5 minute timeout
    } catch (nginxError) {
      // If nginx plugin fails, try standalone (requires port 80 to be free)
      console.log(`[SSL Monitor] Nginx plugin failed, trying standalone mode...`);
      command = `sudo ${certbotPath} certonly --standalone -d ${domain} --non-interactive --agree-tos --email ${certbotEmail} --quiet`;
      result = await execAsync(command, { timeout: 300000 });
    }
    
    // Reload nginx after certificate generation
    try {
      await execAsync('sudo systemctl reload nginx', { timeout: 10000 });
      console.log(`[SSL Monitor] Nginx reloaded after certificate generation`);
    } catch (reloadError) {
      console.warn(`[SSL Monitor] Could not reload nginx: ${reloadError.message}`);
    }
    
    console.log(`[SSL Monitor] Certificate generation completed for ${domain}`);
    return { success: true, output: result.stdout, error: result.stderr || null };
  } catch (error) {
    console.error(`[SSL Monitor] Error generating certificate for ${domain}:`, error.message);
    throw error;
  }
}

/**
 * Renew certificate using certbot
 */
async function renewCertificate(domain) {
  const certbotPath = await getCertbotPath();
  if (!certbotPath) {
    throw new Error('Certbot nie jest zainstalowany lub nie można go znaleźć');
  }

  try {
    // Run certbot renew for specific domain
    // Note: certbot renew renews all certificates, but we can specify a certificate name
    const certPath = await findCertificatePath(domain);
    if (!certPath) {
      throw new Error(`Nie znaleziono certyfikatu dla domeny: ${domain}`);
    }

    // Extract certificate name from path (directory name in /etc/letsencrypt/live/)
    const certName = path.basename(path.dirname(certPath));
    
    // Use certbot renew with --cert-name flag for specific certificate
    const command = `sudo ${certbotPath} renew --cert-name ${certName} --quiet --no-random-sleep-on-renew`;
    
    console.log(`[SSL Monitor] Renewing certificate for ${domain}...`);
    const { stdout, stderr } = await execAsync(command, { timeout: 300000 }); // 5 minute timeout
    
    if (stderr && !stderr.includes('Congratulations') && !stderr.includes('No renewals were attempted')) {
      console.warn(`[SSL Monitor] Certbot stderr for ${domain}: ${stderr}`);
    }
    
    console.log(`[SSL Monitor] Certificate renewal completed for ${domain}`);
    return { success: true, output: stdout, error: stderr || null };
  } catch (error) {
    console.error(`[SSL Monitor] Error renewing certificate for ${domain}:`, error.message);
    throw error;
  }
}

/**
 * Check certificate for a single domain
 */
async function checkCertificate(domain) {
  try {
    // Find certificate path - this scans all certificates
    const certPath = await findCertificatePath(domain);
    
    if (!certPath) {
      // Update database with not found status
      await SSLCert.findOneAndUpdate(
        { domain },
        {
          domain,
          certificatePath: null,
          status: 'not_found',
          isExpired: false,
          isExpiringSoon: false,
          lastCheckedAt: new Date(),
          lastError: 'Certificate file not found',
          $inc: { checkCount: 1 }
        },
        { upsert: true, new: true }
      );
      
      return {
        domain,
        status: 'not_found',
        error: 'Certificate file not found',
        certificatePath: null
      };
    }
    
    // Read and parse certificate
    const certInfo = await readCertificate(certPath);
    const daysUntilExpiry = getDaysUntilExpiry(certInfo.validTo);
    const statusInfo = getCertificateStatus(daysUntilExpiry, 30);

    // Get all domains from certificate and save them all to DB
    const certDomains = await getCertificateDomains(certPath);
    console.log(`[SSL Monitor] Certificate for ${domain} covers domains: ${certDomains.join(', ')}`);

    // Save certificate info for all domains covered by this certificate
    const certData = {
      certificatePath: certPath,
      issuer: certInfo.issuer,
      subject: certInfo.subject,
      validFrom: new Date(certInfo.validFrom),
      validTo: new Date(certInfo.validTo),
      daysUntilExpiry,
      status: statusInfo.status,
      isExpired: statusInfo.isExpired,
      isExpiringSoon: statusInfo.isExpiringSoon,
      lastCheckedAt: new Date(),
      lastError: null,
      alarmActive: statusInfo.isExpired || statusInfo.isExpiringSoon,
      autoRenew: true,
      renewalThreshold: 30
    };

    // Update database for the requested domain
    const sslCert = await SSLCert.findOneAndUpdate(
      { domain },
      {
        domain,
        ...certData,
        $inc: { checkCount: 1 }
      },
      { upsert: true, new: true }
    );

    // Also save for all other domains in the certificate (if they exist)
    for (const certDomain of certDomains) {
      if (certDomain.toLowerCase() !== domain.toLowerCase()) {
        await SSLCert.findOneAndUpdate(
          { domain: certDomain },
          {
            domain: certDomain,
            ...certData,
            $inc: { checkCount: 1 }
          },
          { upsert: true, new: true }
        );
      }
    }

    // Auto-renew if needed
    if (sslCert.autoRenew && statusInfo.isExpiringSoon && !statusInfo.isExpired) {
      try {
        console.log(`[SSL Monitor] Auto-renewing certificate for ${domain} (expires in ${daysUntilExpiry} days)`);
        const renewalResult = await renewCertificate(domain);
        
        // Re-check certificate after renewal
        const renewedCertInfo = await readCertificate(certPath);
        const renewedDaysUntilExpiry = getDaysUntilExpiry(renewedCertInfo.validTo);
        const renewedStatusInfo = getCertificateStatus(renewedDaysUntilExpiry, 30);

        await SSLCert.findOneAndUpdate(
          { domain },
          {
            lastRenewedAt: new Date(),
            lastRenewalError: null,
            validFrom: new Date(renewedCertInfo.validFrom),
            validTo: new Date(renewedCertInfo.validTo),
            daysUntilExpiry: renewedDaysUntilExpiry,
            status: renewedStatusInfo.status,
            isExpired: renewedStatusInfo.isExpired,
            isExpiringSoon: renewedStatusInfo.isExpiringSoon,
            alarmActive: renewedStatusInfo.isExpired || renewedStatusInfo.isExpiringSoon,
            $inc: { renewalCount: 1 }
          }
        );

        // Reload web server if needed (nginx, apache, etc.)
        // This is optional and depends on your setup
        try {
          await execAsync('sudo systemctl reload nginx', { timeout: 10000 });
          console.log(`[SSL Monitor] Nginx reloaded after certificate renewal for ${domain}`);
        } catch (reloadError) {
          console.warn(`[SSL Monitor] Could not reload nginx: ${reloadError.message}`);
        }

        return {
          domain,
          status: renewedStatusInfo.status,
          daysUntilExpiry: renewedDaysUntilExpiry,
          renewed: true,
          certificatePath: certPath,
          ...renewedCertInfo
        };
      } catch (renewalError) {
        await SSLCert.findOneAndUpdate(
          { domain },
          {
            lastRenewalError: renewalError.message,
            alarmActive: true
          }
        );
        
        return {
          domain,
          status: statusInfo.status,
          daysUntilExpiry,
          renewed: false,
          renewalError: renewalError.message,
          certificatePath: certPath,
          ...certInfo
        };
      }
    }

    return {
      domain,
      status: statusInfo.status,
      daysUntilExpiry,
      renewed: false,
      certificatePath: certPath,
      ...certInfo
    };
  } catch (error) {
    console.error(`[SSL Monitor] Error checking certificate for ${domain}:`, error);
    
    await SSLCert.findOneAndUpdate(
      { domain },
      {
        domain,
        status: 'error',
        lastCheckedAt: new Date(),
        lastError: error.message,
        alarmActive: true,
        $inc: { checkCount: 1 }
      },
      { upsert: true, new: true }
    );

    return {
      domain,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Check all certificates in database
 */
async function checkAllCertificates() {
  const certificates = await SSLCert.find({});
  const results = [];

  for (const cert of certificates) {
    try {
      const result = await checkCertificate(cert.domain);
      results.push(result);
      // Small delay between checks to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[SSL Monitor] Error checking certificate ${cert.domain}:`, error);
      results.push({
        domain: cert.domain,
        status: 'error',
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Scan nginx configuration files to find all domains
 */
async function scanNginxConfigs() {
  const domains = new Set();
  const nginxConfigPaths = [
    '/etc/nginx/sites-available',
    '/etc/nginx/conf.d',
    '/etc/nginx/nginx.conf'
  ];

  try {
    for (const configPath of nginxConfigPaths) {
      try {
        const stats = await fs.stat(configPath);
        if (stats.isFile()) {
          // Single config file
          const content = await fs.readFile(configPath, 'utf8');
          const serverNames = extractServerNames(content);
          serverNames.forEach(d => domains.add(d));
        } else if (stats.isDirectory()) {
          // Directory with config files
          const entries = await fs.readdir(configPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && !entry.name.endsWith('~') && !entry.name.endsWith('.bak')) {
              try {
                const filePath = path.join(configPath, entry.name);
                const content = await fs.readFile(filePath, 'utf8');
                const serverNames = extractServerNames(content);
                serverNames.forEach(d => domains.add(d));
              } catch (e) {
                // Skip files we can't read
              }
            }
          }
        }
      } catch (e) {
        // Skip paths that don't exist
        continue;
      }
    }
  } catch (error) {
    console.warn(`[SSL Monitor] Error scanning nginx configs: ${error.message}`);
  }

  return Array.from(domains);
}

/**
 * Extract server_name directives from nginx config content
 */
function extractServerNames(content) {
  const domains = [];
  // Match server_name directives (can be multiple domains per line)
  const serverNameRegex = /server_name\s+([^;]+);/gi;
  let match;
  
  while ((match = serverNameRegex.exec(content)) !== null) {
    const serverNames = match[1].trim();
    // Split by spaces and filter out wildcards, default, and empty strings
    const names = serverNames.split(/\s+/)
      .map(name => name.trim())
      .filter(name => name && name !== '_' && name !== 'default_server' && !name.startsWith('*.'));
    
    domains.push(...names);
  }
  
  return domains;
}

/**
 * Auto-discover certificates from Let's Encrypt directory and nginx configs
 */
async function discoverCertificates() {
  const domains = new Set();
  
  // First, scan all certificates in Let's Encrypt directory
  try {
    const entries = await fs.readdir(LETSENCRYPT_BASE, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const certPath = path.join(LETSENCRYPT_BASE, entry.name, 'fullchain.pem');
        
        if (await certificateExists(certPath)) {
          try {
            // Get all domains from certificate
            const certDomains = await getCertificateDomains(certPath);
            certDomains.forEach(d => {
              if (d && !d.startsWith('*')) {
                domains.add(d.toLowerCase());
              }
            });
          } catch (error) {
            console.warn(`[SSL Monitor] Could not parse certificate in ${entry.name}: ${error.message}`);
            // Fallback: use directory name
            domains.add(entry.name.toLowerCase());
          }
        }
      }
    }
  } catch (error) {
    console.error(`[SSL Monitor] Error discovering certificates: ${error.message}`);
  }

  // Also scan nginx configs to find domains that might have certificates
  try {
    const nginxDomains = await scanNginxConfigs();
    nginxDomains.forEach(d => domains.add(d.toLowerCase()));
  } catch (error) {
    console.warn(`[SSL Monitor] Error scanning nginx configs: ${error.message}`);
  }

  return Array.from(domains);
}

/**
 * Initialize certificates in database
 */
async function initializeCertificates() {
  const discoveredDomains = await discoverCertificates();
  console.log(`[SSL Monitor] Discovered ${discoveredDomains.length} domains: ${discoveredDomains.join(', ')}`);
  
  // Check certificates for all discovered domains
  for (const domain of discoveredDomains) {
    try {
      await checkCertificate(domain);
    } catch (error) {
      console.warn(`[SSL Monitor] Error checking certificate for ${domain}: ${error.message}`);
    }
  }
  
  return discoveredDomains;
}

let intervalHandle = null;

/**
 * Start SSL monitoring
 */
function start(intervalMs = 24 * 60 * 60 * 1000) { // Default: once per day
  if (intervalHandle) {
    console.log('[SSL Monitor] Monitor już działa');
    return;
  }

  console.log('[SSL Monitor] Inicjalizacja monitora SSL...');
  
  // Initialize certificates on start
  initializeCertificates()
    .then((domains) => {
      console.log(`[SSL Monitor] Znaleziono ${domains.length} certyfikatów: ${domains.join(', ')}`);
    })
    .catch((error) => {
      console.error('[SSL Monitor] Błąd podczas inicjalizacji:', error);
    });

  // Run initial check after 10 seconds
  setTimeout(async () => {
    console.log('[SSL Monitor] Uruchamianie pierwszego sprawdzenia certyfikatów...');
    try {
      await checkAllCertificates();
      console.log('[SSL Monitor] Pierwsze sprawdzenie zakończone');
    } catch (error) {
      console.error('[SSL Monitor] Błąd podczas pierwszego sprawdzenia:', error);
    }
  }, 10000);

  // Set up periodic checks
  intervalHandle = setInterval(async () => {
    console.log('[SSL Monitor] Sprawdzanie certyfikatów SSL...');
    try {
      await checkAllCertificates();
      console.log('[SSL Monitor] Sprawdzanie zakończone');
    } catch (error) {
      console.error('[SSL Monitor] Błąd podczas sprawdzania:', error);
    }
  }, intervalMs);

  console.log(`[SSL Monitor] Monitor SSL uruchomiony (sprawdzanie co ${intervalMs / 1000 / 60} minut)`);
}

/**
 * Stop SSL monitoring
 */
function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[SSL Monitor] Monitor SSL zatrzymany');
  }
}

/**
 * Run check once (manual trigger)
 */
async function runOnce() {
  console.log('[SSL Monitor] Uruchamianie jednorazowego sprawdzenia...');
  await initializeCertificates();
  return await checkAllCertificates();
}

module.exports = {
  start,
  stop,
  runOnce,
  checkCertificate,
  checkAllCertificates,
  renewCertificate,
  generateCertificate,
  discoverCertificates,
  initializeCertificates,
  isCertbotAvailable,
  getCertbotPath,
  findCertificatePath,
  getCertificateDomains,
  scanNginxConfigs
};

