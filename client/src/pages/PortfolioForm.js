import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2,
  Image
} from 'lucide-react';
import { portfolioAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const PortfolioForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang, t } = useI18n();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    titlePl: '',
    titleEn: '',
    descriptionPl: '',
    descriptionEn: '',
    category: 'web',
    technologies: [''],
    client: '',
    duration: '',
    resultsPl: '',
    resultsEn: '',
    projectLink: '',
    apiLink: '',
    documentationLink: '',
    image: null,
    isActive: true
  });

  const [imagePreview, setImagePreview] = useState(null);

  const { data: portfolio, isLoading } = useQuery(
    ['portfolio', id],
    () => portfolioAPI.getById(id),
    { enabled: isEditing }
  );

  const createMutation = useMutation(portfolioAPI.create, {
    onSuccess: () => {
      toast.success(t('portfolio.created'));
      queryClient.invalidateQueries('portfolio');
      navigate('/portfolio');
    },
    onError: (error) => {
      console.error('Create portfolio error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Przesyłanie pliku trwa zbyt długo. Spróbuj ponownie lub zmniejsz rozmiar pliku.');
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        toast.error('Błąd połączenia z serwerem. Sprawdź połączenie internetowe.');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.message || 'Błąd podczas tworzenia elementu portfolio');
      }
    }
  });

  const updateMutation = useMutation(
    (data) => portfolioAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success(t('portfolio.updated'));
        queryClient.invalidateQueries('portfolio');
        queryClient.invalidateQueries(['portfolio', id]);
        navigate('/portfolio');
      },
      onError: (error) => {
        console.error('Update portfolio error:', error);
        console.error('Error response:', error.response);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          toast.error('Przesyłanie pliku trwa zbyt długo. Spróbuj ponownie lub zmniejsz rozmiar pliku.');
        } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
          toast.error('Błąd połączenia z serwerem. Sprawdź połączenie internetowe.');
        } else if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error(error.message || 'Błąd podczas aktualizacji elementu portfolio');
        }
      }
    }
  );

  useEffect(() => {
    if (portfolio) {
      setFormData({
        titlePl: portfolio.titlePl || portfolio.title || '',
        titleEn: portfolio.titleEn || portfolio.title || '',
        descriptionPl: portfolio.descriptionPl || portfolio.description || '',
        descriptionEn: portfolio.descriptionEn || portfolio.description || '',
        category: portfolio.category,
        technologies: portfolio.technologies && portfolio.technologies.length > 0 ? portfolio.technologies : [''],
        client: portfolio.client || '',
        duration: portfolio.duration || '',
        resultsPl: portfolio.resultsPl || portfolio.results || '',
        resultsEn: portfolio.resultsEn || portfolio.results || '',
        projectLink: portfolio.projectLink || '',
        apiLink: portfolio.apiLink || '',
        documentationLink: portfolio.documentationLink || '',
        image: null,
        isActive: portfolio.isActive
      });
      setImagePreview(portfolio.image?.startsWith('http') ? portfolio.image : `${process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com'}${portfolio.image?.startsWith('/') ? portfolio.image : '/' + portfolio.image}`);
    }
  }, [portfolio]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTechnologyChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.map((tech, i) => 
        i === index ? value : tech
      )
    }));
  };

  const addTechnology = () => {
    setFormData(prev => ({
      ...prev,
      technologies: [...prev.technologies, '']
    }));
  };

  const removeTechnology = (index) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.length > 1 
        ? prev.technologies.filter((_, i) => i !== index)
        : prev.technologies
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('Plik jest zbyt duży. Maksymalny rozmiar to 10MB.');
        e.target.value = ''; // Reset input
        return;
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tylko pliki obrazów (JPG, PNG, WEBP) są dozwolone.');
        e.target.value = ''; // Reset input
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        image: file
      }));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasTitle = (formData.titlePl && formData.titlePl.trim().length >= 3) || (formData.titleEn && formData.titleEn.trim().length >= 3);
    const hasDesc = (formData.descriptionPl && formData.descriptionPl.trim().length >= 10) || (formData.descriptionEn && formData.descriptionEn.trim().length >= 10);
    if (!hasTitle) {
      toast.error(lang === 'pl' ? 'Tytuł (PL lub EN) jest wymagany' : 'Title (PL or EN) is required');
      return;
    }
    if (!hasDesc) {
      toast.error(lang === 'pl' ? 'Opis (PL lub EN) jest wymagany' : 'Description (PL or EN) is required');
      return;
    }
    if (!formData.image && !isEditing) {
      toast.error(lang === 'pl' ? 'Zdjęcie jest wymagane' : 'Image is required');
      return;
    }
    const filteredTechnologies = formData.technologies.filter(tech => tech.trim() !== '');
    if (filteredTechnologies.length === 0) {
      toast.error(lang === 'pl' ? 'Dodaj przynajmniej jedną technologię' : 'Add at least one technology');
      return;
    }
    const submitData = new FormData();
    ['titlePl', 'titleEn', 'descriptionPl', 'descriptionEn', 'category', 'client', 'duration', 'resultsPl', 'resultsEn', 'projectLink', 'apiLink', 'documentationLink', 'isActive'].forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) submitData.append(key, formData[key]);
    });
    submitData.append('technologies', JSON.stringify(filteredTechnologies));
    if (formData.image) submitData.append('image', formData.image);

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/portfolio')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? t('portfolio.editItem') : t('portfolio.newItem')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEditing ? (lang === 'pl' ? 'Zaktualizuj dane projektu' : 'Update project data') : (lang === 'pl' ? 'Dodaj nowy projekt do portfolio' : 'Add new portfolio item')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('services.basicInfo')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">{t('portfolio.titlePl')} *</label>
              <input
                type="text"
                name="titlePl"
                value={formData.titlePl}
                onChange={handleChange}
                className="input-field"
                placeholder="Nazwa projektu"
              />
            </div>
            <div>
              <label className="form-label">{t('portfolio.titleEn')} *</label>
              <input
                type="text"
                name="titleEn"
                value={formData.titleEn}
                onChange={handleChange}
                className="input-field"
                placeholder="Project name"
              />
            </div>
            <div>
              <label className="form-label">{t('services.category')} *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="input-field"
              >
                {['web', 'mobile', 'desktop', 'api', 'other'].map((value) => (
                  <option key={value} value={value}>{t(`portfolio.categories.${value}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
            <div>
              <label className="form-label">{t('portfolio.descriptionPl')} *</label>
              <textarea
                name="descriptionPl"
                value={formData.descriptionPl}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Szczegółowy opis projektu..."
              />
            </div>
            <div>
              <label className="form-label">{t('portfolio.descriptionEn')} *</label>
              <textarea
                name="descriptionEn"
                value={formData.descriptionEn}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Detailed project description..."
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{lang === 'pl' ? 'Szczegóły projektu' : 'Project details'}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">{t('portfolio.client')}</label>
              <input
                type="text"
                name="client"
                value={formData.client}
                onChange={handleChange}
                className="input-field"
                placeholder={lang === 'pl' ? 'Nazwa klienta' : 'Client name'}
              />
            </div>
            <div>
              <label className="form-label">{t('portfolio.duration')}</label>
              <input
                type="text"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="input-field"
                placeholder={lang === 'pl' ? 'np. 3 miesiące' : 'e.g. 3 months'}
              />
            </div>
            <div>
              <label className="form-label">{t('portfolio.resultsPl')}</label>
              <input
                type="text"
                name="resultsPl"
                value={formData.resultsPl}
                onChange={handleChange}
                className="input-field"
                placeholder="np. Zwiększenie konwersji o 40%"
              />
            </div>
            <div>
              <label className="form-label">{t('portfolio.resultsEn')}</label>
              <input
                type="text"
                name="resultsEn"
                value={formData.resultsEn}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g. 40% conversion increase"
              />
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Linki</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
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
            
            <div>
              <label className="form-label">Link do API</label>
              <input
                type="url"
                name="apiLink"
                value={formData.apiLink}
                onChange={handleChange}
                className="input-field"
                placeholder="https://api.example.com/docs"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="form-label">Link do dokumentacji</label>
              <input
                type="url"
                name="documentationLink"
                value={formData.documentationLink}
                onChange={handleChange}
                className="input-field"
                placeholder="https://docs.example.com"
              />
            </div>
          </div>
        </div>

        {/* Technologies */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Technologie</h2>
            <button
              type="button"
              onClick={addTechnology}
              className="btn-secondary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj technologię
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.technologies.map((tech, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tech}
                  onChange={(e) => handleTechnologyChange(index, e.target.value)}
                  className="input-field flex-1"
                  placeholder="np. React, Node.js"
                />
                {formData.technologies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTechnology(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Image Upload */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zdjęcie projektu</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">
                Wybierz zdjęcie {!isEditing && '*'}
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Image className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="image-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                    >
                      <span>Wybierz plik</span>
                      <input
                        id="image-upload"
                        name="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="sr-only"
                        required={!isEditing}
                      />
                    </label>
                    <p className="pl-1">lub przeciągnij i upuść</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, WEBP do 10MB
                    {isEditing && imagePreview && (
                      <span className="block text-green-600">Obecne zdjęcie zostanie zachowane</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {imagePreview && (
              <div>
                <label className="form-label">Podgląd</label>
                <div className="mt-1">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Status</h2>
          <div className="flex items-center">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Projekt aktywny (widoczny w ofertach)
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/portfolio')}
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
    </div>
  );
};

export default PortfolioForm; 