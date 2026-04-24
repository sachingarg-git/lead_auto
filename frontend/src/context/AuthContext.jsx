import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lms_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('lms_token'); localStorage.removeItem('lms_user'); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('lms_token', res.data.token);
    localStorage.setItem('lms_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    setUser(null);
  }, []);

  // Permission check helper
  const can = useCallback((permission) => {
    if (!user) return false;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  }, [user]);

  const isAdmin = user?.role_name === 'Admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
