/**
 * Szablony HTML dla emaili systemowych.
 * Zoptymalizowane pod klienty pocztowe (inline styles, tabele).
 */
const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';

const baseStyles = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#1f2937',
  backgroundColor: '#f9fafb',
  padding: '0',
  margin: '0'
};

const buttonPrimary = {
  display: 'inline-block',
  padding: '12px 28px',
  backgroundColor: '#2563eb',
  color: '#ffffff !important',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '16px'
};

/**
 * Szablon: przypomnienie o follow-up (dla Rizki)
 */
function followUpReminderTemplate({ projectName, clientName, followUpNumber, dueDate, projectId }) {
  const projectUrl = `${APP_URL}/projects/${projectId}`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Przypomnienie o follow-up</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">⏰ Przypomnienie o follow-up</h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Czas wysłać kolejny follow-up do klienta</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">Cześć Rizka,</p>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">Nadszedł termin wysłania <strong>follow-up #${followUpNumber}</strong> dla poniższego projektu:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Projekt</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(projectName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Klient</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(clientName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Termin</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${dueDate || '-'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">Kliknij poniżej, aby przejść do projektu i dodać follow-up:</p>
              <p style="margin:0;text-align:center;">
                <a href="${projectUrl}" style="${objectToInlineStyle(buttonPrimary)}">Otwórz projekt →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Ten email został wygenerowany automatycznie
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

/**
 * Szablon: prośba o wycenę finalną (dla info@)
 */
function quoteRequestTemplate({ projectName, clientName, clientContact, clientEmail, projectId }) {
  const projectUrl = `${APP_URL}/projects/${projectId}`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prośba o wycenę finalną</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">💰 Prośba o wycenę finalną</h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Nowy projekt czeka na przygotowanie wyceny</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">Witajcie,</p>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">Projekt <strong>„${escapeHtml(projectName)}”</strong> został oznaczony jako <strong>Do wyceny finalnej</strong>. Należy przygotować szczegółową wycenę dla klienta.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#166534;">Projekt</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#14532d;text-align:right;">${escapeHtml(projectName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#166534;">Klient</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#14532d;text-align:right;">${escapeHtml(clientName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#166534;">Osoba kontaktowa</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#14532d;text-align:right;">${escapeHtml(clientContact || '-')}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#166534;">Email</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#14532d;text-align:right;"><a href="mailto:${escapeHtml(clientEmail || '')}" style="color:#059669;text-decoration:none;">${escapeHtml(clientEmail || '-')}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">Przejdź do projektu, aby przygotować wycenę finalną:</p>
              <p style="margin:0;text-align:center;">
                <a href="${projectUrl}" style="${objectToInlineStyle({ ...buttonPrimary, backgroundColor: '#059669' })}">Otwórz projekt →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Ten email został wygenerowany automatycznie
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

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function objectToInlineStyle(obj) {
  return Object.entries(obj).map(([k, v]) => {
    const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return `${cssKey}:${v}`;
  }).join(';');
}

/**
 * Szablon: powiadomienie o hostingu – płatność za 3 dni
 */
function hostingReminder3DaysBeforeTemplate({ hostings, hostingUrl }) {
  const rows = hostings.map((h) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
        <strong style="color:#1e293b;">${escapeHtml(h.domain)}</strong>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(h.clientName)} · ${formatPrice(h.monthlyPrice)} / ${h.billingCycle === 'yearly' ? 'rok' : h.billingCycle === 'quarterly' ? 'kwartał' : 'mies.'}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b;">${escapeHtml(h.dueDateFormatted)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
        <a href="${hostingUrl}" style="color:#2563eb;text-decoration:none;font-weight:500;">Otwórz →</a>
      </td>
    </tr>`).join('');
  return buildHostingEmail({
    title: 'Za 3 dni – termin płatności hostingu',
    subtitle: 'Przypomnienie o nadchodzących płatnościach',
    gradient: '135deg,#f59e0b 0%,#fbbf24 100%',
    emoji: '📅',
    tableHeader: ['Domena / Klient', 'Termin płatności', ''],
    rows,
    hostings,
    hostingUrl,
    ctaText: 'Przejdź do hostingu'
  });
}

/**
 * Szablon: powiadomienie o hostingu – płatność dzisiaj
 */
function hostingReminderDueTodayTemplate({ hostings, hostingUrl }) {
  const rows = hostings.map((h) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
        <strong style="color:#1e293b;">${escapeHtml(h.domain)}</strong>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(h.clientName)} · ${formatPrice(h.monthlyPrice)}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
        <a href="${hostingUrl}" style="color:#2563eb;text-decoration:none;font-weight:500;">Otwórz →</a>
      </td>
    </tr>`).join('');
  return buildHostingEmail({
    title: 'Dzisiaj – termin płatności hostingu',
    subtitle: 'Płatności z terminem na dziś',
    gradient: '135deg,#2563eb 0%,#3b82f6 100%',
    emoji: '⚠️',
    tableHeader: ['Domena / Klient', ''],
    rows,
    hostings,
    hostingUrl,
    ctaText: 'Przejdź do hostingu'
  });
}

/**
 * Szablon: powiadomienie o hostingu – brak płatności od 3 dni
 */
function hostingReminder3DaysOverdueTemplate({ hostings, hostingUrl }) {
  const rows = hostings.map((h) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #fecaca;">
        <strong style="color:#1e293b;">${escapeHtml(h.domain)}</strong>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(h.clientName)} · termin był: ${escapeHtml(h.dueDateFormatted)}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #fecaca;text-align:right;">
        <a href="${hostingUrl}" style="color:#dc2626;text-decoration:none;font-weight:600;">Zarządzaj →</a>
      </td>
    </tr>`).join('');
  return buildHostingEmail({
    title: 'Brak płatności – 3 dni po terminie',
    subtitle: 'Wymagana reakcja: skontaktuj się z klientem lub zarejestruj płatność',
    gradient: '135deg,#dc2626 0%,#ef4444 100%',
    emoji: '🚨',
    tableHeader: ['Domena / Klient', ''],
    rows,
    hostings,
    hostingUrl,
    ctaText: 'Przejdź do hostingu',
    isOverdue: true
  });
}

function formatPrice(amount) {
  if (amount == null) return '–';
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0 }).format(amount);
}

function buildHostingEmail({ title, subtitle, gradient, emoji, tableHeader, rows, hostingUrl, ctaText, isOverdue }) {
  const borderColor = isOverdue ? '#fecaca' : '#e2e8f0';
  const headerBg = `linear-gradient(${gradient})`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:${headerBg};padding:32px 36px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:32px;">${emoji}</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(title)}</h1>
              <p style="margin:10px 0 0 0;color:rgba(255,255,255,0.92);font-size:15px;">${escapeHtml(subtitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#475569;">Poniżej lista pozycji z Ofertownika wymagających uwagi.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${borderColor};border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc;">
                    ${tableHeader.map((th) => `<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">${escapeHtml(th)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              <p style="margin:24px 0 0 0;text-align:center;">
                <a href="${hostingUrl}" style="${objectToInlineStyle(buttonPrimary)}">${escapeHtml(ctaText)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Powiadomienia hostingu · ${new Date().toLocaleDateString('pl-PL')}
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

/**
 * Szablon: dzienny digest zadań (dla przypisanych użytkowników / info@)
 */
function tasksDailyDigestTemplate({ recipientName, tasks, tasksUrl, dateLabel }) {
  const rows = (tasks || []).map((t) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:600;color:#1e293b;">${escapeHtml(t.title || '')}</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">
          Termin: <strong>${escapeHtml(t.dueDateFormatted || '-')}</strong>
          ${t.priorityLabel ? ` · Priorytet: ${escapeHtml(t.priorityLabel)}` : ''}
          ${t.projectName ? ` · Projekt: ${escapeHtml(t.projectName)}` : ''}
        </div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
        <a href="${tasksUrl}" style="color:#2563eb;text-decoration:none;font-weight:500;">Otwórz →</a>
      </td>
    </tr>`).join('');

  const greeting = recipientName ? `Cześć ${escapeHtml(recipientName)},` : 'Cześć,';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zadania – digest</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:32px;">🗓️</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Zadania – ${escapeHtml(dateLabel || '')}</h1>
              <p style="margin:10px 0 0 0;color:rgba(255,255,255,0.92);font-size:15px;">Podsumowanie zadań z najbliższym terminem</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#475569;">${greeting}</p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#64748b;">Poniżej lista zadań do ogarnięcia:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Zadanie</th>
                    <th style="padding:12px 16px;text-align:right;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || `
                    <tr><td style="padding:16px;color:#64748b;" colspan="2">Brak zadań z bliskim terminem.</td></tr>
                  `}
                </tbody>
              </table>
              <p style="margin:24px 0 0 0;text-align:center;">
                <a href="${tasksUrl}" style="${objectToInlineStyle(buttonPrimary)}">Otwórz zadania →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Powiadomienia zadań · ${new Date().toLocaleDateString('pl-PL')}
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

/**
 * Szablon: zadania po terminie (dla przypisanego użytkownika)
 */
function tasksOverdueTemplate({ recipientName, tasks, tasksUrl, dateLabel }) {
  const rows = (tasks || []).map((t) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:600;color:#b91c1c;">${escapeHtml(t.title || '')}</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">
          Termin minął: <strong>${escapeHtml(t.dueDateFormatted || '-')}</strong>
          ${t.priorityLabel ? ` · Priorytet: ${escapeHtml(t.priorityLabel)}` : ''}
          ${t.projectName ? ` · Projekt: ${escapeHtml(t.projectName)}` : ''}
        </div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
        <a href="${tasksUrl}" style="color:#2563eb;text-decoration:none;font-weight:500;">Otwórz →</a>
      </td>
    </tr>`).join('');

  const greeting = recipientName ? `Cześć ${escapeHtml(recipientName)},` : 'Cześć,';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zadania po terminie</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef2f2;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);padding:32px 36px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:32px;">⚠️</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Zadania po terminie – ${escapeHtml(dateLabel || '')}</h1>
              <p style="margin:10px 0 0 0;color:rgba(255,255,255,0.92);font-size:15px;">Masz niezrealizowane zadania z przekroczonym terminem</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#475569;">${greeting}</p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#64748b;">Poniżej lista zadań po terminie do ogarnięcia:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #fecaca;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr style="background:#fef2f2;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#b91c1c;text-transform:uppercase;">Zadanie</th>
                    <th style="padding:12px 16px;text-align:right;font-size:12px;font-weight:600;color:#b91c1c;text-transform:uppercase;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || `
                    <tr><td style="padding:16px;color:#64748b;" colspan="2">Brak zadań po terminie.</td></tr>
                  `}
                </tbody>
              </table>
              <p style="margin:24px 0 0 0;text-align:center;">
                <a href="${tasksUrl}" style="${objectToInlineStyle(buttonPrimary)}">Otwórz zadania →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Powiadomienia zadań · ${new Date().toLocaleDateString('pl-PL')}
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

/**
 * Szablon: doprecyzowanie – gdy nie można jeszcze zrobić wyceny (dla Rizki)
 */
function clarificationRequestTemplate({ projectName, clientName, clientContact, clientEmail, clientPhone, consultationNotes, clarificationText, projectId }) {
  const projectUrl = `${APP_URL}/projects/${projectId}`;
  const notes = consultationNotes ? consultationNotes.replace(/\n/g, '<br>') : '-';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Doprecyzowanie – projekt do wyceny</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#b45309 0%,#f59e0b 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">📋 Doprecyzowanie</h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Nie można jeszcze wykonać wyceny – potrzeba doprecyzowania</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">Projekt <strong>„${escapeHtml(projectName)}”</strong> wymaga doprecyzowania przed przygotowaniem wyceny finalnej.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb;border-radius:8px;border:1px solid #fcd34d;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#92400e;">Co trzeba doprecyzować:</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#78350f;">${escapeHtml(clarificationText).replace(/\n/g, '<br>')}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Projekt</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(projectName)}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Klient</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientName)}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Kontakt</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientContact || '-')}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Email</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;"><a href="mailto:${escapeHtml(clientEmail || '')}" style="color:#059669;">${escapeHtml(clientEmail || '-')}</a></td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Telefon</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientPhone || '-')}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;vertical-align:top;">Notatki z konsultacji</td><td style="padding:8px 0;font-size:14px;text-align:right;">${notes}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;">
                <a href="${projectUrl}" style="${objectToInlineStyle({ ...buttonPrimary, backgroundColor: '#d97706' })}">Otwórz projekt →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Ten email został wygenerowany automatycznie
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

/**
 * Szablon: wycena finalna zapisana (dla Rizki)
 */
function finalEstimateSubmittedTemplate({ projectName, clientName, clientContact, clientEmail, clientPhone, consultationNotes, total, projectId }) {
  const projectUrl = `${APP_URL}/projects/${projectId}`;
  const notes = consultationNotes ? String(consultationNotes).replace(/\n/g, '<br>') : '-';
  const formattedTotal = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(total || 0);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wycena finalna zapisana</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">💰 Wycena finalna zapisana</h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Projekt gotowy do przygotowania oferty finalnej</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">Wycena finalna dla projektu <strong>„${escapeHtml(projectName)}”</strong> została zapisana.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#14532d;">${escapeHtml(formattedTotal)}</p>
                    <p style="margin:4px 0 0 0;font-size:14px;color:#166534;">całkowita kwota</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Projekt</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(projectName)}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Klient</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientName)}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Kontakt</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientContact || '-')}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Email</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;"><a href="mailto:${escapeHtml(clientEmail || '')}" style="color:#059669;">${escapeHtml(clientEmail || '-')}</a></td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;">Telefon</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(clientPhone || '-')}</td></tr>
                      <tr><td style="padding:8px 0;font-size:14px;color:#64748b;vertical-align:top;">Notatki z konsultacji</td><td style="padding:8px 0;font-size:14px;text-align:right;">${notes}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;">
                <a href="${projectUrl}" style="${objectToInlineStyle({ ...buttonPrimary, backgroundColor: '#059669' })}">Otwórz projekt →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Ten email został wygenerowany automatycznie
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

/**
 * Szablon: powiadomienie o zmianie w zadaniu (dla watchers)
 */
function taskChangeNotificationTemplate({ taskTitle, taskId, changeType, changeDescription, changedBy, taskUrl, dueDateFormatted, priorityLabel, projectName, statusLabel, assigneesList }) {
  const taskUrlFull = `${APP_URL}${taskUrl || '/tasks'}`;
  const emojiMap = {
    created: '✨',
    updated: '✏️',
    status_changed: '🔄',
    update_added: '💬',
    assigned: '👤',
    moved: '📅'
  };
  const emoji = emojiMap[changeType] || '📋';
  const titleMap = {
    created: 'Nowe zadanie',
    updated: 'Zadanie zaktualizowane',
    status_changed: 'Zmiana statusu zadania',
    update_added: 'Dodano update do zadania',
    assigned: 'Zmiana przypisania',
    moved: 'Zadanie przeniesione'
  };
  const title = titleMap[changeType] || 'Zmiana w zadaniu';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:32px;">${emoji}</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#475569;">Cześć,</p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#64748b;">${changeDescription || 'W zadaniu, które obserwujesz, nastąpiła zmiana:'}</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Zadanie</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(taskTitle || '')}</td>
                      </tr>
                      ${dueDateFormatted ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Termin</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(dueDateFormatted)}</td>
                      </tr>` : ''}
                      ${statusLabel ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Status</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(statusLabel)}</td>
                      </tr>` : ''}
                      ${priorityLabel ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Priorytet</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(priorityLabel)}</td>
                      </tr>` : ''}
                      ${projectName ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Projekt</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(projectName)}</td>
                      </tr>` : ''}
                      ${assigneesList ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Przypisani</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(assigneesList)}</td>
                      </tr>` : ''}
                      ${changedBy ? `
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Zmienione przez</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(changedBy)}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;">
                <a href="${taskUrlFull}" style="${objectToInlineStyle(buttonPrimary)}">Otwórz zadanie →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Ten email został wygenerowany automatycznie
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

/**
 * Szablon: powiadomienie o przetargu (Robimy / update / deadline)
 */
function publicOrderNotificationTemplate({ type, title, orderTitle, orderId, deadlineFormatted, updateText, changedBy, ordersUrl }) {
  const orderUrl = ordersUrl ? `${ordersUrl}#order-${orderId}` : `${APP_URL}/zlecenia-publiczne`;
  const typeConfig = {
    we_do_it: { emoji: '✅', heading: 'Na pewno składamy', desc: 'Zlecenie zostało oznaczone jako „Robimy” – na pewno składamy ofertę.' },
    update: { emoji: '💬', heading: 'Nowy update w przetargu', desc: updateText ? `Dodano notatkę: „${escapeHtml(updateText.slice(0, 120))}${updateText.length > 120 ? '…' : ''}”` : 'Dodano update do zlecenia.' },
    deadline_reminder: { emoji: '⏰', heading: 'Przypomnienie: zbliża się termin', desc: deadlineFormatted ? `Termin składania: ${escapeHtml(deadlineFormatted)}` : 'Zbliża się termin składania oferty.' }
  };
  const cfg = typeConfig[type] || typeConfig.update;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(cfg.heading)}</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background-color:${baseStyles.backgroundColor};color:${baseStyles.color};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#059669 100%);padding:32px 36px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:32px;">${cfg.emoji}</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(cfg.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#475569;">${cfg.desc}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:20px 0 24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px 0;font-size:12px;color:#15803d;text-transform:uppercase;font-weight:600;">Zlecenie</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#14532d;">${escapeHtml(orderTitle || 'Przetarg')}</p>
                    ${deadlineFormatted && type === 'deadline_reminder' ? `<p style="margin:12px 0 0 0;font-size:14px;color:#166534;">Termin: <strong>${escapeHtml(deadlineFormatted)}</strong></p>` : ''}
                    ${changedBy ? `<p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">Zmiana: ${escapeHtml(changedBy)}</p>` : ''}
                  </td>
                </tr>
              </table>
              <p style="margin:0;text-align:center;">
                <a href="${orderUrl}" style="${objectToInlineStyle({ ...buttonPrimary, backgroundColor: '#059669' })}">Otwórz zlecenia publiczne →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
              Soft Synergy Ofertownik · Powiadomienie o przetargu
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

