import React from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Landing from '../pages/Landing';

const AuthLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  // If on root path and not authenticated, show Landing (don't render Outlet)
  if (location.pathname === '/' && !user) {
    return <Landing />;
  }

  // If on root path and authenticated, redirect to dashboard
  if (location.pathname === '/' && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // For all other paths, render Outlet (children will be protected routes with Layout)
  return <Outlet />;
};

export default AuthLayout;

