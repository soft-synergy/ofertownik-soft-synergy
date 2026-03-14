const mongoose = require('mongoose');

const publicOrderSchema = new mongoose.Schema({
  /** Id ogłoszenia w serwisie Biznes Polska – unikalny, zapobiega duplikatom */
  biznesPolskaId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  /** Kategoria: przetarg, zlecenie, inwestycja, dotacja, kupno, oferta, pozwolenie */
  category: { type: String, trim: true },
  /** Data dodania oferty (z listy) */
  addedDate: { type: Date, default: null },
  /** Przedmiot ogłoszenia / tytuł */
  title: { type: String, required: true, trim: true },
  /** Link do ogłoszenia na biznes-polska.pl */
  detailUrl: { type: String, trim: true },
  /** Województwo */
  region: { type: String, trim: true },
  /** Termin składania (jeśli podany na liście) */
  submissionDeadline: { type: Date, default: null },

  // Szczegóły z strony ogłoszenia
  /** Inwestor / zamawiający */
  investor: { type: String, trim: true },
  /** Adres */
  address: { type: String, trim: true },
  /** Województwo / powiat (pełny opis) */
  voivodeshipDistrict: { type: String, trim: true },
  /** Państwo */
  country: { type: String, trim: true },
  /** NIP */
  nip: { type: String, trim: true },
  /** Telefon / fax */
  phoneFax: { type: String, trim: true },
  /** E-mail */
  email: { type: String, trim: true },
  /** Strona www */
  website: { type: String, trim: true },
  /** Opis */
  description: { type: String, trim: true },
  /** Wymagania (warunki udziału itd.) */
  requirements: { type: String, trim: true },
  /** Miejsce i termin składania ofert */
  submissionPlaceAndDeadline: { type: String, trim: true },
  /** Miejsce i termin realizacji */
  placeAndTerm: { type: String, trim: true },
  /** Uwagi */
  remarks: { type: String, trim: true },
  /** Kontakt (blok tekstowy) */
  contact: { type: String, trim: true },
  /** Źródło */
  source: { type: String, trim: true },
  /** Branże (np. oprogramowanie - usługi specjalistyczne) */
  branches: [{ type: String, trim: true }],
  /** Link do oryginalnej treści ogłoszenia (jeśli jest) */
  originalContentUrl: { type: String, trim: true },
  /** Status ogłoszenia (np. aktualne) */
  offerStatus: { type: String, trim: true },

  /** Pełna treść strony szczegółowej w formie tekstowej – wszystkie dane (do oceny AI) */
  detailFullText: { type: String, default: '' },
  /** Surowy HTML sekcji ogłoszenia (article.offer-sheet) – cała strona szczegółów, nic nie pominięte */
  detailRawHtml: { type: String, default: '' },

  // ─── AI Analysis ───
  /** pending = nie analizowane, rejected = odrzucone (czerwone), candidate = potencjalnie pasujące (pomarańczowe), scored = ocenione z punktacją */
  aiStatus: {
    type: String,
    enum: ['pending', 'rejected', 'candidate', 'scored'],
    default: 'pending'
  },
  /** Wynik 1-10 (tylko dla scored) */
  aiScore: { type: Number, default: null, min: 1, max: 10 },
  /** Uzasadnienie AI (krótka analiza) */
  aiAnalysis: { type: String, default: '' },
  /** Powód odrzucenia (dla rejected) */
  aiRejectionReason: { type: String, default: '' },
  /** Kiedy AI przetworzył batch-filter */
  aiBatchProcessedAt: { type: Date, default: null },
  /** Kiedy AI przydzielił score */
  aiScoredAt: { type: Date, default: null }
}, {
  timestamps: true
});

publicOrderSchema.index({ biznesPolskaId: 1 }, { unique: true });
publicOrderSchema.index({ addedDate: -1 });
publicOrderSchema.index({ region: 1 });
publicOrderSchema.index({ aiStatus: 1 });
publicOrderSchema.index({ aiScore: -1 });

module.exports = mongoose.model('PublicOrder', publicOrderSchema);
