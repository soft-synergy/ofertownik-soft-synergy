import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { HeartHandshake, MessageCircle, ShieldCheck, Star } from 'lucide-react';
import { reviewsAPI } from '../services/api';

const ReviewPublic = () => {
  const { token } = useParams();
  const [mode, setMode] = useState('testimonial');
  const [form, setForm] = useState({
    rating: 5,
    likelyToRecommend: 9,
    testimonial: '',
    whatWorkedWell: '',
    whatCanBeImproved: '',
    clientName: '',
    clientRole: '',
    companyName: '',
    allowPublicUse: true
  });

  const { data, isLoading, error } = useQuery(['review-public', token], () => reviewsAPI.getPublic(token), {
    retry: 1
  });

  const submitMutation = useMutation((payload) => reviewsAPI.submitPublic(token, payload));

  const item = data?.item;
  const alreadyResponded = !!item?.alreadyResponded || submitMutation.isSuccess;

  const contextLine = useMemo(() => {
    if (!item) return '';
    return [item.projectName, item.companyName].filter(Boolean).join(' · ');
  }, [item]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_45%,#f8fafc_100%)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-sky-200 border-t-sky-600" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
          <h1 className="text-3xl font-black">Ten link do opinii jest nieaktywny</h1>
          <p className="mt-4 text-slate-300 leading-8">Wygląda na to, że link wygasł albo został wyłączony. Jeśli chcesz, napisz bezpośrednio do Soft Synergy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f0f9ff_0%,#ffffff_35%,#ecfeff_100%)] text-slate-900">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-[-6rem] h-80 w-80 rounded-full bg-cyan-200/60 blur-3xl" />
        <div className="absolute right-[-4rem] top-12 h-96 w-96 rounded-full bg-sky-200/70 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-emerald-200/60 blur-3xl" />
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-16">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[36px] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] md:px-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <HeartHandshake className="h-4 w-4" />
              Soft Synergy · krótka opinia
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
              Twoja opinia ma dla nas realne znaczenie.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-200">
              Nie chodzi tylko o miłe słowa. Chcemy zrozumieć, co zrobiliśmy dobrze, a co możemy poprawić, żeby kolejne współprace były jeszcze lepsze.
            </p>
            {contextLine && (
              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Kontekst</div>
                <div className="mt-2 text-lg font-semibold">{contextLine}</div>
              </div>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Feature icon={MessageCircle} title="Krótki formularz" text="Całość zajmuje zwykle 2-3 minuty." />
              <Feature icon={ShieldCheck} title="Bez presji" text="Możesz zostawić sam prywatny feedback." />
              <Feature icon={Star} title="Pomaga nam rosnąć" text="To feedback, który naprawdę czytamy." />
            </div>
          </div>

          <div className="rounded-[36px] border border-slate-200 bg-white/90 px-6 py-7 shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur md:px-8">
            {alreadyResponded ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <HeartHandshake className="h-8 w-8" />
                </div>
                <h2 className="mt-6 text-3xl font-black text-slate-900">Dziękujemy za odpowiedź</h2>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  Twoja opinia została zapisana. Naprawdę doceniamy poświęcony czas.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <ModePill active={mode === 'testimonial'} onClick={() => setMode('testimonial')}>
                    Chcę zostawić opinię
                  </ModePill>
                  <ModePill active={mode === 'feedback_only'} onClick={() => setMode('feedback_only')}>
                    Wolę dać prywatny feedback
                  </ModePill>
                </div>

                <div className="mt-7 space-y-6">
                  <Field label="Jak oceniasz współpracę?">
                    <RatingPicker
                      value={form.rating}
                      onChange={(value) => setForm((prev) => ({ ...prev, rating: value }))}
                    />
                  </Field>

                  <Field label="Na ile prawdopodobne, że polecisz nas dalej? (0-10)">
                    <div className="grid grid-cols-6 gap-2 md:grid-cols-11">
                      {Array.from({ length: 11 }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, likelyToRecommend: index }))}
                          className={`rounded-2xl border px-0 py-3 text-sm font-bold transition ${
                            form.likelyToRecommend === index
                              ? 'border-sky-500 bg-sky-600 text-white shadow-lg shadow-sky-200'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {index}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {mode === 'testimonial' && (
                    <Field label="Co najbardziej doceniłeś / doceniłaś we współpracy?">
                      <textarea
                        value={form.testimonial}
                        onChange={(e) => setForm((prev) => ({ ...prev, testimonial: e.target.value }))}
                        rows={5}
                        className="input-field min-h-[150px] rounded-[24px] border-slate-200 bg-slate-50 px-5 py-4 text-base leading-8"
                        placeholder="Napisz kilka zdań, które najlepiej oddają Twoje doświadczenie."
                      />
                    </Field>
                  )}

                  <Field label={mode === 'testimonial' ? 'Co zadziałało szczególnie dobrze?' : 'Co zadziałało dobrze, mimo że nie chcesz zostawiać opinii publicznej?'}>
                    <textarea
                      value={form.whatWorkedWell}
                      onChange={(e) => setForm((prev) => ({ ...prev, whatWorkedWell: e.target.value }))}
                      rows={4}
                      className="input-field min-h-[132px] rounded-[24px] border-slate-200 bg-slate-50 px-5 py-4 text-base leading-8"
                      placeholder="Np. komunikacja, tempo działania, jakość, elastyczność..."
                    />
                  </Field>

                  <Field label="Co możemy poprawić?">
                    <textarea
                      value={form.whatCanBeImproved}
                      onChange={(e) => setForm((prev) => ({ ...prev, whatCanBeImproved: e.target.value }))}
                      rows={4}
                      className="input-field min-h-[132px] rounded-[24px] border-slate-200 bg-slate-50 px-5 py-4 text-base leading-8"
                      placeholder="Tu szczególnie zależy nam na szczerości."
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Twoje imię / nazwa">
                      <input className="input-field rounded-[18px] border-slate-200 bg-slate-50 px-4 py-3" value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} />
                    </Field>
                    <Field label="Rola / stanowisko">
                      <input className="input-field rounded-[18px] border-slate-200 bg-slate-50 px-4 py-3" value={form.clientRole} onChange={(e) => setForm((prev) => ({ ...prev, clientRole: e.target.value }))} />
                    </Field>
                  </div>

                  <Field label="Firma">
                    <input className="input-field rounded-[18px] border-slate-200 bg-slate-50 px-4 py-3" value={form.companyName} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} />
                  </Field>

                  {mode === 'testimonial' && (
                    <label className="flex items-start gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-950">
                      <input
                        type="checkbox"
                        checked={form.allowPublicUse}
                        onChange={(e) => setForm((prev) => ({ ...prev, allowPublicUse: e.target.checked }))}
                        className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Zgadzam się, aby Soft Synergy mogło wykorzystać moją opinię jako testimonial na stronie, w ofercie lub materiałach sprzedażowych.
                      </span>
                    </label>
                  )}

                  {submitMutation.isError && (
                    <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4 text-sm leading-7 text-red-800">
                      {submitMutation.error?.response?.data?.message || 'Nie udało się zapisać odpowiedzi. Spróbuj jeszcze raz.'}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => submitMutation.mutate({
                      ...form,
                      mode
                    })}
                    disabled={submitMutation.isLoading}
                    className="w-full rounded-full bg-slate-950 px-6 py-4 text-base font-bold text-white shadow-xl transition hover:translate-y-[-1px] hover:bg-slate-900 disabled:cursor-wait disabled:opacity-70"
                  >
                    {submitMutation.isLoading ? 'Zapisujemy...' : mode === 'testimonial' ? 'Wyślij opinię' : 'Wyślij prywatny feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const Feature = ({ icon: Icon, title, text }) => (
  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
    <Icon className="h-5 w-5 text-cyan-300" />
    <div className="mt-4 text-lg font-semibold">{title}</div>
    <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
  </div>
);

const ModePill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
      active
        ? 'bg-slate-950 text-white shadow-lg'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}
  >
    {children}
  </button>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

const RatingPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {Array.from({ length: 5 }, (_, index) => {
      const number = index + 1;
      return (
        <button
          key={number}
          type="button"
          onClick={() => onChange(number)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${
            value === number
              ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-lg shadow-amber-100'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
          }`}
        >
          <Star className={`h-4 w-4 ${value === number ? 'fill-current' : ''}`} />
          {number}
        </button>
      );
    })}
  </div>
);

export default ReviewPublic;
