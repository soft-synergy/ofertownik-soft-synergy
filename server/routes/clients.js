const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Hosting = require('../models/Hosting');

const router = express.Router();

router.use(auth);
router.use(requireRole(['admin']));

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
      Project.find({ client: client._id }).select('name status offerType owner createdAt'),
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
router.post('/:id/assign-project', [ body('projectId').isString() ], async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Klient nie znaleziony' });
    const project = await Project.findById(req.body.projectId);
    if (!project) return res.status(404).json({ message: 'Projekt nie znaleziony' });
    project.client = client._id;
    await project.save();
    res.json({ message: 'Projekt przypisany', project });
  } catch (e) {
    res.status(500).json({ message: 'Błąd przypisywania projektu' });
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


