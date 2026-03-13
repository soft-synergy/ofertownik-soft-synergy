const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
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
    enum: ['development', 'consulting', 'hosting', 'maintenance', 'other'],
    default: 'development'
  },
  image: {
    type: String,
    default: null
  },
  priceMin: {
    type: Number,
    default: null
  },
  priceMax: {
    type: Number,
    default: null
  },
  priceLabel: {
    type: String,
    trim: true,
    default: ''
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

module.exports = mongoose.model('Service', serviceSchema);
