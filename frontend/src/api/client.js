/**
 * Client REST unique — toutes les requêtes partent vers le backend Django.
 *
 * En dev : VITE_API_URL=/api (proxy Vite → backend, cf. vite.config.js)
 * En prod : le build reçoit VITE_API_URL=/api et nginx proxifie vers backend:8000
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'taskify_token'
const REFRESH_KEY = 'taskify_refresh'

// Table de correspondance nom de méthode → [chemin, verbe HTTP, construireCorps?].
// Certaines entrées prennent un id en argument : la valeur est alors
// une fonction (id) => chemin, et le corps suit en deuxième argument.
// Le 3e élément (optionnel) enveloppe un argument simple (email, note, rôle)
// dans un objet JSON, comme l'attend le serializer Django.
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
  rateProject: [(id) => `/projects/${id}/rate`, 'POST', (_id, rating) => ({ rating })],
  closeProject: [(id) => `/projects/${id}/close`, 'POST'],
  deleteProject: [(id) => `/projects/${id}`, 'DELETE'],
  addMember: [(id) => `/projects/${id}/members`, 'POST', (_id, email) => ({ email })],
  updateMemberRole: [(id) => `/members/${id}`, 'PUT', (_id, role) => ({ role })],
  removeMember: [(id) => `/members/${id}`, 'DELETE'],
  createTask: [(id) => `/projects/${id}/tasks`, 'POST'],
  updateTask: [(id) => `/tasks/${id}`, 'PUT'],
  deleteTask: [(id) => `/tasks/${id}`, 'DELETE'],
}

// Supprime les deux tokens JWT du localStorage (fin de session)
function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Indique si un access token est présent (session potentiellement valide)
export function hasSession() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

// Fonction centrale : construit la requête fetch à partir de REST_MAP,
// ajoute le token d'authentification, gère les erreurs réseau et HTTP,
// et stocke les tokens lors du login / de l'inscription.
async function call(name, ...args) {
  const mapping = REST_MAP[name]
  if (!mapping) throw new Error(`Méthode API inconnue : ${name}`)

  // Certaines méthodes prennent un id en 1er argument (chemin dynamique) ;
  // d'autres attendent directement le corps de la requête.
  const [pathOrFn, method, buildBody] = mapping
  const hasPathArg = typeof pathOrFn === 'function'
  const path = hasPathArg ? pathOrFn(args[0]) : pathOrFn
  const body = buildBody ? buildBody(...args) : hasPathArg ? args[1] : args[0]

  // logout : on envoie le refresh token pour le blacklister côté serveur
  const payload =
    name === 'logout' ? { refresh: localStorage.getItem(REFRESH_KEY) || '' } : body

  const token = localStorage.getItem(TOKEN_KEY)
  let res
  try {
    // credentials: 'include' : les cookies (éventuels) sont envoyés avec la requête
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
    })
  } catch {
    // Erreur réseau : on simule un objet Error avec status 0
    throw Object.assign(new Error('Serveur injoignable'), { status: 0 })
  }

  // 401 hors login/register : session expirée ou invalide → on purge
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
  if (name === 'logout') clearSession()
  return data
}

// Proxy : permet d'appeler ApiClient.listProjects(), ApiClient.login(…) etc.
// sans définir chaque méthode à la main — le nom de la propriété devient
// la clé dans REST_MAP, puis une fonction qui délègue à call().
export const ApiClient = new Proxy(
  {},
  {
    get: (_, prop) => (typeof prop === 'string' ? (...args) => call(prop, ...args) : undefined),
  },
)
