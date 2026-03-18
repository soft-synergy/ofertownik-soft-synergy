import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com',
  timeout: 300000, // 5 minutes default timeout (increased for file uploads)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData, let browser handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me').then(res => res.data),
  register: (userData) => api.post('/api/auth/register', userData),
  listUsers: () => api.get('/api/auth/users').then(res => res.data),
  deleteUser: (id) => api.delete(`/api/auth/users/${id}`).then(res => res.data),
  updateSettings: (updates) => api.patch('/api/auth/me/settings', updates).then(res => res.data),
};

export const projectsAPI = {
  getAll: (params) => api.get('/api/projects', { params }).then(res => res.data),
  getById: (id) => api.get(`/api/projects/${id}`).then(res => res.data),
  create: (data) => api.post('/api/projects', data).then(res => res.data),
  update: (id, data) => api.put(`/api/projects/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/projects/${id}`).then(res => res.data),
  getStats: () => api.get('/api/projects/stats/overview').then(res => res.data),
  addNote: (id, text) => api.post(`/api/projects/${id}/notes`, { text }).then(res => res.data),
  addFollowUp: (id, note) => api.post(`/api/projects/${id}/followups`, { note }).then(res => res.data),
  assignOwner: (id, ownerId) => api.post(`/api/projects/${id}/assign`, { ownerId }).then(res => res.data),
  requestFinalEstimation: (id) => api.post(`/api/projects/${id}/request-final-estimation`).then(res => res.data),
  requestClarification: (id, clarificationText) => api.post(`/api/projects/${id}/request-clarification`, { clarificationText }).then(res => res.data),
  submitClarificationResponse: (id, responseText) => api.post(`/api/projects/${id}/clarification-response`, { responseText }).then(res => res.data),
  submitFinalEstimate: (id, total) => api.post(`/api/projects/${id}/submit-final-estimate`, { total }).then(res => res.data),
};

export const portfolioAPI = {
  getAll: (params) => api.get('/api/portfolio', { params }).then(res => res.data),
  getById: (id, params) => api.get(`/api/portfolio/${id}`, { params }).then(res => res.data),
  create: (data) => {
    // If data is FormData, let browser set the Content-Type header automatically
    // Increase timeout and maxContentLength for file uploads
    if (data instanceof FormData) {
      // Create a new axios instance with extended timeout for file uploads
      const uploadAxios = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com',
        timeout: 300000, // 5 minutes for large file uploads
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      
      // Add auth token to upload requests
      uploadAxios.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Remove Content-Type for FormData to let browser set it with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        return config;
      });
      
      return uploadAxios.post('/api/portfolio', data).then(res => res.data);
    }
    return api.post('/api/portfolio', data).then(res => res.data);
  },
  update: (id, data) => {
    // If data is FormData, let browser set the Content-Type header automatically
    // Increase timeout and maxContentLength for file uploads
    if (data instanceof FormData) {
      // Create a new axios instance with extended timeout for file uploads
      const uploadAxios = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com',
        timeout: 300000, // 5 minutes for large file uploads
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      
      // Add auth token to upload requests
      uploadAxios.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Remove Content-Type for FormData to let browser set it with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        return config;
      });
      
      return uploadAxios.put(`/api/portfolio/${id}`, data).then(res => res.data);
    }
    return api.put(`/api/portfolio/${id}`, data).then(res => res.data);
  },
  delete: (id) => api.delete(`/api/portfolio/${id}`).then(res => res.data),
  updateOrder: (id, order) => api.put(`/api/portfolio/${id}/order`, { order }).then(res => res.data),
  updateOrderBatch: (updates) => api.put('/api/portfolio/order/batch', { updates }).then(res => res.data),
  toggleStatus: (id) => api.patch(`/api/portfolio/${id}/toggle`).then(res => res.data),
};

const uploadAxiosConfig = () => ({
  baseURL: process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com',
  timeout: 300000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});
const uploadAxiosInterceptors = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.data instanceof FormData) delete config.headers['Content-Type'];
    return config;
  });
};

