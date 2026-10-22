// Détail d'un projet : tableau Kanban avec 3 colonnes (À faire, En cours,
// Terminé). Gère le drag & drop des tâches, le CRUD des tâches (TaskModal),
// la clôture du projet et l'affichage de la charge par membre.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiClient } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { Avatar } from '../components/Avatar'
import ProgressBar from '../components/ProgressBar'
import ProjectTabs from '../components/ProjectTabs'
import { COLUMNS, PRIORITIES, formatDate, isOverdue, progressOf } from '../utils/project'
import { ROLES, can } from '../utils/permissions'

// Valeurs par défaut d'une tâche neuve (formulaire de création)
const EMPTY_TASK = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: '',
  dueDate: '',
}

// Formulaire de création / modification d'une tâche.
// Si l'utilisateur n'a pas la permission (can), le modal n'affiche
// qu'une vue lecture seule des détails.
function TaskModal({ task, project, onClose, onSaved, onDelete, defaultStatus }) {
  const toast = useToast()
  const [form, setForm] = useState(
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId || '',
          dueDate: task.dueDate || '',
        }
      : { ...EMPTY_TASK, status: defaultStatus || 'todo' }, // colonne d'origine en création
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const editable = can(project.role, task ? 'task.edit' : 'task.create')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    // assigneeId vide → null (non attribuée)
    const payload = { ...form, assigneeId: form.assigneeId || null }
    try {
      if (task) await ApiClient.updateTask(task.id, payload)
      else await ApiClient.createTask(project.id, payload)
      toast.success(task ? 'Tâche mise à jour' : 'Tâche créée')
      onSaved() // recharge le projet pour voir la tâche à jour
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // --- Vue lecture seule si pas de permission d'édition ---
  if (!editable) {
    return (
      <Modal title="Détail de la tâche" onClose={onClose}>
        <dl className="detail-list">
          <dt>Titre</dt>
          <dd>{task?.title}</dd>
          <dt>Description</dt>
          <dd>{task?.description || '—'}</dd>
          <dt>Statut</dt>
          <dd>{COLUMNS.find((c) => c.id === task?.status)?.title}</dd>
          <dt>Priorité</dt>
          <dd>{PRIORITIES[task?.priority]?.label}</dd>
          <dt>Échéance</dt>
          <dd>{formatDate(task?.dueDate)}</dd>
        </dl>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={task ? 'Modifier la tâche' : 'Nouvelle tâche'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label>
          Titre
          <input required value={form.title} onChange={set('title')} placeholder="Rédiger le cahier des charges" />
        </label>
        <label>
          Description
          <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Détails, liens, critères d'acceptation…" />
        </label>
        <div className="form-row">
          <label>
            Colonne
            <select value={form.status} onChange={set('status')}>
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priorité
            <select value={form.priority} onChange={set('priority')}>
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Assignée à
            <select value={form.assigneeId} onChange={set('assigneeId')}>
              <option value="">— Non attribuée —</option>
              {project.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Échéance
            <input type="date" value={form.dueDate} onChange={set('dueDate')} />
          </label>
        </div>
        <div className="modal-foot">
          {task && can(project.role, 'task.delete') && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={busy}
            >
              Supprimer
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Carte de tâche affichée dans une colonne du Kanban.
// Devient « draggable » uniquement si le projet n'est pas clôturé
// et si l'utilisateur a la permission task.move.
function TaskCard({ task, project, onOpen, onDragStart }) {
  const assignee = project.members.find((m) => m.userId === task.assigneeId)?.user
  const prio = PRIORITIES[task.priority]
  const overdue = isOverdue(task.dueDate, task.status)
  const locked = project.status === 'completed' // projet clôturé → lecture seule

  return (
    <article
      className={`task-card ${locked ? 'is-locked' : ''}`}
      draggable={!locked && can(project.role, 'task.move')}
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onOpen(task)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task)} // accessibilité : Enter ouvre la tâche
    >
      <div className="task-card-top">
        <span className="priority-chip" style={{ background: prio.color }}>
          {prio.label}
        </span>
        {overdue && <span className="overdue-chip">En retard</span>}
      </div>
      <h4 className="task-title">{task.title}</h4>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-card-foot">
        <span className={`due ${overdue ? 'due-late' : ''}`}>{task.dueDate ? formatDate(task.dueDate) : ''}</span>
        <Avatar user={assignee} size={24} />
      </div>
    </article>
  )
}

// Page principale du tableau Kanban d'un projet.
export default function ProjectDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taskModal, setTaskModal] = useState(null) // { mode, task? }
  const [confirm, setConfirm] = useState(null) // état du ConfirmDialog (clôture / suppression)
  const [dragOver, setDragOver] = useState(null) // colonne survolée pendant le drag

  // --- Chargement du projet ---
  const load = useCallback(async () => {
    try {
      const data = await ApiClient.getProject(id)
      setProject(data)
      setError('')
    } catch (e) {
      setError(e.message)
      // 404 (introuvable) ou 401 (non autorisé) : pas de projet à afficher
      if (e.status === 404 || e.status === 401) setProject(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // --- Regroupement des tâches par colonne ---
  // useMemo : recalculé uniquement quand `project` change (tri par date de maj)
  const byColumn = useMemo(() => {
    const map = { todo: [], doing: [], done: [] }
    project?.tasks.forEach((t) => map[t.status]?.push(t))
    Object.values(map).forEach((list) =>
      list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    )
    return map
  }, [project])

  // --- Optimistic update : déplacement d'une tâche entre colonnes ---
  // On applique le déplacement immédiatement dans l'état local (UI réactive),
  // puis on appelle l'API ; si l'API échoue, on restaure l'état précédent.
  const moveTask = async (task, status) => {
    if (task.status === status) return
    if (!can(project.role, 'task.move')) {
      toast.error('Votre rôle ne permet pas de déplacer les tâches')
      return
    }
    const previous = project.tasks // sauvegarde pour rollback
    const nextTasks = project.tasks.map((t) => (t.id === task.id ? { ...t, status } : t))
    const allDoneNow = nextTasks.length > 0 && nextTasks.every((t) => t.status === 'done')
    setProject({ ...project, tasks: nextTasks }) // affichage immédiat du déplacement
    try {
      await ApiClient.updateTask(task.id, { status })
      await load() // resynchronisation avec le serveur
      if (status === 'done' && allDoneNow) {
        toast.success('Toutes les tâches sont terminées ! Le projet peut être clôturé.')
      }
    } catch (e) {
      setProject({ ...project, tasks: previous }) // rollback si erreur
      toast.error(e.message)
    }
  }

  // --- Drag & drop (HTML5) ---
  // onDragStart : on stocke l'id de la tâche dans le dataTransfer
  const onDragStart = (e, task) => {
    // dataTransfer ne manipule que des chaînes : on convertit l'id (nombre
    // renvoyé par Django) en string, sinon la comparaison au drop échoue
    e.dataTransfer.setData('text/plain', String(task.id))
    e.dataTransfer.effectAllowed = 'move'
  }

  // onDrop : on relit l'id et on déplace la tâche vers la colonne cible
  const onDrop = (e, status) => {
    e.preventDefault()
    setDragOver(null)
    const taskId = e.dataTransfer.getData('text/plain')
    // comparaison en string : t.id est un nombre côté API
    const task = project.tasks.find((t) => String(t.id) === taskId)
    if (task) moveTask(task, status)
  }

  // --- Suppression d'une tâche ---
  const deleteTask = async (task) => {
    try {
      await ApiClient.deleteTask(task.id)
      toast.success('Tâche supprimée')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // --- Clôture du projet (lecture seule) ---
  const closeProject = async () => {
    try {
      await ApiClient.closeProject(id)
      toast.success('Projet clôturé')
      await load()
    } catch (e) {
      toast.error(e.message)
      throw e // relancé pour que le ConfirmDialog affiche l'erreur
    }
  }

  // --- États de chargement / d'erreur ---
  if (loading) return <div className="page-loader">Chargement…</div>
  if (error && !project)
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <h3>Accès impossible</h3>
        <p>{error}</p>
        <Link to="/" className="btn btn-primary">
          Retour aux projets
        </Link>
      </div>
    )

  // --- Données dérivées pour le rendu ---
  const pct = progressOf(project.tasks)
  const canClose = can(project.role, 'project.close')
  const allDone = project.tasks.length > 0 && project.tasks.every((t) => t.status === 'done')
  const closed = project.status === 'completed'

  return (
    <div className="stack-lg">
      <div className="project-header">
        <div className="project-header-main">
          <div className="breadcrumb">
            <Link to="/">Projets</Link> <span>/</span> {project.name}
          </div>
          <h1>
            {project.name}
            {closed && <span className="status-chip status-closed">Clôturé</span>}
          </h1>
          <p className="muted">{project.description || 'Aucune description.'}</p>
        </div>
        <div className="project-header-side">
          <div className="stat-box">
            <span className="stat-label">Avancement</span>
            <span className="stat-value">{pct}%</span>
            <ProgressBar value={pct} />
          </div>
          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setTaskModal({ mode: 'create' })}
              disabled={closed || !can(project.role, 'task.create')}
            >
              + Tâche
            </button>
            <Link to={`/projects/${id}/members`} className="btn btn-ghost">
              Membres ({project.members.length})
            </Link>
            {canClose && !closed && (
              <button
                className="btn btn-primary"
                disabled={!allDone}
                title={allDone ? 'Clôturer le projet' : 'Toutes les tâches doivent être terminées'}
                onClick={() =>
                  setConfirm({
                    title: 'Clôturer le projet',
                    message: 'Toutes les tâches sont terminées. Clôturer le projet le passe en lecture seule. Continuer ?',
                    confirmLabel: 'Clôturer',
                    onConfirm: closeProject,
                  })
                }
              >
                Clôturer le projet
              </button>
            )}
          </div>
        </div>
      </div>

      <ProjectTabs projectId={id} />

      {/* --- Tableau Kanban : 3 colonnes avec gestion du drag & drop --- */}
      <div className="board">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className={`board-col ${dragOver === col.id ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault() // indispensable pour autoriser le drop
              setDragOver(col.id) // surligne la colonne survolée
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, col.id)}
          >
            <header className="col-head" style={{ borderColor: col.accent }}>
              <span className="col-dot" style={{ background: col.accent }} />
              <h3>{col.title}</h3>
              <span className="col-count">{byColumn[col.id].length}</span>
            </header>
            <div className="col-body">
              {byColumn[col.id].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={project}
                  onOpen={(t) => setTaskModal({ mode: 'edit', task: t })}
                  onDragStart={onDragStart}
                />
              ))}
              {byColumn[col.id].length === 0 && <div className="col-empty">Glissez une carte ici</div>}
            </div>
            {!closed && can(project.role, 'task.create') && (
              <button
                className="col-add"
                onClick={() => setTaskModal({ mode: 'create', defaultStatus: col.id })}
              >
                + Ajouter une tâche
              </button>
            )}
          </section>
        ))}
      </div>

      {/* --- Charge de travail par membre (tâches assignées / terminées) --- */}
      <section className="panel">
        <h3 className="panel-title">Répartition des membres</h3>
        <div className="member-strip">
          {project.members.map((m) => {
            const count = project.tasks.filter((t) => t.assigneeId === m.userId).length
            const done = project.tasks.filter((t) => t.assigneeId === m.userId && t.status === 'done').length
            return (
              <div key={m.id} className="member-mini">
                <Avatar user={m.user} size={36} />
                <div>
                  <strong>{m.user?.name}</strong>
                  <span className="muted small">
                    {done}/{count} tâche{count > 1 ? 's' : ''} · {ROLES[m.role].label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="muted small">
          Connecté en tant que {user?.name} — rôle <strong>{ROLES[project.role].label}</strong>
        </p>
      </section>

      {/* Modal de tâche (création / modification / consultation) */}
      {taskModal && (
        <TaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : null}
          project={{ ...project, tasks: project.tasks }}
          defaultStatus={taskModal.defaultStatus}
          onClose={() => setTaskModal(null)}
          onSaved={load}
          // Avant de supprimer, on ferme le modal et on demande confirmation
          onDelete={() => {
            const t = taskModal.task
            setTaskModal(null)
            setConfirm({
              title: 'Supprimer la tâche',
              message: `Supprimer « ${t.title} » ? Cette action est irréversible.`,
              confirmLabel: 'Supprimer',
              danger: true,
              onConfirm: () => deleteTask(t),
            })
          }}
        />
      )}

      {/* ConfirmDialog générique (clôture du projet, suppression de tâche) */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
