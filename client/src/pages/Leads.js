import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { leadsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus,
  ExternalLink,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  X,
  FileText,
  Filter
} from 'lucide-react';

const STATUS_LABELS = {
  pending_review: 'Do weryfikacji',
  approved: 'Zatwierdzony',
  rejected: 'Odrzucony',
  offer_sent: 'Oferta wysłana'
};

const STATUS_CLASSES = {
  pending_review: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  offer_sent: 'bg-blue-100 text-blue-800 border-blue-200'
};

export default function Leads() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [archivedFilter, setArchivedFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ sourceUrl: '', title: '', portal: '', notes: '' });
  const [offerModal, setOfferModal] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [offerForm, setOfferForm] = useState({ content: '', valuePln: '', channel: '' });

  const params = { status: statusFilter || undefined, archived: archivedFilter || undefined };
  const { data, isLoading } = useQuery(
    ['leads', params],
    () => leadsAPI.getAll(params),
    { keepPreviousData: true }
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation(leadsAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('leads');
      setShowAdd(false);
      setForm({ sourceUrl: '', title: '', portal: '', notes: '' });
      toast.success('Lead dodany');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd dodawania leada')
  });

  const approveMutation = useMutation(
    ({ id, reviewComment: c }) => leadsAPI.approve(id, c),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leads');
        setReviewComment('');
        toast.success('Lead zatwierdzony');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd zatwierdzania')
    }
  );

  const rejectMutation = useMutation(
    ({ id, reviewComment: c }) => leadsAPI.reject(id, c),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leads');
        setReviewComment('');
        toast.success('Lead odrzucony');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd odrzucania')
    }
  );

  const saveOfferMutation = useMutation(
    ({ id, data: d }) => leadsAPI.saveOffer(id, d),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leads');
        setOfferModal(null);
        setOfferForm({ content: '', valuePln: '', channel: '' });
        toast.success('Oferta zapisana');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisywania oferty')
    }
  );

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (!form.sourceUrl?.trim() || !form.title?.trim()) {
      toast.error('Podaj link i tytuł');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leady</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Linki do ogłoszeń (Upwork, portale) – weryfikacja i oferty
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Dodaj leada
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
          <Filter className="h-4 w-4" /> Filtry:
        </span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Wszystkie statusy</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={archivedFilter}
          onChange={(e) => setArchivedFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Wszystkie</option>
          <option value="false">Aktywne</option>
          <option value="true">Archiwum (odrzucone)</option>
        </select>
        <input
          type="text"
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          placeholder="Komentarz do weryfikacji (opcjonalnie)"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          Brak leadów dla wybranych filtrów.
          {!statusFilter && !archivedFilter && ' Kliknij „Dodaj leada", aby dodać pierwszy.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tytuł / Portal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dodany / Ocena</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((lead) => (
                  <tr key={lead._id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASSES[lead.status] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.title}</div>
                      {lead.portal && <div className="text-xs text-gray-500">{lead.portal}</div>}
                      {lead.notes && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{lead.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" /> Otwórz
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{lead.createdBy ? `${lead.createdBy.firstName} ${lead.createdBy.lastName}` : '—'}</div>
                      {lead.reviewedBy && (
                        <div className="text-xs text-gray-500">
                          Ocena: {lead.reviewedBy.firstName} {lead.reviewedBy.lastName}
                          {lead.reviewComment && ` – ${lead.reviewComment}`}
                        </div>
                      )}
                      {lead.offerDetails?.content && (
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Oferta zapisana
                          {lead.offerDetails.valuePln != null && ` · ${lead.offerDetails.valuePln} PLN`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {lead.status === 'pending_review' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveMutation.mutate({ id: lead._id, reviewComment })}
                              disabled={approveMutation.isLoading}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            >
                              {approveMutation.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                              Zatwierdź
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectMutation.mutate({ id: lead._id, reviewComment })}
                              disabled={rejectMutation.isLoading}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
                            >
                              {rejectMutation.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                              Odrzuć
                            </button>
                          </>
                        )}
                        {(lead.status === 'approved' || lead.status === 'offer_sent') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOfferModal(lead);
                            setOfferForm({
                              content: lead.offerDetails?.content ?? '',
                              valuePln: lead.offerDetails?.valuePln ?? '',
                              channel: lead.offerDetails?.channel ?? ''
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                        >
                            <Send className="h-3.5 w-3.5" />
                            {lead.status === 'offer_sent' ? 'Edytuj ofertę' : 'Zapisz ofertę'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Łącznie: {total} {total === 1 ? 'lead' : 'leadów'}
            </div>
          )}
        </div>
      )}

      {/* Modal: dodaj leada */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Dodaj leada</h2>
              <button type="button" onClick={() => setShowAdd(false)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link do ogłoszenia *</label>
                <input
                  type="url"
                  required
                  value={form.sourceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  className="input-field w-full"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł / nazwa *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field w-full"
                  placeholder="np. tytuł ogłoszenia lub klient"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portal</label>
                <input
                  type="text"
                  value={form.portal}
                  onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value }))}
                  className="input-field w-full"
                  placeholder="Upwork, Useme, inny"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input-field w-full"
                  rows={3}
                  placeholder="Dlaczego warto, wymagania..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Anuluj</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
                  {createMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Dodaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: komentarz do zatwierdzenia/odrzucenia (opcjonalny) – można rozbudować o osobny modal */}
      {/* Obecnie reviewComment jest jednym polem – jeśli chcesz osobny modal na approve/reject, daj znać */}

      {/* Modal: zapisz ofertę */}
      {offerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOfferModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Zapisz wysłaną ofertę</h2>
              <button type="button" onClick={() => setOfferModal(null)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Lead: {offerModal.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Podsumowanie oferty / co wysłano</label>
                <textarea
                  value={offerForm.content}
                  onChange={(e) => setOfferForm((f) => ({ ...f, content: e.target.value }))}
                  className="input-field w-full"
                  rows={4}
                  placeholder="Treść lub podsumowanie oferty..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wartość (PLN)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={offerForm.valuePln}
                    onChange={(e) => setOfferForm((f) => ({ ...f, valuePln: e.target.value }))}
                    className="input-field w-full"
                    placeholder="np. 5000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kanał</label>
                  <input
                    type="text"
                    value={offerForm.channel}
                    onChange={(e) => setOfferForm((f) => ({ ...f, channel: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Upwork, email..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOfferModal(null)} className="btn-secondary">Anuluj</button>
                <button
                  type="button"
                  onClick={() =>
                    saveOfferMutation.mutate({
                      id: offerModal._id,
                      data: {
                        content: offerForm.content,
                        valuePln: offerForm.valuePln ? Number(offerForm.valuePln) : null,
                        channel: offerForm.channel
                      }
                    })
                  }
                  className="btn-primary"
                  disabled={saveOfferMutation.isLoading}
                >
                  {saveOfferMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Zapisz ofertę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
