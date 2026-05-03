import React from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  TrendingUp,
  Plus,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { projectsAPI, activityAPI, tasksAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfDay, endOfDay } from 'date-fns';

const TASK_STATUS_COLOR = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
};
const TASK_STATUS_LABEL = { todo: 'Do zrobienia', in_progress: 'W toku', review: 'Przegląd', done: 'Zrobione' };

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery('projectStats', projectsAPI.getStats);
  const { data: recent = [] } = useQuery('recentActivities', activityAPI.recent);
  const { t } = useI18n();
  const { user } = useAuth();

  const todayStart = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const todayEnd = format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  const { data: todayTasks = [] } = useQuery(
    ['tasks-today'],
    () => tasksAPI.getAll({ dateFrom: todayStart, dateTo: todayEnd, limit: 50 }),
    { staleTime: 60 * 1000 }
  );

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

      {/* Tasks for Today */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary-600" />
            Zadania na dziś
            {todayTasks.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-bold rounded-full">
                {todayTasks.length}
              </span>
            )}
          </h2>
          <Link to="/tasks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Wszystkie →
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
            <p className="text-sm font-medium text-gray-600">Brak zadań na dziś</p>
            <p className="text-xs text-gray-400 mt-1">Możesz dodać zadanie w zakładce Zadania</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks
              .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
              .map((task) => {
                const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate) < startOfDay(new Date());
                return (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => navigate('/tasks', { state: { openTaskId: task._id } })}
                    className={`w-full text-left card !p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-3 border-l-4 ${
                      task.status === 'done' ? 'border-green-400 opacity-70' : isOverdue ? 'border-red-400' : 'border-primary-400'
                    }`}
                  >
                    <div className="shrink-0">
                      {task.status === 'done'
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : isOverdue
                          ? <AlertCircle className="h-5 w-5 text-red-500" />
                          : <Clock className="h-5 w-5 text-primary-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.project?.name && (
                        <p className="text-xs text-gray-400 truncate">{task.project.name}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status] || 'bg-gray-100 text-gray-600'}`}>
                      {TASK_STATUS_LABEL[task.status] || task.status}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
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