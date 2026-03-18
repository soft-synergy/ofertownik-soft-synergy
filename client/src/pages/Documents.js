import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, FileText, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { documentsAPI, getDocumentPublicUrl } from '../services/api';
import toast from 'react-hot-toast';

function DocumentForm({ document, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const isEdit = !!document?._id;
  const [form, setForm] = useState({
    title: document?.title ?? '',
    slug: document?.slug ?? '',
    content: document?.content ?? '',
  });

  const createMutation = useMutation((data) => documentsAPI.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('documents');
      toast.success('Dokument dodany');
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu'),
  });
  const updateMutation = useMutation(
    ({ id, data }) => documentsAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents');
        toast.success('Dokument zaktualizowany');
        onSaved?.();
        onClose();
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu'),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Podaj tytuł');
      return;
    }
    if (isEdit) {
      updateMutation.mutate({ id: document._id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const loading = createMutation.isLoading || updateMutation.isLoading;
  const publicUrl = (isEdit && form.slug) ? getDocumentPublicUrl(form.slug) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edytuj dokument' : 'Nowy dokument / playbook'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input-field w-full"
                placeholder="Np. Playbook onboarding"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (adres URL, opcjonalnie)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="input-field w-full"
                placeholder="np. playbook-onboarding – zostaw puste, wygeneruje się z tytułu"
              />
            </div>
          </div>
          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Treść HTML *</label>
            <p className="text-xs text-gray-500 mb-1">
              Wklej gotowy HTML (prezentacja, dokument). Będzie wyświetlony pod linkiem publicznym.
            </p>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="input-field w-full flex-1 min-h-[240px] font-mono text-sm"
              placeholder="<!DOCTYPE html>..."
              spellCheck={false}
            />
          </div>
          {publicUrl && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg shrink-0">
              <span className="text-xs font-medium text-gray-500 block mb-1">Link publiczny</span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary-600 hover:text-primary-800 break-all"
              >
                {publicUrl}
              </a>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">
              Anuluj
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Documents() {
  const queryClient = useQueryClient();
  const [formDoc, setFormDoc] = useState(null);

  const { data: list = [], isLoading } = useQuery('documents', documentsAPI.getAll);
  const deleteMutation = useMutation((id) => documentsAPI.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('documents');
      toast.success('Dokument usunięty');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd usuwania'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumenty i playbooki</h1>
          <p className="text-sm text-gray-500 mt-1">
            Wklej HTML – system wygeneruje publiczny link z prezentacją. Bez logowania.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormDoc({})}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nowy dokument
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Ładowanie…</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            Brak dokumentów. Kliknij „Nowy dokument” i wklej HTML.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {list.map((doc) => {
              const publicUrl = getDocumentPublicUrl(doc.slug);
              return (
                <li key={doc._id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{doc.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        /dokumenty/{doc.slug}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Otwórz
                    </a>
                    <button
                      type="button"
                      onClick={() => setFormDoc(doc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                    >
                      <Pencil className="h-4 w-4" />
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Usunąć ten dokument?')) deleteMutation.mutate(doc._id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Usuń
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formDoc !== null && (
        <DocumentForm
          document={formDoc}
          onClose={() => setFormDoc(null)}
          onSaved={() => setFormDoc(null)}
        />
      )}
    </div>
  );
}
