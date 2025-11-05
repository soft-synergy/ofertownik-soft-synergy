import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import Login from './pages/Login';
import AdminApp from './pages/AdminApp.jsx';
import EmployeeApp from './pages/EmployeeApp.jsx';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import ProjectDetail from './pages/ProjectDetail';
import Portfolio from './pages/Portfolio';
import PortfolioForm from './pages/PortfolioForm';
import Employees from './pages/Employees';
import Activity from './pages/Activity';
import Hosting from './pages/Hosting';
import Clients from './pages/Clients';
import ClientPortal from './pages/ClientPortal';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/client/:token" element={<ClientPortal />} />
      <Route path="/admin" element={<AdminApp />} />
      <Route path="/employee" element={<EmployeeApp />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/edit" element={<ProjectForm />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="portfolio/new" element={<PortfolioForm />} />
        <Route path="portfolio/:id/edit" element={<PortfolioForm />} />
        <Route path="employees" element={<Employees />} />
        <Route path="activity" element={<Activity />} />
        <Route path="hosting" element={<Hosting />} />
        <Route path="clients" element={<Clients />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </AuthProvider>
  );
}

export default App; 