/**
 * Recurring tasks: only the next instance is created when the previous is done (or by scheduler).
 */
const Task = require('../models/Task');

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Create the next single instance for a recurring template.
 * Returns the new task or null if no next occurrence (past untilDate or already exists).
 */
async function createNextRecurrenceInstance(templateId) {
  const template = await Task.findById(templateId).lean();
  if (!template || !template.isRecurrenceTemplate || !template.recurrence?.enabled) return null;
  const frequency = template.recurrence.frequency;
  const interval = Number(template.recurrence.interval ?? 1) || 1;
  const until = template.recurrence.untilDate ? new Date(template.recurrence.untilDate) : null;

  const last = await Task.findOne({ recurrenceParent: templateId }).sort({ dueDate: -1 }).select('dueDate').lean();
  const weekdaysOnly = !!template.recurrence?.weekdaysOnly;
  let nextDate = last?.dueDate ? new Date(last.dueDate) : new Date(template.dueDate);
  if (frequency === 'daily') nextDate = addDays(nextDate, interval);
  else if (frequency === 'weekly') nextDate = addDays(nextDate, 7 * interval);
  else nextDate = addMonths(nextDate, interval);

  if (weekdaysOnly) {
    const d = nextDate.getDay();
    if (d === 0) nextDate = addDays(nextDate, 1);
    else if (d === 6) nextDate = addDays(nextDate, 2);
  }

  if (until && nextDate > until) return null;
  const dayStart = startOfDay(nextDate);
  const dayEnd = endOfDay(nextDate);
  const exists = await Task.findOne({
    recurrenceParent: templateId,
    dueDate: { $gte: dayStart, $lte: dayEnd }
  }).select('_id').lean();
  if (exists) return null;

  // Copy assignees from template (support both assignee and assignees array)
  const assigneesArray = template.assignees && Array.isArray(template.assignees) && template.assignees.length > 0
    ? template.assignees.filter(Boolean)
    : (template.assignee ? [template.assignee] : []);
  
  // Copy watchers from template
  const watchersArray = template.watchers && Array.isArray(template.watchers) && template.watchers.length > 0
    ? template.watchers.filter(Boolean)
    : [];

  const instance = new Task({
    title: template.title,
    description: template.description,
    status: 'todo',
    priority: template.priority,
    assignee: template.assignee || null, // Keep for backward compatibility
    assignees: assigneesArray, // Copy assignees array
    watchers: watchersArray, // Copy watchers array
    project: template.project || null,
    dueDate: nextDate,
    dueTimeMinutes: template.dueTimeMinutes ?? null,
    durationMinutes: template.durationMinutes ?? 60,
    createdBy: template.createdBy,
    isRecurrenceTemplate: false,
    recurrenceParent: templateId,
    recurrence: { enabled: false, frequency: null, interval: 1, untilDate: null }
  });
  await instance.save();
  return instance;
}

/**
 * For each recurring template, ensure exactly one "next" instance exists (used by daily scheduler).
 */
async function ensureNextInstancePerTemplate() {
  const templates = await Task.find({
    isRecurrenceTemplate: true,
    'recurrence.enabled': true,
    'recurrence.frequency': { $in: ['daily', 'weekly', 'monthly'] }
  }).select('_id').lean();

  for (const tpl of templates) {
    try {
      await createNextRecurrenceInstance(tpl._id);
    } catch (e) {
      console.error('[Recurring tasks] Template', tpl._id, e.message);
    }
  }
}

module.exports = { createNextRecurrenceInstance, ensureNextInstancePerTemplate };
