const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const SSLCert = require('../models/SSLCert');

const execAsync = promisify(exec);

// Standard Let's Encrypt paths
const LETSENCRYPT_BASE = '/etc/letsencrypt/live';
const CERTBOT_PATH = '/usr/bin/certbot'; // Standard path for certbot

/**
 * Check certificate by connecting to domain over network
 * This is the primary method - doesn't rely on filesystem
 */
async function checkCertificateOverNetwork(domain, port = 443) {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port: port,
      rejectUnauthorized: false, // We want to check the cert even if it's expired
      servername: domain, // SNI
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate(true);
      
      if (!cert || !cert.valid_to) {
        socket.destroy();
        return reject(new Error('No certificate received'));
      }

      const result = {
        validFrom: new Date(cert.valid_from),
        validTo: new Date(cert.valid_to),
        issuer: cert.issuer ? JSON.stringify(cert.issuer) : null,
        subject: cert.subject ? JSON.stringify(cert.subject) : null,
        subjectaltname: cert.subjectaltname || null,
        serialNumber: cert.serialNumber || null,
        fingerprint: cert.fingerprint256 || cert.fingerprint || null,
      };

      socket.destroy();
      resolve(result);
    });

    socket.on('error', (error) => {
      socket.destroy();
      reject(error);
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

/**
 * Get certificate domains from network certificate
 */
function extractDomainsFromCertificate(certInfo) {
  const domains = new Set();
  
  // Extract from subject
  if (certInfo.subject) {
    try {
      const subject = typeof certInfo.subject === 'string' ? JSON.parse(certInfo.subject) : certInfo.subject;
      if (subject.CN) {
        domains.add(subject.CN);
      }
    } catch (e) {
      // Try to extract CN from string format
      const cnMatch = certInfo.subject.match(/CN=([^,]+)/);
      if (cnMatch) {
        domains.add(cnMatch[1].trim());
      }
    }
  }
  
  // Extract from subjectAltName
  if (certInfo.subjectaltname) {
    // Format: "DNS:domain1.com, DNS:domain2.com"
    const sanMatches = certInfo.subjectaltname.matchAll(/DNS:([^,\s]+)/gi);
    for (const match of sanMatches) {
      if (match[1]) {
        domains.add(match[1].trim());
      }
    }
  }
  
  return Array.from(domains).filter(d => d && d.length > 0);
}

/**
 * Check certificate using openssl s_client (alternative method)
 */
async function checkCertificateWithOpenSSL(domain, port = 443) {
  try {
    // Use openssl s_client to get certificate
    const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:${port} -showcerts 2>/dev/null | openssl x509 -noout -dates -subject -issuer -serial -fingerprint -sha256`;
    
    const { stdout } = await execAsync(command, { timeout: 15000 });
    
    const lines = stdout.split('\n');
    const result = {
      validFrom: null,
      validTo: null,
      issuer: null,
      subject: null,
      serialNumber: null,
      fingerprint: null,
    };

    for (const line of lines) {
      if (line.startsWith('notBefore=')) {
        result.validFrom = new Date(line.replace('notBefore=', '').trim());
      } else if (line.startsWith('notAfter=')) {
        result.validTo = new Date(line.replace('notAfter=', '').trim());
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

    if (!result.validTo) {
      throw new Error('Could not extract certificate dates');
    }

    return result;
  } catch (error) {
    throw new Error(`OpenSSL check failed: ${error.message}`);
  }
}

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
    console.log(`[SSL Monitor] getCertificateDomains: Reading certificate from ${certPath}`);
    
    // Get full certificate text
    const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -text`, { timeout: 10000 });
    const allDomains = new Set();
    
    // Extract CN from subject - simpler approach
    const subjectLine = stdout.split('\n').find(line => line.includes('Subject:'));
    if (subjectLine) {
      console.log(`[SSL Monitor] getCertificateDomains: Subject line: ${subjectLine}`);
      const cnMatch = subjectLine.match(/CN\s*=\s*([^,/\n]+)/);
      if (cnMatch && cnMatch[1]) {
        const cnDomain = cnMatch[1].trim();
        if (cnDomain) {
          const cleanDomain = cnDomain.replace(/\*/g, '');
          allDomains.add(cleanDomain);
          console.log(`[SSL Monitor] getCertificateDomains: Found CN domain: ${cleanDomain}`);
        }
      }
    }
    
    // Extract SAN domains - look for DNS: patterns
    const lines = stdout.split('\n');
    let inSanSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('X509v3 Subject Alternative Name')) {
        inSanSection = true;
        console.log(`[SSL Monitor] getCertificateDomains: Found SAN section at line ${i}`);
        continue;
      }
      if (inSanSection) {
        // Match DNS:domain patterns
        const dnsMatches = line.matchAll(/DNS:([^,\s]+)/gi);
        for (const match of dnsMatches) {
          if (match[1]) {
            const cleanDomain = match[1].trim().replace(/\*/g, '');
            allDomains.add(cleanDomain);
            console.log(`[SSL Monitor] getCertificateDomains: Found SAN domain: ${cleanDomain}`);
          }
        }
        // Stop when we hit another section
        if (line.trim() && !line.includes('DNS:') && !line.match(/^\s/)) {
          inSanSection = false;
          console.log(`[SSL Monitor] getCertificateDomains: Left SAN section at line ${i}`);
        }
      }
    }
    
    // Fallback: try to read from certificate info if we found nothing
    if (allDomains.size === 0) {
      console.log(`[SSL Monitor] getCertificateDomains: No domains found in main extraction, trying fallback...`);
      try {
        const certInfo = await readCertificate(certPath);
        if (certInfo.subject) {
          console.log(`[SSL Monitor] getCertificateDomains: Fallback - Subject: ${certInfo.subject}`);
          const cnMatch = certInfo.subject.match(/CN=([^,]+)/);
          if (cnMatch) {
            const cleanDomain = cnMatch[1].replace(/\*/g, '').trim();
            allDomains.add(cleanDomain);
            console.log(`[SSL Monitor] getCertificateDomains: Fallback - Found CN domain: ${cleanDomain}`);
          }
        }
      } catch (e) {
        console.warn(`[SSL Monitor] getCertificateDomains: Fallback failed: ${e.message}`);
      }
    }
    
    const domains = Array.from(allDomains).filter(d => d && d.length > 0);
    console.log(`[SSL Monitor] getCertificateDomains: Final domains extracted: ${domains.join(', ')}`);
    return domains;
  } catch (error) {
    console.error(`[SSL Monitor] Error extracting domains from certificate ${certPath}: ${error.message}`);
    console.error(`[SSL Monitor] Error stack:`, error.stack);
    
    // Last fallback: try to read from certificate info
    try {
      console.log(`[SSL Monitor] getCertificateDomains: Trying last fallback...`);
      const certInfo = await readCertificate(certPath);
      const domains = [];
      if (certInfo.subject) {
        const cnMatch = certInfo.subject.match(/CN=([^,]+)/);
        if (cnMatch) {
          domains.push(cnMatch[1].replace(/\*/g, '').trim());
          console.log(`[SSL Monitor] getCertificateDomains: Last fallback - Found domain: ${domains[0]}`);
        }
      }
      return domains;
    } catch (e) {
      console.error(`[SSL Monitor] getCertificateDomains: Last fallback also failed: ${e.message}`);
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
    
    console.log(`[SSL Monitor] certificateCoversDomain: Checking if cert at ${certPath} covers ${domain}`);
    console.log(`[SSL Monitor] certificateCoversDomain: Certificate domains: ${certDomains.join(', ')}`);
    console.log(`[SSL Monitor] certificateCoversDomain: Normalized search domain: ${normalizedDomain}`);
    
    for (const certDomain of certDomains) {
      const normalizedCertDomain = normalizeDomain(certDomain);
      console.log(`[SSL Monitor] certificateCoversDomain: Comparing "${normalizedCertDomain}" with "${normalizedDomain}"`);
      
      // Exact match
      if (normalizedCertDomain === normalizedDomain) {
        console.log(`[SSL Monitor] certificateCoversDomain: ✅ Exact match found!`);
        return true;
      }
      // Wildcard match (e.g., *.example.com matches example.com)
      if (normalizedCertDomain.startsWith('*.') && normalizedDomain.endsWith(normalizedCertDomain.slice(2))) {
        console.log(`[SSL Monitor] certificateCoversDomain: ✅ Wildcard match found!`);
        return true;
      }
      // www variant match
      if (normalizedCertDomain === `www.${normalizedDomain}` || normalizedDomain === `www.${normalizedCertDomain}`) {
        console.log(`[SSL Monitor] certificateCoversDomain: ✅ WWW variant match found!`);
        return true;
      }
    }
    console.log(`[SSL Monitor] certificateCoversDomain: ❌ No match found`);
    return false;
  } catch (error) {
    console.warn(`[SSL Monitor] Error checking if certificate covers domain ${domain}:`, error.message);
    console.warn(`[SSL Monitor] Error stack:`, error.stack);
    return false;
  }
}

