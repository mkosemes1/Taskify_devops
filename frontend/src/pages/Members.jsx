// Page de gestion des membres d'un projet.
// Affiche la liste des membres avec leurs rôles, permet d'ajouter un membre
// (recherche d'utilisateur), de changer un rôle et de retirer un membre.
// Inclut aussi la matrice des permissions (rôles × actions).

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiClient } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { Avatar } from '../components/Avatar'
import ProjectTabs from '../components/ProjectTabs'
import { PERMISSIONS, ROLES, ROLE_OPTIONS, can } from '../utils/permissions'

export default function Members() {
  const { id } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  // --- Chargement du projet (inclut la liste des membres et des tâches) ---
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

  // --- Actions sur les membres ---
  const changeRole = async (member, role) => {
    try {
      await ApiClient.updateMemberRole(member.id, role)
      toast.success('Rôle mis à jour')
      await load()
    } catch (e) {
      toast.error(e.message)
      await load() // recharge même en erreur pour réaligner l'affichage
    }
  }

  // Retrait d'un membre ; relance l'erreur pour l'afficher dans le ConfirmDialog
  const removeMember = async (member) => {
    try {
      await ApiClient.removeMember(member.id)
      toast.success('Membre retiré')
      await load()
    } catch (e) {
      toast.error(e.message)
      throw e
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

  // --- Droits de l'utilisateur courant sur ce projet ---
  const canManage = can(project.role, 'member.add')
  const isOwner = project.role === 'owner'

  return (
    <div className="stack-lg">
      <div className="breadcrumb">
        <Link to="/">Projets</Link> <span>/</span>{' '}
        <Link to={`/projects/${id}`}>{project.name}</Link> <span>/</span> Membres
      </div>
      <ProjectTabs projectId={id} />

      <div className="page-head">
        <div>
          <h1>Membres du projet</h1>
          <p className="muted">
            {project.members.length} membre{project.members.length > 1 ? 's' : ''} · votre rôle :{' '}
            <strong>{ROLES[project.role].label}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setInviteOpen(true)} disabled={!canManage}>
          + Ajouter un membre
        </button>
      </div>

      {/* --- Tableau des membres --- */}
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th>Tâches</th>
              <th>Inscrit le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {project.members.map((m) => {
              const mine = m.userId === user?.id // s'agit-il de l'utilisateur connecté ?
              const tasks = project.tasks.filter((t) => t.assigneeId === m.userId)
              return (
                <tr key={m.id}>
                  <td>
                    <div className="member-cell">
                      <Avatar user={m.user} size={34} />
                      <div>
                        <strong>
                          {m.user?.name} {mine && <span className="muted small">(vous)</span>}
                        </strong>
                        <span className="muted small">{m.user?.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {/* Le rôle du propriétaire est fixe ; sinon select si on peut gérer */}
                    {m.role === 'owner' || !canManage ? (
                      <span className="role-badge" style={{ background: ROLES[m.role].color }}>
                        {ROLES[m.role].label}
                      </span>
                    ) : (
                      <select
                        className="role-select"
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value)}
                      >
                        {/* Seul le propriétaire peut attribuer le rôle « propriétaire » */}
                        {ROLE_OPTIONS.filter((r) => r !== 'owner' || isOwner).map((r) => (
                          <option key={r} value={r}>
                            {ROLES[r].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {tasks.filter((t) => t.status === 'done').length}/{tasks.length}
                  </td>
                  <td className="muted small">{new Date(m.user?.createdAt || Date.now()).toLocaleDateString('fr-FR')}</td>
                  <td className="right">
                    {/* On peut retirer un autre membre (si on gère) ou quitter soi-même ; jamais le propriétaire */}
                    {m.role !== 'owner' && (canManage || mine) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setConfirm({
                            title: mine ? 'Quitter le projet' : 'Retirer le membre',
                            message: mine
                              ? 'Vous allez quitter ce projet. Continuer ?'
                              : `Retirer ${m.user?.name} du projet ? Ses tâches non terminées seront désattribuées.`,
                            confirmLabel: 'Retirer',
                            danger: true,
                            onConfirm: () => removeMember(m),
                          })
                        }
                      >
                        {mine ? 'Quitter' : 'Retirer'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* --- Matrice des permissions : chaque rôle × chaque permission (can) --- */}
      <section className="panel">
        <h3 className="panel-title">Matrice des permissions</h3>
        <div className="perm-grid">
          {ROLE_OPTIONS.map((role) => (
            <div key={role} className="perm-col">
              <span className="role-badge" style={{ background: ROLES[role].color }}>
                {ROLES[role].label}
              </span>
              <ul>
                {Object.entries(PERMISSIONS).map(([perm, label]) => (
                  <li key={perm} className={can(role, perm) ? 'perm-yes' : 'perm-no'}>
                    {can(role, perm) ? '✓' : '✕'} {label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Modal d'ajout d'un membre (recherche d'un utilisateur existant) */}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={load}
          projectId={id}
        />
      )}

      {/* ConfirmDialog pour le retrait / le départ du projet */}
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

// Modal d'invitation : recherche d'un utilisateur par nom ou email,
// puis ajout comme membre du projet. Seuls les utilisateurs déjà
// inscrits sur Taskify peuvent être ajoutés.
function InviteModal({ onClose, onInvited, projectId }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // --- Recherche avec debounce (250 ms) ---
  // On attend 250 ms après la dernière frappe avant d'appeler l'API,
  // pour ne pas la noyer sous les requêtes à chaque caractère.
  useEffect(() => {
    let alive = true // drapeau : false si le composant est démonté ou l'effet relancé
    const t = setTimeout(async () => {
      try {
        const users = await ApiClient.searchUsers(query)
        if (alive) setResults(users) // ignore la réponse si plus pertinent
      } catch {
        if (alive) setResults([])
      }
    }, 250)
    // Nettoyage : on annule le timer en attente si l'utilisateur retape
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  const invite = async (email) => {
    setBusy(true)
    setError('')
    try {
      await ApiClient.addMember(projectId, email)
      toast.success('Membre ajouté')
      onInvited()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Ajouter un membre" onClose={onClose} size="sm">
      {error && <div className="form-error">{error}</div>}
      <label>
        Rechercher par nom ou email
        <input
          autoFocus
          placeholder="ada@exemple.com"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="muted small">L'utilisateur doit déjà être inscrit sur Taskify.</p>
      <ul className="search-results">
        {results.map((u) => (
          <li key={u.id}>
            <Avatar user={u} size={30} />
            <div className="search-user">
              <strong>{u.name}</strong>
              <span className="muted small">{u.email}</span>
            </div>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => invite(u.email)}>
              Ajouter
            </button>
          </li>
        ))}
        {query.length >= 2 && results.length === 0 && (
          <li className="muted small">Aucun utilisateur trouvé.</li>
        )}
      </ul>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Modal>
  )
}
