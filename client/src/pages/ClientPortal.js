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

  const fetchData = React.useCallback(async () => {
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
      setLoading(false);
    }
  }, [token]);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Ładowanie…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center text-red-600">{loadError}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="SoftSynergy" className="h-12 w-auto" />
              <div>
                <div className="text-2xl font-extrabold tracking-tight">Soft<span className="text-orange-400">Synergy</span></div>
                <span className="hidden md:inline text-blue-200/80 text-sm">Client Portal</span>
              </div>
            </div>
            <div className="text-sm text-blue-200/80">
              {new Date().toLocaleDateString('pl-PL')}
            </div>
          </div>
          <div className="mt-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">{data.client.name}</h1>
            <div className="mt-2 text-blue-100/90 text-lg">{data.client.company || ''}</div>
            <div className="mt-3 text-sm text-blue-200/80">{data.client.email || '-'} {data.client.phone ? `· ${data.client.phone}` : ''}</div>
          </div>
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
              {data.projects.map(p => (
                <div key={p._id} className="bg-white rounded-xl border-2 border-gray-100 p-6 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xl font-bold text-gray-900 mb-2">{p.name}</div>
                      <div className="mt-1 text-xs text-gray-500">Status: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'accepted' ? 'bg-green-100 text-green-700' : p.status === 'active' ? 'bg-blue-100 text-blue-700' : p.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></div>
                    </div>
                  </div>
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
                </div>
              ))}
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
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
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${h.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : h.status === 'overdue' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : h.status === 'suspended' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{h.status}</span>
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
              <img src={logoUrl} alt="SoftSynergy" className="h-8 w-auto opacity-60" />
              <div className="text-sm text-gray-600">© {new Date().getFullYear()} SoftSynergy</div>
            </div>
            <div className="text-sm text-gray-500 font-medium">budujemy software, efektywnie</div>
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


