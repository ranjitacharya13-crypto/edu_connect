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

export const authApi = {
  signup: (data) => api.post('/auth/signup', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout'),
}

export const adminApi = {
  metrics: () => api.get('/admin/metrics').then((r) => r.data),
  teachers: () => api.get('/admin/teachers').then((r) => r.data),
  deleteTeacher: (id) => api.delete(`/admin/teachers/${id}`),
  assignContact: (contactId, teacherId) =>
    api.patch(`/admin/contacts/${contactId}/assignment`, { teacherId }).then((r) => r.data),
}

// --- Contacts ---
export const contactsApi = {
  list: (search) =>
    api.get('/contacts', { params: { search } }).then((r) => r.data),

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

export default api
