const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientContact: {
    type: String,
    required: true,
    trim: true
  },
  clientEmail: {
    type: String,
    required: false,
    trim: true
  },
  clientPhone: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: function() {
      return this.offerType === 'final';
    }
  },
  mainBenefit: {
    type: String,
    required: function() {
      return this.offerType === 'final';
    },
    trim: true
  },
  modules: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: 'blue'
    }
  }],
  timeline: {
    phase1: {
      name: { type: String, default: 'Faza I: Discovery' },
      duration: { type: String, default: 'Tydzień 1-2' }
    },
    phase2: {
      name: { type: String, default: 'Faza II: Design & Prototyp' },
      duration: { type: String, default: 'Tydzień 3-4' }
    },
    phase3: {
      name: { type: String, default: 'Faza III: Development' },
      duration: { type: String, default: 'Tydzień 5-12' }
    },
    phase4: {
      name: { type: String, default: 'Faza IV: Testy i Wdrożenie' },
      duration: { type: String, default: 'Tydzień 13-14' }
    }
  },
  pricing: {
    phase1: { type: Number, default: 8000 },
    phase2: { type: Number, default: 0 },
    phase3: { type: Number, default: 56000 },
    phase4: { type: Number, default: 8000 },
    total: { type: Number, required: true }
  },
  offerType: {
    type: String,
    enum: ['final', 'preliminary'],
    default: 'final'
  },
  language: {
    type: String,
    enum: ['pl', 'en'],
    default: 'pl'
  },
  priceRange: {
    min: { type: Number, default: null },
    max: { type: Number, default: null }
  },
  projectManager: {
    name: {
      type: String,
      required: function() {
        return this.offerType === 'final';
      },
      trim: true
    },
    position: {
      type: String,
      default: 'Senior Project Manager'
    },
    email: {
      type: String,
      required: function() {
        return this.offerType === 'final';
      },
      trim: true
    },
    phone: {
      type: String,
      required: function() {
        return this.offerType === 'final';
      },
      trim: true
    },
    avatar: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: 'Z ponad 8-letnim doświadczeniem w prowadzeniu złożonych projektów IT, wierzę w transparentną komunikację i partnerskie relacje. Moim zadaniem jest nie tylko nadzór nad harmonogramem, ale przede wszystkim zapewnienie, że finalny produkt w 100% odpowiada Państwa wizji i celom biznesowym. Będę Państwa głównym punktem kontaktowym na każdym etapie współpracy.'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'accepted', 'completed', 'cancelled'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  offerNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  generatedOfferUrl: {
    type: String,
    default: null
  },
  contractPdfUrl: {
    type: String,
    default: null
  },
  pdfUrl: {
    type: String,
    default: null
  },
  workSummaryUrl: {
    type: String,
    default: null
  },
  workSummaryPdfUrl: {
    type: String,
    default: null
  },
  documents: [{
    type: {
      type: String,
      enum: ['proforma', 'vat'],
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  notes: [{
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  followUps: [{
    number: { type: Number, required: true },
    sentAt: { type: Date, required: true },
    note: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  }],
  followUpScheduleDays: {
    type: [Number],
    default: [4, 4, 7]
  },
  nextFollowUpDueAt: {
    type: Date,
    default: null
  },
  lastFollowUpReminderAt: {
    type: Date,
    default: null
  },
  customReservations: {
    type: [String],
    default: []
  },
  customPaymentTerms: {
    type: String,
    default: '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.'
  },
  consultationNotes: {
    type: String,
    default: ''
  },
  technologies: {
    stack: [{
      type: String,
      trim: true
    }],
    methodologies: [{
      type: String,
      trim: true
    }]
  },
  teamMembers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, default: 'member' }
  }],
  changelog: [{
    action: { type: String, required: true },
    fields: { type: [String], default: [] },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Generate offer number before saving
projectSchema.pre('save', async function(next) {
  if (!this.offerNumber && this.status === 'active') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count projects for this month
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, date.getMonth(), 1),
        $lt: new Date(year, date.getMonth() + 1, 1)
      }
    });
    
    this.offerNumber = `SS/${year}/${month}/${String(count + 1).padStart(2, '0')}`;
  }
  next();
});

// Calculate total price
projectSchema.pre('save', function(next) {
  if (this.pricing) {
    this.pricing.total = this.pricing.phase1 + this.pricing.phase2 + this.pricing.phase3 + this.pricing.phase4;
  }
  next();
});

// Calculate next follow-up due date based on schedule and number of follow-ups already sent
projectSchema.pre('save', function(next) {
  try {
    const maxFollowUps = 3;
    const numSent = Array.isArray(this.followUps) ? this.followUps.length : 0;
    if (this.status === 'accepted' || this.status === 'cancelled' || numSent >= maxFollowUps) {
      this.nextFollowUpDueAt = null;
      return next();
    }

    const schedule = Array.isArray(this.followUpScheduleDays) && this.followUpScheduleDays.length
      ? this.followUpScheduleDays
      : [4, 4, 7];

    // Cumulative days: e.g., [4,4,7] => [4,8,15]
    const cumulativeDays = schedule.reduce((acc, days, idx) => {
      const sum = (acc[idx - 1] || 0) + days;
      acc.push(sum);
      return acc;
    }, []);

    const baseDate = this.createdAt || new Date();
    const nextIndex = Math.min(numSent, cumulativeDays.length - 1);
    const daysToAdd = cumulativeDays[nextIndex];
    const dueDate = new Date(baseDate.getTime());
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    this.nextFollowUpDueAt = dueDate;
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model('Project', projectSchema); 