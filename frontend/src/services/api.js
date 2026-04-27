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
    const url = error.config?.url || '';

    if (error.response?.status === 401) {
      // Don't redirect for:
      //  • /auth/me       — AuthContext handles session expiry itself
      //  • /auth/verify-pin — LoginPage handles the PIN-step error in-place;
      //                       redirecting here wipes tempToken state and loops the user
      const skipRedirect = url.includes('/auth/me') || url.includes('/auth/verify-pin');
      if (!skipRedirect) {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        window.location.href = '/login';
        return Promise.reject(error); // stop processing — page is reloading
      }
    }

    const message = error.response?.data?.error || 'Something went wrong';
    // Don't show a toast for silent background calls
    const silentUrls = ['/auth/me', '/reschedules'];
    if (!silentUrls.some(s => url.includes(s))) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login:     (email, password)   => api.post('/auth/login', { email, password }),
  verifyPin: (temp_token, pin)   => api.post('/auth/verify-pin', { temp_token, pin }),
  me:        ()                  => api.get('/auth/me'),
};

// ── Leads ────────────────────────────────────────────────────
export const leadsApi = {
  getAll:       (params)         => api.get('/leads', { params }),
  getOne:       (id)             => api.get(`/leads/${id}`),
  create:       (data)           => api.post('/leads', data),
  update:       (id, data)       => api.patch(`/leads/${id}`, data),
  updateStatus: (id, status, note) => api.patch(`/leads/${id}/status`, { status, note }),
  assign:       (id, user_id)    => api.patch(`/leads/${id}/assign`, { user_id }),
  delete:       (id)             => api.delete(`/leads/${id}`),
  getStats:     ()               => api.get('/leads/stats'),
  getFollowUps: (id)             => api.get(`/leads/${id}/followups`),
  addFollowUp:  (id, data)       => api.post(`/leads/${id}/followups`, data),
  getActivity:    (id)             => api.get(`/leads/${id}/activity`),
  sendEmail:      (id, data)       => api.post(`/leads/${id}/send-email`, data),
  sendWhatsApp:   (id, data)       => api.post(`/leads/${id}/send-whatsapp`, data),
  setSlot:        (id, data)       => api.post(`/leads/${id}/set-slot`, data),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  getSummary:  () => api.get('/dashboard/summary'),
  getSchedule: () => api.get('/dashboard/schedule'),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  getAll:         ()         => api.get('/users'),
  create:         (data)     => api.post('/users', data),
  update:         (id, data) => api.patch(`/users/${id}`, data),
  toggle:         (id)       => api.patch(`/users/${id}/toggle`),
  getRoles:       ()         => api.get('/users/roles'),
  resetPassword:  (id)       => api.post(`/users/${id}/reset-password`),
  generatePin:    (id)       => api.post(`/users/${id}/generate-pin`),
  removePin:      (id)       => api.delete(`/users/${id}/pin`),
};

// ── Sources ───────────────────────────────────────────────────
export const sourcesApi = {
  getAll:        ()         => api.get('/sources'),
  create:        (data)     => api.post('/sources', data),
  update:        (id, data) => api.patch(`/sources/${id}`, data),
  delete:        (id)       => api.delete(`/sources/${id}`),
  sync:          (id)       => api.post(`/sources/${id}/sync`),
  test:          (id)       => api.post(`/sources/${id}/test`),
  regenerateKey: (id)       => api.post(`/sources/${id}/regenerate-key`),
  fetchColumns:  (config)   => api.post('/sources/fetch-columns', { config }),
};

// ── Settings ──────────────────────────────────────────────────
export const settingsApi = {
  getAll:    ()     => api.get('/settings'),
  save:      (data) => api.put('/settings', data),
  testEmail: (to)   => api.post('/settings/test-email', { to }),
};

// ── Email Templates ───────────────────────────────────────────
export const emailTemplatesApi = {
  getAll:       ()         => api.get('/settings/email-templates'),
  create:       (data)     => api.post('/settings/email-templates', data),
  update:       (id, data) => api.put(`/settings/email-templates/${id}`, data),
  delete:       (id)       => api.delete(`/settings/email-templates/${id}`),
  preview:      (id)       => api.get(`/settings/email-templates/${id}/preview`),
  getSourceMap: ()         => api.get('/settings/source-template-map'),
  setSourceMap: (data)     => api.put('/settings/source-template-map', data),
  sendToLead:   (data)     => api.post('/settings/send-template-email', data),
};

// ── Reminders ─────────────────────────────────────────────────
export const remindersApi = {
  getForLead: (leadId) => api.get(`/reminders/lead/${leadId}`),
  getUpcoming: () => api.get('/reminders/upcoming'),
};

// ── Meetings ───────────────────────────────────────────────────
export const meetingsApi = {
  start:          (id)       => api.post(`/meetings/${id}/start`),
  end:            (id, data) => api.post(`/meetings/${id}/end`, data),
  reschedule:     (id, data) => api.post(`/meetings/${id}/reschedule`, data),
  getReschedules: (id)       => api.get(`/meetings/${id}/reschedules`),
  checkSlot:      (params)   => api.get('/meetings/slots/check', { params }),
  getBookedSlots: (date, exclude_lead_id) => api.get('/meetings/slots/booked', { params: { date, exclude_lead_id } }),
};

export default api;
