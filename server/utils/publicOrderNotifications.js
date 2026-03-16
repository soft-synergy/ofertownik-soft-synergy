/**
 * Powiadomienia mailowe dla zleceń publicznych (przetargi „Robimy”).
 * Odbiorcy: PUBLIC_ORDER_NOTIFY_EMAIL (po przecinku) lub wszyscy aktywni admini.
 */
const { sendEmail } = require('./emailService');
const { publicOrderNotificationTemplate } = require('./emailTemplates');
const User = require('../models/User');
const { format } = require('date-fns');
const { pl } = require('date-fns/locale');

const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';
const ORDERS_URL = `${APP_URL}/zlecenia-publiczne`;

async function getRecipients() {
  const envEmails = (process.env.PUBLIC_ORDER_NOTIFY_EMAIL || '').trim().split(',').map(e => e.trim()).filter(Boolean);
  if (envEmails.length > 0) return envEmails;
  const admins = await User.find({ role: 'admin', isActive: true }).select('email').lean();
  return admins.map(a => a.email).filter(Boolean);
}

/**
 * Wyślij powiadomienie o przetargu do skonfigurowanych odbiorców.
 * @param {Object} order - zlecenie (lean), z title, _id, customDeadline
 * @param {string} type - 'we_do_it' | 'update' | 'deadline_reminder'
 * @param {Object} opts - { updateText?, changedBy? }
 */
async function notifyPublicOrderSubscribers(order, type, opts = {}) {
  try {
    const recipients = await getRecipients();
    if (recipients.length === 0) return;

    const deadlineFormatted = order.customDeadline
      ? format(new Date(order.customDeadline), 'd MMMM yyyy', { locale: pl })
      : null;

    const html = publicOrderNotificationTemplate({
      type,
      title: order.title,
      orderTitle: order.title,
      orderId: order._id,
      deadlineFormatted,
      updateText: opts.updateText,
      changedBy: opts.changedBy,
      ordersUrl: ORDERS_URL
    });

    const subjectByType = {
      we_do_it: `✅ Robimy: ${(order.title || '').slice(0, 50)}`,
      update: `💬 Update przetargu: ${(order.title || '').slice(0, 50)}`,
      deadline_reminder: `⏰ Termin przetargu: ${(order.title || '').slice(0, 50)} – ${deadlineFormatted || ''}`
    };
    const subject = subjectByType[type] || `Przetarg: ${(order.title || '').slice(0, 60)}`;

    await Promise.allSettled(
      recipients.map(to => sendEmail({ to, subject, html }))
    );
  } catch (err) {
    console.error('[Public order notifications] Błąd wysyłki:', err);
  }
}

/**
 * Wyślij przypomnienia o zbliżających się terminach (do uruchomienia z crona).
 * Zlecenia „Robimy” z customDeadline w ciągu najbliższych 3 dni – jedna wysyłka na dzień.
 */
async function sendDeadlineReminders() {
  const PublicOrder = require('../models/PublicOrder');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end3 = new Date(start);
  end3.setDate(end3.getDate() + 3);
  end3.setHours(23, 59, 59, 999);

  const orders = await PublicOrder.find({
    weDoIt: true,
    customDeadline: { $gte: start, $lte: end3, $ne: null }
  }).select('title _id customDeadline').lean();

  for (const order of orders) {
    await notifyPublicOrderSubscribers(order, 'deadline_reminder', {});
  }
}

module.exports = { notifyPublicOrderSubscribers, getRecipients, sendDeadlineReminders };
