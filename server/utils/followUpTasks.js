/**
 * Sync follow-up due dates to Task list so they appear in the Tasks calendar.
 * One task per project: "Follow-up #N – [project name]" with dueDate = project.nextFollowUpDueAt.
 */
const Task = require('../models/Task');
const Project = require('../models/Project');

/**
 * Ensure there is exactly one task for the next follow-up of this project.
 * If nextFollowUpDueAt is null, remove any existing follow-up task.
 */
async function upsertFollowUpTask(project, userId) {
  if (!project?._id) return null;
  const projectId = project._id;
  const numSent = Array.isArray(project.followUps) ? project.followUps.length : 0;
  const nextDue = project.nextFollowUpDueAt ? new Date(project.nextFollowUpDueAt) : null;

  if (!nextDue || numSent >= 3) {
    await Task.deleteOne({ 'source.kind': 'followup', 'source.refId': projectId });
    return null;
  }

  const title = `Follow-up #${numSent + 1} – ${project.name || 'Projekt'}`;
  const description = project.clientName ? `Klient: ${project.clientName}` : '';

  const existing = await Task.findOne({ 'source.kind': 'followup', 'source.refId': projectId });
  if (existing) {
    existing.title = title;
    existing.description = description;
    existing.dueDate = nextDue;
    existing.project = projectId;
    if (existing.status === 'done') {
      existing.status = 'todo';
      existing.completedAt = null;
    }
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
    assignee: project.owner || project.createdBy || null,
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
  await Task.deleteOne({ 'source.kind': 'followup', 'source.refId': projectId });
}

/**
 * Sync follow-up tasks for all projects that have nextFollowUpDueAt.
 * Call from scheduler or on demand. userId used as createdBy for new tasks.
 */
async function syncAllFollowUpTasks(userId) {
  const projects = await Project.find({
    nextFollowUpDueAt: { $ne: null },
    status: { $in: ['draft', 'active'] }
  })
    .select('_id name clientName followUps followUpScheduleDays nextFollowUpDueAt owner createdBy')
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

module.exports = { upsertFollowUpTask, deleteFollowUpTask, syncAllFollowUpTasks };
