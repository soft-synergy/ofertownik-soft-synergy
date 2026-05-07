import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { clientsAPI, hostingAPI } from '../services/api';
import toast from 'react-hot-toast';

const Clients = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const consumedStateRef = useRef(false);

  useEffect(() => {
    const q = location.state?.searchClient;
    if (q && !consumedStateRef.current) {
      consumedStateRef.current = true;
      setSearch(q);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.searchClient, location.pathname, navigate]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
  const [selectedClient, setSelectedClient] = useState(null);
  const params = useMemo(() => ({ search: search || undefined }), [search]);

  const { data: clients = [], isLoading } = useQuery(['clients', params], () => clientsAPI.getAll(params));

  const createMutation = useMutation(clientsAPI.create, {
    onSuccess: () => { queryClient.invalidateQueries('clients'); setShowForm(false); setFormData({ name: '', email: '', phone: '', company: '', notes: '' }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Klienci</h1>
          <p className="text-sm text-gray-500">Zarządzaj klientami, projektami, hostingiem</p>
        </div>
        <div className="flex items-center gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj klienta" className="border rounded px-3 py-2 text-sm" />
          <button onClick={() => setShowForm(true)} className="px-3 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700">Dodaj klienta</button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Ładowanie...</div>
      ) : clients.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Brak klientów</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => (
            <div key={c._id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-600">{c.company}</div>
                  <div className="text-xs text-gray-500">{c.email} {c.phone ? `· ${c.phone}` : ''}</div>
                  {c.notes && <div className="text-xs text-gray-500 mt-1">{c.notes}</div>}
                </div>
                <button onClick={() => setSelectedClient(c)} className="px-3 py-2 text-sm rounded border text-gray-700 hover:bg-gray-50">Szczegóły</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Dodaj klienta</h2>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div>
                  <label className="form-label">Nazwa *</label>
                  <input className="input-field" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Email</label>
                    <input className="input-field" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Telefon</label>
                    <input className="input-field" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Firma</label>
                  <input className="input-field" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Notatki</label>
                  <textarea className="input-field" rows="3" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Anuluj</button>
                  <button type="submit" className="btn-primary">Zapisz</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {selectedClient && (
        <ClientDetails client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  );
};

const ClientDetails = ({ client, onClose }) => {
  const { data, isLoading } = useQuery(['clientDetails', client._id], () => clientsAPI.getById(client._id));
  const [projectId, setProjectId] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [hostingId, setHostingId] = useState('');
  const queryClient = useQueryClient();
  const assignProject = useMutation(({ id, projectId }) => clientsAPI.assignProject(id, projectId), {
    onSuccess: () => {
      queryClient.invalidateQueries(['clientDetails', client._id]);
      queryClient.invalidateQueries(['clients']);
      queryClient.invalidateQueries(['assignableProjects', client._id]);
      setProjectId('');
      toast.success('Projekt przypisany do klienta');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Nie udało się przypisać projektu')
  });
  const unassignProject = useMutation(({ id, projectId }) => clientsAPI.unassignProject(id, projectId), {
    onSuccess: () => {
      queryClient.invalidateQueries(['clientDetails', client._id]);
      queryClient.invalidateQueries(['clients']);
      queryClient.invalidateQueries(['assignableProjects', client._id]);
      toast.success('Projekt odpięty od klienta');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Nie udało się odpiąć projektu')
  });
  const assignHosting = useMutation(({ id, hostingId }) => clientsAPI.assignHosting(id, hostingId), {
    onSuccess: () => { queryClient.invalidateQueries(['clientDetails', client._id]); setHostingId(''); }
  });
  const { data: assignableResp, isLoading: isLoadingAssignableProjects } = useQuery(
    ['assignableProjects', client._id, projectSearch],
    () => clientsAPI.getAssignableProjects(client._id, { search: projectSearch || undefined, limit: 300 }),
    { keepPreviousData: true }
  );
  const projectsList = useMemo(() => assignableResp?.projects || [], [assignableResp]);
  const assignableProjects = useMemo(
    () => projectsList.filter((p) => p.assignable && !p.assignedToCurrentClient),
    [projectsList]
  );
  const { data: hostingList = [] } = useQuery(['hostingListForAssign'], () => hostingAPI.getAll({}));

  const regeneratePortal = useMutation(() => clientsAPI.regeneratePortal(client._id), {
    onSuccess: () => queryClient.invalidateQueries(['clientDetails', client._id])
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const downloadHostingCsv = async (hostingId) => {
    const res = await hostingAPI.downloadMonthlyReport(month, hostingId);
    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-${month}-${hostingId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Klient: {client.name}</h2>
            <button onClick={onClose} className="btn-secondary">Zamknij</button>
          </div>
          {isLoading ? (
            <div className="text-gray-500">Ładowanie...</div>
          ) : (
            <div className="space-y-6">
              {/* Portal actions */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Portal klienta</div>
                    <div className="text-xs text-gray-500 mt-1">Publiczny link do wglądu projektów i hostingu</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const url = `${window.location.origin}/client/${(data.client.portalToken || '')}`; navigator.clipboard?.writeText(url); }} className="px-3 py-1 text-xs rounded border text-gray-700 hover:bg-gray-50">Kopiuj link</button>
                    <button onClick={() => regeneratePortal.mutate()} className="px-3 py-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-700">Regeneruj</button>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-2 break-all">{`${window.location.origin}/client/${(data.client.portalToken || '')}`}</div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                  {[
                    { id: 'summary', label: 'Podsumowanie' },
                    { id: 'projects', label: 'Projekty' },
                    { id: 'hosting', label: 'Hosting' },
                    { id: 'documents', label: 'Dokumenty' },
                    { id: 'assign', label: 'Przypisania' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium ${activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{tab.label}</button>
                  ))}
                </nav>
              </div>

              {activeTab === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="card">Projekty: {data.projects.length}</div>
                  <div className="card">Hosting: {data.hostings.length}</div>
                  <div className="card">Email: {data.client.email || '-'}</div>
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="space-y-2">
                  {data.projects.map(p => (
                    <div key={p._id} className="p-3 border rounded text-sm flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-gray-500 text-xs">Status: {p.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500">{p.offerType ? `Typ: ${p.offerType}` : ''}</div>
                        <button
                          type="button"
                          onClick={() => unassignProject.mutate({ id: client._id, projectId: p._id })}
                          disabled={unassignProject.isLoading}
                          className="px-3 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Odepnij
                        </button>
                      </div>
                    </div>
                  ))}
                  {data.projects.length === 0 && <div className="text-sm text-gray-500">Brak projektów</div>}
                </div>
              )}

              {activeTab === 'hosting' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">Łącznie: {data.hostings.length}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1" />
                      <span className="text-gray-500">Miesiąc raportu</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {data.hostings.map(h => (
                      <div key={h._id} className="p-3 border rounded text-sm flex items-center justify-between">
                        <div>
                          <div className="font-medium">{h.domain}</div>
                          <div className="text-gray-500 text-xs">Status: {h.status}</div>
                        </div>
                        <button onClick={() => downloadHostingCsv(h._id)} className="px-3 py-1 text-xs rounded border text-gray-700 hover:bg-gray-50">Pobierz CSV</button>
                      </div>
                    ))}
                    {data.hostings.length === 0 && <div className="text-sm text-gray-500">Brak hostingu</div>}
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-2">
                  {(() => {
                    const docs = [];
                    (data.projects || []).forEach(p => {
                      (p.documents || []).forEach(d => { docs.push({ ...d, projectName: p.name, projectId: p._id }); });
                    });
                    if (docs.length === 0) return <div className="text-sm text-gray-500">Brak dokumentów</div>;
                    return docs.map((d, idx) => (
                      <div key={`${d.filePath}-${idx}`} className="p-3 border rounded text-sm flex items-center justify-between">
                        <div>
                          <div className="font-medium">{d.originalName}</div>
                          <div className="text-xs text-gray-500">{(d.type || '').toUpperCase()} · Projekt: {d.projectName}</div>
                        </div>
                        <a href={d.filePath} target="_blank" rel="noreferrer" className="px-3 py-1 text-xs rounded border text-gray-700 hover:bg-gray-50">Pobierz</a>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {activeTab === 'assign' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold">Przypisz projekt</h3>
                        <p className="text-xs text-gray-500 mt-1">Wyszukaj projekt po nazwie, kliencie lub emailu. Projekt bez klienta przypiszesz od razu, a przypisany do innego klienta możesz świadomie przenieść.</p>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{data.projects.length} przypisane</span>
                    </div>
                    <input
                      className="input-field mb-3"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Szukaj projektu"
                    />
                    <div className="flex gap-2">
                      <select className="input-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                        <option value="">Wybierz projekt do przypisania</option>
                        {assignableProjects.map(p => (
                          <option key={p._id} value={p._id}>
                            {p.name}{p.clientName ? ` · ${p.clientName}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => projectId && assignProject.mutate({ id: client._id, projectId })}
                        disabled={!projectId || assignProject.isLoading}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {assignProject.isLoading ? 'Przypisuję...' : 'Przypisz'}
                      </button>
                    </div>
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {isLoadingAssignableProjects && <div className="text-sm text-gray-500">Ładowanie projektów...</div>}
                      {!isLoadingAssignableProjects && projectsList.length === 0 && (
                        <div className="text-sm text-gray-500">Brak projektów dla tego wyszukiwania</div>
                      )}
                      {projectsList.slice(0, 20).map((project) => {
                        const assignedElsewhere = project.client && !project.assignedToCurrentClient;
                        return (
                          <div key={project._id} className="rounded-lg border border-gray-200 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-gray-900">{project.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {project.clientName || 'Bez nazwy klienta w projekcie'}{project.offerType ? ` · ${project.offerType}` : ''}
                                </div>
                              </div>
                              {project.assignedToCurrentClient ? (
                                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">już przypisany</span>
                              ) : assignedElsewhere ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                    {project.client?.name || project.client?.company || 'inny klient'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => assignProject.mutate({ id: client._id, projectId: project._id })}
                                    disabled={assignProject.isLoading}
                                    className="px-3 py-1 text-xs rounded border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    Przenieś
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => assignProject.mutate({ id: client._id, projectId: project._id })}
                                  disabled={assignProject.isLoading}
                                  className="px-3 py-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                                >
                                  Przypisz
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="card">
                    <h3 className="font-semibold mb-2">Przypisz hosting</h3>
                    <div className="flex gap-2">
                      <select className="input-field" value={hostingId} onChange={(e) => setHostingId(e.target.value)}>
                        <option value="">Wybierz domenę</option>
                        {hostingList.map(h => (<option key={h._id} value={h._id}>{h.domain}</option>))}
                      </select>
                      <button onClick={() => hostingId && assignHosting.mutate({ id: client._id, hostingId })} className="btn-primary">Przypisz</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Clients;
