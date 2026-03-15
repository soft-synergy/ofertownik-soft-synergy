const mongoose = require('mongoose');

const publicOrderPromptsSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  sections: {
    intro: { type: String, default: '' },
    uslugi: { type: String, default: '' },
    odpadaja: { type: String, default: '' },
    mozemy: { type: String, default: '' },
    dopiski: { type: String, default: '' }
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PublicOrderPrompts', publicOrderPromptsSchema);
