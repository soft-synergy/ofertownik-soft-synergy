const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., offer.generated, project.created
  entityType: { type: String, required: true }, // project, offer
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  message: { type: String, required: true },
  metadata: { type: Object, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('Activity', activitySchema);


