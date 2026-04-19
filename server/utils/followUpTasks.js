/**
 * Sync follow-up due dates to Task list so they appear in the Tasks calendar.
 * When a follow-up is completed: current task stays on its day as done, a new task is created for the next follow-up.
 */
const Task = require('../models/Task');
const Project = require('../models/Project');

const FOLLOW_UP_ASSIGNEE_EMAIL = 'rizka.amelia@soft-synergy.com';

async function getFollowUpAssigneeId() {
  const User = require('../models/User');
  const user = await User.findOne({ email: FOLLOW_UP_ASSIGNEE_EMAIL, isActive: true }).select('_id').lean();
  return user?._id || null;
}

/**
 * When user just added a follow-up: mark the current follow-up task as done (keep dueDate), create a new task for the next follow-up.
 */
async function completeCurrentAndCreateNextFollowUpTask(project, userId) {
  if (!project?._id) return null;
  if (project.followUpsEnabled === false) {
    await Task.deleteMany({ 'source.kind': 'followup', 'source.refId': project._id, status: { $ne: 'done' } });
    return null;
  }
  const projectId = project._id;
  const numSent = Array.isArray(project.followUps) ? project.followUps.length : 0;
  const nextDue = project.nextFollowUpDueAt ? new Date(project.nextFollowUpDueAt) : null;

  const existing = await Task.findOne({ 'source.kind': 'followup', 'source.refId': projectId });
  if (existing) {
    existing.status = 'done';
    existing.completedAt = existing.completedAt || new Date();
    await existing.save();
  }

  if (!nextDue || numSent >= 3) return existing || null;

  const title = `Follow-up #${numSent + 1} – ${project.name || 'Projekt'}`;
  const description = project.clientName ? `Klient: ${project.clientName}` : '';
  let createdBy = userId || project.owner || project.createdBy;
  if (!createdBy) {
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    createdBy = admin?._id;
  }
  if (!createdBy) return existing || null;

  const assignee = await getFollowUpAssigneeId();

  const t = new Task({
    title,
    description,
    status: 'todo',
    priority: 'normal',
    assignee,
    project: projectId,
    dueDate: nextDue,
    dueTimeMinutes: 540,
    durationMinutes: 30,
    createdBy,
    source: { kind: 'followup', refId: projectId }
  });
  await t.save();
  return t;
}

/**
 * Ensure there is exactly one *active* (non-done) task for the next follow-up of this project.
 * If nextFollowUpDueAt is null, remove any existing follow-up tasks that are todo.
 * Does not touch completed follow-up tasks (they stay on their day as done).
 */
async function upsertFollowUpTask(project, userId) {
  if (!project?._id) return null;
  const projectId = project._id;
  if (project.followUpsEnabled === false) {
    await Task.deleteMany({ 'source.kind': 'followup', 'source.refId': projectId, status: { $ne: 'done' } });
    return null;
  }
  const numSent = Array.isArray(project.followUps) ? project.followUps.length : 0;
  const nextDue = project.nextFollowUpDueAt ? new Date(project.nextFollowUpDueAt) : null;

  if (!nextDue || numSent >= 3) {
    await Task.deleteMany({ 'source.kind': 'followup', 'source.refId': projectId, status: { $ne: 'done' } });
    return null;
  }

  const title = `Follow-up #${numSent + 1} – ${project.name || 'Projekt'}`;
  const description = project.clientName ? `Klient: ${project.clientName}` : '';

  const followUpAssigneeId = await getFollowUpAssigneeId();

  const existing = await Task.findOne({ 'source.kind': 'followup', 'source.refId': projectId, status: { $ne: 'done' } });
  if (existing) {
    existing.title = title;
    existing.description = description;
    existing.dueDate = nextDue;
    existing.project = projectId;
    existing.assignee = followUpAssigneeId;
    if (!existing.source) existing.source = { kind: 'followup', refId: projectId };
    await existing.save();
    return existing;
  }

  let createdBy = userId || project.owner || project.createdBy;
  if (!createdBy) {
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    createdBy = admin?._id;
  }
  if (!createdBy) return null;

  const t = new Task({
    title,
    description,
    status: 'todo',
    priority: 'normal',
    assignee: followUpAssigneeId,
    project: projectId,
    dueDate: nextDue,
    dueTimeMinutes: 540,
    durationMinutes: 30,
    createdBy,
    source: { kind: 'followup', refId: projectId }
  });
  await t.save();
  return t;
}

/**
 * Remove the follow-up task for a project (e.g. when project is accepted/cancelled or 3 follow-ups sent).
 */
async function deleteFollowUpTask(projectId) {
  if (!projectId) return;
  await Task.deleteMany({ 'source.kind': 'followup', 'source.refId': projectId });
}

/**
 * Sync follow-up tasks for all projects that have nextFollowUpDueAt.
 * Call from scheduler or on demand. userId used as createdBy for new tasks.
 */
async function syncAllFollowUpTasks(userId) {
  const projects = await Project.find({
    followUpsEnabled: { $ne: false },
    nextFollowUpDueAt: { $ne: null },
    status: { $in: ['draft', 'active'] }
  })
    .select('_id name clientName followUps followUpsEnabled followUpScheduleDays nextFollowUpDueAt owner createdBy')
    .lean();

  for (const p of projects) {
    const numSent = Array.isArray(p.followUps) ? p.followUps.length : 0;
    if (numSent >= 3) continue;
    const project = await Project.findById(p._id);
    if (!project) continue;
    try {
      await upsertFollowUpTask(project, userId);
    } catch (e) {
      console.error('[Follow-up tasks] Sync error for project', p._id, e.message);
    }
  }
}

module.exports = { upsertFollowUpTask, completeCurrentAndCreateNextFollowUpTask, deleteFollowUpTask, syncAllFollowUpTasks };
