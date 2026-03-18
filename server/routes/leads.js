const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const Lead = require('../models/Lead');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';
const LEADS_URL = `${APP_URL}/leads`;

const PENDING_BATCH_RECIPIENT = 'softsynerg@gmail.com';
const RIZKA_EMAIL = 'rizka.amelia@soft-synergy.com';

function buildSimpleEmail({ title, intro, rowsHtml, ctaUrl, ctaLabel }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;background-color:#f3f4f6;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#e5e7eb;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);padding:24px 28px;color:#f9fafb;">
              <h1 style="margin:0;font-size:20px;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${intro}</p>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;margin:12px 0 24px 0;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th align="left" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;">Tytuł</th>
                    <th align="left" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;">Portal</th>
                    <th align="left" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;">Dodano</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <p style="margin:0;text-align:center;">
                <a href="${ctaUrl}" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
              Soft Synergy Ofertownik · Email wygenerowany automatycznie
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

// Lista leadów z prostymi filtrami
router.get('/', auth, async (req, res) => {
  try {
    const { status, archived, limit = 200 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (archived === 'true') query.archived = true;
    if (archived === 'false') query.archived = false;

    const limitNum = Math.min(Number.parseInt(limit, 10) || 200, 500);
    const leads = await Lead.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json(leads);
  } catch (e) {
    console.error('List leads error:', e);
    res.status(500).json({ message: 'Błąd podczas pobierania leadów' });
  }
});

// Dodanie nowego leada przez Rizkę (lub innego użytkownika)
router.post(
  '/',
  [
    auth,
    body('sourceUrl').trim().isLength({ min: 5 }).withMessage('Podaj link do ogłoszenia / projektu'),
    body('title').trim().isLength({ min: 3 }).withMessage('Podaj krótki tytuł leada')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Nieprawidłowe dane leada',
          errors: errors.array()
        });
      }

      const payload = {
        sourceUrl: req.body.sourceUrl.trim(),
        title: req.body.title.trim(),
        portal: (req.body.portal || '').trim(),
        notes: (req.body.notes || '').trim(),
        createdBy: req.user._id
      };

      const lead = await Lead.create(payload);

      // Po zapisaniu sprawdź ile leadów czeka na review – co 10 wysyłamy email na softsynerg@gmail.com
      try {
        const pendingCount = await Lead.countDocuments({ status: 'pending_review', archived: false });
        if (pendingCount > 0 && pendingCount % 10 === 0) {
          const pendingLeads = await Lead.find({ status: 'pending_review', archived: false })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

          const rowsHtml = pendingLeads
            .map((l) => {
              const createdAt = l.createdAt ? new Date(l.createdAt).toLocaleString('pl-PL') : '-';
              const portal = l.portal || '—';
              return `
              <tr>
                <td style="padding:9px 12px;border-top:1px solid #e5e7eb;">
                  <a href="${l.sourceUrl}" style="color:#2563eb;text-decoration:none;">${l.title}</a>
                </td>
                <td style="padding:9px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${portal}</td>
                <td style="padding:9px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${createdAt}</td>
              </tr>`;
            })
            .join('');

          const html = buildSimpleEmail({
            title: 'Nowe leady do przejrzenia',
            intro: `W kolejce jest już ${pendingCount} leadów dodanych przez Rizkę / zespół. Warto przejrzeć je i wybrać te do ofertowania.`,
            rowsHtml,
            ctaUrl: LEADS_URL,
            ctaLabel: 'Otwórz listę leadów'
          });

          await sendEmail({
            to: PENDING_BATCH_RECIPIENT,
            subject: `🔍 Co ${pendingCount} leadów – czas przejrzeć kandydatów`,
            html
          });
        }
      } catch (emailErr) {
        console.error('[Leads] Błąd przy wysyłce batch emaila:', emailErr);
      }

      const populated = await Lead.findById(lead._id)
        .populate('createdBy', 'firstName lastName email')
        .lean();

      res.status(201).json(populated);
    } catch (e) {
      console.error('Create lead error:', e);
      res.status(500).json({ message: 'Błąd podczas dodawania leada' });
    }
  }
);

