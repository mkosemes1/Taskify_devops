import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClient } from '../api/client'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import StarRating from '../components/StarRating'
import { ROLES, can } from '../utils/permissions'
import { formatDate } from '../utils/project'

function ProjectForm({ initial, onSubmit, onClose, submitLabel }) {
  const [form, setForm] = useState(
    initial || { name: '', description: '', dueDate: '' },
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <form onSubmit={submit}>
      {error && <div className="form-error">{error}</div>}
      <label>
        Nom du projet
        <input required placeholder="Refonte du site web" value={form.name} onChange={set('name')} />
      </label>
      <label>
        Description
        <textarea rows={3} placeholder="Objectifs, périmètre, livrables…" value={form.description} onChange={set('description')} />
      </label>
      <label>
        Date limite
        <input type="date" value={form.dueDate || ''} onChange={set('dueDate')} />
      </label>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { mode: 'create' } | { mode: 'edit', project }
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      setProjects(await ApiClient.listProjects())
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const createProject = async (form) => {
    const p = await ApiClient.createProject(form)
    toast.success('Projet créé')
    await load()
    return p
  }

  const updateProject = async (form) => {
    await ApiClient.updateProject(modal.project.id, form)
    toast.success('Projet mis à jour')
    await load()
  }

  const rate = async (project, value) => {
    try {
      await ApiClient.rateProject(project.id, value)
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const visible = projects.filter((p) => {
    const okFilter =
      filter === 'all' ||
      (filter === 'active' && p.status === 'active') ||
      (filter === 'completed' && p.status === 'completed')
    const okQuery =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
    return okFilter && okQuery
  })

  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0)
  const totalDone = projects.reduce((s, p) => s + p.doneCount, 0)

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Mes projets</h1>
          <p className="muted">
            {projects.length} projet{projects.length > 1 ? 's' : ''} · {totalDone}/{totalTasks} tâches terminées
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          + Nouveau projet
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Rechercher un projet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="segmented">
          {[
            ['all', 'Tous'],
            ['active', 'En cours'],
            ['completed', 'Clôturés'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? 'seg-active' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-loader">Chargement des projets…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>Aucun projet</h3>
          <p>Créez votre premier projet pour commencer à organiser vos tâches.</p>
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            Créer un projet
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {visible.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0
            const role = ROLES[p.role]
            return (
              <article key={p.id} className={`project-card ${p.status === 'completed' ? 'is-closed' : ''}`}>
                <div className="project-card-head">
                  <Link to={`/projects/${p.id}`} className="project-title">
                    {p.name}
                  </Link>
                  <span className="role-badge" style={{ background: role.color }}>
                    {role.label}
                  </span>
                </div>
                <p className="project-desc">{p.description || 'Aucune description.'}</p>
                <div className="project-progress">
                  <div className="progress-meta">
                    <span>
                      {p.doneCount}/{p.taskCount} tâches
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <ProgressBar value={pct} />
                </div>
                <div className="project-card-foot">
                  <StarRating value={p.rating || 0} size={15} onRate={(v) => rate(p, v)} disabled={!can(p.role, 'project.rate')} />
                  <span className="muted small">
                    {p.memberCount} membre{p.memberCount > 1 ? 's' : ''} · {p.status === 'completed' ? 'Clôturé' : formatDate(p.dueDate)}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Nouveau projet' : 'Modifier le projet'}
          onClose={() => setModal(null)}
        >
          <ProjectForm
            initial={modal.mode === 'edit' ? { name: modal.project.name, description: modal.project.description, dueDate: modal.project.dueDate } : null}
            onSubmit={modal.mode === 'create' ? createProject : updateProject}
            onClose={() => setModal(null)}
            submitLabel={modal.mode === 'create' ? 'Créer' : 'Enregistrer'}
          />
        </Modal>
      )}
    </div>
  )
}
