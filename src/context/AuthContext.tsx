import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (accessToken: string, isGoogleConnected: boolean) => void;
  logout: () => void;
  isAuthLoading: boolean;
  isGoogleConnected: boolean;
  setIsGoogleConnected: (status: boolean) => void;
  refreshToken: () => Promise<void>;
}

interface JwtPayload {
  userId: number;
  email: string;
  isGoogleConnected?: boolean;
  exp: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const login = useCallback((accessToken: string, googleStatus: boolean) => {
    setToken(accessToken);
    setIsGoogleConnected(googleStatus);
    localStorage.setItem('accessToken', accessToken);
  }, []);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem('accessToken');
    if (currentToken) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` },
      }).catch(error => console.error("Logout API call failed:", error));
    }
    setToken(null);
    setIsGoogleConnected(false);
    localStorage.removeItem('accessToken');
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/refresh', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      const { accessToken, isGoogleConnected: googleStatus } = await response.json();
      login(accessToken, googleStatus);
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
    }
  }, [login, logout]);

  // Efeito de carregamento inicial - Roda apenas uma vez
  useEffect(() => {
    const initialToken = localStorage.getItem('accessToken');
    if (initialToken) {
      try {
        const payload: JwtPayload = jwtDecode(initialToken);
        if (payload.exp * 1000 > Date.now()) {
          setToken(initialToken);
          setIsGoogleConnected(payload.isGoogleConnected || false);
        } else {
          // Token expirado
          localStorage.removeItem('accessToken');
        }
      } catch (error) {
        // Token inválido
        localStorage.removeItem('accessToken');
      }
    }
    setIsAuthLoading(false);
  }, []);

  // Efeito para verificar o token periodicamente de forma segura
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      try {
        const payload: JwtPayload = jwtDecode(token);
        // Se o token expirar em menos de 2 minutos, atualize-o
        if (payload.exp * 1000 - Date.now() < 2 * 60 * 1000) {
          refreshToken();
        }
      } catch {
        logout();
      }
    }, 60 * 1000); // Verifica a cada minuto

    return () => clearInterval(interval);
  }, [token, refreshToken, logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, token, login, logout, isAuthLoading, isGoogleConnected, setIsGoogleConnected, refreshToken }}>
      {isAuthLoading ? null : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
