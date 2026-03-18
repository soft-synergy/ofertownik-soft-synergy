const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  /** Link do ogłoszenia / projektu (Upwork, portal itd.) */
  sourceUrl: {
    type: String,
    required: true,
    trim: true
  },
  /** Krótka nazwa / opis leada – np. tytuł ogłoszenia lub klienta */
  title: {
    type: String,
    required: true,
    trim: true
  },
  /** Platforma / portal – np. Upwork, Useme, inny */
  portal: {
    type: String,
    default: '',
    trim: true
  },
  /** Dodatkowe notatki od Rizki (np. dlaczego warto, wymagania) */
  notes: {
    type: String,
    default: '',
    trim: true
  },
  /** Status w prostym workflow */
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'offer_sent'],
    default: 'pending_review',
    index: true
  },
  /** Użytkownik, który dodał leada (Rizka lub inny) */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  /** Kto ocenił leada (admin) */
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewComment: {
    type: String,
    default: '',
    trim: true
  },
  /** Szczegóły wysłanej oferty przez Rizkę */
  offerDetails: {
    sentAt: { type: Date, default: null },
    /** Podsumowanie oferty / co wysłaliśmy */
    content: { type: String, default: '', trim: true },
    /** Opcjonalna wartość oferty w PLN */
    valuePln: { type: Number, default: null },
    /** Kanał wysyłki, np. Upwork, email */
    channel: { type: String, default: '', trim: true }
  },
  /** Flaga archiwum – odrzucone leady */
  archived: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

leadSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);

