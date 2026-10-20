const STORAGE_KEY = 'taskify_db_v1'
const SESSION_KEY = 'taskify_session_v1'

const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

const emptyDb = () => ({ users: [], projects: [], members: [], tasks: [], activity: [] })

function readDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    return emptyDb()
  }
}

function writeDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function publicUser(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  void passwordHash
  return rest
}

async function hash(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return btoa(unescape(encodeURIComponent(text)))
}

function logActivity(db, { projectId, userId, action, detail }) {
  db.activity.unshift({
    id: uid(),
    projectId,
    userId,
    action,
    detail,
    at: new Date().toISOString(),
  })
  db.activity = db.activity.slice(0, 300)
}

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function currentUser() {
  const sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) throw new ApiError('Non authentifié', 401)
  const db = readDb()
  const user = db.users.find((u) => u.id === sessionId)
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    throw new ApiError('Session expirée', 401)
  }
  return user
}

function roleOf(projectId, userId) {
  const db = readDb()
  return db.members.find((m) => m.projectId === projectId && m.userId === userId)?.role || null
}

export const api = {
  // ---------- Auth ----------
  async register({ name, email, password }) {
    await delay()
    const db = readDb()
    const norm = String(email || '').trim().toLowerCase()
    if (!name?.trim()) throw new ApiError('Le nom est requis')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) throw new ApiError('Email invalide')
    if ((password || '').length < 6) throw new ApiError('Mot de passe : 6 caractères minimum')
    if (db.users.some((u) => u.email === norm)) throw new ApiError('Cet email est déjà utilisé')

    const user = {
      id: uid(),
      name: name.trim(),
      email: norm,
      passwordHash: await hash(password),
      avatarColor: `hsl(${Math.floor(Math.random() * 360)}, 60%, 55%)`,
      createdAt: new Date().toISOString(),
    }
    db.users.push(user)
    writeDb(db)
    localStorage.setItem(SESSION_KEY, user.id)
    return publicUser(user)
  },

  async login({ email, password }) {
    await delay()
    const db = readDb()
    const norm = String(email || '').trim().toLowerCase()
    const user = db.users.find((u) => u.email === norm)
    if (!user || user.passwordHash !== (await hash(password))) {
      throw new ApiError('Identifiants incorrects', 401)
    }
    localStorage.setItem(SESSION_KEY, user.id)
    return publicUser(user)
  },

  async logout() {
    await delay(100)
    localStorage.removeItem(SESSION_KEY)
  },

  async me() {
    await delay(50)
    return publicUser(currentUser())
  },

  async searchUsers(query) {
    await delay(150)
    const db = readDb()
    const q = String(query || '').trim().toLowerCase()
    if (q.length < 2) return []
    return db.users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q))
      .slice(0, 6)
      .map(publicUser)
  },

  // ---------- Projects ----------
  async listProjects() {
    await delay()
    const user = currentUser()
    const db = readDb()
    const mine = db.members.filter((m) => m.userId === user.id)
    return mine
      .map((m) => {
        const project = db.projects.find((p) => p.id === m.projectId)
        if (!project) return null
        const tasks = db.tasks.filter((t) => t.projectId === project.id)
        const members = db.members.filter((x) => x.projectId === project.id)
        return {
          ...project,
          role: m.role,
          taskCount: tasks.length,
          doneCount: tasks.filter((t) => t.status === 'done').length,
          memberCount: members.length,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  async getProject(id) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const project = db.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Projet introuvable', 404)
    const membership = db.members.find((m) => m.projectId === id && m.userId === user.id)
    if (!membership) throw new ApiError('Accès refusé', 403)
    const tasks = db.tasks.filter((t) => t.projectId === id)
    const members = db.members
      .filter((m) => m.projectId === id)
      .map((m) => ({ ...m, user: publicUser(db.users.find((u) => u.id === m.userId)) }))
    return {
      ...project,
      role: membership.role,
      tasks,
      members,
      stats: {
        total: tasks.length,
        todo: tasks.filter((t) => t.status === 'todo').length,
        doing: tasks.filter((t) => t.status === 'doing').length,
        done: tasks.filter((t) => t.status === 'done').length,
      },
      activity: db.activity.filter((a) => a.projectId === id).slice(0, 30),
    }
  },

  async createProject({ name, description, dueDate }) {
    await delay()
    const user = currentUser()
    if (!name?.trim()) throw new ApiError('Le nom du projet est requis')
    const db = readDb()
    const project = {
      id: uid(),
      name: name.trim(),
      description: (description || '').trim(),
      dueDate: dueDate || '',
      status: 'active',
      rating: 0,
      ratingCount: 0,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
    }
    db.projects.push(project)
    db.members.push({ id: uid(), projectId: project.id, userId: user.id, role: 'owner' })
    logActivity(db, {
      projectId: project.id,
      userId: user.id,
      action: 'project.create',
      detail: `a créé le projet « ${project.name} »`,
    })
    writeDb(db)
    return project
  },

  async updateProject(id, patch) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const project = db.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Projet introuvable', 404)
    const role = roleOf(id, user.id)
    if (role !== 'owner' && role !== 'admin') throw new ApiError('Permission refusée', 403)
    Object.assign(project, patch, { updatedAt: new Date().toISOString() })
    logActivity(db, {
      projectId: id,
      userId: user.id,
      action: 'project.update',
      detail: 'a mis à jour les informations du projet',
    })
    writeDb(db)
    return project
  },

  async rateProject(id, rating) {
    await delay(150)
    const user = currentUser()
    const db = readDb()
    const project = db.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Projet introuvable', 404)
    if (!roleOf(id, user.id)) throw new ApiError('Accès refusé', 403)
    const value = Math.min(5, Math.max(0, Math.round(rating)))
    const prev = project.rating || 0
    const count = project.ratingCount || 0
    project.rating = Number((((prev * count + value) / (count + 1)).toFixed(1)))
    project.ratingCount = count + 1
    project.updatedAt = new Date().toISOString()
    writeDb(db)
    return project
  },

  async closeProject(id) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const project = db.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Projet introuvable', 404)
    const role = roleOf(id, user.id)
    if (role !== 'owner' && role !== 'admin') throw new ApiError('Permission refusée', 403)
    const tasks = db.tasks.filter((t) => t.projectId === id)
    if (tasks.length === 0) throw new ApiError('Aucune tâche à clôturer')
    if (tasks.some((t) => t.status !== 'done')) {
      throw new ApiError('Toutes les tâches doivent être terminées')
    }
    project.status = 'completed'
    project.closedAt = new Date().toISOString()
    project.updatedAt = new Date().toISOString()
    logActivity(db, {
      projectId: id,
      userId: user.id,
      action: 'project.close',
      detail: 'a clôturé le projet',
    })
    writeDb(db)
    return project
  },

  async deleteProject(id) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const project = db.projects.find((p) => p.id === id)
    if (!project) throw new ApiError('Projet introuvable', 404)
    if (project.createdBy !== user.id) throw new ApiError('Seul le créateur peut supprimer', 403)
    db.projects = db.projects.filter((p) => p.id !== id)
    db.members = db.members.filter((m) => m.projectId !== id)
    db.tasks = db.tasks.filter((t) => t.projectId !== id)
    db.activity = db.activity.filter((a) => a.projectId !== id)
    writeDb(db)
  },

  // ---------- Members / permissions ----------
  async addMember(projectId, email) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const role = roleOf(projectId, user.id)
    if (role !== 'owner' && role !== 'admin') throw new ApiError('Permission refusée', 403)
    const norm = String(email || '').trim().toLowerCase()
    const target = db.users.find((u) => u.email === norm)
    if (!target) throw new ApiError('Aucun utilisateur avec cet email (il doit être inscrit)')
    if (db.members.some((m) => m.projectId === projectId && m.userId === target.id)) {
      throw new ApiError('Déjà membre du projet')
    }
    db.members.push({ id: uid(), projectId, userId: target.id, role: 'member' })
    logActivity(db, {
      projectId,
      userId: user.id,
      action: 'member.add',
      detail: `a ajouté ${target.name} au projet`,
    })
    writeDb(db)
    return { ...db.members.at(-1), user: publicUser(target) }
  },

  async updateMemberRole(memberId, newRole) {
    await delay(150)
    const user = currentUser()
    const db = readDb()
    const member = db.members.find((m) => m.id === memberId)
    if (!member) throw new ApiError('Membre introuvable', 404)
    const myRole = roleOf(member.projectId, user.id)
    if (myRole !== 'owner' && myRole !== 'admin') throw new ApiError('Permission refusée', 403)
    if (member.role === 'owner' && newRole !== 'owner') {
      const owners = db.members.filter((m) => m.projectId === member.projectId && m.role === 'owner')
      if (owners.length <= 1) throw new ApiError('Le projet doit garder un propriétaire')
    }
    if (newRole === 'owner' && myRole !== 'owner') throw new ApiError('Seul le propriétaire peut transférer la propriété')
    member.role = newRole
    logActivity(db, {
      projectId: member.projectId,
      userId: user.id,
      action: 'member.role',
      detail: `a défini le rôle « ${newRole} »`,
    })
    writeDb(db)
    return member
  },

  async removeMember(memberId) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const member = db.members.find((m) => m.id === memberId)
    if (!member) throw new ApiError('Membre introuvable', 404)
    const myRole = roleOf(member.projectId, user.id)
    const isSelf = member.userId === user.id
    if (!isSelf && myRole !== 'owner' && myRole !== 'admin') throw new ApiError('Permission refusée', 403)
    if (member.role === 'owner' && !isSelf) throw new ApiError('Impossible de retirer le propriétaire')
    if (member.role === 'owner' && isSelf) {
      const others = db.members.filter((m) => m.projectId === member.projectId && m.id !== memberId)
      if (others.length === 0) throw new ApiError('Supprimez le projet, il n\'aurait plus de propriétaire')
    }
    db.members = db.members.filter((m) => m.id !== memberId)
    db.tasks = db.tasks.map((t) =>
      t.projectId === member.projectId && t.assigneeId === member.userId
        ? { ...t, assigneeId: null }
        : t,
    )
    logActivity(db, {
      projectId: member.projectId,
      userId: user.id,
      action: 'member.remove',
      detail: isSelf ? 'a quitté le projet' : 'a retiré un membre',
    })
    writeDb(db)
  },

  // ---------- Tasks ----------
  async createTask(projectId, data) {
    await delay()
    const user = currentUser()
    const db = readDb()
    if (!roleOf(projectId, user.id)) throw new ApiError('Accès refusé', 403)
    if (!data.title?.trim()) throw new ApiError('Le titre est requis')
    const project = db.projects.find((p) => p.id === projectId)
    if (project?.status === 'completed') throw new ApiError('Projet clôturé, lecture seule')
    const task = {
      id: uid(),
      projectId,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate || '',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.tasks.push(task)
    project.updatedAt = new Date().toISOString()
    logActivity(db, {
      projectId,
      userId: user.id,
      action: 'task.create',
      detail: `a créé la tâche « ${task.title} »`,
    })
    writeDb(db)
    return task
  },

  async updateTask(taskId, patch) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const task = db.tasks.find((t) => t.id === taskId)
    if (!task) throw new ApiError('Tâche introuvable', 404)
    const role = roleOf(task.projectId, user.id)
    if (!role) throw new ApiError('Accès refusé', 403)
    const project = db.projects.find((p) => p.id === task.projectId)
    if (project?.status === 'completed') throw new ApiError('Projet clôturé, lecture seule')
    if (role === 'viewer') throw new ApiError('Lecture seule (rôle observateur)', 403)
    const oldStatus = task.status
    Object.assign(task, patch, { updatedAt: new Date().toISOString() })
    project.updatedAt = new Date().toISOString()
    if (oldStatus !== task.status) {
      logActivity(db, {
        projectId: task.projectId,
        userId: user.id,
        action: 'task.status',
        detail: `a déplacé « ${task.title} » vers ${task.status}`,
      })
    }
    writeDb(db)
    return task
  },

  async deleteTask(taskId) {
    await delay()
    const user = currentUser()
    const db = readDb()
    const task = db.tasks.find((t) => t.id === taskId)
    if (!task) throw new ApiError('Tâche introuvable', 404)
    const role = roleOf(task.projectId, user.id)
    if (role !== 'owner' && role !== 'admin' && role !== 'member') {
      throw new ApiError('Permission refusée', 403)
    }
    const project = db.projects.find((p) => p.id === task.projectId)
    if (project?.status === 'completed') throw new ApiError('Projet clôturé, lecture seule')
    db.tasks = db.tasks.filter((t) => t.id !== taskId)
    logActivity(db, {
      projectId: task.projectId,
      userId: user.id,
      action: 'task.delete',
      detail: `a supprimé la tâche « ${task.title} »`,
    })
    writeDb(db)
  },
}

export { ApiError }
