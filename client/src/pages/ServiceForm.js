import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Save, ArrowLeft, Image } from 'lucide-react';
import { servicesAPI } from '../services/api';
import toast from 'react-hot-toast';

const categoryOptions = [
  { value: 'development', label: 'Rozwój' },
  { value: 'consulting', label: 'Konsultacje' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'maintenance', label: 'Utrzymanie' },
  { value: 'other', label: 'Inne' }
];

const ServiceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'development',
    image: null,
    priceMin: '',
    priceMax: '',
    priceLabel: '',
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
        name: service.name,
        description: service.description,
        category: service.category || 'development',
        image: null,
        priceMin: service.priceMin != null ? String(service.priceMin) : '',
        priceMax: service.priceMax != null ? String(service.priceMax) : '',
        priceLabel: service.priceLabel || '',
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
      toast.success('Usługa została utworzona.');
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
        toast.success('Usługa została zaktualizowana.');
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
    if (!formData.name.trim()) {
      toast.error('Nazwa usługi jest wymagana.');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Opis jest wymagany.');
      return;
    }
    // Zdjęcie opcjonalne – można dodać później przy edycji

    const fd = new FormData();
    fd.append('name', formData.name);
    fd.append('description', formData.description);
    fd.append('category', formData.category);
    fd.append('isActive', formData.isActive);
    if (formData.priceMin !== '') fd.append('priceMin', formData.priceMin);
    if (formData.priceMax !== '') fd.append('priceMax', formData.priceMax);
    if (formData.priceLabel) fd.append('priceLabel', formData.priceLabel);
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
              {isEditing ? 'Edytuj usługę' : 'Nowa usługa'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEditing ? 'Zaktualizuj dane usługi' : 'Dodaj usługę (zdjęcie, opis, zakres cenowy)'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Informacje podstawowe</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Nazwa usługi *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="np. Aplikacja webowa"
              />
            </div>
            <div>
              <label className="form-label">Kategoria *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="input-field"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">Opis *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              className="input-field"
              placeholder="Szczegółowy opis usługi..."
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zakres cenowy</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label">Cena minimalna (zł)</label>
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
              <label className="form-label">Cena maksymalna (zł)</label>
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
              <label className="form-label">Tekst ceny (np. „od 500 zł”)</label>
              <input
                type="text"
                name="priceLabel"
                value={formData.priceLabel}
                onChange={handleChange}
                className="input-field"
                placeholder="np. wycena indywidualna"
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Możesz podać min/max w zł lub dowolny tekst w polu „Tekst ceny”.
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zdjęcie usługi</h2>
          <div className="space-y-4">
            <label className="form-label">Wybierz zdjęcie {!isEditing && '*'}</label>
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
              Usługa aktywna (widoczna)
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/services')} className="btn-secondary">
            Anuluj
          </button>
          <button
            type="submit"
            disabled={createMutation.isLoading || updateMutation.isLoading}
            className="btn-primary flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Zaktualizuj' : 'Utwórz'} usługę
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceForm;
