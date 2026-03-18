const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

documentSchema.index({ slug: 1 });

module.exports = mongoose.model('Document', documentSchema);
