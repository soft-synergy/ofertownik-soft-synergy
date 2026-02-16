const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// List tasks with filters
router.get('/', auth, async (req, res) => {
  try {
    const { assignee, project, status, priority, dateFrom, dateTo, limit = 200, includeTemplates } = req.query;
    const query = {};

    // Hide recurring templates by default (they are "meta" tasks)
    if (includeTemplates !== 'true') {
      query.isRecurrenceTemplate = { $ne: true };
    }

    if (assignee === 'me') {
      query.assignee = req.user._id;
    } else if (assignee) {
      query.assignee = assignee;
    }

    if (project) {
      query.project = project;
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
      .populate('project', 'name clientName status')
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

// Get one task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'firstName lastName email')
      .populate('project', 'name clientName status')
      .populate('createdBy', 'firstName lastName');
    if (!task) {
      return res.status(404).json({ message: 'Zadanie nie zostało znalezione' });
    }
    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Błąd podczas pobierania zadania' });
  }
});

// Create task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignee, project, dueDate, dueTimeMinutes, durationMinutes, recurrence } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Tytuł i termin są wymagane' });
    }

    const basePayload = {
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'normal',
      assignee: assignee || null,
      project: project || null,
      dueDate: new Date(dueDate),
      dueTimeMinutes: dueTimeMinutes != null ? dueTimeMinutes : null,
      durationMinutes: durationMinutes != null ? durationMinutes : 60,
      createdBy: req.user._id
    };

    const recurrenceEnabled = !!recurrence?.enabled;
    if (recurrenceEnabled) {
      const frequency = recurrence?.frequency;
      const interval = Number(recurrence?.interval ?? 1) || 1;
      const untilDate = recurrence?.untilDate ? new Date(recurrence.untilDate) : null;
      if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: 'Nieprawidłowa częstotliwość powtarzania' });
      }
      if (interval < 1 || interval > 365) {
        return res.status(400).json({ message: 'Nieprawidłowy interwał powtarzania' });
      }

      // 1) Create hidden template
      const template = new Task({
        ...basePayload,
        isRecurrenceTemplate: true,
        recurrence: {
          enabled: true,
          frequency,
          interval,
          untilDate: untilDate && !Number.isNaN(untilDate.getTime()) ? untilDate : null
        }
      });
      await template.save();

      // 2) Create visible first instance (same due date)
      const firstInstance = new Task({
        ...basePayload,
        isRecurrenceTemplate: false,
        recurrenceParent: template._id,
        recurrence: { enabled: false, frequency: null, interval: 1, untilDate: null }
      });
      await firstInstance.save();

      // 3) Pre-generate instances for the next ~60 days (or untilDate)
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 60);
      const effectiveUntil = template.recurrence.untilDate && template.recurrence.untilDate < horizon ? template.recurrence.untilDate : horizon;

      const addDays = (d, n) => {
        const x = new Date(d);
        x.setDate(x.getDate() + n);
        return x;
      };
      const addMonths = (d, n) => {
        const x = new Date(d);
        x.setMonth(x.getMonth() + n);
        return x;
      };
      const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      let cursor = new Date(basePayload.dueDate);
      // advance once because first instance exists
      if (frequency === 'daily') cursor = addDays(cursor, interval);
      if (frequency === 'weekly') cursor = addDays(cursor, 7 * interval);
      if (frequency === 'monthly') cursor = addMonths(cursor, interval);

      const toCreate = [];
      while (cursor <= effectiveUntil) {
        const dayStart = startOfDay(cursor);
        const dayEnd = endOfDay(cursor);
        // eslint-disable-next-line no-await-in-loop
        const exists = await Task.findOne({
          recurrenceParent: template._id,
          dueDate: { $gte: dayStart, $lte: dayEnd }
        }).select('_id').lean();
        if (!exists) {
          toCreate.push({
            ...basePayload,
            dueDate: new Date(cursor),
            isRecurrenceTemplate: false,
            recurrenceParent: template._id,
            recurrence: { enabled: false, frequency: null, interval: 1, untilDate: null }
          });
        }
        if (frequency === 'daily') cursor = addDays(cursor, interval);
        else if (frequency === 'weekly') cursor = addDays(cursor, 7 * interval);
        else cursor = addMonths(cursor, interval);
      }
      if (toCreate.length > 0) {
        await Task.insertMany(toCreate);
      }

      await firstInstance.populate([
        { path: 'assignee', select: 'firstName lastName email' },
        { path: 'project', select: 'name clientName status' },
        { path: 'createdBy', select: 'firstName lastName' }
      ]);
      return res.status(201).json(firstInstance);
    }

    const task = new Task(basePayload);
    await task.save();
    await task.populate([
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'project', select: 'name clientName status' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
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
    const { title, description, status, priority, assignee, project, dueDate, dueTimeMinutes, durationMinutes } = req.body;
    if (title != null) task.title = title;
    if (description != null) task.description = description;
    if (status != null) task.status = status;
    if (priority != null) task.priority = priority;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (project !== undefined) task.project = project || null;
    if (dueDate != null) task.dueDate = new Date(dueDate);
    if (dueTimeMinutes !== undefined) task.dueTimeMinutes = dueTimeMinutes;
    if (durationMinutes != null) task.durationMinutes = durationMinutes;
    if (status != null) {
      if (status === 'done' && prevStatus !== 'done') {
        task.completedAt = new Date();
      }
      if (status !== 'done') {
        task.completedAt = null;
      }
    }
    await task.save();
    await task.populate([
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'project', select: 'name clientName status' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
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
