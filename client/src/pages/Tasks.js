import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
  isToday, parseISO, startOfDay, isBefore, subDays,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Calendar as CalendarIcon, List, Filter, ChevronLeft, ChevronRight,
  Edit2, Trash2, Trash, X, MessageSquarePlus, FolderOpen,
  Lock, Users, AlertCircle, CheckCircle2, Circle, ArrowUpCircle,
  Paperclip, Download, RotateCcw, UploadCloud, File, Eye,
  Send, Flag, Zap, Sparkles, Bell, ChevronDown, Link2, ExternalLink,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tasksAPI, authAPI, projectsAPI } from '../services/api';
import toast from 'react-hot-toast';

const STATUS_LABELS = { todo: 'Do zrobienia', in_progress: 'W toku', done: 'Zrobione', cancelled: 'Anulowane' };
const PRIORITY_LABELS = { low: 'Niski', normal: 'Normalny', high: 'Wysoki', urgent: 'Pilny' };
const PRIORITY_COLORS = { low: 'bg-gray-100 text-gray-700', normal: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };
const PRIORITY_ORDER = { urgent: 4, high: 3, normal: 2, low: 1 };

function ProjectSearchSelect({ value, onChange, projects = [], className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const selected = projects.find(p => p._id === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : '— Bez projektu —'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Szukaj projektu..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${!value ? 'text-primary-600 font-medium bg-primary-50' : 'text-gray-500'}`}
            >
              — Bez projektu —
            </button>
            {filtered.map(p => (
              <button
                key={p._id}
                type="button"
                onClick={() => { onChange(p._id); setOpen(false); }}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors truncate ${value === p._id ? 'text-primary-600 font-medium bg-primary-50' : 'text-gray-800'}`}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Brak wyników</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS = {
  todo: { label: 'Do zrobienia', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Circle, chip: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'W toku', color: 'bg-blue-50 text-blue-700 border-blue-300', icon: ArrowUpCircle, chip: 'bg-blue-100 text-blue-700' },
  done: { label: 'Zrobione', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 line-through', icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Anulowane', color: 'bg-gray-100 text-gray-500 border-gray-200 line-through', icon: X, chip: 'bg-gray-100 text-gray-500' }
};
const PRIORITY = {
  low: { label: 'Niski', icon: ChevronDown, color: 'text-slate-400', bar: 'bg-slate-300' },
  normal: { label: 'Normalny', icon: Flag, color: 'text-blue-500', bar: 'bg-blue-400' },
  high: { label: 'Wysoki', icon: AlertCircle, color: 'text-amber-500', bar: 'bg-amber-500' },
  urgent: { label: 'Pilny', icon: Zap, color: 'text-red-500', bar: 'bg-red-500' }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

function DraggableTaskChip({ task, isOverdue, onOpen, onToggleDone, onOpenContextMenu, fullTitle }) {
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

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenContextMenu?.(task, e.clientX, e.clientY);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={handleContextMenu}
      onClick={onOpen}
      {...listeners}
      {...attributes}
      className={`w-full px-3 py-2 rounded-md text-sm flex items-center gap-2 border-l-4 min-h-[52px] cursor-grab active:cursor-grabbing select-none ${borderClass || 'border-transparent'} ${
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
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        aria-label={isDone ? 'Oznacz jako niezrobione' : 'Oznacz jako wykonane'}
      />
      <button
        type="button"
        className={`min-w-0 flex-1 text-left cursor-grab ${
          fullTitle ? 'break-words whitespace-pre-wrap' : 'line-clamp-2 break-words'
        }`}
      >
        <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 mr-1 ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-200'}`}>
          {PRIORITY_LABELS[task.priority]?.[0] ?? ''}
        </span>
        <span className="align-middle">{task.title}</span>
      </button>
    </div>
  );
}

function useEscClose(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}

function DayContextMenu({ date, x, y, onAddTask, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[180px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => { onAddTask(date); onClose(); }}
      >
        <Plus className="h-4 w-4" /> Dodaj zadanie na ten dzień
      </button>
    </div>
  );
}

function DroppableDayCell({ id, className, day, onDayContextMenu, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const handleContextMenu = (e) => {
    if (onDayContextMenu && day) {
      e.preventDefault();
      e.stopPropagation();
      onDayContextMenu(day, e.clientX, e.clientY);
    }
  };
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'bg-primary-50' : ''}`} onContextMenu={handleContextMenu}>
      {children}
    </div>
  );
}

function TaskContextMenu({ task, x, y, onEdit, onDelete, onAddUpdate, onGoToProject, onClose }) {
  const ref = useRef(null);
  const projectId = task.project?._id || task.project || task.source?.refId;

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[160px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{ left: x, top: y }}
    >
      {projectId && (
        <Link
          to={`/projects/${projectId}/edit`}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          onClick={onClose}
        >
          <FolderOpen className="h-4 w-4" /> Przejdź do projektu
        </Link>
      )}
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => { onEdit(task); onClose(); }}
      >
        <Edit2 className="h-4 w-4" /> Edytuj
      </button>
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => { onAddUpdate(task); onClose(); }}
      >
        <MessageSquarePlus className="h-4 w-4" /> Daj update
      </button>
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
        onClick={() => { onDelete(task._id); onClose(); }}
      >
        <Trash2 className="h-4 w-4" /> Usuń
      </button>
    </div>
  );
}


const getFileIcon = (mimetype) => {
  if (!mimetype) return File;
  if (mimetype.startsWith('image/')) return Eye;
  return File;
};

// ────────────── TASK DETAIL MODAL ──────────────

function TaskDetailModal({ task, users = [], projects = [], onClose, onSaved, me }) {
  useEscClose(onClose);
  const queryClient = useQueryClient();
  const isEdit = !!task?._id;
  const { data: fullTask, refetch: refetchTask } = useQuery(
    ['task', task?._id],
    () => tasksAPI.getById(task._id),
    { enabled: isEdit && !!task?._id }
  );

  const t = fullTask || task;
  const [tab, setTab] = useState('details');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [descEditing, setDescEditing] = useState(false);

  const initialAssignees = t?.assignees && t.assignees.length > 0 ? t.assignees.map(a => a._id || a).filter(Boolean) : [];
  const initialWatchers = t?.watchers && t.watchers.length > 0 ? t.watchers.map(w => w._id || w).filter(Boolean) : [];

  const [form, setForm] = useState({
    title: t?.title ?? '', description: t?.description ?? '',
    status: t?.status ?? 'todo', priority: t?.priority ?? 'normal',
    assignees: initialAssignees, watchers: initialWatchers,
    isPrivate: !!t?.isPrivate, project: t?.project?._id ?? t?.project ?? '',
    dueDate: t?.dueDate ? format(parseISO(t.dueDate), 'yyyy-MM-dd') : (task?.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
    dueTimeMinutes: t?.dueTimeMinutes ?? '',
    durationMinutes: t?.durationMinutes ?? 60,
    recurrenceEnabled: false, recurrenceFrequency: 'weekly', recurrenceInterval: 1,
    recurrenceUntilDate: '', recurrenceWeekdaysOnly: false
  });

  const updateMutation = useMutation(({ id, data }) => tasksAPI.update(id, data), {
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries(['tasks']);
      const previousAll = queryClient.getQueriesData(['tasks']);
      queryClient.setQueriesData(['tasks'], (old) => { if (!Array.isArray(old)) return old; return old.map(o => o._id === id ? { ...o, ...data } : o); });
      queryClient.setQueryData(['task', id], (old) => ({ ...old, ...data }));
      return { previousAll };
    },
    onSuccess: () => { toast.success('Zadanie zaktualizowane'); refetchTask(); onSaved?.(); },
    onError: (e, _vars, context) => {
      if (context?.previousAll) context.previousAll.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(e.response?.data?.message || 'Błąd zapisu');
    },
    onSettled: () => { queryClient.invalidateQueries(['tasks']); }
  });

  const uploadMutation = useMutation((formData) => tasksAPI.uploadAttachments(t._id, formData), {
    onSuccess: () => { toast.success('Pliki przesłane'); refetchTask(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd przesyłania')
  });

  const deleteAttachmentMutation = useMutation((attachmentId) => tasksAPI.deleteAttachment(t._id, attachmentId), {
    onSuccess: () => { toast.success('Załącznik usunięty'); refetchTask(); },
    onError: () => toast.error('Błąd usuwania załącznika')
  });

  const addLinkMutation = useMutation(({ url, title }) => tasksAPI.addLink(t._id, { url, title }), {
    onMutate: async ({ url, title }) => {
      const tempLink = { _id: `temp_${Date.now()}`, url, title, createdAt: new Date().toISOString() };
      await queryClient.cancelQueries(['task', t._id]);
      const prev = queryClient.getQueryData(['task', t._id]);
      queryClient.setQueryData(['task', t._id], (old) => ({ ...old, links: [...(old?.links || []), tempLink] }));
      return { prev };
    },
    onSuccess: () => refetchTask(),
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['task', t._id], ctx.prev); toast.error('Błąd dodawania linku'); }
  });

  const deleteLinkMutation = useMutation((linkId) => tasksAPI.deleteLink(t._id, linkId), {
    onMutate: async (linkId) => {
      await queryClient.cancelQueries(['task', t._id]);
      const prev = queryClient.getQueryData(['task', t._id]);
      queryClient.setQueryData(['task', t._id], (old) => ({ ...old, links: (old?.links || []).filter(l => l._id !== linkId) }));
      return { prev };
    },
    onSuccess: () => refetchTask(),
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['task', t._id], ctx.prev); toast.error('Błąd usuwania linku'); }
  });

  const addUpdateMutation = useMutation((text) => tasksAPI.addUpdate(t._id, text), {
    onMutate: async (text) => {
      await queryClient.cancelQueries(['task', t._id]);
      const prev = queryClient.getQueryData(['task', t._id]);
      queryClient.setQueryData(['task', t._id], (old) => ({ ...old, updates: [...(old?.updates || []), { _id: `temp_${Date.now()}`, text, author: { firstName: me?.firstName, lastName: me?.lastName }, createdAt: new Date().toISOString(), attachments: [] }] }));
      return { prev };
    },
    onSuccess: (updatedTask) => { queryClient.setQueryData(['task', t._id], updatedTask); toast.success('Update dodany'); },
    onError: (_err, _vars, context) => { if (context?.prev) queryClient.setQueryData(['task', t._id], context.prev); toast.error('Błąd dodawania update\'u'); }
  });

  const deleteUpdateMutation = useMutation((updateId) => tasksAPI.deleteUpdate(t._id, updateId), {
    onMutate: async (updateId) => {
      await queryClient.cancelQueries(['task', t._id]);
      const prev = queryClient.getQueryData(['task', t._id]);
      queryClient.setQueryData(['task', t._id], (old) => ({ ...old, updates: (old?.updates || []).filter(u => u._id !== updateId) }));
      return { prev };
    },
    onSuccess: (updatedTask) => { queryClient.setQueryData(['task', t._id], updatedTask); },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['task', t._id], ctx.prev); toast.error('Błąd usuwania update\'u'); }
  });

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Podaj tytuł'); return; }
    const payload = {
      title: form.title.trim(), description: (form.description || '').trim(),
      status: form.status, priority: form.priority,
      assignees: form.assignees.filter(Boolean), watchers: form.watchers.filter(Boolean),
      isPrivate: !!form.isPrivate, project: form.project || null,
      dueDate: form.dueDate, dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
      durationMinutes: Number(form.durationMinutes) || 60
    };
    updateMutation.mutate({ id: t._id, data: payload });
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    try { await uploadMutation.mutateAsync(fd); }
    finally { setUploading(false); }
  };

  const handleChange = (key, value) => { setForm((f) => ({ ...f, [key]: value })); if (isEdit) handleSaveAfterChange(key, value); };

  const debounceRef = useRef(null);
  const handleSaveAfterChange = (key, value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (['title', 'description'].includes(key)) {
      debounceRef.current = setTimeout(() => {
        const payload = {
          title: form.title.trim(), description: (form.description || '').trim(),
          status: form.status, priority: form.priority,
          assignees: form.assignees.filter(Boolean), watchers: form.watchers.filter(Boolean),
          isPrivate: !!form.isPrivate, project: form.project || null,
          dueDate: form.dueDate, dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
          durationMinutes: Number(form.durationMinutes) || 60
        };
        payload[key] = value;
        updateMutation.mutate({ id: t._id, data: payload });
      }, 1200);
      return;
    }
    if (['status', 'priority', 'isPrivate', 'project', 'dueDate', 'dueTimeMinutes', 'assignees', 'watchers'].includes(key)) {
      const payload = {
        title: form.title.trim(), description: (form.description || '').trim(),
        status: form.status, priority: form.priority,
        assignees: form.assignees.filter(Boolean), watchers: form.watchers.filter(Boolean),
        isPrivate: !!form.isPrivate, project: form.project || null,
        dueDate: form.dueDate, dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
        durationMinutes: Number(form.durationMinutes) || 60
      };
      payload[key] = value;
      updateMutation.mutate({ id: t._id, data: payload });
    }
  };

  const [updateText, setUpdateText] = useState('');
  const [updateFiles, setUpdateFiles] = useState([]);
  const updateFileRef = useRef(null);
  const handleAddUpdate = async () => {
    if (!updateText.trim() && updateFiles.length === 0) return;
    if (updateFiles.length > 0) {
      const fd = new FormData();
      updateFiles.forEach((f) => fd.append('files', f));
      try { await uploadMutation.mutateAsync(fd); } catch (_e) {}
      setUpdateFiles([]);
    }
    if (updateText.trim()) {
      addUpdateMutation.mutate(updateText.trim());
      setUpdateText('');
    }
  };

  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex modal-backdrop-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-4xl mx-4 md:mx-auto my-4 md:my-8 bg-white rounded-2xl shadow-2xl modal-slide-up flex flex-col max-h-[calc(100vh-2rem)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            {isEdit ? (
              <input type="text" value={form.title} onChange={(e) => handleChange('title', e.target.value)}
                className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0"
                placeholder="Tytuł zadania..." />
            ) : (
              <h2 className="text-xl font-bold text-gray-900 truncate">{t?.title}</h2>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors shrink-0">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        {isEdit && (
          <div className="flex gap-1 px-6 py-2 border-b border-gray-100 bg-gray-50/50">
            {[
              { key: 'details', label: 'Szczegóły', icon: Edit2 },
              { key: 'updates', label: 'Update\'y', icon: MessageSquarePlus, count: t?.updates?.length },
              { key: 'files', label: 'Pliki', icon: Paperclip, count: t?.attachments?.length },
              { key: 'links', label: 'Linki', icon: Link2, count: t?.links?.length || 0 }
            ].map((tb) => (
              <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${tab === tb.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}>
                <tb.icon className="h-4 w-4" /> {tb.label}
                {tb.count > 0 && <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{tb.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Tab: Details */}
        {tab === 'details' && (
          <div className="flex-1 overflow-y-auto p-6 task-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left column - main fields */}
              <div className="space-y-5">
                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <File className="h-4 w-4 text-gray-400" /> Opis
                    </label>
                    <button type="button" onClick={() => setDescEditing((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 px-2.5 py-1 rounded-lg hover:bg-primary-50 transition-colors">
                      {descEditing ? <><X className="h-3 w-3" /> Zamknij</> : <><Edit2 className="h-3 w-3" /> Edytuj</>}
                    </button>
                  </div>
                  {descEditing ? (
                    <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y leading-relaxed"
                      placeholder="Dodaj opis zadania — co trzeba zrobić, szczegóły, kontekst..." rows={12} autoFocus />
                  ) : (
                    <div onClick={() => setDescEditing(true)}
                      className={`w-full px-4 py-3 rounded-xl border cursor-text transition-colors min-h-[120px] text-sm leading-relaxed whitespace-pre-wrap
                        ${form.description
                          ? 'text-gray-700 bg-gray-50/50 border-gray-200 hover:border-primary-300'
                          : 'text-gray-400 italic bg-gray-50/50 border-gray-200 hover:border-primary-300'}`}>
                      {form.description || 'Kliknij Edytuj aby dodać opis zadania...'}
                    </div>
                  )}
                </div>

                {/* Status + Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Status</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(STATUS).map(([k, v]) => {
                        const Icon = v.icon;
                        return (
                          <button key={k} type="button" onClick={() => handleChange('status', k)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all
                              ${form.status === k ? 'bg-white border-primary-300 shadow-sm text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                            <Icon className="h-3.5 w-3.5" /> {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Priorytet</label>
                    <div className="space-y-1">
                      {Object.entries(PRIORITY).map(([k, v]) => {
                        const Icon = v.icon;
                        return (
                          <button key={k} type="button" onClick={() => handleChange('priority', k)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                              ${form.priority === k ? 'bg-white shadow-sm border border-gray-200 text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent'}`}>
                            <span className={`w-2 h-2 rounded-full ${v.bar}`} /> <Icon className="h-3.5 w-3.5" /> {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Assignees */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Users className="h-4 w-4 text-gray-400" /> Przypisani
                  </label>
                  <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto rounded-xl border border-gray-200 p-1">
                    {users.map((u) => {
                      const sel = form.assignees.includes(u._id);
                      return (
                        <button key={u._id} type="button" onClick={() => {
                          handleChange('assignees', sel ? form.assignees.filter(id => id !== u._id) : [...form.assignees, u._id]);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all
                          ${sel ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          {u.firstName} {u.lastName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Watchers */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Eye className="h-4 w-4 text-gray-400" /> Obserwujący
                  </label>
                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto rounded-xl border border-gray-200 p-1">
                    {users.map((u) => {
                      const sel = form.watchers.includes(u._id);
                      return (
                        <button key={u._id} type="button" onClick={() => {
                          handleChange('watchers', sel ? form.watchers.filter(id => id !== u._id) : [...form.watchers, u._id]);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all
                          ${sel ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}>
                          <Bell className="h-3.5 w-3.5" /> {u.firstName} {u.lastName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right column - meta */}
              <div className="space-y-5">
                {/* Private toggle */}
                <label className={`flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all
                  ${form.isPrivate ? 'border-amber-300 bg-amber-50/50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${form.isPrivate ? 'bg-amber-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${form.isPrivate ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <Lock className="h-4 w-4 text-amber-600" /> Zadanie prywatne
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Widoczne tylko dla przypisanych i obserwujących</div>
                  </div>
                  <input type="checkbox" checked={form.isPrivate} onChange={() => handleChange('isPrivate', !form.isPrivate)} className="sr-only" />
                </label>

                {/* Due date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Termin</label>
                    <input type="date" value={form.dueDate} onChange={(e) => handleChange('dueDate', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Godzina</label>
                    <input type="time" value={form.dueTimeMinutes === '' || form.dueTimeMinutes === null ? '' :
                      `${String(Math.floor(form.dueTimeMinutes / 60)).padStart(2, '0')}:${String(form.dueTimeMinutes % 60).padStart(2, '0')}`}
                      onChange={(e) => { const val = e.target.value; if (!val) handleChange('dueTimeMinutes', ''); else { const [h, m] = val.split(':').map(Number); handleChange('dueTimeMinutes', h * 60 + m); } }}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>

                {/* Project */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                    <FolderOpen className="h-4 w-4 text-gray-400" /> Projekt
                  </label>
                  <ProjectSearchSelect
                    value={form.project}
                    onChange={(v) => handleChange('project', v)}
                    projects={projects}
                  />
                </div>

                {/* Metadata */}
                {t?.createdBy && (
                  <div className="rounded-xl bg-gray-50/60 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Utworzone przez</span>
                      <span className="font-medium text-gray-700">{t.createdBy.firstName} {t.createdBy.lastName}</span>
                    </div>
                    {t.createdAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Data utworzenia</span>
                        <span className="font-medium text-gray-700">{format(parseISO(t.createdAt), 'd MMM yyyy HH:mm', { locale: pl })}</span>
                      </div>
                    )}
                    {t.completedAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Ukończono</span>
                        <span className="font-medium text-emerald-600">{format(parseISO(t.completedAt), 'd MMM yyyy HH:mm', { locale: pl })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Updates */}
        {tab === 'updates' && (
          <div className="flex-1 overflow-y-auto p-6 task-scrollbar">
            <div className="max-w-2xl">
              <div className="mb-6 space-y-2">
                <textarea value={updateText} onChange={(e) => setUpdateText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none min-h-[80px] placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Napisz update — co zrobiłeś/aś, postęp, uwagi..." rows={3}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddUpdate(); } }} />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => updateFileRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
                      <Paperclip className="h-3.5 w-3.5" />
                      {updateFiles.length > 0 ? `${updateFiles.length} plik(ów)` : 'Dodaj plik'}
                    </button>
                    {updateFiles.length > 0 && (
                      <button type="button" onClick={() => setUpdateFiles([])} className="text-xs text-red-500 hover:text-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <input ref={updateFileRef} type="file" multiple className="hidden"
                      onChange={(e) => setUpdateFiles(Array.from(e.target.files))} />
                  </div>
                  <button type="button" onClick={handleAddUpdate}
                    disabled={(!updateText.trim() && updateFiles.length === 0) || addUpdateMutation.isLoading || uploadMutation.isLoading}
                    className="shrink-0 btn-primary !py-2 !px-4 flex items-center gap-2 !rounded-xl text-sm">
                    {(addUpdateMutation.isLoading || uploadMutation.isLoading)
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send className="h-4 w-4" />}
                    {(addUpdateMutation.isLoading || uploadMutation.isLoading) ? 'Wysyłam...' : 'Wyślij'}
                  </button>
                </div>
              </div>

              {(!t?.updates || t.updates.length === 0) ? (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Brak update'ów. Dodaj pierwszy wpis.</p>
                </div>
              ) : (
                <div className="space-y-0 relative pl-8 before:absolute before:left-[15px] before:top-0 before:bottom-0 before:w-[2px] before:bg-gradient-to-b before:from-primary-200 before:via-gray-200 before:to-transparent">
                  {[...t.updates].reverse().map((u, i) => (
                    <div key={u._id || i} className="relative pb-6 last:pb-0">
                      <div className="absolute -left-[25px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-primary-200" />
                      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {u.author?.firstName?.[0]}{u.author?.lastName?.[0]}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{u.author?.firstName} {u.author?.lastName}</span>
                          <span className="text-[10px] text-gray-400">{u.createdAt ? format(parseISO(u.createdAt), 'd MMM yyyy, HH:mm', { locale: pl }) : ''}</span>
                          <button
                            type="button"
                            onClick={() => deleteUpdateMutation.mutate(u._id)}
                            disabled={deleteUpdateMutation.isLoading}
                            className="ml-auto p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            title="Usuń update"
                          >
                            {deleteUpdateMutation.variables === u._id && deleteUpdateMutation.isLoading
                              ? <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {u.text && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">{u.text}</p>}
                        {u.attachments && u.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {u.attachments.map((att, ai) => (
                              <a
                                key={ai}
                                href={`${process.env.REACT_APP_API_URL || ''}/uploads/tasks/${att.filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="max-w-[160px] truncate">{att.originalname}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Files */}
        {tab === 'files' && (
          <div className="flex-1 overflow-y-auto p-6 task-scrollbar">
            <div
              ref={dropRef}
              className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all mb-6
                ${dragOver ? 'border-primary-400 bg-primary-50/50 upload-drop-active' : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className={`h-12 w-12 mx-auto mb-3 ${dragOver ? 'text-primary-500' : 'text-gray-300'}`} />
              <p className="text-sm font-medium text-gray-600 mb-1">Przeciągnij pliki tutaj lub kliknij aby wybrać</p>
              <p className="text-xs text-gray-400">Maks. 50 MB na plik. Dowolny typ pliku.</p>
              <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFileUpload(e.target.files)} className="hidden" />
            </div>

            {uploading && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl mb-4">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary-700">Przesyłanie plików...</span>
              </div>
            )}

            {(!t?.attachments || t.attachments.length === 0) && !uploading ? (
              <div className="text-center py-8 text-gray-400">
                <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Brak załączników</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {t?.attachments?.map((att) => {
                  const FileIcon = getFileIcon(att.mimetype);
                  return (
                    <div key={att._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group bg-white">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <FileIcon className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{att.originalname}</p>
                        <p className="text-[10px] text-gray-400">{att.mimetype} &middot; {formatFileSize(att.size)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={`${process.env.REACT_APP_API_URL || ''}/uploads/tasks/${att.filename}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                          <Download className="h-4 w-4" />
                        </a>
                        <button type="button" onClick={() => deleteAttachmentMutation.mutate(att._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Links */}
        {tab === 'links' && (
          <div className="flex-1 overflow-y-auto p-6 task-scrollbar">
            <div className="max-w-2xl">
              <div className="mb-6 space-y-2">
                <div className="flex gap-2">
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (linkUrl.trim()) { addLinkMutation.mutate({ url: linkUrl.trim(), title: linkTitle.trim() }); setLinkUrl(''); setLinkTitle(''); } } }} />
                  <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
                    className="w-40 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Nazwa (opcjonalnie)" />
                  <button type="button"
                    onClick={() => { if (linkUrl.trim()) { addLinkMutation.mutate({ url: linkUrl.trim(), title: linkTitle.trim() }); setLinkUrl(''); setLinkTitle(''); } }}
                    disabled={!linkUrl.trim() || addLinkMutation.isLoading}
                    className="btn-primary !py-2.5 !px-4 !rounded-xl flex items-center gap-1.5 text-sm shrink-0">
                    {addLinkMutation.isLoading
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Plus className="h-4 w-4" />}
                    {addLinkMutation.isLoading ? 'Dodaję...' : 'Dodaj'}
                  </button>
                </div>
              </div>

              {(!t?.links || t.links.length === 0) ? (
                <div className="text-center py-12 text-gray-400">
                  <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Brak linków. Dodaj pierwszy link.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {t.links.map((l) => (
                    <div key={l._id} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                        <Link2 className="h-4 w-4 text-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {l.title && <p className="text-sm font-medium text-gray-800 truncate">{l.title}</p>}
                        <a href={l.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline truncate block max-w-full" onClick={(e) => e.stopPropagation()}>
                          {l.url}
                        </a>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={l.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button type="button" onClick={() => deleteLinkMutation.mutate(l._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {tab === 'details' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <div className="flex items-center gap-2">
              {isEdit && t?.source?.kind && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Źródło: {t.source.kind}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn-secondary !py-2.5 !px-5 !rounded-xl text-sm">Zamknij</button>
              {isEdit && (
                <button type="button" onClick={handleSave} disabled={updateMutation.isLoading}
                  className="btn-primary !py-2.5 !px-5 !rounded-xl text-sm flex items-center gap-2">
                  {updateMutation.isLoading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Sparkles className="h-4 w-4" />}
                  {updateMutation.isLoading ? 'Zapisuję...' : 'Zapisz'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────── NEW TASK MODAL ──────────────

function NewTaskModal({ initialDueDate, users = [], projects = [], onClose, onSaved }) {
  useEscClose(onClose);
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'normal',
    assignees: [], watchers: [], isPrivate: false, project: '',
    dueDate: initialDueDate ? format(initialDueDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    dueTimeMinutes: '', durationMinutes: 60,
    recurrenceEnabled: false, recurrenceFrequency: 'weekly', recurrenceInterval: 1,
    recurrenceUntilDate: '', recurrenceWeekdaysOnly: false
  });

  const createMutation = useMutation((data) => tasksAPI.create(data), {
    onSuccess: (_data, vars) => {
      toast.success(vars.recurrence?.enabled ? 'Zadanie cykliczne dodane. Kolejne wystąpienia pojawią się po wykonaniu bieżącego.' : 'Zadanie dodane');
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu')
  });

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Podaj tytuł'); return; }
    const payload = {
      title: form.title.trim(), description: (form.description || '').trim(),
      status: form.status, priority: form.priority,
      assignees: form.assignees.filter(Boolean), watchers: form.watchers.filter(Boolean),
      isPrivate: !!form.isPrivate, project: form.project || null,
      dueDate: form.dueDate, dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
      durationMinutes: Number(form.durationMinutes) || 60,
      ...(form.recurrenceEnabled ? {
        recurrence: { enabled: true, frequency: form.recurrenceFrequency, interval: Number(form.recurrenceInterval) || 1,
          weekdaysOnly: !!form.recurrenceWeekdaysOnly, ...(form.recurrenceUntilDate ? { untilDate: form.recurrenceUntilDate } : {}) }
      } : {})
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex modal-backdrop-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl mx-4 md:mx-auto my-4 md:my-8 bg-white rounded-2xl shadow-2xl modal-slide-up flex flex-col max-h-[calc(100vh-2rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nowe zadanie</h2>
              <p className="text-xs text-gray-500">Dodaj nowe zadanie do systemu</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 task-scrollbar">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Tytuł *</label>
              <input type="text" value={form.title} onChange={(e) => handleChange('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Nazwa zadania..." autoFocus required />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Opis</label>
              <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-y min-h-[100px] focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Szczegółowy opis zadania..." rows={4} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Termin *</label>
                <input type="date" value={form.dueDate} onChange={(e) => handleChange('dueDate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Godzina</label>
                <input type="time" value={form.dueTimeMinutes === '' ? '' :
                  `${String(Math.floor((form.dueTimeMinutes || 0) / 60)).padStart(2, '0')}:${String((form.dueTimeMinutes || 0) % 60).padStart(2, '0')}`}
                  onChange={(e) => { const v = e.target.value; if (!v) handleChange('dueTimeMinutes', ''); else { const [h, m] = v.split(':').map(Number); handleChange('dueTimeMinutes', h * 60 + m); } }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Status</label>
                <select value={form.status} onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Priorytet</label>
                <select value={form.priority} onChange={(e) => handleChange('priority', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Projekt</label>
              <ProjectSearchSelect
                value={form.project}
                onChange={(v) => setForm(f => ({ ...f, project: v }))}
                projects={projects}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Przypisani</label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 p-1 space-y-0.5">
                  {users.map((u) => {
                    const sel = form.assignees.includes(u._id);
                    return (
                      <button key={u._id} type="button" onClick={() => handleChange('assignees', sel ? form.assignees.filter(id => id !== u._id) : [...form.assignees, u._id])}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${sel ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[9px] font-bold">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                        {u.firstName} {u.lastName}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Obserwujący</label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 p-1 space-y-0.5">
                  {users.map((u) => {
                    const sel = form.watchers.includes(u._id);
                    return (
                      <button key={u._id} type="button" onClick={() => handleChange('watchers', sel ? form.watchers.filter(id => id !== u._id) : [...form.watchers, u._id])}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${sel ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}>
                        <Bell className="h-3 w-3" /> {u.firstName} {u.lastName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className={`flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all ${form.isPrivate ? 'border-amber-300 bg-amber-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${form.isPrivate ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${form.isPrivate ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4 text-amber-600" /> Zadanie prywatne</div>
                <div className="text-xs text-gray-500 mt-0.5">Widoczne tylko dla przypisanych i obserwujących</div>
              </div>
              <input type="checkbox" checked={form.isPrivate} onChange={() => handleChange('isPrivate', !form.isPrivate)} className="sr-only" />
            </label>

            <details className="rounded-xl border border-gray-200 overflow-hidden">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm font-semibold text-gray-700">
                <RotateCcw className="h-4 w-4 text-gray-400" /> Powtarzaj zadanie
              </summary>
              <div className="p-4 bg-gray-50/50 border-t border-gray-200 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Częstotliwość</label>
                    <select value={form.recurrenceFrequency} onChange={(e) => handleChange('recurrenceFrequency', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                      <option value="daily">Codziennie</option><option value="weekly">Co tydzień</option><option value="monthly">Co miesiąc</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Co ile</label>
                    <input type="number" min={1} max={365} value={form.recurrenceInterval} onChange={(e) => handleChange('recurrenceInterval', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Do kiedy</label>
                    <input type="date" value={form.recurrenceUntilDate} onChange={(e) => handleChange('recurrenceUntilDate', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.recurrenceWeekdaysOnly} onChange={(e) => handleChange('recurrenceWeekdaysOnly', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600" />
                  Tylko dni robocze
                </label>
              </div>
            </details>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={createMutation.isLoading} className="btn-secondary !py-2.5 !px-5 !rounded-xl text-sm">Anuluj</button>
          <button type="button" onClick={handleSubmit} disabled={createMutation.isLoading}
            className="btn-primary !py-2.5 !px-5 !rounded-xl text-sm flex items-center gap-2">
            {createMutation.isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="h-4 w-4" />}
            {createMutation.isLoading ? 'Dodaję...' : 'Dodaj zadanie'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────── FOLLOW-UP MODAL ──────────────

function FollowUpCompleteModal({ task, onClose, onSubmit, isLoading }) {
  useEscClose(onClose);
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop-in bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 modal-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Oznacz follow-up jako wykonany</h2>
        <p className="text-sm text-gray-500 mb-5">Wpisz treść follow-upa — zapisze się w ofercie, a projekt przestanie świecić na czerwono.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-y min-h-[120px] focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
          placeholder="Treść follow-upa..." autoFocus required />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !rounded-xl">Anuluj</button>
          <button type="button" onClick={() => note.trim() && onSubmit(note.trim())} disabled={isLoading || !note.trim()}
            className="btn-primary !rounded-xl flex items-center gap-2">
            {isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isLoading ? 'Zapisuję...' : 'Zapisz i oznacz'}
          </button>
        </div>
      </div>
    </div>
  );
}



const DEFAULT_FILTERS = { assignee: '', project: '', status: '', priority: '', dateFrom: '', dateTo: '' };

// ── Mobile task card (module-level so it never remounts on parent re-render) ──
function MobileTaskCard({ t, onOpen, onToggleDone }) {
  const isOverdue = t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()));
  const assigneesList = t.assignees?.length > 0 ? t.assignees : (t.assignee ? [t.assignee] : []);
  return (
    <button
      type="button"
      className={`w-full text-left bg-white rounded-2xl border shadow-sm overflow-hidden border-l-4 active:opacity-80 transition-opacity ${
        t.status === 'done' ? 'border-l-green-400 opacity-75' : isOverdue ? 'border-l-red-400' : 'border-l-primary-400'
      }`}
      onClick={() => onOpen(t)}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          role="checkbox"
          aria-checked={t.status === 'done'}
          onClick={(e) => { e.stopPropagation(); onToggleDone(t); }}
          className="shrink-0 pt-0.5 cursor-pointer"
        >
          <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            t.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'
          }`}>
            {t.status === 'done' && <CheckCircle2 className="h-4 w-4 text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-snug ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {t.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {t.project?.name && <span className="text-xs text-gray-500 max-w-[180px] truncate">{t.project.name}</span>}
            {t.dueDate && (
              <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                {format(parseISO(t.dueDate), 'd MMM', { locale: pl })}
              </span>
            )}
            {assigneesList[0] && (
              <span className="text-xs text-gray-400">{assigneesList[0].firstName} {assigneesList[0].lastName}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
            {PRIORITY_LABELS[t.priority] ?? ''}
          </span>
          <span className="text-xs text-gray-400">{STATUS_LABELS[t.status]}</span>
        </div>
      </div>
    </button>
  );
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(new Date());
  const [week, setWeek] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState('month');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Mobile-only state
  const [mobileTab, setMobileTab] = useState('today'); // 'today' | 'all' | 'calendar'
  const [mobileStatusFilter, setMobileStatusFilter] = useState('');
  const [mobilePriorityFilter, setMobilePriorityFilter] = useState('');
  const [mobileMyOnly, setMobileMyOnly] = useState(false);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(new Date());
  const [mobileWeek, setMobileWeek] = useState(new Date());
  const [detailTask, setDetailTask] = useState(null);
  const [newTaskDate, setNewTaskDate] = useState(null);
  const [followUpCompleteTask, setFollowUpCompleteTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [dayContextMenu, setDayContextMenu] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const filtersInitializedRef = useRef(false);

  const { data: meData } = useQuery('me', authAPI.me, { staleTime: 60 * 1000 });

  const openTaskIdFromState = location.state?.openTaskId;
  useEffect(() => {
    if (!openTaskIdFromState) return;
    tasksAPI.getById(openTaskIdFromState)
      .then((task) => {
        setDetailTask(task);
        navigate(location.pathname, { replace: true, state: {} });
      })
      .catch(() => {
        navigate(location.pathname, { replace: true, state: {} });
      });
  }, [openTaskIdFromState, navigate, location.pathname]);

  useEffect(() => {
    if (meData === undefined || filtersInitializedRef.current) return;
    filtersInitializedRef.current = true;
    const saved = meData?.user?.settings?.tasksFilters;
    if (saved && typeof saved === 'object') {
      setFilters({
        assignee: saved.assignee ?? '',
        project: saved.project ?? '',
        status: saved.status ?? '',
        priority: saved.priority ?? '',
        dateFrom: saved.dateFrom ?? '',
        dateTo: saved.dateTo ?? ''
      });
      if (saved.view === 'list' || saved.view === 'calendar') setView(saved.view);
      if (saved.calendarMode === 'month' || saved.calendarMode === 'week') setCalendarMode(saved.calendarMode);
    }
  }, [meData]);

  useEffect(() => {
    if (!filtersInitializedRef.current) return;
    const t = setTimeout(() => {
      authAPI
        .updateSettings({
          tasksFilters: {
            ...filters,
            view,
            calendarMode
          }
        })
        .then(() => {
          queryClient.invalidateQueries('me');
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [filters, view, calendarMode, queryClient]);

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

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const overdueStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const { data: todayTasks = [] } = useQuery(
    ['tasks-today'],
    () => tasksAPI.getAll({ dateFrom: todayStr, dateTo: todayStr, limit: 100 }),
    { staleTime: 60 * 1000 }
  );
  const { data: overdueTasks = [] } = useQuery(
    ['tasks-overdue'],
    () => tasksAPI.getAll({ dateTo: overdueStr, limit: 100 }),
    { staleTime: 60 * 1000 }
  );
  const todayPending = todayTasks.filter(t => t.status !== 'done');
  const overdueFiltered = overdueTasks.filter(t => t.status !== 'done');
  const [todayDoneOpen, setTodayDoneOpen] = useState(false);

  const deleteMutation = useMutation((id) => tasksAPI.delete(id), {
    onMutate: async (id) => {
      await queryClient.cancelQueries(['tasks']);
      const prev = queryClient.getQueriesData(['tasks']);
      queryClient.setQueriesData(['tasks'], (old) => Array.isArray(old) ? old.filter((t) => t._id !== id) : old);
      return { prev };
    },
    onSuccess: () => toast.success('Zadanie usunięte'),
    onError: (_err, _vars, context) => {
      if (context?.prev) context.prev.forEach(([k, d]) => queryClient.setQueryData(k, d));
      toast.error('Błąd usuwania');
    },
    onSettled: () => queryClient.invalidateQueries(['tasks'])
  });

  const toggleDoneMutation = useMutation(
    ({ id, status }) => tasksAPI.update(id, { status }),
    {
      onMutate: async ({ id, status }) => {
        await queryClient.cancelQueries(['tasks']);
        const previous = queryClient.getQueriesData(['tasks']);
        queryClient.setQueriesData(['tasks'], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => (t._id === id ? { ...t, status } : t));
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          context.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
        }
        toast.error('Nie udało się zaktualizować statusu zadania');
      }
    }
  );

  const moveDueDateMutation = useMutation(
    ({ id, dueDate }) => tasksAPI.update(id, { dueDate }),
    {
      onMutate: async ({ id, dueDate: targetDateKey }) => {
        await queryClient.cancelQueries(['tasks']);
        const previous = queryClient.getQueriesData(['tasks']);
        queryClient.setQueriesData(['tasks'], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => (t._id === id ? { ...t, dueDate: targetDateKey } : t));
        });
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          context.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
        }
        toast.error('Nie udało się przenieść zadania');
      }
    }
  );

  const followUpCompleteMutation = useMutation(
    async ({ task, note }) => {
      const projectId = task.source?.refId || task.project?._id || task.project;
      if (!projectId) throw new Error('Brak powiązanego projektu');
      await projectsAPI.addFollowUp(projectId, note);
      // Backend completeCurrentAndCreateNextFollowUpTask marks this task done (stays on same day) and creates new todo task for next date
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries('projects');
        setFollowUpCompleteTask(null);
        toast.success('Follow-up zapisany, zadanie wykonane');
      },
      onError: (e) => toast.error(e.response?.data?.message || e.message || 'Błąd zapisu follow-upu')
    }
  );

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const openContextMenu = (task, clientX, clientY) => {
    setDayContextMenu(null);
    setContextMenu({ task, x: clientX, y: clientY });
  };
  const openDayContextMenu = (day, clientX, clientY) => {
    setContextMenu(null);
    setDayContextMenu({ date: day, x: clientX, y: clientY });
  };

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

  const openCreate = (dueDate) => setNewTaskDate(dueDate || new Date());
  const openEdit = (task) => setDetailTask(task);

  const handleToggleDone = (task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    if (nextStatus === 'done' && task.source?.kind === 'followup') {
      setFollowUpCompleteTask(task);
      return;
    }
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

  // Mobile helpers
  const mobileWeekDays = useMemo(() => {
    const start = startOfWeek(mobileWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [mobileWeek]);

  const mobileWeekStart = format(startOfWeek(mobileWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const mobileWeekEnd = format(endOfWeek(mobileWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: mobileWeekTasks = [] } = useQuery(
    ['tasks-mobile-week', mobileWeekStart, mobileWeekEnd],
    () => tasksAPI.getAll({ dateFrom: mobileWeekStart, dateTo: mobileWeekEnd, limit: 200 }),
    { staleTime: 60 * 1000 }
  );
  const myId = meData?.user?._id;
  const isMine = (t) => !myId || (t.assignees?.includes(myId) || t.assignee?._id === myId || t.assignee === myId);

  const mobileCalendarTasks = useMemo(() => {
    const key = format(mobileSelectedDay, 'yyyy-MM-dd');
    return mobileWeekTasks
      .filter(t => t.dueDate && format(parseISO(t.dueDate), 'yyyy-MM-dd') === key)
      .filter(t => !mobileMyOnly || isMine(t))
      .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
  }, [mobileWeekTasks, mobileSelectedDay, mobileMyOnly, myId]); // eslint-disable-line

  const mobileFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (mobileStatusFilter && t.status !== mobileStatusFilter) return false;
      if (mobilePriorityFilter && t.priority !== mobilePriorityFilter) return false;
      if (mobileMyOnly && !isMine(t)) return false;
      return true;
    }).sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    });
  }, [tasks, mobileStatusFilter, mobilePriorityFilter]);

  return (
    <>
    {/* ═══════════════════ MOBILE LAYOUT ═══════════════════ */}
    <div className="sm:hidden -m-4 min-h-screen bg-gray-50 flex flex-col pb-28">

      {/* Mobile tab bar — top-14 accounts for Layout's mobile top bar (~56px) */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10 shadow-sm">
        <div className="flex">
          {[
            { id: 'today', label: 'Dziś', badge: todayPending.length + overdueFiltered.length },
            { id: 'all', label: 'Wszystkie' },
            { id: 'calendar', label: 'Kalendarz' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 py-3.5 text-sm font-semibold relative transition-colors ${
                mobileTab === tab.id ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  tab.id === 'today' && overdueFiltered.length > 0 ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'
                }`}>{tab.badge}</span>
              )}
              {mobileTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
              )}
            </button>
          ))}
          {/* "Moje" toggle — right side of tab bar */}
          <button
            type="button"
            onClick={() => setMobileMyOnly(v => !v)}
            className={`px-3 py-3.5 text-xs font-bold transition-colors shrink-0 border-l border-gray-100 ${
              mobileMyOnly ? 'text-primary-600 bg-primary-50' : 'text-gray-400'
            }`}
          >
            Moje
          </button>
        </div>
      </div>

      {/* ── Tab: Dziś ── */}
      {mobileTab === 'today' && (
        <div className="flex-1 space-y-0">

          {/* Progress header */}
          <div className="bg-white px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400 font-medium capitalize">
                  {format(new Date(), 'EEEE, d MMMM', { locale: pl })}
                </p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  {overdueFiltered.length > 0
                    ? `${overdueFiltered.length} przeterminowanych`
                    : todayPending.length === 0 && todayTasks.length > 0
                      ? 'Wszystko zrobione!'
                      : `${todayPending.length} do zrobienia`}
                </p>
              </div>
              {todayTasks.length > 0 && (
                <div className="relative h-12 w-12">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5"/>
                    <circle cx="18" cy="18" r="14" fill="none"
                      stroke={overdueFiltered.length > 0 ? '#ef4444' : todayPending.length === 0 ? '#22c55e' : '#2563eb'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${((todayTasks.length - todayPending.length) / todayTasks.length) * 88} 88`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                    {todayTasks.length - todayPending.length}/{todayTasks.length}
                  </span>
                </div>
              )}
            </div>
            {todayTasks.length > 0 && (
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${overdueFiltered.length > 0 ? 'bg-red-500' : 'bg-primary-500'}`}
                  style={{ width: `${((todayTasks.length - todayPending.length) / todayTasks.length) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Overdue section */}
          {(() => {
            const visibleOverdue = overdueFiltered.filter(t => !mobileMyOnly || isMine(t));
            return visibleOverdue.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0"/>
                  <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                    Przeterminowane — {visibleOverdue.length}
                  </span>
                </div>
                <div className="p-4 space-y-2 bg-red-50/30">
                  {visibleOverdue
                    .sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0))
                    .map(t => (
                      <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />
                    ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/>
                  <div className="h-3 bg-gray-200 rounded w-1/3"/>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && todayTasks.length === 0 && overdueFiltered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <CheckCircle2 className="h-16 w-16 text-green-400 mb-4 opacity-60" />
              <p className="text-lg font-semibold text-gray-700">Wolny dzień!</p>
              <p className="text-sm text-gray-400 mt-1">Brak zadań na dziś</p>
              <button type="button" onClick={() => openCreate(new Date())}
                className="mt-5 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold">
                Dodaj zadanie
              </button>
            </div>
          )}

          {/* In progress section */}
          {!isLoading && (() => {
            const inProgress = todayTasks.filter(t => t.status === 'in_progress' && (!mobileMyOnly || isMine(t)));
            return inProgress.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <Zap className="h-4 w-4 text-blue-500 shrink-0"/>
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                    W toku — {inProgress.length}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {inProgress.map(t => <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />)}
                </div>
              </div>
            ) : null;
          })()}

          {/* To do section */}
          {!isLoading && (() => {
            const todos = todayTasks.filter(t => t.status === 'todo' && (!mobileMyOnly || isMine(t)));
            return todos.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                  <Circle className="h-4 w-4 text-gray-400 shrink-0"/>
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                    Do zrobienia — {todos.length}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {todos
                    .sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0))
                    .map(t => <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />)}
                </div>
              </div>
            ) : null;
          })()}

          {/* Done section — collapsible */}
          {!isLoading && todayTasks.filter(t => t.status === 'done' && (!mobileMyOnly || isMine(t))).length > 0 && (
            <div>
              <button type="button"
                onClick={() => setTodayDoneOpen(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-100 border-t border-t-gray-100"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0"/>
                <span className="text-xs font-bold text-green-700 uppercase tracking-wide flex-1 text-left">
                  Zrobione — {todayTasks.filter(t => t.status === 'done' && (!mobileMyOnly || isMine(t))).length}
                </span>
                <ChevronDown className={`h-4 w-4 text-green-500 transition-transform ${todayDoneOpen ? 'rotate-180' : ''}`}/>
              </button>
              {todayDoneOpen && (
                <div className="p-4 space-y-2 bg-green-50/20">
                  {todayTasks.filter(t => t.status === 'done' && (!mobileMyOnly || isMine(t)))
                    .map(t => <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Wszystkie ── */}
      {mobileTab === 'all' && (
        <div className="flex-1 flex flex-col">
          {/* Filter chips */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{scrollbarWidth:'none'}}>
              {[{v:'',l:'Wszystkie'},{v:'todo',l:'Do zrobienia'},{v:'in_progress',l:'W toku'},{v:'review',l:'Przegląd'},{v:'done',l:'Zrobione'}].map(s=>(
                <button key={s.v} type="button" onClick={()=>setMobileStatusFilter(s.v)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mobileStatusFilter===s.v?'bg-primary-600 text-white':'bg-gray-100 text-gray-600'}`}>
                  {s.l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{scrollbarWidth:'none'}}>
              {[{v:'',l:'Priorytet'},{v:'urgent',l:'Pilny'},{v:'high',l:'Wysoki'},{v:'normal',l:'Normalny'},{v:'low',l:'Niski'}].map(p=>(
                <button key={p.v} type="button" onClick={()=>setMobilePriorityFilter(p.v)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mobilePriorityFilter===p.v?'bg-gray-800 text-white':'bg-gray-100 text-gray-600'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">{Array.from({length:5}).map((_,i)=>(
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/>
                  <div className="h-3 bg-gray-200 rounded w-1/3"/>
                </div>
              ))}</div>
            ) : mobileFilteredTasks.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Circle className="h-12 w-12 mx-auto mb-3 opacity-30"/>
                <p>Brak zadań</p>
              </div>
            ) : mobileFilteredTasks.map(t => <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />)}
          </div>
        </div>
      )}

      {/* ── Tab: Kalendarz ── */}
      {mobileTab === 'calendar' && (
        <div className="flex-1 flex flex-col">
          {/* Week navigation */}
          <div className="bg-white border-b border-gray-100 px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={()=>setMobileWeek(w=>subWeeks(w,1))} className="p-2 rounded-xl active:bg-gray-100">
                <ChevronLeft className="h-5 w-5 text-gray-600"/>
              </button>
              <span className="text-sm font-semibold text-gray-700 capitalize">
                {format(mobileWeekDays[0], 'd MMM', {locale:pl})} – {format(mobileWeekDays[6], 'd MMM yyyy', {locale:pl})}
              </span>
              <button type="button" onClick={()=>setMobileWeek(w=>addWeeks(w,1))} className="p-2 rounded-xl active:bg-gray-100">
                <ChevronRight className="h-5 w-5 text-gray-600"/>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {mobileWeekDays.map(day => {
                const isSelected = format(day,'yyyy-MM-dd')===format(mobileSelectedDay,'yyyy-MM-dd');
                const isT = isToday(day);
                const dayKey = format(day,'yyyy-MM-dd');
                const count = mobileWeekTasks.filter(t=>t.dueDate&&format(parseISO(t.dueDate),'yyyy-MM-dd')===dayKey).length;
                return (
                  <button key={dayKey} type="button" onClick={()=>setMobileSelectedDay(day)}
                    className={`flex flex-col items-center py-2 px-1 rounded-2xl transition-colors ${isSelected?'bg-primary-600 text-white':isT?'bg-primary-50 text-primary-700':'text-gray-700 active:bg-gray-100'}`}>
                    <span className="text-[10px] font-medium">{format(day,'EEE',{locale:pl}).substring(0,2)}</span>
                    <span className={`text-base font-bold ${isSelected?'text-white':''}`}>{format(day,'d')}</span>
                    {count>0&&<div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected?'bg-white':'bg-primary-400'}`}/>}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Day tasks */}
          <div className="flex-1 p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700 capitalize">
                {format(mobileSelectedDay, 'EEEE, d MMMM', {locale:pl})}
              </p>
              <button type="button" onClick={()=>openCreate(mobileSelectedDay)}
                className="text-xs text-primary-600 font-semibold px-3 py-1.5 bg-primary-50 rounded-xl active:bg-primary-100">
                + Dodaj
              </button>
            </div>
            {mobileCalendarTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30"/>
                <p className="text-sm">Brak zadań na ten dzień</p>
              </div>
            ) : mobileCalendarTasks.map(t => <MobileTaskCard key={t._id} t={t} onOpen={openEdit} onToggleDone={handleToggleDone} />)}
          </div>
        </div>
      )}

      {/* FAB — with iOS safe-area bottom offset */}
      <button
        type="button"
        onClick={() => openCreate()}
        className="fixed right-5 z-30 h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', boxShadow:'0 4px 20px rgba(37,99,235,0.4)' }}
      >
        <Plus className="h-6 w-6"/>
      </button>
    </div>

    {/* ═══════════════════ DESKTOP LAYOUT ═══════════════════ */}
    <div className="hidden sm:block space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Zadania</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <List className="h-4 w-4" /> Lista
          </button>
          <button type="button" onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${view === 'calendar' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <CalendarIcon className="h-4 w-4" /> Kalendarz
          </button>
          {view === 'calendar' && (
            <div className="flex items-center gap-1 ml-1">
              <button type="button" onClick={() => setCalendarMode('month')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${calendarMode === 'month' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Miesiąc
              </button>
              <button type="button" onClick={() => setCalendarMode('week')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${calendarMode === 'week' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Tydzień
              </button>
            </div>
          )}
          <button onClick={() => openCreate()} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nowe zadanie
          </button>
        </div>
      </div>

      {/* Zadania na dziś */}
      {todayPending.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-primary-800 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Na dziś — {todayPending.length} {todayPending.length === 1 ? 'zadanie' : 'zadań'}
            </h2>
          </div>
          <div className="space-y-1.5">
            {todayPending.slice(0, 5).map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => openEdit(t)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl hover:bg-primary-50 border border-primary-100 transition-colors"
              >
                <div onClick={(e) => { e.stopPropagation(); handleToggleDone(t); }}
                  className="shrink-0 h-5 w-5 rounded-full border-2 border-primary-300 flex items-center justify-center hover:border-primary-500 transition-colors" />
                <span className="flex-1 text-sm text-gray-800 truncate">{t.title}</span>
                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100'}`}>
                  {PRIORITY_LABELS[t.priority]?.[0] ?? ''}
                </span>
              </button>
            ))}
            {todayPending.length > 5 && (
              <p className="text-xs text-primary-600 text-center pt-1">+{todayPending.length - 5} więcej</p>
            )}
          </div>
        </div>
      )}

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
        <>
          {isLoading ? (
            <div className="card overflow-hidden">
              <div className="space-y-3 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="h-5 w-5 bg-gray-200 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="card py-12 text-center text-gray-500">Brak zadań dla wybranych filtrów.</div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {[...tasks]
                  .sort((a, b) => {
                    const doneA = a.status === 'done' ? 1 : 0;
                    const doneB = b.status === 'done' ? 1 : 0;
                    if (doneA !== doneB) return doneA - doneB;
                    return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
                  })
                  .map((t) => {
                    const isOverdue = t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()));
                    const assigneesList = t.assignees?.length > 0 ? t.assignees : (t.assignee ? [t.assignee] : []);
                    return (
                      <div
                        key={t._id}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden border-l-4 active:bg-gray-50 transition-colors ${
                          t.status === 'done' ? 'border-l-green-400 opacity-80' : isOverdue ? 'border-l-red-400' : 'border-l-primary-400'
                        }`}
                        onClick={() => openEdit(t)}
                      >
                        <div className="flex items-start gap-3 p-4">
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
                            <input
                              type="checkbox"
                              checked={t.status === 'done'}
                              onChange={() => handleToggleDone(t)}
                              className="h-5 w-5 rounded border-gray-300 text-primary-600"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm leading-snug ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {t.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                              {t.project?.name && (
                                <span className="text-xs text-gray-500 truncate max-w-[160px]">{t.project.name}</span>
                              )}
                              {t.dueDate && (
                                <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                  {format(parseISO(t.dueDate), 'd MMM', { locale: pl })}
                                </span>
                              )}
                              {assigneesList.length > 0 && (
                                <span className="text-xs text-gray-400">
                                  {assigneesList[0].firstName} {assigneesList[0].lastName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                              {PRIORITY_LABELS[t.priority]?.[0] ?? ''}
                            </span>
                            <span className="text-xs text-gray-400">{STATUS_LABELS[t.status] ?? t.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="w-10 p-3"><span className="sr-only">Zrobione</span></th>
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
                            <tr key={t._id} className={`hover:bg-gray-50 cursor-pointer ${rowBorder}`} onClick={() => openEdit(t)}
                              onContextMenu={(e) => { e.preventDefault(); openContextMenu(t, e.clientX, e.clientY); }}>
                              <td className="p-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={t.status === 'done'} onChange={() => handleToggleDone(t)}
                                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                              </td>
                              <td className="p-3 font-medium">{t.title}</td>
                              <td className="p-3">
                                {(() => {
                                  const al = t.assignees?.length > 0 ? t.assignees : (t.assignee ? [t.assignee] : []);
                                  if (!al.length) return '—';
                                  if (al.length === 1) return `${al[0].firstName} ${al[0].lastName}`;
                                  return `${al.length} osoby`;
                                })()}
                              </td>
                              <td className="p-3">{t.project?.name ?? '—'}</td>
                              <td className="p-3">{t.dueDate ? format(parseISO(t.dueDate), 'd.MM.yyyy', { locale: pl }) : '—'}</td>
                              <td className="p-3">{STATUS_LABELS[t.status] ?? t.status}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                                  {PRIORITY_LABELS[t.priority] ?? t.priority}
                                </span>
                              </td>
                              <td className="p-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={() => openEdit(t)} className="p-1.5 text-gray-500 hover:text-primary-600 rounded">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => deleteMutation.mutate(t._id)} disabled={deleteMutation.isLoading} className="p-1.5 text-gray-500 hover:text-red-600 rounded">
                                  {deleteMutation.variables === t._id && deleteMutation.isLoading
                                    ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {view === 'calendar' && (
        <div className="card">
          <DndContext sensors={dragSensors} onDragEnd={handleDragEnd}>
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
                        day={day}
                        onDayContextMenu={openDayContextMenu}
                        className={`min-h-[140px] p-2 flex flex-col ${currentMonth ? 'bg-white' : 'bg-gray-50'} ${isToday(day) ? 'ring-1 ring-primary-500 ring-inset' : ''}`}
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
                        <div className="mt-1 space-y-1.5 flex-1 overflow-y-auto min-h-0">
                          {dayTasks.map((t) => (
                            <DraggableTaskChip
                              key={t._id}
                              task={t}
                              isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                              onOpen={() => openEdit(t)}
                              onToggleDone={handleToggleDone}
                              onOpenContextMenu={openContextMenu}
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
                        day={day}
                        onDayContextMenu={openDayContextMenu}
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
                        <div className="mt-2 space-y-1.5 flex-1 overflow-y-auto min-h-0">
                          {dayTasks.map((t) => (
                            <DraggableTaskChip
                              key={t._id}
                              task={t}
                              isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                              onOpen={() => openEdit(t)}
                              onToggleDone={handleToggleDone}
                              onOpenContextMenu={openContextMenu}
                              fullTitle
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

    </div>

    {/* ── Modals & overlays — outside both sections so they work on mobile too ── */}
    {detailTask && (
      <TaskDetailModal
        task={detailTask}
        users={users}
        projects={projects}
        me={meData?.user}
        onClose={() => setDetailTask(null)}
        onSaved={() => { queryClient.invalidateQueries(['tasks', params]); queryClient.invalidateQueries(['task', detailTask._id]); }}
      />
    )}

    {newTaskDate && (
      <NewTaskModal
        initialDueDate={newTaskDate}
        users={users}
        projects={projects}
        onClose={() => setNewTaskDate(null)}
        onSaved={() => { queryClient.invalidateQueries(['tasks', params]); }}
      />
    )}

    {followUpCompleteTask && (
      <FollowUpCompleteModal
        task={followUpCompleteTask}
        onClose={() => setFollowUpCompleteTask(null)}
        onSubmit={(note) => followUpCompleteMutation.mutate({ task: followUpCompleteTask, note })}
        isLoading={followUpCompleteMutation.isLoading}
      />
    )}

    {contextMenu && (
      <TaskContextMenu
        task={contextMenu.task}
        x={contextMenu.x}
        y={contextMenu.y}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAddUpdate={(task) => setDetailTask(task)}
        onClose={() => setContextMenu(null)}
      />
    )}

    {dayContextMenu && (
      <DayContextMenu
        date={dayContextMenu.date}
        x={dayContextMenu.x}
        y={dayContextMenu.y}
        onAddTask={openCreate}
        onClose={() => setDayContextMenu(null)}
      />
    )}
    </>
  );
}
