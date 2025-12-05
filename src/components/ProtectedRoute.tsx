import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth(); // Pega o novo estado
  const location = useLocation();

  if (isAuthLoading) {
    // Enquanto estiver carregando, não faz nada (ou mostra um spinner)
    return null; 
  }

  if (!isAuthenticated) {
    // Se não estiver autenticado após o carregamento, redireciona
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado, renderiza o componente filho
  return children;
};

export default ProtectedRoute;
