import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  MessageSquareQuote,
  Plus,
  Send,
  Copy,
  PauseCircle,
  Archive,
  Star,
  BarChart3,
  Sparkles,
  Search
} from 'lucide-react';
import { reviewsAPI } from '../services/api';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  responded: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  declined: 'bg-slate-100 text-slate-700 border-slate-200',
  paused: 'bg-orange-100 text-orange-800 border-orange-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200'
};

const STATUS_LABELS = {
  pending: 'Czeka na odpowiedź',
  responded: 'Jest opinia',
  declined: 'Tylko feedback',
  paused: 'Wstrzymane',
  archived: 'Archiwum'
};

const emptyForm = {
  email: '',
  clientName: '',
  companyName: '',
  projectName: '',
  sourceLabel: '',
  notes: ''
};

const Opinions = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(() => ({
    search: search || undefined,
    status: status || undefined
  }), [search, status]);

  const { data, isLoading } = useQuery(['reviews', params], () => reviewsAPI.getAll(params));

  const createMutation = useMutation(reviewsAPI.create, {
    onSuccess: (res) => {
      toast.success(res.message || 'Prośba wysłana');
      setShowForm(false);
      setForm(emptyForm);
      queryClient.invalidateQueries('reviews');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Nie udało się wysłać prośby')
  });

  const resendMutation = useMutation(reviewsAPI.resend, {
    onSuccess: () => {
      toast.success('Przypomnienie wysłane');
      queryClient.invalidateQueries('reviews');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Nie udało się wysłać przypomnienia')
  });

  const updateMutation = useMutation(({ id, payload }) => reviewsAPI.update(id, payload), {
    onSuccess: () => {
      queryClient.invalidateQueries('reviews');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Nie udało się zapisać zmian')
  });

  const summary = data?.summary || {};
  const items = data?.items || [];
  const publicBaseUrl = data?.publicBaseUrl || `${window.location.origin}/opinie`;

  const handleCopyLink = async (token) => {
    const url = `${publicBaseUrl}/${token}`;
    await navigator.clipboard?.writeText(url);
    toast.success('Link skopiowany');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-gradient-to-br from-slate-950 via-sky-900 to-cyan-700 text-white shadow-2xl overflow-hidden">
        <div className="px-8 py-9 md:px-10 md:py-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-cyan-100">
              <Sparkles className="h-4 w-4" />
              Moduł opinii klientów
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">Zbieraj testimoniale i realny feedback bez chaosu.</h1>
            <p className="mt-4 text-base leading-8 text-cyan-50/90 md:text-lg">
              Wyślij jedną prośbę, a system sam przypomni klientowi o opinii. Jeśli klient nie chce zostawiać publicznego testimonialu,
              nadal zbierzesz konkretne informacje, co działa i co warto poprawić.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Dodaj prośbę
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={MessageSquareQuote} label="Wszystkie prośby" value={summary.total || 0} tone="slate" />
        <SummaryCard icon={Send} label="Czekają" value={summary.pending || 0} tone="amber" />
        <SummaryCard icon={Star} label="Publiczne testimoniale" value={summary.publicTestimonials || 0} tone="emerald" />
        <SummaryCard icon={BarChart3} label="Średnia ocena" value={summary.avgRating != null ? `${summary.avgRating}/5` : '-'} tone="sky" />
        <SummaryCard icon={Sparkles} label="Średni NPS" value={summary.avgNps != null ? summary.avgNps : '-'} tone="violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lista próśb</h2>
              <p className="text-sm text-slate-500">Masz tu statusy, follow-upy, testimoniale i feedback rozwojowy.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj maila, projektu, firmy..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-sky-400 focus:bg-white md:w-72"
                />
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
              >
                <option value="">Wszystkie statusy</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-10 text-center text-slate-500">Ładowanie opinii...</div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Brak próśb. Dodaj pierwszą prośbę o opinię.</div>
            ) : items.map((item) => (
              <div key={item._id} className="px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{item.clientName || item.companyName || item.email}</h3>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      {item.response?.allowPublicUse && item.response?.testimonial && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Testimonial do użycia
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {item.email}
                      {item.projectName ? ` · ${item.projectName}` : ''}
                      {item.companyName ? ` · ${item.companyName}` : ''}
                    </div>
                    {item.notes && (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">{item.notes}</p>
                    )}
                    {item.response?.testimonial && (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Testimonial</div>
                        <p className="mt-2 text-sm leading-7 text-emerald-950">"{item.response.testimonial}"</p>
                      </div>
                    )}
                    {item.response?.whatCanBeImproved && (
                      <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Co poprawić</div>
                        <p className="mt-2 text-sm leading-7 text-amber-950">{item.response.whatCanBeImproved}</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full xl:w-[310px] space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Follow-up</span>
                        <strong className="text-slate-900">{item.followUpStep || 0}/3</strong>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Ostatni mail</span>
                        <strong className="text-slate-900">{formatDateTime(item.lastEmailSentAt)}</strong>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Następny</span>
                        <strong className="text-slate-900">{formatDateTime(item.nextFollowUpAt)}</strong>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Ocena / NPS</span>
                        <strong className="text-slate-900">
                          {item.response?.rating ? `${item.response.rating}/5` : '-'} / {item.response?.likelyToRecommend ?? '-'}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.token)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Copy className="h-4 w-4" />
                        Kopiuj link
                      </button>
                      <button
                        type="button"
                        onClick={() => resendMutation.mutate(item._id)}
                        disabled={resendMutation.isLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        Przypomnij
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ id: item._id, payload: { status: item.status === 'paused' ? 'pending' : 'paused' } })}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
                      >
                        <PauseCircle className="h-4 w-4" />
                        {item.status === 'paused' ? 'Wznów' : 'Wstrzymaj'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ id: item._id, payload: { status: 'archived' } })}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        <Archive className="h-4 w-4" />
                        Archiwizuj
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <InsightPanel title="Ostatnie testimoniale" tone="emerald">
            {(summary.latestTestimonials || []).length ? summary.latestTestimonials.map((item) => (
              <div key={item.id} className="rounded-2xl border border-emerald-100 bg-white px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">{item.clientName}</div>
                <div className="text-xs text-slate-500">{item.companyName || item.projectName || 'Klient'}</div>
                <p className="mt-3 text-sm leading-7 text-slate-700">"{item.testimonial}"</p>
              </div>
            )) : <EmptyText text="Gdy klienci zgodzą się na użycie opinii, zobaczysz je tutaj." />}
          </InsightPanel>

          <InsightPanel title="Najczęstsze uwagi rozwojowe" tone="amber">
            {(summary.topImprovementThemes || []).length ? summary.topImprovementThemes.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-amber-100 bg-white px-4 py-3">
                <span className="pr-4 text-sm leading-6 text-slate-700">{item.label}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{item.count}</span>
              </div>
            )) : <EmptyText text="Tutaj pojawią się realne tematy do poprawy z feedbacku klientów." />}
          </InsightPanel>
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-7 py-6">
              <h2 className="text-2xl font-bold text-slate-900">Dodaj prośbę o opinię</h2>
              <p className="mt-2 text-sm text-slate-500">Wpisz minimum email. Resztę możesz uzupełnić, jeśli chcesz lepiej segmentować opinie.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-5 px-7 py-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Email klienta *">
                  <input className="input-field" required type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
                </Field>
                <Field label="Imię / nazwa klienta">
                  <input className="input-field" value={form.clientName} onChange={(e) => setForm((s) => ({ ...s, clientName: e.target.value }))} />
                </Field>
                <Field label="Firma">
                  <input className="input-field" value={form.companyName} onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))} />
                </Field>
                <Field label="Projekt / kontekst">
                  <input className="input-field" value={form.projectName} onChange={(e) => setForm((s) => ({ ...s, projectName: e.target.value }))} />
                </Field>
              </div>
              <Field label="Źródło / segment">
                <input className="input-field" placeholder="np. wdrożenie CRM, landing page, audyt UX" value={form.sourceLabel} onChange={(e) => setForm((s) => ({ ...s, sourceLabel: e.target.value }))} />
              </Field>
              <Field label="Notatki wewnętrzne">
                <textarea className="input-field min-h-[120px]" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
              </Field>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Anuluj</button>
                <button type="submit" disabled={createMutation.isLoading} className="btn-primary">
                  {createMutation.isLoading ? 'Wysyłanie...' : 'Wyślij prośbę'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    slate: 'from-slate-50 to-white border-slate-200 text-slate-900',
    amber: 'from-amber-50 to-white border-amber-200 text-amber-900',
    emerald: 'from-emerald-50 to-white border-emerald-200 text-emerald-900',
    sky: 'from-sky-50 to-white border-sky-200 text-sky-900',
    violet: 'from-violet-50 to-white border-violet-200 text-violet-900'
  };
  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <Icon className="h-5 w-5 opacity-70" />
      </div>
      <div className="mt-5 text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
};

const InsightPanel = ({ title, tone, children }) => {
  const bg = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60';
  return (
    <section className={`rounded-[24px] border p-5 shadow-sm ${bg}`}>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
    {children}
  </label>
);

const EmptyText = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm leading-7 text-slate-500">
    {text}
  </div>
);

function formatDateTime(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('pl-PL');
}

export default Opinions;
