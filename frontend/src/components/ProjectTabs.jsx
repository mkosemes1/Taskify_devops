// Onglets de navigation d'un projet (Tableau, Membres, Activité, Réglages).
// Utilise NavLink pour que l'onglet actif reçoive automatiquement
// la classe CSS tab-active (via isActive).

import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '', end: true, label: 'Tableau' }, // end : correspond exactement à /projects/:id
  { to: '/members', label: 'Membres' },
  { to: '/activity', label: 'Activité' },
  { to: '/settings', label: 'Réglages' },
]

export default function ProjectTabs({ projectId }) {
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={`/projects/${projectId}${t.to}`}
          end={t.end}
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
