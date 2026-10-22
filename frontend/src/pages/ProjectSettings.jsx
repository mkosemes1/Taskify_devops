// Réglages d'un projet : consultation et modification des informations,
// notation (étoiles), cycle de vie (clôture / réouverture) et zone
// sensible de suppression (réservée au créateur du projet).

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClient } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ProjectTabs from '../components/ProjectTabs'
import StarRating from '../components/StarRating'
import ProgressBar from '../components/ProgressBar'
import { ROLES, can } from '../utils/permissions'
import { formatDate, progressOf } from '../utils/project'

export default function ProjectSettings() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // ConfirmDialog : clôture ou suppression

  const load = useCallback(async () => {
    try {
      setProject(await ApiClient.getProject(id))
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

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

  // --- Données dérivées pour l'affichage et les droits ---
  const pct = progressOf(project.tasks)
  const allDone = project.tasks.length > 0 && project.tasks.every((t) => t.status === 'done')
  const closed = project.status === 'completed'
  const isCreator = project.createdBy === user?.id // seul le créateur peut supprimer
  const canEdit = can(project.role, 'project.edit')

  // --- Actions sur le projet ---
  const update = async (form) => {
    await ApiClient.updateProject(id, form)
    toast.success('Projet mis à jour')
    await load()
  }

  // Notation : envoie la note puis recharge pour la moyenne
  const rate = async (value) => {
    try {
      await ApiClient.rateProject(id, value)
      toast.success('Évaluation enregistrée')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Clôture : le projet passe en lecture seule
  const closeProject = async () => {
    await ApiClient.closeProject(id)
    toast.success('Projet clôturé')
    await load()
  }

  // Réouverture : on repasse le statut à « active » et on vide closedAt
  const reopenProject = async () => {
    await ApiClient.updateProject(id, { status: 'active', closedAt: null })
    toast.success('Projet rouvert')
    await load()
  }

  // Suppression définitive : on redirige vers le tableau de bord
  const deleteProject = async () => {
    await ApiClient.deleteProject(id)
    toast.success('Projet supprimé')
    navigate('/')
  }

  return (
    <div className="stack-lg">
      <div className="breadcrumb">
        <Link to="/">Projets</Link> <span>/</span> {project.name} <span>/</span> Réglages
      </div>
      <ProjectTabs projectId={id} />

      <div className="page-head">
        <div>
          <h1>Informations du projet</h1>
          <p className="muted">
            Rôle : <strong>{ROLES[project.role].label}</strong> ·{' '}
            {closed ? 'projet clôturé (lecture seule)' : 'projet actif'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditOpen(true)} disabled={!canEdit}>
          Modifier
        </button>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <h3 className="panel-title">Détails</h3>
          <dl className="detail-list">
            <dt>Nom</dt>
            <dd>{project.name}</dd>
            <dt>Description</dt>
            <dd>{project.description || '—'}</dd>
            <dt>Échéance</dt>
            <dd>{formatDate(project.dueDate)}</dd>
            <dt>Créé le</dt>
            <dd>{formatDate(project.createdAt)}</dd>
            <dt>Statut</dt>
            <dd>
              <span className={`status-chip ${closed ? 'status-closed' : 'status-active'}`}>
                {closed ? 'Clôturé' : 'En cours'}
              </span>
              {closed && project.closedAt && <span className="muted small"> le {formatDate(project.closedAt)}</span>}
            </dd>
            <dt>Avancement</dt>
            <dd>
              <div className="inline-progress">
                <ProgressBar value={pct} />
                <span>
                  {project.stats.done}/{project.stats.total} ({pct}%)
                </span>
              </div>
            </dd>
          </dl>
        </section>

        <section className="panel">
          <h3 className="panel-title">Évaluation</h3>
          <p className="muted">
            Note moyenne : <strong>{project.rating || '—'}</strong>
            {project.ratingCount > 0 && ` sur ${project.ratingCount} évaluation${project.ratingCount > 1 ? 's' : ''}`}
          </p>
          <StarRating
            value={Math.round(project.rating || 0)}
            size={28}
            onRate={rate}
            disabled={!can(project.role, 'project.rate')}
          />
          <p className="muted small">Votre note compte dans la moyenne du projet.</p>
        </section>

        {/* --- Cycle de vie : clôture ou réouverture --- */}
        <section className="panel">
          <h3 className="panel-title">Cycle de vie</h3>
          {!closed ? (
            <>
              <p className="muted">
                {allDone
                  ? 'Toutes les tâches sont terminées : le projet peut être clôturé.'
                  : 'La clôture est possible lorsque toutes les tâches sont terminées.'}
              </p>
              {/* Clôture bloquée tant que toutes les tâches ne sont pas faites ou sans permission */}
              <button
                className="btn btn-primary"
                disabled={!allDone || !can(project.role, 'project.close')}
                onClick={() =>
                  setConfirm({
                    title: 'Clôturer le projet',
                    message: 'Le projet passera en lecture seule. Continuer ?',
                    confirmLabel: 'Clôturer',
                    onConfirm: closeProject,
                  })
                }
              >
                Clôturer le projet
              </button>
            </>
          ) : (
            <>
              <p className="muted">Projet clôturé le {formatDate(project.closedAt)}.</p>
              <button
                className="btn btn-ghost"
                disabled={!can(project.role, 'project.close')}
                onClick={reopenProject}
              >
                Rouvrir le projet
              </button>
            </>
          )}
        </section>

        {/* --- Zone sensible : suppression définitive (créateur uniquement) --- */}
        <section className="panel panel-danger">
          <h3 className="panel-title">Zone sensible</h3>
          <p className="muted">
            La suppression retire définitivement le projet, ses tâches et ses membres.
          </p>
          <button
            className="btn btn-danger"
            disabled={!isCreator}
            title={isCreator ? '' : 'Seul le créateur du projet peut le supprimer'}
            onClick={() =>
              setConfirm({
                title: 'Supprimer le projet',
                message: `Supprimer définitivement « ${project.name} » ? Cette action est irréversible.`,
                confirmLabel: 'Supprimer',
                danger: true,
                onConfirm: deleteProject,
              })
            }
          >
            Supprimer le projet
          </button>
        </section>
      </div>

      {/* Modal d'édition des informations du projet */}
      {editOpen && (
        <Modal title="Modifier le projet" onClose={() => setEditOpen(false)}>
          <EditForm initial={project} onSubmit={update} onClose={() => setEditOpen(false)} />
        </Modal>
      )}

      {/* ConfirmDialog (clôture ou suppression, selon le bouton cliqué) */}
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

// Formulaire d'édition des informations principales du projet
// (nom, description, date limite), utilisé dans le Modal d'édition.
function EditForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description || '',
    dueDate: initial.dueDate || '',
  })
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
        <input required value={form.name} onChange={set('name')} />
      </label>
      <label>
        Description
        <textarea rows={4} value={form.description} onChange={set('description')} />
      </label>
      <label>
        Date limite
        <input type="date" value={form.dueDate} onChange={set('dueDate')} />
      </label>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
