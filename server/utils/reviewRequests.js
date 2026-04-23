const crypto = require('crypto');
const ReviewRequest = require('../models/ReviewRequest');
const { sendEmail } = require('./emailService');
const { reviewRequestEmailTemplate, reviewThankYouTemplate } = require('./emailTemplates');

const APP_URL = process.env.APP_URL || 'https://ofertownik.soft-synergy.com';
const FOLLOW_UP_OFFSETS_DAYS = [3, 7, 14];

function createReviewToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getReviewUrl(token) {
  return `${APP_URL}/opinie/${token}`;
}

function addDays(base, days) {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function getNextFollowUpAt(lastSentAt, currentStep) {
  const offset = FOLLOW_UP_OFFSETS_DAYS[currentStep];
  if (!offset) return null;
  return addDays(lastSentAt, offset);
}

function getReviewEmailSubject(review, kind = 'initial') {
  const suffix = review.projectName ? ` po projekcie ${review.projectName}` : '';
  if (kind === 'initial') return `Czy możesz dać nam krótką opinię${suffix}?`;
  if (kind === 'manual_reminder') return `Wracam z krótką prośbą o opinię${suffix}`;
  return `Czy znajdziesz 2 minuty na opinię${suffix}?`;
}

async function sendReviewRequestEmail(review, kind = 'initial') {
  const followUpNumber = kind.startsWith('followup_')
    ? Number(kind.split('_')[1] || 0)
    : kind === 'manual_reminder'
      ? review.followUpStep || 0
      : 0;
  const subject = getReviewEmailSubject(review, kind);
  const html = reviewRequestEmailTemplate({
    reviewUrl: getReviewUrl(review.token),
    clientName: review.clientName,
    companyName: review.companyName,
    projectName: review.projectName,
    senderName: 'Rizka Amelia · Soft Synergy',
    followUpNumber
  });

  await sendEmail({
    to: review.email,
    subject,
    html
  });

  const now = new Date();
  review.lastEmailSentAt = now;
  review.emailLogs = Array.isArray(review.emailLogs) ? review.emailLogs : [];
  review.emailLogs.push({ kind, sentAt: now, subject });
  if (kind.startsWith('followup_')) {
    review.followUpStep = Math.min(3, followUpNumber);
  }
  review.nextFollowUpAt = getNextFollowUpAt(now, review.followUpStep || 0);
  return review;
}

async function sendReviewThankYouEmail(review) {
  if (!review?.email || !review?.response?.respondedAt) return;
  await sendEmail({
    to: review.email,
    subject: 'Dziękujemy za opinię i mamy dla Ciebie 100 zł zniżki',
    html: reviewThankYouTemplate({
      clientName: review.response.clientName || review.clientName,
      testimonial: review.response.testimonial,
      allowPublicUse: !!review.response.allowPublicUse
    })
  });
}

async function runReviewFollowUpScheduler() {
  const now = new Date();
  const pending = await ReviewRequest.find({
    status: 'pending',
    nextFollowUpAt: { $ne: null, $lte: now }
  }).limit(50);

  for (const review of pending) {
    const nextStep = Math.min(3, (review.followUpStep || 0) + 1);
    const kind = `followup_${nextStep}`;
    try {
      await sendReviewRequestEmail(review, kind);
      await review.save();
    } catch (error) {
      console.error('[Review follow-up] Email error:', error.message);
    }
  }
}

module.exports = {
  APP_URL,
  createReviewToken,
  getReviewUrl,
  sendReviewRequestEmail,
  sendReviewThankYouEmail,
  runReviewFollowUpScheduler
};
