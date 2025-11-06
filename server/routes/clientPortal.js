const express = require('express');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Hosting = require('../models/Hosting');

const router = express.Router();

// Public client portal by token
router.get('/:token', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });
    const [projects, hostings] = await Promise.all([
      Project.find({ client: client._id }).select('name status offerType generatedOfferUrl workSummaryUrl workSummaryPdfUrl documents createdAt _id'),
      Hosting.find({ client: client._id }).select('domain status monthlyPrice nextPaymentDate lastPaymentDate')
    ]);
    res.json({ client: { name: client.name, email: client.email, phone: client.phone, company: client.company }, projects, hostings });
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania danych klienta' });
  }
});

// Accept project offer (via portal token)
router.post('/:token/accept-project/:projectId', async (req, res) => {
  try {
    const client = await Client.findOne({ portalToken: req.params.token, portalEnabled: true });
    if (!client) return res.status(404).json({ message: 'Nie znaleziono klienta' });
    
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Projekt nie znaleziony' });
    
    if (project.client?.toString() !== client._id.toString()) {
      return res.status(403).json({ message: 'Projekt nie należy do tego klienta' });
    }
    
    if (project.status === 'accepted') {
      return res.status(400).json({ message: 'Oferta została już zaakceptowana' });
    }
    
    project.status = 'accepted';
    await project.save();
    
    // Log activity
    try {
      const Activity = require('../models/Activity');
      await Activity.create({
        action: 'project.accepted.via_portal',
        entityType: 'project',
        entityId: project._id,
        author: null, // client portal acceptance
        message: `Oferta "${project.name}" zaakceptowana przez klienta ${client.name} przez portal`
      });
    } catch (e) {}
    
    res.json({ message: 'Oferta została zaakceptowana', project });
  } catch (e) {
    console.error('Accept project error:', e);
    res.status(500).json({ message: 'Błąd akceptacji oferty' });
  }
});

module.exports = router;


