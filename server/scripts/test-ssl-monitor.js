#!/usr/bin/env node

/**
 * Skrypt testowy do sprawdzania funkcjonalności monitora SSL
 * Uruchom: node server/scripts/test-ssl-monitor.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const sslMonitor = require('../services/sslMonitor');

async function testSSLMonitor() {
  console.log('🔒 Test Monitora SSL\n');
  
  try {
    // Połącz z bazą danych
    console.log('1. Łączenie z bazą danych...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Połączono z bazą danych\n');

    // Sprawdź czy certbot jest dostępny
    console.log('2. Sprawdzanie dostępności Certbot...');
    const certbotAvailable = await sslMonitor.isCertbotAvailable();
    if (certbotAvailable) {
      const certbotPath = await sslMonitor.getCertbotPath();
      console.log(`✅ Certbot dostępny: ${certbotPath}\n`);
    } else {
      console.log('⚠️  Certbot nie jest dostępny\n');
    }

    // Wykryj certyfikaty
    console.log('3. Wykrywanie certyfikatów...');
    const domains = await sslMonitor.discoverCertificates();
    console.log(`✅ Znaleziono ${domains.length} certyfikatów: ${domains.join(', ')}\n`);

    // Sprawdź każdy certyfikat
    if (domains.length > 0) {
      console.log('4. Sprawdzanie certyfikatów...\n');
      for (const domain of domains) {
        try {
          console.log(`   Sprawdzanie: ${domain}`);
          const result = await sslMonitor.checkCertificate(domain);
          console.log(`   Status: ${result.status}`);
          if (result.daysUntilExpiry !== undefined) {
            console.log(`   Dni do wygaśnięcia: ${result.daysUntilExpiry}`);
          }
          if (result.validTo) {
            console.log(`   Ważny do: ${new Date(result.validTo).toLocaleString('pl-PL')}`);
          }
          if (result.error) {
            console.log(`   Błąd: ${result.error}`);
          }
          console.log('');
        } catch (error) {
          console.error(`   ❌ Błąd sprawdzania ${domain}: ${error.message}\n`);
        }
      }
    } else {
      console.log('⚠️  Nie znaleziono certyfikatów\n');
    }

    // Pobierz statystyki z bazy danych
    console.log('5. Statystyki z bazy danych...');
    const SSLCert = require('../models/SSLCert');
    const total = await SSLCert.countDocuments();
    const valid = await SSLCert.countDocuments({ status: 'valid' });
    const expiringSoon = await SSLCert.countDocuments({ status: 'expiring_soon' });
    const expired = await SSLCert.countDocuments({ status: 'expired' });
    const errors = await SSLCert.countDocuments({ status: 'error' });
    const alarms = await SSLCert.countDocuments({ alarmActive: true, acknowledged: false });

    console.log(`   Łącznie: ${total}`);
    console.log(`   Ważne: ${valid}`);
    console.log(`   Wygasające wkrótce: ${expiringSoon}`);
    console.log(`   Wygasłe: ${expired}`);
    console.log(`   Błędy: ${errors}`);
    console.log(`   Aktywne alarmy: ${alarms}\n`);

    console.log('✅ Test zakończony pomyślnie\n');
  } catch (error) {
    console.error('❌ Błąd testu:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Uruchom test
testSSLMonitor();

