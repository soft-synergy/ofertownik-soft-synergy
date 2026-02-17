const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  /**
   * Optional: source entity that created/owns this task (e.g. hosting payment).
   * Used for automatic sync (upsert) with other modules.
   */
  source: {
    kind: { type: String, enum: ['hosting', 'followup', null], default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  dueDate: {
    type: Date,
    required: true
  },
  /** Optional: time of day in minutes from midnight (0–1439). If set, calendar shows task at this time. */
  dueTimeMinutes: {
    type: Number,
    default: null,
    min: 0,
    max: 1439
  },
  /** Optional: duration in minutes for calendar block. Default 60 if dueTimeMinutes set. */
  durationMinutes: {
    type: Number,
    default: 60,
    min: 1
  },
  /**
   * Recurring tasks support:
   * - Template tasks are hidden from default task lists (isRecurrenceTemplate=true)
   * - Instances have recurrenceParent pointing to the template task
   */
  isRecurrenceTemplate: {
    type: Boolean,
    default: false,
    index: true
  },
  recurrenceParent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
    index: true
  },
  recurrence: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', null], default: null },
    interval: { type: Number, default: 1, min: 1 },
    untilDate: { type: Date, default: null }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

taskSchema.index({ assignee: 1, dueDate: 1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
// Non-unique so many tasks can have source.kind = null. Hosting/followup uniqueness enforced in app (upsert).
taskSchema.index({ 'source.kind': 1, 'source.refId': 1 });

module.exports = mongoose.model('Task', taskSchema);
