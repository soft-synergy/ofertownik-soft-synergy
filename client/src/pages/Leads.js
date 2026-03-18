import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { leadsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUS_LABELS = {
  pending_review: 'Do oceny',
  approved: 'Do wysłania oferty',
  offer_sent: 'Oferta wysłana',
  rejected: 'Odrzucone',
};

function LeadStatusPill({ status }) {
  const map = {
    pending_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    offer_sent: 'bg-blue-100 text-blue-800',
    rejected: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function LeadForm({ onCreated }) {
  const [form, setForm] = useState({ sourceUrl: '', title: '', portal: '', notes: '' });
  const queryClient = useQueryClient();
  const mutation = useMutation((data) => leadsAPI.create(data), {
    onSuccess: () => {
      toast.success('Lead dodany do kolejki');
      setForm({ sourceUrl: '', title: '', portal: '', notes: '' });
      queryClient.invalidateQueries('leads');
      onCreated?.();
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Błąd dodawania leada');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.sourceUrl.trim() || !form.title.trim()) {
      toast.error('Uzupełnij link i tytuł');
      return;
    }
    mutation.mutate({
      sourceUrl: form.sourceUrl.trim(),
      title: form.title.trim(),
      portal: form.portal.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Nowy lead (Rizka)</h2>
          <p className="text-sm text-gray-500">
            Wklej link do ogłoszenia / projektu i krótko opisz, o co chodzi. Co 10 leadów pójdzie email do zespołu, żeby przejrzeć kandydatów.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link do ogłoszenia *</label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
            className="input-field w-full"
            placeholder="https://www.upwork.com/... albo inny portal"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł / nazwa leada *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="input-field w-full"
            placeholder="Np. Upwork – React developer do SaaS"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Portal / źródło</label>
          <input
            type="text"
            value={form.portal}
            onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value }))}
            className="input-field w-full"
            placeholder="Np. Upwork, Useme, inny"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notatki (opcjonalnie)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input-field w-full"
            rows={2}
            placeholder="Dlaczego ten lead jest ciekawy, wymagania, budżet itd."
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-primary inline-flex items-center gap-2"
          disabled={mutation.isLoading}
        >
          <Plus className="h-4 w-4" />
          {mutation.isLoading ? 'Dodaję...' : 'Dodaj leada'}
        </button>
      </div>
    </form>
  );
}

function OfferModal({ lead, onClose }) {
  const [form, setForm] = useState({
    content: '',
    valuePln: '',
    channel: lead?.portal || '',
  });
  const queryClient = useQueryClient();
  const mutation = useMutation(
    (data) => leadsAPI.saveOffer(lead._id, data),
    {
      onSuccess: () => {
        toast.success('Oferta zapisana');
        queryClient.invalidateQueries('leads');
        onClose();
      },
      onError: (e) => {
        toast.error(e.response?.data?.message || 'Błąd zapisu oferty');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.content.trim()) {
      toast.error('Opisz, co wysłaliśmy');
      return;
    }
    mutation.mutate({
      content: form.content.trim(),
      valuePln: form.valuePln ? Number(form.valuePln) : undefined,
      channel: form.channel.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Zapisz wysłaną ofertę</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
            Zamknij
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-900 mb-1">{lead?.title}</div>
            {lead?.sourceUrl && (
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                Otwórz ogłoszenie →
              </a>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Co wysłaliśmy? *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="input-field w-full min-h-[120px]"
              placeholder="Krótko: jaka oferta, jaki zakres, ewentualnie link do oferty z Ofertownika."
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wartość (PLN, opcjonalnie)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={form.valuePln}
                onChange={(e) => setForm((f) => ({ ...f, valuePln: e.target.value }))}
                className="input-field w-full"
                placeholder="Np. 15000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kanał / gdzie wysłano</label>
              <input
                type="text"
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="input-field w-full"
                placeholder="Np. Upwork, email, portal klienta"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Anuluj
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-2"
              disabled={mutation.isLoading}
            >
              <Mail className="h-4 w-4" />
              {mutation.isLoading ? 'Zapisuję...' : 'Zapisz wysłaną ofertę'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [offerLead, setOfferLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery(
    ['leads', { status: statusFilter, archived: showArchived }],
    () =>
      leadsAPI.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
        archived: showArchived ? 'true' : 'false',
      })
  );

  const approveMutation = useMutation(
    ({ id, reviewComment }) => leadsAPI.approve(id, reviewComment),
    {
      onSuccess: () => {
        toast.success('Lead zaakceptowany');
        queryClient.invalidateQueries('leads');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd akceptacji leada'),
    }
  );
  const rejectMutation = useMutation(
    ({ id, reviewComment }) => leadsAPI.reject(id, reviewComment),
    {
      onSuccess: () => {
        toast.success('Lead odrzucony (archiwum)');
        queryClient.invalidateQueries('leads');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd odrzucania leada'),
    }
  );

  const isAdmin = user?.role === 'admin';

  const grouped = useMemo(() => {
    const groups = {
      pending_review: [],
      approved: [],
      offer_sent: [],
      rejected: [],
    };
    (leads || []).forEach((l) => {
      const s = l.status || 'pending_review';
      if (!groups[s]) groups[s] = [];
      groups[s].push(l);
    });
    return groups;
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leady</h1>
          <p className="text-sm text-gray-500">
            Prosty pipeline: Rizka dodaje leady, admin co jakiś czas je akceptuje / odrzuca, a Rizka po wysłaniu oferty wpisuje, co dokładnie poszło.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-sm"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="pending_review">Do oceny</option>
            <option value="approved">Do wysłania oferty</option>
            <option value="offer_sent">Oferta wysłana</option>
            <option value="rejected">Odrzucone</option>
          </select>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Pokaż archiwum
          </label>
        </div>
      </div>

      {/* Formularz Rizki */}
      <LeadForm />

      {/* Overview kolumnowy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Do oceny (admin)
            </h2>
            <span className="text-xs text-gray-500">
              {grouped.pending_review.length} leadów
            </span>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-gray-500 text-center">Ładowanie…</div>
          ) : grouped.pending_review.length === 0 ? (
            <div className="py-6 text-sm text-gray-400 text-center">Brak leadów do oceny.</div>
          ) : (
            <ul className="space-y-2 max-h-[360px] overflow-y-auto">
              {grouped.pending_review.map((lead) => (
                <li
                  key={lead._id}
                  className="border rounded-lg p-3 bg-white flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary-700 hover:text-primary-900"
                      >
                        {lead.title}
                      </a>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {lead.portal || '—'} ·{' '}
                        {lead.createdAt &&
                          new Date(lead.createdAt).toLocaleString('pl-PL')}
                      </div>
                    </div>
                    <LeadStatusPill status={lead.status} />
                  </div>
                  {lead.notes && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  )}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate({ id: lead._id, reviewComment: '' })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Akceptuj
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMutation.mutate({ id: lead._id, reviewComment: '' })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Odrzuć
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Do wysłania oferty (Rizka)
            </h2>
            <span className="text-xs text-gray-500">
              {grouped.approved.length} leadów
            </span>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-gray-500 text-center">Ładowanie…</div>
          ) : grouped.approved.length === 0 ? (
            <div className="py-6 text-sm text-gray-400 text-center">Brak zaakceptowanych leadów.</div>
          ) : (
            <ul className="space-y-2 max-h-[360px] overflow-y-auto">
              {grouped.approved.map((lead) => (
                <li
                  key={lead._id}
                  className="border rounded-lg p-3 bg-white flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary-700 hover:text-primary-900"
                      >
                        {lead.title}
                      </a>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {lead.portal || '—'} ·{' '}
                        {lead.createdAt &&
                          new Date(lead.createdAt).toLocaleString('pl-PL')}
                      </div>
                      {lead.reviewComment && (
                        <p className="mt-1 text-xs text-gray-600">
                          Komentarz admina: {lead.reviewComment}
                        </p>
                      )}
                    </div>
                    <LeadStatusPill status={lead.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setOfferLead(lead)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Zapisz wysłaną ofertę
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Oferta wysłana / archiwum
            </h2>
            <span className="text-xs text-gray-500">
              {grouped.offer_sent.length + grouped.rejected.length} pozycji
            </span>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-gray-500 text-center">Ładowanie…</div>
          ) : (
            <ul className="space-y-2 max-h-[360px] overflow-y-auto">
              {grouped.offer_sent.map((lead) => (
                <li
                  key={lead._id}
                  className="border rounded-lg p-3 bg-white flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <a
                          href={lead.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary-700 hover:text-primary-900"
                        >
                          {lead.title}
                        </a>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {lead.portal || '—'} ·{' '}
                        {lead.offerDetails?.sentAt &&
                          new Date(lead.offerDetails.sentAt).toLocaleString('pl-PL')}
                      </div>
                      {lead.offerDetails?.content && (
                        <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                          {lead.offerDetails.content}
                        </p>
                      )}
                    </div>
                    <LeadStatusPill status={lead.status} />
                  </div>
                </li>
              ))}

              {grouped.rejected.map((lead) => (
                <li
                  key={lead._id}
                  className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {lead.title}
                      </span>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {lead.portal || '—'} ·{' '}
                        {lead.reviewedAt &&
                          new Date(lead.reviewedAt).toLocaleString('pl-PL')}
                      </div>
                      {lead.reviewComment && (
                        <p className="mt-1 text-xs text-gray-600">
                          Powód odrzucenia: {lead.reviewComment}
                        </p>
                      )}
                    </div>
                    <LeadStatusPill status={lead.status} />
                  </div>
                </li>
              ))}

              {!isLoading &&
                grouped.offer_sent.length === 0 &&
                grouped.rejected.length === 0 && (
                  <li className="py-6 text-sm text-gray-400 text-center">
                    Brak wysłanych ofert / odrzuconych leadów.
                  </li>
                )}
            </ul>
          )}
        </div>
      </div>

      {offerLead && (
        <OfferModal
          lead={offerLead}
          onClose={() => setOfferLead(null)}
        />
      )}
    </div>
  );
}

