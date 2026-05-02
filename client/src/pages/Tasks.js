import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
  isToday, parseISO, startOfDay, isBefore
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, ChevronDown,
  Edit2, Trash2, X, GripVertical, MessageSquarePlus, FolderOpen, Lock,
  Columns, Search, Clock, Users, AlertCircle, CheckCircle2, Circle,
  ArrowUpCircle, Paperclip, Download, Trash, RotateCcw, UploadCloud, File, Eye, Keyboard,
  Send, Flag, Zap, Sparkles, Bell
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tasksAPI, authAPI, projectsAPI } from '../services/api';
import toast from 'react-hot-toast';

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

const COLUMN_KEYS = ['todo', 'in_progress', 'done', 'cancelled'];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const getFileIcon = (mimetype) => {
  if (!mimetype) return File;
  if (mimetype.startsWith('image/')) return Eye;
  if (mimetype.includes('pdf')) return File;
  return File;
};

// ────────────── LOADING SKELETONS ──────────────

function Skeleton({ className = '' }) {
  return <div className={`bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.2s_ease-in-out_infinite] rounded ${className}`} />;
}
function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
      {COLUMN_KEYS.map((k) => (
        <div key={k} className="flex-shrink-0 w-[340px] bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4">
          <Skeleton className="h-6 w-28 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3 p-4 rounded-xl border border-gray-100">
              <Skeleton className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ────────────── TASK CARD ──────────────

function TaskCard({ task, isOverdue, isSelected, onToggleSelect, onOpen, onToggleDone, compact, onDragStart }) {
  const PriIcon = PRIORITY[task.priority]?.icon || Flag;
  const priColor = PRIORITY[task.priority]?.color || 'text-blue-500';
  const priBar = PRIORITY[task.priority]?.bar || 'bg-blue-400';
  const isDone = task.status === 'done';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: task._id,
    data: { taskId: task._id, task }
  });
  const style = transform ? { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' } : {};

  const handleClick = (e) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(task._id);
      return;
    }
    onOpen(task);
  };

  const handleCheck = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleDone(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-xl border transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-300 shadow-md' : 'border-gray-200/80 hover:border-gray-300 hover:shadow-md'}
        ${isDone ? 'opacity-75' : ''}
        ${isDragging ? 'shadow-xl rotate-2 scale-105' : ''}
        ${compact ? 'px-3 py-2' : 'p-4'}`}
      onClick={handleClick}
    >
      {/* Selection checkbox on hover / always when selected */}
      <div className={`absolute ${compact ? 'top-1 right-1' : 'top-3 right-3'} transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(task._id); }}
          className={`p-1 rounded-md transition-colors ${isSelected ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-400'}`}
        >
          {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </button>
      </div>

      {/* Priority bar + title */}
      <div className="flex items-start gap-3 pr-8">
        <div
          className="shrink-0 mt-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${priBar}`} />
            <PriIcon className={`h-3.5 w-3.5 shrink-0 ${priColor}`} />
            <h3 className={`text-sm font-semibold text-gray-900 leading-snug ${isDone ? 'line-through opacity-60' : ''}`}>
              {task.title}
            </h3>
            {task.isPrivate && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          </div>

          {!compact && task.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2.5 leading-relaxed">{task.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {task.dueDate && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                ${isDone ? 'bg-gray-100 text-gray-400' : isOverdue ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}
              >
                <Clock className="h-3 w-3" />
                {format(parseISO(task.dueDate), compact ? 'd.MM' : 'd MMM', { locale: pl })}
                {task.dueTimeMinutes != null && ` ${String(Math.floor(task.dueTimeMinutes / 60)).padStart(2, '0')}:${String(task.dueTimeMinutes % 60).padStart(2, '0')}`}
              </span>
            )}
            {task.assignees && task.assignees.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Users className="h-3 w-3" />
                {task.assignees.length === 1
                  ? `${task.assignees[0].firstName} ${task.assignees[0].lastName}`
                  : task.assignees.length
                }
              </span>
            )}
            {task.project?.name && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 max-w-[120px] truncate">
                <FolderOpen className="h-3 w-3 shrink-0" /> {task.project.name}
              </span>
            )}
            {task.updates?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <MessageSquarePlus className="h-3 w-3" /> {task.updates.length}
              </span>
            )}
            {task.attachments?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Paperclip className="h-3 w-3" /> {task.attachments.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Done checkbox - bottom right */}
      <div className={`absolute ${compact ? 'bottom-1 right-1' : 'bottom-3 right-3'}`}>
        <button
          type="button"
          onClick={handleCheck}
          className={`p-1 rounded-full transition-all ${isDone ? 'text-emerald-500 bg-emerald-50 scale-110' : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
          title={isDone ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
        >
          <CheckCircle2 className={`h-5 w-5 ${!isDone && !isDragging ? 'task-check-done' : ''}`} />
        </button>
      </div>
    </div>
  );
}

// ────────────── DROPPABLE COLUMN ──────────────

function DroppableColumn({ id, statusKey, tasks, onTaskOpen, onToggleDone, onToggleSelect, selectedIds, onDragStart }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const st = STATUS[statusKey];

  return (
    <div ref={setNodeRef} className={`flex flex-col bg-gray-50/80 rounded-2xl border-2 transition-all min-h-[400px] h-full
      ${isOver ? 'border-primary-400 bg-primary-50/50 shadow-lg shadow-primary-100/50 scale-[1.01]' : 'border-transparent'}`}
    >
      <div className={`flex items-center justify-between px-4 py-3.5 border-b ${isOver ? 'border-primary-200' : 'border-gray-200/60'}`}>
        <div className="flex items-center gap-2.5">
          {React.createElement(st.icon, { className: `h-4 w-4 ${st.color.split(' ')[1]}` })}
          <h3 className="text-sm font-bold text-gray-800">{st.label}</h3>
          <span className="text-xs font-bold text-gray-400 bg-gray-200/80 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto task-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
            <Circle className="h-10 w-10 mb-2 opacity-30" />
            <span className="text-xs">Brak zadań</span>
          </div>
        ) : (
          tasks.map((task, i) => (
            <div key={task._id} className="task-card-enter" style={{ animationDelay: `${i * 40}ms` }}>
              <TaskCard
                task={task}
                isOverdue={task.status !== 'done' && task.dueDate && isBefore(parseISO(task.dueDate), startOfDay(new Date()))}
                isSelected={selectedIds.has(task._id)}
                onToggleSelect={onToggleSelect}
                onOpen={onTaskOpen}
                onToggleDone={onToggleDone}
                onDragStart={onDragStart}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ────────────── BOARD VIEW ──────────────

function BoardView({ tasks, onTaskOpen, onToggleDone, onToggleSelect, selectedIds, onDragStart, activeDragId, onDragEnd }) {
  const columns = useMemo(() => {
    const map = {};
    COLUMN_KEYS.forEach((k) => { map[k] = []; });
    tasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [tasks]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
      {COLUMN_KEYS.map((key) => (
        <div key={key} className="flex-shrink-0 w-[340px]">
          <DroppableColumn
            id={`col:${key}`}
            statusKey={key}
            tasks={columns[key]}
            onTaskOpen={onTaskOpen}
            onToggleDone={onToggleDone}
            onToggleSelect={onToggleSelect}
            selectedIds={selectedIds}
            onDragStart={onDragStart}
          />
        </div>
      ))}
    </div>
  );
}

// ────────────── CALENDAR VIEW ──────────────

function DraggableCalendarChip({ task, isOverdue, onOpen, onToggleDone, onContextMenu, fullTitle }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { taskId: task._id }
  });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1 };
  const isDone = task.status === 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(task, e.clientX, e.clientY); }}
      className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border-l-[3px] min-h-[36px] transition-all hover:shadow-sm
        ${isDone ? 'bg-emerald-50 text-emerald-700 line-through border-emerald-400' :
          isOverdue ? 'bg-red-50 text-red-800 border-red-400' : 'bg-primary-50 text-primary-800 border-primary-400 hover:bg-primary-100'}`}
    >
      <button type="button" className="shrink-0 text-gray-400 hover:text-gray-600 cursor-grab p-0" {...listeners} {...attributes} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left truncate">
        {task.isPrivate && <Lock className="inline h-3 w-3 mr-0.5 text-amber-500" />}
        {task.title}
      </button>
    </div>
  );
}

