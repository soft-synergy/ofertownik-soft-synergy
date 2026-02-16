import React from 'react';
import { useQuery } from 'react-query';
import { activityAPI } from '../services/api';

const Activity = () => {
  const { data: items = [], isLoading } = useQuery('recentActivities', activityAPI.recent);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aktywność</h1>
        <p className="mt-1 text-sm text-gray-500">Ostatnie działania w systemie (admin)</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcja</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Szczegóły</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((a) => (
              <tr key={a._id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{new Date(a.createdAt).toLocaleString('pl-PL')}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{a.author?.firstName} {a.author?.lastName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{a.action}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{a.message}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Brak aktywności.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Activity;


