import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { publicOrdersAPI, tasksAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  RefreshCw,
  ExternalLink,
  Search,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  RotateCcw,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Target,
  BrainCircuit,
  ThumbsUp,
  Paperclip,
  ListTodo,
  Plus,
  X
} from 'lucide-react';

const AI_STATUS_CONFIG = {
  pending:   { label: 'Oczekuje',   bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  rejected:  { label: 'Odrzucone',  bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500' },
  candidate: { label: 'Kandydat',   bg: 'bg-orange-50',   text: 'text-orange-700', dot: 'bg-orange-500' },
  scored:    { label: 'Ocenione',   bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
};

const OFFER_STATUS_CONFIG = {
  none:   { label: 'Brak',      bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  sent:   { label: 'Wysłane',   bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  won:    { label: 'Wygrane',   bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
  lost:   { label: 'Przegrane', bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500' },
};

function AiBadge({ status, score }) {
  const cfg = AI_STATUS_CONFIG[status] || AI_STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {status === 'scored' && score != null && (
        <span className="font-bold ml-0.5">{score}/10</span>
      )}
    </span>
  );
}

function OfferStatusBadge({ status }) {
  const cfg = OFFER_STATUS_CONFIG[status] || OFFER_STATUS_CONFIG.none;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null) return null;
  const pct = (score / 10) * 100;
  const color = score >= 7 ? 'bg-emerald-500' : score >= 4 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700">{score}/10</span>
    </div>
  );
}

function WeDoItToggle({ order, onToggled }) {
  const patchMutation = useMutation(
    () => publicOrdersAPI.patch(order._id, { weDoIt: !order.weDoIt }),
    {
      onSuccess: () => {
        toast.success(order.weDoIt ? 'Odznaczono „Robimy"' : 'Oznaczono „Robimy" – na pewno składamy');
        onToggled?.();
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu')
    }
  );
  return (
    <button
      type="button"
      onClick={() => patchMutation.mutate()}
      disabled={patchMutation.isLoading}
      title={order.weDoIt ? 'Na pewno składamy – kliknij aby odznaczyć' : 'Kliknij jeśli na pewno składamy ofertę'}
      className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        order.weDoIt
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } ${patchMutation.isLoading ? 'opacity-70' : ''}`}
    >
      {patchMutation.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
      {order.weDoIt ? 'Robimy' : 'Robimy?'}
    </button>
  );
}

function NoChanceButton({ orderId, disabled, onDone }) {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    () => publicOrdersAPI.patch(orderId, { archivedManually: true }),
    {
      onSuccess: () => {
        toast.success('Oznaczono: nie ma szans – przeniesione do archiwum');
        queryClient.invalidateQueries('publicOrders');
        if (onDone) onDone();
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd archiwizacji')
    }
  );
  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={disabled || mutation.isLoading}
      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
      title="Oznacz, że nie ma szans na wygraną i przenieś do archiwum"
    >
      {mutation.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      Nie ma szans
    </button>
  );
}

const AI_TABS = [
  { key: 'all',       label: 'Wszystkie (bieżące)' },
  { key: 'weDoIt',    label: 'Robimy' },
  { key: 'scored',    label: 'Ocenione AI' },
  { key: 'pending',   label: 'Oczekujące' },
  { key: 'rejected',  label: 'Odrzucone' },
  { key: 'archived',  label: 'Archiwum (po terminie)' },
];

function PromptsEditor({ onClose }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    'publicOrdersPrompts',
    () => publicOrdersAPI.getPrompts(),
    { enabled: true }
  );
  const [form, setForm] = useState({ intro: '', uslugi: '', odpadaja: '', mozemy: '', dopiski: '' });

  React.useEffect(() => {
    if (data?.sections) setForm((f) => ({ ...f, ...data.sections }));
  }, [data?.sections]);

  const saveMutation = useMutation(
    (sections) => publicOrdersAPI.savePrompts(sections),
    {
      onSuccess: () => {
        toast.success('Prompty zapisane. Kolejne analizy AI będą z nich korzystać.');
        queryClient.invalidateQueries('publicOrdersPrompts');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisywania')
    }
  );

  const handleSave = () => {
    saveMutation.mutate({
      intro: form.intro,
      uslugi: form.uslugi,
      odpadaja: form.odpadaja,
      mozemy: form.mozemy,
      dopiski: form.dopiski
    });
  };

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Edycja promptów AI (profil firmy)</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm"
          >
            {saveMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Zapisz
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"
          >
            Wróć do listy
          </button>
        </div>
      </div>
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-gray-500">
          Te sekcje są wstrzykiwane do wszystkich promptów AI (batch filter, scoring, głęboka analiza). Edytuj treść tak, aby AI dobrze oceniało zlecenia pod kątem Waszej firmy.
        </p>
        {PROMPT_SECTIONS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <textarea
              value={form[key] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              rows={key === 'intro' || key === 'dopiski' ? 4 : 12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const PROMPT_SECTIONS = [
  { key: 'intro', label: 'Intro (kim jesteśmy)', placeholder: 'Krótki opis firmy na początek każdego promptu AI…' },
  { key: 'uslugi', label: 'Zakres usług', placeholder: 'Lista usług (w punktach)…' },
  { key: 'odpadaja', label: 'AUTOMATYCZNIE ODPADAJĄ', placeholder: 'Zamówienia, na które nie startujemy…' },
  { key: 'mozemy', label: 'MOŻEMY realizować', placeholder: 'Zamówienia, które chcemy i możemy robić…' },
  { key: 'dopiski', label: 'Dopiski (doświadczenie, klienci)', placeholder: 'Opcjonalne – mocne strony, doświadczenie…' },
];

const ZleceniaPubliczne = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [aiTab, setAiTab] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [showPrompts, setShowPrompts] = useState(false);

  const { data, isLoading } = useQuery(
    ['publicOrders', page, search, region, aiTab],
    () => publicOrdersAPI.getAll({
      page,
      limit: 20,
      search: search || undefined,
      region: region || undefined,
      weDoIt: aiTab === 'weDoIt' ? true : undefined,
      aiStatus: (aiTab !== 'all' && aiTab !== 'weDoIt' && aiTab !== 'archived') ? aiTab : undefined,
      archived: aiTab === 'archived' ? true : undefined
    }),
    { keepPreviousData: true }
  );

  const syncMutation = useMutation(publicOrdersAPI.sync, {
    onSuccess: (res) => {
      toast.success(res.message || 'Synchronizacja zakończona');
      queryClient.invalidateQueries('publicOrders');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd synchronizacji')
  });

  const aiMutation = useMutation(
    (limit) => publicOrdersAPI.aiAnalyze(limit),
    {
      onSuccess: (res) => {
        toast.success(res.message || 'Analiza AI zakończona');
        queryClient.invalidateQueries('publicOrders');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd analizy AI')
    }
  );

  const resetMutation = useMutation(
    (ids) => publicOrdersAPI.aiReset(ids),
    {
      onSuccess: (res) => {
        toast.success(res.message || 'Reset AI');
        queryClient.invalidateQueries('publicOrders');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd resetu')
    }
  );

  const deleteAllMutation = useMutation(publicOrdersAPI.deleteAll, {
    onSuccess: (res) => {
      toast.success(res.message || 'Usunięto wszystkie zlecenia');
      queryClient.invalidateQueries('publicOrders');
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd usuwania')
  });

  const refreshDetailsMutation = useMutation(
    (ids) => publicOrdersAPI.refreshDetails(ids),
    {
      onSuccess: (res) => {
        toast.success(res.message || 'Szczegóły zaktualizowane');
        queryClient.invalidateQueries('publicOrders');
        if (selectedId) queryClient.invalidateQueries(['publicOrder', selectedId]);
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd odświeżania')
    }
  );

  const items = data?.items || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;
  const aiCounts = data?.aiCounts || {};
  const weDoItCount = data?.weDoItCount ?? 0;

  const rowBgClass = (row) => {
    if (row.aiStatus === 'rejected') return 'bg-red-50/60';
    if (row.aiStatus === 'candidate') return 'bg-orange-50/60';
    if (row.aiStatus === 'scored') {
      if (row.aiScore >= 7) return 'bg-emerald-50/50';
      if (row.aiScore >= 4) return 'bg-yellow-50/50';
      return 'bg-red-50/30';
    }
    return '';
  };

  const isAdmin = user?.role === 'admin';
  const isBusy = syncMutation.isLoading || aiMutation.isLoading || resetMutation.isLoading || deleteAllMutation.isLoading || refreshDetailsMutation.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zlecenia publiczne</h1>
          <p className="text-sm text-gray-500 mt-1">
            Import z Grupy Biznes Polska + analiza AI
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {syncMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Aktualizuj
            </button>
            <button
              type="button"
              onClick={() => aiMutation.mutate(10)}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {aiMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Odpal AI dla ostatnich 10
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Na pewno zresetować status AI dla WSZYSTKICH zleceń?')) resetMutation.mutate(undefined);
              }}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reset AI
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Na pewno usunąć WSZYSTKIE zlecenia publiczne z bazy? Tej operacji nie można cofnąć.')) deleteAllMutation.mutate();
              }}
              disabled={isBusy || total === 0}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {deleteAllMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Usuń wszystkie
            </button>
            <button
              type="button"
              onClick={() => refreshDetailsMutation.mutate(undefined)}
              disabled={isBusy || total === 0}
              title="Pobierz ponownie pełne opisy, organizatora, wymagania itd. z biznes-polska.pl"
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {refreshDetailsMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Odśwież szczegóły
            </button>
            <button
              type="button"
              onClick={() => setShowPrompts(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 text-sm"
              title="Edytuj prompty AI (profil firmy)"
            >
              <FileText className="h-4 w-4" />
              Prompty
            </button>
          </div>
        )}
      </div>

      {/* Ekran edycji promptów (tylko admin) – gdy włączony, reszta strony jest ukryta */}
      {showPrompts && isAdmin ? (
        <PromptsEditor onClose={() => setShowPrompts(false)} />
      ) : (
        <>
      {/* AI stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Robimy" count={weDoItCount} color="emerald" />
        <StatCard label="Oczekujące" count={aiCounts.pending || 0} color="gray" />
        <StatCard label="Odrzucone AI" count={aiCounts.rejected || 0} color="red" />
        <StatCard label="Kandydaci" count={aiCounts.candidate || 0} color="orange" />
        <StatCard label="Ocenione AI" count={aiCounts.scored || 0} color="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj (tytuł, opis, zamawiający, ID...)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <input
          type="text"
          placeholder="Województwo"
          value={region}
          onChange={(e) => { setRegion(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-40"
        />
      </div>

      {/* AI tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {AI_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setAiTab(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              aiTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            Brak zleceń{aiTab !== 'all' ? ` w kategorii „${AI_TABS.find(t => t.key === aiTab)?.label}”` : ''}.
            {isAdmin && aiTab === 'all' && ' Kliknij „Aktualizuj", aby pobrać ogłoszenia z Biznes Polska.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Robimy</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brak szans</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status oferty</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Przedmiot</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Województwo</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((row) => (
                    <tr key={row._id} className={`hover:bg-gray-50/50 ${rowBgClass(row)} ${row.weDoIt ? 'bg-emerald-50/70' : ''}`}>
                      <td className="px-3 py-3">
                        <WeDoItToggle order={row} onToggled={() => queryClient.invalidateQueries('publicOrders')} />
                      </td>
                      <td className="px-3 py-3">
                        <NoChanceButton orderId={row._id} />
                      </td>
                      <td className="px-3 py-3">
                        <OfferStatusBadge status={row.offerResultStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <AiBadge status={row.aiStatus} score={row.aiScore} />
                          {row.aiDeepAnalysis && !row.aiDeepAnalysis.error && (
                            <span title="Głęboka analiza dostępna"><BrainCircuit className="h-4 w-4 text-violet-500" /></span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ScoreBar score={row.aiScore} />
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 font-mono">{row.biznesPolskaId}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(selectedId === row._id ? null : row._id)}
                          className={`text-left text-sm font-medium hover:underline ${
                            row.aiStatus === 'rejected' ? 'text-red-400 line-through' : 'text-primary-600'
                          }`}
                        >
                          {row.title?.slice(0, 80)}{row.title?.length > 80 ? '...' : ''}
                        </button>
                        {row.aiStatus === 'rejected' && row.aiRejectionReason && (
                          <p className="text-xs text-red-400 mt-0.5">{row.aiRejectionReason}</p>
                        )}
                        {row.aiStatus === 'scored' && row.aiAnalysis && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{row.aiAnalysis}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">{row.region || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {row.addedDate ? format(new Date(row.addedDate), 'd MMM y', { locale: pl }) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.detailUrl && (
                          <a
                            href={row.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedId && (
              <OrderDetailPopup id={selectedId} onClose={() => setSelectedId(null)} />
            )}

            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Strona {page} z {totalPages} &bull; {total} zleceń
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </>
    )}
    </div>
  );
};

function StatCard({ label, count, color }) {
  const colors = {
    gray:    'border-gray-200 text-gray-700',
    red:     'border-red-200 text-red-700',
    orange:  'border-orange-200 text-orange-700',
    emerald: 'border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`bg-white rounded-lg border p-3 ${colors[color] || colors.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}

function OrderWeDoItTab({ orderId, data, onUpdate }) {
  const queryClient = useQueryClient();
  const [updateText, setUpdateText] = useState('');
  const [deadlineVal, setDeadlineVal] = useState(
    data?.customDeadline ? format(new Date(data.customDeadline), 'yyyy-MM-dd') : ''
  );
  const [offerStatus, setOfferStatus] = useState(data?.offerResultStatus || 'none');
  React.useEffect(() => {
    setDeadlineVal(data?.customDeadline ? format(new Date(data.customDeadline), 'yyyy-MM-dd') : '');
    setOfferStatus(data?.offerResultStatus || 'none');
  }, [data?.customDeadline, data?.offerResultStatus]);

  const patchMutation = useMutation(
    (payload) => publicOrdersAPI.patch(orderId, payload),
    { onSuccess: () => { queryClient.invalidateQueries(['publicOrder', orderId]); queryClient.invalidateQueries('publicOrders'); onUpdate?.(); } }
  );
  const addUpdateMutation = useMutation(
    (text) => publicOrdersAPI.addUpdate(orderId, text),
    { onSuccess: () => { queryClient.invalidateQueries(['publicOrder', orderId]); setUpdateText(''); onUpdate?.(); } }
  );
  const uploadMutation = useMutation(
    (formData) => publicOrdersAPI.uploadAttachment(orderId, formData),
    { onSuccess: () => { queryClient.invalidateQueries(['publicOrder', orderId]); onUpdate?.(); } }
  );
  const deleteAttachmentMutation = useMutation(
    (index) => publicOrdersAPI.deleteAttachment(orderId, index),
    { onSuccess: () => { queryClient.invalidateQueries(['publicOrder', orderId]); onUpdate?.(); } }
  );

  const handleWeDoItToggle = () => patchMutation.mutate({ weDoIt: !data?.weDoIt });
  const handleOfferStatusChange = (e) => {
    const value = e.target.value;
    setOfferStatus(value);
    patchMutation.mutate({ offerResultStatus: value });
  };
  const handleDeadlineBlur = () => {
    if (deadlineVal) patchMutation.mutate({ customDeadline: deadlineVal });
    else patchMutation.mutate({ customDeadline: null });
  };
  const handleAddUpdate = () => {
    const t = updateText.trim();
    if (t) addUpdateMutation.mutate(t);
  };
  const handleFileUpload = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    uploadMutation.mutate(fd);
    e.target.value = '';
  };

  const updates = data?.internalUpdates || [];
  const attachments = data?.attachments || [];
  const baseUrl = window.location.origin || '';

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-700">Na pewno składamy?</span>
          <button
            type="button"
            onClick={handleWeDoItToggle}
            disabled={patchMutation.isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              data?.weDoIt ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <ThumbsUp className="h-4 w-4" />
            {data?.weDoIt ? 'Robimy' : 'Oznacz jako Robimy'}
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-gray-600">Termin (własny):</label>
            <input
              type="date"
              value={deadlineVal}
              onChange={(e) => setDeadlineVal(e.target.value)}
              onBlur={handleDeadlineBlur}
              className="px-3 py-1.5 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-600">Status oferty:</label>
            <select
              value={offerStatus}
              onChange={handleOfferStatusChange}
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
            >
              <option value="none">Brak</option>
              <option value="sent">Wysłane</option>
              <option value="won">Wygrane</option>
              <option value="lost">Przegrane</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Update'y / notatki</h4>
        <div className="space-y-2 mb-3">
          {updates.map((u, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-gray-800">{u.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {u.author?.firstName} {u.author?.lastName} · {format(new Date(u.createdAt), 'd MMM y, HH:mm', { locale: pl })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUpdate()}
            placeholder="Dodaj notatkę..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button type="button" onClick={handleAddUpdate} disabled={!updateText.trim() || addUpdateMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            Dodaj
          </button>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4" /> Załączniki</h4>
        <ul className="space-y-2 mb-3">
          {attachments.map((att, i) => (
            <li key={i} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <a href={baseUrl + att.path} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{att.name}</a>
              <button type="button" onClick={() => deleteAttachmentMutation.mutate(i)} disabled={deleteAttachmentMutation.isLoading} className="text-red-600 hover:text-red-700 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
          <Paperclip className="h-4 w-4" />
          <span>Wybierz plik</span>
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadMutation.isLoading} />
        </label>
      </div>
    </div>
  );
}

function OrderTasksTab({ orderId, orderTitle, onUpdate }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: tasks, isLoading } = useQuery(
    ['publicOrderTasks', orderId],
    () => publicOrdersAPI.getTasks(orderId),
    { enabled: !!orderId }
  );
  const createTaskMutation = useMutation(
    () => tasksAPI.create({
      title: newTitle.trim() || `Zadanie: ${(orderTitle || '').slice(0, 50)}`,
      dueDate: newDueDate,
      publicOrder: orderId
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['publicOrderTasks', orderId]);
        setShowAdd(false);
        setNewTitle('');
        setNewDueDate(format(new Date(), 'yyyy-MM-dd'));
        onUpdate?.();
        toast.success('Zadanie dodane');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd dodawania zadania')
    }
  );

  const handleAddTask = () => {
    createTaskMutation.mutate();
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2"><ListTodo className="h-4 w-4" /> Zadania do tego przetargu</h4>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
        >
          <Plus className="h-4 w-4" /> Dodaj zadanie
        </button>
      </div>
      {showAdd && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tytuł zadania"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleAddTask} disabled={createTaskMutation.isLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {createTaskMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Zapisz
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">Anuluj</button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !tasks?.length ? (
        <p className="text-gray-500 py-4">Brak zadań. Dodaj zadanie powiązane z tym przetargiem.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t._id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <div>
                <p className="font-medium text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-500">Termin: {format(new Date(t.dueDate), 'd MMM y', { locale: pl })}</p>
              </div>
              <a href={`/tasks`} className="text-primary-600 hover:underline text-sm">Otwórz zadania →</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderDetailPopup({ id, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('info');

  const { data, isLoading } = useQuery(
    ['publicOrder', id],
    () => publicOrdersAPI.getById(id),
    { enabled: !!id }
  );

  const deepMutation = useMutation(
    () => publicOrdersAPI.deepAnalyze(id),
    {
      onSuccess: () => {
        toast.success('Głęboka analiza zakończona');
        queryClient.invalidateQueries(['publicOrder', id]);
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd analizy')
    }
  );

  if (!id) return null;

  const deep = data?.aiDeepAnalysis;
  const hasDeep = deep && deep.summary && !deep.error;
  const isAdmin = user?.role === 'admin';
  const canDeepAnalyze = isAdmin && data?.aiScore >= 5;

  const hasPricing = hasDeep && deep?.pricingScenarios && typeof deep.pricingScenarios === 'object';
  const tabs = [
    { key: 'info', label: 'Informacje' },
    { key: 'weDoIt', label: 'Robimy & terminy' },
    ...(data?.weDoIt ? [{ key: 'tasks', label: 'Zadania' }] : []),
    ...(hasDeep ? [
      { key: 'analysis', label: 'Analiza' },
      { key: 'actions', label: 'Kroki' },
      ...(hasPricing ? [{ key: 'pricing', label: 'Wycena' }] : []),
      { key: 'draft', label: 'Draft oferty' },
    ] : [])
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{data?.title || 'Szczegóły zlecenia'}</h2>
              {data?.weDoIt && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-600 text-white">
                  <ThumbsUp className="h-3 w-3" /> Robimy
                </span>
              )}
              {data && <AiBadge status={data.aiStatus} score={data.aiScore} />}
              {hasDeep && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                  <BrainCircuit className="h-3 w-3" /> Deep Analysis
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none ml-2 shrink-0">&times;</button>
          </div>
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
          ) : !data ? (
            <p className="text-gray-500">Brak danych.</p>
          ) : (
            <>
              {/* ──── TAB: Informacje ──── */}
              {activeTab === 'info' && (
                <div className="space-y-4 text-sm">
                  {data.aiStatus && data.aiStatus !== 'pending' && (
                    <div className={`rounded-lg p-3 ${
                      data.aiStatus === 'rejected' ? 'bg-red-50 border border-red-200' :
                      data.aiStatus === 'scored' ? 'bg-emerald-50 border border-emerald-200' :
                      'bg-orange-50 border border-orange-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4" /> Ocena AI
                        </span>
                        {data.aiScore != null && <ScoreBar score={data.aiScore} />}
                      </div>
                      {data.aiAnalysis && <p className="text-sm">{data.aiAnalysis}</p>}
                      {data.aiRejectionReason && <p className="text-sm text-red-600">{data.aiRejectionReason}</p>}
                    </div>
                  )}

                  {/* Deep analysis trigger */}
                  {canDeepAnalyze && !hasDeep && (
                    <button
                      type="button"
                      onClick={() => deepMutation.mutate()}
                      disabled={deepMutation.isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {deepMutation.isLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizuję z Sonnet (może potrwać ~30s)...</>
                        : <><BrainCircuit className="h-4 w-4" /> Uruchom głęboką analizę AI</>
                      }
                    </button>
                  )}

                  {/* Deep summary preview */}
                  {hasDeep && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <BrainCircuit className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-violet-900 text-sm">Głęboka analiza AI (Sonnet)</p>
                          <p className="text-sm text-violet-800 mt-1">{deep.summary}</p>
                        </div>
                      </div>
                      {deep.recommendation && (
                        <p className="text-sm text-violet-700 mt-2 font-medium border-t border-violet-200 pt-2">
                          Rekomendacja: {deep.recommendation}
                        </p>
                      )}
                      <p className="text-xs text-violet-400 mt-2">Przełącz na zakładki „Analiza", „Kroki"{hasPricing ? ', „Wycena"' : ''}, „Draft oferty" po więcej.</p>
                    </div>
                  )}

                  <DetailRow label="Przedmiot" value={data.title} />
                  <DetailRow label="Zamawiający" value={data.investor} />
                  {data.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span>{data.address}</span>
                    </div>
                  )}
                  <DetailRow label="Województwo / powiat" value={data.voivodeshipDistrict || data.region} />
                  {data.email && (
                    <div>
                      <span className="font-medium text-gray-500">E-mail:</span>
                      <a href={`mailto:${data.email}`} className="mt-1 text-primary-600 hover:underline block">{data.email}</a>
                    </div>
                  )}
                  <DetailRow label="Telefon / fax" value={data.phoneFax} />
                  {data.website && (
                    <div>
                      <span className="font-medium text-gray-500">Strona www:</span>
                      <a href={data.website} target="_blank" rel="noopener noreferrer" className="mt-1 text-primary-600 hover:underline block">{data.website}</a>
                    </div>
                  )}
                  <DetailRow label="Opis" value={data.description} pre />
                  <DetailRow label="Wymagania" value={data.requirements} pre />
                  {(data.submissionPlaceAndDeadline || data.submissionDeadline) && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span>{data.submissionPlaceAndDeadline || (data.submissionDeadline ? `Termin składania: ${format(new Date(data.submissionDeadline), 'yyyy-MM-dd', { locale: pl })}` : '')}</span>
                    </div>
                  )}
                  {data.placeAndTerm && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span>{data.placeAndTerm}</span>
                    </div>
                  )}
                  <DetailRow label="Uwagi" value={data.remarks} pre />
                  <DetailRow label="Kontakt" value={data.contact} pre />
                  {data.detailUrl && (
                    <a
                      href={data.detailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary-600 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Otwórz na biznes-polska.pl
                    </a>
                  )}
                </div>
              )}

              {/* ──── TAB: Robimy & terminy ──── */}
              {activeTab === 'weDoIt' && (
                <OrderWeDoItTab orderId={id} data={data} onUpdate={() => queryClient.invalidateQueries(['publicOrder', id])} />
              )}

              {/* ──── TAB: Zadania (tylko gdy Robimy) ──── */}
              {activeTab === 'tasks' && data?.weDoIt && (
                <OrderTasksTab orderId={id} orderTitle={data.title} onUpdate={() => queryClient.invalidateQueries(['publicOrder', id])} />
              )}

              {/* ──── TAB: Analiza ──── */}
              {activeTab === 'analysis' && hasDeep && (
                <div className="space-y-6 text-sm">
                  {/* Podsumowanie */}
                  <DeepSection icon={Target} title="Podsumowanie" color="violet">
                    <p>{deep.summary}</p>
                  </DeepSection>

                  {/* Zakres prac */}
                  {deep.scope?.length > 0 && (
                    <DeepSection icon={ClipboardList} title="Zakres prac" color="blue">
                      <ul className="space-y-1.5">
                        {deep.scope.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </DeepSection>
                  )}

                  {/* Kryteria oceny */}
                  {deep.evaluationCriteria?.length > 0 && (
                    <DeepSection icon={Target} title="Kryteria oceny ofert" color="amber">
                      <div className="space-y-2">
                        {deep.evaluationCriteria.map((c, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="font-bold text-amber-700 shrink-0 w-12 text-right">{c.weight}</span>
                            <div>
                              <span className="font-medium">{c.criterion}</span>
                              {c.description && <p className="text-gray-500 text-xs mt-0.5">{c.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DeepSection>
                  )}

                  {/* Trudności */}
                  {deep.potentialDifficulties?.length > 0 && (
                    <DeepSection icon={AlertTriangle} title="Potencjalne trudności" color="red">
                      <ul className="space-y-1.5">
                        {deep.potentialDifficulties.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </DeepSection>
                  )}

                  {/* Terminy */}
                  {deep.deadlines?.length > 0 && (
                    <DeepSection icon={Clock} title="Kluczowe terminy" color="orange">
                      <div className="space-y-1.5">
                        {deep.deadlines.map((d, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="font-mono text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded shrink-0">{d.date}</span>
                            <span>{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </DeepSection>
                  )}

                  {/* Szacowana wartość */}
                  {deep.estimatedValue && (
                    <DeepSection icon={FileText} title="Szacowana wartość" color="green">
                      <p className="font-semibold text-green-800">{deep.estimatedValue}</p>
                    </DeepSection>
                  )}

                  {/* Kontakt */}
                  {deep.keyContacts && (
                    <DeepSection icon={MapPin} title="Kontakt" color="gray">
                      <p className="whitespace-pre-wrap">{deep.keyContacts}</p>
                    </DeepSection>
                  )}

                  {/* Rekomendacja */}
                  {deep.recommendation && (
                    <div className="bg-violet-50 border-2 border-violet-300 rounded-lg p-4">
                      <p className="font-semibold text-violet-900 flex items-center gap-2 mb-1">
                        <BrainCircuit className="h-5 w-5" /> Rekomendacja
                      </p>
                      <p className="text-violet-800">{deep.recommendation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ──── TAB: Kroki do złożenia oferty ──── */}
              {activeTab === 'actions' && hasDeep && (
                <div className="space-y-6 text-sm">
                  {deep.requiredActions?.length > 0 && (
                    <DeepSection icon={CheckCircle2} title="Kroki do złożenia oferty" color="emerald">
                      <ol className="space-y-3">
                        {deep.requiredActions.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </DeepSection>
                  )}

                  {deep.requiredDocuments?.length > 0 && (
                    <DeepSection icon={FileText} title="Wymagane dokumenty" color="blue">
                      <ul className="space-y-1.5">
                        {deep.requiredDocuments.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </DeepSection>
                  )}
                </div>
              )}

              {/* ──── TAB: Scenariusze wyceny ──── */}
              {activeTab === 'pricing' && hasDeep && deep.pricingScenarios && (
                <div className="space-y-6 text-sm">
                  <p className="text-gray-500 text-xs">AI przygotowało 3 scenariusze wyceny. Wybierz jeden do draftu oferty.</p>
                  {[
                    { key: 'ekstremalnieAgresywna', title: 'Ekstremalnie agresywna (~99% szans na wygraną)', color: 'emerald', border: 'border-emerald-300', bg: 'bg-emerald-50' },
                    { key: 'agresywna', title: 'Agresywna', color: 'amber', border: 'border-amber-300', bg: 'bg-amber-50' },
                    { key: 'standardowa', title: 'Standardowa', color: 'blue', border: 'border-blue-300', bg: 'bg-blue-50' },
                  ].map(({ key, title, border, bg }) => {
                    const s = deep.pricingScenarios[key];
                    if (!s || typeof s !== 'object') return null;
                    return (
                      <div key={key} className={`rounded-xl border-2 ${border} ${bg} p-4 space-y-2`}>
                        <h4 className="font-semibold text-gray-900">{title}</h4>
                        {s.amount && (
                          <p className="text-base font-bold text-gray-800">Kwota: {s.amount}</p>
                        )}
                        {s.description && <p className="text-gray-700">{s.description}</p>}
                        {s.rationale && <p className="text-xs text-gray-600 italic">{s.rationale}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ──── TAB: Draft oferty ──── */}
              {activeTab === 'draft' && hasDeep && (
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Miejsca oznaczone [DO UZUPEŁNIENIA] wymagają edycji przed wysłaniem.</p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(deep.offerDraft || '');
                        toast.success('Skopiowano draft oferty');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Kopiuj do schowka
                    </button>
                  </div>
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
                      {(deep.offerDraft || '').replace(/\[DO UZUPEŁNIENIA\]/g, '⬜ [DO UZUPEŁNIENIA]')}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeepSection({ icon: Icon, title, color, children }) {
  const colorMap = {
    violet: 'border-violet-200 bg-violet-50/50',
    blue: 'border-blue-200 bg-blue-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    red: 'border-red-200 bg-red-50/50',
    orange: 'border-orange-200 bg-orange-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    green: 'border-green-200 bg-green-50/50',
    gray: 'border-gray-200 bg-gray-50/50',
  };
  const iconColorMap = {
    violet: 'text-violet-600', blue: 'text-blue-600', emerald: 'text-emerald-600',
    red: 'text-red-600', orange: 'text-orange-600', amber: 'text-amber-600',
    green: 'text-green-600', gray: 'text-gray-600',
  };
  return (
    <div className={`border rounded-lg p-4 ${colorMap[color] || colorMap.gray}`}>
      <p className={`font-semibold flex items-center gap-2 mb-3 ${iconColorMap[color] || 'text-gray-700'}`}>
        <Icon className="h-5 w-5" /> {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value, pre }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium text-gray-500">{label}:</span>
      <p className={`mt-1 text-gray-700 ${pre ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
    </div>
  );
}

export default ZleceniaPubliczne;
