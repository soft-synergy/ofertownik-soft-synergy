const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// List tasks with filters
router.get('/', auth, async (req, res) => {
  try {
    const { assignee, project, status, priority, dateFrom, dateTo, limit = 200 } = req.query;
    const query = {};

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
    const { title, description, status, priority, assignee, project, dueDate, dueTimeMinutes, durationMinutes } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Tytuł i termin są wymagane' });
    }
    const task = new Task({
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
    });
    await task.save();
    await task.populate([
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'project', select: 'name clientName status' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);
    res.status(201).json(task);
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
    if (status === 'done' && task.status !== 'done') {
      task.completedAt = new Date();
    }
    if (status !== 'done') {
      task.completedAt = null;
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
