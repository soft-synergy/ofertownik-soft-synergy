const mongoose = require('mongoose');

const hostingMonitorSchema = new mongoose.Schema({
  hosting: { type: mongoose.Schema.Types.ObjectId, ref: 'Hosting', required: true, index: true },
  url: { type: String, required: true, trim: true },

  // current status
  isDown: { type: Boolean, default: false },
  downSince: { type: Date, default: null },
  lastCheckedAt: { type: Date, default: null },
  lastStatusCode: { type: Number, default: null },
  lastResponseTimeMs: { type: Number, default: null },
  lastError: { type: String, default: null },
  lastHtmlPath: { type: String, default: null },

  // alarm lifecycle
  alarmActive: { type: Boolean, default: false },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

hostingMonitorSchema.index({ hosting: 1 }, { unique: true });

module.exports = mongoose.model('HostingMonitor', hostingMonitorSchema);


