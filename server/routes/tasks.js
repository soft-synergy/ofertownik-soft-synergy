const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');
const { createNextRecurrenceInstance } = require('../utils/recurringTasks');
const { notifyTaskWatchers } = require('../utils/taskNotifications');

const router = express.Router();

// List tasks with filters
router.get('/', auth, async (req, res) => {
  try {
    const { assignee, project, publicOrder, status, priority, dateFrom, dateTo, limit = 200, includeTemplates } = req.query;
    const query = {};

    // Hide recurring templates by default (they are "meta" tasks)
    if (includeTemplates !== 'true') {
      query.isRecurrenceTemplate = { $ne: true };
    }

    if (assignee === 'me') {
      query.$or = [
        { assignee: req.user._id },
        { assignees: req.user._id }
      ];
    } else if (assignee) {
      query.$or = [
        { assignee: assignee },
        { assignees: assignee }
      ];
    }

    if (project) {
      query.project = project;
    }

    if (publicOrder) {
      query.publicOrder = publicOrder;
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (dateFrom || dateTo) {
      query.dueDate = {};
      if (dateFrom) query.dueDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.dueDate.$lte = end;
      }
    }

    const limitNum = Math.min(Number.parseInt(limit, 10) || 200, 500);
    const tasks = await Task.find(query)
      .populate('assignee', 'firstName lastName email')
      .populate('assignees', 'firstName lastName email')
      .populate('watchers', 'firstName lastName email')
      .populate('project', 'name clientName status')
      .populate('publicOrder', 'title biznesPolskaId weDoIt customDeadline')
      .populate('createdBy', 'firstName lastName')
      .sort({ dueDate: 1, createdAt: 1 })
      .limit(limitNum)
      .lean();

    res.json(tasks);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ message: 'Błąd podczas pobierania zadań' });
  }
});

// Get one task (with updates for modal)
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'firstName lastName email')
      .populate('assignees', 'firstName lastName email')
      .populate('watchers', 'firstName lastName email')
      .populate('project', 'name clientName status')
      .populate('publicOrder', 'title biznesPolskaId weDoIt customDeadline')
      .populate('createdBy', 'firstName lastName')
      .populate('updates.author', 'firstName lastName');
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Błąd podczas pobierania zadania' });
  }
});

// Add update to task
router.post('/:id/updates', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    const text = (req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Treść update\'u jest wymagana' });
    }
    task.updates = task.updates || [];
    task.updates.push({
      text,
      author: req.user._id,
      createdAt: new Date()
    });
    await task.save();
    await task.populate('updates.author', 'firstName lastName');
    
    // Wyślij powiadomienia do watchers
    notifyTaskWatchers(task, 'update_added', `Dodano update: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`, req.user).catch(err => {
      console.error('[Add task update] Błąd powiadomień:', err);
    });
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Add task update error:', error);
    res.status(500).json({ message: 'Błąd podczas dodawania update\'u' });
  }
});