// Ocena leada przez admina – akceptacja
router.patch(
  '/:id/approve',
  [
    auth,
    requireRole('admin'),
    body('reviewComment').optional().trim()
  ],
  async (req, res) => {
    try {
      const lead = await Lead.findById(req.params.id).populate('createdBy', 'firstName lastName email');
      if (!lead) {
        return res.status(404).json({ message: 'Lead nie został znaleziony' });
      }

      lead.status = 'approved';
      lead.reviewedBy = req.user._id;
      lead.reviewedAt = new Date();
      lead.reviewComment = (req.body.reviewComment || '').trim();
      lead.archived = false;
      await lead.save();

      // Email do Rizki z potwierdzeniem leada do ofertowania
      try {
        const rowsHtml = `
          <tr>
            <td style="padding:9px 12px;border-top:1px solid #e5e7eb;">
              <a href="${lead.sourceUrl}" style="color:#2563eb;text-decoration:none;">${lead.title}</a>
            </td>
            <td style="padding:9px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${lead.portal || '—'}</td>
            <td style="padding:9px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${lead.createdAt ? new Date(lead.createdAt).toLocaleString('pl-PL') : '-'}</td>
          </tr>
        `;

        const html = buildSimpleEmail({
          title: 'Nowy lead zaakceptowany – czas na ofertę',
          intro: 'Lead został zaakceptowany przez admina. Możesz przygotować i wysłać ofertę, a potem w Ofertowniku oznaczyć, co dokładnie wysłaliśmy.',
          rowsHtml,
          ctaUrl: LEADS_URL,
          ctaLabel: 'Otwórz zakładkę „Leady”'
        });

        await sendEmail({
          to: RIZKA_EMAIL,
          subject: `✅ Nowy lead do oferty: ${lead.title}`,
          html
        });
      } catch (emailErr) {
        console.error('[Leads] Błąd przy wysyłce emaila do Rizki:', emailErr);
      }

      const populated = await Lead.findById(lead._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .lean();

      res.json(populated);
    } catch (e) {
      console.error('Approve lead error:', e);
      res.status(500).json({ message: 'Błąd podczas akceptacji leada' });
    }
  }
);

// Odrzucenie leada – trafia do archiwum
router.patch(
  '/:id/reject',
  [
    auth,
    requireRole('admin'),
    body('reviewComment').optional().trim()
  ],
  async (req, res) => {
    try {
      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead nie został znaleziony' });
      }

      lead.status = 'rejected';
      lead.reviewedBy = req.user._id;
      lead.reviewedAt = new Date();
      lead.reviewComment = (req.body.reviewComment || '').trim();
      lead.archived = true;
      await lead.save();

      const populated = await Lead.findById(lead._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .lean();

      res.json(populated);
    } catch (e) {
      console.error('Reject lead error:', e);
      res.status(500).json({ message: 'Błąd podczas odrzucania leada' });
    }
  }
);

// Po wysłaniu oferty – Rizka wpisuje szczegóły
router.patch(
  '/:id/offer',
  [
    auth,
    body('content').trim().isLength({ min: 3 }).withMessage('Opisz krótko, co wysłaliśmy'),
    body('valuePln').optional().isNumeric().toFloat(),
    body('channel').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: errors.array()[0]?.msg || 'Nieprawidłowe dane oferty',
          errors: errors.array()
        });
      }

      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead nie został znaleziony' });
      }

      lead.status = 'offer_sent';
      lead.offerDetails = {
        sentAt: new Date(),
        content: req.body.content.trim(),
        valuePln: req.body.valuePln != null ? Number(req.body.valuePln) : null,
        channel: (req.body.channel || '').trim()
      };
      await lead.save();

      const populated = await Lead.findById(lead._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .lean();

      res.json(populated);
    } catch (e) {
      console.error('Offer details update error:', e);
      res.status(500).json({ message: 'Błąd podczas zapisywania informacji o ofercie' });
    }
  }
);

module.exports = router;

