const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth, requireRole } = require('../middleware/auth');
const Activity = require('../models/Activity');
const { upsertFollowUpTask, completeCurrentAndCreateNextFollowUpTask } = require('../utils/followUpTasks');
const Client = require('../models/Client');

const router = express.Router();

// Opiekun projektu – zawsze Jakub Czajka (bez pola w formularzu)
const DEFAULT_PROJECT_MANAGER = {
  name: "Jakub Czajka",
  position: "Senior Project Manager",
  email: "jakub.czajka@soft-synergy.com",
  phone: "+48 793 868 886",
  avatar: "/generated-offers/jakub czajka.jpeg",
  description: "Nazywam się Jakub Czajka i pełnię rolę menedżera projektów w Soft Synergy. Specjalizuję się w koordynowaniu zespołów oraz zarządzaniu realizacją nowoczesnych projektów IT. Dbam o sprawną komunikację, terminowość oraz najwyższą jakość dostarczanych rozwiązań. Moim celem jest zapewnienie klientom profesjonalnej obsługi i skutecznej realizacji ich celów biznesowych."
};

function canEditProject(project, user) {
  if (!project || !user) return false;
  if (user.role === 'admin') return true;
  const userId = user._id?.toString?.() || String(user._id);
  const createdBy = project.createdBy?.toString?.() || String(project.createdBy);
  const owner = project.owner ? (project.owner?.toString?.() || String(project.owner)) : null;
  return createdBy === userId || (owner && owner === userId);
}

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