/**
 * Find certificate path for domain - scan all certificates
 */
async function findCertificatePath(domain) {
  const normalizedDomain = normalizeDomain(domain);
  
  // Try standard Let's Encrypt path first
  const standardPath = path.join(LETSENCRYPT_BASE, domain, 'fullchain.pem');
  if (await certificateExists(standardPath)) {
    console.log(`[SSL Monitor] Found certificate at standard path: ${standardPath}`);
    return standardPath;
  }
  
  // Try directory name variations (exact matches first)
  const domainVariations = [
    domain,
    domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`,
  ];
  
  for (const variant of domainVariations) {
    const variantPath = path.join(LETSENCRYPT_BASE, variant, 'fullchain.pem');
    if (await certificateExists(variantPath)) {
      console.log(`[SSL Monitor] Found certificate at variant path: ${variantPath}`);
      return variantPath;
    }
  }
  
  // Scan all certificates in Let's Encrypt directory (most comprehensive search)
  // This is the key part - we scan ALL certificates regardless of directory name
  try {
    const entries = await fs.readdir(LETSENCRYPT_BASE, { withFileTypes: true });
    console.log(`[SSL Monitor] Scanning ${entries.length} directories in ${LETSENCRYPT_BASE} for domain ${domain}...`);
    console.log(`[SSL Monitor] Looking for normalized domain: ${normalizedDomain}`);
    console.log(`[SSL Monitor] NOTE: Checking certificate CONTENT, not just directory names!`);
    
    const foundCertificates = [];
    const certificatesChecked = [];
    
    // First pass: Quick check by directory name
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const certPath = path.join(LETSENCRYPT_BASE, entry.name, 'fullchain.pem');
        const certExists = await certificateExists(certPath);
        
        if (certExists) {
          foundCertificates.push({ directory: entry.name, path: certPath });
          
          // Quick check: does directory name match?
          const normalizedDirName = normalizeDomain(entry.name);
          if (normalizedDirName === normalizedDomain) {
            console.log(`[SSL Monitor] ✅ QUICK MATCH! Directory name "${entry.name}" matches domain "${domain}"`);
            console.log(`[SSL Monitor] Returning certificate: ${certPath}`);
            return certPath;
          }
        }
      }
    }
    
    console.log(`[SSL Monitor] Found ${foundCertificates.length} certificate directories to check: ${foundCertificates.map(c => c.directory).join(', ')}`);
    
    // Second pass: Check certificate content for domain coverage
    // This is critical - vhost directory name might be different from domain
    for (const certInfo of foundCertificates) {
      const { directory, path: certPath } = certInfo;
      
      try {
        console.log(`[SSL Monitor] 📄 Reading certificate from directory: ${directory}`);
        
        // Get all domains from certificate - this is the key!
        const certDomains = await getCertificateDomains(certPath);
        console.log(`[SSL Monitor] Certificate in "${directory}" contains ${certDomains.length} domains: ${certDomains.join(', ')}`);
        
        if (certDomains.length === 0) {
          console.warn(`[SSL Monitor] ⚠️  Certificate in "${directory}" has no domains extracted!`);
          continue;
        }
        
        // Check if ANY domain in the certificate matches our search domain
        let matched = false;
        for (const certDomain of certDomains) {
          const normalizedCertDomain = normalizeDomain(certDomain);
          
          // Exact match (after normalization)
          if (normalizedCertDomain === normalizedDomain) {
            console.log(`[SSL Monitor] ✅ MATCH! Domain "${certDomain}" (normalized: "${normalizedCertDomain}") matches "${domain}" (normalized: "${normalizedDomain}")`);
            matched = true;
            break;
          }
          
          // WWW variant match
          if (normalizedCertDomain === `www.${normalizedDomain}` || normalizedDomain === `www.${normalizedCertDomain}`) {
            console.log(`[SSL Monitor] ✅ MATCH! WWW variant: "${certDomain}" matches "${domain}"`);
            matched = true;
            break;
          }
          
          // Check if one is www version of the other
          if ((certDomain.toLowerCase().startsWith('www.') && certDomain.toLowerCase().slice(4) === domain.toLowerCase()) ||
              (domain.toLowerCase().startsWith('www.') && domain.toLowerCase().slice(4) === certDomain.toLowerCase())) {
            console.log(`[SSL Monitor] ✅ MATCH! WWW variant match: "${certDomain}" <-> "${domain}"`);
            matched = true;
            break;
          }
          
          // Wildcard match
          if (certDomain.startsWith('*.') && normalizedDomain.endsWith(certDomain.slice(2).toLowerCase())) {
            console.log(`[SSL Monitor] ✅ MATCH! Wildcard: "${certDomain}" matches "${domain}"`);
            matched = true;
            break;
          }
        }
        
        if (matched) {
          console.log(`[SSL Monitor] ✅✅✅ FOUND CERTIFICATE!`);
          console.log(`[SSL Monitor] Directory name: "${directory}" (may differ from domain!)`);
          console.log(`[SSL Monitor] Certificate path: ${certPath}`);
          console.log(`[SSL Monitor] Certificate covers domain: ${domain}`);
          certificatesChecked.push({ directory, path: certPath, matched: true, domains: certDomains });
          return certPath;
        } else {
          console.log(`[SSL Monitor] ❌ Certificate in "${directory}" does NOT cover domain "${domain}"`);
          certificatesChecked.push({ directory, path: certPath, matched: false, domains: certDomains });
        }
        
      } catch (checkError) {
        // If we can't check this certificate, log it but continue with others
        console.error(`[SSL Monitor] ❌ ERROR checking certificate in "${directory}": ${checkError.message}`);
        console.error(`[SSL Monitor] Error stack:`, checkError.stack);
        certificatesChecked.push({ directory, path: certPath, matched: false, error: checkError.message });
        // Continue checking other certificates - don't give up!
      }
    }
    
    // Summary
    console.warn(`[SSL Monitor] ⚠️  Scanned ${foundCertificates.length} certificate directories`);
    console.warn(`[SSL Monitor] ⚠️  Checked ${certificatesChecked.filter(c => !c.error).length} certificates`);
    console.warn(`[SSL Monitor] ⚠️  None of them matched domain: ${domain} (normalized: ${normalizedDomain})`);
    
    if (certificatesChecked.length > 0) {
      console.warn(`[SSL Monitor] 📋 Summary of checked certificates:`);
      certificatesChecked.forEach(cert => {
        if (cert.error) {
          console.warn(`  - ${cert.directory}: ERROR - ${cert.error}`);
        } else {
          console.warn(`  - ${cert.directory}: ${cert.domains.join(', ')} (${cert.matched ? '✅ MATCHED' : '❌ no match'})`);
        }
      });
    }
    
  } catch (error) {
    console.error(`[SSL Monitor] ❌ ERROR searching for certificate: ${error.message}`);
    console.error(`[SSL Monitor] Error stack:`, error.stack);
    // If we can't read the directory, try to check if it exists
    try {
      await fs.access(LETSENCRYPT_BASE);
      console.log(`[SSL Monitor] Directory ${LETSENCRYPT_BASE} is accessible`);
    } catch (accessError) {
      console.error(`[SSL Monitor] Cannot access Let's Encrypt directory: ${LETSENCRYPT_BASE} - ${accessError.message}`);
    }
  }
  
  console.warn(`[SSL Monitor] Certificate not found for domain: ${domain}`);
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
 * PRIMARY METHOD: Check over network (doesn't rely on filesystem)
 * FALLBACK: Try filesystem if network check fails
 */
async function checkCertificate(domain) {
  try {
    console.log(`[SSL Monitor] Checking certificate for domain: ${domain}`);
    
    let certInfo = null;
    let certPath = null;
    let certDomains = [];
    let checkMethod = 'unknown';
    
    // PRIMARY METHOD: Check certificate over network (recommended)
    try {
      console.log(`[SSL Monitor] Attempting network check for ${domain}...`);
      certInfo = await checkCertificateOverNetwork(domain);
      certDomains = extractDomainsFromCertificate(certInfo);
      checkMethod = 'network';
      console.log(`[SSL Monitor] ✅ Network check successful for ${domain}`);
      console.log(`[SSL Monitor] Certificate valid to: ${certInfo.validTo}`);
      console.log(`[SSL Monitor] Certificate domains: ${certDomains.join(', ')}`);
    } catch (networkError) {
      console.log(`[SSL Monitor] Network check failed, trying OpenSSL s_client...`);
      
      // FALLBACK 1: Try openssl s_client
      try {
        certInfo = await checkCertificateWithOpenSSL(domain);
        // For OpenSSL method, we need to extract domains differently
        if (certInfo.subject) {
          const cnMatch = certInfo.subject.match(/CN=([^,/\n]+)/);
          if (cnMatch) {
            certDomains.push(cnMatch[1].trim());
          }
        }
        checkMethod = 'openssl_network';
        console.log(`[SSL Monitor] ✅ OpenSSL network check successful for ${domain}`);
      } catch (opensslError) {
        console.log(`[SSL Monitor] OpenSSL network check failed, trying filesystem...`);
        
        // FALLBACK 2: Try filesystem (if we have access)
        try {
          certPath = await findCertificatePath(domain);
          if (certPath) {
            certInfo = await readCertificate(certPath);
            certDomains = await getCertificateDomains(certPath);
            checkMethod = 'filesystem';
            console.log(`[SSL Monitor] ✅ Filesystem check successful for ${domain}`);
          } else {
            throw new Error('Certificate not found in filesystem');
          }
        } catch (fsError) {
          console.error(`[SSL Monitor] All check methods failed for ${domain}`);
          throw new Error(`All certificate check methods failed: Network: ${networkError.message}, OpenSSL: ${opensslError.message}, Filesystem: ${fsError.message}`);
        }
      }
    }
    
    if (!certInfo || !certInfo.validTo) {
      throw new Error('Could not extract certificate information');
    }
    
    // Convert validTo to Date if it's a string
    const validToDate = certInfo.validTo instanceof Date ? certInfo.validTo : new Date(certInfo.validTo);
    const validFromDate = certInfo.validFrom instanceof Date ? certInfo.validFrom : new Date(certInfo.validFrom);
    
    const daysUntilExpiry = getDaysUntilExpiry(validToDate.toISOString());
    const statusInfo = getCertificateStatus(daysUntilExpiry, 30);

    // For OpenSSL method, try to get full domain list if we don't have it
    if (checkMethod === 'openssl_network' && certDomains.length === 0 && certInfo.subject) {
      // Try to get full certificate text with SAN
      try {
        const { stdout } = await execAsync(`echo | openssl s_client -servername ${domain} -connect ${domain}:443 -showcerts 2>/dev/null | openssl x509 -noout -text`, { timeout: 15000 });
        const sanMatches = stdout.matchAll(/DNS:([^,\s\n]+)/gi);
        for (const match of sanMatches) {
          if (match[1]) {
            certDomains.push(match[1].trim());
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    console.log(`[SSL Monitor] Certificate for ${domain} covers ${certDomains.length} domains: ${certDomains.join(', ') || 'none extracted'}`);
    console.log(`[SSL Monitor] Certificate status: ${statusInfo.status}, days until expiry: ${daysUntilExpiry}`);
    console.log(`[SSL Monitor] Check method: ${checkMethod}`);
    if (certPath) {
      console.log(`[SSL Monitor] Certificate path: ${certPath}`);
    }

    // Ensure we have at least the requested domain in the list
    if (certDomains.length === 0) {
      certDomains = [domain];
    } else {
      // Add the requested domain if it's not already in the list
      const normalizedRequested = normalizeDomain(domain);
      const hasRequestedDomain = certDomains.some(d => normalizeDomain(d) === normalizedRequested);
      if (!hasRequestedDomain) {
        certDomains.push(domain);
      }
    }

    // Save certificate info for all domains covered by this certificate
    const certData = {
      certificatePath: certPath || null,
      issuer: typeof certInfo.issuer === 'string' ? certInfo.issuer : JSON.stringify(certInfo.issuer),
      subject: typeof certInfo.subject === 'string' ? certInfo.subject : JSON.stringify(certInfo.subject),
      validFrom: validFromDate,
      validTo: validToDate,
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

    // IMPORTANT: Save certificate for ALL domains in the certificate
    // This ensures that even if vhost directory name is different, 
    // all domains will be found in the database
    const savedDomains = [];
    
    // First, save for the requested domain (even if it's not in certDomains)
    const sslCert = await SSLCert.findOneAndUpdate(
      { domain },
      {
        domain,
        ...certData,
        $inc: { checkCount: 1 }
      },
      { upsert: true, new: true }
    );
    savedDomains.push(domain);
    console.log(`[SSL Monitor] ✅ Saved certificate for requested domain: ${domain} (status: ${sslCert.status})`);

    // Then save for ALL domains found in the certificate
    for (const certDomain of certDomains) {
      // Normalize both to avoid duplicates
      const normalizedCertDomain = normalizeDomain(certDomain);
      const normalizedRequestedDomain = normalizeDomain(domain);
      
      // Skip if it's the same domain (already saved above)
      if (normalizedCertDomain === normalizedRequestedDomain) {
        console.log(`[SSL Monitor] Skipping duplicate: ${certDomain} (same as requested domain ${domain})`);
        continue;
      }
      
      // Skip if we already saved this exact domain
      if (certDomain.toLowerCase() === domain.toLowerCase()) {
        continue;
      }
      
      try {
        const savedCert = await SSLCert.findOneAndUpdate(
          { domain: certDomain },
          {
            domain: certDomain,
            ...certData,
            $inc: { checkCount: 1 }
          },
          { upsert: true, new: true }
        );
        savedDomains.push(certDomain);
        console.log(`[SSL Monitor] ✅ Saved certificate for domain from cert: ${certDomain} (status: ${savedCert.status})`);
      } catch (saveError) {
        console.error(`[SSL Monitor] ❌ Error saving certificate for domain ${certDomain}: ${saveError.message}`);
      }
    }
    
    // Also save for www variants if they don't already exist
    const wwwVariants = [
      domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`,
    ];
    for (const variant of wwwVariants) {
      if (!savedDomains.includes(variant)) {
        // Check if this variant is in certDomains
        const variantInCert = certDomains.some(d => normalizeDomain(d) === normalizeDomain(variant));
        if (variantInCert || normalizeDomain(variant) === normalizedDomain) {
          try {
            const savedCert = await SSLCert.findOneAndUpdate(
              { domain: variant },
              {
                domain: variant,
                ...certData,
                $inc: { checkCount: 1 }
              },
              { upsert: true, new: true }
            );
            savedDomains.push(variant);
            console.log(`[SSL Monitor] ✅ Saved certificate for www variant: ${variant} (status: ${savedCert.status})`);
          } catch (saveError) {
            console.error(`[SSL Monitor] ❌ Error saving certificate for variant ${variant}: ${saveError.message}`);
          }
        }
      }
    }
    
    console.log(`[SSL Monitor] 📊 Saved certificate for ${savedDomains.length} domains: ${savedDomains.join(', ')}`);

    // Auto-renew if needed (based on daysUntilExpiry from database)
    if (sslCert.autoRenew && statusInfo.isExpiringSoon && !statusInfo.isExpired) {
      try {
        console.log(`[SSL Monitor] 🔄 Auto-renewing certificate for ${domain} (expires in ${daysUntilExpiry} days)`);
        const renewalResult = await renewCertificate(domain);
        
        // Wait a bit for renewal to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Re-check certificate after renewal (use network check)
        let renewedCertInfo;
        try {
          renewedCertInfo = await checkCertificateOverNetwork(domain);
        } catch (networkError) {
          // Fallback to OpenSSL
          try {
            renewedCertInfo = await checkCertificateWithOpenSSL(domain);
          } catch (opensslError) {
            // If network check fails, try filesystem
            if (certPath) {
              renewedCertInfo = await readCertificate(certPath);
            } else {
              throw new Error('Could not re-check certificate after renewal');
            }
          }
        }
        
        const renewedValidTo = renewedCertInfo.validTo instanceof Date ? renewedCertInfo.validTo : new Date(renewedCertInfo.validTo);
        const renewedDaysUntilExpiry = getDaysUntilExpiry(renewedValidTo.toISOString());
        const renewedStatusInfo = getCertificateStatus(renewedDaysUntilExpiry, 30);

        await SSLCert.findOneAndUpdate(
          { domain },
          {
            lastRenewedAt: new Date(),
            lastRenewalError: null,
            validFrom: renewedCertInfo.validFrom instanceof Date ? renewedCertInfo.validFrom : new Date(renewedCertInfo.validFrom),
            validTo: renewedValidTo,
            daysUntilExpiry: renewedDaysUntilExpiry,
            status: renewedStatusInfo.status,
            isExpired: renewedStatusInfo.isExpired,
            isExpiringSoon: renewedStatusInfo.isExpiringSoon,
            alarmActive: renewedStatusInfo.isExpired || renewedStatusInfo.isExpiringSoon,
            $inc: { renewalCount: 1 }
          }
        );

        // Reload web server if needed (nginx, apache, etc.)
        try {
          await execAsync('sudo systemctl reload nginx', { timeout: 10000 });
          console.log(`[SSL Monitor] ✅ Nginx reloaded after certificate renewal for ${domain}`);
        } catch (reloadError) {
          console.warn(`[SSL Monitor] ⚠️  Could not reload nginx: ${reloadError.message}`);
        }

        console.log(`[SSL Monitor] ✅ Certificate renewed successfully for ${domain}. New expiry: ${renewedDaysUntilExpiry} days`);

        return {
          domain,
          status: renewedStatusInfo.status,
          daysUntilExpiry: renewedDaysUntilExpiry,
          renewed: true,
          certificatePath: certPath,
          ...renewedCertInfo
        };
      } catch (renewalError) {
        console.error(`[SSL Monitor] ❌ Error renewing certificate for ${domain}:`, renewalError.message);
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
 * This runs periodically and checks all monitored domains
 * Uses network-based checking (doesn't rely on filesystem)
 */
async function checkAllCertificates() {
  const certificates = await SSLCert.find({});
  console.log(`[SSL Monitor] 🔍 Checking ${certificates.length} monitored certificates...`);
  const results = [];

  for (const cert of certificates) {
    try {
      console.log(`[SSL Monitor] Checking ${cert.domain}...`);
      const result = await checkCertificate(cert.domain);
      results.push(result);
      
      // Note: Auto-renewal is handled inside checkCertificate
      // if daysUntilExpiry <= renewalThreshold
      
      // Small delay between checks to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[SSL Monitor] ❌ Error checking certificate ${cert.domain}:`, error);
      results.push({
        domain: cert.domain,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log(`[SSL Monitor] ✅ Completed checking ${results.length} certificates`);
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
  const certificatePaths = new Map(); // Map domain -> certPath for faster lookup
  
  // First, scan all certificates in Let's Encrypt directory
  try {
    const entries = await fs.readdir(LETSENCRYPT_BASE, { withFileTypes: true });
    console.log(`[SSL Monitor] Discovering certificates in ${LETSENCRYPT_BASE} (${entries.length} directories)...`);
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const certPath = path.join(LETSENCRYPT_BASE, entry.name, 'fullchain.pem');
        
        if (await certificateExists(certPath)) {
          try {
            // Get all domains from certificate
            const certDomains = await getCertificateDomains(certPath);
            console.log(`[SSL Monitor] Certificate in ${entry.name} covers domains: ${certDomains.join(', ')}`);
            
            certDomains.forEach(d => {
              if (d && !d.startsWith('*')) {
                const normalizedDomain = d.toLowerCase();
                domains.add(normalizedDomain);
                // Store certificate path for this domain
                if (!certificatePaths.has(normalizedDomain)) {
                  certificatePaths.set(normalizedDomain, certPath);
                }
              }
            });
            
            // Also add directory name if it's different (certbot might use different naming)
            const normalizedDirName = normalizeDomain(entry.name);
            if (!domains.has(normalizedDirName)) {
              domains.add(normalizedDirName);
              if (!certificatePaths.has(normalizedDirName)) {
                certificatePaths.set(normalizedDirName, certPath);
              }
            }
          } catch (error) {
            console.warn(`[SSL Monitor] Could not parse certificate in ${entry.name}: ${error.message}`);
            // Fallback: use directory name
            const normalizedDirName = normalizeDomain(entry.name);
            domains.add(normalizedDirName);
            certificatePaths.set(normalizedDirName, certPath);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[SSL Monitor] Error discovering certificates: ${error.message}`);
    // Check if directory exists
    try {
      await fs.access(LETSENCRYPT_BASE);
    } catch (accessError) {
      console.error(`[SSL Monitor] Cannot access Let's Encrypt directory: ${LETSENCRYPT_BASE} - ${accessError.message}`);
    }
  }

  // Also scan nginx configs to find domains that might have certificates
  try {
    const nginxDomains = await scanNginxConfigs();
    console.log(`[SSL Monitor] Found ${nginxDomains.length} domains in nginx configs: ${nginxDomains.join(', ')}`);
    nginxDomains.forEach(d => {
      const normalized = normalizeDomain(d);
      domains.add(normalized);
    });
  } catch (error) {
    console.warn(`[SSL Monitor] Error scanning nginx configs: ${error.message}`);
  }

  const discoveredDomains = Array.from(domains);
  console.log(`[SSL Monitor] Total discovered domains: ${discoveredDomains.length} - ${discoveredDomains.join(', ')}`);
  
  return discoveredDomains;
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

  console.log('[SSL Monitor] 🚀 Inicjalizacja monitora SSL (database-based tracking)...');
  console.log('[SSL Monitor] 💡 Tip: Add domains to monitoring using POST /api/ssl endpoint');
  
  // Run initial check after 10 seconds
  // This checks all domains already in the database (network-based)
  setTimeout(async () => {
    console.log('[SSL Monitor] 🔍 Uruchamianie pierwszego sprawdzenia certyfikatów...');
    try {
      await checkAllCertificates();
      console.log('[SSL Monitor] ✅ Pierwsze sprawdzenie zakończone');
    } catch (error) {
      console.error('[SSL Monitor] ❌ Błąd podczas pierwszego sprawdzenia:', error);
    }
  }, 10000);

  // Set up periodic checks (checks all domains in database)
  intervalHandle = setInterval(async () => {
    console.log('[SSL Monitor] 🔄 Sprawdzanie certyfikatów SSL (scheduled check)...');
    try {
      await checkAllCertificates();
      console.log('[SSL Monitor] ✅ Sprawdzanie zakończone');
    } catch (error) {
      console.error('[SSL Monitor] ❌ Błąd podczas sprawdzania:', error);
    }
  }, intervalMs);

  const intervalMinutes = Math.round(intervalMs / 1000 / 60);
  const intervalHours = Math.round(intervalMinutes / 60);
  console.log(`[SSL Monitor] ✅ Monitor SSL uruchomiony (sprawdzanie co ${intervalHours}h / ${intervalMinutes}min)`);
  console.log(`[SSL Monitor] 📊 Monitoring domains from database (use POST /api/ssl to add domains)`);
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
  scanNginxConfigs,
  checkCertificateOverNetwork,
  checkCertificateWithOpenSSL,
  extractDomainsFromCertificate
};

