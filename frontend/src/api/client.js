import { api as mockApi } from './mockBackend'

/**
 * Point d'entrée unique de l'API.
 *
 * - Tant que le backend n'est pas branché (pas de VITE_API_URL), on utilise
 *   l'API simulée persistée dans le localStorage.
 * - Dès que le backend sera prêt, définir VITE_API_URL (ex: http://localhost:8080)
 *   : les mêmes fonctions appellent alors les endpoints REST correspondants.
 */
const BASE_URL = import.meta.env.VITE_API_URL || ''

const REST_MAP = {
  register: ['/auth/register', 'POST'],
  login: ['/auth/login', 'POST'],
  logout: ['/auth/logout', 'POST'],
  me: ['/auth/me', 'GET'],
  searchUsers: ['/users', 'GET'],
  listProjects: ['/projects', 'GET'],
  getProject: [(id) => `/projects/${id}`, 'GET'],
  createProject: ['/projects', 'POST'],
  updateProject: [(id) => `/projects/${id}`, 'PUT'],
  rateProject: [(id) => `/projects/${id}/rate`, 'POST'],
  closeProject: [(id) => `/projects/${id}/close`, 'POST'],
  deleteProject: [(id) => `/projects/${id}`, 'DELETE'],
  addMember: [(id) => `/projects/${id}/members`, 'POST'],
  updateMemberRole: [(id) => `/projects/${id}/members/${id}`, 'PUT'],
  removeMember: [(id) => `/projects/${id}/members/${id}`, 'DELETE'],
  createTask: [(id) => `/projects/${id}/tasks`, 'POST'],
  updateTask: [(id) => `/tasks/${id}`, 'PUT'],
  deleteTask: [(id) => `/tasks/${id}`, 'DELETE'],
}

async function call(name, ...args) {
  if (!BASE_URL) return mockApi[name](...args)

  const mapping = REST_MAP[name]
  if (!mapping) return mockApi[name](...args)

  const [pathOrFn, method] = mapping
  const needsId = typeof pathOrFn === 'function'
  const idOrProjectId = needsId ? args[0] : undefined
  const path = needsId ? pathOrFn(idOrProjectId) : pathOrFn
  const body = needsId ? args[1] : args[0]

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('taskify_token') || ''}`,
    },
    credentials: 'include',
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  })
  if (res.status === 401) {
    localStorage.removeItem('taskify_token')
    throw Object.assign(new Error('Non authentifié'), { status: 401 })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.message || 'Erreur serveur'), { status: res.status })
  return data
}

export const ApiClient = new Proxy(
  {},
  {
    get: (_, prop) => (typeof prop === 'string' ? (...args) => call(prop, ...args) : undefined),
  },
)
