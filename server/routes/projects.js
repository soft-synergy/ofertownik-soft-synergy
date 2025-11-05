const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth, requireRole } = require('../middleware/auth');
const Activity = require('../models/Activity');

const router = express.Router();

// Get all projects
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, offerType, owner } = req.query;
    const pageNum = Number.parseInt(page, 10) || 1;
    const limitNum = Number.parseInt(limit, 10) || 10;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    // Filter by offer type if provided ("final" | "preliminary")
    if (offerType) {
      query.offerType = offerType;
    }
    
    if (owner === 'me') {
      query.owner = req.user._id;
    } else if (owner) {
      query.owner = owner;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .exec();

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania projektów' });
  }
});

// Get single project
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('notes.author', 'firstName lastName email')
      .populate('followUps.author', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .populate('changelog.author', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania projektu' });
  }
});

// Create new project
router.post('/', [
  auth,
  body('name').trim().isLength({ min: 3 }),
  body('clientName').trim().isLength({ min: 2 }),
  body('clientContact').trim().isLength({ min: 2 }),
  body('clientEmail').optional({ checkFalsy: true }).isEmail(),
  body('description').if(body('offerType').equals('final')).trim().isLength({ min: 3 }),
  body('mainBenefit').if(body('offerType').equals('final')).trim().isLength({ min: 3 }),
  body('projectManager.name').if(body('offerType').equals('final')).trim().isLength({ min: 2 }),
  body('projectManager.email').if(body('offerType').equals('final')).isEmail(),
  body('projectManager.phone').if(body('offerType').equals('final')).trim().isLength({ min: 6 }),
  body('pricing.total').if(body('offerType').equals('final')).isNumeric().toFloat()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane projektu',
        errors: errors.array() 
      });
    }

    const projectData = {
      ...req.body,
      createdBy: req.user._id,
      owner: req.user._id
    };

    const project = new Project(projectData);
    // Init changelog
    project.changelog = [{
      action: 'create',
      fields: Object.keys(projectData || {}),
      author: req.user._id,
      createdAt: new Date()
    }];
    await project.save();

    // Log activity
    try {
      await Activity.create({
        action: 'project.created',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Project created: "${project.name}"`,
        metadata: { status: project.status }
      });
    } catch (e) {}

    const populatedProject = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      message: 'Projekt został utworzony pomyślnie',
      project: populatedProject
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia projektu' });
  }
});

// Update project
router.put('/:id', [
  auth,
  body('name').trim().isLength({ min: 3 }),
  body('clientName').trim().isLength({ min: 2 }),
  body('clientContact').trim().isLength({ min: 2 }),
  body('clientEmail').optional({ checkFalsy: true }).isEmail(),
  body('description').if(body('offerType').equals('final')).trim().isLength({ min: 3 }),
  body('mainBenefit').if(body('offerType').equals('final')).trim().isLength({ min: 3 }),
  body('projectManager.name').if(body('offerType').equals('final')).trim().isLength({ min: 2 }),
  body('projectManager.email').if(body('offerType').equals('final')).isEmail(),
  body('projectManager.phone').if(body('offerType').equals('final')).trim().isLength({ min: 6 }),
  body('pricing.total').if(body('offerType').equals('final')).isNumeric().toFloat()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowe dane projektu',
        errors: errors.array() 
      });
    }

    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Sprawdź uprawnienia (tylko twórca lub admin może edytować)
    if (project.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień do edycji tego projektu' });
    }

    // Prevent manual change to accepted status; must go via contract generation
    if (req.body.status === 'accepted') {
      delete req.body.status;
    }

    const before = project.toObject();
    Object.assign(project, req.body);
    await project.save();

    // Compute changed fields for changelog (shallow compare top-level keys)
    try {
      const changed = [];
      for (const key of Object.keys(req.body || {})) {
        const beforeVal = before[key];
        const afterVal = project[key];
        const isEqual = JSON.stringify(beforeVal) === JSON.stringify(afterVal);
        if (!isEqual) changed.push(key);
      }
      if (changed.length) {
        project.changelog = project.changelog || [];
        project.changelog.unshift({ action: 'update', fields: changed, author: req.user._id, createdAt: new Date() });
        await project.save();
        try {
          await Activity.create({
            action: 'project.updated',
            entityType: 'project',
            entityId: project._id,
            author: req.user._id,
            message: `Project updated: "${project.name}"`,
            metadata: { fields: changed }
          });
        } catch (e) {}
      }
    } catch (e) {
      // best-effort logging, do not fail
    }

    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .populate('changelog.author', 'firstName lastName email');

    res.json({
      message: 'Projekt został zaktualizowany pomyślnie',
      project: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji projektu' });
  }
});

// Reassign owner (admin only)
router.post('/:id/assign', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }
    const { ownerId } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }
    project.owner = ownerId;
    await project.save();
    const populated = await Project.findById(project._id)
      .populate('owner', 'firstName lastName email');
    res.json({ message: 'Przypisano właściciela', project: populated });
  } catch (e) {
    console.error('Assign owner error:', e);
    res.status(500).json({ message: 'Błąd serwera podczas przypisywania właściciela' });
  }
});

// Create a follow-up (requires note). Automatically sets sequence number.
router.post('/:id/followups', [
  auth,
  body('note').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowa treść notatki follow-up',
        errors: errors.array() 
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    if (project.status === 'accepted' || project.status === 'cancelled') {
      return res.status(400).json({ message: 'Projekt został już zaakceptowany lub anulowany' });
    }

    const numSent = Array.isArray(project.followUps) ? project.followUps.length : 0;
    if (numSent >= 3) {
      return res.status(400).json({ message: 'Wysłano już maksymalną liczbę follow-upów (3)' });
    }

    const followUp = {
      number: numSent + 1,
      sentAt: new Date(),
      note: req.body.note,
      author: req.user._id
    };

    project.followUps = project.followUps || [];
    project.followUps.push(followUp);
    // Saving will recalculate nextFollowUpDueAt via pre-save hook
    await project.save();

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('notes.author', 'firstName lastName email')
      .populate('followUps.author', 'firstName lastName email');

    res.status(201).json({ message: 'Follow-up zapisany', project: populated });
  } catch (error) {
    console.error('Add follow-up error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas dodawania follow-upu' });
  }
});

// Append a note to project
router.post('/:id/notes', [
  auth,
  body('text').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Nieprawidłowa treść notatki',
        errors: errors.array() 
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    const note = { text: req.body.text, author: req.user._id, createdAt: new Date() };
    project.notes = project.notes || [];
    project.notes.unshift(note);
    await project.save();

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('notes.author', 'firstName lastName email');

    res.status(201).json({ message: 'Notatka dodana', project: populated });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas dodawania notatki' });
  }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Sprawdź uprawnienia (tylko twórca lub admin może usunąć)
    if (project.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień do usunięcia tego projektu' });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Projekt został usunięty pomyślnie' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania projektu' });
  }
});

// Get project statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Project.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$pricing.total' }
        }
      }
    ]);

    const totalProjects = await Project.countDocuments();
    const totalValue = await Project.aggregate([
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    res.json({
      stats,
      totalProjects,
      totalValue: totalValue[0]?.total || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania statystyk' });
  }
});

module.exports = router; 