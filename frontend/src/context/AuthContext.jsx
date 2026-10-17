import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Initialize auth state on load
  useEffect(() => {
    async function loadUser() {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.auth.me();
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Auth token verification failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (credentials) => {
    const res = await api.auth.login(credentials);
    if (res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      return userData;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await api.auth.register(userData);
    if (res.success && res.data) {
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(newUser);
      return newUser;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      if (token) {
        await api.auth.logout().catch(() => {});
      }
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const updateProfile = async (data) => {
    const res = await api.auth.updateProfile(data);
    if (res.success && res.data) {
      setUser((prev) => ({ ...prev, ...res.data }));
      return res.data;
    }
    throw new Error(res.message || 'Failed to update profile');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
