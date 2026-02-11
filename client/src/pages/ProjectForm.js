import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2,
  FileText,
  Eye,
  Send
} from 'lucide-react';
import { projectsAPI, offersAPI, authAPI } from '../services/api';
import toast from 'react-hot-toast';

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    clientName: '',
    clientContact: '',
    clientEmail: '',
    clientPhone: '',
    description: '',
    mainBenefit: '',
    modules: [
      { name: '', description: '', color: 'blue' }
    ],
    timeline: {
      phase1: { name: 'Faza I: Discovery', duration: 'Tydzień 1-2' },
      phase2: { name: 'Faza II: Design & Prototyp', duration: 'Tydzień 3-4' },
      phase3: { name: 'Faza III: Development', duration: 'Tydzień 5-12' },
      phase4: { name: 'Faza IV: Testy i Wdrożenie', duration: 'Tydzień 13-14' }
    },
    pricing: {
      phase1: 8000,
      phase2: 0,
      phase3: 56000,
      phase4: 8000
    },
    offerType: 'final',
    priceRange: {
      min: null,
      max: null
    },
    projectManager: {
      name: '',
      position: 'Senior Project Manager',
      email: '',
      phone: '',
      description: 'Z ponad 8-letnim doświadczeniem w prowadzeniu złożonych projektów IT, wierzę w transparentną komunikację i partnerskie relacje. Moim zadaniem jest nie tylko nadzór nad harmonogramem, ale przede wszystkim zapewnienie, że finalny produkt w 100% odpowiada Państwa wizji i celom biznesowym. Będę Państwa głównym punktem kontaktowym na każdym etapie współpracy.'
    },
    status: 'draft',
    priority: 'normal',
    notes: [],
    customReservations: [],
    customPaymentTerms: '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.',
    consultationNotes: '',
    language: localStorage.getItem('ofertownik_lang') || 'pl',
    technologies: {
      stack: [],
      methodologies: []
    },
    projectLink: ''
  });

  const { data: project, isLoading } = useQuery(
    ['project', id],
    () => projectsAPI.getById(id),
    { enabled: isEditing }
  );

  const { data: users } = useQuery(
    ['users'],
    authAPI.listUsers
  );

  const createMutation = useMutation(projectsAPI.create, {
    onSuccess: () => {
      toast.success('Projekt został utworzony pomyślnie!');
      queryClient.invalidateQueries('projects');
      navigate('/projects');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Błąd podczas tworzenia projektu');
    }
  });

  const updateMutation = useMutation(
    (data) => projectsAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Projekt został zaktualizowany pomyślnie!');
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries(['project', id]);
        navigate('/projects');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Błąd podczas aktualizacji projektu');
      }
    }
  );

  const generateOfferMutation = useMutation(offersAPI.generate, {
    onSuccess: (data) => {
      toast.success('Oferta została wygenerowana pomyślnie!');
      queryClient.invalidateQueries(['project', id]);
    },
    onError: (error) => {
      toast.error('Błąd podczas generowania oferty');
    }
  });

  const generateContractMutation = useMutation(
    ({ projectId, customText }) => offersAPI.generateContract(projectId, customText),
  {
    onSuccess: () => {
      toast.success('Umowa została wygenerowana, status ustawiono na zaakceptowany!');
      queryClient.invalidateQueries(['project', id]);
      queryClient.invalidateQueries('projects');
    },
    onError: () => toast.error('Błąd podczas generowania umowy')
  });

  const [showContractEditor, setShowContractEditor] = useState(false);
  const [contractText, setContractText] = useState('');

  const openContractEditor = async () => {
    try {
      const { draft } = await offersAPI.getContractDraft(id);
      setContractText(draft || '');
      setShowContractEditor(true);
    } catch (e) {
      toast.error('Nie udało się pobrać szkicu umowy');
    }
  };

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertData, setConvertData] = useState({
    description: '',
    mainBenefit: '',
    projectManager: {
      name: '',
      position: 'Senior Project Manager',
      email: '',
      phone: '',
      description: ''
    },
    modules: [{ name: '', description: '', color: 'blue' }],
    timeline: {
      phase1: { name: 'Faza I: Discovery', duration: 'Tydzień 1-2' },
      phase2: { name: 'Faza II: Design & Prototyp', duration: 'Tydzień 3-4' },
      phase3: { name: 'Faza III: Development', duration: 'Tydzień 5-12' },
      phase4: { name: 'Faza IV: Testy i Wdrożenie', duration: 'Tydzień 13-14' }
    },
    pricing: {
      phase1: 8000,
      phase2: 0,
      phase3: 56000,
      phase4: 8000
    },
    priceRange: { min: null, max: null },
    customReservations: [],
    customPaymentTerms: '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.'
  });

  const convertToFinalMutation = useMutation(
    (data) => projectsAPI.update(id, { ...data, offerType: 'final' }),
    {
      onSuccess: () => {
        toast.success('Oferta wstępna została przekształcona w standardową ofertę!');
        queryClient.invalidateQueries(['project', id]);
        queryClient.invalidateQueries('projects');
        setShowConvertModal(false);
      },
      onError: (error) => {
        toast.error('Błąd podczas przekształcania oferty');
      }
    }
  );

  useEffect(() => {
    if (project) {
      setFormData({
        ...project,
        technologies: project.technologies || {
          stack: [],
          methodologies: []
        }
      });
    }
  }, [project]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleModuleChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      modules: prev.modules.map((module, i) => 
        i === index ? { ...module, [field]: value } : module
      )
    }));
  };

  const addModule = () => {
    setFormData(prev => ({
      ...prev,
      modules: [...prev.modules, { name: '', description: '', color: 'blue' }]
    }));
  };

  const removeModule = (index) => {
    setFormData(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index)
    }));
  };

  const handlePricingChange = (phase, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [phase]: parseFloat(value) || 0
      }
    }));
  };

  const handleManagerChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      projectManager: {
        ...prev.projectManager,
        [field]: value
      }
    }));
  };

  const handleTimelineChange = (phase, field, value) => {
    setFormData(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        [phase]: {
          ...prev.timeline[phase],
          [field]: value
        }
      }
    }));
  };

  const handleReservationChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      customReservations: prev.customReservations.map((reservation, i) => 
        i === index ? value : reservation
      )
    }));
  };

  const handlePriceRangeChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [field]: value ? parseFloat(value) : null
      }
    }));
  };

  const handleConvertDataChange = (field, value) => {
    setConvertData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConvertManagerChange = (field, value) => {
    setConvertData(prev => ({
      ...prev,
      projectManager: {
        ...prev.projectManager,
        [field]: value
      }
    }));
  };

  const handleConvertPricingChange = (phase, value) => {
    setConvertData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [phase]: parseFloat(value) || 0
      }
    }));
  };

  const addReservation = () => {
    setFormData(prev => ({
      ...prev,
      customReservations: [...prev.customReservations, '']
    }));
  };

  const removeReservation = (index) => {
    setFormData(prev => ({
      ...prev,
      customReservations: prev.customReservations.filter((_, i) => i !== index)
    }));
  };

  const handleTechnologyChange = (type, index, value) => {
    setFormData(prev => ({
      ...prev,
      technologies: {
        ...prev.technologies,
        [type]: prev.technologies[type].map((tech, i) => 
          i === index ? value : tech
        )
      }
    }));
  };

  const addTechnology = (type) => {
    setFormData(prev => ({
      ...prev,
      technologies: {
        ...prev.technologies,
        [type]: [...(prev.technologies[type] || []), '']
      }
    }));
  };

  const removeTechnology = (type, index) => {
    setFormData(prev => ({
      ...prev,
      technologies: {
        ...prev.technologies,
        [type]: prev.technologies[type].filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Przygotuj dane w zależności od typu oferty
    let submitData;
    
    if (formData.offerType === 'preliminary') {
      // Dla ofert wstępnych wysyłamy tylko podstawowe dane
      submitData = {
        name: formData.name,
        clientName: formData.clientName,
        clientContact: formData.clientContact,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        offerType: formData.offerType,
        consultationNotes: formData.consultationNotes,
        status: formData.status,
        priority: formData.priority,
        // Domyślne wartości dla pól wymaganych przez model
        description: formData.consultationNotes || 'Konsultacja wstępna',
        mainBenefit: 'Analiza potrzeb klienta',
        projectManager: {
          name: 'Jakub Czajka',
          position: 'Senior Project Manager',
          email: 'jakub.czajka@soft-synergy.com',
          phone: '+48 793 868 886',
          description: 'Z ponad 8-letnim doświadczeniem w prowadzeniu złożonych projektów IT...'
        },
        modules: [{ name: 'Konsultacja', description: 'Analiza potrzeb i wymagań', color: 'blue' }],
        timeline: {
          phase1: { name: 'Konsultacja', duration: 'Tydzień 1' },
          phase2: { name: 'Analiza', duration: 'Tydzień 2' },
          phase3: { name: 'Prezentacja', duration: 'Tydzień 3' },
          phase4: { name: 'Finalizacja', duration: 'Tydzień 4' }
        },
        pricing: {
          phase1: 0,
          phase2: 0,
          phase3: 0,
          phase4: 0,
          total: 0
        },
        priceRange: { min: null, max: null },
        customReservations: [],
        customPaymentTerms: 'Do ustalenia po konsultacji'
      };
    } else {
      // Dla ofert finalnych wysyłamy wszystkie dane
      const totalPrice = formData.pricing.phase1 + formData.pricing.phase2 + formData.pricing.phase3 + formData.pricing.phase4;
      const validModules = formData.modules.filter(module => module.name && module.description);
      
      submitData = {
        ...formData,
        modules: validModules.length > 0 ? validModules : [{ name: 'Moduł przykładowy', description: 'Opis przykładowego modułu', color: 'blue' }],
        pricing: {
          ...formData.pricing,
          total: totalPrice
        },
        priceRange: {
          min: formData.priceRange.min || null,
          max: formData.priceRange.max || null
        }
      };
    }
    
    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleGenerateOffer = () => {
    generateOfferMutation.mutate(id);
  };

  const handleConvertToFinal = () => {
    // Ustaw domyślne wartości na podstawie notatek konsultacyjnych
    setConvertData(prev => ({
      ...prev,
      description: formData.consultationNotes || '',
      mainBenefit: 'Analiza potrzeb klienta',
      projectManager: {
        ...prev.projectManager,
        name: 'Jakub Czajka',
        email: 'jakub.czajka@soft-synergy.com',
        phone: '+48 793 868 886',
        description: 'Z ponad 8-letnim doświadczeniem w prowadzeniu złożonych projektów IT, wierzę w transparentną komunikację i partnerskie relacje. Moim zadaniem jest nie tylko nadzór nad harmonogramem, ale przede wszystkim zapewnienie, że finalny produkt w 100% odpowiada Państwa wizji i celom biznesowym. Będę Państwa głównym punktem kontaktowym na każdym etapie współpracy.'
      }
    }));
    setShowConvertModal(true);
  };

  const handleConvertSubmit = () => {
    const totalPrice = convertData.pricing.phase1 + convertData.pricing.phase2 + convertData.pricing.phase3 + convertData.pricing.phase4;
    const validModules = convertData.modules.filter(module => module.name && module.description);
    
    const submitData = {
      ...formData,
      ...convertData,
      offerType: 'final',
      modules: validModules.length > 0 ? validModules : [{ name: 'Moduł przykładowy', description: 'Opis przykładowego modułu', color: 'blue' }],
      pricing: {
        ...convertData.pricing,
        total: totalPrice
      }
    };
    
    convertToFinalMutation.mutate(submitData);
  };

  const totalPrice = formData.pricing.phase1 + formData.pricing.phase2 + formData.pricing.phase3 + formData.pricing.phase4;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edytuj projekt' : 'Nowy projekt'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEditing ? 'Zaktualizuj dane projektu' : 'Utwórz nowy projekt i ofertę'}
            </p>
          </div>
        </div>
        
        {isEditing && (
          <div className="flex space-x-2">
            {formData.offerType === 'preliminary' ? (
              <button
                onClick={handleConvertToFinal}
                disabled={convertToFinalMutation.isLoading}
                className="btn-primary flex items-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                Przekształć w standardową ofertę
              </button>
            ) : (
              <>
                <button
                  onClick={() => window.open(`/api/offers/preview/${id}?lang=${formData.language || 'pl'}`, '_blank')}
                  className="btn-secondary flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Podgląd
                </button>
                <button
                  onClick={handleGenerateOffer}
                  disabled={generateOfferMutation.isLoading}
                  className="btn-primary flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generuj ofertę
                </button>
              <button
                onClick={openContractEditor}
                disabled={generateContractMutation.isLoading}
                className="btn-secondary flex items-center"
                title="Wygeneruj umowę i ustaw status na zaakceptowany"
              >
                <FileText className="h-4 w-4 mr-2" />
                Wygeneruj umowę
              </button>
              </>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Informacje podstawowe</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label">Nazwa projektu *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Nazwa projektu"
              />
            </div>
            
            <div>
              <label className="form-label">Status</label>
              <select
                name="status"
                value={formData.status === 'accepted' ? 'accepted' : formData.status}
                onChange={(e) => {
                  // Prevent setting to accepted manually
                  const value = e.target.value === 'accepted' ? formData.status : e.target.value;
                  handleChange({ target: { name: 'status', value } });
                }}
                className="input-field"
              >
                <option value="draft">Szkic</option>
                <option value="active">Aktywny</option>
                {/* accepted removed from manual selection */}
                <option value="completed">Zakończony</option>
                <option value="cancelled">Anulowany</option>
                {formData.status === 'accepted' && (
                  <option value="accepted" disabled>Zaakceptowany (przez wygenerowanie umowy)</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">Status "Zaakceptowany" ustawia się automatycznie po wygenerowaniu umowy.</p>
            </div>
            <div>
              <label className="form-label">Priorytet</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input-field"
              >
                <option value="low">Niski</option>
                <option value="normal">Normalny</option>
                <option value="high">Wysoki</option>
                <option value="urgent">Pilny</option>
              </select>
            </div>
            <div>
              <label className="form-label">Typ oferty</label>
              <select
                name="offerType"
                value={formData.offerType}
                onChange={handleChange}
                className="input-field"
              >
                <option value="final">Oferta finalna</option>
                <option value="preliminary">Oferta wstępna / Konsultacja</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Oferta wstępna jest dla klientów w trakcie konsultacji
              </p>
            </div>

            <div>
              <label className="form-label">Język oferty</label>
              <select
                name="language"
                value={formData.language}
                onChange={handleChange}
                className="input-field"
              >
                <option value="pl">Polski</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Team members */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zespół projektowy</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label">Dodaj członka zespołu</label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    const userId = e.target.value;
                    if (!userId) return;
                    const selected = users?.find(u => u._id === userId);
                    if (!selected) return;
                    setFormData(prev => ({
                      ...prev,
                      teamMembers: Array.isArray(prev.teamMembers) ? [...prev.teamMembers, { user: selected._id, role: 'member' }] : [{ user: selected._id, role: 'member' }]
                    }));
                    e.target.value = '';
                  }}
                >
                  <option value="">Wybierz użytkownika</option>
                  {users?.map(u => (
                    <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {(formData.teamMembers || []).map((m, idx) => {
                const user = users?.find(u => u._id === (m.user?._id || m.user))
                return (
                  <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="text-sm">
                      <div className="font-medium">{user?.fullName || m.user?.fullName || 'Użytkownik'}</div>
                      <div className="text-gray-500">{user?.email || m.user?.email || ''}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        className="input-field"
                        value={m.role || 'member'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          teamMembers: prev.teamMembers.map((tm, i) => i === idx ? { ...tm, role: e.target.value } : tm)
                        }))}
                      >
                        <option value="member">Członek</option>
                        <option value="manager">Manager</option>
                        <option value="lead">Lead</option>
                      </select>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          teamMembers: prev.teamMembers.filter((_, i) => i !== idx)
                        }))}
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                );
              })}
              {(!formData.teamMembers || formData.teamMembers.length === 0) && (
                <p className="text-sm text-gray-500">Brak członków zespołu. Dodaj użytkowników powyżej.</p>
              )}
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Informacje o kliencie</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Nazwa firmy klienta *</label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Nazwa firmy"
              />
            </div>
            
            <div>
              <label className="form-label">Osoba kontaktowa *</label>
              <input
                type="text"
                name="clientContact"
                value={formData.clientContact}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Imię i nazwisko"
              />
            </div>
            
            <div>
              <label className="form-label">Email klienta *</label>
              <input
                type="email"
                name="clientEmail"
                value={formData.clientEmail}
                onChange={handleChange}
                className="input-field"
                placeholder="email@firma.pl"
              />
            </div>
            
            <div>
              <label className="form-label">Telefon klienta</label>
              <input
                type="tel"
                name="clientPhone"
                value={formData.clientPhone}
                onChange={handleChange}
                className="input-field"
                placeholder="+48 123 456 789"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="form-label">Link do projektu</label>
              <input
                type="url"
                name="projectLink"
                value={formData.projectLink}
                onChange={handleChange}
                className="input-field"
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Project Description or Consultation Notes */}
        {formData.offerType === 'preliminary' ? (
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Notatki z konsultacji</h2>
            <div>
              <label className="form-label">Notatki z rozmowy z klientem</label>
              <textarea
                name="consultationNotes"
                value={formData.consultationNotes}
                onChange={handleChange}
                rows={6}
                className="input-field"
                placeholder="Wprowadź notatki z konsultacji z klientem, jego potrzeby, oczekiwania, budżet, timeline itp..."
              />
              <p className="text-sm text-gray-500 mt-1">
                Te notatki będą pomocne przy przekształceniu konsultacji w standardową ofertę
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Opis projektu</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Główna korzyść biznesowa *</label>
                <input
                  type="text"
                  name="mainBenefit"
                  value={formData.mainBenefit}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="np. cyfryzację kluczowych procesów sprzedażowych"
                />
              </div>
              
              <div>
                <label className="form-label">Opis projektu *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="input-field"
                  placeholder="Szczegółowy opis projektu..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Modules - only for final offers */}
        {formData.offerType === 'final' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Moduły projektu</h2>
              <button
                type="button"
                onClick={addModule}
                className="btn-secondary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj moduł
              </button>
            </div>
          
          <div className="space-y-4">
            {formData.modules.map((module, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Moduł {index + 1}</h3>
                  {formData.modules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeModule(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="form-label">Nazwa modułu</label>
                    <input
                      type="text"
                      value={module.name}
                      onChange={(e) => handleModuleChange(index, 'name', e.target.value)}
                      className="input-field"
                      placeholder="np. Panel administracyjny"
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="form-label">Opis</label>
                    <input
                      type="text"
                      value={module.description}
                      onChange={(e) => handleModuleChange(index, 'description', e.target.value)}
                      className="input-field"
                      placeholder="Szczegółowy opis modułu..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Technologies - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Technologie i Metodologie</h2>
          <p className="text-sm text-gray-500 mb-4">
            Wypełnij technologie i metodologie używane w projekcie. Będą one wyświetlane w ofercie w sekcji "Technologie i Metodologie".
          </p>
          
          {/* Technology Stack */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="form-label">Stack Technologiczny</label>
              <button
                type="button"
                onClick={() => addTechnology('stack')}
                className="btn-secondary flex items-center text-sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                Dodaj technologię
              </button>
            </div>
            <div className="space-y-2">
              {(formData.technologies?.stack || []).map((tech, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tech}
                    onChange={(e) => handleTechnologyChange('stack', index, e.target.value)}
                    className="input-field flex-1"
                    placeholder="np. React, Node.js, MongoDB, TypeScript"
                  />
                  <button
                    type="button"
                    onClick={() => removeTechnology('stack', index)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(!formData.technologies?.stack || formData.technologies.stack.length === 0) && (
                <p className="text-sm text-gray-400 italic">Brak technologii. Kliknij "Dodaj technologię" aby dodać.</p>
              )}
            </div>
          </div>

          {/* Methodologies */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="form-label">Metodologie</label>
              <button
                type="button"
                onClick={() => addTechnology('methodologies')}
                className="btn-secondary flex items-center text-sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                Dodaj metodologię
              </button>
            </div>
            <div className="space-y-2">
              {(formData.technologies?.methodologies || []).map((methodology, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={methodology}
                    onChange={(e) => handleTechnologyChange('methodologies', index, e.target.value)}
                    className="input-field flex-1"
                    placeholder="np. Agile, Scrum, CI/CD, Test-Driven Development"
                  />
                  <button
                    type="button"
                    onClick={() => removeTechnology('methodologies', index)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(!formData.technologies?.methodologies || formData.technologies.methodologies.length === 0) && (
                <p className="text-sm text-gray-400 italic">Brak metodologii. Kliknij "Dodaj metodologię" aby dodać.</p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Timeline - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Harmonogram projektu</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Faza I: Nazwa</label>
                <input
                  type="text"
                  value={formData.timeline.phase1.name}
                  onChange={(e) => handleTimelineChange('phase1', 'name', e.target.value)}
                  className="input-field"
                  placeholder="Faza I: Discovery"
                />
              </div>
              <div>
                <label className="form-label">Faza I: Czas trwania</label>
                <input
                  type="text"
                  value={formData.timeline.phase1.duration}
                  onChange={(e) => handleTimelineChange('phase1', 'duration', e.target.value)}
                  className="input-field"
                  placeholder="Tydzień 1-2"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Faza II: Nazwa</label>
                <input
                  type="text"
                  value={formData.timeline.phase2.name}
                  onChange={(e) => handleTimelineChange('phase2', 'name', e.target.value)}
                  className="input-field"
                  placeholder="Faza II: Design & Prototyp"
                />
              </div>
              <div>
                <label className="form-label">Faza II: Czas trwania</label>
                <input
                  type="text"
                  value={formData.timeline.phase2.duration}
                  onChange={(e) => handleTimelineChange('phase2', 'duration', e.target.value)}
                  className="input-field"
                  placeholder="Tydzień 3-4"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Faza III: Nazwa</label>
                <input
                  type="text"
                  value={formData.timeline.phase3.name}
                  onChange={(e) => handleTimelineChange('phase3', 'name', e.target.value)}
                  className="input-field"
                  placeholder="Faza III: Development"
                />
              </div>
              <div>
                <label className="form-label">Faza III: Czas trwania</label>
                <input
                  type="text"
                  value={formData.timeline.phase3.duration}
                  onChange={(e) => handleTimelineChange('phase3', 'duration', e.target.value)}
                  className="input-field"
                  placeholder="Tydzień 5-12"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Faza IV: Nazwa</label>
                <input
                  type="text"
                  value={formData.timeline.phase4.name}
                  onChange={(e) => handleTimelineChange('phase4', 'name', e.target.value)}
                  className="input-field"
                  placeholder="Faza IV: Testy i Wdrożenie"
                />
              </div>
              <div>
                <label className="form-label">Faza IV: Czas trwania</label>
                <input
                  type="text"
                  value={formData.timeline.phase4.duration}
                  onChange={(e) => handleTimelineChange('phase4', 'duration', e.target.value)}
                  className="input-field"
                  placeholder="Tydzień 13-14"
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Project Manager - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Opiekun projektu</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Imię i nazwisko *</label>
              <input
                type="text"
                value={formData.projectManager.name}
                onChange={(e) => handleManagerChange('name', e.target.value)}
                required
                className="input-field"
                placeholder="Anna Kowalska"
              />
            </div>
            
            <div>
              <label className="form-label">Stanowisko</label>
              <input
                type="text"
                value={formData.projectManager.position}
                onChange={(e) => handleManagerChange('position', e.target.value)}
                className="input-field"
                placeholder="Senior Project Manager"
              />
            </div>
            
            <div>
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={formData.projectManager.email}
                onChange={(e) => handleManagerChange('email', e.target.value)}
                required
                className="input-field"
                placeholder="anna.kowalska@softsynergy.pl"
              />
            </div>
            
            <div>
              <label className="form-label">Telefon *</label>
              <input
                type="tel"
                value={formData.projectManager.phone}
                ownChange={(e) => handleManagerChange('phone', e.target.value)}
                required
                className="input-field"
                placeholder="+48 123 456 789"
              />
            </div>
          </div>
        </div>
        )}

        {/* Pricing - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Cennik</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="form-label">Faza I</label>
                <input
                  type="number"
                  value={formData.pricing.phase1}
                  onChange={(e) => handlePricingChange('phase1', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
              
              <div>
                <label className="form-label">Faza II</label>
                <input
                  type="number"
                  value={formData.pricing.phase2}
                  onChange={(e) => handlePricingChange('phase2', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
              
              <div>
                <label className="form-label">Faza III</label>
                <input
                  type="number"
                  value={formData.pricing.phase3}
                  onChange={(e) => handlePricingChange('phase3', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
              
              <div>
                <label className="form-label">Faza IV</label>
                <input
                  type="number"
                  value={formData.pricing.phase4}
                  onChange={(e) => handlePricingChange('phase4', e.target.value)}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-900">Razem (netto)</span>
                <span className="text-2xl font-bold text-primary-600">
                  {new Intl.NumberFormat('pl-PL', {
                    style: 'currency',
                    currency: 'PLN'
                  }).format(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Price Range - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Widełki cenowe</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Cena minimalna (PLN)</label>
                <input
                  type="number"
                  value={formData.priceRange.min || ''}
                  onChange={(e) => handlePriceRangeChange('min', e.target.value)}
                  className="input-field"
                  min="0"
                  placeholder="np. 45000"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Opcjonalnie - dla ofert z widełkami cenowymi
                </p>
              </div>
              
              <div>
                <label className="form-label">Cena maksymalna (PLN)</label>
                <input
                  type="number"
                  value={formData.priceRange.max || ''}
                  onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                  className="input-field"
                  min="0"
                  placeholder="np. 75000"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Opcjonalnie - dla ofert z widełkami cenowymi
                </p>
              </div>
            </div>
            
            {formData.priceRange.min && formData.priceRange.max && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Widełki cenowe</span>
                  <span className="text-xl font-bold text-blue-600">
                    {new Intl.NumberFormat('pl-PL', {
                      style: 'currency',
                      currency: 'PLN'
                    }).format(formData.priceRange.min)} - {new Intl.NumberFormat('pl-PL', {
                      style: 'currency',
                      currency: 'PLN'
                    }).format(formData.priceRange.max)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Oferta będzie wyświetlać widełki cenowe zamiast konkretnej kwoty
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Payment Terms - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Warunki płatności</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">Warunki płatności</label>
              <textarea
                name="customPaymentTerms"
                value={formData.customPaymentTerms}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Wprowadź warunki płatności..."
              />
              <p className="text-sm text-gray-500 mt-1">
                Możesz dostosować warunki płatności do konkretnego projektu (np. 3 transze, różne terminy, itp.)
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Custom Reservations - only for final offers */}
        {formData.offerType === 'final' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Dodatkowe zastrzeżenia</h2>
            <button
              type="button"
              onClick={addReservation}
              className="btn-secondary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zastrzeżenie
            </button>
          </div>
          
          <div className="space-y-4">
            {formData.customReservations.map((reservation, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={reservation}
                  onChange={(e) => handleReservationChange(index, e.target.value)}
                  className="input-field flex-1"
                  placeholder="Wprowadź dodatkowe zastrzeżenie..."
                />
                <button
                  type="button"
                  onClick={() => removeReservation(index)}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {formData.customReservations.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                Brak dodatkowych zastrzeżeń. Kliknij "Dodaj zastrzeżenie" aby dodać własne.
              </p>
            )}
          </div>
        </div>
        )}

        {/* Notes */}
        {isEditing && (
          <NotesSection projectId={id} />
        )}

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="btn-secondary"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={createMutation.isLoading || updateMutation.isLoading}
            className="btn-primary flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Zaktualizuj' : 'Utwórz'} projekt
          </button>
        </div>
      </form>

      {/* Modal konwersji do oferty finalnej */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Przekształć w standardową ofertę</h2>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Opis projektu */}
                <div>
                  <label className="form-label">Opis projektu *</label>
                  <textarea
                    value={convertData.description}
                    onChange={(e) => handleConvertDataChange('description', e.target.value)}
                    required
                    rows={4}
                    className="input-field"
                    placeholder="Szczegółowy opis projektu..."
                  />
                </div>

                {/* Główna korzyść */}
                <div>
                  <label className="form-label">Główna korzyść biznesowa *</label>
                  <input
                    type="text"
                    value={convertData.mainBenefit}
                    onChange={(e) => handleConvertDataChange('mainBenefit', e.target.value)}
                    required
                    className="input-field"
                    placeholder="np. cyfryzację kluczowych procesów sprzedażowych"
                  />
                </div>

                {/* Project Manager */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Imię i nazwisko *</label>
                    <input
                      type="text"
                      value={convertData.projectManager.name}
                      onChange={(e) => handleConvertManagerChange('name', e.target.value)}
                      required
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      value={convertData.projectManager.email}
                      onChange={(e) => handleConvertManagerChange('email', e.target.value)}
                      required
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">Telefon *</label>
                    <input
                      type="tel"
                      value={convertData.projectManager.phone}
                      onChange={(e) => handleConvertManagerChange('phone', e.target.value)}
                      required
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Cennik */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cennik</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="form-label">Faza I</label>
                      <input
                        type="number"
                        value={convertData.pricing.phase1}
                        onChange={(e) => handleConvertPricingChange('phase1', e.target.value)}
                        className="input-field"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Faza II</label>
                      <input
                        type="number"
                        value={convertData.pricing.phase2}
                        onChange={(e) => handleConvertPricingChange('phase2', e.target.value)}
                        className="input-field"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Faza III</label>
                      <input
                        type="number"
                        value={convertData.pricing.phase3}
                        onChange={(e) => handleConvertPricingChange('phase3', e.target.value)}
                        className="input-field"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Faza IV</label>
                      <input
                        type="number"
                        value={convertData.pricing.phase4}
                        onChange={(e) => handleConvertPricingChange('phase4', e.target.value)}
                        className="input-field"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-900">Razem (netto)</span>
                      <span className="text-xl font-bold text-primary-600">
                        {new Intl.NumberFormat('pl-PL', {
                          style: 'currency',
                          currency: 'PLN'
                        }).format(convertData.pricing.phase1 + convertData.pricing.phase2 + convertData.pricing.phase3 + convertData.pricing.phase4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Przyciski */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    onClick={() => setShowConvertModal(false)}
                    className="btn-secondary"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleConvertSubmit}
                    disabled={convertToFinalMutation.isLoading || !convertData.description || !convertData.mainBenefit || !convertData.projectManager.name || !convertData.projectManager.email || !convertData.projectManager.phone}
                    className="btn-primary"
                  >
                    {convertToFinalMutation.isLoading ? 'Przekształcam...' : 'Przekształć w ofertę finalną'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal edycji umowy przed generowaniem */}
      {showContractEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Edytuj treść umowy</h2>
                <button onClick={() => setShowContractEditor(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                rows={20}
                className="input-field w-full font-mono"
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button className="btn-secondary" onClick={() => setShowContractEditor(false)}>Anuluj</button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setShowContractEditor(false);
                    generateContractMutation.mutate({ projectId: id, customText: contractText });
                  }}
                >
                  Generuj PDF z tej treści
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectForm; 

// Notes section displayed only in edit mode
const NotesSection = ({ projectId }) => {
  const queryClient = useQueryClient();
  const { data: project } = useQuery(['project', projectId], () => projectsAPI.getById(projectId));
  const [noteText, setNoteText] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  const addNoteMutation = useMutation(({ id, text }) => projectsAPI.addNote(id, text), {
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Dodano notatkę');
    },
    onError: () => toast.error('Nie udało się dodać notatki')
  });

  const addFollowUpMutation = useMutation(({ id, note }) => projectsAPI.addFollowUp(id, note), {
    onSuccess: () => {
      setFollowUpNote('');
      queryClient.invalidateQueries(['project', projectId]);
      toast.success('Zapisano follow-up');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Nie udało się zapisać follow-upu')
  });

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteMutation.mutate({ id: projectId, text: noteText.trim() });
  };

  return (
    <div className="card">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Notatki</h2>
      <div className="space-y-3">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          className="input-field"
          placeholder="Dodaj nową notatkę..."
        />
        <div className="flex justify-end">
          <button type="button" onClick={handleAddNote} className="btn-primary" disabled={addNoteMutation.isLoading}>
            Dodaj notatkę
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Follow-up</h3>
          <div className="text-xs text-gray-500">
            {project?.followUps?.length || 0}/3 wysłane
            {project?.nextFollowUpDueAt && (
              <span className="ml-2">
                Następny termin: {new Date(project.nextFollowUpDueAt).toLocaleDateString('pl-PL')}
              </span>
            )}
          </div>
        </div>
        <textarea
          value={followUpNote}
          onChange={(e) => setFollowUpNote(e.target.value)}
          rows={3}
          className="input-field"
          placeholder="Dodaj notatkę do wysłanego follow-upu (wymagane)"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => followUpNote.trim() && addFollowUpMutation.mutate({ id: projectId, note: followUpNote.trim() })}
            className="btn-secondary flex items-center"
            disabled={addFollowUpMutation.isLoading || (project?.followUps?.length || 0) >= 3 || project?.status === 'accepted' || project?.status === 'cancelled'}
            title={(project?.followUps?.length || 0) >= 3 ? 'Wysłano już 3 follow-upy' : ''}
          >
            <Send className="h-4 w-4 mr-2" />
            Zapisz follow-up
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Historia notatek</h3>
        {project?.notes?.length ? (
          <ul className="space-y-3">
            {project.notes.map((n, idx) => (
              <li key={idx} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    {new Date(n.createdAt).toLocaleString('pl-PL')}
                  </span>
                  <span className="text-xs text-gray-600">
                    {n.author?.firstName || ''} {n.author?.lastName || ''}
                  </span>
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{n.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Brak notatek.</p>
        )}
      </div>

      {project?.followUps?.length ? (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Historia follow-upów</h3>
          <ul className="space-y-3">
            {project.followUps.map((f, idx) => (
              <li key={idx} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    #{f.number} • {new Date(f.sentAt).toLocaleString('pl-PL')}
                  </span>
                  <span className="text-xs text-gray-600">
                    {f.author?.firstName || ''} {f.author?.lastName || ''}
                  </span>
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{f.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};