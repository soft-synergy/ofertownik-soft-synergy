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
  Loader2
} from 'lucide-react';

const ZleceniaPubliczne = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading } = useQuery(
    ['publicOrders', page, search, region],
    () => publicOrdersAPI.getAll({ page, limit: 20, search: search || undefined, region: region || undefined }),
    { keepPreviousData: true }
  );

  const syncMutation = useMutation(publicOrdersAPI.sync, {
    onSuccess: (res) => {
      toast.success(res.message || 'Synchronizacja zakończona');
      if (res.errors?.length) toast.error(`${res.errors.length} błędów – sprawdź konsolę`);
      queryClient.invalidateQueries('publicOrders');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd synchronizacji')
  });

  const items = data?.items || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  const handleSync = () => {
    syncMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zlecenia publiczne</h1>
          <p className="text-sm text-gray-500 mt-1">
            Import z Grupy Biznes Polska (przetargi, zlecenia, inwestycje, dotacje, kupno, oferty, pozwolenia)
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncMutation.isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncMutation.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            Aktualizuj
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj (tytuł, opis, zamawiający, ID…)"
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            Brak zleceń. {user?.role === 'admin' && 'Kliknij „Aktualizuj”, aby pobrać ogłoszenia z Biznes Polska.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Przedmiot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Województwo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Link</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((row) => (
                    <tr
                      key={row._id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{row.biznesPolskaId}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(selectedId === row._id ? null : row._id)}
                          className="text-left text-sm font-medium text-primary-600 hover:underline"
                        >
                          {row.title?.slice(0, 80)}{row.title?.length > 80 ? '…' : ''}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.region || '–'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.addedDate ? format(new Date(row.addedDate), 'd MMM y', { locale: pl }) : '–'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.detailUrl && (
                          <a
                            href={row.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Otwórz
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedId && (
              <OrderDetailPopup
                id={selectedId}
                onClose={() => setSelectedId(null)}
              />
            )}

            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Strona {page} z {totalPages} • Łącznie {total} zleceń
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <h2 className="text-lg font-semibold text-gray-900">Szczegóły zlecenia</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
          ) : !data ? (
            <p className="text-gray-500">Brak danych.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Przedmiot:</span>
                <p className="mt-1 text-gray-900">{data.title}</p>
              </div>
              {data.investor && (
                <div>
                  <span className="font-medium text-gray-500">Zamawiający:</span>
                  <p className="mt-1">{data.investor}</p>
                </div>
              )}
              {data.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span>{data.address}</span>
                </div>
              )}
              {(data.voivodeshipDistrict || data.region) && (
                <div>
                  <span className="font-medium text-gray-500">Województwo / powiat:</span>
                  <p className="mt-1">{data.voivodeshipDistrict || data.region}</p>
                </div>
              )}
              {data.email && (
                <div>
                  <span className="font-medium text-gray-500">E-mail:</span>
                  <a href={`mailto:${data.email}`} className="mt-1 text-primary-600 hover:underline block">{data.email}</a>
                </div>
              )}
              {data.phoneFax && (
                <div>
                  <span className="font-medium text-gray-500">Telefon / fax:</span>
                  <p className="mt-1">{data.phoneFax}</p>
                </div>
              )}
              {data.website && (
                <div>
                  <span className="font-medium text-gray-500">Strona www:</span>
                  <a href={data.website} target="_blank" rel="noopener noreferrer" className="mt-1 text-primary-600 hover:underline block">{data.website}</a>
                </div>
              )}
              {data.description && (
                <div>
                  <span className="font-medium text-gray-500">Opis:</span>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{data.description}</p>
                </div>
              )}
              {data.placeAndTerm && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span>{data.placeAndTerm}</span>
                </div>
              )}
              {data.remarks && (
                <div>
                  <span className="font-medium text-gray-500">Uwagi:</span>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{data.remarks}</p>
                </div>
              )}
              {data.contact && (
                <div>
                  <span className="font-medium text-gray-500">Kontakt:</span>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{data.contact}</p>
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

export default ZleceniaPubliczne;
