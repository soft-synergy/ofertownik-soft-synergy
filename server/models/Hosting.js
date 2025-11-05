const mongoose = require('mongoose');

const hostingSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false,
    index: true
  },
  clientEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  clientPhone: {
    type: String,
    trim: true
  },
  monthlyPrice: {
    type: Number,
    required: true,
    min: 0
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  nextPaymentDate: {
    type: Date,
    required: true
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'overdue', 'suspended', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    default: ''
  },
  paymentHistory: [{
    amount: { type: Number, required: true },
    paidDate: { type: Date, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  reminders: [{
    sentAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['payment_due', 'overdue', 'suspension_warning'] },
    notes: { type: String, default: '' }
  }],
  suspendedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
hostingSchema.index({ status: 1, nextPaymentDate: 1 });
hostingSchema.index({ domain: 1 });

module.exports = mongoose.model('Hosting', hostingSchema);
