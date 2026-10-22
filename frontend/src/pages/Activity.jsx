// Page d'activité d'un projet : statistiques (tâches par statut) et
// journal chronologique des actions effectuées par les membres.
// Chaque action est traduite en français via ACTION_LABELS.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiClient } from '../api/client'
import { Avatar } from '../components/Avatar'
import ProjectTabs from '../components/ProjectTabs'
import { formatDate } from '../utils/project'

// Correspondance code d'action → phrase affichée dans le journal
const ACTION_LABELS = {
  'project.create': 'a créé le projet',
  'project.update': 'a modifié le projet',
  'project.close': 'a clôturé le projet',
  'member.add': 'a ajouté un membre',
  'member.role': 'a changé un rôle',
  'member.remove': 'a retiré un membre',
  'task.create': 'a créé une tâche',
  'task.status': 'a déplacé une tâche',
  'task.delete': 'a supprimé une tâche',
}

export default function Activity() {
  const { id } = useParams()
  // Le projet chargé contient aussi project.stats et project.activity
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setProject(await ApiClient.getProject(id))
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
  if (error)
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

  return (
    <div className="stack-lg">
      <div className="breadcrumb">
        <Link to="/">Projets</Link> <span>/</span>{' '}
        <Link to={`/projects/${id}`}>{project.name}</Link> <span>/</span> Activité
      </div>
      <ProjectTabs projectId={id} />
      <h1>Suivi de l'évolution</h1>

      {/* --- Statistiques du projet (calculées côté serveur dans project.stats) --- */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Tâches totales</span>
          <span className="stat-value">{project.stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">À faire</span>
          <span className="stat-value">{project.stats.todo}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">En cours</span>
          <span className="stat-value">{project.stats.doing}</span>
        </div>
        <div className="stat-card stat-done">
          <span className="stat-label">Terminées</span>
          <span className="stat-value">{project.stats.done}</span>
        </div>
      </div>

      {/* --- Journal d'activité chronologique --- */}
      <section className="panel">
        <h3 className="panel-title">Journal d'activité</h3>
        {project.activity.length === 0 ? (
          <p className="muted">Aucune activité enregistrée.</p>
        ) : (
          <ul className="timeline">
            {project.activity.map((a) => {
              // On retrouve l'auteur de l'action dans la liste des membres
              const author = project.members.find((m) => m.userId === a.userId)?.user
              return (
                <li key={a.id}>
                  <Avatar user={author} size={28} />
                  <div>
                    <p>
                      <strong>{author?.name || 'Utilisateur'}</strong>{' '}
                      {ACTION_LABELS[a.action] || a.detail}
                    </p>
                    <span className="muted small">
                      {formatDate(a.at)} ·{' '}
                      {new Date(a.at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
