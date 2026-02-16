/**
 * Wspólna usługa wysyłki emaili przez SMTP (Brevo).
 * Używa zmiennych środowiskowych: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });
  return transporter;
}

/**
 * Wysyła email
 * @param {Object} opts
 * @param {string} opts.to - adres odbiorcy
 * @param {string} opts.subject - temat
 * @param {string} opts.html - treść HTML
 * @returns {Promise<Object>} info z nodemailer
 */
async function sendEmail({ to, subject, html }) {
  const trans = getTransporter();
  if (!trans) {
    console.log(`[Email] SMTP nie skonfigurowany - symulacja wysyłki do ${to}: ${subject}`);
    return null;
  }
  const mailOptions = {
    from: '"Soft Synergy Ofertownik" <development@soft-synergy.com>',
    to,
    subject,
    html
  };
  const info = await trans.sendMail(mailOptions);
  console.log(`[Email] Wysłano do ${to}: ${subject} (ID: ${info.messageId})`);
  return info;
}

module.exports = { getTransporter, sendEmail };
