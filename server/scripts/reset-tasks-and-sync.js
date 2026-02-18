/**
 * Jednorazowy skrypt: usuwa wszystkie zadania (Task), potem odtwarza zadania hostingu, follow-upy i offer workflow.
 * Follow-upy: jakub.czajka@soft-synergy.com. Offer workflow: info@ (wycena) / jakub.czajka (doprecyzowanie, oferta finalna).
 *
 * Uruchomienie: node server/scripts/reset-tasks-and-sync.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Hosting = require('../models/Hosting');
const User = require('../models/User');
const { upsertHostingPaymentTask } = require('../routes/hosting');
const { syncAllFollowUpTasks } = require('../utils/followUpTasks');
const { upsertToFinalEstimationTask, upsertClarificationTask, upsertPrepareFinalOfferTask } = require('../utils/offerWorkflowTasks');
const Project = require('../models/Project');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const deleted = await Task.deleteMany({});
    console.log('[Tasks] Usunięto zadań:', deleted.deletedCount);

    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id').lean();
    const userId = admin?._id;

    const hostings = await Hosting.find({
      nextPaymentDate: { $exists: true, $ne: null },
      status: { $nin: ['cancelled'] }
    }).lean();
    for (const h of hostings) {
      const hosting = await Hosting.findById(h._id);
      if (hosting) await upsertHostingPaymentTask(hosting, userId);
    }
    console.log('[Tasks] Odtworzono zadań hostingu:', hostings.length);

    await syncAllFollowUpTasks(userId);
    const followUpCount = await Task.countDocuments({ 'source.kind': 'followup' });
    console.log('[Tasks] Odtworzono zadań follow-up:', followUpCount);

    const prelims = await Project.find({
      offerType: 'preliminary',
      status: { $in: ['to_final_estimation', 'active', 'to_prepare_final_offer'] }
    }).lean();
    let offerCount = 0;
    for (const p of prelims) {
      const project = await Project.findById(p._id);
      if (!project) continue;
      try {
        if (project.status === 'to_final_estimation') {
          await upsertToFinalEstimationTask(project, userId);
          offerCount++;
        } else if (project.status === 'active' && project.clarificationRequest?.text) {
          await upsertClarificationTask(project, userId);
          offerCount++;
        } else if (project.status === 'to_prepare_final_offer') {
          await upsertPrepareFinalOfferTask(project, userId);
          offerCount++;
        }
      } catch (e) {
        console.error('[Tasks] Offer workflow error for project', p._id, e.message);
      }
    }
    console.log('[Tasks] Odtworzono zadań offer workflow:', offerCount);

    console.log('Gotowe.');
  } catch (e) {
    console.error('Błąd:', e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
