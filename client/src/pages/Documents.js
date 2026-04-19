import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { documentsAPI, getDocumentPublicUrl } from '../services/api';
import toast from 'react-hot-toast';

function normalizeFolderPath(input) {
  return String(input || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function flattenFolders(tree, acc = []) {
  tree.forEach((node) => {
    acc.push(node.path);
    flattenFolders(node.children || [], acc);
  });
  return acc;
}

function findFolderNode(tree, targetPath) {
  if (!targetPath) return null;
  for (const node of tree) {
    if (node.path === targetPath) return node;
    const found = findFolderNode(node.children || [], targetPath);
    if (found) return found;
  }
  return null;
}

function buildBreadcrumbs(folderPath) {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) return [];
  const parts = normalized.split('/');
  return parts.map((part, index) => ({
    label: part,
    path: parts.slice(0, index + 1).join('/')
  }));
}

function FolderTreeNode({ node, selectedPath, onSelect, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${
          isSelected ? 'bg-primary-50 text-primary-800' : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${8 + (level * 16)}px` }}
        onClick={() => onSelect(node.path)}
      >
        <button
          type="button"
          className="p-0.5 text-gray-400 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${hasChildren && expanded ? 'rotate-90' : ''}`} />
        </button>
        {isSelected ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{node.totalDocumentCount}</span>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderModal({ mode, initialPath = '', currentParentPath = '', onClose, onSubmit, isLoading }) {
  const normalizedInitialPath = normalizeFolderPath(initialPath);
  const initialName = normalizedInitialPath ? normalizedInitialPath.split('/').pop() : '';
  const initialParent = mode === 'rename'
    ? normalizeFolderPath(normalizedInitialPath.split('/').slice(0, -1).join('/'))
    : normalizeFolderPath(currentParentPath);

  const [parentPath, setParentPath] = useState(initialParent);
  const [name, setName] = useState(initialName);

  const handleSubmit = (e) => {
    e.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) return;
    onSubmit({
      parentPath: normalizeFolderPath(parentPath),
      name: normalizedName
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'rename' ? 'Zmień nazwę folderu' : 'Nowy folder'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder nadrzędny</label>
            <input
              type="text"
              value={parentPath}
              onChange={(e) => setParentPath(e.target.value)}
              className="input-field w-full"
              placeholder="np. klienci"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa folderu</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full"
              placeholder="np. sebastian"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuluj</button>
            <button type="submit" className="btn-primary" disabled={isLoading || !name.trim()}>
              {mode === 'rename' ? 'Zapisz' : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MoveDocumentModal({ document, folderPaths, onClose, onSubmit, isLoading }) {
  const [folder, setFolder] = useState(document?.folder || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(normalizeFolderPath(folder));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Przenieś dokument</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-sm text-gray-600">
            {document?.title}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder docelowy</label>
            <input
              list="document-folder-paths"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="input-field w-full"
              placeholder="Puste = katalog główny"
              autoFocus
            />
            <datalist id="document-folder-paths">
              {folderPaths.map((path) => (
                <option key={path} value={path} />
              ))}
            </datalist>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuluj</button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              Przenieś
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentForm({ document, defaultFolder = '', onClose, onSaved }) {
  const queryClient = useQueryClient();
  const isEdit = !!document?._id;
  const [form, setForm] = useState({
    title: document?.title ?? '',
    slug: document?.slug ?? '',
    type: document?.type ?? 'document',
    folder: document?.folder ?? defaultFolder,
    summary: document?.summary ?? '',
    tags: Array.isArray(document?.tags) ? document.tags.join(', ') : '',
    content: document?.content ?? '',
  });

  const invalidate = () => {
    queryClient.invalidateQueries('documents');
    queryClient.invalidateQueries('documentFolderTree');
    queryClient.invalidateQueries('documentFolders');
  };

  const createMutation = useMutation((data) => documentsAPI.create(data), {
    onSuccess: () => {
      invalidate();
      toast.success('Dokument dodany');
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu'),
  });

  const updateMutation = useMutation(({ id, data }) => documentsAPI.update(id, data), {
    onSuccess: () => {
      invalidate();
      toast.success('Dokument zaktualizowany');
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd zapisu'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Podaj tytuł');
      return;
    }

    const payload = {
      ...form,
      folder: normalizeFolderPath(form.folder)
    };

    if (isEdit) {
      updateMutation.mutate({ id: document._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const loading = createMutation.isLoading || updateMutation.isLoading;
  const publicUrl = (isEdit && form.slug) ? getDocumentPublicUrl(form.slug) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="input-field w-full"
                placeholder="Np. Playbook onboarding"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (opcjonalnie)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                className="input-field w-full"
                placeholder="np. playbook-onboarding"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 shrink-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                className="input-field w-full"
              >
                <option value="document">Dokument</option>
                <option value="playbook">Playbook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Folder</label>
              <input
                type="text"
                value={form.folder}
                onChange={(e) => setForm((prev) => ({ ...prev, folder: e.target.value }))}
                className="input-field w-full"
                placeholder="np. klienci/sebastian"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagi</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="input-field w-full"
                placeholder="np. klient, onboarding, oferta"
              />
            </div>
          </div>

          <div className="mt-4 shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis krótki</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
              className="input-field w-full min-h-[90px]"
              placeholder="Krótki opis, do czego służy ten dokument / playbook"
            />
          </div>

          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">Treść HTML</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              className="input-field w-full flex-1 min-h-[240px] font-mono text-sm"
              placeholder="<!DOCTYPE html>..."
              spellCheck={false}
            />
          </div>

          {publicUrl && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg shrink-0">
              <span className="text-xs font-medium text-gray-500 block mb-1">Link publiczny</span>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:text-primary-800 break-all">
                {publicUrl}
              </a>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Anuluj</button>
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
  const [selectedFolder, setSelectedFolder] = useState('');
  const [formDoc, setFormDoc] = useState(null);
  const [folderModal, setFolderModal] = useState(null);
  const [moveDoc, setMoveDoc] = useState(null);

  const { data: folderTree = [], isLoading: foldersLoading } = useQuery('documentFolderTree', documentsAPI.getFolderTree);
  const { data: documents = [], isLoading: docsLoading } = useQuery(
    ['documents', selectedFolder],
    () => documentsAPI.getAll({ folder: selectedFolder, limit: 500 }),
    { keepPreviousData: true }
  );

  const selectedNode = useMemo(() => findFolderNode(folderTree, selectedFolder), [folderTree, selectedFolder]);
  const subfolders = selectedNode ? (selectedNode.children || []) : folderTree;
  const breadcrumbs = useMemo(() => buildBreadcrumbs(selectedFolder), [selectedFolder]);
  const allFolderPaths = useMemo(() => flattenFolders(folderTree), [folderTree]);

  const invalidate = () => {
    queryClient.invalidateQueries('documents');
    queryClient.invalidateQueries('documentFolderTree');
    queryClient.invalidateQueries('documentFolders');
  };

  const createFolderMutation = useMutation((data) => documentsAPI.createFolder(data), {
    onSuccess: (folder) => {
      invalidate();
      setSelectedFolder(folder?.path || selectedFolder);
      setFolderModal(null);
      toast.success('Folder utworzony');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Nie udało się utworzyć folderu')
  });

  const renameFolderMutation = useMutation(({ fromPath, toPath }) => documentsAPI.renameFolder(fromPath, toPath), {
    onSuccess: (folder) => {
      invalidate();
      setSelectedFolder(folder?.path || '');
      setFolderModal(null);
      toast.success('Folder zaktualizowany');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Nie udało się zmienić folderu')
  });

  const deleteFolderMutation = useMutation((path) => documentsAPI.deleteFolder(path), {
    onSuccess: () => {
      invalidate();
      setSelectedFolder(getParentPath(selectedFolder));
      toast.success('Folder usunięty');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Nie udało się usunąć folderu')
  });

  const moveDocumentMutation = useMutation(({ id, folder }) => documentsAPI.move(id, folder), {
    onSuccess: () => {
      invalidate();
      setMoveDoc(null);
      toast.success('Dokument przeniesiony');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Nie udało się przenieść dokumentu')
  });

  const deleteDocumentMutation = useMutation((id) => documentsAPI.delete(id), {
    onSuccess: () => {
      invalidate();
      toast.success('Dokument usunięty');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Błąd usuwania')
  });

  function getParentPath(path) {
    const normalized = normalizeFolderPath(path);
    if (!normalized || !normalized.includes('/')) return '';
    return normalized.split('/').slice(0, -1).join('/');
  }

  const openNewFolderModal = () => {
    setFolderModal({ mode: 'create', currentParentPath: selectedFolder });
  };

  const openRenameFolderModal = () => {
    if (!selectedFolder) return;
    setFolderModal({ mode: 'rename', initialPath: selectedFolder });
  };

  const handleDeleteFolder = () => {
    if (!selectedFolder) return;
    if (window.confirm(`Usunąć folder "${selectedFolder}"? Uda się to tylko, jeśli jest pusty.`)) {
      deleteFolderMutation.mutate(selectedFolder);
    }
  };

  const handleFolderModalSubmit = ({ parentPath, name }) => {
    const nextPath = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
    if (!nextPath) {
      toast.error('Nieprawidłowa ścieżka folderu');
      return;
    }

    if (folderModal.mode === 'rename') {
      renameFolderMutation.mutate({ fromPath: folderModal.initialPath, toPath: nextPath });
      return;
    }

    createFolderMutation.mutate({ path: nextPath });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumenty i playbooki</h1>
          <p className="text-sm text-gray-500 mt-1">
            Explorer folderów dla dokumentów, playbooków i bazy wiedzy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openNewFolderModal} className="btn-secondary inline-flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            Nowy folder
          </button>
          <button
            type="button"
            onClick={() => setFormDoc({ folder: selectedFolder })}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FilePlus2 className="h-4 w-4" />
            Nowy dokument
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <aside className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Foldery</div>
              <div className="text-xs text-gray-500">Kliknij folder, aby przejść do jego zawartości</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedFolder('')}
            className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
              !selectedFolder ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            Katalog główny
          </button>

          <div className="space-y-1 max-h-[65vh] overflow-auto pr-1">
            {foldersLoading ? (
              <div className="text-sm text-gray-500">Ładowanie folderów…</div>
            ) : folderTree.length === 0 ? (
              <div className="text-sm text-gray-500">Brak folderów. Utwórz pierwszy.</div>
            ) : (
              folderTree.map((node) => (
                <FolderTreeNode
                  key={node.path}
                  node={node}
                  selectedPath={selectedFolder}
                  onSelect={setSelectedFolder}
                />
              ))
            )}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <button type="button" onClick={() => setSelectedFolder('')} className="hover:text-primary-700">
                    Root
                  </button>
                  {breadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb.path}>
                      <ChevronRight className="h-4 w-4" />
                      <button type="button" onClick={() => setSelectedFolder(crumb.path)} className="hover:text-primary-700">
                        {crumb.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mt-2">
                  {selectedFolder || 'Katalog główny'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedNode
                    ? `${selectedNode.childFolderCount} podfolderów, ${selectedNode.documentCount} dokumentów bezpośrednio`
                    : `${subfolders.length} folderów najwyższego poziomu, ${documents.length} dokumentów w root`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={openNewFolderModal} className="btn-secondary inline-flex items-center gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Dodaj podfolder
                </button>
                <button
                  type="button"
                  onClick={() => setFormDoc({ folder: selectedFolder })}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <FilePlus2 className="h-4 w-4" />
                  Dodaj dokument
                </button>
                <button
                  type="button"
                  onClick={openRenameFolderModal}
                  disabled={!selectedFolder}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                  Zmień nazwę
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFolder}
                  disabled={!selectedFolder}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Usuń folder
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Podfoldery</h3>
              </div>
              {subfolders.length === 0 ? (
                <div className="text-sm text-gray-500">Brak podfolderów w tej lokalizacji.</div>
              ) : (
                <div className="space-y-2">
                  {subfolders.map((folder) => (
                    <button
                      key={folder.path}
                      type="button"
                      onClick={() => setSelectedFolder(folder.path)}
                      className="w-full text-left rounded-xl border border-gray-200 p-3 hover:border-primary-300 hover:bg-primary-50/40"
                    >
                      <div className="flex items-center gap-2 text-gray-900 font-medium">
                        <Folder className="h-4 w-4 text-gray-500" />
                        {folder.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {folder.childFolderCount} podfolderów, {folder.documentCount} dokumentów
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Dokumenty w tym folderze</h3>
              </div>

              {docsLoading ? (
                <div className="text-sm text-gray-500">Ładowanie dokumentów…</div>
              ) : documents.length === 0 ? (
                <div className="text-sm text-gray-500">Brak dokumentów w tym folderze.</div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const publicUrl = getDocumentPublicUrl(doc.slug);
                    return (
                      <div key={doc._id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{doc.title}</div>
                            <div className="text-xs text-gray-500 mt-1">/dokumenty/{doc.slug}</div>
                            {doc.summary && <div className="text-sm text-gray-600 mt-2">{doc.summary}</div>}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                {doc.type === 'playbook' ? 'Playbook' : 'Dokument'}
                              </span>
                              {Array.isArray(doc.tags) && doc.tags.map((tag) => (
                                <span key={tag} className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
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
                              onClick={() => setMoveDoc(doc)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                            >
                              <FolderOpen className="h-4 w-4" />
                              Przenieś
                            </button>
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
                                if (window.confirm('Usunąć ten dokument?')) deleteDocumentMutation.mutate(doc._id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              Usuń
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {formDoc !== null && (
        <DocumentForm
          document={formDoc}
          defaultFolder={selectedFolder}
          onClose={() => setFormDoc(null)}
          onSaved={() => setFormDoc(null)}
        />
      )}

      {folderModal && (
        <FolderModal
          mode={folderModal.mode}
          initialPath={folderModal.initialPath}
          currentParentPath={folderModal.currentParentPath}
          onClose={() => setFolderModal(null)}
          onSubmit={handleFolderModalSubmit}
          isLoading={createFolderMutation.isLoading || renameFolderMutation.isLoading}
        />
      )}

      {moveDoc && (
        <MoveDocumentModal
          document={moveDoc}
          folderPaths={allFolderPaths}
          onClose={() => setMoveDoc(null)}
          onSubmit={(folder) => moveDocumentMutation.mutate({ id: moveDoc._id, folder })}
          isLoading={moveDocumentMutation.isLoading}
        />
      )}
    </div>
  );
}