export const servicesAPI = {
  getAll: (params) => api.get('/api/services', { params }).then(res => res.data),
  getById: (id, params) => api.get(`/api/services/${id}`, { params }).then(res => res.data),
  create: (data) => {
    if (data instanceof FormData) {
      const instance = axios.create(uploadAxiosConfig());
      uploadAxiosInterceptors(instance);
      return instance.post('/api/services', data).then(res => res.data);
    }
    return api.post('/api/services', data).then(res => res.data);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      const instance = axios.create(uploadAxiosConfig());
      uploadAxiosInterceptors(instance);
      return instance.put(`/api/services/${id}`, data).then(res => res.data);
    }
    return api.put(`/api/services/${id}`, data).then(res => res.data);
  },
  delete: (id) => api.delete(`/api/services/${id}`).then(res => res.data),
  updateOrderBatch: (updates) => api.put('/api/services/order/batch', { updates }).then(res => res.data),
  toggleStatus: (id) => api.patch(`/api/services/${id}/toggle`).then(res => res.data),
  getDocumentation: () => api.get('/api/services/documentation').then(res => res.data),
};

export const offersAPI = {
  generate: (projectId) => api.post(`/api/offers/generate/${projectId}`).then(res => res.data),
  generatePdf: (projectId, projectData) => api.post(`/api/offers/generate-pdf-simple`, projectData).then(res => res.data),
  preview: (projectId) => api.get(`/api/offers/preview/${projectId}`).then(res => res.data),
  getContractDraft: (projectId) => api.get(`/api/offers/contract-draft/${projectId}`).then(res => res.data),
  generateContract: (projectId, customText) => api.post(`/api/offers/generate-contract/${projectId}`, { customText }).then(res => res.data),
  generateWorkSummary: (projectId, data) => api.post(`/api/offers/generate-work-summary/${projectId}`, data).then(res => res.data),
  uploadDocument: (projectId, formData) => api.post(`/api/offers/upload-document/${projectId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data),
  deleteDocument: (projectId, documentId) => api.delete(`/api/offers/delete-document/${projectId}/${documentId}`).then(res => res.data),

}; 

export const publicOrdersAPI = {
  getAll: (params) => api.get('/api/public-orders', { params }).then(res => res.data),
  getById: (id) => api.get(`/api/public-orders/${id}`).then(res => res.data),
  patch: (id, data) => api.patch(`/api/public-orders/${id}`, data).then(res => res.data),
  addUpdate: (id, text) => api.post(`/api/public-orders/${id}/updates`, { text }).then(res => res.data),
  uploadAttachment: (id, formData) => api.post(`/api/public-orders/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data),
  deleteAttachment: (id, index) => api.delete(`/api/public-orders/${id}/attachments/${index}`).then(res => res.data),
  getTasks: (id) => api.get(`/api/public-orders/${id}/tasks`).then(res => res.data),
  sync: () => api.post('/api/public-orders/sync').then(res => res.data),
  getConfigStatus: () => api.get('/api/public-orders/config/status').then(res => res.data),
  aiAnalyze: (limit = 10) => api.post('/api/public-orders/ai-analyze', { limit }).then(res => res.data),
  aiReset: (ids) => api.post('/api/public-orders/ai-reset', { ids }).then(res => res.data),
  deleteAll: () => api.delete('/api/public-orders/all').then(res => res.data),
  refreshDetails: (ids) => api.post('/api/public-orders/refresh-details', { ids }).then(res => res.data),
  deepAnalyze: (id) => api.post(`/api/public-orders/deep-analyze/${id}`).then(res => res.data),
  getPrompts: () => api.get('/api/public-orders/prompts').then(res => res.data),
  savePrompts: (sections) => api.put('/api/public-orders/prompts', { sections }).then(res => res.data),
};

export const activityAPI = {
  recent: () => api.get('/api/activities/recent').then(res => res.data),
};

export const searchAPI = {
  search: (q) => api.get('/api/search', { params: { q } }).then(res => res.data),
};

export const tasksAPI = {
  getAll: (params) => api.get('/api/tasks', { params }).then(res => res.data),
  getById: (id) => api.get(`/api/tasks/${id}`).then(res => res.data),
  create: (data) => api.post('/api/tasks', data).then(res => res.data),
  update: (id, data) => api.put(`/api/tasks/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/tasks/${id}`).then(res => res.data),
  addUpdate: (id, text) => api.post(`/api/tasks/${id}/updates`, { text }).then(res => res.data),
};

