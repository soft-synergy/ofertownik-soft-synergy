import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  Download, 
  Eye,
  Mail,
  Phone,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  X,
  Plus,
  Trash2,
  Upload,
  File,
  ExternalLink
} from 'lucide-react';
import { projectsAPI, offersAPI, authAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [showWorkSummaryModal, setShowWorkSummaryModal] = React.useState(false);
  const [showDocumentUploadModal, setShowDocumentUploadModal] = React.useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = React.useState('proforma');
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [workSummaryData, setWorkSummaryData] = React.useState({
    summaryDescription: '',
    periodStart: '',
    periodEnd: '',
    status: '',
    completedTasks: [
      { name: '', description: '', date: '' }
    ],
    keyFeatures: [],
    statistics: [
      { label: 'Dni współpracy', value: '' },
      { label: 'Wykonane moduły', value: '' },
      { label: 'Status projektu', value: '' }
    ],
    achievements: [
      { name: '', description: '' }
    ]
  });

  const { data: project, isLoading } = useQuery(
    ['project', id],
    () => projectsAPI.getById(id)
  );

  const { data: users = [] } = useQuery(['users'], authAPI.listUsers);

  const assignOwnerMutation = useMutation(({ ownerId }) => projectsAPI.assignOwner(id, ownerId), {
    onSuccess: () => {
      toast.success('Przypisano właściciela');
      queryClient.invalidateQueries(['project', id]);
      queryClient.invalidateQueries('projects');
    },
    onError: () => toast.error('Nie udało się przypisać właściciela')
  });

  const generateOfferMutation = useMutation(offersAPI.generate, {
    onSuccess: (data) => {
      toast.success('Oferta została wygenerowana pomyślnie!');
      
      // Update project data with URLs from response (for immediate UI update)
      queryClient.setQueryData(['project', id], (oldData) => {
        if (oldData) {
          return {
            ...oldData,
            generatedOfferUrl: data.htmlUrl,
            pdfUrl: data.pdfUrl
          };
        }
        return oldData;
      });
      
      queryClient.invalidateQueries(['project', id]);
    },
    onError: (error) => {
      toast.error('Błąd podczas generowania oferty');
    }
  });

  const generatePdfMutation = useMutation((projectData) => offersAPI.generatePdf(id, projectData), {
    onSuccess: (response) => {
      toast.success('PDF oferty został wygenerowany pomyślnie!');
      
      // Update project data with PDF URL from response (for immediate UI update)
      queryClient.setQueryData(['project', id], (oldData) => {
        if (oldData) {
          return {
            ...oldData,
            pdfUrl: response.pdfUrl
          };
        }
        return oldData;
      });
      
      // Automatycznie pobierz PDF
      if (response.pdfUrl) {
        const link = document.createElement('a');
        link.href = `https://oferty.soft-synergy.com${response.pdfUrl}`;
        link.download = response.fileName || 'oferta.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      queryClient.invalidateQueries(['project', id]);
    },
    onError: () => toast.error('Błąd podczas generowania PDF')
  });

  const generateWorkSummaryMutation = useMutation((data) => offersAPI.generateWorkSummary(id, data), {
    onSuccess: (response) => {
      toast.success('Zestawienie pracy zostało wygenerowane pomyślnie!');
      setShowWorkSummaryModal(false);
      
      // Update project data with URLs from response (for immediate UI update)
      queryClient.setQueryData(['project', id], (oldData) => {
        if (oldData) {
          return {
            ...oldData,
            workSummaryUrl: response.workSummaryUrl,
            workSummaryPdfUrl: response.workSummaryPdfUrl
          };
        }
        return oldData;
      });
      
      // Force refresh project data to show PDF button
      queryClient.invalidateQueries(['project', id]);
      
      // If PDF was generated, show success message
      if (response.workSummaryPdfUrl) {
        toast.success('PDF zestawienia został wygenerowany!');
      }
    },
    onError: () => toast.error('Błąd podczas generowania zestawienia pracy')
  });

  const uploadDocumentMutation = useMutation((formData) => offersAPI.uploadDocument(id, formData), {
    onSuccess: () => {
      toast.success('Dokument został przesłany pomyślnie!');
      setShowDocumentUploadModal(false);
      setSelectedFile(null);
      queryClient.invalidateQueries(['project', id]);
    },
    onError: () => toast.error('Błąd podczas przesyłania dokumentu')
  });

  const deleteDocumentMutation = useMutation((documentId) => offersAPI.deleteDocument(id, documentId), {
    onSuccess: () => {
      toast.success('Dokument został usunięty pomyślnie!');
      queryClient.invalidateQueries(['project', id]);
    },
    onError: () => toast.error('Błąd podczas usuwania dokumentu')
  });

  const getStatusConfig = (status) => {
    const configs = {
      draft: { 
        label: 'Szkic', 
        color: 'bg-gray-100 text-gray-800',
        icon: Clock
      },
      active: { 
        label: 'Aktywny', 
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      },
      completed: { 
        label: 'Zakończony', 
        color: 'bg-blue-100 text-blue-800',
        icon: CheckCircle
      },
      cancelled: { 
        label: 'Anulowany', 
        color: 'bg-red-100 text-red-800',
        icon: AlertCircle
      },
    };
    return configs[status] || configs.draft;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  };

  const handleWorkSummaryChange = (field, value) => {
    setWorkSummaryData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTaskChange = (index, field, value) => {
    setWorkSummaryData(prev => ({
      ...prev,
      completedTasks: prev.completedTasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const addTask = () => {
    setWorkSummaryData(prev => ({
      ...prev,
      completedTasks: [...prev.completedTasks, { name: '', description: '', date: '' }]
    }));
  };

  const removeTask = (index) => {
    setWorkSummaryData(prev => ({
      ...prev,
      completedTasks: prev.completedTasks.filter((_, i) => i !== index)
    }));
  };

  const handleStatisticChange = (index, field, value) => {
    setWorkSummaryData(prev => ({
      ...prev,
      statistics: prev.statistics.map((stat, i) => 
        i === index ? { ...stat, [field]: value } : stat
      )
    }));
  };

  const handleAchievementChange = (index, field, value) => {
    setWorkSummaryData(prev => ({
      ...prev,
      achievements: prev.achievements.map((achievement, i) => 
        i === index ? { ...achievement, [field]: value } : achievement
      )
    }));
  };

  const addAchievement = () => {
    setWorkSummaryData(prev => ({
      ...prev,
      achievements: [...prev.achievements, { name: '', description: '' }]
    }));
  };

  const removeAchievement = (index) => {
    setWorkSummaryData(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index)
    }));
  };

  const openWorkSummaryModal = () => {
    // Pre-fill with project data
    setWorkSummaryData(prev => ({
      ...prev,
      summaryDescription: project.description || '',
      periodStart: new Date(project.createdAt).toLocaleDateString('pl-PL'),
      periodEnd: new Date().toLocaleDateString('pl-PL'),
      status: project.status,
      keyFeatures: project.modules || []
    }));
    setShowWorkSummaryModal(true);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Tylko pliki PDF są dozwolone');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Plik jest za duży. Maksymalny rozmiar to 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDocumentUpload = () => {
    if (!selectedFile) {
      toast.error('Wybierz plik do przesłania');
      return;
    }

    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('documentType', selectedDocumentType);

    uploadDocumentMutation.mutate(formData);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentTypeLabel = (type) => {
    return type === 'proforma' ? 'Faktura Proforma' : 'Faktura VAT';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Projekt nie został znaleziony</h3>
        <p className="mt-1 text-sm text-gray-500">Sprawdź czy link jest poprawny.</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Client: {project.clientName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {statusConfig.label}
          </span>
          
          {project.offerType === 'preliminary' && project.calBookingUrl && (
          <a
            href={project.calBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center"
          >
            <ExternalLink className="h-4 w-4 mr-2" />Zobacz w Cal.com
          </a>
          )}
          <Link
            to={`/projects/${id}/edit`}
            className="btn-secondary flex items-center"
          >
            <Edit className="h-4 w-4 mr-2" />{t('buttons.edit')}
          </Link>
          
          <button
            onClick={() => window.open(`/api/offers/preview/${id}?lang=${project.language || 'pl'}`, '_blank')}
            className="btn-secondary flex items-center"
          >
            <Eye className="h-4 w-4 mr-2" />{t('buttons.view')}
          </button>
          
          <button
            onClick={() => generateOfferMutation.mutate(id)}
            disabled={generateOfferMutation.isLoading}
            className="btn-primary flex items-center"
          >
            <FileText className="h-4 w-4 mr-2" />{t('buttons.generateOffer')}
          </button>
          
          <button
            onClick={openWorkSummaryModal}
            className="btn-secondary flex items-center"
          >
            <FileCheck className="h-4 w-4 mr-2" />Zestawienie pracy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Overview */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project overview</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-sm text-gray-900">{project.description}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Main business benefit</h3>
                <p className="mt-1 text-sm text-gray-900">{project.mainBenefit}</p>
              </div>
              
              {Array.isArray(project.notes) && project.notes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Notatki</h3>
                  <ul className="mt-2 space-y-3">
                    {project.notes.map((n, idx) => (
                      <li key={idx} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString('pl-PL')}</span>
                          <span className="text-xs text-gray-600">{n.author?.firstName || ''} {n.author?.lastName || ''}</span>
                        </div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Modules */}
          {project.modules && project.modules.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Project modules</h2>
              <div className="space-y-4">
                {project.modules.map((module, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">{module.name}</h3>
                    <p className="mt-1 text-sm text-gray-600">{module.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              {Object.entries(project.timeline).map(([phase, data]) => (
                <div key={phase} className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{data.name}</h3>
                    <p className="text-sm text-gray-500">{data.duration}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(project.pricing[phase] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Dokumenty</h2>
              <button
                onClick={() => setShowDocumentUploadModal(true)}
                className="btn-secondary flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Dodaj dokument
              </button>
            </div>
            
            {project.documents && project.documents.length > 0 ? (
              <div className="space-y-3">
                {project.documents.map((doc) => (
                  <div key={doc._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <File className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.originalName}</p>
                          <p className="text-sm text-gray-500">
                            {getDocumentTypeLabel(doc.type)} • {formatFileSize(doc.fileSize)} • 
                            {new Date(doc.uploadedAt).toLocaleDateString('pl-PL')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`/api/offers/documents/${doc.fileName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Podgląd
                        </a>
                        <button
                          onClick={() => deleteDocumentMutation.mutate(doc._id)}
                          disabled={deleteDocumentMutation.isLoading}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Brak załączonych dokumentów.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Information */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Client info</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{project.clientContact}</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{project.clientEmail}</span>
              </div>
              {project.clientPhone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{project.clientPhone}</span>
                </div>
              )}
            </div>
          </div>

        {/* Team Members */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zespół projektowy</h2>
          <div className="space-y-2">
            {(project.teamMembers || []).map((m, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium">{m.user?.firstName} {m.user?.lastName}</div>
                  <div className="text-gray-500">{m.user?.email}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{m.role || 'member'}</span>
              </div>
            ))}
            {(!project.teamMembers || project.teamMembers.length === 0) && (
              <p className="text-sm text-gray-500">Brak przypisanych członków zespołu.</p>
            )}
          </div>
        </div>

          {/* Project Manager */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project manager</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-gray-900">{project.projectManager.name}</h3>
                <p className="text-sm text-gray-500">{project.projectManager.position}</p>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{project.projectManager.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{project.projectManager.phone}</span>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Financial summary</h2>
            <div className="space-y-3">
              {Object.entries(project.pricing).map(([phase, amount]) => {
                if (phase === 'total') return null;
                const phaseName = project.timeline[phase]?.name || phase;
                return (
                  <div key={phase} className="flex justify-between">
                    <span className="text-sm text-gray-600">{phaseName}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                );
              })}
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Total (net)</span>
                  <span className="font-bold text-lg text-primary-600">
                    {formatCurrency(project.pricing.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project details</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">Created: {new Date(project.createdAt).toLocaleDateString('pl-PL')}</span>
              </div>
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">Owner: {project.owner?.firstName ? `${project.owner.firstName} ${project.owner.lastName}` : project.createdBy?.fullName}</span>
              </div>
              {users.length > 0 && (
                <div className="flex items-center space-x-2">
                  <select
                    className="input-field"
                    defaultValue={project.owner?._id || ''}
                    onChange={(e) => e.target.value && assignOwnerMutation.mutate({ ownerId: e.target.value })}
                  >
                    <option value="">-- Zmień właściciela (admin) --</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
              {project.offerNumber && (
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">
                    Offer number: {project.offerNumber}
                  </span>
                </div>
              )}
              {project.generatedOfferUrl && (
                <div className="pt-3 space-y-2">
                  <a
                    href={`https://oferty.soft-synergy.com${project.generatedOfferUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Pobierz ofertę HTML
                  </a>
                  {project.pdfUrl ? (
                    <a
                      href={`https://oferty.soft-synergy.com${project.pdfUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full flex items-center justify-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Pobierz ofertę PDF
                    </a>
                  ) : (
                    <button
                      onClick={() => generatePdfMutation.mutate(project)}
                      disabled={generatePdfMutation.isLoading}
                      className="btn-secondary w-full flex items-center justify-center"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {generatePdfMutation.isLoading ? 'Generuję PDF...' : 'Generuj i pobierz PDF'}
                    </button>
                  )}
                </div>
              )}
              {project.workSummaryUrl && (
                <div className="pt-3 space-y-2">
                  <a
                    href={`https://oferty.soft-synergy.com${project.workSummaryUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center"
                    download
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Pobierz zestawienie HTML
                  </a>
                  {project.workSummaryPdfUrl ? (
                    <a
                      href={`https://oferty.soft-synergy.com${project.workSummaryPdfUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full flex items-center justify-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Pobierz zestawienie PDF
                    </a>
                  ) : (
                    <button
                      onClick={() => generateWorkSummaryMutation.mutate(workSummaryData)}
                      disabled={generateWorkSummaryMutation.isLoading}
                      className="btn-secondary w-full flex items-center justify-center disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {generateWorkSummaryMutation.isLoading ? 'Generowanie PDF...' : 'Generuj zestawienie PDF'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Changelog */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Changelog</h2>
          <div className="space-y-3">
            {(project.changelog || []).map((c, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">{c.action}</div>
                  <div className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('pl-PL')}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{c.author?.firstName} {c.author?.lastName}</div>
                {Array.isArray(c.fields) && c.fields.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">Fields: {c.fields.join(', ')}</div>
                )}
              </div>
            ))}
            {(!project.changelog || project.changelog.length === 0) && (
              <p className="text-sm text-gray-500">No changes.</p>
            )}
          </div>
        </div>
      </div>

      {/* Work Summary Modal */}
      {showWorkSummaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Generuj zestawienie pracy</h2>
                <button
                  onClick={() => setShowWorkSummaryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opis zestawienia
                    </label>
                    <textarea
                      value={workSummaryData.summaryDescription}
                      onChange={(e) => handleWorkSummaryChange('summaryDescription', e.target.value)}
                      className="input-field h-20"
                      placeholder="Opis wykonanych prac..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status projektu
                    </label>
                    <select
                      value={workSummaryData.status}
                      onChange={(e) => handleWorkSummaryChange('status', e.target.value)}
                      className="input-field"
                    >
                      <option value="draft">Szkic</option>
                      <option value="active">Aktywny</option>
                      <option value="completed">Zakończony</option>
                      <option value="cancelled">Anulowany</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data rozpoczęcia
                    </label>
                    <input
                      type="date"
                      value={workSummaryData.periodStart}
                      onChange={(e) => handleWorkSummaryChange('periodStart', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data zakończenia
                    </label>
                    <input
                      type="date"
                      value={workSummaryData.periodEnd}
                      onChange={(e) => handleWorkSummaryChange('periodEnd', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Completed Tasks */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Wykonane zadania</h3>
                    <button
                      onClick={addTask}
                      className="btn-secondary flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj zadanie
                    </button>
                  </div>
                  <div className="space-y-4">
                    {workSummaryData.completedTasks.map((task, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-gray-900">Zadanie {index + 1}</h4>
                          {workSummaryData.completedTasks.length > 1 && (
                            <button
                              onClick={() => removeTask(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nazwa zadania
                            </label>
                            <input
                              type="text"
                              value={task.name}
                              onChange={(e) => handleTaskChange(index, 'name', e.target.value)}
                              className="input-field"
                              placeholder="Nazwa zadania"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Data wykonania
                            </label>
                            <input
                              type="date"
                              value={task.date}
                              onChange={(e) => handleTaskChange(index, 'date', e.target.value)}
                              className="input-field"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Opis
                            </label>
                            <textarea
                              value={task.description}
                              onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                              className="input-field h-20"
                              placeholder="Opis wykonanych prac..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Statystyki projektu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {workSummaryData.statistics.map((stat, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {stat.label}
                        </label>
                        <input
                          type="text"
                          value={stat.value}
                          onChange={(e) => handleStatisticChange(index, 'value', e.target.value)}
                          className="input-field"
                          placeholder="Wartość"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Achievements */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Osiągnięcia</h3>
                    <button
                      onClick={addAchievement}
                      className="btn-secondary flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj osiągnięcie
                    </button>
                  </div>
                  <div className="space-y-4">
                    {workSummaryData.achievements.map((achievement, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-gray-900">Osiągnięcie {index + 1}</h4>
                          {workSummaryData.achievements.length > 1 && (
                            <button
                              onClick={() => removeAchievement(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nazwa osiągnięcia
                            </label>
                            <input
                              type="text"
                              value={achievement.name}
                              onChange={(e) => handleAchievementChange(index, 'name', e.target.value)}
                              className="input-field"
                              placeholder="Nazwa osiągnięcia"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Opis
                            </label>
                            <textarea
                              value={achievement.description}
                              onChange={(e) => handleAchievementChange(index, 'description', e.target.value)}
                              className="input-field h-20"
                              placeholder="Opis osiągnięcia..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    onClick={() => setShowWorkSummaryModal(false)}
                    className="btn-secondary"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => generateWorkSummaryMutation.mutate(workSummaryData)}
                    disabled={generateWorkSummaryMutation.isLoading}
                    className="btn-primary flex items-center"
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    {generateWorkSummaryMutation.isLoading ? 'Generuję...' : 'Generuj zestawienie'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Dodaj dokument</h2>
                <button
                  onClick={() => setShowDocumentUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Typ dokumentu
                  </label>
                  <select
                    value={selectedDocumentType}
                    onChange={(e) => setSelectedDocumentType(e.target.value)}
                    className="input-field"
                  >
                    <option value="proforma">Faktura Proforma</option>
                    <option value="vat">Faktura VAT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wybierz plik PDF
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="input-field"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Wybrany plik: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    onClick={() => setShowDocumentUploadModal(false)}
                    className="btn-secondary"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleDocumentUpload}
                    disabled={uploadDocumentMutation.isLoading || !selectedFile}
                    className="btn-primary flex items-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadDocumentMutation.isLoading ? 'Przesyłam...' : 'Prześlij'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail; 
