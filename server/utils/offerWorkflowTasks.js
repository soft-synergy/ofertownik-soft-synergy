/**
 * Taski dla workflow ofert wstępnych:
 * - to_final_estimation → task dla info@soft-synergy.com (Do wyceny finalnej)
 * - active + clarificationRequest → task dla rizka.amelia@soft-synergy.com (Doprecyzowanie)
 * - to_prepare_final_offer → task dla rizka.amelia@soft-synergy.com (Do przygotowania oferty finalnej)
 */
const Task = require('../models/Task');
const User = require('../models/User');

const INFO_EMAIL = 'info@soft-synergy.com';
const JAKUB_EMAIL = 'rizka.amelia@soft-synergy.com';

async function getAssigneeIdByEmail(email) {
  const user = await User.findOne({ email, isActive: true }).select('_id').lean();
  return user?._id || null;
}

function getDueDateToday() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Usuwa istniejące taski offer_workflow dla danego projektu (np. przed utworzeniem nowego).
 */
async function deleteOfferWorkflowTasks(projectId) {
  if (!projectId) return;
  const result = await Task.deleteMany({ 'source.kind': 'offer_workflow', 'source.refId': projectId });
  return result;
}

/**
 * Tworzy task „Do wyceny finalnej” – przypisany do info@soft-synergy.com
 */
async function upsertToFinalEstimationTask(project, userId) {
  if (!project?._id) return null;
  const projectId = project._id;

  await deleteOfferWorkflowTasks(projectId);

  const assignee = await getAssigneeIdByEmail(INFO_EMAIL);
  let createdBy = userId || project.owner || project.createdBy;
  if (!createdBy) {
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    createdBy = admin?._id;
  }
  if (!createdBy) return null;

  const title = `Do wyceny finalnej – ${project.name || 'Projekt'}`;
  const description = project.clientName ? `Klient: ${project.clientName}` : '';

  const t = new Task({
    title,
    description,
    status: 'todo',
    priority: 'high',
    assignee,
    project: projectId,
    dueDate: getDueDateToday(),
    dueTimeMinutes: 540,
    durationMinutes: 60,
    createdBy,
    source: { kind: 'offer_workflow', refId: projectId }
  });
  await t.save();
  return t;
}

/**
 * Tworzy task „Doprecyzowanie” – przypisany do rizka.amelia@soft-synergy.com
 */
async function upsertClarificationTask(project, userId) {
  if (!project?._id) return null;
  const projectId = project._id;

  await deleteOfferWorkflowTasks(projectId);

  const assignee = await getAssigneeIdByEmail(JAKUB_EMAIL);
  let createdBy = userId || project.owner || project.createdBy;
  if (!createdBy) {
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    createdBy = admin?._id;
  }
  if (!createdBy) return null;

  const title = `Doprecyzowanie – ${project.name || 'Projekt'}`;
  const desc = project.clarificationRequest?.text || '';
  const description = (project.clientName ? `Klient: ${project.clientName}\n\n` : '') + (desc ? `Do doprecyzowania:\n${desc}` : '');

  const t = new Task({
    title,
    description: description.trim(),
    status: 'todo',
    priority: 'high',
    assignee,
    project: projectId,
    dueDate: getDueDateToday(),
    dueTimeMinutes: 540,
    durationMinutes: 60,
    createdBy,
    source: { kind: 'offer_workflow', refId: projectId }
  });
  await t.save();
  return t;
}

/**
 * Tworzy task „Do przygotowania oferty finalnej” – przypisany do rizka.amelia@soft-synergy.com
 */
async function upsertPrepareFinalOfferTask(project, userId) {
  if (!project?._id) return null;
  const projectId = project._id;

  await deleteOfferWorkflowTasks(projectId);

  const assignee = await getAssigneeIdByEmail(JAKUB_EMAIL);
  let createdBy = userId || project.owner || project.createdBy;
  if (!createdBy) {
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    createdBy = admin?._id;
  }
  if (!createdBy) return null;

  const title = `Do przygotowania oferty finalnej – ${project.name || 'Projekt'}`;
  const total = project.finalEstimateTotal ?? project.pricing?.total ?? 0;
  const formatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(total);
  const description = (project.clientName ? `Klient: ${project.clientName}\n` : '') + `Wycena: ${formatted}`;

  const t = new Task({
    title,
    description,
    status: 'todo',
    priority: 'high',
    assignee,
    project: projectId,
    dueDate: getDueDateToday(),
    dueTimeMinutes: 540,
    durationMinutes: 90,
    createdBy,
    source: { kind: 'offer_workflow', refId: projectId }
  });
  await t.save();
  return t;
}

module.exports = {
  upsertToFinalEstimationTask,
  upsertClarificationTask,
  upsertPrepareFinalOfferTask,
  deleteOfferWorkflowTasks
};
