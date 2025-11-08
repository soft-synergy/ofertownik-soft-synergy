#!/usr/bin/env node

/**
 * Debug script to check SSL certificates in Let's Encrypt directory
 * This will show all certificates and their domains
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const LETSENCRYPT_BASE = '/etc/letsencrypt/live';

async function certificateExists(certPath) {
  try {
    await fs.access(certPath);
    return true;
  } catch {
    return false;
  }
}

async function getCertificateDomains(certPath) {
  try {
    const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -text`, { timeout: 10000 });
    const allDomains = new Set();
    
    // Extract CN from subject
    const subjectLine = stdout.split('\n').find(line => line.includes('Subject:'));
    if (subjectLine) {
      const cnMatch = subjectLine.match(/CN\s*=\s*([^,/\n]+)/);
      if (cnMatch && cnMatch[1]) {
        const cnDomain = cnMatch[1].trim();
        if (cnDomain) allDomains.add(cnDomain);
      }
    }
    
    // Extract SAN domains
    const lines = stdout.split('\n');
    let inSanSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('X509v3 Subject Alternative Name')) {
        inSanSection = true;
        continue;
      }
      if (inSanSection) {
        const dnsMatches = line.matchAll(/DNS:([^,\s]+)/gi);
        for (const match of dnsMatches) {
          if (match[1]) {
            allDomains.add(match[1].trim());
          }
        }
        if (line.trim() && !line.includes('DNS:') && !line.match(/^\s/)) {
          inSanSection = false;
        }
      }
    }
    
    return Array.from(allDomains).filter(d => d && d.length > 0);
  } catch (error) {
    console.error(`Error reading certificate ${certPath}:`, error.message);
    return [];
  }
}

async function getCertificateDates(certPath) {
  try {
    const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -noout -dates`, { timeout: 10000 });
    const dates = {};
    stdout.split('\n').forEach(line => {
      if (line.startsWith('notBefore=')) {
        dates.validFrom = line.replace('notBefore=', '').trim();
      } else if (line.startsWith('notAfter=')) {
        dates.validTo = line.replace('notAfter=', '').trim();
      }
    });
    return dates;
  } catch (error) {
    return { validFrom: 'unknown', validTo: 'unknown' };
  }
}

async function main() {
  console.log('🔍 SSL Certificate Debug Tool\n');
  console.log(`Scanning directory: ${LETSENCRYPT_BASE}\n`);
  
  try {
    // Check if directory exists
    await fs.access(LETSENCRYPT_BASE);
  } catch (error) {
    console.error(`❌ Cannot access ${LETSENCRYPT_BASE}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Make sure you run this script with appropriate permissions`);
    process.exit(1);
  }
  
  try {
    const entries = await fs.readdir(LETSENCRYPT_BASE, { withFileTypes: true });
    console.log(`Found ${entries.length} directories\n`);
    
    let foundCertificates = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const certPath = path.join(LETSENCRYPT_BASE, entry.name, 'fullchain.pem');
        const exists = await certificateExists(certPath);
        
        if (exists) {
          foundCertificates++;
          console.log(`📁 Directory: ${entry.name}`);
          console.log(`   Certificate: ${certPath}`);
          
          try {
            const domains = await getCertificateDomains(certPath);
            const dates = await getCertificateDates(certPath);
            
            console.log(`   Domains: ${domains.length > 0 ? domains.join(', ') : 'NONE FOUND!'}`);
            console.log(`   Valid from: ${dates.validFrom}`);
            console.log(`   Valid to: ${dates.validTo}`);
            
            // Check if watraconcept.pl is in this certificate
            const hasWatraconcept = domains.some(d => 
              d.toLowerCase().includes('watraconcept') || 
              d.toLowerCase() === 'watraconcept.pl' ||
              d.toLowerCase() === 'www.watraconcept.pl'
            );
            
            if (hasWatraconcept) {
              console.log(`   ✅ CONTAINS watraconcept.pl!`);
            }
          } catch (error) {
            console.log(`   ❌ Error reading certificate: ${error.message}`);
          }
          
          console.log('');
        } else {
          console.log(`📁 Directory: ${entry.name} (no fullchain.pem found)`);
        }
      }
    }
    
    console.log(`\n✅ Found ${foundCertificates} certificates`);
    
    // Now check for watraconcept.pl specifically
    console.log('\n🔍 Searching specifically for watraconcept.pl...\n');
    
    const searchDomains = ['watraconcept.pl', 'www.watraconcept.pl'];
    for (const domain of searchDomains) {
      console.log(`Checking: ${domain}`);
      const certPath = path.join(LETSENCRYPT_BASE, domain, 'fullchain.pem');
      const exists = await certificateExists(certPath);
      
      if (exists) {
        console.log(`   ✅ Found certificate at: ${certPath}`);
        try {
          const domains = await getCertificateDomains(certPath);
          console.log(`   Domains in certificate: ${domains.join(', ')}`);
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log(`   ❌ Certificate not found at: ${certPath}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);

