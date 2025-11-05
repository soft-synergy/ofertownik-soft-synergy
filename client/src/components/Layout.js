import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Briefcase, 
  Users, 
  Activity,
  Server,
  LogOut
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/projects', label: 'Projekty', icon: FolderOpen },
    { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
    { path: '/activity', label: 'Aktywność', icon: Activity },
  ];

  // Add admin-only items
  if (user?.role === 'admin') {
    navItems.push(
      { path: '/employees', label: 'Pracownicy', icon: Users },
      { path: '/hosting', label: 'Hosting', icon: Server }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Ofertownik</h1>
          <p className="text-sm text-gray-500 mt-1">Soft Synergy</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-gray-500">{user?.email}</div>
            <div className="text-xs text-gray-400 mt-1 capitalize">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Wyloguj
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;