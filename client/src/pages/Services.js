import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  Code,
  MessageSquare,
  Server,
  Wrench,
  Settings,
  GripVertical
} from 'lucide-react';
import { servicesAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import toast from 'react-hot-toast';

const categoryIcons = {
  development: Code,
  consulting: MessageSquare,
  hosting: Server,
  maintenance: Wrench,
  other: Settings
};

const SortableServiceItem = ({
  item,
  index,
  handleDelete,
  handleToggleStatus,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  dragIndex,
  getCategoryLabel,
  t
}) => {
  const Icon = categoryIcons[item.category] || Settings;
  const isBeingDragged = isDragging && dragIndex === index;
  const imageUrl = item.image?.startsWith('http')
    ? item.image
    : `${process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com'}${item.image?.startsWith('/') ? item.image : '/' + (item.image || '')}`;

  const priceDisplay = () => {
    if (item.priceLabel) return item.priceLabel;
    if (item.priceMin != null && item.priceMax != null) return `${item.priceMin} – ${item.priceMax} zł`;
    if (item.priceMin != null) return `od ${item.priceMin} zł`;
    if (item.priceMax != null) return `do ${item.priceMax} zł`;
    return null;
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`card hover:shadow-md transition-all duration-200 cursor-move ${
        isBeingDragged ? 'opacity-50 scale-95 border-2 border-blue-500' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-2 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1">
          {item.image ? (
            <div className="mb-4">
              <img
                src={imageUrl}
                alt={item.name}
                className="w-full h-48 object-cover rounded-lg"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Brak+zdjęcia'; }}
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icon className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">{getCategoryLabel(item.category)}</span>
              </div>
              <button
                onClick={() => handleToggleStatus(item._id)}
                className={`text-xs px-2 py-1 rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
              >
                {item.isActive ? t('services.active') : t('services.inactive')}
              </button>
            </div>
            <h3 className="font-medium text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
            {priceDisplay() && (
              <div className="text-sm font-medium text-primary-600">{priceDisplay()}</div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                {t('services.createdBy')}: {item.createdBy?.firstName} {item.createdBy?.lastName}
              </span>
              <div className="flex items-center space-x-2">
                <Link to={`/services/${item._id}/edit`} className="p-1 text-gray-400 hover:text-blue-600" title={t('buttons.edit')}>
                  <Edit className="h-4 w-4" />
                </Link>
                <button onClick={() => handleDelete(item._id)} className="p-1 text-gray-400 hover:text-red-600" title={t('buttons.delete')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Services = () => {
  const { lang, t } = useI18n();
  const [filters, setFilters] = useState({ category: '', active: 'true' });
  const [items, setItems] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const queryClient = useQueryClient();
  const queryFilters = { ...filters, lang };
  const { data: services, isLoading } = useQuery(
    ['services', queryFilters],
    () => servicesAPI.getAll(queryFilters),
    { onSuccess: (data) => setItems(data || []) }
  );

  const getCategoryLabel = (cat) => t(`services.categories.${cat}`) || cat;

  const deleteMutation = useMutation(servicesAPI.delete, {
    onSuccess: () => {
      toast.success('Usługa została usunięta');
      queryClient.invalidateQueries('services');
    },
    onError: () => toast.error(t('services.deleteError'))
  });

  const toggleMutation = useMutation(servicesAPI.toggleStatus, {
    onSuccess: () => {
      toast.success('Status został zaktualizowany');
      queryClient.invalidateQueries('services');
    },
    onError: () => toast.error('Błąd podczas aktualizacji statusu')
  });

  const orderMutation = useMutation(servicesAPI.updateOrderBatch, {
    onSuccess: () => {
      toast.success('Kolejność usług zaktualizowana');
      queryClient.invalidateQueries('services');
    },
    onError: () => {
      toast.error('Błąd podczas aktualizacji kolejności');
      if (services) setItems([...services]);
    }
  });

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === index) return;
    const el = e.currentTarget;
    if (!el.classList.contains('drag-over')) {
      el.classList.add('drag-over');
      el.style.borderTop = '3px solid #3b82f6';
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.style.borderTop = '';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.style.borderTop = '';
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setIsDragging(false);
      setDraggedIndex(null);
      return;
    }
    const newItems = [...items];
    const [dragged] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, dragged);
    setItems(newItems);
    orderMutation.mutate(newItems.map((it, idx) => ({ id: it._id, order: idx })));
    setIsDragging(false);
    setDraggedIndex(null);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '';
    document.querySelectorAll('.drag-over').forEach((el) => {
      el.classList.remove('drag-over');
      el.style.borderTop = '';
    });
    setIsDragging(false);
    setDraggedIndex(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę usługę?')) deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{lang === 'pl' ? 'Zarządzaj oferowanymi usługami (zdjęcie, opis, zakres cenowy)' : 'Manage services (image, description, price range)'}</p>
        </div>
        <Link to="/services/new" className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          {t('services.addService')}
        </Link>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="form-label">{t('services.category')}</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field"
            >
              <option value="">{t('projects.allOption')} {t('services.category').toLowerCase()}</option>
              {['development', 'consulting', 'hosting', 'maintenance', 'other'].map((value) => (
                <option key={value} value={value}>{getCategoryLabel(value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">{t('projects.statusLabel')}</label>
            <select
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
              className="input-field"
            >
              <option value="true">{t('services.active')}</option>
              <option value="false">{t('services.inactive')}</option>
              <option value="">{t('projects.allOption')}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ category: '', active: 'true' })} className="btn-secondary w-full">
              {t('services.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <SortableServiceItem
            key={item._id}
            item={item}
            index={index}
            handleDelete={handleDelete}
            handleToggleStatus={(id) => toggleMutation.mutate(id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            isDragging={isDragging}
            dragIndex={draggedIndex}
            getCategoryLabel={getCategoryLabel}
            t={t}
          />
        ))}
      </div>

      {items?.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('services.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.category || filters.active !== 'true'
              ? (lang === 'pl' ? 'Zmień filtry lub dodaj pierwszą usługę.' : 'Change filters or add first service.')
              : (lang === 'pl' ? 'Dodaj pierwszą usługę (nazwa, opis, zdjęcie, zakres cenowy).' : 'Add first service (name, description, image, price range).')}
          </p>
          {!filters.category && filters.active === 'true' && (
            <div className="mt-6">
              <Link to="/services/new" className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                {t('services.addService')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Services;
