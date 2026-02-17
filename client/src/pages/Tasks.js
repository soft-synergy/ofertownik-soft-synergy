import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isToday,
  parseISO,
  startOfDay,
  isBefore,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Calendar as CalendarIcon,
  List,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  GripVertical
} from 'lucide-react';
import { tasksAPI, authAPI, projectsAPI } from '../services/api';
import toast from 'react-hot-toast';

const STATUS_LABELS = { todo: 'Do zrobienia', in_progress: 'W toku', done: 'Zrobione', cancelled: 'Anulowane' };
const PRIORITY_LABELS = { low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny' };
const PRIORITY_COLORS = { low: 'bg-gray-100 text-gray-700', normal: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };

function DraggableTaskChip({ task, isOverdue, onOpen, onToggleDone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: task._id,
    data: { taskId: task._id }
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  const isDone = task.status === 'done';
  const borderClass = isDone
    ? 'border-l-4 border-green-500'
    : isOverdue
      ? 'border-l-4 border-red-500'
      : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full px-2 py-1 rounded text-xs truncate flex items-center gap-1 border-l-4 ${borderClass || 'border-transparent'} ${
        isDone
          ? 'bg-green-100 text-green-800 line-through'
          : 'bg-primary-50 text-primary-900 hover:bg-primary-100'
      }`}
      title={task.title}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={(e) => { e.stopPropagation(); onToggleDone?.(task); }}
        className="shrink-0 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        aria-label={isDone ? 'Oznacz jako niezrobione' : 'Oznacz jako wykonane'}
        title={isDone ? 'Oznacz jako niezrobione' : 'Oznacz jako wykonane'}
      />
      <button
        type="button"
        className="shrink-0 text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label="Przeciągnij zadanie"
        title="Przeciągnij"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left truncate">
        <span className={`px-1 rounded mr-1 ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-200'}`}>
          {PRIORITY_LABELS[task.priority]?.[0] ?? ''}
        </span>
        {task.title}
      </button>
    </div>
  );
}

function DroppableDayCell({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'bg-primary-50' : ''}`}>
      {children}
    </div>
  );
}

function TaskModal({ task, initialDueDate, users = [], projects = [], onClose, onSaved }) {
  const queryClient = useQueryClient();
  const isEdit = !!task?._id;
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'normal',
    assignee: task?.assignee?._id ?? task?.assignee ?? '',
    project: task?.project?._id ?? task?.project ?? '',
    dueDate: task?.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : (initialDueDate ? format(initialDueDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
    dueTimeMinutes: task?.dueTimeMinutes ?? '',
    durationMinutes: task?.durationMinutes ?? 60,
    recurrenceEnabled: false,
    recurrenceFrequency: 'weekly',
    recurrenceInterval: 1,
    recurrenceUntilDate: ''
  });

  const createMutation = useMutation((data) => tasksAPI.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Zadanie dodane');
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu')
  });
  const updateMutation = useMutation(({ id, data }) => tasksAPI.update(id, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Zadanie zaktualizowane');
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Podaj tytuł');
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee || null,
      project: form.project || null,
      dueDate: form.dueDate,
      dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
      durationMinutes: Number(form.durationMinutes) || 60,
      ...(form.recurrenceEnabled && !isEdit ? {
        recurrence: {
          enabled: true,
          frequency: form.recurrenceFrequency,
          interval: Number(form.recurrenceInterval) || 1,
          untilDate: form.recurrenceUntilDate || null
        }
      } : {})
    };
    if (isEdit) {
      updateMutation.mutate({ id: task._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">{isEdit ? 'Edytuj zadanie' : 'Nowe zadanie'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input-field w-full"
              placeholder="Nazwa zadania"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field w-full"
              rows={2}
              placeholder="Opis (opcjonalnie)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input-field w-full"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorytet</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="input-field w-full"
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Przypisany do</label>
            <select
              value={form.assignee}
              onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
              className="input-field w-full"
            >
              <option value="">— Nie przypisany —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
            <select
              value={form.project}
              onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}
              className="input-field w-full"
            >
              <option value="">— Brak projektu —</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name} {p.clientName ? `(${p.clientName})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Termin *</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Godzina (opcjonalnie)</label>
              <input
                type="number"
                min={0}
                max={1439}
                placeholder="minuty od północy (0–1439)"
                value={form.dueTimeMinutes === '' ? '' : form.dueTimeMinutes}
                onChange={(e) => setForm((f) => ({ ...f, dueTimeMinutes: e.target.value === '' ? '' : e.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="border rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.recurrenceEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, recurrenceEnabled: e.target.checked }))}
                />
                Powtarzaj zadanie
              </label>
              {form.recurrenceEnabled && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Częstotliwość</label>
                    <select
                      value={form.recurrenceFrequency}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceFrequency: e.target.value }))}
                      className="input-field w-full text-sm"
                    >
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                      <option value="monthly">Co miesiąc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Co ile</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={form.recurrenceInterval}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceInterval: e.target.value }))}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Do kiedy (opcjonalnie)</label>
                    <input
                      type="date"
                      value={form.recurrenceUntilDate}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceUntilDate: e.target.value }))}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3 text-xs text-gray-500">
                    Utworzymy kolejne wystąpienia automatycznie (na kilka tygodni do przodu).
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">Anuluj</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
              {isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('calendar'); // 'list' | 'calendar'
  const [month, setMonth] = useState(new Date());
  const [week, setWeek] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [filters, setFilters] = useState({
    assignee: '',
    project: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: ''
  });
  const [modalTask, setModalTask] = useState(null);
  const [modalInitialDueDate, setModalInitialDueDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const calendarRange = useMemo(() => {
    if (calendarMode === 'week') {
      const start = startOfWeek(week, { weekStartsOn: 1 });
      const end = endOfWeek(week, { weekStartsOn: 1 });
      return { start, end };
    }
    return { start: startOfMonth(month), end: endOfMonth(month) };
  }, [calendarMode, month, week]);

  const params = useMemo(() => {
    const p = {};
    if (filters.assignee) p.assignee = filters.assignee;
    if (filters.project) p.project = filters.project;
    if (filters.status) p.status = filters.status;
    if (filters.priority) p.priority = filters.priority;
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
    if (view === 'calendar') {
      p.dateFrom = format(calendarRange.start, 'yyyy-MM-dd');
      p.dateTo = format(calendarRange.end, 'yyyy-MM-dd');
    }
    return p;
  }, [filters, view, calendarRange]);

  const { data: tasks = [], isLoading } = useQuery(['tasks', params], () => tasksAPI.getAll(params));
  const { data: users = [] } = useQuery('users', authAPI.listUsers);
  const { data: projectsData } = useQuery(['projects', { limit: 500 }], () => projectsAPI.getAll({ limit: 500 }));
  const projects = projectsData?.projects ?? [];

  const deleteMutation = useMutation((id) => tasksAPI.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Zadanie usunięte');
    },
    onError: () => toast.error('Błąd usuwania')
  });

  const toggleDoneMutation = useMutation(
    ({ id, status }) => tasksAPI.update(id, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tasks');
      },
      onError: () => toast.error('Nie udało się zaktualizować statusu zadania')
    }
  );

  const moveDueDateMutation = useMutation(({ id, dueDate }) => tasksAPI.update(id, { dueDate }), {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Zmieniono termin zadania');
    },
    onError: () => toast.error('Nie udało się przenieść zadania')
  });

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(week, { weekStartsOn: 1 });
    const end = endOfWeek(week, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [week]);

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const d = t.dueDate ? format(parseISO(t.dueDate), 'yyyy-MM-dd') : null;
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }
    });
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => {
        const doneA = a.status === 'done' ? 1 : 0;
        const doneB = b.status === 'done' ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        return (a.dueTimeMinutes ?? 0) - (b.dueTimeMinutes ?? 0);
      });
    });
    return map;
  }, [tasks]);

  const openCreate = (dueDate) => {
    setModalTask(null);
    setModalInitialDueDate(dueDate || new Date());
  };
  const openEdit = (task) => {
    setModalTask(task);
    setModalInitialDueDate(null);
  };

  const handleToggleDone = (task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    toggleDoneMutation.mutate({ id: task._id, status: nextStatus });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active?.id;
    const overId = over?.id;
    if (!activeId || !overId) return;

    const overStr = String(overId);
    if (!overStr.startsWith('day:')) return;
    const targetDateKey = overStr.slice('day:'.length);

    const task = tasks.find((t) => t._id === activeId);
    const currentDateKey = task?.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : null;
    if (!task || !currentDateKey) return;
    if (targetDateKey === currentDateKey) return;

    moveDueDateMutation.mutate({ id: task._id, dueDate: targetDateKey });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Zadania</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${view === 'calendar' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <CalendarIcon className="h-4 w-4" /> Kalendarz
          </button>
          {view === 'calendar' && (
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => setCalendarMode('month')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${calendarMode === 'month' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                title="Widok miesiąca"
              >
                Miesiąc
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('week')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${calendarMode === 'week' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                title="Widok tygodnia"
              >
                Tydzień
              </button>
            </div>
          )}
          <button onClick={() => openCreate()} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nowe zadanie
          </button>
        </div>
      </div>

      {/* Filtry */}
      <div className="card">
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Filter className="h-4 w-4" /> Filtry
        </button>
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Przypisany</label>
              <select
                value={filters.assignee}
                onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
                className="input-field w-full text-sm"
              >
                <option value="">Wszyscy</option>
                <option value="me">Moje</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Projekt</label>
              <select
                value={filters.project}
                onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
                className="input-field w-full text-sm"
              >
                <option value="">Wszystkie</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="input-field w-full text-sm"
              >
                <option value="">Wszystkie</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priorytet</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                className="input-field w-full text-sm"
              >
                <option value="">Wszystkie</option>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {view === 'list' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Od</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Do</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="input-field w-full text-sm"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {view === 'list' && (
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">Ładowanie…</div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Brak zadań dla wybranych filtrów.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-10 p-3">
                      <span className="sr-only">Zrobione</span>
                    </th>
                    <th className="text-left p-3 font-medium text-gray-700">Tytuł</th>
                    <th className="text-left p-3 font-medium text-gray-700">Przypisany</th>
                    <th className="text-left p-3 font-medium text-gray-700">Projekt</th>
                    <th className="text-left p-3 font-medium text-gray-700">Termin</th>
                    <th className="text-left p-3 font-medium text-gray-700">Status</th>
                    <th className="text-left p-3 font-medium text-gray-700">Priorytet</th>
                    <th className="w-20 p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...tasks]
                    .sort((a, b) => {
                      const doneA = a.status === 'done' ? 1 : 0;
                      const doneB = b.status === 'done' ? 1 : 0;
                      if (doneA !== doneB) return doneA - doneB;
                      return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
                    })
                    .map((t) => {
                      const isOverdue = t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()));
                      const rowBorder = t.status === 'done' ? 'border-l-4 border-green-500' : isOverdue ? 'border-l-4 border-red-500' : '';
                      return (
                    <tr key={t._id} className={`hover:bg-gray-50 ${rowBorder}`}>
                      <td className="p-3 align-middle">
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={() => handleToggleDone(t)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      <td className="p-3 font-medium">{t.title}</td>
                      <td className="p-3">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—'}</td>
                      <td className="p-3">{t.project?.name ?? '—'}</td>
                      <td className="p-3">{t.dueDate ? format(parseISO(t.dueDate), 'd.MM.yyyy', { locale: pl }) : '—'}</td>
                      <td className="p-3">{STATUS_LABELS[t.status] ?? t.status}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                          {PRIORITY_LABELS[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className="p-3 flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(t)} className="p-1.5 text-gray-500 hover:text-primary-600 rounded">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteMutation.mutate(t._id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'calendar' && (
        <div className="card">
          <DndContext onDragEnd={handleDragEnd}>
            {calendarMode === 'month' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-lg font-semibold capitalize">{format(month, 'LLLL yyyy', { locale: pl })}</h2>
                    <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden md:block text-xs text-gray-500">Przeciągnij zadanie na inny dzień</span>
                    <button type="button" onClick={() => openCreate(month)} className="text-sm text-primary-600 hover:underline">
                      Dodaj zadanie w tym miesiącu
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((day) => (
                    <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-600">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayTasks = tasksByDate[key] ?? [];
                    const currentMonth = isSameMonth(day, month);
                    return (
                      <DroppableDayCell
                        key={key}
                        id={`day:${key}`}
                        className={`min-h-[110px] p-2 flex flex-col ${currentMonth ? 'bg-white' : 'bg-gray-50'} ${isToday(day) ? 'ring-1 ring-primary-500 ring-inset' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${currentMonth ? 'text-gray-900' : 'text-gray-400'}`}>{format(day, 'd')}</span>
                          {currentMonth && (
                            <button
                              type="button"
                              onClick={() => openCreate(day)}
                              className="p-0.5 rounded text-primary-600 hover:bg-primary-50 flex items-center justify-center"
                              title="Dodaj zadanie na ten dzień"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 space-y-1 flex-1 overflow-y-auto">
                          {dayTasks.map((t) => (
                            <DraggableTaskChip
                              key={t._id}
                              task={t}
                              isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                              onOpen={() => openEdit(t)}
                              onToggleDone={handleToggleDone}
                            />
                          ))}
                        </div>
                      </DroppableDayCell>
                    );
                  })}
                </div>
              </>
            )}

            {calendarMode === 'week' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setWeek((w) => subWeeks(w, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-lg font-semibold">
                      {format(startOfWeek(week, { weekStartsOn: 1 }), 'd MMM', { locale: pl })}–{format(endOfWeek(week, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: pl })}
                    </h2>
                    <button type="button" onClick={() => setWeek((w) => addWeeks(w, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden md:block text-xs text-gray-500">Przeciągnij zadanie na inny dzień</span>
                    <button type="button" onClick={() => openCreate(new Date())} className="text-sm text-primary-600 hover:underline">
                      Dodaj zadanie
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {weekDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayTasks = tasksByDate[key] ?? [];
                    return (
                      <DroppableDayCell
                        key={key}
                        id={`day:${key}`}
                        className={`min-h-[160px] p-2 flex flex-col bg-white ${isToday(day) ? 'ring-1 ring-primary-500 ring-inset' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 capitalize">{format(day, 'EEE', { locale: pl })}</span>
                            <span className="text-sm text-gray-900 font-medium">{format(day, 'd MMM', { locale: pl })}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openCreate(day)}
                            className="p-0.5 rounded text-primary-600 hover:bg-primary-50"
                            title="Dodaj zadanie"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 space-y-1 flex-1 overflow-y-auto">
                          {dayTasks.map((t) => (
                            <DraggableTaskChip
                              key={t._id}
                              task={t}
                              isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                              onOpen={() => openEdit(t)}
                              onToggleDone={handleToggleDone}
                            />
                          ))}
                        </div>
                      </DroppableDayCell>
                    );
                  })}
                </div>
              </>
            )}
          </DndContext>
        </div>
      )}

      {(modalTask !== null || modalInitialDueDate !== null) && (
        <TaskModal
          task={modalTask}
          initialDueDate={modalInitialDueDate}
          users={users}
          projects={projects}
          onClose={() => { setModalTask(null); setModalInitialDueDate(null); }}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
