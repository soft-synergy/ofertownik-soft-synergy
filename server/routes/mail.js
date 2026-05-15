const express = require('express');
const { auth, requireScope } = require('../middleware/auth');
const { sendEmail, getTransporter } = require('../utils/emailService');

const router = express.Router();

const DEFAULT_ALLOWED_RECIPIENTS = ['info@soft-synergy.com'];

const getAllowedRecipients = () => {
  const raw = (process.env.CLAUDE_MAIL_ALLOWED_RECIPIENTS || '').trim();
  if (!raw) return DEFAULT_ALLOWED_RECIPIENTS;
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
};

const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

router.post('/send', auth, requireScope('mail:send'), async (req, res) => {
  try {
    const { to, subject, body, html, taskId, projectId, link } = req.body || {};

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ message: 'Pole `to` jest wymagane (string).' });
    }
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ message: 'Pole `subject` jest wymagane (string).' });
    }

    const content = html || body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Pole `body` lub `html` jest wymagane (string).' });
    }

    const recipient = to.trim().toLowerCase();
    const allowed = getAllowedRecipients();
    if (!allowed.includes(recipient)) {
      return res.status(403).json({
        message: `Adres ${recipient} nie jest na whiteliście. Dozwolone: ${allowed.join(', ')}. Skonfiguruj CLAUDE_MAIL_ALLOWED_RECIPIENTS w .env.`
      });
    }

    const safeSubject = subject.length > 200 ? subject.slice(0, 200) : subject;
    const finalSubject = safeSubject.startsWith('[Claude]') ? safeSubject : `[Claude] ${safeSubject}`;

    const isHtmlBody = /<\w+[^>]*>/.test(content);
    const bodyHtml = isHtmlBody ? content : `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`;

    const contextBlocks = [];
    if (taskId) {
      contextBlocks.push(`<p style="margin:0;color:#475569;font-size:13px;">Task: <a href="https://oferty.soft-synergy.com/tasks/${escapeHtml(taskId)}">${escapeHtml(taskId)}</a></p>`);
    }
    if (projectId) {
      contextBlocks.push(`<p style="margin:0;color:#475569;font-size:13px;">Projekt: <a href="https://oferty.soft-synergy.com/projects/${escapeHtml(projectId)}">${escapeHtml(projectId)}</a></p>`);
    }
    if (link) {
      contextBlocks.push(`<p style="margin:0;color:#475569;font-size:13px;">Link: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`);
    }

    const wrappedHtml = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.55;max-width:640px;margin:0 auto;padding:24px;">
  <div style="border-left:3px solid #6366f1;padding:4px 0 4px 12px;margin-bottom:16px;">
    <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6366f1;font-weight:600;">Claude — Ofertownik</p>
    <p style="margin:0;color:#64748b;font-size:13px;">Wiadomość wygenerowana automatycznie przez scheduled task.</p>
  </div>
  ${bodyHtml}
  ${contextBlocks.length ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;"/>${contextBlocks.join('')}` : ''}
  <p style="margin-top:24px;color:#94a3b8;font-size:12px;">Wysłane z development@soft-synergy.com przez API Ofertownika (scope mail:send).</p>
</body></html>`;

    const transporter = getTransporter();
    if (!transporter) {
      console.log(`[Mail API] SMTP nie skonfigurowany — symulacja: to=${recipient}, subject=${finalSubject}`);
      return res.json({
        ok: true,
        simulated: true,
        to: recipient,
        subject: finalSubject,
        message: 'SMTP nie skonfigurowany (brak SMTP_HOST/USER/PASS). Mail tylko zalogowany.'
      });
    }

    const info = await sendEmail({ to: recipient, subject: finalSubject, html: wrappedHtml });

    return res.json({
      ok: true,
      simulated: false,
      to: recipient,
      subject: finalSubject,
      messageId: info && info.messageId ? info.messageId : null
    });
  } catch (err) {
    console.error('[Mail API] błąd wysyłki:', err);
    return res.status(500).json({ message: 'Błąd wysyłki maila', error: err.message });
  }
});

router.get('/config', auth, requireScope('mail:send'), (req, res) => {
  res.json({
    from: 'development@soft-synergy.com',
    allowedRecipients: getAllowedRecipients(),
    smtpConfigured: Boolean(getTransporter())
  });
});

module.exports = router;
