const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  name: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    default: 'landing_page'
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'invited', 'registered'],
    default: 'pending'
  },
  notifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
waitlistSchema.index({ email: 1 });
waitlistSchema.index({ status: 1 });
waitlistSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);

