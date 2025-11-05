const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  portalEnabled: { type: Boolean, default: true },
  portalToken: { type: String, index: true, unique: true, sparse: true },
}, { timestamps: true });

clientSchema.index({ name: 1 });

module.exports = mongoose.model('Client', clientSchema);


