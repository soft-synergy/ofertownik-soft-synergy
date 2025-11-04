const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['web', 'mobile', 'desktop', 'api', 'other'],
    default: 'web'
  },
  technologies: [{
    type: String,
    trim: true
  }],
  image: {
    type: String,
    required: true
  },
  client: {
    type: String,
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  results: {
    type: String,
    trim: true
  },
  projectLink: {
    type: String,
    trim: true
  },
  apiLink: {
    type: String,
    trim: true
  },
  documentationLink: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Portfolio', portfolioSchema); 