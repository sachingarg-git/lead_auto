import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lms_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount.
  // We snapshot the token value at call time so we can detect whether the user
  // has already logged in with a NEW token before this async check finishes.
  useEffect(() => {
    const tokenAtMount = localStorage.getItem('lms_token');
    if (!tokenAtMount) { setUser(null); setLoading(false); return; }

    authApi.me()
      .then(res => setUser(res.data))
      .catch(() => {
        // Only clear the session if the token in storage hasn't been replaced
        // by a fresh login while this background check was running.
        if (localStorage.getItem('lms_token') === tokenAtMount) {
          localStorage.removeItem('lms_token');
          localStorage.removeItem('lms_user');
          setUser(null);
        }
        // If token changed (user already logged in fresh) → do nothing; the new
        // session is valid and we must not wipe it.
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Step 1: email + password login.
   * Returns one of:
   *   { done: true }              — logged in normally (no PIN)
   *   { requiresPin: true, tempToken, userName } — need PIN step
   */
  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const data = res.data;

    // 2FA PIN required
    if (data.requires_pin) {
      return { requiresPin: true, tempToken: data.temp_token, userName: data.user_name };
    }

    // Normal login
    localStorage.setItem('lms_token', data.token);
    localStorage.setItem('lms_user', JSON.stringify(data.user));
    setUser(data.user);
    return { done: true };
  }, []);

  /**
   * Step 2: verify the Green PIN.
   * On success, stores token and sets user session.
   */
  const verifyPin = useCallback(async (tempToken, pin) => {
    const res = await authApi.verifyPin(tempToken, pin);
    const data = res.data;
    localStorage.setItem('lms_token', data.token);
    localStorage.setItem('lms_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    setUser(null);
  }, []);

  const can = useCallback((permission) => {
    if (!user) return false;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  }, [user]);

  const isAdmin = user?.role_name === 'Admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyPin, logout, can, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
