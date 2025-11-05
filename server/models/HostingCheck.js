const mongoose = require('mongoose');

const hostingCheckSchema = new mongoose.Schema({
  hosting: { type: mongoose.Schema.Types.ObjectId, ref: 'Hosting', required: true, index: true },
  url: { type: String, required: true },
  ok: { type: Boolean, required: true },
  statusCode: { type: Number, default: null },
  responseTimeMs: { type: Number, default: null },
  error: { type: String, default: null },
  htmlPath: { type: String, default: null }
}, { timestamps: true });

hostingCheckSchema.index({ hosting: 1, createdAt: -1 });

module.exports = mongoose.model('HostingCheck', hostingCheckSchema);


