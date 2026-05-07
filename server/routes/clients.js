const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Hosting = require('../models/Hosting');

const router = express.Router();

router.use(auth);
router.use(requireRole(['admin', 'employee']));

// List clients
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const clients = await Client.find(query).sort({ createdAt: -1 });
    res.json(clients);
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania klientów' });
  }
});

// Create client
router.post('/', [
  body('name').trim().isLength({ min: 2 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('phone').optional({ checkFalsy: true }).isString(),
  body('company').optional({ checkFalsy: true }).isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe dane klienta', errors: errors.array() });
    }
    // generate simple portal token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const client = await Client.create({ ...req.body, createdBy: req.user._id, portalEnabled: true, portalToken: token });
    res.status(201).json(client);
  } catch (e) {
    res.status(500).json({ message: 'Błąd tworzenia klienta' });
  }
});

// Get client with summary
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const [projects, hostings] = await Promise.all([
      Project.find({ client: client._id }).select('name status offerType owner createdAt documents generatedOfferUrl workSummaryUrl workSummaryPdfUrl'),
      Hosting.find({ client: client._id }).select('domain status monthlyPrice nextPaymentDate')
    ]);
    res.json({ client, projects, hostings });
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania klienta' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    res.json(client);
  } catch (e) {
    res.status(500).json({ message: 'Błąd aktualizacji klienta' });
  }
});

// Regenerate portal token
router.post('/:id/portal/regenerate', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    client.portalToken = token;
    client.portalEnabled = true;
    await client.save();
    res.json({ message: 'Link portalu zregenerowany', client });
  } catch (e) {
    res.status(500).json({ message: 'Błąd regeneracji linku portalu' });
  }
});

// Projects that can be managed from client details
router.get('/:id/assignable-projects', [
  param('id').isMongoId(),
  query('search').optional({ checkFalsy: true }).isString().trim(),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowe parametry', errors: errors.array() });
    }

    const client = await Client.findById(req.params.id).select('name company email phone');
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });

    const limit = Number.parseInt(req.query.limit, 10) || 200;
    const queryFilter = {};
    const search = (req.query.search || '').trim();
    if (search) {
      queryFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { clientEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(queryFilter)
      .select('name status offerType client clientName clientEmail clientContact createdAt')
      .populate('client', 'name company email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      client,
      projects: projects.map((project) => ({
        ...project,
        assignedToCurrentClient: project.client?._id?.toString() === client._id.toString(),
        assignable: !project.client || project.client?._id?.toString() === client._id.toString()
      }))
    });
  } catch (e) {
    console.error('Assignable projects error:', e);
    res.status(500).json({ message: 'Błąd pobierania projektów do przypisania' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Klient usunięty' });
  } catch (e) {
    res.status(500).json({ message: 'Błąd usuwania klienta' });
  }
});

// Assign project to client
router.post('/:id/assign-project', [
  param('id').isMongoId(),
  body('projectId').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowy projekt', errors: errors.array() });
    }
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const project = await Project.findById(req.body.projectId).populate('client', 'name company email');
    if (!project) return res.status(404).json({ message: 'Projekt nie znaleziony' });
    const previousClient = project.client || null;
    project.client = client._id;
    await project.save();
    const updated = await Project.findById(project._id).populate('client', 'name company email');
    res.json({ message: 'Projekt przypisany', project: updated, previousClient });
  } catch (e) {
    console.error('Assign project error:', e);
    res.status(500).json({ message: 'Błąd przypisywania projektu' });
  }
});

// Remove project from client
router.delete('/:id/projects/:projectId', [
  param('id').isMongoId(),
  param('projectId').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowy projekt', errors: errors.array() });
    }

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const project = await Project.findOne({ _id: req.params.projectId, client: client._id });
    if (!project) return res.status(404).json({ message: 'Projekt nie jest przypisany do tego klienta' });

    project.client = null;
    await project.save();
    res.json({ message: 'Projekt odpięty od klienta', project });
  } catch (e) {
    console.error('Unassign project error:', e);
    res.status(500).json({ message: 'Błąd odpinania projektu' });
  }
});

// Assign hosting to client
router.post('/:id/assign-hosting', [ body('hostingId').isString() ], async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const hosting = await Hosting.findById(req.body.hostingId);
    if (!hosting) return res.status(404).json({ message: 'Hosting nie znaleziony' });
    hosting.client = client._id;
    await hosting.save();
    res.json({ message: 'Hosting przypisany', hosting });
  } catch (e) {
    res.status(500).json({ message: 'Błąd przypisywania hostingu' });
  }
});

module.exports = router;
