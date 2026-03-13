const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Service = require('../models/Service');
const User = require('../models/User');

const services = [
  {
    name: 'Strona internetowa na WordPress',
    description: 'Projekt i wdrożenie nowoczesnej strony internetowej opartej na WordPressie, z panelem administracyjnym, responsywnym layoutem i optymalizacją pod SEO.',
    category: 'development',
    priceLabel: 'od 3 000 zł',
  },
  {
    name: 'Sklep internetowy na WooCommerce',
    description: 'Pełne wdrożenie sklepu internetowego na WooCommerce: konfiguracja produktów, płatności, wysyłek oraz optymalizacja procesu zakupowego.',
    category: 'development',
    priceLabel: 'od 5 000 zł',
  },
  {
    name: 'Sklep internetowy na Shopify',
    description: 'Konfiguracja i personalizacja sklepu na Shopify, integracje z płatnościami oraz dostosowanie motywu do identyfikacji wizualnej marki.',
    category: 'development',
    priceLabel: 'od 4 000 zł',
  },
  {
    name: 'Ustawienie formularzy na stronie WordPress',
    description: 'Projekt, konfiguracja i integracja formularzy kontaktowych, leadowych i zapisów na newsletter na stronie WordPress.',
    category: 'maintenance',
    priceLabel: 'od 500 zł',
  },
  {
    name: 'Integracja AI z n8n',
    description: 'Projekt i wdrożenie automatyzacji z wykorzystaniem AI w n8n: przepływy, integracje API oraz obsługa danych.',
    category: 'consulting',
    priceLabel: 'od 2 000 zł',
  },
  {
    name: 'Twój agent AI',
    description: 'Projekt i konfiguracja dedykowanego agenta AI dopasowanego do Twojego biznesu (obsługa klientów, wsparcie sprzedaży, automatyzacje).',
    category: 'consulting',
    priceLabel: 'wycena indywidualna',
  },
  {
    name: 'Integracja chatbota AI z Twoją stroną',
    description: 'Integracja chatbota AI z istniejącą stroną www, w tym osadzenie widgetu, konfiguracja przepływów i połączenie z backendem.',
    category: 'development',
    priceLabel: 'od 2 500 zł',
  },
  {
    name: 'Chatbot na Twojej stronie',
    description: 'Przygotowanie i wdrożenie chatbota na stronie internetowej: scenariusze rozmów, integracje z narzędziami oraz personalizacja wyglądu.',
    category: 'development',
    priceLabel: 'od 1 500 zł',
  },
  {
    name: 'Regulamin serwisu internetowego',
    description: 'Przygotowanie lub dostosowanie regulaminu serwisu internetowego we współpracy z prawnikiem oraz wdrożenie na stronie.',
    category: 'consulting',
    priceLabel: 'od 800 zł',
  },
  {
    name: 'Stała obsługa strony internetowej',
    description: 'Stała opieka nad stroną: aktualizacje, kopie bezpieczeństwa, drobne zmiany treści i wsparcie techniczne.',
    category: 'maintenance',
    priceLabel: 'od 400 zł / mc',
  },
  {
    name: 'Systemy CRM dopasowane do Twojego sposobu pracy',
    description: 'Analiza procesów w firmie, dobór i wdrożenie systemu CRM (lub budowa modułów custom), tak aby wspierał realny sposób pracy zespołu sprzedaży.',
    category: 'consulting',
    priceLabel: 'od 6 000 zł',
  },
  {
    name: 'Aplikacja mobilna szyta na Twoje potrzeby',
    description: 'Projekt i implementacja aplikacji mobilnej (Android / iOS) dopasowanej do Twojego biznesu, od prototypu po publikację w sklepach.',
    category: 'development',
    priceLabel: 'od 15 000 zł',
  },
  {
    name: 'Profesjonalna podstawowa strona wizytówka dla Twojej firmy',
    description: 'Lekka, szybka strona wizytówka z kluczowymi sekcjami (oferta, o nas, kontakt), przygotowana pod pierwsze kampanie marketingowe.',
    category: 'development',
    priceLabel: 'od 2 000 zł',
  },
  {
    name: 'Budowa scrapera Google',
    description: 'Projekt i wdrożenie scrapera Google dopasowanego do Twojego use-case’u (np. monitoring pozycji, zbieranie leadów, analiza konkurencji) z bezpiecznym obejściem limitów.',
    category: 'development',
    priceLabel: 'od 4 000 zł',
  },
  {
    name: 'Strony internetowe szyte na miarę',
    description: 'Indywidualnie projektowane strony internetowe z dopasowanym UX/UI, integracjami i zoptymalizowanym procesem pozyskiwania leadów.',
    category: 'development',
    priceLabel: 'od 6 000 zł',
  },
  {
    name: 'Optymalizacja strony internetowej PageSpeed Insights',
    description: 'Techniczna optymalizacja strony pod wyniki PageSpeed Insights (Core Web Vitals, LCP, CLS, TTFB) oraz realne przyspieszenie ładowania.',
    category: 'maintenance',
    priceLabel: 'od 1 500 zł',
  },
  {
    name: 'Aplikacje webowe szyte na miarę',
    description: 'Projekt i development dedykowanych aplikacji webowych (panele klienta, systemy wewnętrzne, konfiguratory) z naciskiem na skalowalność.',
    category: 'development',
    priceLabel: 'od 12 000 zł',
  },
  {
    name: 'Grafiki na bannery fizyczne i reklamy Digital Out Of Home (DOOH)',
    description: 'Projektowanie grafik na bannery outdoor oraz ekrany DOOH (różne formaty, wersje językowe, przygotowanie do druku / emisji).',
    category: 'other',
    priceLabel: 'od 800 zł',
  },
  {
    name: 'Projektowanie UX / UI – mockupy stron internetowych w Figma',
    description: 'Proces UX / UI od wireframe’ów po wysokiej jakości makiety w Figma, gotowe do wdrożenia przez zespół developerski.',
    category: 'other',
    priceLabel: 'od 3 000 zł',
  },
  {
    name: 'Publikacja aplikacji w Google Play',
    description: 'Przygotowanie paczki aplikacji, konfiguracja Google Play Console, polityk, listingów oraz przeprowadzenie procesu publikacji / aktualizacji.',
    category: 'maintenance',
    priceLabel: 'od 600 zł',
  },
];

