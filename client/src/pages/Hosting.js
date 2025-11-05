import React, { useEffect, useMemo, useState } from 'react';
import { hostingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

const Hosting = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitors, setMonitors] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hostingAPI.getMonitorStatus();
      setMonitors(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const downCount = useMemo(() => monitors.filter(m => m.alarmActive || m.isDown).length, [monitors]);

  const handleAck = async (id) => {
    try {
      await hostingAPI.ackMonitor(id);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await hostingAPI.downloadMonthlyReport(month);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitoring-${month}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error');
    }
  };

  if (user?.role !== 'admin') {
    return <div className="text-sm text-gray-600">{t('hosting.adminOnly') || 'Admin only'}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('hosting.header') || 'Hosting monitoring'}</h1>
          <p className="text-sm text-gray-500">{t('hosting.subheader') || 'Status, alerts and monthly reports'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <button onClick={handleDownload} className="px-3 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700">
            {t('buttons.download')}
          </button>
          <button onClick={refresh} className="px-3 py-2 text-sm rounded border text-gray-700 hover:bg-gray-50">
            {t('hosting.refresh') || 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-4">
        <span className="text-sm text-gray-700">
          {t('hosting.summary') || 'Down/Alerts'}: {downCount} / {monitors.length}
        </span>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.domain') || 'Domain'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.url') || 'URL'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.status') || 'Status'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.lastCheck') || 'Last check'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.code') || 'Code'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.rt') || 'RT (ms)'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.error') || 'Error'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.snapshot') || 'Snapshot'}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('hosting.actions') || 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-4 py-3 text-sm text-gray-500" colSpan={9}>{t('common.loading')}</td>
              </tr>
            ) : monitors.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-sm text-gray-500" colSpan={9}>{t('hosting.empty') || 'No monitors'}</td>
              </tr>
            ) : (
              monitors.map((m) => {
                const isAlert = m.alarmActive || m.isDown;
                return (
                  <tr key={m.id} className={isAlert ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">{m.domain || '-'}</td>
                    <td className="px-4 py-3 text-sm text-blue-600"><a href={m.url} target="_blank" rel="noreferrer">{m.url}</a></td>
                    <td className="px-4 py-3 text-sm">
                      {isAlert ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-red-800 bg-red-100 text-xs font-medium">
                          {m.acknowledged ? (t('hosting.acknowledged') || 'Acknowledged') : (t('hosting.down') || 'DOWN')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-green-800 bg-green-100 text-xs font-medium">{t('hosting.up') || 'UP'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{m.lastStatusCode ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{m.lastResponseTimeMs ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 truncate max-w-xs" title={m.lastError || ''}>{m.lastError || ''}</td>
                    <td className="px-4 py-3 text-sm">
                      {m.lastHtmlPath ? (
                        <a href={m.lastHtmlPath.startsWith('/uploads') ? m.lastHtmlPath : `/` + m.lastHtmlPath} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {t('hosting.viewSnapshot') || 'View'}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isAlert && !m.acknowledged && (
                        <button onClick={() => handleAck(m.id)} className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700">
                          {t('hosting.ack') || 'Acknowledge'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Hosting;
