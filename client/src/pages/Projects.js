import React, { useState } from 'react';
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
  MessageCircle,
  AlertTriangle
} from 'lucide-react';
import { projectsAPI, offersAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const MAX_FOLLOW_UPS = 6;

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
  const [requestFinalEstimationProjectId, setRequestFinalEstimationProjectId] = useState(null);
  const [finalEstimateTotal, setFinalEstimateTotal] = useState('');
  const [clarificationText, setClarificationText] = useState('');
  const [clarificationResponseText, setClarificationResponseText] = useState('');
  const [submittingFinalEstimate, setSubmittingFinalEstimate] = useState(false);
  const [submittingHourlyEstimate, setSubmittingHourlyEstimate] = useState(false);
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const [submittingClarificationResponse, setSubmittingClarificationResponse] = useState(false);
  /** AI zablokowało »Do wyceny finalnej« — modal z możliwością force */
  const [finalEstimationAiBlockModal, setFinalEstimationAiBlockModal] = useState(null);
  const [finalEstimationForceSubmitting, setFinalEstimationForceSubmitting] = useState(false);

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

  const handleRequestFinalEstimation = async (project, { force = false } = {}) => {
    if (!project?._id) return;
    if (!force) setRequestFinalEstimationProjectId(project._id);
    try {
      const response = await projectsAPI.requestFinalEstimation(project._id, { force });
      setFinalEstimationAiBlockModal(null);
      toast.success(
        response?.aiGateOverridden
          ? 'Status: Do wyceny finalnej (nadpisano blokadę AI — odpowiadasz za zakres)'
          : 'Status zmieniony na "Do wyceny finalnej"'
      );
      const gate = response?.finalEstimationGate;
      if (gate?.gateCheckFailed) {
        toast.error(
          gate.gateCheckMessage
            ? `Analiza AI niedostępna: ${gate.gateCheckMessage}`
            : 'Analiza AI niedostępna — sprawdź zakres przy odpowiedzi w modalu.',
          { duration: 6000 }
        );
      } else if (gate && !response?.aiGateOverridden) {
        if (
          gate.risksToFlagAtFinalOffer?.length > 0 ||
          gate.clarificationQuestions?.length > 0
        ) {
          toast(
            () => (
              <div className="text-sm max-w-md">
                <div className="font-semibold text-amber-900 mb-1">AI — uwagi przed wyceną (bez twardych blokerów)</div>
                {gate.risksToFlagAtFinalOffer?.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {gate.risksToFlagAtFinalOffer.slice(0, 5).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {gate.clarificationQuestions?.length > 0 && (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {gate.clarificationQuestions.slice(0, 5).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                )}
              </div>
            ),
            { duration: 10000 }
          );
        }
      }
      refetch();
    } catch (error) {
      if (error.response?.status === 409 && !force) {
        const gate = error.response.data?.finalEstimationGate || {};
        setFinalEstimationAiBlockModal({ project, gate });
        return;
      }
      console.error('Błąd requestFinalEstimation:', error);
      toast.error(error.response?.data?.message || 'Błąd podczas zmiany statusu');
    } finally {
      if (!force) setRequestFinalEstimationProjectId(null);
    }
  };

  const handleOpenRespondModal = (project) => {
    setSelectedProject(project);
    setFinalEstimateTotal('');
    setClarificationText('');
    setShowRespondModal(true);
  };

  const handleCloseRespondModal = () => {
    setShowRespondModal(false);
    setSelectedProject(null);
    setFinalEstimateTotal('');
    setClarificationText('');
    setClarificationResponseText('');
  };

  const handleSubmitFinalEstimate = async () => {
    if (!selectedProject || !finalEstimateTotal || parseFloat(finalEstimateTotal) <= 0) {
      toast.error('Wprowadź poprawną kwotę');
      return;
    }
    setSubmittingFinalEstimate(true);
    try {
      await projectsAPI.submitFinalEstimate(selectedProject._id, {
        mode: 'fixed',
        total: parseFloat(finalEstimateTotal)
      });
      toast.success('Finalna wycena została zapisana. Status zmieniony na "Do przygotowania oferty finalnej"');
      handleCloseRespondModal();
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania wyceny');
    } finally {
      setSubmittingFinalEstimate(false);
    }
  };

  const handleSubmitHourlyEstimate = async () => {
    if (!selectedProject) return;
    setSubmittingHourlyEstimate(true);
    try {
      await projectsAPI.submitFinalEstimate(selectedProject._id, {
        mode: 'hourly',
        hourlyRate: 100
      });
      toast.success('Wycena godzinowa 100 zł/h została zapisana. Status zmieniony na "Do przygotowania oferty finalnej"');
      handleCloseRespondModal();
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania wyceny godzinowej');
    } finally {
      setSubmittingHourlyEstimate(false);
    }
  };

  const handleSubmitClarification = async () => {
    if (!selectedProject || !clarificationText.trim()) {
      toast.error('Wpisz treść doprecyzowania');
      return;
    }
    setSubmittingClarification(true);
    try {
      await projectsAPI.requestClarification(selectedProject._id, clarificationText.trim());
      toast.success('Doprecyzowanie zapisane. Rizka dostanie maila – odpowiedź wpisuje w panelu.');
      handleCloseRespondModal();
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania doprecyzowania');
    } finally {
      setSubmittingClarification(false);
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

  const formatProjectEstimatePreview = (project) => {
    if (project.finalEstimateMode === 'hourly') {
      return `${project.finalEstimateHourlyRate || 100} zł/h`;
    }
    return formatCurrency(project.finalEstimateTotal || project.pricing?.total || 0);
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
          const hasPendingFollowUp = project.nextFollowUpDueAt && project.status !== 'accepted' && project.status !== 'cancelled' && (!project.followUps || project.followUps.length < MAX_FOLLOW_UPS);
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
                        onClick={() => handleRequestFinalEstimation(project)}
                        disabled={requestFinalEstimationProjectId === project._id}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 disabled:cursor-wait text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
                      >
                        {requestFinalEstimationProjectId === project._id ? (
                          <>
                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                            <span>Przenoszę do wyceny finalnej...</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-5 w-5" />
                            <span>Do wyceny finalnej</span>
                          </>
                        )}
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
                    {/* Doprecyzowanie – czeka na odpowiedź w panelu (ostatni wpis w historii bez odpowiedzi) */}
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
                          ✓ {project.finalEstimateMode === 'hourly'
                            ? `Wycena godzinowa zapisana (${formatProjectEstimatePreview(project)})`
                            : `Wycena finalna zapisana (${formatProjectEstimatePreview(project)})`}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Status: Do przygotowania oferty finalnej
                        </p>
                        {project.finalEstimateMode === 'hourly' && (
                          <div className="mt-2 rounded-md border border-green-300 bg-white/80 p-2 text-xs text-green-800">
                            {'Przy przygotowaniu oferty dodaj informację: „Zadecydowaliśmy, że w tym projekcie możliwa jest wyłącznie wycena godzinowa '}
                            <strong>{project.finalEstimateHourlyRate || 100} zł/h</strong>
                            {' i nie ma możliwości przygotowania wyceny fixed price.”'}
                          </div>
                        )}
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
          <div className="bg-white rounded-lg max-w-6xl w-full my-8 max-h-[94vh] flex flex-col shadow-2xl">
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
            <div className="p-8 overflow-y-auto flex-1 border-b bg-gray-50">
              <h3 className="text-base font-semibold text-gray-700 mb-5">Informacje o projekcie</h3>
              <dl className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-4 text-base">
                <div><dt className="text-gray-500 inline">Projekt:</dt> <dd className="inline font-semibold text-gray-900">{selectedProject.name}</dd></div>
                <div><dt className="text-gray-500 inline">Klient:</dt> <dd className="inline font-semibold text-gray-900">{selectedProject.clientName}</dd></div>
                <div><dt className="text-gray-500 inline">Kontakt:</dt> <dd className="inline text-gray-800">{selectedProject.clientContact || '-'}</dd></div>
                <div><dt className="text-gray-500 inline">Email:</dt> <dd className="inline"><a href={`mailto:${selectedProject.clientEmail}`} className="text-blue-600 hover:underline break-all">{selectedProject.clientEmail || '-'}</a></dd></div>
                <div><dt className="text-gray-500 inline">Telefon:</dt> <dd className="inline text-gray-800">{selectedProject.clientPhone || '-'}</dd></div>
                <div><dt className="text-gray-500 inline">Status:</dt> <dd className="inline text-gray-800">{getStatusBadge(selectedProject.status)}</dd></div>
                {selectedProject.consultationNotes && (
                  <div className="pt-2 xl:col-span-2">
                    <dt className="text-gray-500 block mb-2 text-sm font-medium">Notatki z konsultacji:</dt>
                    <dd className="whitespace-pre-wrap text-gray-900 bg-white p-4 rounded border text-[15px] leading-7 max-h-[32vh] overflow-y-auto">{selectedProject.consultationNotes}</dd>
                  </div>
                )}
                {selectedProject.notes?.length > 0 && (
                  <div className="pt-2 xl:col-span-2">
                    <dt className="text-gray-500 block mb-2 text-sm font-medium">Notatki:</dt>
                    <dd className="space-y-1">
                      {selectedProject.notes.map((n, i) => (
                        <div key={i} className="bg-white p-3 rounded border text-gray-800 text-sm leading-6">{n.text}</div>
                      ))}
                    </dd>
                  </div>
                )}
                {selectedProject.description && (
                  <div className="pt-2 xl:col-span-2">
                    <dt className="text-gray-500 block mb-2 text-sm font-medium">Opis:</dt>
                    <dd className="whitespace-pre-wrap text-gray-900 bg-white p-4 rounded border text-[15px] leading-7 max-h-[28vh] overflow-y-auto">{selectedProject.description}</dd>
                  </div>
                )}
                {(selectedProject.clarificationHistory?.length > 0 || selectedProject.clarificationRequest?.text) && (
                  <div className="pt-2 xl:col-span-2">
                    <dt className="text-amber-700 block mb-3 font-medium text-sm">Historia doprecyzowań</dt>
                    <dd className="space-y-3">
                      {(() => {
                        const history = selectedProject.clarificationHistory?.length
                          ? selectedProject.clarificationHistory
                          : selectedProject.clarificationRequest?.text
                            ? [{ requestText: selectedProject.clarificationRequest.text, requestedAt: selectedProject.clarificationRequest.requestedAt, requestedBy: selectedProject.clarificationRequest.requestedBy, responseText: null, respondedAt: null }]
                            : [];
                        return history.map((entry, idx) => (
                          <div key={idx} className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                            <div className="text-xs text-amber-700 font-medium mb-1">
                              #{idx + 1} Żądanie {entry.requestedAt ? new Date(entry.requestedAt).toLocaleString('pl-PL') : ''}
                              {entry.requestedBy?.firstName ? ` (${entry.requestedBy.firstName} ${entry.requestedBy.lastName})` : ''}
                            </div>
                            <p className="whitespace-pre-wrap text-amber-900 text-sm leading-6">{entry.requestText}</p>
                            {entry.responseText && (
                              <div className="mt-2 pt-2 border-t border-amber-200">
                                <div className="text-xs text-green-700 font-medium mb-1">
                                  Odpowiedź (panel admina) {entry.respondedAt ? new Date(entry.respondedAt).toLocaleString('pl-PL') : ''}
                                  {entry.respondedBy?.firstName ? ` – ${entry.respondedBy.firstName} ${entry.respondedBy.lastName}` : ''}
                                </div>
                                <p className="whitespace-pre-wrap text-gray-800 text-sm leading-6 bg-white p-3 rounded border">{entry.responseText}</p>
                              </div>
                            )}
                            {!entry.responseText && (
                              <p className="mt-2 text-xs text-amber-600 italic">Oczekuje na odpowiedź w panelu (Rizka).</p>
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
                    className="btn-primary bg-amber-600 hover:bg-amber-700 disabled:cursor-wait"
                  >
                    {submittingClarificationResponse ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent mr-2 align-[-2px]" />
                        Zapisywanie odpowiedzi...
                      </>
                    ) : (
                      'Zapisz odpowiedź (status → Do wyceny finalnej)'
                    )}
                  </button>
                </div>
              ) : null;
            })()}

            {/* Rozwidlenie na 2 – Finalna wycena / Doprecyzowanie (gdy status to_final_estimation) */}
            <div className="p-6 space-y-6">
              <h3 className="text-sm font-semibold text-gray-700">Decyzja</h3>

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
                    className="input-field mb-2"
                  />
                  <button
                    onClick={handleSubmitFinalEstimate}
                    disabled={
                      submittingFinalEstimate ||
                      !finalEstimateTotal ||
                      parseFloat(finalEstimateTotal) <= 0
                    }
                    className="btn-primary bg-orange-600 hover:bg-orange-700 disabled:cursor-wait"
                  >
                    {submittingFinalEstimate ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent mr-2 align-[-2px]" />
                        Zapisywanie wyceny...
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4 inline mr-2" />
                        Zapisz wycenę finalną
                      </>
                    )}
                  </button>
                </div>

                <div className="border-t pt-4">
                  <label className="form-label">Wycena godzinowa</label>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                    <p className="text-sm text-green-900 font-medium">
                      Opcja 3: tylko wycena godzinowa 100 zł/h, bez możliwości fixed price
                    </p>
                    <p className="text-sm text-green-800">
                      Po zapisaniu system oznaczy projekt i doda do oferty formułkę:
                      „Zadecydowaliśmy, że w tym projekcie możliwa jest wyłącznie wycena godzinowa 100 zł/h i nie ma możliwości przygotowania wyceny fixed price.”
                    </p>
                    <button
                      onClick={handleSubmitHourlyEstimate}
                      disabled={submittingHourlyEstimate}
                      className="btn-primary bg-green-600 hover:bg-green-700 disabled:cursor-wait"
                    >
                      {submittingHourlyEstimate ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent mr-2 align-[-2px]" />
                          Zapisywanie godzinówki...
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4 inline mr-2" />
                          Zapisz wycenę godzinową 100 zł/h
                        </>
                      )}
                    </button>
                  </div>
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
                    disabled={!clarificationText.trim() || submittingClarification}
                    className="btn-secondary bg-amber-500 hover:bg-amber-600 text-white border-amber-600 disabled:cursor-wait"
                  >
                    {submittingClarification ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent mr-2 align-[-2px]" />
                        Zapisywanie doprecyzowania...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4 inline mr-2" />
                        Zapisz doprecyzowanie
                      </>
                    )}
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

      {finalEstimationAiBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-xl border-2 border-red-300 overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <h2 className="text-lg font-bold leading-tight">AI blokuje przejście do wyceny finalnej</h2>
                <p className="text-sm text-red-100 mt-1.5 font-medium">
                  {finalEstimationAiBlockModal.project?.name || 'Projekt'}
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto text-sm text-gray-800">
              <p>
                Status <strong>nie został zmieniony</strong>. Najpierw warto uzupełnić notatki / opis w projekcie
                albo wysłać doprecyzowanie do klienta.
              </p>
              {(() => {
                const g = finalEstimationAiBlockModal.gate || {};
                const blockers = Array.isArray(g.hardBlockers) ? g.hardBlockers : [];
                const questions = Array.isArray(g.clarificationQuestions) ? g.clarificationQuestions : [];
                const proposal = g.proposedClientClarificationMessage;
                return (
                  <>
                    {blockers.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="font-semibold text-red-900 mb-2">Twarde blokery</p>
                        <ol className="list-decimal pl-5 space-y-1 text-red-950">
                          {blockers.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {blockers.length === 0 && g.canEstimateFinalNow === false && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-950">
                        AI uznało, że zakres jest niewystarczający do odpowiedzialnej wyceny finalnej.
                      </div>
                    )}
                    {questions.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Pytania do doprecyzowania</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-700">
                          {questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {proposal ? (
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Propozycja wiadomości do klienta</p>
                        <pre className="whitespace-pre-wrap text-xs bg-gray-100 border rounded p-3 text-gray-800">
                          {proposal}
                        </pre>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setFinalEstimationAiBlockModal(null)}
                className="btn-secondary w-full sm:w-auto"
              >
                Zamknij — poprawię projekt
              </button>
              <button
                type="button"
                disabled={finalEstimationForceSubmitting}
                onClick={async () => {
                  const { project } = finalEstimationAiBlockModal;
                  setFinalEstimationForceSubmitting(true);
                  try {
                    await handleRequestFinalEstimation(project, { force: true });
                  } finally {
                    setFinalEstimationForceSubmitting(false);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finalEstimationForceSubmitting
                  ? 'Zapisywanie…'
                  : 'Mimo to ustaw »Do wyceny finalnej« (świadomie nadpisuję AI)'}
              </button>
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
