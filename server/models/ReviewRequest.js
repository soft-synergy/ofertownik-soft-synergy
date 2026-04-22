const mongoose = require('mongoose');

const reviewEmailLogSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['initial', 'followup_1', 'followup_2', 'followup_3', 'manual_reminder'],
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  subject: {
    type: String,
    default: ''
  }
}, { _id: false });

const reviewResponseSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['testimonial', 'feedback_only'],
    default: 'testimonial'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  likelyToRecommend: {
    type: Number,
    min: 0,
    max: 10,
    default: null
  },
  testimonial: {
    type: String,
    default: ''
  },
  whatWorkedWell: {
    type: String,
    default: ''
  },
  whatCanBeImproved: {
    type: String,
    default: ''
  },
  clientName: {
    type: String,
    default: ''
  },
  clientRole: {
    type: String,
    default: ''
  },
  companyName: {
    type: String,
    default: ''
  },
  allowPublicUse: {
    type: Boolean,
    default: false
  },
  respondedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const reviewRequestSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  clientName: {
    type: String,
    default: '',
    trim: true
  },
  companyName: {
    type: String,
    default: '',
    trim: true
  },
  projectName: {
    type: String,
    default: '',
    trim: true
  },
  sourceLabel: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'responded', 'declined', 'paused', 'archived'],
    default: 'pending',
    index: true
  },
  followUpStep: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  nextFollowUpAt: {
    type: Date,
    default: null,
    index: true
  },
  lastEmailSentAt: {
    type: Date,
    default: null
  },
  emailLogs: {
    type: [reviewEmailLogSchema],
    default: []
  },
  response: {
    type: reviewResponseSchema,
    default: () => ({})
  },
  internalTags: {
    type: [String],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReviewRequest', reviewRequestSchema);