// --- Offer workflow for preliminary offers ---
// Mark preliminary offer as "Do wyceny finalnej" (orange highlight)
router.post('/:id/request-final-estimation', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    if (!canEditProject(project, req.user)) return res.status(403).json({ message: 'Brak uprawnień' });

    if (project.offerType !== 'preliminary') {
      return res.status(400).json({ message: 'Ta akcja jest dostępna tylko dla ofert wstępnych' });
    }

    project.status = 'to_final_estimation';
    await project.save();

    // Task dla info@soft-synergy.com (Do wyceny finalnej)
    try {
      const { upsertToFinalEstimationTask } = require('../utils/offerWorkflowTasks');
      await upsertToFinalEstimationTask(project, req.user._id);
    } catch (taskErr) {
      console.error('[request-final-estimation] Błąd tworzenia taska:', taskErr);
    }

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar');

    // Wyślij email do info@soft-synergy.com o prośbie o wycenę
    try {
      const { sendEmail } = require('../utils/emailService');
      const { quoteRequestTemplate } = require('../utils/emailTemplates');
      const subject = `💰 Prośba o wycenę finalną: ${project.name}`;
      const html = quoteRequestTemplate({
        projectName: project.name,
        clientName: project.clientName || '-',
        clientContact: project.clientContact || '-',
        clientEmail: project.clientEmail || '-',
        projectId: project._id.toString()
      });
      await sendEmail({ to: 'info@soft-synergy.com', subject, html });
    } catch (emailErr) {
      console.error('[request-final-estimation] Błąd wysyłki emaila:', emailErr);
      // nie przerywamy - status projektu został już zmieniony
    }

    return res.json({ message: 'Ustawiono status: Do wyceny finalnej', project: updated });
  } catch (e) {
    console.error('request-final-estimation error:', e);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Oferta wstępna → pełna oferta (OpenRouter, model z OPENROUTER_MODEL_OFFER_FULL lub xiaomi/mimo-v2-pro)
router.post('/:id/ai-generate-full-offer', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }
    if (!canEditProject(project, req.user)) {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }
    if (project.offerType !== 'preliminary') {
      return res.status(400).json({
        message: 'Generowanie z AI jest dostępne tylko dla ofert wstępnych'
      });
    }

    const notes = (project.consultationNotes || '').trim();
    const desc = (project.description || '').trim();
    const usableDesc =
      desc && desc !== 'Konsultacja wstępna' ? desc : '';
    if (!notes && !usableDesc) {
      return res.status(400).json({
        message:
          'Uzupełnij notatki z konsultacji (lub opis) — AI potrzebuje kontekstu do wygenerowania pełnej oferty'
      });
    }

    const {
      generateFullOfferDraftFromPreliminary,
      draftToProjectUpdate
    } = require('../services/aiPreliminaryToFullOffer');

    let draft;
    try {
      draft = await generateFullOfferDraftFromPreliminary(project);
    } catch (err) {
      if (err.code === 'NO_OPENROUTER') {
        return res.status(503).json({ message: err.message });
      }
      if (err.code === 'AI_PARSE') {
        return res.status(502).json({ message: err.message });
      }
      console.error('[ai-generate-full-offer]', err);
      return res.status(502).json({
        message: err.message || 'Błąd generowania oferty przez AI'
      });
    }

    const before = project.toObject();
    const update = draftToProjectUpdate(project, draft);
    update.projectManager = { ...DEFAULT_PROJECT_MANAGER };
    Object.assign(project, update);
    await project.save();

    try {
      await upsertFollowUpTask(project, req.user._id);
    } catch (e) {}

    try {
      const changed = [];
      for (const key of Object.keys(update)) {
        const beforeVal = before[key];
        const afterVal = project[key];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          changed.push(key);
        }
      }
      if (changed.length) {
        project.changelog = project.changelog || [];
        project.changelog.unshift({
          action: 'update',
          fields: ['ai_generate_full_offer', ...changed],
          author: req.user._id,
          createdAt: new Date()
        });
        await project.save();
        try {
          await Activity.create({
            action: 'project.updated',
            entityType: 'project',
            entityId: project._id,
            author: req.user._id,
            message: `AI: pełna oferta z oferty wstępnej — "${project.name}"`,
            metadata: { source: 'ai-generate-full-offer', fields: changed }
          });
        } catch (e) {}
      }
    } catch (e) {}

    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .populate('changelog.author', 'firstName lastName email');

    return res.json({
      message:
        'Wygenerowano pełną ofertę z AI. Przejrzyj moduły, ceny i teksty przed wysłaniem do klienta.',
      project: updatedProject
    });
  } catch (error) {
    console.error('ai-generate-full-offer error:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Doprecyzowanie – gdy nie można jeszcze zrobić wyceny finalnej (brakuje info od klienta). Dopisuje do historii.
router.post('/:id/request-clarification', [
  auth,
  body('clarificationText').trim().notEmpty().withMessage('Treść doprecyzowania jest wymagana')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0]?.msg || 'Treść doprecyzowania jest wymagana', errors: errors.array() });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    if (!canEditProject(project, req.user)) return res.status(403).json({ message: 'Brak uprawnień' });

    if (project.offerType !== 'preliminary') {
      return res.status(400).json({ message: 'Ta akcja jest dostępna tylko dla ofert wstępnych' });
    }

    const canRequest = project.status === 'to_final_estimation' ||
      (project.status === 'active' && project.clarificationHistory?.length > 0 &&
        project.clarificationHistory[project.clarificationHistory.length - 1].responseText);
    if (!canRequest) {
      return res.status(400).json({ message: 'Doprecyzowanie dostępne gdy status to "Do wyceny finalnej" lub gdy klient już odpowiedział na ostatnie doprecyzowanie' });
    }

    const clarificationText = req.body.clarificationText.trim();
    const requestedAt = new Date();
    if (!project.clarificationHistory) project.clarificationHistory = [];
    // Migracja: jeśli są stare dane w clarificationRequest a brak w historii
    if (project.clarificationHistory.length === 0 && project.clarificationRequest?.text) {
      project.clarificationHistory.push({
        requestText: project.clarificationRequest.text,
        requestedAt: project.clarificationRequest.requestedAt || requestedAt,
        requestedBy: project.clarificationRequest.requestedBy,
        responseText: null,
        respondedAt: null
      });
    }
    project.clarificationHistory.push({
      requestText: clarificationText,
      requestedAt,
      requestedBy: req.user._id,
      responseText: null,
      respondedAt: null
    });
    project.clarificationRequest = {
      text: clarificationText,
      requestedAt,
      requestedBy: req.user._id
    };
    project.status = 'active'; // czeka na odpowiedź klienta
    await project.save();

    // Wyślij email do Jakuba o doprecyzowaniu
    try {
      const { sendEmail } = require('../utils/emailService');
      const { clarificationRequestTemplate } = require('../utils/emailTemplates');
      const subject = `📋 Doprecyzowanie: ${project.name}`;
      const html = clarificationRequestTemplate({
        projectName: project.name,
        clientName: project.clientName || '-',
        clientContact: project.clientContact || '-',
        clientEmail: project.clientEmail || '-',
        clientPhone: project.clientPhone || '-',
        consultationNotes: project.consultationNotes || '',
        clarificationText,
        projectId: project._id.toString()
      });
      await sendEmail({ to: 'jakub.czajka@soft-synergy.com', subject, html });
    } catch (emailErr) {
      console.error('[request-clarification] Błąd wysyłki emaila:', emailErr);
    }

    // Task dla Jakuba – doprecyzowanie (przygotowanie dodatkowych informacji)
    try {
      const { upsertClarificationTask } = require('../utils/offerWorkflowTasks');
      await upsertClarificationTask(project, req.user._id);
    } catch (taskErr) {
      console.error('[request-clarification] Błąd tworzenia taska:', taskErr);
    }

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .populate('clarificationRequest.requestedBy', 'firstName lastName email')
      .populate('clarificationHistory.requestedBy', 'firstName lastName email');

    return res.json({ message: 'Zapisano doprecyzowanie. Jakub dostanie maila – odpowiedź wpisuje w panelu admina.', project: updated });
  } catch (e) {
    console.error('request-clarification error:', e);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Odpowiedź na doprecyzowanie w panelu admina (Jakub / staff) – po wpisaniu status wraca do "Do wyceny finalnej"
router.post('/:id/clarification-response', [
  auth,
  body('responseText').trim().notEmpty().withMessage('Treść odpowiedzi jest wymagana')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0]?.msg || 'Treść odpowiedzi jest wymagana', errors: errors.array() });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    if (!canEditProject(project, req.user)) return res.status(403).json({ message: 'Brak uprawnień' });

    const history = project.clarificationHistory || [];
    if (history.length === 0) return res.status(400).json({ message: 'Brak otwartego doprecyzowania' });
    const last = history[history.length - 1];
    if (last.responseText) return res.status(400).json({ message: 'Na to doprecyzowanie już wpisano odpowiedź' });

    const responseText = req.body.responseText.trim();
    last.responseText = responseText;
    last.respondedAt = new Date();
    last.respondedBy = req.user._id;
    project.clarificationHistory = history;
    project.status = 'to_final_estimation';
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar')
      .populate('clarificationRequest.requestedBy', 'firstName lastName email')
      .populate('clarificationHistory.requestedBy', 'firstName lastName email')
      .populate('clarificationHistory.respondedBy', 'firstName lastName email');

    return res.json({ message: 'Odpowiedź na doprecyzowanie zapisana. Status: Do wyceny finalnej.', project: updated });
  } catch (e) {
    console.error('clarification-response error:', e);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Submit final estimate (single total) and mark as "Do przygotowania oferty finalnej" (green highlight)
router.post('/:id/submit-final-estimate', [
  auth,
  body('total').isNumeric().toFloat().custom(v => v >= 0)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Nieprawidłowa cena', errors: errors.array() });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    if (!canEditProject(project, req.user)) return res.status(403).json({ message: 'Brak uprawnień' });

    if (project.offerType !== 'preliminary') {
      return res.status(400).json({ message: 'Ta akcja jest dostępna tylko dla ofert wstępnych' });
    }

    // AI gate: blokuj zapis wyceny finalnej tylko przy twardych blokerach
    let gate = {
      canEstimateFinalNow: true,
      hardBlockers: [],
      risksToFlagAtFinalOffer: [],
      clarificationQuestions: []
    };
    try {
      const { analyzeFinalEstimationReadiness } = require('../services/aiFinalEstimationGate');
      gate = await analyzeFinalEstimationReadiness(project);
    } catch (gateErr) {
      // fail-open: nie blokujemy pracy przy awarii AI, ale logujemy problem
      console.error('[submit-final-estimate][ai-gate] warning:', gateErr.message || gateErr);
    }

    const total = Number(req.body.total);
    project.finalEstimateTotal = total;
    project.finalEstimateSubmittedAt = new Date();
    project.finalOfferRisks = gate.risksToFlagAtFinalOffer || [];
    project.status = 'to_prepare_final_offer';

    // Keep pricing in sync with UI currency display (single-number input)
    project.pricing = project.pricing || {};
    project.pricing.phase1 = total;
    project.pricing.phase2 = 0;
    project.pricing.phase3 = 0;
    project.pricing.phase4 = 0;
    // Jeśli mamy wycenę finalną, to cena w ofercie ma być dokładnie ta kwota.
    // Szablon HTML pokazuje `priceRange`, jeśli jest ustawione `priceRange.min`,
    // więc czyścimy ją, żeby wymuszona cena pochodziła z `pricing.total`.
    project.priceRange = { min: null, max: null };
    // pricing.total is calculated in pre-save hook

    await project.save();

    // Wyślij email do Jakuba o zapisanej wycenie finalnej
    try {
      const { sendEmail } = require('../utils/emailService');
      const { finalEstimateSubmittedTemplate } = require('../utils/emailTemplates');
      const subject = `💰 Wycena finalna zapisana: ${project.name}`;
      const html = finalEstimateSubmittedTemplate({
        projectName: project.name,
        clientName: project.clientName || '-',
        clientContact: project.clientContact || '-',
        clientEmail: project.clientEmail || '-',
        clientPhone: project.clientPhone || '-',
        consultationNotes: project.consultationNotes || '',
        total,
        projectId: project._id.toString()
      });
      await sendEmail({ to: 'jakub.czajka@soft-synergy.com', subject, html });
    } catch (emailErr) {
      console.error('[submit-final-estimate] Błąd wysyłki emaila:', emailErr);
    }

    // Task dla Jakuba – do przygotowania oferty finalnej
    try {
      const { upsertPrepareFinalOfferTask } = require('../utils/offerWorkflowTasks');
      await upsertPrepareFinalOfferTask(project, req.user._id);
    } catch (taskErr) {
      console.error('[submit-final-estimate] Błąd tworzenia taska:', taskErr);
    }

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('teamMembers.user', 'firstName lastName email role avatar');

    return res.json({
      message: 'Zapisano wycenę finalną i ustawiono status: Do przygotowania oferty finalnej',
      project: updated,
      risksToFlagAtFinalOffer: gate.risksToFlagAtFinalOffer || [],
      hardBlockers: gate.hardBlockers || [],
      clarificationQuestions: gate.clarificationQuestions || []
    });
  } catch (e) {
    console.error('submit-final-estimate error:', e);
    return res.status(500).json({ message: 'Błąd serwera' });
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

    // Auto-utworzenie / przypięcie klienta po emailu
    const email = (projectData.clientEmail || '').trim().toLowerCase();
    if (email) {
      let client = await Client.findOne({ email });
      if (!client) {
        const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        client = await Client.create({
          name: projectData.clientName,
          email,
          phone: projectData.clientPhone || undefined,
          company: undefined,
          notes: '',
          createdBy: req.user._id,
          portalEnabled: true,
          portalToken: token
        });
      }
      projectData.client = client._id;
    }

    // Opiekun projektu zawsze Jakub Czajka – nie z formularza
    if (projectData.offerType === 'final') {
      projectData.projectManager = { ...DEFAULT_PROJECT_MANAGER };
    }

    const project = new Project(projectData);
    // Init changelog
    project.changelog = [{
      action: 'create',
      fields: Object.keys(projectData || {}),
      author: req.user._id,
      createdAt: new Date()
    }];
    await project.save();

    try {
      await upsertFollowUpTask(project, req.user._id);
    } catch (e) {}

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

    // Sprawdź uprawnienia (twórca, owner lub admin może edytować)
    if (!canEditProject(project, req.user)) {
      return res.status(403).json({ message: 'Brak uprawnień do edycji tego projektu' });
    }

    // Prevent manual change to accepted status; must go via contract generation
    if (req.body.status === 'accepted') {
      delete req.body.status;
    }

    // Opiekun projektu zawsze Jakub Czajka – nie z formularza
    if (req.body.offerType === 'final') {
      req.body.projectManager = { ...DEFAULT_PROJECT_MANAGER };
    }

    const before = project.toObject();
    Object.assign(project, req.body);
    await project.save();

    // Usuń taski offer workflow przy statusie accepted/cancelled
    if (project.status === 'cancelled') {
      try {
        const { deleteOfferWorkflowTasks } = require('../utils/offerWorkflowTasks');
        await deleteOfferWorkflowTasks(project._id);
      } catch (e) {}
    }

    try {
      await upsertFollowUpTask(project, req.user._id);
    } catch (e) {}

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

    try {
      await completeCurrentAndCreateNextFollowUpTask(project, req.user._id);
    } catch (e) {}

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