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

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  Calendar,
  FileText,
  Search,
  Filter,
  Globe
} from 'lucide-react';
import { hostingAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Hosting = () => {
  const [filters, setFilters] = useState({
    status: '',
    overdue: '',
    search: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedHosting, setSelectedHosting] = useState(null);
  const [formData, setFormData] = useState({
    domain: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    monthlyPrice: '',
    billingCycle: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    nextPaymentDate: ''
  });

  const queryClient = useQueryClient();

  const { data: hosting = [], isLoading } = useQuery(
    ['hosting', filters],
    () => hostingAPI.getAll(filters)
  );

  const { data: stats } = useQuery('hostingStats', hostingAPI.getStats);

  const createMutation = useMutation(hostingAPI.create, {
    onSuccess: () => {
      toast.success('Hosting został dodany');
      queryClient.invalidateQueries('hosting');
      queryClient.invalidateQueries('hostingStats');
      setShowForm(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Błąd podczas dodawania hostingu');
    }
  });

  const updateMutation = useMutation(
    ({ id, data }) => hostingAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Hosting został zaktualizowany');
        queryClient.invalidateQueries('hosting');
        queryClient.invalidateQueries('hostingStats');
        setSelectedHosting(null);
        setShowForm(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Błąd podczas aktualizacji hostingu');
      }
    }
  );

  const deleteMutation = useMutation(hostingAPI.delete, {
    onSuccess: () => {
      toast.success('Hosting został usunięty');
      queryClient.invalidateQueries('hosting');
      queryClient.invalidateQueries('hostingStats');
    },
    onError: () => {
      toast.error('Błąd podczas usuwania hostingu');
    }
  });

  const paymentMutation = useMutation(
    ({ id, data }) => hostingAPI.recordPayment(id, data),
    {
      onSuccess: () => {
        toast.success('Płatność została zapisana');
        queryClient.invalidateQueries('hosting');
        queryClient.invalidateQueries('hostingStats');
        setShowPaymentModal(false);
        setSelectedHosting(null);
      },
      onError: () => {
        toast.error('Błąd podczas zapisywania płatności');
      }
    }
  );

  const reminderMutation = useMutation(
    ({ id, data }) => hostingAPI.addReminder(id, data),
    {
      onSuccess: () => {
        toast.success('Przypomnienie zostało dodane');
        queryClient.invalidateQueries('hosting');
        setShowReminderModal(false);
        setSelectedHosting(null);
      },
      onError: () => {
        toast.error('Błąd podczas dodawania przypomnienia');
      }
    }
  );

  const statusMutation = useMutation(
    ({ id, status }) => hostingAPI.updateStatus(id, status),
    {
      onSuccess: () => {
        toast.success('Status został zaktualizowany');
        queryClient.invalidateQueries('hosting');
        queryClient.invalidateQueries('hostingStats');
      },
      onError: () => {
        toast.error('Błąd podczas aktualizacji statusu');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      domain: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      monthlyPrice: '',
      billingCycle: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      nextPaymentDate: ''
    });
    setSelectedHosting(null);
  };

  const handleEdit = (item) => {
    setSelectedHosting(item);
    setFormData({
      domain: item.domain,
      clientName: item.clientName,
      clientEmail: item.clientEmail || '',
      clientPhone: item.clientPhone || '',
      monthlyPrice: item.monthlyPrice.toString(),
      billingCycle: item.billingCycle,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
      nextPaymentDate: item.nextPaymentDate ? new Date(item.nextPaymentDate).toISOString().split('T')[0] : ''
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      monthlyPrice: parseFloat(formData.monthlyPrice),
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      nextPaymentDate: new Date(formData.nextPaymentDate).toISOString()
    };

    if (selectedHosting) {
      updateMutation.mutate({ id: selectedHosting._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePayment = (item) => {
    setSelectedHosting(item);
    setShowPaymentModal(true);
  };

  const handleReminder = (item) => {
    setSelectedHosting(item);
    setShowReminderModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten wpis hostingu?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusColor = (status, nextPaymentDate) => {
    const now = new Date();
    const paymentDate = new Date(nextPaymentDate);
    const isOverdue = paymentDate < now && status !== 'cancelled';

    if (status === 'cancelled') return 'bg-gray-500';
    if (status === 'suspended') return 'bg-red-500';
    if (status === 'overdue' || isOverdue) return 'bg-red-600';
    if (status === 'active') return 'bg-green-500';
    return 'bg-gray-400';
  };

  const getStatusLabel = (status, nextPaymentDate) => {
    const now = new Date();
    const paymentDate = new Date(nextPaymentDate);
    const isOverdue = paymentDate < now && status !== 'cancelled';

    if (status === 'cancelled') return 'Anulowane';
    if (status === 'suspended') return 'Zawieszone';
    if (status === 'overdue' || isOverdue) return 'Opóźnione';
    if (status === 'active') return 'Aktywne';
    return status;
  };

  const getBillingCycleLabel = (cycle) => {
    const labels = {
      monthly: 'Miesięcznie',
      quarterly: 'Kwartalnie',
      yearly: 'Rocznie'
    };
    return labels[cycle] || cycle;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hosting</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj hostowanymi stronami i płatnościami
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj hosting
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-sm text-gray-500">Wszystkie</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Aktywne</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Opóźnione</div>
            <div className="text-2xl font-bold text-red-600">{stats.overduePayments}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Zawieszone</div>
            <div className="text-2xl font-bold text-orange-600">{stats.suspended}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Przychód/mies.</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalMonthlyRevenue.toFixed(0)} PLN</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Szukaj</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input-field pl-10"
                placeholder="Domena, klient..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Wszystkie</option>
              <option value="active">Aktywne</option>
              <option value="overdue">Opóźnione</option>
              <option value="suspended">Zawieszone</option>
              <option value="cancelled">Anulowane</option>
            </select>
          </div>
          <div>
            <label className="form-label">Filtry</label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.overdue === 'true'}
                  onChange={(e) => setFilters({ ...filters, overdue: e.target.checked ? 'true' : '' })}
                  className="mr-2"
                />
                <span className="text-sm">Tylko przeterminowane</span>
              </label>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', overdue: '', search: '' })}
              className="btn-secondary w-full"
            >
              Wyczyść
            </button>
          </div>
        </div>
      </div>

      {/* Hosting List */}
      <div className="space-y-4">
        {hosting.map((item) => {
          const now = new Date();
          const paymentDate = new Date(item.nextPaymentDate);
          const isOverdue = paymentDate < now && item.status !== 'cancelled';
          
          return (
            <div key={item._id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{item.domain}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(item.status, item.nextPaymentDate)}`}>
                      {getStatusLabel(item.status, item.nextPaymentDate)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Klient</div>
                      <div className="font-medium">{item.clientName}</div>
                      {item.clientEmail && (
                        <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {item.clientEmail}
                        </div>
                      )}
                      {item.clientPhone && (
                        <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {item.clientPhone}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Płatność</div>
                      <div className="font-medium">{item.monthlyPrice} PLN / {getBillingCycleLabel(item.billingCycle)}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        Następna: {format(new Date(item.nextPaymentDate), 'dd.MM.yyyy')}
                      </div>
                      {item.lastPaymentDate && (
                        <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Ostatnia: {format(new Date(item.lastPaymentDate), 'dd.MM.yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.notes && (
                    <div className="text-sm text-gray-600 mb-2">
                      <FileText className="h-3 w-3 inline mr-1" />
                      {item.notes}
                    </div>
                  )}
                  {item.paymentHistory && item.paymentHistory.length > 0 && (
                    <div className="text-sm text-gray-500 mt-2">
                      Historia płatności: {item.paymentHistory.length} wpisów
                    </div>
                  )}
                  {item.reminders && item.reminders.length > 0 && (
                    <div className="text-sm text-yellow-600 mt-1">
                      Przypomnienia: {item.reminders.length} wysłanych
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handlePayment(item)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    title="Zapisz płatność"
                  >
                    <DollarSign className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleReminder(item)}
                    className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                    title="Dodaj przypomnienie"
                  >
                    <Mail className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edytuj"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Usuń"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  {item.status === 'active' && isOverdue && (
                    <button
                      onClick={() => statusMutation.mutate({ id: item._id, status: 'overdue' })}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                      title="Oznacz jako opóźnione"
                    >
                      <AlertCircle className="h-5 w-5" />
                    </button>
                  )}
                  {item.status === 'overdue' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: item._id, status: 'suspended' })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Zawieś"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  )}
                  {item.status === 'suspended' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: item._id, status: 'active' })}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Przywróć"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {hosting.length === 0 && (
          <div className="card text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Brak hostingu</h3>
            <p className="text-gray-500 mb-4">Dodaj pierwszą stronę do hostingu</p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2 inline" />
              Dodaj hosting
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {selectedHosting ? 'Edytuj hosting' : 'Dodaj hosting'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Domena *</label>
                    <input
                      type="text"
                      className="input-field"
                      required
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
                      placeholder="example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Cena miesięczna (PLN) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      required
                      value={formData.monthlyPrice}
                      onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                      placeholder="100.00"
                    />
                  </div>
                  <div>
                    <label className="form-label">Klient *</label>
                    <input
                      type="text"
                      className="input-field"
                      required
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Email klienta</label>
                    <input
                      type="email"
                      className="input-field"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Telefon klienta</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Cykl rozliczeniowy</label>
                    <select
                      className="input-field"
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    >
                      <option value="monthly">Miesięcznie</option>
                      <option value="quarterly">Kwartalnie</option>
                      <option value="yearly">Rocznie</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Data rozpoczęcia</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Następna płatność *</label>
                    <input
                      type="date"
                      className="input-field"
                      required
                      value={formData.nextPaymentDate}
                      onChange={(e) => setFormData({ ...formData, nextPaymentDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="btn-secondary"
                  >
                    Anuluj
                  </button>
                  <button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
                    {selectedHosting ? 'Zapisz' : 'Dodaj'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedHosting && (
        <PaymentModal
          hosting={selectedHosting}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedHosting(null);
          }}
          onSubmit={(data) => paymentMutation.mutate({ id: selectedHosting._id, data })}
          isLoading={paymentMutation.isLoading}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && selectedHosting && (
        <ReminderModal
          hosting={selectedHosting}
          onClose={() => {
            setShowReminderModal(false);
            setSelectedHosting(null);
          }}
          onSubmit={(data) => reminderMutation.mutate({ id: selectedHosting._id, data })}
          isLoading={reminderMutation.isLoading}
        />
      )}
    </div>
  );
};

// Payment Modal Component
const PaymentModal = ({ hosting, onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    amount: hosting.monthlyPrice.toString(),
    paidDate: new Date().toISOString().split('T')[0],
    periodStart: hosting.lastPaymentDate 
      ? new Date(new Date(hosting.lastPaymentDate).setMonth(new Date(hosting.lastPaymentDate).getMonth() + 1)).toISOString().split('T')[0]
      : hosting.startDate 
      ? new Date(hosting.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    periodEnd: hosting.nextPaymentDate 
      ? new Date(hosting.nextPaymentDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      paidDate: new Date(formData.paidDate).toISOString(),
      periodStart: new Date(formData.periodStart).toISOString(),
      periodEnd: new Date(formData.periodEnd).toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Zapisz płatność</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Kwota (PLN) *</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Data płatności *</label>
              <input
                type="date"
                className="input-field"
                required
                value={formData.paidDate}
                onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Okres od *</label>
              <input
                type="date"
                className="input-field"
                required
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Okres do *</label>
              <input
                type="date"
                className="input-field"
                required
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Notatki</label>
              <textarea
                className="input-field"
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Anuluj
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                Zapisz
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Reminder Modal Component
const ReminderModal = ({ hosting, onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    type: 'payment_due',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Dodaj przypomnienie</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Typ przypomnienia *</label>
              <select
                className="input-field"
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="payment_due">Płatność do zapłacenia</option>
                <option value="overdue">Przeterminowana płatność</option>
                <option value="suspension_warning">Ostrzeżenie o zawieszeniu</option>
              </select>
            </div>
            <div>
              <label className="form-label">Notatki</label>
              <textarea
                className="input-field"
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Anuluj
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                Dodaj
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Hosting;