function CalendarView({ tasks, month, week, calendarMode, setMonth, setWeek, onDayContextMenu, onContextMenu, onTaskOpen, onToggleDone, moveDueDateMutation, openCreate }) {
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
        if ((a.status === 'done' ? 1 : 0) !== (b.status === 'done' ? 1 : 0)) return (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0);
        return (a.dueTimeMinutes ?? 0) - (b.dueTimeMinutes ?? 0);
      });
    });
    return map;
  }, [tasks]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const overStr = String(over.id);
    if (!overStr.startsWith('day:')) return;
    const targetDateKey = overStr.slice(4);
    const task = tasks.find((t) => t._id === active.id);
    const currentDateKey = task?.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : null;
    if (!task || !currentDateKey || targetDateKey === currentDateKey) return;
    moveDueDateMutation.mutate({ id: task._id, dueDate: targetDateKey });
  };

  const DroppableDay = ({ id, day, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
      <div ref={setNodeRef} className={`min-h-[130px] p-2 flex flex-col transition-colors ${isOver ? 'bg-primary-50/60 rounded-lg' : ''}`}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (day) onDayContextMenu?.(day, e.clientX, e.clientY); }}>
        {children}
      </div>
    );
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {calendarMode === 'month' ? (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <h2 className="text-lg font-bold text-gray-900 capitalize">{format(month, 'LLLL yyyy', { locale: pl })}</h2>
              <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <button type="button" onClick={() => openCreate(new Date())} className="btn-primary text-sm !py-2 !px-4 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Dodaj zadanie
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 rounded-xl overflow-hidden bg-gray-100 p-1">
              {['Pn','Wt','Śr','Cz','Pt','Sb','Nd'].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{d}</div>
              ))}
              {calendarDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[key] ?? [];
                const inMonth = isSameMonth(day, month);
                return (
                  <DroppableDay key={key} id={`day:${key}`} day={day}>
                    <div className={`rounded-xl p-1.5 ${inMonth ? 'bg-white' : 'bg-gray-50/50'} ${isToday(day) ? 'ring-2 ring-primary-400 ring-inset' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${inMonth ? 'text-gray-800' : 'text-gray-400'} ${isToday(day) ? 'bg-primary-600 text-white' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {inMonth && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); openCreate(day); }} className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded p-0.5" title="Dodaj">
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 min-h-0">
                        {dayTasks.slice(0, 4).map((t) => (
                          <DraggableCalendarChip key={t._id} task={t} isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                            onOpen={() => onTaskOpen(t)} onToggleDone={onToggleDone} onContextMenu={onContextMenu} />
                        ))}
                        {dayTasks.length > 4 && <div className="text-[10px] text-gray-400 px-2">+{dayTasks.length - 4} więcej</div>}
                      </div>
                    </div>
                  </DroppableDay>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setWeek((w) => subWeeks(w, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">
                {format(startOfWeek(week, { weekStartsOn: 1 }), 'd MMM', { locale: pl })} – {format(endOfWeek(week, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: pl })}
              </h2>
              <button type="button" onClick={() => setWeek((w) => addWeeks(w, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <button type="button" onClick={() => openCreate(new Date())} className="btn-primary text-sm !py-2 !px-4 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Dodaj zadanie
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2 rounded-xl overflow-hidden">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[key] ?? [];
                return (
                  <DroppableDay key={key} id={`day:${key}`} day={day}>
                    <div className={`rounded-xl p-2 bg-white ${isToday(day) ? 'ring-2 ring-primary-400 ring-inset' : ''} border border-gray-100`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">{format(day, 'EEE', { locale: pl })}</span>
                          <span className={`text-sm font-bold ${isToday(day) ? 'text-primary-600' : 'text-gray-900'}`}>{format(day, 'd MMM', { locale: pl })}</span>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); openCreate(day); }} className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded p-1" title="Dodaj">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {dayTasks.map((t) => (
                          <DraggableCalendarChip key={t._id} task={t} isOverdue={t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))}
                            onOpen={() => onTaskOpen(t)} onToggleDone={onToggleDone} onContextMenu={onContextMenu} fullTitle />
                        ))}
                      </div>
                    </div>
                  </DroppableDay>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// ────────────── LIST VIEW ──────────────

function ListView({ tasks, isLoading, onTaskOpen, onToggleDone, onToggleSelect, selectedIds, onContextMenu, onDelete }) {
  const sorted = useMemo(() =>
    [...tasks].sort((a, b) => {
      if ((a.status === 'done' ? 1 : 0) !== (b.status === 'done' ? 1 : 0)) return (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0);
      return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    }), [tasks]);

  if (isLoading) return <BoardSkeleton />;
  if (tasks.length === 0) {
    return (
      <div className="card text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <List className="h-10 w-10 text-gray-300" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">Brak zadań</h3>
        <p className="text-sm text-gray-500">Nie znaleziono zadań dla wybranych filtrów</p>
      </div>
    );
  }

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-200">
            <tr>
              <th className="w-12 p-4 text-left">
                <button type="button" onClick={() => { tasks.forEach(t => onToggleSelect(t._id)); }}
                  className="p-1 -m-1 rounded hover:bg-gray-200">
                  {tasks.length > 0 && tasks.every(t => selectedIds.has(t._id)) ? <CheckCircle2 className="h-4 w-4 text-primary-600" /> : <Circle className="h-4 w-4 text-gray-400" />}
                </button>
              </th>
              <th className="p-4 text-left font-semibold text-gray-600">Zadanie</th>
              <th className="p-4 text-left font-semibold text-gray-600">Przypisani</th>
              <th className="p-4 text-left font-semibold text-gray-600">Projekt</th>
              <th className="p-4 text-left font-semibold text-gray-600">Termin</th>
              <th className="p-4 text-left font-semibold text-gray-600">Status</th>
              <th className="p-4 text-left font-semibold text-gray-600">Priorytet</th>
              <th className="w-20 p-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((t) => {
              const isOverdue = t.status !== 'done' && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()));
              const isDone = t.status === 'done';
              const rowStyle = isDone ? 'bg-emerald-50/30' : isOverdue ? 'bg-red-50/20' : '';
              return (
                <tr key={t._id} className={`hover:bg-gray-50/70 transition-colors cursor-pointer ${rowStyle}`}
                  onClick={() => (window.getSelection()?.isCollapsed !== false) && onTaskOpen(t)}
                  onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(t, e.clientX, e.clientY); }}>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onToggleSelect(t._id)}
                      className={`p-1 rounded transition-colors ${selectedIds.has(t._id) ? 'text-primary-600 bg-primary-50' : 'text-gray-300 hover:text-gray-500'}`}>
                      {selectedIds.has(t._id) ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY[t.priority]?.bar || 'bg-blue-400'}`} />
                      <span className={`font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</span>
                      {t.isPrivate && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      {t.updates?.length > 0 && <MessageSquarePlus className="h-3 w-3 text-gray-400" />}
                      {t.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-gray-400" />}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">
                    {t.assignees && t.assignees.length > 0
                      ? t.assignees.length === 1 ? `${t.assignees[0].firstName} ${t.assignees[0].lastName}` : `${t.assignees.length} osoby`
                      : '—'}
                  </td>
                  <td className="p-4 text-gray-600 max-w-[160px] truncate">{t.project?.name || '—'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      <Clock className="h-3 w-3" />
                      {t.dueDate ? format(parseISO(t.dueDate), 'd MMM yyyy', { locale: pl }) : '—'}
                      {t.dueTimeMinutes != null && ` ${String(Math.floor(t.dueTimeMinutes / 60)).padStart(2, '0')}:${String(t.dueTimeMinutes % 60).padStart(2, '0')}`}
                    </span>
                  </td>
                  <td className="p-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS[t.status]?.chip}`}>{STATUS[t.status]?.label}</span></td>
                  <td className="p-4"><span className={`inline-flex items-center gap-1 text-xs font-medium ${PRIORITY[t.priority]?.color}`}>
                    {React.createElement(PRIORITY[t.priority]?.icon || Flag, { className: 'h-3 w-3' })} {PRIORITY[t.priority]?.label}
                  </span></td>
                  <td className="p-4">
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onTaskOpen(t); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onToggleDone(t); }} className={`p-1.5 rounded transition-colors ${isDone ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50'}`}><CheckCircle2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────── TASK DETAIL MODAL ──────────────

