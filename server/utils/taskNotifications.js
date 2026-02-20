/**
 * Wysyłanie powiadomień email do watchers zadania
 */
const { sendEmail } = require('./emailService');
const { taskChangeNotificationTemplate } = require('./emailTemplates');
const Task = require('../models/Task');
const User = require('../models/User');
const { format } = require('date-fns');
const { pl } = require('date-fns/locale');

const STATUS_LABELS = { todo: 'Do zrobienia', in_progress: 'W toku', done: 'Zrobione', cancelled: 'Anulowane' };
const PRIORITY_LABELS = { low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny' };

/**
 * Wysyła powiadomienia email do watchers zadania
 * @param {Object} task - zadanie (może być lean)
 * @param {String} changeType - typ zmiany: 'created', 'updated', 'status_changed', 'update_added', 'assigned', 'moved'
 * @param {String} changeDescription - opis zmiany (opcjonalnie)
 * @param {Object} changedBy - użytkownik który dokonał zmiany (opcjonalnie)
 */
async function notifyTaskWatchers(task, changeType, changeDescription = null, changedBy = null) {
  try {
    // Pobierz pełne dane zadania jeśli potrzebne
    let fullTask = task;
    if (!task.watchers || !task.populate) {
      fullTask = await Task.findById(task._id || task)
        .populate('watchers', 'email firstName lastName')
        .populate('assignees', 'firstName lastName')
        .populate('project', 'name')
        .populate('createdBy', 'firstName lastName')
        .lean();
    } else {
      await fullTask.populate([
        { path: 'watchers', select: 'email firstName lastName' },
        { path: 'assignees', select: 'firstName lastName' },
        { path: 'project', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName' }
      ]);
    }

    if (!fullTask || !fullTask.watchers || fullTask.watchers.length === 0) {
      return; // Brak watchers
    }

    // Pobierz dane użytkownika który dokonał zmiany
    let changedByName = null;
    if (changedBy) {
      const user = typeof changedBy === 'object' && changedBy.firstName
        ? changedBy
        : await User.findById(changedBy).select('firstName lastName').lean();
      if (user) {
        changedByName = `${user.firstName} ${user.lastName}`;
      }
    }

    // Przygotuj dane do szablonu
    const assigneesList = fullTask.assignees && fullTask.assignees.length > 0
      ? fullTask.assignees.map(a => `${a.firstName} ${a.lastName}`).join(', ')
      : null;

    const dueDateFormatted = fullTask.dueDate
      ? format(new Date(fullTask.dueDate), 'd MMMM yyyy', { locale: pl })
      : null;

    const priorityLabel = PRIORITY_LABELS[fullTask.priority] || null;
    const statusLabel = STATUS_LABELS[fullTask.status] || null;
    const projectName = fullTask.project?.name || null;

    // Wyślij email do każdego watchera
    const emailPromises = fullTask.watchers
      .filter(w => w && w.email)
      .map(async (watcher) => {
        try {
          const html = taskChangeNotificationTemplate({
            taskTitle: fullTask.title,
            taskId: fullTask._id,
            changeType,
            changeDescription,
            changedBy: changedByName,
            taskUrl: `/tasks#task-${fullTask._id}`,
            dueDateFormatted,
            priorityLabel,
            projectName,
            statusLabel,
            assigneesList
          });

          const subject = changeType === 'created' 
            ? `✨ Nowe zadanie: ${fullTask.title}`
            : changeType === 'status_changed'
            ? `🔄 Zmiana statusu: ${fullTask.title}`
            : changeType === 'update_added'
            ? `💬 Update w zadaniu: ${fullTask.title}`
            : `📋 Zmiana w zadaniu: ${fullTask.title}`;

          await sendEmail({
            to: watcher.email,
            subject,
            html
          });
        } catch (err) {
          console.error(`[Task notifications] Błąd wysyłki emaila do watchera ${watcher.email}:`, err);
        }
      });

    await Promise.allSettled(emailPromises);
  } catch (error) {
    console.error('[Task notifications] Błąd podczas wysyłania powiadomień:', error);
    // Nie rzucaj błędu - powiadomienia nie powinny blokować operacji
  }
}

module.exports = { notifyTaskWatchers };