export const clientsAPI = {
  getAll: (params) => api.get('/api/clients', { params }).then(res => res.data),
  getById: (id) => api.get(`/api/clients/${id}`).then(res => res.data),
  create: (data) => api.post('/api/clients', data).then(res => res.data),
  update: (id, data) => api.put(`/api/clients/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/clients/${id}`).then(res => res.data),
  assignProject: (id, projectId) => api.post(`/api/clients/${id}/assign-project`, { projectId }).then(res => res.data),
  assignHosting: (id, hostingId) => api.post(`/api/clients/${id}/assign-hosting`, { hostingId }).then(res => res.data),
  regeneratePortal: (id) => api.post(`/api/clients/${id}/portal/regenerate`).then(res => res.data),
};

export const hostingAPI = {
  getAll: (params) => api.get('/api/hosting', { params }).then(res => res.data),
  getById: (id) => api.get(`/api/hosting/${id}`).then(res => res.data),
  create: (data) => api.post('/api/hosting', data).then(res => res.data),
  update: (id, data) => api.put(`/api/hosting/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/hosting/${id}`).then(res => res.data),
  recordPayment: (id, data) => api.post(`/api/hosting/${id}/payment`, data).then(res => res.data),
  addReminder: (id, data) => api.post(`/api/hosting/${id}/reminder`, data).then(res => res.data),
  updateStatus: (id, status) => api.put(`/api/hosting/${id}/status`, { status }).then(res => res.data),
  getStats: () => api.get('/api/hosting/stats/overview').then(res => res.data),
  // monitoring
  getMonitorStatus: () => api.get('/api/hosting/monitor/status').then(res => res.data),
  ackMonitor: (monitorId) => api.post(`/api/hosting/monitor/ack/${monitorId}`).then(res => res.data),
  downloadMonthlyReport: async (month, hostingId) => {
    const params = { month };
    if (hostingId) params.hostingId = hostingId;
    const res = await api.get('/api/hosting/monitor/report', { params, responseType: 'blob' });
    return res;
  }
}; 

export const sslAPI = {
  getAll: () => api.get('/api/ssl').then(res => res.data),
  getByDomain: (domain) => api.get(`/api/ssl/${domain}`).then(res => res.data),
  check: (domain) => api.post(`/api/ssl/check/${domain}`).then(res => res.data),
  checkAll: () => api.post('/api/ssl/check-all').then(res => res.data),
  generate: (domain, email) => api.post(`/api/ssl/generate/${domain}`, { email }).then(res => res.data),
  renew: (domain) => api.post(`/api/ssl/renew/${domain}`).then(res => res.data),
  getStats: () => api.get('/api/ssl/stats/summary').then(res => res.data),
  discover: () => api.post('/api/ssl/discover').then(res => res.data),
  acknowledge: (domain) => api.post(`/api/ssl/${domain}/acknowledge`).then(res => res.data),
  addDomain: (domain, autoRenew = true, renewalThreshold = 30) => api.post('/api/ssl', { domain, autoRenew, renewalThreshold }).then(res => res.data)
};

export const waitlistAPI = {
  signup: (data) => api.post('/api/waitlist', data).then(res => res.data),
  getAll: (params) => api.get('/api/waitlist', { params }).then(res => res.data),
  update: (id, data) => api.patch(`/api/waitlist/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/waitlist/${id}`).then(res => res.data),
}; 

export const leadsAPI = {
  getAll: (params) => api.get('/api/leads', { params }).then(res => res.data),
  create: (data) => api.post('/api/leads', data).then(res => res.data),
  approve: (id, reviewComment) => api.patch(`/api/leads/${id}/approve`, { reviewComment }).then(res => res.data),
  reject: (id, reviewComment) => api.patch(`/api/leads/${id}/reject`, { reviewComment }).then(res => res.data),
  saveOffer: (id, data) => api.patch(`/api/leads/${id}/offer`, data).then(res => res.data),
};

const API_BASE = process.env.REACT_APP_API_URL || 'https://oferty.soft-synergy.com';
export const getDocumentPublicUrl = (slug) => `${API_BASE}/dokumenty/${slug}`;

export const documentsAPI = {
  getAll: () => api.get('/api/documents').then(res => res.data),
  getById: (id) => api.get(`/api/documents/${id}`).then(res => res.data),
  create: (data) => api.post('/api/documents', data).then(res => res.data),
  update: (id, data) => api.put(`/api/documents/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/documents/${id}`).then(res => res.data),
};