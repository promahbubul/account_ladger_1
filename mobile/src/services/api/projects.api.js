import { apiClient } from './client';

const send = (method, path, data) =>
  apiClient(path, { method, ...(data ? { body: JSON.stringify(data) } : {}) });

export const projectsApi = {
  getProjects: () => apiClient('/api/projects'),
  getProject: (id) => apiClient(`/api/projects/${id}`),
  createProject: (data) => send('POST', '/api/projects', data),
  updateProject: (id, data) => send('PUT', `/api/projects/${id}`, data),
  deleteProject: (id) => send('DELETE', `/api/projects/${id}`),

  addPerson: (id, data) => send('POST', `/api/projects/${id}/people`, data),
  deletePerson: (id, personId) => send('DELETE', `/api/projects/${id}/people/${personId}`),
  addHead: (id, data) => send('POST', `/api/projects/${id}/heads`, data),
  deleteHead: (id, headId) => send('DELETE', `/api/projects/${id}/heads/${headId}`),

  getEntries: (id, { type, page = 1, limit = 50, all = false } = {}) => {
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    if (all) {
      query.set('all', 'true');
    } else {
      query.set('page', String(page));
      query.set('limit', String(limit));
    }
    return apiClient(`/api/projects/${id}/entries?${query.toString()}`);
  },
  createEntries: (id, data) =>
    apiClient(`/api/projects/${id}/entries`, { method: 'POST', body: JSON.stringify(data), timeout: 30000 }),
  updateEntry: (id, entryId, data) => send('PUT', `/api/projects/${id}/entries/${entryId}`, data),
  deleteEntry: (id, entryId) => send('DELETE', `/api/projects/${id}/entries/${entryId}`),
};
