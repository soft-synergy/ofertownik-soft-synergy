import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderOpen, CheckSquare, User } from 'lucide-react';
import { searchAPI } from '../services/api';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

const STATUS_LABELS = { todo: 'Do zrobienia', in_progress: 'W toku', done: 'Zrobione', cancelled: 'Anulowane' };

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export default function SearchCommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ projects: [], tasks: [], clients: [] });
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  const runSearch = useCallback(async () => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults({ projects: [], tasks: [], clients: [] });
      return;
    }
    setLoading(true);
    try {
      const data = await searchAPI.search(debouncedQuery);
      setResults({
        projects: data.projects || [],
        tasks: data.tasks || [],
        clients: data.clients || []
      });
    } catch (e) {
      setResults({ projects: [], tasks: [], clients: [] });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ projects: [], tasks: [], clients: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectProject = (p) => {
    navigate(`/projects/${p._id}`);
    onClose(false);
  };

  const handleSelectTask = (t) => {
    navigate('/tasks', { state: { openTaskId: t._id } });
    onClose(false);
  };

  const handleSelectClient = (c) => {
    navigate('/clients', { state: { searchClient: c.email || c.name } });
    onClose(false);
  };

  const hasResults = results.projects.length > 0 || results.tasks.length > 0 || results.clients.length > 0;
  const showEmpty = debouncedQuery.length >= 2 && !loading && !hasResults;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]" onClick={() => onClose(false)}>
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="h-5 w-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Szukaj projektów, zadań, emaili, telefonów..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-base outline-none placeholder-gray-400"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">Szukam...</div>
          )}

          {!loading && query.length < 2 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Wpisz co najmniej 2 znaki
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Brak wyników dla „{debouncedQuery}”
            </div>
          )}

          {!loading && hasResults && (
            <div className="space-y-4">
              {results.projects.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projekty
                  </div>
                  {results.projects.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => handleSelectProject(p)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                    >
                      <FolderOpen className="h-4 w-4 text-primary-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{p.name}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {p.clientName}
                          {p.clientEmail ? ` · ${p.clientEmail}` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{p.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.tasks.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zadania
                  </div>
                  {results.tasks.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => handleSelectTask(t)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                    >
                      <CheckSquare className="h-4 w-4 text-primary-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{t.title}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {t.project?.name || '—'}
                          {t.dueDate ? ` · ${format(parseISO(t.dueDate), 'd MMM yyyy', { locale: pl })}` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{STATUS_LABELS[t.status] || t.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.clients.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klienci
                  </div>
                  {results.clients.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                    >
                      <User className="h-4 w-4 text-primary-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{c.name}</div>
                        {c.email && <div className="text-sm text-gray-500 truncate">{c.email}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span><kbd className="font-mono">⌘</kbd> + <kbd className="font-mono">K</kbd> aby otworzyć</span>
          <span>Kliknij wynik aby przejść</span>
        </div>
      </div>
    </div>
  );
}
