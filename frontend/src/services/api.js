import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_user');
      window.location.href = '/login';
    }
    const message = error.response?.data?.error || 'Something went wrong';
    toast.error(message);
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// ── Leads ────────────────────────────────────────────────────
export const leadsApi = {
  getAll: (params) => api.get('/leads', { params }),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.patch(`/leads/${id}`, data),
  updateStatus: (id, status, note) => api.patch(`/leads/${id}/status`, { status, note }),
  delete: (id) => api.delete(`/leads/${id}`),
  getStats: () => api.get('/leads/stats'),
  getFollowUps: (id) => api.get(`/leads/${id}/followups`),
  addFollowUp: (id, data) => api.post(`/leads/${id}/followups`, data),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  toggle: (id) => api.patch(`/users/${id}/toggle`),
  getRoles: () => api.get('/users/roles'),
};

// ── Sources ───────────────────────────────────────────────────
export const sourcesApi = {
  getAll: () => api.get('/sources'),
  create: (data) => api.post('/sources', data),
  update: (id, data) => api.patch(`/sources/${id}`, data),
  delete: (id) => api.delete(`/sources/${id}`),
  sync: (id) => api.post(`/sources/${id}/sync`),
  regenerateKey: (id) => api.post(`/sources/${id}/regenerate-key`),
};

// ── Settings ──────────────────────────────────────────────────
export const settingsApi = {
  getAll:    ()     => api.get('/settings'),
  save:      (data) => api.put('/settings', data),
  testEmail: (to)   => api.post('/settings/test-email', { to }),
};

// ── Reminders ─────────────────────────────────────────────────
export const remindersApi = {
  getForLead: (leadId) => api.get(`/reminders/lead/${leadId}`),
  getUpcoming: () => api.get('/reminders/upcoming'),
};

export default api;
