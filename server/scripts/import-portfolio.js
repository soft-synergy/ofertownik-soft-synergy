const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

// Portfolio data to import
const portfolioItems = [
  {
    title: "EPH Polska",
    description: "Rozbudowana platforma online z automatyzacją procesów sprzedażowych i algorytmami AI. System integruje prognozowanie i personalizację ofert.",
    category: "web",
    technologies: ["Nuxt.js", "Laravel", "AI", "Automatyzacja"],
    image: "/images/eph-polska.png",
    projectLink: "http://ephpolska.pl/",
    isActive: true,
    order: 1,
  },
  {
    title: "Tylko Zdalnie",
    description: "Praktyczna strona internetowa do zarządzania ofertami pracy zdalnej z intuicyjnym panelem administratora.",
    category: "web",
    technologies: ["WordPress", "Panel Admin", "Zarządzanie treścią"],
    image: "/images/tylko-zdalnie.png",
    projectLink: "https://tylkozdalnie.pl/",
    isActive: true,
    order: 2,
  },
  {
    title: "Gorkowski",
    description: "W pełni spersonalizowana strona dla firmy tekstylnej z customizacją motywu i funkcjonalności dopasowaną do branży.",
    category: "web",
    technologies: ["WordPress", "Custom Theme", "Optymalizacja"],
    image: "/images/gorkowski.png",
    projectLink: "https://realizacje.soft-synergy.com/gorkowski/",
    isActive: true,
    order: 3,
  },
  {
    title: "Ligustrowa",
    description: "Strona dla dewelopera z konfiguratorem domów umożliwiającym klientom dostosowanie projektów i kalkulację kosztów.",
    category: "web",
    technologies: ["Konfigurator", "Kalkulator", "UX/UI"],
    image: "/images/ligustrowa.png",
    projectLink: "http://ligustrowa15.pl/",
    isActive: true,
    order: 4,
  },
  {
    title: "Polens Bike",
    description: "Rozbudowany sklep internetowy z rowerami, zaawansowanymi filtrami, konfiguratorami produktów i integracjami płatności.",
    category: "web",
    technologies: ["WordPress", "WooCommerce", "Filtry", "Integracje"],
    image: "/images/polens-bike.png",
    projectLink: "https://polens.bike/",
    isActive: true,
    order: 5,
  },
  {
    title: "Gemora",
    description: "Elegancki sklep z biżuterią z personalizacją wyglądu, niestandardowymi kartami produktów i nowoczesnym designem.",
    category: "web",
    technologies: ["WordPress", "WooCommerce", "Luxury Design"],
    image: "/images/gemora.png",
    projectLink: "https://gemora.pl/",
    isActive: true,
    order: 6,
  },
  {
    title: "Data Logistix",
    description: "Nowoczesna strona wykonana w standardzie pixel perfect z przejrzystą strukturą podkreślającą profesjonalny charakter marki.",
    category: "web",
    technologies: ["WordPress", "Pixel Perfect", "Corporate"],
    image: "/images/data-logistix.png",
    projectLink: "https://datalogistix-studio.com/",
    isActive: true,
    order: 7,
  },
  {
    title: "LMS Sisoft",
    description: "Prosty system e-learningowy umożliwiający tworzenie kursów, testów i certyfikatów z intuicyjnym panelem zarządzania.",
    category: "web",
    technologies: ["WordPress", "TutorLMS", "E-learning"],
    image: "/images/lms-sisoft.png",
    projectLink: "#",
    isActive: true,
    order: 8,
  },
  {
    title: "Mimo Decor",
    description: "Stylowa strona dla branży dekoracji wnętrz z zintegrowanym feedem Instagram automatycznie wyświetlającym najnowsze posty.",
    category: "web",
    technologies: ["WordPress", "Instagram API", "Visual Design"],
    image: "/images/mimo-decor.png",
    projectLink: "http://mimodecor.pl/",
    isActive: true,
    order: 9,
  },
  {
    title: "Ciszum",
    description: "Strona fundacji z naciskiem na dostępność (WCAG) i modułem zapisów online na wydarzenia i warsztaty społeczne.",
    category: "web",
    technologies: ["WordPress", "Accessibility", "WCAG", "Zapisy Online"],
    image: "/images/ciszum.png",
    projectLink: "https://ciszum.pl/",
    isActive: true,
    order: 10,
  },
  {
    title: "PaniOdKredytów",
    description: "Lejek sprzedażowy zintegrowany z WebinarJam umożliwiający zapisy na webinary i automatyczne przypomnienia.",
    category: "web",
    technologies: ["WordPress", "WebinarJam", "Sales Funnel"],
    image: "/images/paniodkredytow.png",
    projectLink: "https://zapisy.paniodkredytow.pl/",
    isActive: true,
    order: 11,
  },
  {
    title: "LODF Konkurs",
    description: "Dedykowany system konkursowy na miarę z panelem administracyjnym, moderacją i automatycznym wyłanianiem zwycięzców.",
    category: "api",
    technologies: ["Laravel", "Custom System", "Admin Panel"],
    image: "/images/lofd.png",
    projectLink: "http://lofd.pl/",
    isActive: true,
    order: 12,
  },
  {
    title: "ElitePartner",
    description: "Restrukturyzacja i migracja platformy Moodle z tradycyjnego hostingu na dedykowany VPS z optymalizacją wydajności i bezpieczeństwa.",
    category: "web",
    technologies: ["Moodle", "VPS Migration", "Optymalizacja", "Bezpieczeństwo"],
    image: "/images/elitepartner.png",
    projectLink: "http://elitepartner-kursy.soft-synergy.com/",
    isActive: true,
    order: 13,
  },
  {
    title: "Sprzedaż Batików",
    description: "Kompleksowy lejek sprzedażowy dla sklepu z batikami z automatyzacją follow-upów i integracją płatności.",
    category: "web",
    technologies: ["WordPress", "Sales Funnel", "Automatyzacja", "Płatności"],
    image: "/images/batik.png",
    projectLink: "https://realizacje.soft-synergy.com/batik/",
    isActive: true,
    order: 14,
  },
  {
    title: "Drukarki - Porównanie Produktów",
    description: "Zaawansowana strona porównująca drukarki z modułem porównania produktów i integracją z systemem leasingowym.",
    category: "web",
    technologies: ["WordPress", "Porównanie Produktów", "Leasing", "Kalkulator"],
    image: "/images/copy-system.png",
    projectLink: "https://realizacje.soft-synergy.com/copy-system",
    isActive: true,
    order: 15,
  },
  {
    title: "SiteSculpt",
    description: "Zaawansowany generator AI do tworzenia wysoko konwertujących landing page'y z automatyczną optymalizacją pod kampanie marketingowe.",
    category: "api",
    technologies: ["Nuxt.js", "Express.js", "AI Generator", "Landing Pages"],
    image: "/images/sitesculpt.png",
    projectLink: "https://sitesculpt.soft-synergy.com/",
    isActive: true,
    order: 16,
  },
  {
    title: "MarryME",
    description: "Kompleksowy projekt graficzny dla wypożyczalni ślubnej obejmujący identyfikację wizualną, UI/UX oraz materiały marketingowe.",
    category: "other",
    technologies: ["Figma", "UI/UX Design", "Branding", "Identyfikacja Wizualna"],
    image: "/images/marryme.png",
    projectLink: "https://www.figma.com/design/uugV7ZRl5Gc0RbfqrgEKP8/MarryME",
    isActive: true,
    order: 17,
  },
  {
    title: "System Synchronizacji BaseLinker",
    description: "Autorski framework do szybkiej integracji dowolnego API z BaseLinker. System umożliwia dwukierunkową synchronizację zamówień, stanów magazynowych i produktów w czasie rzeczywistym.",
    category: "api",
    technologies: ["Node.js", "BaseLinker API", "Custom Framework", "Real-time Sync"],
    image: "/images/baselinker.png",
    projectLink: "/baselinker",
    isActive: true,
    order: 18,
  },
  {
    title: "Warta Event",
    description: "Strona wydarzenia z przejrzystą agendą, sekcją sponsorów oraz formularzem kontaktu/zapisów. Lekki, szybki landing dopasowany pod kampanie.",
    category: "web",
    technologies: ["WordPress", "Landing Page", "Event"],
    image: "/images/warta-event.png",
    projectLink: "https://realizacje.soft-synergy.com/warta-event-strona/",
    isActive: true,
    order: 19,
  },
  {
    title: "Ofertownik",
    description: "Autorski program do zarządzania ofertami: tworzenie i edycja ofert, wersjonowanie, statusy i pipeline, generowanie PDF oraz udostępnianie linków do klienta.",
    category: "other",
    technologies: ["Custom System", "Panel Admin", "Automatyzacja", "Oferty"],
    image: "/images/ofertownik.png",
    projectLink: "https://ofertownik.soft-synergy.com/",
    isActive: true,
    order: 20,
  },
  {
    title: "Sky Tower",
    description: "Stała obsługa i utrzymanie serwisu skytower.pl: aktualizacje, poprawki wydajności i bezpieczeństwa oraz wsparcie redakcyjne.",
    category: "web",
    technologies: ["WordPress", "Maintenance", "Optymalizacja", "Bezpieczeństwo"],
    image: "/images/skytower.png",
    projectLink: "https://skytower.pl/",
    isActive: true,
    order: 21,
  },
  {
    title: "Mój Wynajem",
    description: "Wdrożenie kilku prostych zmian i poprawek na portalu wynajmu nieruchomości z naciskiem na UX i wydajność.",
    category: "web",
    technologies: ["WordPress", "UX/UI", "Poprawki", "Nieruchomości"],
    image: "/images/mojwynajem.png",
    projectLink: "https://mojwynajem.pl/",
    isActive: true,
    order: 22,
  },
];

