import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FolderOpen,
  Briefcase,
  Users,
  Activity,
  Server,
  LogOut,
  CheckSquare,
  Wrench,
  FileCheck,
  FileText,
  MessageCircle,
  Menu,
  X
} from 'lucide-react';
import SearchCommandPalette from './SearchCommandPalette';

const Layout = () => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Swipe gestures for sidebar
  useEffect(() => {
    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      // Only horizontal swipes (not diagonal scrolling)
      if (dy > 60) { touchStartX.current = null; return; }
      // Swipe right from left edge → open
      if (!sidebarOpen && touchStartX.current < 30 && dx > 60) setSidebarOpen(true);
      // Swipe left anywhere on screen when open → close
      if (sidebarOpen && dx < -60) setSidebarOpen(false);
      touchStartX.current = null;
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/projects', label: t('nav.projects'), icon: FolderOpen },
    { path: '/leads', label: 'Leady', icon: Users },
    { path: '/tasks', label: 'Zadania', icon: CheckSquare },
    { path: '/portfolio', label: t('nav.portfolio'), icon: Briefcase },
    { path: '/services', label: t('nav.services'), icon: Wrench },
    { path: '/activity', label: 'Aktywność', icon: Activity },
    { path: '/dokumenty', label: 'Dokumenty i playbooki', icon: FileText },
    { path: '/opinie', label: 'Opinie', icon: MessageCircle },
  ];

  if (user?.role === 'admin') {
    navItems.push(
      { path: '/employees', label: t('nav.employees'), icon: Users },
      { path: '/hosting', label: t('nav.hosting'), icon: Server },
      { path: '/zlecenia-publiczne', label: 'Zlecenia publiczne', icon: FileCheck }
    );
  }

  if (user?.role === 'admin' || user?.role === 'employee') {
    navItems.push(
      { path: '/clients', label: 'Klienci', icon: Users }
    );
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('common.appName')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Soft Synergy</p>
          </div>
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setSearchOpen(true); setSidebarOpen(false); }}
          className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <span className="opacity-70">Szukaj...</span>
          <kbd className="ml-auto text-xs font-mono bg-white px-1.5 py-0.5 rounded hidden lg:block">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="h-5 w-5 mr-3 shrink-0" />
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
          <div className="text-xs text-gray-400 mt-0.5 capitalize">{user?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <LogOut className="h-5 w-5 mr-3" />
          {t('nav.logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex-col z-30">
        <SidebarContent />
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white flex flex-col z-50 shadow-2xl transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>

      <SearchCommandPalette open={searchOpen} onClose={setSearchOpen} />

      {/* Main Content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">{t('common.appName')}</h1>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
