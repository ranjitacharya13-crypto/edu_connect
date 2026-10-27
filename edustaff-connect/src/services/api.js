import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('edustaff_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Return to login when a protected request proves that the server-side
// session is no longer valid. Login's own 401 is left for the form to handle.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    if (error.response?.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/signup')) {
      localStorage.removeItem('edustaff_token')
      window.dispatchEvent(new Event('edustaff:session-expired'))
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  signup: (data) => api.post('/auth/signup', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout'),
}

export const adminApi = {
  metrics: () => api.get('/admin/metrics').then((r) => r.data),
  teachers: () => api.get('/admin/teachers').then((r) => r.data),
  databaseStatus: () => api.get('/admin/database/status').then((r) => r.data),
  databaseTest: (provider, databaseName) => api.post('/admin/database/test', { provider, databaseName }).then((r) => r.data),
  databaseSwitch: (provider, databaseName) => api.post('/admin/database/switch', { provider, databaseName }).then((r) => r.data),
  setupLocalDatabase: () => api.post('/admin/database/setup-local').then((r) => r.data),
  detectLocalDatabase: () => api.get('/admin/database/local-detection').then((r) => r.data),
  deleteTeacher: (id) => api.delete(`/admin/teachers/${id}`),
  assignContact: (contactId, teacherId) =>
    api.patch(`/admin/contacts/${contactId}/assignment`, { teacherId }).then((r) => r.data),
  assignContacts: (contactIds, teacherId) =>
    api.patch('/admin/contacts/bulk-assignment', { contactIds, teacherId }).then((r) => r.data),
}

// --- Contacts ---
export const contactsApi = {
  list: (search) =>
    api.get('/contacts', { params: typeof search === 'object' ? search : { search } }).then((r) => r.data),

  exportCsv: (params = {}) => api.get('/contacts/export', { params, responseType: 'blob' }).then((r) => r.data),

  create: (data) => api.post('/contacts', data).then((r) => r.data),

  update: (id, data) => api.patch(`/contacts/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/contacts/${id}`).then((r => r.status === 204)),
}

// --- Activities ---
export const activitiesApi = {
  list: () => api.get('/activities').then((r) => r.data),

  create: (data) => api.post('/activities', data).then((r) => r.data),

  update: (id, data) =>
    api.patch(`/activities/${id}`, data).then((r) => r.data),
}

// --- Calls (tracked call history + the notes attached to each call) ---
export const callsApi = {
  list: (params) => api.get('/calls', { params }).then((r) => r.data),

  // Called the moment the teacher taps the call button.
  start: (contactId) => api.post('/calls', { contactId }).then((r) => r.data),

  // Record the outcome: attended, missed, no-answer, busy, ...
  setStatus: (id, status, extra = {}) =>
    api.patch(`/calls/${id}`, { status, ...extra }).then((r) => r.data),

  notes: (id) => api.get(`/calls/${id}/notes`).then((r) => r.data),

  addNote: (id, summary) =>
    api.post(`/calls/${id}/notes`, { summary }).then((r) => r.data),

  remove: (id) => api.delete(`/calls/${id}`).then((r) => r.status === 204),
}

export const communicationsApi = {
  history: (contactId) => api.get(`/communications/contact/${contactId}`).then((r) => r.data),
  sendSms: (contactId, message, idempotencyKey) => api.post('/communications/sms', { contactId, message, idempotencyKey }).then((r) => r.data),
  startCall: (contactId, idempotencyKey) => api.post('/communications/call', { contactId, idempotencyKey }).then((r) => r.data),
  setCallOutcome: (id, outcome) => api.patch(`/communications/call/${id}`, { outcome }).then((r) => r.data),
}

export default api
