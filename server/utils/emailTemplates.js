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
 * Szablon: przypomnienie o follow-up (dla Jakuba)
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
              <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;">Cześć Jakub,</p>
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

module.exports = {
  followUpReminderTemplate,
  quoteRequestTemplate
};
