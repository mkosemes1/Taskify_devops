// Layout applicatif des pages protégées : barre du haut (marque,
// utilisateur, déconnexion) et zone de contenu où les routes
// enfant sont rendues via <Outlet />.

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './Avatar'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Déconnexion puis redirection vers la page de connexion
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">T</span> Taskify
        </NavLink>
        <div className="topbar-right">
          <span className="user-chip">
            <Avatar user={user} size={28} />
            {user?.name}
          </span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