function reviewRequestEmailTemplate({
  reviewUrl,
  clientName,
  companyName,
  projectName,
  senderName = 'Zespół Soft Synergy',
  followUpNumber = 0
}) {
  const greetingName = escapeHtml(clientName || 'Dzień dobry');
  const subjectContext = projectName
    ? `po współpracy przy projekcie „${escapeHtml(projectName)}”`
    : 'po naszej współpracy';
  const intro =
    followUpNumber > 0
      ? 'Wracamy z krótkim przypomnieniem, bo Twoja opinia naprawdę pomoże nam rozwijać proces i komunikację.'
      : 'Będziemy bardzo wdzięczni za krótką opinię. Chcemy lepiej rozumieć, co działa dobrze, a co możemy jeszcze poprawić.';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prośba o opinię</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background:#eef2ff;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:0;background:linear-gradient(135deg,#0f172a 0%,#2563eb 55%,#14b8a6 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:36px 36px 30px 36px;">
                    <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.16);color:#dbeafe;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                      Soft Synergy · opinia klienta
                    </div>
                    <h1 style="margin:18px 0 12px 0;color:#ffffff;font-size:30px;line-height:1.15;font-weight:800;">
                      3 minuty, które realnie pomagają nam robić lepszą robotę
                    </h1>
                    <p style="margin:0;color:rgba(255,255,255,0.88);font-size:16px;line-height:1.7;">
                      ${intro}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 36px;">
              <p style="margin:0 0 16px 0;font-size:17px;line-height:1.7;">${greetingName},</p>
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.8;color:#334155;">
                dziękujemy za zaufanie ${companyName ? `ze strony <strong>${escapeHtml(companyName)}</strong>` : ''} ${subjectContext}. 
                Zależy nam nie tylko na pozytywnej opinii, ale też na szczerej informacji, co mogliśmy zrobić lepiej.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <div style="font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:10px;">Co zbieramy</div>
                    <ul style="margin:0;padding-left:18px;color:#1e293b;font-size:15px;line-height:1.8;">
                      <li>krótką opinię, którą ewentualnie będziemy mogli wykorzystać jako testimonial</li>
                      <li>szczery feedback: co było świetne, a co powinniśmy poprawić</li>
                      <li>konkretne sygnały, które pomogą nam lepiej prowadzić kolejne projekty</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px 0;text-align:center;">
                <a href="${reviewUrl}" style="${objectToInlineStyle({
                  ...buttonPrimary,
                  backgroundColor: '#2563eb',
                  borderRadius: '999px',
                  padding: '15px 32px',
                  fontSize: '17px',
                  boxShadow: '0 12px 30px rgba(37,99,235,0.28)'
                })}">Zostaw opinię lub feedback →</a>
              </p>

              <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                Formularz jest krótki i działa także na telefonie. Jeśli nie chcesz wystawiać publicznej opinii, możesz zostawić sam prywatny feedback.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(senderName)}</p>
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                Soft Synergy · ta wiadomość została wysłana automatycznie, bo zależy nam na lepszym doświadczeniu klientów.
              </p>
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

