import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2,
  FileText,
  Calendar,
  User,
  FolderOpen,
  Download,
  DollarSign,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { projectsAPI, offersAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const Projects = () => {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    offerType: '',
    owner: '',
    page: 1,
  });
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [finalEstimateTotal, setFinalEstimateTotal] = useState('');
  const [clarificationText, setClarificationText] = useState('');
  const [clarificationResponseText, setClarificationResponseText] = useState('');
  const [submittingClarificationResponse, setSubmittingClarificationResponse] = useState(false);
  const [finalEstimationGate, setFinalEstimationGate] = useState(null);
  const [finalEstimationGateLoading, setFinalEstimationGateLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery(
    ['projects', filters],
    () => projectsAPI.getAll(filters),
    { keepPreviousData: true }
  );

  const handleDelete = async (projectId) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten projekt?')) {
      try {
        await projectsAPI.delete(projectId);
        toast.success('Projekt został usunięty');
        refetch();
      } catch (error) {
        toast.error('Błąd podczas usuwania projektu');
      }
    }
  };

  const generateOffer = async (projectId) => {
    try {
      await offersAPI.generate(projectId);
      toast.success('Oferta została wygenerowana pomyślnie!');
      refetch();
    } catch (error) {
      toast.error('Błąd podczas generowania oferty');
    }
  };

  const generateContract = async (projectId) => {
    try {
      await offersAPI.generateContract(projectId);
      toast.success('Umowa została wygenerowana, status ustawiono na zaakceptowany!');
      refetch();
    } catch (error) {
      toast.error('Błąd podczas generowania umowy');
    }
  };

  const generatePdf = async (project) => {
    try {
      console.log('Generating PDF for project:', project._id);
      const response = await offersAPI.generatePdf(project._id, project);
      console.log('PDF generation response:', response);
      toast.success('PDF oferty został wygenerowany pomyślnie!');
      
      // Automatycznie pobierz PDF
      if (response.pdfUrl) {
        const link = document.createElement('a');
        link.href = `https://oferty.soft-synergy.com${response.pdfUrl}`;
        link.download = response.fileName || 'oferta.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Force refresh to show PDF button
      refetch();
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Błąd podczas generowania PDF');
    }
  };

  const handleRequestFinalEstimation = async (projectId) => {
    try {
      console.log('Wywołuję requestFinalEstimation dla:', projectId);
      const response = await projectsAPI.requestFinalEstimation(projectId);
      console.log('Odpowiedź:', response);
      toast.success('Status zmieniony na "Do wyceny finalnej"');
      refetch();
    } catch (error) {
      console.error('Błąd requestFinalEstimation:', error);
      toast.error(error.response?.data?.message || 'Błąd podczas zmiany statusu');
    }
  };

  const handleOpenRespondModal = (project) => {
    setSelectedProject(project);
    setFinalEstimateTotal('');
    setClarificationText('');
    setFinalEstimationGate(null);
    setFinalEstimationGateLoading(false);
    setShowRespondModal(true);
  };

  const handleCloseRespondModal = () => {
    setShowRespondModal(false);
    setSelectedProject(null);
    setFinalEstimateTotal('');
    setClarificationText('');
    setClarificationResponseText('');
    setFinalEstimationGate(null);
    setFinalEstimationGateLoading(false);
  };

  useEffect(() => {
    if (!showRespondModal || !selectedProject?._id) return;
    if (selectedProject.offerType !== 'preliminary' || selectedProject.status !== 'to_final_estimation') {
      setFinalEstimationGate(null);
      setFinalEstimationGateLoading(false);
      return;
    }
    let cancelled = false;
    setFinalEstimationGateLoading(true);
    setFinalEstimationGate(null);
    projectsAPI
      .getFinalEstimationGate(selectedProject._id)
      .then((data) => {
        if (!cancelled) {
          setFinalEstimationGate(data);
          if (data.gateCheckFailed) {
            toast.error(
              'Sprawdzenie AI było niedostępne — możesz spróbować zapisać wycenę; serwer zweryfikuje ponownie przy zapisie.',
              { duration: 6000 }
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFinalEstimationGate(null);
          toast.error(err.response?.data?.message || 'Nie udało się pobrać analizy AI przed wyceną');
        }
      })
      .finally(() => {
        if (!cancelled) setFinalEstimationGateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showRespondModal, selectedProject?._id, selectedProject?.status, selectedProject?.offerType]);

  const handleSubmitFinalEstimate = async () => {
    if (!selectedProject || !finalEstimateTotal || parseFloat(finalEstimateTotal) <= 0) {
      toast.error('Wprowadź poprawną kwotę');
      return;
    }
    try {
      await projectsAPI.submitFinalEstimate(selectedProject._id, parseFloat(finalEstimateTotal));
      toast.success('Finalna wycena została zapisana. Status zmieniony na "Do przygotowania oferty finalnej"');
      handleCloseRespondModal();
      refetch();
    } catch (error) {
      if (error.response?.status === 409) {
        const d = error.response.data || {};
        setFinalEstimationGate({
          canEstimateFinalNow: d.canEstimateFinalNow !== false,
          hardBlockers: Array.isArray(d.hardBlockers) ? d.hardBlockers : [],
          risksToFlagAtFinalOffer: Array.isArray(d.risksToFlagAtFinalOffer) ? d.risksToFlagAtFinalOffer : [],
          clarificationQuestions: Array.isArray(d.clarificationQuestions) ? d.clarificationQuestions : [],
          proposedClientClarificationMessage: d.proposedClientClarificationMessage || '',
          gateCheckOk: true,
          gateCheckFailed: false
        });
        toast.error(d.message || 'Zapis wyceny zablokowany — zobacz blokery AI w modalu.', { duration: 8000 });
        return;
      }
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania wyceny');
    }
  };

  const handleSubmitClarification = async () => {
    if (!selectedProject || !clarificationText.trim()) {
      toast.error('Wpisz treść doprecyzowania');
      return;
    }
    try {
      await projectsAPI.requestClarification(selectedProject._id, clarificationText.trim());
      toast.success('Doprecyzowanie zapisane. Jakub dostanie maila – odpowiedź wpisuje w panelu.');
      handleCloseRespondModal();
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania doprecyzowania');
    }
  };

  const handleSubmitClarificationResponse = async () => {
    if (!selectedProject || !clarificationResponseText.trim()) return;
    setSubmittingClarificationResponse(true);
    try {
      const data = await projectsAPI.submitClarificationResponse(selectedProject._id, clarificationResponseText.trim());
      toast.success('Odpowiedź na doprecyzowanie zapisana. Status: Do wyceny finalnej.');
      setClarificationResponseText('');
      if (data.project) setSelectedProject(data.project);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Błąd zapisywania odpowiedzi');
    } finally {
      setSubmittingClarificationResponse(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Szkic', color: 'bg-gray-100 text-gray-800' },
      active: { label: 'Aktywny', color: 'bg-green-100 text-green-800' },
      accepted: { label: 'Zaakceptowany', color: 'bg-emerald-100 text-emerald-800' },
      completed: { label: 'Zakończony', color: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Anulowany', color: 'bg-red-100 text-red-800' },
      to_final_estimation: { label: 'Do wyceny finalnej', color: 'bg-orange-100 text-orange-800' },
      to_prepare_final_offer: { label: 'Do przygotowania oferty finalnej', color: 'bg-green-100 text-green-800' },
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('projects.header')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('projects.subheader')}</p>
        </div>
        <Link
          to="/projects/new"
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('projects.newProject')}
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="form-label">{t('projects.searchLabel')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('projects.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="input-field pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="form-label">{t('projects.statusLabel')}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="input-field"
            >
              <option value="">{t('projects.allOption')}</option>
              <option value="draft">{t('projects.status.draft')}</option>
              <option value="active">{t('projects.status.active')}</option>
              <option value="accepted">{t('projects.status.accepted')}</option>
              <option value="completed">{t('projects.status.completed')}</option>
              <option value="cancelled">{t('projects.status.cancelled')}</option>
              <option value="to_final_estimation">Do wyceny finalnej</option>
              <option value="to_prepare_final_offer">Do przygotowania oferty finalnej</option>
            </select>
          </div>

          <div>
            <label className="form-label">{t('projects.offerTypeLabel')}</label>
            <select
              value={filters.offerType}
              onChange={(e) => setFilters({ ...filters, offerType: e.target.value, page: 1 })}
              className="input-field"
            >
              <option value="">{t('projects.allOption')}</option>
              <option value="final">Final</option>
              <option value="preliminary">Preliminary</option>
            </select>
          </div>

          <div>
            <label className="form-label">Owner</label>
            <select
              value={filters.owner}
              onChange={(e) => setFilters({ ...filters, owner: e.target.value, page: 1 })}
              className="input-field"
            >
              <option value="">{t('projects.allOption')}</option>
              <option value="me">Only mine</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ search: '', status: '', offerType: '', owner: '', page: 1 })}
              className="btn-secondary w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              {t('projects.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {data?.projects?.map((project) => {
          const hasPendingFollowUp = project.nextFollowUpDueAt && project.status !== 'accepted' && project.status !== 'cancelled' && (!project.followUps || project.followUps.length < 3);
          const isOverdue = hasPendingFollowUp && new Date(project.nextFollowUpDueAt) <= new Date();
          const isOrangeStatus = project.status === 'to_final_estimation';
          return (
          <div key={project._id} className={`card hover:shadow-md transition-shadow duration-200 ${isOverdue ? 'ring-2 ring-red-500' : ''} ${isOrangeStatus ? 'bg-orange-50 border-orange-200' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {project.name}
                      </h3>
                      {project.offerType === 'preliminary' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Oferta wstępna
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Klient: {project.clientName}
                    </p>
                    {hasPendingFollowUp && (
                      <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {isOverdue ? 'Termin follow-up minął' : 'Zaplanowany follow-up'}: {new Date(project.nextFollowUpDueAt).toLocaleDateString('pl-PL')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(project.status)}
                    {project.priority && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        project.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        project.priority === 'low' ? 'bg-gray-100 text-gray-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {project.priority === 'urgent' ? 'Pilny' :
                         project.priority === 'high' ? 'Wysoki' :
                         project.priority === 'low' ? 'Niski' : 'Normalny'}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(project.pricing?.total || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {project.owner?.firstName ? `${project.owner.firstName} ${project.owner.lastName}` : project.createdBy?.fullName}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(project.createdAt).toLocaleDateString('pl-PL')}
                  </div>
                  {project.offerNumber && (
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      {project.offerNumber}
                    </div>
                  )}
                </div>

                {/* DUŻE PRZYCISKI DLA OFERT WSTĘPNYCH */}
                {project.offerType === 'preliminary' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {/* Przycisk "Do wyceny finalnej" - dla ofert wstępnych które nie są jeszcze w workflow */}
                    {project.status !== 'to_final_estimation' && 
                     project.status !== 'to_prepare_final_offer' && 
                     project.status !== 'accepted' && 
                     project.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          console.log('Kliknięto "Do wyceny finalnej" dla projektu:', project._id);
                          handleRequestFinalEstimation(project._id);
                        }}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
                      >
                        <DollarSign className="h-5 w-5" />
                        <span>Do wyceny finalnej</span>
                      </button>
                    )}
                    {/* Przycisk "Odpowiedz" – gdy status to_final_estimation */}
                    {project.status === 'to_final_estimation' && (
                      <button
                        onClick={() => handleOpenRespondModal(project)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>Odpowiedz</span>
                      </button>
                    )}
                    {/* Doprecyzowanie – czeka na odpowiedź Jakuba w panelu (ostatni wpis w historii bez odpowiedzi) */}
                    {project.offerType === 'preliminary' && (() => {
                      const history = project.clarificationHistory || [];
                      const last = history.length ? history[history.length - 1] : null;
                      const pending = last && !last.responseText && (last.requestText || project.clarificationRequest?.text);
                      return pending ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            Oczekuje na odpowiedź (doprecyzowanie w panelu)
                          </p>
                          <p className="text-xs text-amber-700 mt-1 line-clamp-2">{last?.requestText || project.clarificationRequest?.text}</p>
                          <button
                            onClick={() => handleOpenRespondModal(project)}
                            className="mt-2 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Odpowiedz na doprecyzowanie
                          </button>
                        </div>
                      ) : null;
                    })()}
                    {/* Info gdy status to_prepare_final_offer */}
                    {project.status === 'to_prepare_final_offer' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-medium">
                          ✓ Wycena finalna zapisana ({formatCurrency(project.finalEstimateTotal || project.pricing?.total || 0)})
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Status: Do przygotowania oferty finalnej
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                {project.generatedOfferUrl ? (
                  <a
                    href={`https://oferty.soft-synergy.com${project.generatedOfferUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-green-600 group relative"
                    title="Pobierz ofertę HTML"
                  >
                    <Download className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Pobierz ofertę HTML
                    </div>
                  </a>
                ) : (
                  <button
                    onClick={() => generateOffer(project._id)}
                    className="p-2 text-gray-400 hover:text-blue-600 group relative"
                    title="Generuj ofertę"
                  >
                    <FileText className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Generuj ofertę
                    </div>
                  </button>
                )}
                {project.pdfUrl ? (
                  <a
                    href={`https://oferty.soft-synergy.com${project.pdfUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-red-600 group relative"
                    title="Pobierz ofertę PDF"
                  >
                    <Download className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Pobierz ofertę PDF
                    </div>
                  </a>
                ) : (
                  <button
                    onClick={() => generatePdf(project)}
                    className="p-2 text-gray-400 hover:text-red-600 group relative"
                    title="Generuj i pobierz PDF"
                  >
                    <FileText className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Generuj i pobierz PDF
                    </div>
                  </button>
                )}
                {project.contractPdfUrl ? (
                  <a
                    href={`https://oferty.soft-synergy.com${project.contractPdfUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-emerald-600 group relative"
                    title="Pobierz umowę PDF"
                  >
                    <Download className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Pobierz umowę PDF
                    </div>
                  </a>
                ) : (
                  <button
                    onClick={() => generateContract(project._id)}
                    className="p-2 text-gray-400 hover:text-emerald-600 group relative"
                    title="Wygeneruj umowę"
                  >
                    <FileText className="h-4 w-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Wygeneruj umowę
                    </div>
                  </button>
                )}
                {project.offerType === 'preliminary' && project.calBookingUrl && (
                <a
                  href={project.calBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-purple-600 group relative"
                  title="Zobacz w Cal.com"
                >
                  <ExternalLink className="h-4 w-4" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Zobacz w Cal.com
                  </div>
                </a>
                )}
                <Link
                  to={`/projects/${project._id}`}
                  className="p-2 text-gray-400 hover:text-gray-600 group relative"
                  title="Zobacz szczegóły"
                >
                  <Eye className="h-4 w-4" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Zobacz szczegóły
                  </div>
                </Link>
                <Link
                  to={`/projects/${project._id}/edit`}
                  className="p-2 text-gray-400 hover:text-blue-600 group relative"
                  title="Edytuj"
                >
                  <Edit className="h-4 w-4" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Edytuj
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(project._id)}
                  className="p-2 text-gray-400 hover:text-red-600 group relative"
                  title="Usuń"
                >
                  <Trash2 className="h-4 w-4" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Usuń
                  </div>
                </button>
              </div>
            </div>
          </div>
        );})}
        
        {data?.projects?.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('projects.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.status 
                ? t('projects.emptyHintFiltered')
                : t('projects.emptyHint')
              }
            </p>
            {!filters.search && !filters.status && (
              <div className="mt-6">
                <Link to="/projects/new" className="btn-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('projects.createFirst')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Odpowiedz – pełne info projektu + rozwidlenie na Finalna wycena / Doprecyzowanie */}
      {showRespondModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 flex-shrink-0 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Odpowiedz – Do wyceny finalnej</h2>
                <button onClick={handleCloseRespondModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Wszystkie info o projekcie w jednym miejscu */}
            <div className="p-6 overflow-y-auto flex-1 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Informacje o projekcie</h3>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-gray-500 inline">Projekt:</dt> <dd className="inline font-medium">{selectedProject.name}</dd></div>
                <div><dt className="text-gray-500 inline">Klient:</dt> <dd className="inline font-medium">{selectedProject.clientName}</dd></div>
                <div><dt className="text-gray-500 inline">Kontakt:</dt> <dd className="inline">{selectedProject.clientContact || '-'}</dd></div>
                <div><dt className="text-gray-500 inline">Email:</dt> <dd className="inline"><a href={`mailto:${selectedProject.clientEmail}`} className="text-blue-600 hover:underline">{selectedProject.clientEmail || '-'}</a></dd></div>
                <div><dt className="text-gray-500 inline">Telefon:</dt> <dd className="inline">{selectedProject.clientPhone || '-'}</dd></div>
                {selectedProject.consultationNotes && (
                  <div className="pt-2">
                    <dt className="text-gray-500 block mb-1">Notatki z konsultacji:</dt>
                    <dd className="whitespace-pre-wrap text-gray-800 bg-white p-3 rounded border">{selectedProject.consultationNotes}</dd>
                  </div>
                )}
                {selectedProject.notes?.length > 0 && (
                  <div className="pt-2">
                    <dt className="text-gray-500 block mb-1">Notatki:</dt>
                    <dd className="space-y-1">
                      {selectedProject.notes.map((n, i) => (
                        <div key={i} className="bg-white p-2 rounded border text-gray-800 text-xs">{n.text}</div>
                      ))}
                    </dd>
                  </div>
                )}
                {selectedProject.description && (
                  <div className="pt-2">
                    <dt className="text-gray-500 block mb-1">Opis:</dt>
                    <dd className="whitespace-pre-wrap text-gray-800 bg-white p-3 rounded border">{selectedProject.description}</dd>
                  </div>
                )}
                {(selectedProject.clarificationHistory?.length > 0 || selectedProject.clarificationRequest?.text) && (
                  <div className="pt-2">
                    <dt className="text-amber-700 block mb-2 font-medium">Historia doprecyzowań</dt>
                    <dd className="space-y-3">
                      {(() => {
                        const history = selectedProject.clarificationHistory?.length
                          ? selectedProject.clarificationHistory
                          : selectedProject.clarificationRequest?.text
                            ? [{ requestText: selectedProject.clarificationRequest.text, requestedAt: selectedProject.clarificationRequest.requestedAt, requestedBy: selectedProject.clarificationRequest.requestedBy, responseText: null, respondedAt: null }]
                            : [];
                        return history.map((entry, idx) => (
                          <div key={idx} className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                            <div className="text-xs text-amber-700 font-medium mb-1">
                              #{idx + 1} Żądanie {entry.requestedAt ? new Date(entry.requestedAt).toLocaleString('pl-PL') : ''}
                              {entry.requestedBy?.firstName ? ` (${entry.requestedBy.firstName} ${entry.requestedBy.lastName})` : ''}
                            </div>
                            <p className="whitespace-pre-wrap text-amber-900 text-sm">{entry.requestText}</p>
                            {entry.responseText && (
                              <div className="mt-2 pt-2 border-t border-amber-200">
                                <div className="text-xs text-green-700 font-medium mb-1">
                                  Odpowiedź (panel admina) {entry.respondedAt ? new Date(entry.respondedAt).toLocaleString('pl-PL') : ''}
                                  {entry.respondedBy?.firstName ? ` – ${entry.respondedBy.firstName} ${entry.respondedBy.lastName}` : ''}
                                </div>
                                <p className="whitespace-pre-wrap text-gray-800 text-sm bg-white p-2 rounded border">{entry.responseText}</p>
                              </div>
                            )}
                            {!entry.responseText && (
                              <p className="mt-2 text-xs text-amber-600 italic">Oczekuje na odpowiedź w panelu (Jakub).</p>
                            )}
                          </div>
                        ));
                      })()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Odpowiedź na doprecyzowanie (gdy status active i ostatni wpis bez odpowiedzi) */}
            {(() => {
              const history = selectedProject.clarificationHistory || [];
              const last = history.length ? history[history.length - 1] : null;
              const hasPendingClarification = selectedProject.status === 'active' && last && !last.responseText;
              return hasPendingClarification ? (
                <div className="p-6 border-t bg-amber-50/50">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">Odpowiedz na doprecyzowanie (wpisz w panelu)</h3>
                  <textarea
                    value={clarificationResponseText}
                    onChange={(e) => setClarificationResponseText(e.target.value)}
                    placeholder="Wpisz doprecyzowanie / notatki po kontakcie z klientem..."
                    rows={4}
                    className="input-field resize-none mb-2 w-full"
                  />
                  <button
                    onClick={handleSubmitClarificationResponse}
                    disabled={!clarificationResponseText.trim() || submittingClarificationResponse}
                    className="btn-primary bg-amber-600 hover:bg-amber-700"
                  >
                    {submittingClarificationResponse ? 'Zapisywanie...' : 'Zapisz odpowiedź (status → Do wyceny finalnej)'}
                  </button>
                </div>
              ) : null;
            })()}

            {/* Rozwidlenie na 2 – Finalna wycena / Doprecyzowanie (gdy status to_final_estimation) */}
            <div className="p-6 space-y-6">
              <h3 className="text-sm font-semibold text-gray-700">Decyzja</h3>

              {selectedProject.status === 'to_final_estimation' &&
                selectedProject.offerType === 'preliminary' && (
                  <div className="rounded-lg border border-gray-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        Weryfikacja AI przed wyceną
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedProject?._id) return;
                          setFinalEstimationGateLoading(true);
                          projectsAPI
                            .getFinalEstimationGate(selectedProject._id)
                            .then((data) => {
                              setFinalEstimationGate(data);
                              if (data.gateCheckFailed) {
                                toast.error(
                                  'Sprawdzenie AI niedostępne — spróbuj ponownie później.',
                                  { duration: 5000 }
                                );
                              } else {
                                toast.success('Analiza AI odświeżona');
                              }
                            })
                            .catch((err) => {
                              toast.error(
                                err.response?.data?.message || 'Błąd ponownego sprawdzenia AI'
                              );
                            })
                            .finally(() => setFinalEstimationGateLoading(false));
                        }}
                        disabled={finalEstimationGateLoading}
                        className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                      >
                        Sprawdź ponownie
                      </button>
                    </div>
                    {finalEstimationGateLoading && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                        Szukanie blokerów w zakresie…
                      </p>
                    )}
                    {finalEstimationGate && !finalEstimationGateLoading && (
                      <>
                        {finalEstimationGate.gateCheckFailed && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                            Nie udało się uruchomić pełnej analizy AI. Możesz spróbować zapisać wycenę —
                            serwer sprawdzi zakres jeszcze raz przy zapisie (przy awarii AI zapis nie
                            zostanie zablokowany).
                          </p>
                        )}
                        {!finalEstimationGate.gateCheckFailed &&
                          finalEstimationGate.hardBlockers?.length > 0 && (
                            <div className="text-sm bg-red-50 border border-red-200 text-red-900 rounded p-3 space-y-2">
                              <p className="font-semibold">
                                Twarda blokada — najpierw uzupełnij zakres lub wyślij doprecyzowanie do
                                klienta:
                              </p>
                              <ul className="list-decimal pl-5 space-y-1">
                                {finalEstimationGate.hardBlockers.map((b, idx) => (
                                  <li key={idx}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {!finalEstimationGate.gateCheckFailed &&
                          !finalEstimationGate.canEstimateFinalNow &&
                          !(finalEstimationGate.hardBlockers?.length > 0) && (
                            <div className="text-sm bg-red-50 border border-red-200 text-red-900 rounded p-3">
                              AI uznało, że na tym etapie nie można odpowiedzialnie podać finalnej wyceny.
                              Rozważ doprecyzowanie z klientem.
                            </div>
                          )}
                        {!finalEstimationGate.gateCheckFailed &&
                          finalEstimationGate.canEstimateFinalNow &&
                          !(finalEstimationGate.hardBlockers?.length > 0) &&
                          (finalEstimationGate.risksToFlagAtFinalOffer?.length > 0 ||
                            finalEstimationGate.clarificationQuestions?.length > 0) && (
                            <div className="text-sm bg-amber-50 border border-amber-200 text-amber-950 rounded p-3 space-y-2">
                              <p className="font-medium">Możesz wycenić — uwagi przed wpisaniem kwoty:</p>
                              {finalEstimationGate.risksToFlagAtFinalOffer?.length > 0 && (
                                <ul className="list-disc pl-5 space-y-1">
                                  {finalEstimationGate.risksToFlagAtFinalOffer.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                  ))}
                                </ul>
                              )}
                              {finalEstimationGate.clarificationQuestions?.length > 0 && (
                                <>
                                  <p className="font-medium pt-1">Pytania do doprecyzowania:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                    {finalEstimationGate.clarificationQuestions.map((q, idx) => (
                                      <li key={idx}>{q}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          )}
                        {!finalEstimationGate.gateCheckFailed &&
                          finalEstimationGate.canEstimateFinalNow &&
                          !(finalEstimationGate.hardBlockers?.length > 0) &&
                          !(
                            finalEstimationGate.risksToFlagAtFinalOffer?.length > 0 ||
                            finalEstimationGate.clarificationQuestions?.length > 0
                          ) && (
                            <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded p-2">
                              Brak twardych blokerów — możesz wpisać kwotę finalnej wyceny.
                            </p>
                          )}
                      </>
                    )}
                  </div>
                )}

              <div className="space-y-4">
                <div>
                  <label className="form-label">Finalna wycena – wpisz cenę całkowitą</label>
                  <input
                    type="number"
                    value={finalEstimateTotal}
                    onChange={(e) => setFinalEstimateTotal(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    disabled={
                      selectedProject.status === 'to_final_estimation' &&
                      selectedProject.offerType === 'preliminary' &&
                      finalEstimationGateLoading
                    }
                    className="input-field mb-2"
                  />
                  <button
                    onClick={handleSubmitFinalEstimate}
                    disabled={
                      !finalEstimateTotal ||
                      parseFloat(finalEstimateTotal) <= 0 ||
                      (selectedProject.status === 'to_final_estimation' &&
                        selectedProject.offerType === 'preliminary' &&
                        (finalEstimationGateLoading ||
                          (finalEstimationGate &&
                            !finalEstimationGate.gateCheckFailed &&
                            (!finalEstimationGate.canEstimateFinalNow ||
                              (finalEstimationGate.hardBlockers?.length ?? 0) > 0))))
                    }
                    className="btn-primary bg-orange-600 hover:bg-orange-700"
                  >
                    <DollarSign className="h-4 w-4 inline mr-2" />
                    Zapisz wycenę finalną
                  </button>
                </div>

                <div className="border-t pt-4">
                  <label className="form-label">Doprecyzowanie – nie można jeszcze wycenić</label>
                  <textarea
                    value={clarificationText}
                    onChange={(e) => setClarificationText(e.target.value)}
                    placeholder="Np. brakuje szczegółów wymagań, potrzeba dodatkowych informacji od klienta..."
                    rows={3}
                    className="input-field resize-none mb-2"
                  />
                  <button
                    onClick={handleSubmitClarification}
                    disabled={!clarificationText.trim()}
                    className="btn-secondary bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                  >
                    <MessageCircle className="h-4 w-4 inline mr-2" />
                    Zapisz doprecyzowanie
                  </button>
                  <p className="text-xs text-gray-500 mt-1">Projekt wróci do statusu Aktywny.</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={handleCloseRespondModal} className="btn-secondary">
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-between">
          {(() => {
            const currentPage = Number(data.currentPage || 1);
            const total = Number(data.total || 0);
            const start = ((currentPage - 1) * 10) + 1;
            const end = Math.min(currentPage * 10, total);
            return (
              <div className="text-sm text-gray-700">
                {t('projects.shownCount')
                  .replace('{{start}}', start)
                  .replace('{{end}}', end)
                  .replace('{{total}}', total)}
              </div>
            );
          })()}
          <div className="flex space-x-2">
            {(() => {
              const currentPage = Number(data.currentPage || 1);
              const totalPages = Number(data.totalPages || 1);
              return (
                <>
                  <button
                    onClick={() => setFilters({ ...filters, page: Math.max(1, currentPage - 1) })}
                    disabled={currentPage <= 1}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('projects.prev')}
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: Math.min(totalPages, currentPage + 1) })}
                    disabled={currentPage >= totalPages}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('projects.next')}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects; 