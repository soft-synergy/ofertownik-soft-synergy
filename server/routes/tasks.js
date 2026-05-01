const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth, requireScope } = require('../middleware/auth');
const { createNextRecurrenceInstance } = require('../utils/recurringTasks');
const { notifyTaskWatchers } = require('../utils/taskNotifications');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads/tasks');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `task-attachment-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, true);
  }
});

// Human-readable labels for statuses (used in notifications)
const STATUS_LABELS = {
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  done: 'Zrobione',
  cancelled: 'Anulowane'
};

function privateTaskAccessQuery(userId) {
  return [
    {
      isPrivate: { $ne: true }
    },
    {
      createdBy: userId
    },
    {
      assignee: userId
    },
    {
      assignees: userId
    },
    {
      watchers: userId
    }
  ];
}

function addAccessCondition(query, condition) {
  query.$and = query.$and || [];
  query.$and.push(condition);
}

function assigneeQuery(userId) {
  return {
    $or: [
      { assignee: userId },
      { assignees: userId }
    ]
  };
}

function canAccessTask(task, userId) {
  if (!task?.isPrivate) return true;
  const id = userId?.toString?.() || String(userId);
  const matches = (value) => value && (value.toString?.() || String(value)) === id;

  return (
    matches(task.createdBy) ||
    matches(task.assignee) ||
    (Array.isArray(task.assignees) && task.assignees.some(matches)) ||
    (Array.isArray(task.watchers) && task.watchers.some(matches))
  );
}

// List tasks with filters
router.get('/', auth, requireScope('tasks:read'), async (req, res) => {
  try {
    const { assignee, project, publicOrder, status, priority, dateFrom, dateTo, limit = 200, includeTemplates } = req.query;
    const query = {};
    addAccessCondition(query, { $or: privateTaskAccessQuery(req.user._id) });

    // Hide recurring templates by default (they are "meta" tasks)
    if (includeTemplates !== 'true') {
      query.isRecurrenceTemplate = { $ne: true };
    }

    if (assignee === 'me') {
      addAccessCondition(query, assigneeQuery(req.user._id));
    } else if (assignee) {
      addAccessCondition(query, assigneeQuery(assignee));
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
router.get('/:id', auth, requireScope('tasks:read'), async (req, res) => {
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
    if (!canAccessTask(task, req.user._id)) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Błąd podczas pobierania zadania' });
  }
});

// Add update to task
router.post('/:id/updates', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!canAccessTask(task, req.user._id)) {
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
router.post('/', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const { title, description, status, priority, assignee, assignees, project, publicOrder, dueDate, dueTimeMinutes, durationMinutes, recurrence, watchers, isPrivate } = req.body;
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
      isPrivate: !!isPrivate,
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
router.put('/:id', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!canAccessTask(task, req.user._id)) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    const prevStatus = task.status;
    const prevDueDate = task.dueDate ? new Date(task.dueDate) : null;
    const { title, description, status, priority, assignee, assignees, project, dueDate, dueTimeMinutes, durationMinutes, watchers, isPrivate } = req.body;
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
    if (isPrivate !== undefined) task.isPrivate = !!isPrivate;
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

    if (dueDateChanged && task.source?.kind === 'followup' && task.source?.refId) {
      try {
        const Project = require('../models/Project');
        await Project.findByIdAndUpdate(task.source.refId, {
          nextFollowUpDueAt: task.dueDate,
          followUpManualDueAt: task.dueDate,
          lastFollowUpReminderAt: null
        });
      } catch (e) {
        console.error('[Update task] Błąd synchronizacji terminu follow-upu z projektem:', e.message);
      }
    }

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
router.delete('/:id', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!canAccessTask(task, req.user._id)) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (task.attachments && task.attachments.length > 0) {
      task.attachments.forEach((att) => {
        const filePath = path.join(uploadsDir, att.filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        }
      });
    }
    await task.deleteOne();
    res.json({ message: 'Zadanie usunięte' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Błąd podczas usuwania zadania' });
  }
});

// Upload attachment to task
router.post('/:id/attachments', auth, requireScope('tasks:write'), upload.array('files', 20), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!canAccessTask(task, req.user._id)) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Brak plików do przesłania' });
    }
    task.attachments = task.attachments || [];
    req.files.forEach((file) => {
      task.attachments.push({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      });
    });
    await task.save();
    await task.populate('attachments.uploadedBy', 'firstName lastName');
    res.status(201).json(task);
  } catch (error) {
    console.error('Upload task attachment error:', error);
    res.status(500).json({ message: 'Błąd podczas przesyłania plików' });
  }
});

// Delete attachment from task
router.delete('/:id/attachments/:attachmentId', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    if (!canAccessTask(task, req.user._id)) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    const attachment = (task.attachments || []).find(
      (a) => a._id.toString() === req.params.attachmentId
    );
    if (!attachment) {
      return res.status(404).json({ message: 'Załącznik nie został znaleziony' });
    }
    const filePath = path.join(uploadsDir, attachment.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
    task.attachments.pull(req.params.attachmentId);
    await task.save();
    res.json(task);
  } catch (error) {
    console.error('Delete task attachment error:', error);
    res.status(500).json({ message: 'Błąd podczas usuwania załącznika' });
  }
});

// Batch delete tasks
router.post('/batch-delete', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Podaj listę identyfikatorów zadań do usunięcia' });
    }
    let deleted = 0;
    for (const id of ids) {
      const task = await Task.findById(id);
      if (!task) continue;
      if (!canAccessTask(task, req.user._id)) continue;
      if (task.attachments && task.attachments.length > 0) {
        task.attachments.forEach((att) => {
          const fpath = path.join(uploadsDir, att.filename);
          if (fs.existsSync(fpath)) {
            try { fs.unlinkSync(fpath); } catch (e) { /* ignore */ }
          }
        });
      }
      await task.deleteOne();
      deleted++;
    }
    res.json({ message: `Usunięto ${deleted} ${deleted === 1 ? 'zadanie' : (deleted < 5 ? 'zadania' : 'zadań')}`, count: deleted });
  } catch (error) {
    console.error('Batch delete tasks error:', error);
    res.status(500).json({ message: 'Błąd podczas usuwania zadań' });
  }
});

// Batch update tasks status
router.post('/batch-update', auth, requireScope('tasks:write'), async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Podaj listę identyfikatorów zadań' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ message: 'Podaj dane do aktualizacji' });
    }
    let updated = 0;
    for (const id of ids) {
      const task = await Task.findById(id);
      if (!task) continue;
      if (!canAccessTask(task, req.user._id)) continue;
      if (updates.status != null) {
        if (updates.status === 'done' && task.status !== 'done') {
          task.completedAt = new Date();
          if (task.recurrenceParent) {
            try { await createNextRecurrenceInstance(task.recurrenceParent); } catch (e) { /* ignore */ }
          }
        }
        if (updates.status !== 'done') task.completedAt = null;
        task.status = updates.status;
      }
      if (updates.priority != null) task.priority = updates.priority;
      if (Array.isArray(updates.assignees)) task.assignees = updates.assignees;
      await task.save();
      updated++;
    }
    res.json({ message: `Zaktualizowano ${updated} ${updated === 1 ? 'zadanie' : (updated < 5 ? 'zadania' : 'zadań')}`, count: updated });
  } catch (error) {
    console.error('Batch update tasks error:', error);
    res.status(500).json({ message: 'Błąd podczas aktualizacji zadań' });
  }
});

module.exports = router;
