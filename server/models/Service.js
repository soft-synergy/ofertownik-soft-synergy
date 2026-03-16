const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  namePl: { type: String, trim: true },
  nameEn: { type: String, trim: true },
  description: { type: String },
  descriptionPl: { type: String },
  descriptionEn: { type: String },
  priceLabel: { type: String, trim: true, default: '' },
  priceLabelPl: { type: String, trim: true, default: '' },
  priceLabelEn: { type: String, trim: true, default: '' },
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
  imagePl: { type: String, default: null },
  imageEn: { type: String, default: null },
  priceMin: {
    type: Number,
    default: null
  },
  priceMax: {
    type: Number,
    default: null
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