function reviewThankYouTemplate({ clientName, testimonial, allowPublicUse }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dziękujemy za opinię</title>
</head>
<body style="margin:0;padding:0;font-family:${baseStyles.fontFamily};background:#f8fafc;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#14b8a6 100%);padding:30px 34px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">Dziękujemy za opinię</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 34px;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;">${escapeHtml(clientName || 'Dziękujemy')}.</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.8;color:#374151;">
                Twoja wiadomość została zapisana. Analizujemy zarówno pozytywne opinie, jak i uwagi rozwojowe, bo obie rzeczy pomagają nam budować lepszy proces współpracy.
              </p>
              ${testimonial ? `
              <div style="background:#ecfeff;border:1px solid #bae6fd;border-radius:16px;padding:18px 20px;margin:18px 0;">
                <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.8;">„${escapeHtml(testimonial)}”</p>
              </div>` : ''}
              <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
                ${allowPublicUse ? 'Oznaczyliśmy też, że możemy wykorzystać Twoją opinię jako testimonial.' : 'Zapisaliśmy Twoją odpowiedź jako feedback wewnętrzny.'}
              </p>
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

module.exports = {
  followUpReminderTemplate,
  quoteRequestTemplate,
  clarificationRequestTemplate,
  finalEstimateSubmittedTemplate,
  reviewRequestEmailTemplate,
  reviewThankYouTemplate,
  hostingReminder3DaysBeforeTemplate,
  hostingReminderDueTodayTemplate,
  hostingReminder3DaysOverdueTemplate,
  tasksDailyDigestTemplate,
  tasksOverdueTemplate,
  taskChangeNotificationTemplate,
  publicOrderNotificationTemplate
};
