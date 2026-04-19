const mongoose = require('mongoose');

const documentFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  parentPath: {
    type: String,
    default: '',
    trim: true,
    index: true
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

documentFolderSchema.index({ path: 1 });
documentFolderSchema.index({ parentPath: 1, name: 1 });

module.exports = mongoose.model('DocumentFolder', documentFolderSchema);
