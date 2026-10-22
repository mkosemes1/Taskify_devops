import { api as mockApi } from './mockBackend'

/**
 * Point d'entrée unique de l'API.
 *
 * - Sans VITE_API_URL : API simulée persistée dans le localStorage (démo).
 * - Avec VITE_API_URL (ex: http://localhost:8000 ou /api via le proxy Vite) :
 *   les mêmes fonctions appellent le backend Django (JWT Bearer).
 */
const BASE_URL = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'taskify_token'
const REFRESH_KEY = 'taskify_refresh'

const REST_MAP = {
  register: ['/auth/register', 'POST'],
  login: ['/auth/login', 'POST'],
  logout: ['/auth/logout', 'POST'],
  me: ['/auth/me', 'GET'],
  searchUsers: [(q) => `/users?search=${encodeURIComponent(q || '')}`, 'GET'],
  listProjects: ['/projects', 'GET'],
  getProject: [(id) => `/projects/${id}`, 'GET'],
  createProject: ['/projects', 'POST'],
  updateProject: [(id) => `/projects/${id}`, 'PUT'],
  rateProject: [(id) => `/projects/${id}/rate`, 'POST'],
  closeProject: [(id) => `/projects/${id}/close`, 'POST'],
  deleteProject: [(id) => `/projects/${id}`, 'DELETE'],
  addMember: [(id) => `/projects/${id}/members`, 'POST'],
  updateMemberRole: [(id) => `/members/${id}`, 'PUT'],
  removeMember: [(id) => `/members/${id}`, 'DELETE'],
  createTask: [(id) => `/projects/${id}/tasks`, 'POST'],
  updateTask: [(id) => `/tasks/${id}`, 'PUT'],
  deleteTask: [(id) => `/tasks/${id}`, 'DELETE'],
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function call(name, ...args) {
  if (!BASE_URL) return mockApi[name](...args)

  const mapping = REST_MAP[name]
  if (!mapping) return mockApi[name](...args)

  const [pathOrFn, method] = mapping
  const hasPathArg = typeof pathOrFn === 'function'
  const path = hasPathArg ? pathOrFn(args[0]) : pathOrFn
  const body = hasPathArg ? args[1] : args[0]

  // logout : on envoie le refresh token pour le blacklister côté serveur
  const payload =
    name === 'logout' ? { refresh: localStorage.getItem(REFRESH_KEY) || '' } : body

  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
  })

  if (res.status === 401 && name !== 'login' && name !== 'register') {
    clearSession()
    throw Object.assign(new Error('Non authentifié'), { status: 401 })
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(data.message || 'Erreur serveur'), { status: res.status })
  }

  // Login / inscription : on stocke les tokens JWT et on renvoie l'utilisateur
  if ((name === 'login' || name === 'register') && data.access) {
    localStorage.setItem(TOKEN_KEY, data.access)
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh)
    return data.user
  }
  if (name === 'logout') {
    clearSession()
  }
  return data
}

export const ApiClient = new Proxy(
  {},
  {
    get: (_, prop) => (typeof prop === 'string' ? (...args) => call(prop, ...args) : undefined),
  },
)
