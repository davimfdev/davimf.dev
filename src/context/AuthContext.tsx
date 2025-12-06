import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (accessToken: string) => void;
  logout: () => void;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [refreshTimeout, setRefreshTimeout] = useState<NodeJS.Timeout | null>(null);

  const scheduleRefresh = useCallback((accessToken: string) => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiry = payload.exp * 1000;
      const now = Date.now();
      const delay = expiry - now - 60000; // 1 minute before expiry

      if (delay > 0) {
        const timeout = setTimeout(refreshToken, delay);
        setRefreshTimeout(timeout);
      }
    } catch (error) {
      console.error("Failed to schedule token refresh:", error);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/refresh', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to refresh token.');
      }
      const { accessToken } = await response.json();
      login(accessToken);
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
    }
  }, []);

  const login = (accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('accessToken', accessToken);
    scheduleRefresh(accessToken);
  };

  const logout = useCallback(async () => {
    if (token) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Logout API call failed:", error);
        }
    }
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    setToken(null);
    localStorage.removeItem('accessToken');
  }, [token, refreshTimeout]);

  useEffect(() => {
    const initialToken = localStorage.getItem('accessToken');
    if (initialToken) {
      setToken(initialToken);
      scheduleRefresh(initialToken);
    }
    setIsAuthLoading(false);
  }, [scheduleRefresh]);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, token, login, logout, isAuthLoading }}>
      {children}
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
