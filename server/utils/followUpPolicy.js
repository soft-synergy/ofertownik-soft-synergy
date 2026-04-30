const MAX_FOLLOW_UPS = 6;

const DEFAULT_FOLLOW_UP_STEPS = [
  { delayBusinessDays: 1, dueTimeMinutes: 615, priority: 'high', label: 'Szybkie sprawdzenie decyzji' },
  { delayBusinessDays: 3, dueTimeMinutes: 660, priority: 'normal', label: 'Dopytanie o blokery' },
  { delayBusinessDays: 5, dueTimeMinutes: 630, priority: 'normal', label: 'Pomoc w domknięciu decyzji' },
  { delayBusinessDays: 8, dueTimeMinutes: 810, priority: 'normal', label: 'Powrót po spokojnym czasie' },
  { delayBusinessDays: 13, dueTimeMinutes: 600, priority: 'low', label: 'Ostatni merytoryczny follow-up' },
  { delayBusinessDays: 21, dueTimeMinutes: 570, priority: 'low', label: 'Zamknięcie pętli' }
];

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(date, days) {
  const result = new Date(date.getTime());
  let remaining = Math.max(0, Number(days) || 0);

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) remaining -= 1;
  }

  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

function withTime(date, minutesFromMidnight) {
  const result = new Date(date.getTime());
  const minutes = Number.isFinite(minutesFromMidnight) ? minutesFromMidnight : 600;
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function getFollowUpStep(project) {
  const sentCount = Array.isArray(project?.followUps) ? project.followUps.length : 0;
  return DEFAULT_FOLLOW_UP_STEPS[Math.min(sentCount, MAX_FOLLOW_UPS - 1)] || null;
}

function isFollowUpEligible(project) {
  if (!project || project.followUpsEnabled === false) return false;
  if (project.status === 'accepted' || project.status === 'cancelled' || project.status === 'completed') return false;

  return Boolean(
    project.status === 'active' ||
    project.generatedOfferUrl ||
    project.pdfUrl
  );
}

function getLastFollowUpDate(project) {
  const followUps = Array.isArray(project?.followUps) ? project.followUps : [];
  const last = followUps
    .map((followUp) => followUp?.sentAt && new Date(followUp.sentAt))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return last || null;
}

function getNextFollowUpDueAt(project, now = new Date()) {
  if (!isFollowUpEligible(project)) return null;

  const sentCount = Array.isArray(project.followUps) ? project.followUps.length : 0;
  if (sentCount >= MAX_FOLLOW_UPS) return null;

  const step = getFollowUpStep(project);
  if (!step) return null;

  const anchor =
    getLastFollowUpDate(project) ||
    (project.followUpStartedAt ? new Date(project.followUpStartedAt) : now);

  return withTime(addBusinessDays(anchor, step.delayBusinessDays), step.dueTimeMinutes);
}

function getFollowUpTaskMeta(project) {
  const sentCount = Array.isArray(project?.followUps) ? project.followUps.length : 0;
  const step = getFollowUpStep(project);

  return {
    maxFollowUps: MAX_FOLLOW_UPS,
    nextNumber: Math.min(sentCount + 1, MAX_FOLLOW_UPS),
    priority: step?.priority || 'normal',
    label: step?.label || 'Follow-up',
    dueTimeMinutes: step?.dueTimeMinutes || 600
  };
}

module.exports = {
  MAX_FOLLOW_UPS,
  DEFAULT_FOLLOW_UP_STEPS,
  getNextFollowUpDueAt,
  getFollowUpTaskMeta,
  isFollowUpEligible
};