function TaskDetailModal({ task, users = [], projects = [], onClose, onSaved, me }) {
  const queryClient = useQueryClient();
  const isEdit = !!task?._id;
  const { data: fullTask, refetch: refetchTask } = useQuery(
    ['task', task?._id],
    () => tasksAPI.getById(task._id),
    { enabled: isEdit && !!task?._id }
  );

  const t = fullTask || task;
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

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

  const addUpdateMutation = useMutation((text) => tasksAPI.addUpdate(t._id, text), {
    onMutate: async (text) => {
      await queryClient.cancelQueries(['task', t._id]);
      const prev = queryClient.getQueryData(['task', t._id]);
      queryClient.setQueryData(['task', t._id], (old) => ({ ...old, updates: [...(old?.updates || []), { text, author: { firstName: me?.firstName, lastName: me?.lastName }, createdAt: new Date().toISOString() }] }));
      return { prev };
    },
    onSuccess: () => { toast.success('Update dodany'); refetchTask(); },
    onError: (_err, _vars, context) => { if (context?.prev) queryClient.setQueryData(['task', t._id], context.prev); toast.error('Błąd dodawania update\'u'); }
  });

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Podaj tytuł'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), description: (form.description || '').trim(),
        status: form.status, priority: form.priority,
        assignees: form.assignees.filter(Boolean), watchers: form.watchers.filter(Boolean),
        isPrivate: !!form.isPrivate, project: form.project || null,
        dueDate: form.dueDate, dueTimeMinutes: form.dueTimeMinutes === '' ? null : Number(form.dueTimeMinutes),
        durationMinutes: Number(form.durationMinutes) || 60
      };
      await updateMutation.mutateAsync({ id: t._id, data: payload });
    } finally { setSaving(false); }
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
  const handleAddUpdate = () => {
    if (!updateText.trim()) return;
    addUpdateMutation.mutate(updateText.trim());
    setUpdateText('');
  };

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
              { key: 'files', label: 'Pliki', icon: Paperclip, count: t?.attachments?.length }
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <File className="h-4 w-4 text-gray-400" /> Opis
                  </label>
                  <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[120px] leading-relaxed"
                    placeholder="Dodaj opis zadania — co trzeba zrobić, szczegóły, kontekst..." rows={5} />
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
                  <select value={form.project} onChange={(e) => handleChange('project', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value="">— Bez projektu —</option>
                    {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
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
              <div className="flex gap-3 mb-6">
                <textarea value={updateText} onChange={(e) => setUpdateText(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none min-h-[80px] placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Napisz update — co zrobiłeś/aś, postęp, uwagi..." rows={3}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddUpdate(); } }} />
                <button type="button" onClick={handleAddUpdate} disabled={!updateText.trim() || addUpdateMutation.isLoading}
                  className="shrink-0 self-end btn-primary !py-2.5 !px-4 flex items-center gap-2 !rounded-xl">
                  <Send className="h-4 w-4" /> Wyślij
                </button>
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
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold">
                            {u.author?.firstName?.[0]}{u.author?.lastName?.[0]}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{u.author?.firstName} {u.author?.lastName}</span>
                          <span className="text-[10px] text-gray-400">{u.createdAt ? format(parseISO(u.createdAt), 'd MMM yyyy, HH:mm', { locale: pl }) : ''}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{u.text}</p>
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
                <button type="button" onClick={handleSave} disabled={saving || updateMutation.isLoading}
                  className="btn-primary !py-2.5 !px-5 !rounded-xl text-sm flex items-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Zapisz
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
              <select value={form.project} onChange={(e) => handleChange('project', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="">— Bez projektu —</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
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

// ────────────── CONTEXT MENUS ──────────────

function TaskContextMenu({ task, x, y, onEdit, onDelete, onAddUpdate, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, [onClose]);

  const projectId = task.project?._id || task.project || task.source?.refId;
  return (
    <div ref={ref} className="fixed z-[70] min-w-[180px] py-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100" style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 220) }}>
      {projectId && <Link to={`/projects/${projectId}/edit`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={onClose}>
        <FolderOpen className="h-4 w-4 text-gray-400" /> Przejdź do projektu</Link>}
      <button type="button" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { onEdit(task); onClose(); }}>
        <Edit2 className="h-4 w-4 text-gray-400" /> Edytuj</button>
      <button type="button" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { onAddUpdate(task); onClose(); }}>
        <MessageSquarePlus className="h-4 w-4 text-gray-400" /> Daj update</button>
      <div className="border-t border-gray-100 my-1" />
      <button type="button" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => { onDelete(task._id); onClose(); }}>
        <Trash2 className="h-4 w-4" /> Usuń</button>
    </div>
  );
}

function DayContextMenu({ date, x, y, onAddTask, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, [onClose]);
  return (
    <div ref={ref} className="fixed z-[70] min-w-[180px] py-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{ left: x, top: y }}>
      <button type="button" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { onAddTask(date); onClose(); }}>
        <Plus className="h-4 w-4 text-gray-400" /> Dodaj zadanie na {format(date, 'd MMM', { locale: pl })}</button>
    </div>
  );
}

// ────────────── FOLLOW-UP MODAL ──────────────

function FollowUpCompleteModal({ task, onClose, onSubmit, isLoading }) {
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

// ────────────── MAIN TASKS PAGE ──────────────

const DEFAULT_FILTERS = { assignee: '', project: '', status: '', priority: '', dateFrom: '', dateTo: '' };

export default function Tasks() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('board');
  const [month, setMonth] = useState(new Date());
  const [week, setWeek] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState('month');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailTask, setDetailTask] = useState(null);
  const [newTaskDate, setNewTaskDate] = useState(null);
  const [followUpCompleteTask, setFollowUpCompleteTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [dayContextMenu, setDayContextMenu] = useState(null);
  const [updateModalTask, setUpdateModalTask] = useState(null);
  const [quickFilter, setQuickFilter] = useState('');
  const filtersInitializedRef = useRef(false);

  const { data: meData } = useQuery('me', authAPI.me, { staleTime: 60 * 1000 });
  const me = meData?.user;

  const openTaskIdFromState = location.state?.openTaskId;
  useEffect(() => {
    if (!openTaskIdFromState) return;
    tasksAPI.getById(openTaskIdFromState).then((task) => { setDetailTask(task); navigate(location.pathname, { replace: true, state: {} }); }).catch(() => navigate(location.pathname, { replace: true, state: {} }));
  }, [openTaskIdFromState, navigate, location.pathname]);

  useEffect(() => {
    if (meData === undefined || filtersInitializedRef.current) return;
    filtersInitializedRef.current = true;
    const saved = meData?.user?.settings?.tasksFilters;
    if (saved && typeof saved === 'object') {
      setFilters({ assignee: saved.assignee ?? '', project: saved.project ?? '', status: saved.status ?? '', priority: saved.priority ?? '', dateFrom: saved.dateFrom ?? '', dateTo: saved.dateTo ?? '' });
      if (['board', 'list', 'calendar'].includes(saved.view)) setView(saved.view);
      if (saved.calendarMode === 'month' || saved.calendarMode === 'week') setCalendarMode(saved.calendarMode);
    }
  }, [meData]);

  useEffect(() => {
    if (!filtersInitializedRef.current) return;
    const t = setTimeout(() => { authAPI.updateSettings({ tasksFilters: { ...filters, view, calendarMode } }).then(() => queryClient.invalidateQueries('me')).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [filters, view, calendarMode, queryClient]);

  const calendarRange = useMemo(() => {
    if (view !== 'calendar') return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
    if (calendarMode === 'week') return { start: startOfWeek(week, { weekStartsOn: 1 }), end: endOfWeek(week, { weekStartsOn: 1 }) };
    return { start: startOfMonth(month), end: endOfMonth(month) };
  }, [view, calendarMode, month, week]);

  const params = useMemo(() => {
    const p = {};
    if (filters.assignee) p.assignee = filters.assignee;
    if (filters.project) p.project = filters.project;
    if (filters.status) p.status = filters.status;
    if (filters.priority) p.priority = filters.priority;
    if (view === 'calendar') { p.dateFrom = format(calendarRange.start, 'yyyy-MM-dd'); p.dateTo = format(calendarRange.end, 'yyyy-MM-dd'); }
    else if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    else if (filters.dateTo) p.dateTo = filters.dateTo;
    if (view !== 'calendar') { p.limit = 500; }
    return p;
  }, [filters, view, calendarRange]);

  const { data: tasks = [], isLoading } = useQuery(['tasks', params], () => tasksAPI.getAll(params));
  const { data: users = [] } = useQuery('users', authAPI.listUsers);
  const { data: projectsData } = useQuery(['projects', { limit: 500 }], () => projectsAPI.getAll({ limit: 500 }));
  const projects = projectsData?.projects ?? [];

  const deleteMutation = useMutation((id) => tasksAPI.delete(id), {
    onMutate: async (id) => {
      await queryClient.cancelQueries(['tasks', params]);
      const prev = queryClient.getQueryData(['tasks', params]);
      queryClient.setQueryData(['tasks', params], (old) => old?.filter((t) => t._id !== id));
      return { prev };
    },
    onSuccess: () => { toast.success('Zadanie usunięte'); queryClient.invalidateQueries(['tasks', params]); },
    onError: (_err, _vars, context) => { if (context?.prev) queryClient.setQueryData(['tasks', params], context.prev); toast.error('Błąd usuwania'); }
  });

  const batchDeleteMutation = useMutation((ids) => tasksAPI.batchDelete(ids), {
    onMutate: async (ids) => {
      await queryClient.cancelQueries(['tasks', params]);
      const prev = queryClient.getQueryData(['tasks', params]);
      const idSet = new Set(ids);
      queryClient.setQueryData(['tasks', params], (old) => old?.filter((t) => !idSet.has(t._id)));
      return { prev };
    },
    onSuccess: (data) => { toast.success(data.message); setSelectedIds(new Set()); queryClient.invalidateQueries(['tasks', params]); },
    onError: (_err, _vars, context) => { if (context?.prev) queryClient.setQueryData(['tasks', params], context.prev); toast.error('Błąd usuwania'); }
  });

  const batchUpdateMutation = useMutation(({ ids, updates }) => tasksAPI.batchUpdate(ids, updates), {
    onMutate: async ({ ids, updates }) => {
      await queryClient.cancelQueries(['tasks', params]);
      const prev = queryClient.getQueryData(['tasks', params]);
      const idSet = new Set(ids);
      queryClient.setQueryData(['tasks', params], (old) => old?.map((t) => idSet.has(t._id) ? { ...t, ...updates } : t));
      return { prev };
    },
    onSuccess: (data) => { toast.success(data.message); setSelectedIds(new Set()); queryClient.invalidateQueries(['tasks', params]); },
    onError: (_err, _vars, context) => { if (context?.prev) queryClient.setQueryData(['tasks', params], context.prev); toast.error('Błąd aktualizacji'); }
  });

  const toggleDoneMutation = useMutation(({ id, status }) => tasksAPI.update(id, { status }), {
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries(['tasks', params]);
      const prev = queryClient.getQueriesData(['tasks']);
      queryClient.setQueriesData(['tasks'], (old) => { if (!Array.isArray(old)) return old; return old.map((t) => t._id === id ? { ...t, status } : t); });
      return { prev };
    },
    onError: (_err, _vars, context) => { if (context?.prev) context.prev.forEach(([k, d]) => queryClient.setQueryData(k, d)); toast.error('Nie udało się zaktualizować statusu'); },
    onSettled: () => { queryClient.invalidateQueries(['tasks', params]); }
  });

  const moveDueDateMutation = useMutation(({ id, dueDate }) => tasksAPI.update(id, { dueDate }), {
    onMutate: async ({ id, dueDate }) => {
      await queryClient.cancelQueries(['tasks', params]);
      const prev = queryClient.getQueriesData(['tasks']);
      queryClient.setQueriesData(['tasks'], (old) => { if (!Array.isArray(old)) return old; return old.map((t) => t._id === id ? { ...t, dueDate } : t); });
      return { prev };
    },
    onError: (_err, _vars, context) => { if (context?.prev) context.prev.forEach(([k, d]) => queryClient.setQueryData(k, d)); toast.error('Nie udało się przenieść zadania'); },
    onSettled: () => { queryClient.invalidateQueries(['tasks', params]); }
  });

  const followUpCompleteMutation = useMutation(
    async ({ task, note }) => {
      const projectId = task.source?.refId || task.project?._id || task.project;
      if (!projectId) throw new Error('Brak powiązanego projektu');
      await projectsAPI.addFollowUp(projectId, note);
    },
    { onSuccess: () => { queryClient.invalidateQueries(['tasks', params]); queryClient.invalidateQueries('projects'); setFollowUpCompleteTask(null); toast.success('Follow-up zapisany'); },
      onError: (e) => toast.error(e.response?.data?.message || e.message || 'Błąd') }
  );

  const addUpdateMutation = useMutation(({ taskId, text }) => tasksAPI.addUpdate(taskId, text), {
    onSuccess: () => { queryClient.invalidateQueries(['tasks', params]); setUpdateModalTask(null); toast.success('Update dodany'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd dodawania update\'u')
  });

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleDone = useCallback((task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    if (nextStatus === 'done' && task.source?.kind === 'followup') { setFollowUpCompleteTask(task); return; }
    toggleDoneMutation.mutate({ id: task._id, status: nextStatus });
  }, [toggleDoneMutation]);

  const openContextMenu = (task, cx, cy) => { setDayContextMenu(null); setContextMenu({ task, x: cx, y: cy }); };
  const openDayContextMenu = (day, cx, cy) => { setContextMenu(null); setDayContextMenu({ date: day, x: cx, y: cy }); };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const overStr = String(over.id);

    // Board column drop
    if (overStr.startsWith('col:')) {
      const newStatus = overStr.slice(4);
      if (!COLUMN_KEYS.includes(newStatus)) return;
      const task = tasks.find((t) => t._id === active.id);
      if (!task || task.status === newStatus) return;
      toggleDoneMutation.mutate({ id: task._id, status: newStatus });
      return;
    }

    // Calendar day drop
    if (overStr.startsWith('day:')) {
      const targetDateKey = overStr.slice(4);
      const task = tasks.find((t) => t._id === active.id);
      const currentDateKey = task?.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : null;
      if (!task || !currentDateKey || targetDateKey === currentDateKey) return;
      moveDueDateMutation.mutate({ id: task._id, dueDate: targetDateKey });
    }
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setNewTaskDate(new Date()); }
      if (e.key === 'Escape') {
        setDetailTask(null); setNewTaskDate(null); setContextMenu(null);
        setDayContextMenu(null); setUpdateModalTask(null); setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Zadania</h1>
          {!isLoading && <span className="text-sm font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{tasks.length}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            {[
              { key: 'board', icon: Columns, label: 'Tablica' },
              { key: 'list', icon: List, label: 'Lista' },
              { key: 'calendar', icon: CalendarIcon, label: 'Kalendarz' }
            ].map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${view === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                title={v.label}>
                <v.icon className="h-4 w-4" /> <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Calendar sub-mode */}
          {view === 'calendar' && (
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button type="button" onClick={() => setCalendarMode('month')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${calendarMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Miesiąc
              </button>
              <button type="button" onClick={() => setCalendarMode('week')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${calendarMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Tydzień
              </button>
            </div>
          )}

          <button onClick={() => setNewTaskDate(new Date())}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl shadow-sm shadow-primary-200/50 hover:shadow-md hover:shadow-primary-300/50 transition-all duration-200 text-sm ml-2">
            <Plus className="h-4 w-4" /> Nowe zadanie
          </button>

          <button type="button" onClick={() => {}} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Skróty klawiszowe (N)">
            <Keyboard className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input type="text" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)}
            className="w-48 pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            placeholder="Szukaj..." />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            ...(!filters.assignee ? [{ k: 'assignee', v: 'me', l: 'Moje' }] : []),
            ...Object.entries(STATUS).filter(([k]) => !filters.status).map(([k, v]) => ({ k: 'status', v: k, l: v.label })),
            ...Object.entries(PRIORITY).filter(([k]) => !filters.priority || k !== filters.priority).slice(0, 3).map(([k, v]) => ({ k: 'priority', v: k, l: v.label })),
          ].map((f) => (
            <button key={`${f.k}-${f.v}`} type="button" onClick={() => setFilters((prev) => ({ ...prev, [f.k]: f.v }))}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {f.l}
            </button>
          ))}
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1">
              <X className="h-3 w-3" /> Wyczyść filtry
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {Object.entries(filters).map(([k, v]) => v && (
            <span key={k} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              {k === 'assignee' ? (v === 'me' ? 'Moje' : v) : k === 'status' ? STATUS[v]?.label : k === 'priority' ? PRIORITY[v]?.label : `${k}:${v}`}
              <button type="button" onClick={() => setFilters((prev) => ({ ...prev, [k]: '' }))}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-200/50 animate-in slide-in-from-top-2 fade-in duration-200">
          <span className="text-sm font-bold">{selectedIds.size} {selectedIds.size === 1 ? 'zadanie wybrane' : (selectedIds.size < 5 ? 'zadania wybrane' : 'zadań wybranych')}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <select onChange={(e) => { if (e.target.value) { batchUpdateMutation.mutate({ ids: [...selectedIds], updates: { status: e.target.value } }); } }}
              className="h-9 px-3 rounded-xl bg-white/20 border border-white/30 text-white text-sm focus:ring-2 focus:ring-white/50 outline-none [&>option]:text-gray-900">
              <option value="">Zmień status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button type="button" onClick={() => batchDeleteMutation.mutate([...selectedIds])}
              className="h-9 px-4 rounded-xl bg-white/20 hover:bg-red-500/30 border border-white/30 text-sm font-medium transition-colors flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Usuń
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Views */}
      {view === 'board' && (
        isLoading ? <BoardSkeleton /> :
          tasks.length === 0 ? (
            <div className="card text-center py-16">
              <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <Columns className="h-12 w-12 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Brak zadań</h3>
              <p className="text-sm text-gray-500 mb-5">Nie znaleziono zadań dla wybranych filtrów</p>
              <button onClick={() => setNewTaskDate(new Date())} className="btn-primary !rounded-xl inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> Dodaj pierwsze zadanie
              </button>
            </div>
          ) : (
            <DndContext onDragEnd={handleDragEnd}>
              <BoardView tasks={Array.isArray(tasks) ? tasks : []}
                onTaskOpen={setDetailTask} onToggleDone={handleToggleDone}
                onToggleSelect={toggleSelect} selectedIds={selectedIds}
                onDragStart={() => {}} />
            </DndContext>
          )
      )}

      {view === 'calendar' && (
        <CalendarView tasks={Array.isArray(tasks) ? tasks : []} month={month} week={week}
          calendarMode={calendarMode} setMonth={setMonth} setWeek={setWeek}
          onDayContextMenu={openDayContextMenu} onContextMenu={openContextMenu}
          onTaskOpen={setDetailTask} onToggleDone={handleToggleDone}
          moveDueDateMutation={moveDueDateMutation}
          openCreate={setNewTaskDate} />
      )}

      {view === 'list' && (
        <ListView tasks={Array.isArray(tasks) ? tasks : []} isLoading={isLoading}
          onTaskOpen={setDetailTask} onToggleDone={handleToggleDone}
          onToggleSelect={toggleSelect} selectedIds={selectedIds}
          onContextMenu={openContextMenu} />
      )}

      {/* Modals */}
      {detailTask && (
        <TaskDetailModal task={detailTask} users={users} projects={projects}
          me={me}
          onClose={() => setDetailTask(null)}
          onSaved={() => { queryClient.invalidateQueries(['tasks', params]); queryClient.invalidateQueries(['task', detailTask._id]); }} />
      )}

      {newTaskDate && (
        <NewTaskModal initialDueDate={newTaskDate} users={users} projects={projects}
          onClose={() => setNewTaskDate(null)}
          onSaved={() => { queryClient.invalidateQueries(['tasks', params]); }} />
      )}

      {followUpCompleteTask && (
        <FollowUpCompleteModal task={followUpCompleteTask}
          onClose={() => setFollowUpCompleteTask(null)}
          onSubmit={(note) => followUpCompleteMutation.mutate({ task: followUpCompleteTask, note })}
          isLoading={followUpCompleteMutation.isLoading} />
      )}

      {contextMenu && (
        <TaskContextMenu task={contextMenu.task} x={contextMenu.x} y={contextMenu.y}
          onEdit={setDetailTask} onDelete={(id) => deleteMutation.mutate(id)}
          onAddUpdate={setUpdateModalTask}
          onClose={() => setContextMenu(null)} />
      )}

      {dayContextMenu && (
        <DayContextMenu date={dayContextMenu.date} x={dayContextMenu.x} y={dayContextMenu.y}
          onAddTask={setNewTaskDate} onClose={() => setDayContextMenu(null)} />
      )}

      {updateModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 modal-backdrop-in" onClick={() => setUpdateModalTask(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 modal-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Daj update</h2>
            <p className="text-sm text-gray-500 mb-4">Dodaj wpis do zadania „{updateModalTask.title}”.</p>
            <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
              placeholder="Treść update'u..." autoFocus ref={(el) => el?.focus()}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  const text = e.target.value.trim();
                  if (text) { await addUpdateMutation.mutateAsync({ taskId: updateModalTask._id, text }); }
                }
              }}
              onChange={(e) => { /* track value via ref */ }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setUpdateModalTask(null)} className="btn-secondary !rounded-xl">Anuluj</button>
              <button type="button" onClick={(e) => {
                const textarea = e.target.closest('.modal-slide-up')?.querySelector('textarea');
                if (textarea?.value?.trim()) addUpdateMutation.mutate({ taskId: updateModalTask._id, text: textarea.value.trim() });
              }} disabled={addUpdateMutation.isLoading}
                className="btn-primary !rounded-xl flex items-center gap-2">
                {addUpdateMutation.isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
                Wyślij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

