import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  FolderOpen, 
  TrendingUp, 
  Plus,
  Eye,
  FileText,
  Calendar,
  DollarSign
} from 'lucide-react';
import { projectsAPI, activityAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery('projectStats', projectsAPI.getStats);
  const { data: recent = [] } = useQuery('recentActivities', activityAPI.recent);
  const { t } = useI18n();
  const { user } = useAuth();

  const cards = [
    {
      name: t('dashboard.allProjects'),
      value: stats?.totalProjects || 0,
      icon: FolderOpen,
      color: 'bg-blue-500',
    },
    {
      name: t('dashboard.activeProjects'),
      value: stats?.stats?.find(s => s._id === 'active')?.count || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      name: t('dashboard.projectsValue'),
      value: `${((stats?.totalValue || 0) / 1000).toFixed(0)}k PLN`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      name: t('dashboard.offersGenerated'),
      value: stats?.stats?.find(s => s._id === 'completed')?.count || 0,
      icon: FileText,
      color: 'bg-orange-500',
    },
  ];

  const quickActions = [
    {
      name: t('dashboard.actionNew'),
      description: t('dashboard.actionNewDesc'),
      href: '/projects/new',
      icon: Plus,
      color: 'bg-primary-600',
    },
    {
      name: t('dashboard.actionBrowse'),
      description: t('dashboard.actionBrowseDesc'),
      href: '/projects',
      icon: Eye,
      color: 'bg-blue-600',
    },
    {
      name: t('dashboard.actionPortfolio'),
      description: t('dashboard.actionPortfolioDesc'),
      href: '/portfolio',
      icon: FolderOpen,
      color: 'bg-green-600',
    },
  ];

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.header')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.subheader')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="card">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-md ${card.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {card.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {card.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                className="card hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center">
                  <div className={`flex-shrink-0 p-3 rounded-md ${action.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      {action.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {user?.role === 'admin' && (
      <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.recentActivity')}</h2>
        <div className="card">
          <div className="space-y-4">
              {recent.length === 0 && (
                <div className="text-sm text-gray-500">No activity yet.</div>
              )}
              {recent.map((a) => (
                <div key={a._id} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary-600" />
                  </div>
                </div>
                <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{a.message}</p>
                      <p className="text-sm text-gray-500">{a.author?.firstName} {a.author?.lastName}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{new Date(a.createdAt).toLocaleString('pl-PL')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 