async function seedServices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Połączono z bazą MongoDB');

    const adminUser = await User.findOne({ role: 'admin', isActive: true });
    if (!adminUser) {
      console.log('❌ Brak aktywnego admina. Najpierw uruchom skrypt create-admin.');
      process.exit(1);
    }

    console.log(`👤 Używam użytkownika: ${adminUser.email}`);

    let created = 0;
    let updated = 0;

    // Ustal bazową kolejność – kontynuuj po istniejących usługach
    const maxOrderDoc = await Service.findOne().sort({ order: -1 });
    let orderBase = maxOrderDoc ? maxOrderDoc.order + 1 : 0;

    for (const [index, item] of services.entries()) {
      const existing = await Service.findOne({ name: item.name });
      const data = {
        ...item,
        createdBy: adminUser._id,
      };

      if (!existing) {
        data.order = orderBase + index;
        const service = new Service(data);
        await service.save();
        console.log(`✅ Utworzono usługę: ${item.name}`);
        created++;
      } else {
        // Aktualizuj opis/cenę, ale nie nadpisuj order
        Object.assign(existing, data);
        await existing.save();
        console.log(`♻️ Zaktualizowano istniejącą usługę: ${item.name}`);
        updated++;
      }
    }

    const total = await Service.countDocuments();
    console.log('\n📊 Podsumowanie:');
    console.log(`   ✅ Utworzone: ${created}`);
    console.log(`   ♻️ Zaktualizowane: ${updated}`);
    console.log(`   📦 Łącznie usług w bazie: ${total}`);
  } catch (err) {
    console.error('❌ Błąd podczas seedowania usług:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Rozłączono z bazą');
    process.exit(0);
  }
}

seedServices();

