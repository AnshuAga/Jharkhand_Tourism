import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('jharkhand_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('jharkhand_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      if (token) {
        try {
          const res = await api.auth.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('jharkhand_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.warn('Session expired or invalid:', err.message);
          logout();
        }
      }
      setLoading(false);
    }
    verifySession();
  }, [token]);

  const login = async (email, password, role) => {
    const res = await api.auth.login({ email, password, role });
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('jharkhand_token', res.token);
      localStorage.setItem('jharkhand_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || 'Login failed.');
  };

  const register = async (data) => {
    const res = await api.auth.register(data);
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('jharkhand_token', res.token);
      localStorage.setItem('jharkhand_user', JSON.stringify(res.user));
      return res.user;
    }
    return res;
  };

  const verifyEmailOTP = async (email, otp, type = 'registration') => {
    const res = await api.auth.verifyEmailOTP({ email, otp, type });
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('jharkhand_token', res.token);
      localStorage.setItem('jharkhand_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res.message || 'Verification failed.');
  };

  const resendOTP = async (email, type = 'registration') => {
    return await api.auth.resendOTP({ email, type });
  };

  const requestLoginOTP = async (email) => {
    return await api.auth.requestLoginOTP({ email });
  };

  const quickDemoLogin = async (roleName) => {
    const demoCredentials = {
      tourist: { email: 'tourist@jharkhand.ai', password: 'tourist123' },
      vendor: { email: 'jharcraft.cooperative@jharkhand.ai', password: 'Cooperative@2026' },
      admin: { email: 'uhsna16@gmail.com', password: 'Admin@123' }
    };

    const creds = demoCredentials[roleName] || demoCredentials.tourist;
    return await login(creds.email, creds.password, roleName);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('jharkhand_token');
    localStorage.removeItem('jharkhand_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        loading,
        login,
        register,
        verifyEmailOTP,
        resendOTP,
        requestLoginOTP,
        quickDemoLogin,
        logout,
        isAuthenticated: !!user
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
