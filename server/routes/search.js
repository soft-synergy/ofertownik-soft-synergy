/**
 * Global search API - projects, tasks, clients.
 * GET /api/search?q=...
 * Searches: project name, client name/email/phone, task title, etc.
 */
const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Client = require('../models/Client');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * Escape regex special chars for safe $regex use
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ projects: [], tasks: [], clients: [] });
    }

    const pattern = new RegExp(escapeRegex(q), 'i');
    const limit = 10;

    const [projects, tasks, clients] = await Promise.all([
      // Projects: name, clientName, clientEmail, clientPhone, clientContact, description, consultationNotes
      Project.find({
        $or: [
          { name: pattern },
          { clientName: pattern },
          { clientEmail: pattern },
          { clientPhone: pattern },
          { clientContact: pattern },
          { description: pattern },
          { consultationNotes: pattern }
        ]
      })
        .select('name clientName clientEmail status offerType')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),

      // Tasks: title, description; also match via project name (populate)
      Task.find({
        isRecurrenceTemplate: { $ne: true },
        $or: [
          { title: pattern },
          { description: pattern }
        ]
      })
        .populate('project', 'name clientName')
        .populate('assignee', 'firstName lastName email')
        .select('title status dueDate project assignee')
        .sort({ dueDate: 1 })
        .limit(limit)
        .lean(),

      // Clients: name, email
      Client.find({
        $or: [
          { name: pattern },
          { email: pattern }
        ]
      })
        .select('name email')
        .sort({ name: 1 })
        .limit(limit)
        .lean()
    ]);

    // Also find tasks whose project matches (project name, client name)
    const projectIds = projects.map((p) => p._id);
    const extraTasks = await Task.find({
      isRecurrenceTemplate: { $ne: true },
      project: { $in: projectIds },
      _id: { $nin: tasks.map((t) => t._id) }
    })
      .populate('project', 'name clientName')
      .populate('assignee', 'firstName lastName email')
      .select('title status dueDate project assignee')
      .sort({ dueDate: 1 })
      .limit(5)
      .lean();

    const taskIds = new Set(tasks.map((t) => t._id.toString()));
    const mergedTasks = [...tasks];
    for (const t of extraTasks) {
      if (!taskIds.has(t._id.toString())) {
        taskIds.add(t._id.toString());
        mergedTasks.push(t);
      }
    }

    res.json({
      projects,
      tasks: mergedTasks.slice(0, limit),
      clients
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Błąd wyszukiwania' });
  }
});

module.exports = router;