// Create task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignee, assignees, project, publicOrder, dueDate, dueTimeMinutes, durationMinutes, recurrence, watchers } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Tytuł i termin są wymagane' });
    }

    // Support both assignee (single) and assignees (array) for backward compatibility
    const assigneesArray = assignees && Array.isArray(assignees) ? assignees.filter(Boolean) : (assignee ? [assignee] : []);
    const watchersArray = watchers && Array.isArray(watchers) ? watchers.filter(Boolean) : [];

    const basePayload = {
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'normal',
      assignee: assignee || null, // Keep for backward compatibility
      assignees: assigneesArray, // New array field
      watchers: watchersArray, // Watchers array
      project: project || null,
      publicOrder: publicOrder || null,
      dueDate: new Date(dueDate),
      dueTimeMinutes: dueTimeMinutes != null ? dueTimeMinutes : null,
      durationMinutes: durationMinutes != null ? durationMinutes : 60,
      createdBy: req.user._id
    };

    const recurrenceEnabled = !!recurrence && !!recurrence.enabled;
    if (recurrenceEnabled) {
      const frequency = (recurrence.frequency || '').toLowerCase();
      const interval = Math.max(1, Math.min(365, Number(recurrence.interval ?? 1) || 1));
      const untilDateRaw = recurrence.untilDate;
      const untilDate = untilDateRaw ? (() => { const d = new Date(untilDateRaw); return !Number.isNaN(d.getTime()) ? d : null; })() : null;
      const weekdaysOnly = !!recurrence.weekdaysOnly;
      if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: 'Nieprawidłowa częstotliwość powtarzania (wybierz codziennie, co tydzień lub co miesiąc)' });
      }
      // 1) Create hidden template (watchers are already in basePayload)
      const template = new Task({
        ...basePayload,
        isRecurrenceTemplate: true,
        recurrence: {
          enabled: true,
          frequency,
          interval,
          untilDate,
          weekdaysOnly
        }
      });
      await template.save();

      // 2) Create only the first visible instance. Next instances are created when this one is marked done (or by scheduler).
      const firstInstance = new Task({
        ...basePayload,
        isRecurrenceTemplate: false,
        recurrenceParent: template._id,
        recurrence: { enabled: false, frequency: null, interval: 1, untilDate: null }
      });
      await firstInstance.save();

      await firstInstance.populate([
        { path: 'assignee', select: 'firstName lastName email' },
        { path: 'assignees', select: 'firstName lastName email' },
        { path: 'watchers', select: 'firstName lastName email' },
        { path: 'project', select: 'name clientName status' },
        { path: 'publicOrder', select: 'title biznesPolskaId weDoIt customDeadline' },
        { path: 'createdBy', select: 'firstName lastName' }
      ]);
      
      // Wyślij powiadomienia do watchers (jeśli są)
      notifyTaskWatchers(firstInstance, 'created', 'Utworzono nowe zadanie cykliczne', req.user).catch(err => {
        console.error('[Create recurring task] Błąd powiadomień:', err);
      });
      
      return res.status(201).json(firstInstance);
    }

    const task = new Task(basePayload);
    await task.save();
    await task.populate([
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'assignees', select: 'firstName lastName email' },
      { path: 'watchers', select: 'firstName lastName email' },
      { path: 'project', select: 'name clientName status' },
      { path: 'publicOrder', select: 'title biznesPolskaId weDoIt customDeadline' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
    
    // Wyślij powiadomienia do watchers (jeśli są)
    notifyTaskWatchers(task, 'created', 'Utworzono nowe zadanie', req.user).catch(err => {
      console.error('[Create task] Błąd powiadomień:', err);
    });
    
    return res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Błąd podczas tworzenia zadania' });
  }
});

// Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    const prevStatus = task.status;
    const prevDueDate = task.dueDate ? new Date(task.dueDate) : null;
    const { title, description, status, priority, assignee, assignees, project, dueDate, dueTimeMinutes, durationMinutes, watchers } = req.body;
    if (title != null) task.title = title;
    if (description != null) task.description = description;
    if (status != null) task.status = status;
    if (priority != null) task.priority = priority;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (assignees !== undefined) {
      task.assignees = Array.isArray(assignees) ? assignees.filter(Boolean) : [];
    }
    if (watchers !== undefined) {
      task.watchers = Array.isArray(watchers) ? watchers.filter(Boolean) : [];
    }
    if (project !== undefined) task.project = project || null;
    if (req.body.publicOrder !== undefined) task.publicOrder = req.body.publicOrder || null;
    const dueDateChanged = dueDate != null && prevDueDate && new Date(dueDate).getTime() !== prevDueDate.getTime();
    if (dueDate != null) task.dueDate = new Date(dueDate);
    if (dueTimeMinutes !== undefined) task.dueTimeMinutes = dueTimeMinutes;
    if (durationMinutes != null) task.durationMinutes = durationMinutes;
    if (status != null) {
      if (status === 'done' && prevStatus !== 'done') {
        task.completedAt = new Date();
        if (task.recurrenceParent) {
          try {
            await createNextRecurrenceInstance(task.recurrenceParent);
          } catch (e) {
            console.error('Create next recurrence instance:', e.message);
          }
        }
      }
      if (status !== 'done') {
        task.completedAt = null;
      }
    }
    await task.save();
    await task.populate([
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'assignees', select: 'firstName lastName email' },
      { path: 'watchers', select: 'firstName lastName email' },
      { path: 'project', select: 'name clientName status' },
      { path: 'publicOrder', select: 'title biznesPolskaId weDoIt customDeadline' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
    
    // Wyślij powiadomienia do watchers
    let changeType = 'updated';
    let changeDescription = 'Zadanie zostało zaktualizowane';
    
    if (status != null && status !== prevStatus) {
      changeType = 'status_changed';
      changeDescription = `Status zmieniony z "${STATUS_LABELS[prevStatus] || prevStatus}" na "${STATUS_LABELS[status] || status}"`;
    } else if (dueDateChanged) {
      changeType = 'moved';
      changeDescription = 'Zadanie zostało przeniesione na inny termin';
    } else if (assignees !== undefined || assignee !== undefined) {
      changeType = 'assigned';
      changeDescription = 'Zmieniono przypisanie do zadania';
    }
    
    notifyTaskWatchers(task, changeType, changeDescription, req.user).catch(err => {
      console.error('[Update task] Błąd powiadomień:', err);
    });
    
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Błąd podczas aktualizacji zadania' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    res.json({ message: 'Zadanie usunięte' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Błąd podczas usuwania zadania' });
  }
});

module.exports = router;
