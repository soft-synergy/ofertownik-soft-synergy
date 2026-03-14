import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { publicOrdersAPI } from '../services/api';
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
  BrainCircuit
} from 'lucide-react';

const AI_STATUS_CONFIG = {
  pending:   { label: 'Oczekuje',   bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  rejected:  { label: 'Odrzucone',  bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500' },
  candidate: { label: 'Kandydat',   bg: 'bg-orange-50',   text: 'text-orange-700', dot: 'bg-orange-500' },
  scored:    { label: 'Ocenione',   bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
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

const AI_TABS = [
  { key: 'all',       label: 'Wszystkie' },
  { key: 'scored',    label: 'Ocenione AI' },
  { key: 'pending',   label: 'Oczekujące' },
  { key: 'rejected',  label: 'Odrzucone' },
];

const ZleceniaPubliczne = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [aiTab, setAiTab] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading } = useQuery(
    ['publicOrders', page, search, region, aiTab],
    () => publicOrdersAPI.getAll({
      page,
      limit: 20,
      search: search || undefined,
      region: region || undefined,
      aiStatus: aiTab !== 'all' ? aiTab : undefined
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
          </div>
        )}
      </div>

      {/* AI stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            Brak zleceń{aiTab !== 'all' ? ` w kategorii "${AI_TABS.find(t => t.key === aiTab)?.label}"` : ''}.
            {isAdmin && aiTab === 'all' && ' Kliknij „Aktualizuj", aby pobrać ogłoszenia z Biznes Polska.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                    <tr key={row._id} className={`hover:bg-gray-50/50 ${rowBgClass(row)}`}>
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

  const tabs = [
    { key: 'info', label: 'Informacje' },
    ...(hasDeep ? [
      { key: 'analysis', label: 'Analiza' },
      { key: 'actions', label: 'Kroki' },
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
                      <p className="text-xs text-violet-400 mt-2">Przełącz na zakładki „Analiza", „Kroki", „Draft oferty" po więcej.</p>
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
