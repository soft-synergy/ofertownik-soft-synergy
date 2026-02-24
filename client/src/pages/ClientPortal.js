import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, hostingAPI } from '../services/api';

const ClientPortal = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // Monitoring modal state
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [monitorData, setMonitorData] = useState(null);
  const [selectedHostingId, setSelectedHostingId] = useState('');

  const isFirstVisitKey = React.useMemo(() => `ss:client-portal:first-visit:${token}`, [token]);

  const getFirstVisitMinDelayMs = React.useCallback(() => {
    try {
      const hasSeen = window.localStorage.getItem(isFirstVisitKey) === '1';
      if (hasSeen) return 0;
      window.localStorage.setItem(isFirstVisitKey, '1');
      return 1400; // wydłużone ładowanie tylko za 1. razem w tej przeglądarce
    } catch (e) {
      return 0;
    }
  }, [isFirstVisitKey]);

  const fetchData = React.useCallback(async () => {
    const startedAt = Date.now();
    const minDelayMs = getFirstVisitMinDelayMs();
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get(`/api/client-portal/${token}`);
      setData(res.data);
      const firstId = (res.data?.hostings && res.data.hostings[0]?._id) || '';
      setSelectedHostingId(firstId);
    } catch (e) {
      setLoadError(e?.response?.data?.message || 'Nie udało się pobrać danych');
    } finally {
      if (minDelayMs > 0) {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minDelayMs - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
      }
      setLoading(false);
    }
  }, [token, getFirstVisitMinDelayMs]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcceptProject = async (projectId) => {
    setAccepting(projectId);
    setSuccess('');
    setActionError('');
    try {
      await api.post(`/api/client-portal/${token}/accept-project/${projectId}`);
      setSuccess('Oferta została zaakceptowana!');
      await fetchData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setActionError(e?.response?.data?.message || 'Błąd akceptacji oferty');
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setAccepting(null);
    }
  };

  const downloadHostingCsv = async (hostingId) => {
    try {
      const res = await hostingAPI.downloadMonthlyReport(month, hostingId);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitoring-${month}-${hostingId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {}
  };

  const openMonitorPanel = async (hostingId) => {
    setMonitorOpen(true);
    setMonitorLoading(true);
    setMonitorError('');
    setMonitorData(null);
    try {
      const res = await api.get(`/api/client-portal/${token}/hosting/${hostingId}/monitor`, { params: { month } });
      setMonitorData(res.data);
    } catch (e) {
      setMonitorError(e?.response?.data?.message || 'Nie udało się pobrać danych monitoringu');
    } finally {
      setMonitorLoading(false);
    }
  };

  const toBackendUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  };

  const logoUrl = toBackendUrl('/generated-offers/logo-removebg-preview.png');

  const getProjectStatusConfig = (project) => {
    const status = project?.status || 'draft';
    const isPreliminary = project?.offerType === 'preliminary';

    const map = {
      draft: {
        label: isPreliminary ? 'Przyjęliśmy zgłoszenie' : 'W przygotowaniu',
        classes: 'bg-gray-100 text-gray-800 border border-gray-200',
      },
      active: {
        label: isPreliminary ? 'Przygotowujemy ofertę' : 'Oferta aktywna',
        classes: 'bg-blue-100 text-blue-800 border border-blue-200',
      },
      accepted: {
        label: 'Oferta zaakceptowana',
        classes: 'bg-green-100 text-green-800 border border-green-200',
      },
      completed: {
        label: 'Projekt zrealizowany',
        classes: 'bg-blue-100 text-blue-800 border border-blue-200',
      },
      cancelled: {
        label: 'Projekt anulowany',
        classes: 'bg-red-100 text-red-800 border border-red-200',
      },
      to_final_estimation: {
        label: 'Liczymy finalną wycenę',
        classes: 'bg-orange-100 text-orange-800 border border-orange-200',
      },
      to_prepare_final_offer: {
        label: 'Składamy finalną ofertę',
        classes: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      },
    };

    return map[status] || map.draft;
  };

  const renderProjectStatusBadge = (project) => {
    const cfg = getProjectStatusConfig(project);
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.classes}`}>
        {cfg.label}
      </span>
    );
  };

  const getProjectStatusExplainer = (project) => {
    if (!project) {
      return {
        title: 'Twoje projekty w SoftSynergy',
        description:
          'W tym panelu w czasie rzeczywistym śledzisz postęp prac nad ofertami i projektami – bez szukania maili.',
      };
    }

    const status = project.status;
    const isPreliminary = project.offerType === 'preliminary';

    if (isPreliminary) {
      if (status === 'to_final_estimation') {
        return {
          title: 'Liczymy dla Ciebie finalną wycenę',
          description:
            'Na bazie Twojego zgłoszenia i oferty wstępnej nasz zespół rozpisuje dokładny budżet projektu. Zwykle zajmuje to 1–2 dni robocze.',
        };
      }
      if (status === 'to_prepare_final_offer') {
        return {
          title: 'Składamy finalną ofertę do akceptacji',
          description:
            'Finalna wycena jest już policzona. Teraz dopieszczamy dokument oferty, żebyś mógł ją wygodnie przejrzeć i zaakceptować online.',
        };
      }
      if (status === 'accepted') {
        return {
          title: 'Oferta została zaakceptowana – szykujemy kolejne kroki',
          description:
            'Dziękujemy za zaufanie! W oparciu o zaakceptowaną ofertę przygotujemy formalności i szczegółowy plan startu projektu.',
        };
      }
      if (status === 'cancelled') {
        return {
          title: 'Ten projekt został zamknięty',
          description:
            'Jeżeli chcesz do niego wrócić lub rozpocząć nową rozmowę, po prostu odezwij się do nas – przygotujemy świeżą propozycję.',
        };
      }

      return {
        title: 'Przygotowujemy dla Ciebie ofertę',
        description:
          'Twoje zgłoszenie jest już w naszym systemie. Zbieramy informacje i układamy ofertę, którą zobaczysz tutaj – krok po kroku, bez biegania po wątkach mailowych.',
      };
    }

    // Final offers
    if (status === 'accepted') {
      return {
        title: 'Oferta zaakceptowana – jesteśmy po tej samej stronie stołu',
        description:
          'Na bazie zaakceptowanej oferty przygotowujemy formalności i planujemy start prac. W tym panelu zawsze sprawdzisz historię ofert i dokumentów.',
      };
    }

    if (status === 'active' || status === 'to_prepare_final_offer') {
      return {
        title: 'Twoja oferta finalna czeka na spokojne przejrzenie',
        description:
          'Masz tu w jednym miejscu wszystko: dokument oferty, podsumowania i przycisk do akceptacji. Możesz wrócić do panelu w dowolnym momencie.',
      };
    }

    return {
      title: 'Twoja oferta w SoftSynergy',
      description:
        'Ten panel pokazuje aktualny etap pracy nad ofertą oraz wszystkie najważniejsze materiały w jednym miejscu.',
    };
  };

  const getOfferWorkflowSteps = (project) => {
    const steps = [
      {
        id: 'preliminary',
        label: 'Oferta wstępna',
        description: 'Pierwszy zarys zakresu i budżetu na bazie Twojego zgłoszenia.',
      },
      {
        id: 'final_estimation',
        label: 'Wycena finalna',
        description: 'Liczymy precyzyjny koszt projektu i dobieramy optymalny zakres.',
      },
      {
        id: 'final_offer',
        label: 'Oferta finalna',
        description: 'Składamy dopieszczony dokument oferty gotowy do akceptacji.',
      },
      {
        id: 'acceptance',
        label: 'Akceptacja',
        description: 'Jednym kliknięciem zatwierdzasz ofertę i przechodzimy do formalności.',
      },
    ];

    if (!project) {
      return steps.map((s, index) => ({
        ...s,
        state: index === 0 ? 'current' : 'upcoming',
      }));
    }

    const status = project.status;
    const isPreliminary = project.offerType === 'preliminary';

    let currentIndex = 0;
    if (status === 'to_final_estimation') currentIndex = 1;
    else if (status === 'to_prepare_final_offer') currentIndex = 2;
    else if (status === 'accepted' || status === 'completed' || status === 'cancelled') currentIndex = 3;
    else if (!isPreliminary && (status === 'active' || status === 'draft')) currentIndex = 2;
    else currentIndex = 0;

    return steps.map((s, index) => ({
      ...s,
      state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
    }));
  };

  const renderOfferProgress = (project) => {
    const steps = getOfferWorkflowSteps(project);
    if (!steps.length) return null;

    const activeIndex = steps.findIndex((s) => s.state === 'current');
    const visibleIndex = activeIndex === -1 ? steps.length - 1 : activeIndex;
    const completedCount = visibleIndex + 1;

    return (
      <div className="mt-4 offer-progress">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              i
            </span>
            <span>Postęp pracy nad ofertą</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium">
            Etap {completedCount} z {steps.length}
          </div>
        </div>
        <div className="flex items-center">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const circleClasses =
              step.state === 'done'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : step.state === 'current'
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/40'
                : 'bg-gray-100 border-gray-300 text-gray-400';

            const connectorClasses =
              step.state === 'done'
                ? 'bg-emerald-400'
                : step.state === 'current'
                ? 'bg-blue-400'
                : 'bg-gray-200';

            const dotBaseClasses =
              step.state === 'current'
                ? 'offer-progress-dot offer-progress-dot-current'
                : 'offer-progress-dot';

            const dotIndexClass = `offer-progress-dot-${index + 1}`;

            return (
              <div key={step.id} className="flex-1 flex items-center">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${circleClasses} ${dotBaseClasses} ${dotIndexClass}`}
                  >
                    {index + 1}
                  </div>
                </div>
                {!isLast && <div className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full ${connectorClasses}`} />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] leading-snug">
          {steps.map((step) => (
            <div key={step.id}>
              <div
                className={`font-semibold mb-0.5 ${
                  step.state === 'current'
                    ? 'text-blue-700'
                    : step.state === 'done'
                    ? 'text-emerald-700'
                    : 'text-gray-600'
                }`}
              >
                {step.label}
              </div>
              <div className="text-gray-500">{step.description}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6">
        <div className="w-full max-w-lg">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
            </div>
            <div className="relative p-7 sm:p-8">
              <div className="flex items-center gap-4">
                <img src={logoUrl} alt="SoftSynergy" className="h-12 w-auto drop-shadow" />
                <div className="min-w-0">
                  <div className="text-xl font-extrabold tracking-tight text-white">
                    Soft<span className="text-orange-400">Synergy</span>
                  </div>
                  <div className="text-xs sm:text-sm text-blue-200/80">
                    Odpalamy panel klienta i ładujemy status Twojej oferty
                  </div>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-center">
                <div className="ss-spinner" aria-label="Ładowanie" />
              </div>

              <div className="mt-6 text-center">
                <div className="text-base font-bold text-white">Jeszcze chwila</div>
                <div className="mt-1 text-xs sm:text-sm text-blue-200/80">
                  Panel uruchomi się automatycznie. W międzyczasie szykujemy podgląd dokumentów i postęp etapów.
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="h-3 w-24 rounded-full ss-skeleton" />
                  <div className="mt-3 h-8 w-16 rounded-xl ss-skeleton" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="h-3 w-20 rounded-full ss-skeleton" />
                  <div className="mt-3 h-8 w-14 rounded-xl ss-skeleton" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="h-3 w-24 rounded-full ss-skeleton" />
                  <div className="mt-3 h-8 w-20 rounded-xl ss-skeleton" />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-blue-200/70">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.35)]" />
                <span>Bez maili. Bez chaosu. Wszystko tu.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (loadError) return <div className="min-h-screen flex items-center justify-center text-red-600">{loadError}</div>;
  if (!data) return null;

  const primaryProject = (data.projects || [])[0] || null;
  const primaryExplainer = getProjectStatusExplainer(primaryProject);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="SoftSynergy" className="h-12 w-auto" />
              <div>
                <div className="text-2xl font-extrabold tracking-tight">
                  Soft<span className="text-orange-400">Synergy</span>
                </div>
                <span className="hidden md:inline text-blue-200/80 text-sm">
                  Panel klienta – statusy ofert w czasie rzeczywistym
                </span>
              </div>
            </div>
            <div className="text-sm text-blue-200/80">
              {new Date().toLocaleDateString('pl-PL')}
            </div>
          </div>
          <div className="mt-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">{data.client.name}</h1>
            <div className="mt-2 text-blue-100/90 text-lg">{data.client.company || ''}</div>
            <div className="mt-3 text-sm text-blue-200/80">
              {data.client.email || '-'} {data.client.phone ? `· ${data.client.phone}` : ''}
            </div>
          </div>
          {/* Live explainer for the primary project */}
          {primaryProject && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-[minmax(0,2.1fr)_minmax(0,2.4fr)] gap-4 items-stretch">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm">
                <div className="text-[11px] uppercase tracking-wide text-blue-200/80 mb-1">
                  Twoja oferta: {primaryProject.name}
                </div>
                <div className="text-sm md:text-base font-semibold text-white mb-1">
                  {primaryExplainer.title}
                </div>
                <p className="text-xs md:text-sm text-blue-100/90 leading-relaxed">
                  {primaryExplainer.description}
                </p>
                <p className="mt-3 text-[11px] text-blue-200/80">
                  Ten panel aktualizuje się automatycznie, gdy zespół SoftSynergy przechodzi kolejne etapy pracy nad Twoją ofertą
                  i projektem.
                </p>
              </div>
              <div className="hidden md:flex flex-col justify-center text-xs text-blue-100/90 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 shadow-sm" />
                  <span>W jednym miejscu widzisz status oferty, dokumenty i kolejny krok po Twojej stronie.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-300 shadow-sm" />
                  <span>Nie musisz szukać maili – ten panel jest zawsze aktualny i dostępny pod stałym linkiem.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-200 shadow-sm" />
                  <span>Po akceptacji oferty tutaj też pojawią się kolejne materiały i dokumenty.</span>
                </div>
              </div>
            </div>
          )}
          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div className="text-xs uppercase tracking-wide text-blue-200 mb-2">Projekty</div>
              <div className="text-3xl font-bold">{data.projects.length}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div className="text-xs uppercase tracking-wide text-orange-200 mb-2">Hosting</div>
              <div className="text-3xl font-bold">{data.hostings.length}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div className="text-xs uppercase tracking-wide text-gray-200 mb-2">Status</div>
              <div className="text-3xl font-bold">Aktywny</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-green-800 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}
        {actionError && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-800 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {actionError}
          </div>
        )}

        {/* Projects Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-blue-600 to-orange-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Projekty</h2>
            </div>
          </div>
          {data.projects.length === 0 ? (
            <div className="p-12 bg-white rounded-xl border-2 border-gray-200 text-center">
              <div className="text-gray-400 mb-2">📁</div>
              <div className="text-sm font-medium text-gray-500">Brak projektów</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.projects.map(p => {
                const isPreliminary = p.offerType === 'preliminary';
                return (
                  <div
                    key={p._id}
                    className={`bg-white rounded-xl border-2 border-gray-100 p-6 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200 ${
                      isPreliminary ? 'md:col-span-2 offer-preliminary-card' : ''
                    }`}
                  >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xl font-bold text-gray-900 mb-2">{p.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">Status:</span>
                        {renderProjectStatusBadge(p)}
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <span className="text-gray-500">
                          {isPreliminary
                            ? 'Oferta wstępna – prowadzimy Cię krok po kroku do wersji finalnej'
                            : 'Oferta finalna przygotowana na podstawie wcześniejszych ustaleń i rozmów'}
                        </span>
                        {p.createdAt && (
                          <>
                            <span className="hidden sm:inline text-gray-400">•</span>
                            <span>Start: {new Date(p.createdAt).toLocaleDateString('pl-PL')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {renderOfferProgress(p)}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {p.generatedOfferUrl && (
                      <a href={toBackendUrl(p.generatedOfferUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">Podgląd oferty</a>
                    )}
                    {p.workSummaryUrl && (
                      <a href={toBackendUrl(p.workSummaryUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm">Podsumowanie prac</a>
                    )}
                    {p.workSummaryPdfUrl && (
                      <a href={toBackendUrl(p.workSummaryPdfUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Podsumowanie PDF</a>
                    )}
                    <a
                      href="https://cal.com/soft-synergy/30min"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
                    >
                      📅 Umów spotkanie
                    </a>
                    {p.status !== 'accepted' && (
                      <button
                        onClick={() => handleAcceptProject(p._id)}
                        disabled={accepting === p._id}
                        className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {accepting === p._id ? 'Akceptowanie...' : '✓ Zaakceptuj ofertę'}
                      </button>
                    )}
                    {p.status === 'accepted' && (
                      <div className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-green-100 text-green-700 border-2 border-green-300">
                        ✓ Oferta zaakceptowana
                      </div>
                    )}
                  </div>
                  {isPreliminary && (
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <a
                        href="https://soft-synergy.com/gwarancja"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
                        title="Zobacz gwarancję i SLA Soft Synergy"
                      >
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                          ?
                        </span>
                        Zobacz nasze warunki gwarancji i SLA
                      </a>
                      <div className="text-[11px] text-gray-500">
                        3 miesiące gwarancji w standardzie · SLA 99,5% · reakcja do 2h
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Documents / Invoices Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-gray-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Dokumenty</h2>
            </div>
            <div className="text-xs text-gray-500">Faktury i dokumenty powiązane z projektami</div>
          </div>
          {(() => {
            const docs = [];
            (data.projects || []).forEach(p => {
              (p.documents || []).forEach(d => {
                docs.push({ ...d, projectName: p.name, projectId: p._id, createdAt: d.uploadedAt || p.createdAt });
              });
            });
            if (docs.length === 0) {
              return <div className="p-12 bg-white rounded-xl border-2 border-gray-200 text-center">
                <div className="text-gray-400 mb-2">📄</div>
                <div className="text-sm font-medium text-gray-500">Brak dokumentów</div>
              </div>;
            }
            // group by YYYY-MM
            const groups = docs.reduce((acc, d) => {
              const dt = d.createdAt ? new Date(d.createdAt) : new Date();
              const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
              acc[key] = acc[key] || [];
              acc[key].push(d);
              return acc;
            }, {});
            const months = Object.keys(groups).sort().reverse();
            return (
              <div className="space-y-6">
                {months.map(monthKey => (
                  <div key={monthKey} className="bg-white rounded-xl border-2 border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-gray-50 border-b-2 border-gray-200">
                      <div className="text-sm font-bold text-gray-800 uppercase tracking-wide">{monthKey}</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {groups[monthKey].map((d, idx) => (
                        <div key={`${d.filePath}-${idx}`} className="px-6 py-4 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900 truncate mb-1">{d.originalName}</div>
                            <div className="text-xs text-gray-500">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${d.type === 'vat' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{(d.type || '').toUpperCase()}</span>
                              <span className="ml-2">Projekt: {d.projectName}</span>
                            </div>
                          </div>
                          <a href={toBackendUrl(d.filePath)} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md hover:shadow-lg ml-4">Pobierz</a>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        {/* Hosting Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-gradient-to-r from-gray-600 to-blue-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Hosting</h2>
            </div>
              <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <span className="text-xs text-gray-500 font-medium">Miesiąc raportu</span>
              </div>
              {data.hostings.length > 0 && (
                <>
                  <select value={selectedHostingId} onChange={(e) => setSelectedHostingId(e.target.value)} className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {data.hostings.map(h => (
                      <option key={h._id} value={h._id}>{h.domain}</option>
                    ))}
                  </select>
                  <button onClick={() => openMonitorPanel(selectedHostingId)} disabled={!selectedHostingId} className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50">Zobacz panel</button>
                </>
              )}
            </div>
          </div>
          {/* Cadence badge / explainer */}
          <div className="mb-4 bg-gradient-to-r from-blue-50 via-orange-50 to-gray-50 border-2 border-blue-200/50 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 mb-1">Automatyczne monitorowanie</div>
                <div className="text-sm text-gray-700">
                  System monitoruje Twoje strony automatycznie co 5 minut. Raport CSV zawiera każdy techniczny check wykonany w wybranym miesiącu.
                </div>
              </div>
            </div>
          </div>
          {data.hostings.length === 0 ? (
            <div className="p-12 bg-white rounded-xl border-2 border-gray-200 text-center">
              <div className="text-gray-400 mb-2">🌐</div>
              <div className="text-sm font-medium text-gray-500">Brak hostingu</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-gray-100 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Domena</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status / SSL</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nast. rozliczenie</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Monitoring</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Raport</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {data.hostings.map(h => (
                    <tr key={h._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{h.domain}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${h.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : h.status === 'overdue' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : h.status === 'suspended' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{h.status}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!h.sslStatus || h.sslStatus.status === 'not_found' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-300">
                                ⚠️ Certyfikat SSL nie znaleziony
                              </span>
                            ) : h.sslStatus.isExpired ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                                🔴 SSL wygasł
                              </span>
                            ) : h.sslStatus.isExpiringSoon ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                                ⚠️ SSL wygasa za {h.sslStatus.daysUntilExpiry} dni
                              </span>
                            ) : h.sslStatus.status === 'valid' && h.sslStatus.daysUntilExpiry !== null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                ✓ SSL ważny ({h.sslStatus.daysUntilExpiry} dni)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300">
                                ℹ️ SSL: {h.sslStatus.status || 'nieznany'}
                              </span>
                            )}
                            {h.sslStatus && h.sslStatus.validTo && (
                              <span className="text-xs text-gray-500">
                                do {new Date(h.sslStatus.validTo).toLocaleDateString('pl-PL')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">{h.nextPaymentDate ? new Date(h.nextPaymentDate).toLocaleDateString('pl-PL') : '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm">auto-check co 5 min</span>
                          <button onClick={() => openMonitorPanel(h._id)} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md">Zobacz panel</button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button onClick={() => downloadHostingCsv(h._id)} className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-md hover:shadow-lg">Pobierz CSV</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Brand Footer */}
        <footer className="pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="SoftSynergy" className="h-8 w-auto opacity-70" />
              <div className="text-sm text-gray-600">
                © {new Date().getFullYear()} SoftSynergy – panel klienta
              </div>
            </div>
            <div className="text-xs md:text-sm text-gray-500 font-medium text-center md:text-right">
              Ten panel klienta jest własnością i autorskim produktem Soft Synergy – zaprojektowanym tak, aby w czasie
              rzeczywistym pokazywać postęp prac nad Twoimi projektami i ofertami.
            </div>
          </div>
        </footer>
      </div>

      {/* Monitoring Modal */}
      {monitorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMonitorOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border-2 border-gray-200 w-[92vw] max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-gray-50 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900">Panel monitoringu</div>
              <button onClick={() => setMonitorOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Zamknij</button>
            </div>
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(85vh - 56px)' }}>
              {monitorLoading && (
                <div className="text-gray-600">Ładowanie…</div>
              )}
              {monitorError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-800 font-medium">{monitorError}</div>
              )}
              {(!monitorLoading && monitorData) && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <div className="text-xs uppercase text-gray-500 font-bold mb-1">Uptime</div>
                      <div className="text-2xl font-extrabold text-gray-900">{monitorData.stats?.uptimePct ?? 0}%</div>
                      <div className="text-xs text-gray-500">Okres: {month}</div>
                    </div>
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <div className="text-xs uppercase text-gray-500 font-bold mb-1">Średni czas odpowiedzi</div>
                      <div className="text-2xl font-extrabold text-gray-900">{monitorData.stats?.avgResponseMs ?? 0} ms</div>
                      <div className="text-xs text-gray-500">na podstawie {monitorData.stats?.totalChecks ?? 0} checków</div>
                    </div>
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <div className="text-xs uppercase text-gray-500 font-bold mb-1">Ostatni status</div>
                      <div className="text-2xl font-extrabold {monitorData.monitor?.isUp ? 'text-green-600' : 'text-red-600'}">{monitorData.monitor?.isUp ? 'UP' : 'DOWN'}</div>
                      <div className="text-xs text-gray-500">{monitorData.monitor?.lastStatusCode || '-'} • {monitorData.monitor?.lastResponseTimeMs || '-'} ms</div>
                    </div>
                  </div>

                  {monitorData.monitor?.lastError && (
                    <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
                      <div className="text-sm font-bold text-red-800 mb-1">Ostatni błąd</div>
                      <div className="text-sm text-red-700 break-all">{monitorData.monitor.lastError}</div>
                      {monitorData.monitor.lastHtmlPath && (
                        <a href={monitorData.monitor.lastHtmlPath} target="_blank" rel="noreferrer" className="inline-flex mt-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700">Zobacz snapshot HTML</a>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border-2 border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b text-sm font-bold text-gray-700">Historia checków (ostatnie {monitorData.checks?.length || 0})</div>
                    <div className="max-h-80 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">Czas</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">HTTP</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">Response (ms)</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600">Błąd</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {monitorData.checks?.map((c, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2">{new Date(c.timestamp).toLocaleString('pl-PL')}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c.isUp ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>{c.isUp ? 'UP' : 'DOWN'}</span>
                              </td>
                              <td className="px-4 py-2">{c.statusCode || '-'}</td>
                              <td className="px-4 py-2">{typeof c.responseTimeMs === 'number' ? c.responseTimeMs : '-'}</td>
                              <td className="px-4 py-2 text-red-700 break-all">{c.error || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;


