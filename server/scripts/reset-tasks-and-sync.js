/**
 * Jednorazowy skrypt: usuwa wszystkie zadania (Task), potem odtwarza zadania hostingu i follow-upy.
 * Follow-upy są przypisywane do użytkownika jakub.czajka@soft-synergy.com (ustawione w utils/followUpTasks.js).
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

    console.log('Gotowe.');
  } catch (e) {
    console.error('Błąd:', e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
