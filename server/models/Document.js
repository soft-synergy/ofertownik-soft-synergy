const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['document', 'playbook'],
    default: 'document',
    index: true
  },
  /** Unikalny slug do publicznego URL: /dokumenty/:slug */
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true
  },
  /** Pełna treść HTML – wyświetlana publicznie */
  content: {
    type: String,
    default: '',
    trim: false
  },
  summary: {
    type: String,
    default: '',
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
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

documentSchema.index({ slug: 1 });
documentSchema.index({ type: 1, updatedAt: -1 });
documentSchema.index({ tags: 1 });

module.exports = mongoose.model('Document', documentSchema);
