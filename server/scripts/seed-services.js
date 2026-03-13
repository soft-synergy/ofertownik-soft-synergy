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
  {
    name: 'Audyt architektury aplikacji webowej',
    description: 'Dogłębny przegląd architektury istniejącej aplikacji (kod, baza, infrastructure as code) z listą konkretnych rekomendacji zmian.',
    category: 'consulting',
    priceLabel: 'od 4 000 zł',
  },
  {
    name: 'Migracja monolitu do mikroserwisów',
    description: 'Przygotowanie strategii i wdrożenie etapowej migracji monolitu do architektury mikroserwisowej z minimalnym przestojem.',
    category: 'development',
    priceLabel: 'od 25 000 zł',
  },
  {
    name: 'Projekt i wdrożenie design systemu w Figma + React',
    description: 'Stworzenie spójnego design systemu (Figma) oraz biblioteki komponentów w React/Storybook dla całej organizacji.',
    category: 'development',
    priceLabel: 'od 18 000 zł',
  },
  {
    name: 'Implementacja CI/CD dla aplikacji Node.js',
    description: 'Konfiguracja pipeline’ów CI/CD (GitHub Actions / GitLab CI) z automatycznymi testami, buildem i wdrożeniem na serwer / chmurę.',
    category: 'maintenance',
    priceLabel: 'od 5 000 zł',
  },
  {
    name: 'Hardening bezpieczeństwa aplikacji webowej',
    description: 'Przegląd bezpieczeństwa (nagłówki, autoryzacja, uprawnienia, dane wrażliwe) i wdrożenie konkretnych poprawek.',
    category: 'maintenance',
    priceLabel: 'od 6 000 zł',
  },
  {
    name: 'Monitoring i alerting dla aplikacji produkcyjnej',
    description: 'Wdrożenie monitoringu (np. Grafana/Prometheus/Elastic) z metrykami, logami i alertami pod aplikację produkcyjną.',
    category: 'maintenance',
    priceLabel: 'od 7 000 zł',
  },
  {
    name: 'Integracja systemu płatności (Stripe/Przelewy24)',
    description: 'Projekt i wdrożenie pełnej integracji płatności online z obsługą webhooków, zwrotów oraz subskrypcji.',
    category: 'development',
    priceLabel: 'od 3 500 zł',
  },
  {
    name: 'Portal klienta z dostępem do dokumentów i faktur',
    description: 'Budowa panelu klienta z logowaniem, historią współpracy, fakturami, ofertami i możliwością zgłaszania ticketów.',
    category: 'development',
    priceLabel: 'od 10 000 zł',
  },
  {
    name: 'System rezerwacji online z płatnościami',
    description: 'Dedykowany system rezerwacji (kalendarz, sloty, limity, płatności) dopasowany do Twojej branży (beauty, med, usługi).',
    category: 'development',
    priceLabel: 'od 12 000 zł',
  },
  {
    name: 'Automatyzacja backoffice z użyciem n8n i AI',
    description: 'Zaprojektowanie przepływów n8n do automatyzacji zadań backoffice (faktury, CRM, maile) z wykorzystaniem modeli AI do klasyfikacji.',
    category: 'consulting',
    priceLabel: 'od 5 000 zł',
  },
  {
    name: 'System powiadomień (e-mail / SMS / push) dla aplikacji',
    description: 'Projekt i wdrożenie warstwy notyfikacji (kolejki, retry, preferencje użytkownika) z integracją z zewnętrznymi providerami.',
    category: 'development',
    priceLabel: 'od 8 000 zł',
  },
  {
    name: 'Audyt wydajności bazy danych',
    description: 'Analiza zapytań, indeksów i struktury bazy (PostgreSQL/Mongo/MySQL) wraz z planem optymalizacji.',
    category: 'consulting',
    priceLabel: 'od 4 500 zł',
  },
  {
    name: 'Refaktoryzacja legacy frontendu do React/Next.js',
    description: 'Stopniowa migracja legacy frontendu (np. jQuery/PHP) do nowoczesnego stosu React/Next.js.',
    category: 'development',
    priceLabel: 'od 20 000 zł',
  },
  {
    name: 'Panel analityczny i dashboard KPI dla zarządu',
    description: 'Zaprojektowanie dashboardu KPI (finanse, sprzedaż, marketing) zasilanego z istniejących systemów.',
    category: 'development',
    priceLabel: 'od 9 000 zł',
  },
  {
    name: 'Integracja z marketplace (Allegro/Amazon) przez BaseLinker',
    description: 'Implementacja integracji z marketplace’ami z użyciem BaseLinker lub bezpośrednich API, wraz z synchronizacją stanów.',
    category: 'development',
    priceLabel: 'od 7 000 zł',
  },
  {
    name: 'Warsztat discovery produktu cyfrowego',
    description: 'Intensywny warsztat z zespołem, podczas którego precyzujemy zakres, persony, roadmapę i MVP produktu.',
    category: 'consulting',
    priceLabel: 'od 3 500 zł',
  },
  {
    name: 'Proof of Concept z wykorzystaniem generatywnego AI',
    description: 'Szybkie MVP funkcji opartej o generatywne AI (np. podsumowania, generowanie treści, QA) dla konkretnego procesu biznesowego.',
    category: 'development',
    priceLabel: 'od 6 000 zł',
  },
  {
    name: 'System ticketowy dla zespołu supportu',
    description: 'Budowa prostego systemu obsługi zgłoszeń (ticketów) z priorytetami, SLA, komentarzami i raportami.',
    category: 'development',
    priceLabel: 'od 9 000 zł',
  },
  {
    name: 'Onboarding techniczny nowego zespołu developerskiego',
    description: 'Przygotowanie dokumentacji, warsztatów i sesji Q&A dla nowego zespołu dev, który przejmuje Twój system.',
    category: 'consulting',
    priceLabel: 'od 3 000 zł',
  },
  {
    name: 'Migracja aplikacji do chmury (AWS/GCP/Azure)',
    description: 'Analiza, projekt i przeprowadzenie migracji aplikacji z serwera on‑premise lub VPS do chmury publicznej.',
    category: 'development',
    priceLabel: 'od 18 000 zł',
  },
  {
    name: 'Stała obsługa devopsowa infrastruktury',
    description: 'Miesięczny pakiet wsparcia DevOps: monitoring, aktualizacje, reagowanie na incydenty, optymalizacja kosztów chmury.',
    category: 'maintenance',
    priceLabel: 'od 2 500 zł / mc',
  },
  {
    name: 'Testy automatyczne end-to-end (Cypress/Playwright)',
    description: 'Projekt i implementacja pakietu testów E2E krytycznych ścieżek aplikacji w Cypress lub Playwright.',
    category: 'development',
    priceLabel: 'od 6 000 zł',
  },
  {
    name: 'Audyt dostępności WCAG 2.1 dla serwisu',
    description: 'Sprawdzenie serwisu pod kątem WCAG 2.1 oraz przygotowanie listy poprawek i rekomendacji wdrożeniowych.',
    category: 'consulting',
    priceLabel: 'od 4 000 zł',
  },
  {
    name: 'Landing page kampanii performance z testami A/B',
    description: 'Stworzenie landing page’a pod konkretną kampanię + konfiguracja eksperymentów A/B i analityki.',
    category: 'development',
    priceLabel: 'od 5 000 zł',
  },
  {
    name: 'Migracja danych pomiędzy systemami (ETL)',
    description: 'Jednorazowa lub cykliczna migracja danych pomiędzy systemami (mapowanie, walidacja, logowanie błędów).',
    category: 'development',
    priceLabel: 'od 7 000 zł',
  },
  {
    name: 'Konsultacje CTO as a Service',
    description: 'Regularne wsparcie technologiczne dla zarządu/foundera (strategie techniczne, wybór stacku, rekrutacja dev).',
    category: 'consulting',
    priceLabel: 'od 2 000 zł / mc',
  },
  {
    name: 'Widget kalkulatora kosztów na stronę',
    description: 'Projekt i implementacja interaktywnego kalkulatora kosztów (np. usług, subskrypcji) do osadzenia na stronie.',
    category: 'development',
    priceLabel: 'od 3 500 zł',
  },
  {
    name: 'Personalizowany moduł rekomendacji produktów z AI',
    description: 'Wdrożenie modułu rekomendacji produktów/usług opartego na zachowaniu użytkowników i modelach AI.',
    category: 'development',
    priceLabel: 'od 9 000 zł',
  },
  {
    name: 'Szkolenie zespołu z wykorzystania narzędzi AI w codziennej pracy',
    description: 'Praktyczne szkolenie dla zespołu (marketing, sprzedaż, ops) z wykorzystania AI do usprawnienia codziennych zadań.',
    category: 'consulting',
    priceLabel: 'od 3 500 zł',
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

