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
      Project.find({ client: client._id }).select('name status offerType generatedOfferUrl workSummaryUrl workSummaryPdfUrl documents createdAt'),
      Hosting.find({ client: client._id }).select('domain status monthlyPrice nextPaymentDate lastPaymentDate')
    ]);
    res.json({ client: { name: client.name, email: client.email, phone: client.phone, company: client.company }, projects, hostings });
  } catch (e) {
    res.status(500).json({ message: 'Błąd pobierania danych klienta' });
  }
});

module.exports = router;


