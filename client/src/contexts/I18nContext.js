import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const dictionaries = {
  pl: {
    common: {
      appName: 'Ofertownik',
      loading: 'Ładowanie...',
      yes: 'Tak',
      no: 'Nie'
    },
    nav: {
      dashboard: 'Dashboard',
      projects: 'Projekty',
      portfolio: 'Portfolio',
      hosting: 'Hosting',
      employees: 'Pracownicy',
      logout: 'Wyloguj'
    },
    layout: {
      tagline: 'Przegląd i zarządzanie ofertami',
      languageTitle: 'Język ofert'
    },
    buttons: {
      save: 'Zapisz',
      cancel: 'Anuluj',
      edit: 'Edytuj',
      delete: 'Usuń',
      view: 'Podgląd',
      download: 'Pobierz',
      generateOffer: 'Generuj ofertę',
      generateContract: 'Wygeneruj umowę',
      add: 'Dodaj',
      clear: 'Wyczyść'
    },
    dashboard: {
      header: 'Dashboard',
      subheader: 'Przegląd projektów i statystyk',
      allProjects: 'Wszystkie projekty',
      activeProjects: 'Aktywne projekty',
      projectsValue: 'Wartość projektów',
      offersGenerated: 'Oferty wygenerowane',
      quickActions: 'Szybkie akcje',
      actionNew: 'Nowy projekt',
      actionNewDesc: 'Utwórz nowy projekt i ofertę',
      actionBrowse: 'Przeglądaj projekty',
      actionBrowseDesc: 'Zobacz wszystkie projekty',
      actionPortfolio: 'Zarządzaj portfolio',
      actionPortfolioDesc: 'Edytuj portfolio projektów',
      recentActivity: 'Ostatnia aktywność',
      welcome: 'Witamy w Ofertowniku!',
      getStarted: 'Rozpocznij pracę z systemem zarządzania ofertami',
      now: 'Teraz'
    },
    projects: {
      header: 'Projekty',
      subheader: 'Zarządzaj projektami i ofertami',
      searchLabel: 'Wyszukaj',
      searchPlaceholder: 'Nazwa projektu, klient...',
      statusLabel: 'Status',
      offerTypeLabel: 'Typ oferty',
      allOption: 'Wszystkie',
      clearFilters: 'Wyczyść filtry',
      newProject: 'Nowy projekt',
      status: {
        draft: 'Szkic',
        active: 'Aktywny',
        accepted: 'Zaakceptowany',
        completed: 'Zakończony',
        cancelled: 'Anulowany'
      },
      emptyTitle: 'Brak projektów',
      emptyHintFiltered: 'Spróbuj zmienić filtry wyszukiwania.',
      emptyHint: 'Rozpocznij od utworzenia pierwszego projektu.',
      createFirst: 'Utwórz projekt',
      shownCount: 'Pokazano {{start}} do {{end}} z {{total}} wyników',
      prev: 'Poprzednia',
      next: 'Następna'
    }
    ,
    hosting: {
      header: 'Monitoring hostingu',
      subheader: 'Status, alerty i miesięczne raporty',
      refresh: 'Odśwież',
      summary: 'Awarii/Alertów',
      domain: 'Domena',
      url: 'URL',
      status: 'Status',
      lastCheck: 'Ostatnie sprawdzenie',
      code: 'Kod',
      rt: 'RT (ms)',
      error: 'Błąd',
      snapshot: 'Snapshot',
      actions: 'Akcje',
      viewSnapshot: 'Podgląd',
      ack: 'Potwierdź',
      acknowledged: 'Potwierdzony',
      up: 'DZIAŁA',
      down: 'NIE DZIAŁA',
      empty: 'Brak monitorów',
      adminOnly: 'Tylko dla administratorów'
    }
  },
  en: {
    common: {
      appName: 'Offer Manager',
      loading: 'Loading...',
      yes: 'Yes',
      no: 'No'
    },
    nav: {
      dashboard: 'Dashboard',
      projects: 'Projects',
      portfolio: 'Portfolio',
      hosting: 'Hosting',
      employees: 'Employees',
      logout: 'Log out'
    },
    layout: {
      tagline: 'Overview and offer management',
      languageTitle: 'Offer language'
    },
    buttons: {
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      view: 'Preview',
      download: 'Download',
      generateOffer: 'Generate offer',
      generateContract: 'Generate contract',
      add: 'Add',
      clear: 'Clear'
    },
    dashboard: {
      header: 'Dashboard',
      subheader: 'Overview of projects and stats',
      allProjects: 'All projects',
      activeProjects: 'Active projects',
      projectsValue: 'Projects value',
      offersGenerated: 'Offers generated',
      quickActions: 'Quick actions',
      actionNew: 'New project',
      actionNewDesc: 'Create a new project and offer',
      actionBrowse: 'Browse projects',
      actionBrowseDesc: 'See all projects',
      actionPortfolio: 'Manage portfolio',
      actionPortfolioDesc: 'Edit project portfolio',
      recentActivity: 'Recent activity',
      welcome: 'Welcome to Offer Manager!',
      getStarted: 'Get started managing your offers',
      now: 'Now'
    },
    projects: {
      header: 'Projects',
      subheader: 'Manage projects and offers',
      searchLabel: 'Search',
      searchPlaceholder: 'Project name, client...',
      statusLabel: 'Status',
      offerTypeLabel: 'Offer type',
      allOption: 'All',
      clearFilters: 'Clear filters',
      newProject: 'New project',
      status: {
        draft: 'Draft',
        active: 'Active',
        accepted: 'Accepted',
        completed: 'Completed',
        cancelled: 'Cancelled'
      },
      emptyTitle: 'No projects',
      emptyHintFiltered: 'Try adjusting your filters.',
      emptyHint: 'Start by creating your first project.',
      createFirst: 'Create project',
      shownCount: 'Showing {{start}} to {{end}} of {{total}} results',
      prev: 'Previous',
      next: 'Next'
    }
    ,
    hosting: {
      header: 'Hosting monitoring',
      subheader: 'Status, alerts and monthly reports',
      refresh: 'Refresh',
      summary: 'Down/Alerts',
      domain: 'Domain',
      url: 'URL',
      status: 'Status',
      lastCheck: 'Last check',
      code: 'Code',
      rt: 'RT (ms)',
      error: 'Error',
      snapshot: 'Snapshot',
      actions: 'Actions',
      viewSnapshot: 'View',
      ack: 'Acknowledge',
      acknowledged: 'Acknowledged',
      up: 'UP',
      down: 'DOWN',
      empty: 'No monitors',
      adminOnly: 'Admin only'
    }
  }
};

const I18nContext = createContext({ lang: 'pl', setLang: () => {}, t: (k) => k });

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('ofertownik_lang') || 'pl');

  useEffect(() => {
    localStorage.setItem('ofertownik_lang', lang);
  }, [lang]);

  const t = useMemo(() => {
    const dict = dictionaries[lang] || dictionaries.pl;
    return (key) => {
      if (!key) return '';
      const parts = key.split('.');
      let cur = dict;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
          cur = cur[p];
        } else {
          return key;
        }
      }
      return typeof cur === 'string' ? cur : key;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);




