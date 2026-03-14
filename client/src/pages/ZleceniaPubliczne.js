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
  RotateCcw
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
  const isBusy = syncMutation.isLoading || aiMutation.isLoading || resetMutation.isLoading;

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
                        <AiBadge status={row.aiStatus} score={row.aiScore} />
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
  const { data, isLoading } = useQuery(
    ['publicOrder', id],
    () => publicOrdersAPI.getById(id),
    { enabled: !!id }
  );

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Szczegóły zlecenia</h2>
            {data && <AiBadge status={data.aiStatus} score={data.aiScore} />}
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
          ) : !data ? (
            <p className="text-gray-500">Brak danych.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {/* AI section */}
              {data.aiStatus && data.aiStatus !== 'pending' && (
                <div className={`rounded-lg p-3 ${
                  data.aiStatus === 'rejected' ? 'bg-red-50 border border-red-200' :
                  data.aiStatus === 'scored' ? 'bg-emerald-50 border border-emerald-200' :
                  'bg-orange-50 border border-orange-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Analiza AI
                    </span>
                    {data.aiScore != null && <ScoreBar score={data.aiScore} />}
                  </div>
                  {data.aiAnalysis && <p className="text-sm">{data.aiAnalysis}</p>}
                  {data.aiRejectionReason && <p className="text-sm text-red-600">{data.aiRejectionReason}</p>}
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
              {data.placeAndTerm && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span>{data.placeAndTerm}</span>
                </div>
              )}
              <DetailRow label="Uwagi" value={data.remarks} pre />
              <DetailRow label="Kontakt" value={data.contact} pre />
              {data.detailFullText && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <span className="font-medium text-gray-500">Pełna treść (do oceny AI):</span>
                  <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">{data.detailFullText}</pre>
                </div>
              )}
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
        </div>
      </div>
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
