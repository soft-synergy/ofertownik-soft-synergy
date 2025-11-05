import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, hostingAPI } from '../services/api';

const ClientPortal = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/api/client-portal/${token}`);
        setData(res.data);
      } catch (e) {
        setError(e?.response?.data?.message || 'Nie udało się pobrać danych');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

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

  const toBackendUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Ładowanie…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded Hero */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-extrabold tracking-tight">Soft<span className="text-primary-200">Synergy</span></div>
              <span className="hidden md:inline text-primary-200/80 text-sm">Client Portal</span>
            </div>
            <div className="text-sm text-primary-100/80">
              {new Date().toLocaleDateString()}
            </div>
          </div>
          <div className="mt-6">
            <h1 className="text-3xl md:text-4xl font-semibold">{data.client.name}</h1>
            <div className="mt-1 text-primary-100/90">{data.client.company || ''}</div>
            <div className="mt-2 text-sm text-primary-100/80">{data.client.email || '-'} {data.client.phone ? `· ${data.client.phone}` : ''}</div>
          </div>
          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-primary-200">Projekty</div>
              <div className="text-2xl font-bold">{data.projects.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-primary-200">Hosting</div>
              <div className="text-2xl font-bold">{data.hostings.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-primary-200">Status</div>
              <div className="text-2xl font-bold">Aktywny</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Projects Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Projekty</h2>
          </div>
          {data.projects.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border text-sm text-gray-500">Brak projektów</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.projects.map(p => (
                <div key={p._id} className="bg-white rounded-lg border p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{p.name}</div>
                      <div className="mt-1 text-xs text-gray-500">Status: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'accepted' ? 'bg-green-100 text-green-700' : p.status === 'active' ? 'bg-blue-100 text-blue-700' : p.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {p.generatedOfferUrl && (
                      <a href={toBackendUrl(p.generatedOfferUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700">Podgląd oferty</a>
                    )}
                    {p.workSummaryUrl && (
                      <a href={toBackendUrl(p.workSummaryUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded-md border text-gray-700 hover:bg-gray-50">Podsumowanie prac</a>
                    )}
                    {p.workSummaryPdfUrl && (
                      <a href={toBackendUrl(p.workSummaryPdfUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded-md border text-gray-700 hover:bg-gray-50">Podsumowanie PDF</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Documents / Invoices Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Dokumenty</h2>
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
              return <div className="p-6 bg-white rounded-lg border text-sm text-gray-500">Brak dokumentów</div>;
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
                  <div key={monthKey} className="bg-white rounded-lg border overflow-hidden">
                    <div className="px-6 py-3 bg-gray-50 text-sm font-medium text-gray-700">{monthKey}</div>
                    <div className="divide-y divide-gray-100">
                      {groups[monthKey].map((d, idx) => (
                        <div key={`${d.filePath}-${idx}`} className="px-6 py-3 flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{d.originalName}</div>
                            <div className="text-xs text-gray-500">{(d.type || '').toUpperCase()} · Projekt: {d.projectName}</div>
                          </div>
                          <a href={toBackendUrl(d.filePath)} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded-md border text-gray-700 hover:bg-gray-50">Pobierz</a>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Hosting</h2>
            <div className="flex items-center gap-2">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-3 py-1 text-sm" />
              <span className="text-xs text-gray-500">Miesiąc raportu</span>
            </div>
          </div>
          {/* Cadence badge / explainer */}
          <div className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-emerald-100 rounded-lg p-4">
            <div className="text-sm text-emerald-800">
              System monitoruje Twoje strony automatycznie co 5 minut. Raport CSV zawiera każdy techniczny check wykonany w wybranym miesiącu.
            </div>
          </div>
          {data.hostings.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border text-sm text-gray-500">Brak hostingu</div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domena</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nast. rozliczenie</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monitoring</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raport</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {data.hostings.map(h => (
                    <tr key={h._id}>
                      <td className="px-6 py-3 text-sm text-gray-900">{h.domain}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${h.status === 'active' ? 'bg-green-100 text-green-700' : h.status === 'overdue' ? 'bg-yellow-100 text-yellow-700' : h.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{h.status}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{h.nextPaymentDate ? new Date(h.nextPaymentDate).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">auto-check co 5 min</span>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <button onClick={() => downloadHostingCsv(h._id)} className="inline-flex items-center px-3 py-2 text-sm rounded-md border text-gray-700 hover:bg-gray-50">Pobierz CSV</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Brand Footer */}
        <footer className="pt-6 border-t text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <div>© {new Date().getFullYear()} SoftSynergy</div>
            <div className="text-gray-400">Zaufanie. Transparentność. Wynik.</div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ClientPortal;