async function importPortfolio() {
  try {
    // Połączenie z bazą danych
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Połączono z bazą danych MongoDB');

    // Znajdź pierwszego użytkownika admina dla createdBy
    const adminUser = await User.findOne({ role: 'admin', isActive: true });
    
    if (!adminUser) {
      console.log('❌ Nie znaleziono aktywnego użytkownika admina!');
      console.log('💡 Utwórz użytkownika admina używając: npm run create-admin');
      process.exit(1);
    }

    console.log(`👤 Używam użytkownika: ${adminUser.email} (${adminUser.firstName} ${adminUser.lastName})`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Importuj każdy element portfolio
    for (const itemData of portfolioItems) {
      try {
        // Sprawdź czy element już istnieje (po tytule)
        const existing = await Portfolio.findOne({ title: itemData.title });
        
        if (existing) {
          console.log(`⏭️  Pominięto: "${itemData.title}" (już istnieje)`);
          skipped++;
          continue;
        }

        // Utwórz nowy element portfolio
        const portfolio = new Portfolio({
          ...itemData,
          createdBy: adminUser._id
        });

        await portfolio.save();
        console.log(`✅ Zaimportowano: "${itemData.title}" (kategoria: ${itemData.category}, kolejność: ${itemData.order})`);
        imported++;

      } catch (error) {
        console.error(`❌ Błąd przy imporcie "${itemData.title}":`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Podsumowanie importu:');
    console.log(`   ✅ Zaimportowano: ${imported}`);
    console.log(`   ⏭️  Pominięto: ${skipped}`);
    console.log(`   ❌ Błędy: ${errors}`);
    console.log(`   📦 Łącznie elementów w bazie: ${await Portfolio.countDocuments()}`);

  } catch (error) {
    console.error('❌ Błąd podczas importu portfolio:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Rozłączono z bazą danych');
    process.exit(0);
  }
}

// Uruchom import
importPortfolio();
