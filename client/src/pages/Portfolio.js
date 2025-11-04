import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Image as ImageIcon,
  Globe,
  Smartphone,
  Monitor,
  Code,
  Settings
} from 'lucide-react';
import { portfolioAPI } from '../services/api';
import toast from 'react-hot-toast';

const Portfolio = () => {
  const [filters, setFilters] = useState({
    category: '',
    active: 'true'
  });

  const queryClient = useQueryClient();

  const { data: portfolio, isLoading } = useQuery(
    ['portfolio', filters],
    () => portfolioAPI.getAll(filters)
  );

  const deleteMutation = useMutation(portfolioAPI.delete, {
    onSuccess: () => {
      toast.success('Element portfolio został usunięty');
      queryClient.invalidateQueries('portfolio');
    },
    onError: (error) => {
      toast.error('Błąd podczas usuwania elementu portfolio');
    }
  });

  const toggleStatusMutation = useMutation(portfolioAPI.toggleStatus, {
    onSuccess: () => {
      toast.success('Status został zaktualizowany');
      queryClient.invalidateQueries('portfolio');
    },
    onError: (error) => {
      toast.error('Błąd podczas aktualizacji statusu');
    }
  });

  const getCategoryIcon = (category) => {
    const icons = {
      web: Globe,
      mobile: Smartphone,
      desktop: Monitor,
      api: Code,
      other: Settings
    };
    return icons[category] || Settings;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      web: 'Aplikacja webowa',
      mobile: 'Aplikacja mobilna',
      desktop: 'Aplikacja desktopowa',
      api: 'API / Backend',
      other: 'Inne'
    };
    return labels[category] || 'Inne';
  };

  const handleDelete = (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten element portfolio?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (id) => {
    toggleStatusMutation.mutate(id);
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
          <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj projektami referencyjnymi
          </p>
        </div>
        <Link
          to="/portfolio/new"
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj projekt
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="form-label">Kategoria</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field"
            >
              <option value="">Wszystkie kategorie</option>
              <option value="web">Aplikacja webowa</option>
              <option value="mobile">Aplikacja mobilna</option>
              <option value="desktop">Aplikacja desktopowa</option>
              <option value="api">API / Backend</option>
              <option value="other">Inne</option>
            </select>
          </div>
          
          <div>
            <label className="form-label">Status</label>
            <select
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
              className="input-field"
            >
              <option value="true">Aktywne</option>
              <option value="false">Nieaktywne</option>
              <option value="">Wszystkie</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ category: '', active: 'true' })}
              className="btn-secondary w-full"
            >
              Wyczyść filtry
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {portfolio?.map((item) => {
          const CategoryIcon = getCategoryIcon(item.category);
          return (
            <div key={item._id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="aspect-w-16 aspect-h-9 mb-4">
                <img
                  src={item.image?.startsWith('http') ? item.image : `${process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com'}${item.image?.startsWith('/') ? item.image : '/' + item.image}`}
                  alt={item.title}
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                  }}
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CategoryIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(item._id)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {item.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </button>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
                
                {item.client && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Klient:</span> {item.client}
                  </div>
                )}
                
                {item.duration && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Czas realizacji:</span> {item.duration}
                  </div>
                )}
                
                {item.results && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Wyniki:</span> {item.results}
                  </div>
                )}
                
                {item.technologies && item.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.technologies.map((tech, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Utworzył: {item.createdBy?.firstName} {item.createdBy?.lastName}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/portfolio/${item._id}/edit`}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edytuj"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {portfolio?.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Brak projektów portfolio</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.category || filters.active !== 'true'
              ? 'Spróbuj zmienić filtry wyszukiwania.'
              : 'Rozpocznij od dodania pierwszego projektu do portfolio.'
            }
          </p>
          {!filters.category && filters.active === 'true' && (
            <div className="mt-6">
              <Link to="/portfolio/new" className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj projekt
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Portfolio; 