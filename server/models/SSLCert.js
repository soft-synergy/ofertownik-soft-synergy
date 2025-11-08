const mongoose = require('mongoose');

const sslCertSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true, trim: true, index: true },
  certificatePath: { type: String, default: null },
  
  // Certificate details
  issuer: { type: String, default: null },
  subject: { type: String, default: null },
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null },
  daysUntilExpiry: { type: Number, default: null },
  
  // Status
  status: { 
    type: String, 
    enum: ['valid', 'expiring_soon', 'expired', 'not_found', 'error'], 
    default: 'unknown' 
  },
  isExpiringSoon: { type: Boolean, default: false },
  isExpired: { type: Boolean, default: false },
  
  // Monitoring
  lastCheckedAt: { type: Date, default: null },
  lastRenewedAt: { type: Date, default: null },
  lastRenewalError: { type: String, default: null },
  checkCount: { type: Number, default: 0 },
  renewalCount: { type: Number, default: 0 },
  
  // Auto-renewal settings
  autoRenew: { type: Boolean, default: true },
  renewalThreshold: { type: Number, default: 30 }, // Renew if expires in less than 30 days
  lastError: { type: String, default: null },
  
  // Notification
  alarmActive: { type: Boolean, default: false },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

sslCertSchema.index({ domain: 1 }, { unique: true });
sslCertSchema.index({ status: 1 });
sslCertSchema.index({ validTo: 1 });
sslCertSchema.index({ isExpiringSoon: 1 });

module.exports = mongoose.model('SSLCert', sslCertSchema);

