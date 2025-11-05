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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Ładowanie…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Panel klienta</h1>
        <div className="text-sm text-gray-600">{data.client.name} {data.client.company ? `· ${data.client.company}` : ''}</div>
        <div className="text-xs text-gray-500">{data.client.email || '-'} {data.client.phone ? `· ${data.client.phone}` : ''}</div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-3">Projekty</h2>
          {data.projects.length === 0 ? (
            <div className="text-sm text-gray-500">Brak projektów</div>
          ) : (
            <div className="space-y-2">
              {data.projects.map(p => (
                <div key={p._id} className="p-3 border rounded text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-gray-500">Status: {p.status}</div>
                  <div className="flex gap-3 mt-1">
                    {p.generatedOfferUrl && (<a href={p.generatedOfferUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Podgląd oferty</a>)}
                    {p.workSummaryUrl && (<a href={p.workSummaryUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Podsumowanie prac</a>)}
                    {p.workSummaryPdfUrl && (<a href={p.workSummaryPdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Podsumowanie PDF</a>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Hosting</h2>
            <div className="flex items-center gap-2">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-3 py-1 text-sm" />
              <span className="text-xs text-gray-500">Wybierz miesiąc dla raportów</span>
            </div>
          </div>
          {data.hostings.length === 0 ? (
            <div className="text-sm text-gray-500">Brak hostingu</div>
          ) : (
            <div className="space-y-2">
              {data.hostings.map(h => (
                <div key={h._id} className="p-3 border rounded text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{h.domain}</div>
                    <div className="text-gray-500 text-xs">Status: {h.status}</div>
                  </div>
                  <button onClick={() => downloadHostingCsv(h._id)} className="px-3 py-1 text-xs rounded border text-gray-700 hover:bg-gray-50">Pobierz raport CSV</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ClientPortal;


