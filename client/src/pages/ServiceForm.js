import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Save, ArrowLeft, Image } from 'lucide-react';
import { servicesAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const ServiceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    namePl: '',
    nameEn: '',
    descriptionPl: '',
    descriptionEn: '',
    category: 'development',
    image: null,
    priceMin: '',
    priceMax: '',
    priceLabelPl: '',
    priceLabelEn: '',
    isActive: true
  });
  const [imagePreview, setImagePreview] = useState(null);

  const { data: service, isLoading } = useQuery(
    ['service', id],
    () => servicesAPI.getById(id),
    { enabled: isEditing }
  );

  useEffect(() => {
    if (service) {
      setFormData({
        namePl: service.namePl || service.name || '',
        nameEn: service.nameEn || service.name || '',
        descriptionPl: service.descriptionPl || service.description || '',
        descriptionEn: service.descriptionEn || service.description || '',
        category: service.category || 'development',
        image: null,
        priceMin: service.priceMin != null ? String(service.priceMin) : '',
        priceMax: service.priceMax != null ? String(service.priceMax) : '',
        priceLabelPl: service.priceLabelPl || service.priceLabel || '',
        priceLabelEn: service.priceLabelEn || service.priceLabel || '',
        isActive: service.isActive !== false
      });
      if (service.image) {
        const url = service.image.startsWith('http')
          ? service.image
          : `${process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com'}${service.image.startsWith('/') ? service.image : '/' + service.image}`;
        setImagePreview(url);
      } else {
        setImagePreview(null);
      }
    }
  }, [service]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Plik jest zbyt duży. Maks. 10MB.');
        e.target.value = '';
        return;
      }
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        toast.error('Tylko JPG, PNG, WEBP.');
        e.target.value = '';
        return;
      }
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const createMutation = useMutation(servicesAPI.create, {
    onSuccess: () => {
      toast.success(t('services.created'));
      queryClient.invalidateQueries('services');
      navigate('/services');
    },
    onError: (err) => {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Przesyłanie trwa zbyt długo. Zmniejsz rozmiar pliku.');
      } else {
        toast.error(err.response?.data?.message || 'Błąd podczas tworzenia usługi.');
      }
    }
  });

  const updateMutation = useMutation(
    (data) => servicesAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success(t('services.updated'));
        queryClient.invalidateQueries('services');
        queryClient.invalidateQueries(['service', id]);
        navigate('/services');
      },
      onError: (err) => {
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          toast.error('Przesyłanie trwa zbyt długo.');
        } else {
          toast.error(err.response?.data?.message || 'Błąd podczas aktualizacji.');
        }
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasName = (formData.namePl && formData.namePl.trim().length >= 2) || (formData.nameEn && formData.nameEn.trim().length >= 2);
    const hasDesc = (formData.descriptionPl && formData.descriptionPl.trim().length >= 10) || (formData.descriptionEn && formData.descriptionEn.trim().length >= 10);
    if (!hasName) {
      toast.error(t('services.nameRequired'));
      return;
    }
    if (!hasDesc) {
      toast.error(t('services.descriptionRequired'));
      return;
    }

    const fd = new FormData();
    if (formData.namePl) fd.append('namePl', formData.namePl);
    if (formData.nameEn) fd.append('nameEn', formData.nameEn);
    if (formData.descriptionPl) fd.append('descriptionPl', formData.descriptionPl);
    if (formData.descriptionEn) fd.append('descriptionEn', formData.descriptionEn);
    fd.append('category', formData.category);
    fd.append('isActive', formData.isActive);
    if (formData.priceMin !== '') fd.append('priceMin', formData.priceMin);
    if (formData.priceMax !== '') fd.append('priceMax', formData.priceMax);
    if (formData.priceLabelPl) fd.append('priceLabelPl', formData.priceLabelPl);
    if (formData.priceLabelEn) fd.append('priceLabelEn', formData.priceLabelEn);
    if (formData.image) fd.append('image', formData.image);

    if (isEditing) {
      updateMutation.mutate(fd);
    } else {
      createMutation.mutate(fd);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/services')} className="p-2 text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? t('services.editService') : t('services.newService')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEditing ? (t('services.editService') + ' – ' + t('services.basicInfo')) : t('services.addService')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('services.basicInfo')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">{t('services.namePl')} *</label>
              <input
                type="text"
                name="namePl"
                value={formData.namePl}
                onChange={handleChange}
                className="input-field"
                placeholder="np. Aplikacja webowa"
              />
            </div>
            <div>
              <label className="form-label">{t('services.nameEn')} *</label>
              <input
                type="text"
                name="nameEn"
                value={formData.nameEn}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g. Web application"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
            <div>
              <label className="form-label">{t('services.descriptionPl')} *</label>
              <textarea
                name="descriptionPl"
                value={formData.descriptionPl}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Szczegółowy opis usługi..."
              />
            </div>
            <div>
              <label className="form-label">{t('services.descriptionEn')} *</label>
              <textarea
                name="descriptionEn"
                value={formData.descriptionEn}
                onChange={handleChange}
                rows={4}
                className="input-field"
                placeholder="Detailed service description..."
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">{t('services.category')} *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="input-field"
            >
              {['development', 'consulting', 'hosting', 'maintenance', 'other'].map((value) => (
                <option key={value} value={value}>{t(`services.categories.${value}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('services.priceRange')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label">Cena min (zł)</label>
              <input
                type="number"
                name="priceMin"
                value={formData.priceMin}
                onChange={handleChange}
                min="0"
                step="1"
                className="input-field"
                placeholder="np. 500"
              />
            </div>
            <div>
              <label className="form-label">Cena max (zł)</label>
              <input
                type="number"
                name="priceMax"
                value={formData.priceMax}
                onChange={handleChange}
                min="0"
                step="1"
                className="input-field"
                placeholder="np. 2000"
              />
            </div>
            <div>
              <label className="form-label">{t('services.priceLabelPl')}</label>
              <input
                type="text"
                name="priceLabelPl"
                value={formData.priceLabelPl}
                onChange={handleChange}
                className="input-field"
                placeholder="np. od 500 zł"
              />
            </div>
            <div>
              <label className="form-label">{t('services.priceLabelEn')}</label>
              <input
                type="text"
                name="priceLabelEn"
                value={formData.priceLabelEn}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g. from 500 PLN"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('services.serviceImage')}</h2>
          <div className="space-y-4">
            <label className="form-label">{t('services.serviceImage')} {!isEditing && '*'}</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
              <div className="space-y-1 text-center">
                <Image className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                    <span>Wybierz plik</span>
                    <input
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">lub przeciągnij i upuść</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, WEBP do 10MB</p>
              </div>
            </div>
            {imagePreview && (
              <div>
                <label className="form-label">Podgląd</label>
                <img
                  src={imagePreview}
                  alt="Podgląd"
                  className="mt-1 w-full h-48 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Status</h2>
          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              {t('services.serviceActive')}
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/services')} className="btn-secondary">
            {t('buttons.cancel')}
          </button>
          <button
            type="submit"
            disabled={createMutation.isLoading || updateMutation.isLoading}
            className="btn-primary flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? t('buttons.save') : t('buttons.add')} {t('services.title').toLowerCase()}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceForm;
