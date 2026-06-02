import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, Role } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, hasRole, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    // Redirect to default dashboard based on role
    const defaultDash: Record<Role, string> = {
      SUPER_ADMIN: "/dashboard/admin",
      GURU: "/dashboard/guru",
      SISWA: "/dashboard/siswa"
    };
    return <Navigate to={user ? defaultDash[user.role] : "/login"} replace />;
  }

  return <>{children}</>;
}
