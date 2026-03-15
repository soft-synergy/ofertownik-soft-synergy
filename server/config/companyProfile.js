/**
 * Profil firmy dla AI (analiza zleceń publicznych).
 * Wszystkie trzy fazy (batch filter, scoring, deep analysis) uczą się z tego opisu.
 * Sekcje można edytować w UI (Zlecenia publiczne → Prompty) – zapis w DB nadpisuje domyślne.
 */

let memoryCache = null;

const sections = {
  // Krótkie „kim jesteśmy” – używane na początku każdego promptu
  intro: `Jesteśmy firmą zajmującą się projektowaniem oraz wdrażaniem stron internetowych, systemów webowych oraz materiałów graficznych dla firm i instytucji publicznych. Na razie szukamy zleceń entry level: strony internetowe, aplikacje mobilne, certyfikaty SSL, grafiki, identyfikacje wizualne, posty na social media – do 120 000 PLN. Specjalizujemy się w nowoczesnych interfejsach, serwisach informacyjnych, landing page i portalach.`,

  // Co robimy – zakres usług
  uslugi: `Zakres naszych usług:
- projektowanie graficzne (UI/UX) serwisów internetowych i aplikacji
- tworzenie stron internetowych i portali informacyjnych
- wdrożenia CMS (WordPress, WooCommerce i inne systemy zarządzania treścią)
- projektowanie identyfikacji wizualnej oraz materiałów graficznych
- modernizację i redesign istniejących serwisów
- tworzenie landing page i stron kampanijnych
- przygotowanie stron zgodnych z WCAG
- optymalizację wydajności i SEO dla stron internetowych
- integracje stron internetowych z zewnętrznymi API oraz systemami informatycznymi
- sprzedaż certyfikatów SSL – odsprzedajemy certyfikaty od dużych dostawców (m.in. GoDaddy i podobne firmy), bez własnej infrastruktury CA
- social media i content na social media (treści, posty, prowadzenie profili)`,

  // Zamówienia, na które NIE startujemy (AI ma je odrzucać lub nisko punktować)
  odpadaja: `AUTOMATYCZNIE ODPADAJĄ zamówienia wymagające:
- autoryzacji producenta konkretnego systemu informatycznego
- licencji na serwisowanie zamkniętych systemów uczelnianych/administracyjnych (USOS, ERP, dedykowane systemy dziedzinowe)
- certyfikacji partnera producenta oprogramowania
- utrzymania infrastruktury IT lub zarządzania serwerownią
- dostawy sprzętu komputerowego lub infrastruktury sieciowej
- wdrożeń dużych systemów ERP, CRM lub systemów finansowo-księgowych
- wieloletniego doświadczenia w utrzymaniu systemów dziedzinowych administracji publicznej
- zamówienia o wartości (szacowanej wartości) przekraczającej 120 000 PLN – narazie nie realizujemy projektów większych niż 120k`,

  // Zamówienia, które MOŻEMY i CHCEMY realizować
  mozemy: `MOŻEMY realizować zamówienia dotyczące (entry level, do 120k):
- wykonania nowej strony internetowej dla urzędu lub instytucji
- aplikacji mobilnych (Android / iOS)
- certyfikatów SSL (odsprzedaż od GoDaddy i innych)
- projektów graficznych i identyfikacji wizualnej
- modernizacji istniejących stron www
- portalu informacyjnego lub serwisu tematycznego
- landing page dla projektów unijnych
- dostosowania strony do WCAG
- integracji z zewnętrznymi API (formularze, płatności)
- materiałów graficznych i elementów UI
- udziału jako podwykonawca (część graficzna/frontend)
- social media i contentu (treści, posty, prowadzenie profili)`,

  // Opcjonalne: doświadczenie, klienci, mocne strony – dopisuj tu, jak opowiesz o firmie
  dopiski: ``
};

function buildProfileFromSections(s) {
  const parts = [s.intro, '', s.uslugi, '', s.odpadaja, '', s.mozemy];
  if (s.dopiski && String(s.dopiski).trim()) {
    parts.push('', String(s.dopiski).trim());
  }
  return parts.join('\n');
}

function buildProfile() {
  return buildProfileFromSections(sections);
}

/** Zwraca sekcje z cache lub z pliku (do wyświetlenia w UI). */
function getSectionsSync() {
  if (memoryCache) return { ...memoryCache };
  return {
    intro: sections.intro,
    uslugi: sections.uslugi,
    odpadaja: sections.odpadaja,
    mozemy: sections.mozemy,
    dopiski: sections.dopiski
  };
}

/** Profil do promptów AI – z DB (jeśli zapisane) lub z pliku. */
async function getCompanyProfile() {
  if (memoryCache) return buildProfileFromSections(memoryCache);
  try {
    const PublicOrderPrompts = require('../models/PublicOrderPrompts');
    const doc = await PublicOrderPrompts.findById('default').lean();
    if (doc && doc.sections && (doc.sections.intro || doc.sections.uslugi)) {
      memoryCache = doc.sections;
      return buildProfileFromSections(doc.sections);
    }
  } catch (e) {
    console.error('[companyProfile] load from DB:', e.message);
  }
  memoryCache = { intro: sections.intro, uslugi: sections.uslugi, odpadaja: sections.odpadaja, mozemy: sections.mozemy, dopiski: sections.dopiski };
  return buildProfile();
}

/** Po zapisie w UI – ustaw cache (i opcjonalnie zapisz do DB w route). */
function setSectionsCache(s) {
  memoryCache = s;
}

const COMPANY_PROFILE = buildProfile();

module.exports = {
  COMPANY_PROFILE,
  sections,
  buildProfile,
  buildProfileFromSections,
  getSectionsSync,
  getCompanyProfile,
  setSectionsCache
};
