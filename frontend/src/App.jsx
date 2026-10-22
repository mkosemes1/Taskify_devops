// Déclaration des routes de l'application.
// Deux wrappers protègent l'accès : <Guest> redirige les utilisateurs déjà
// connectés, <Protected> exige une session pour afficher les pages privées.

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Members from './pages/Members'
import ProjectSettings from './pages/ProjectSettings'
import Activity from './pages/Activity'

// Route privée : redirige vers /login si non connecté.
function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Route « invité » : redirige vers / si déjà connecté (login / inscription).
function Guest({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader">Chargement…</div>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <Login />
          </Guest>
        }
      />
      <Route
        path="/register"
        element={
          <Guest>
            <Register />
          </Guest>
        }
      />
      {/* Routes privées : imbriquées dans Layout (barre de navigation commune). */}
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/members" element={<Members />} />
        <Route path="/projects/:id/activity" element={<Activity />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
      </Route>
      {/* Fallback : toute URL inconnue renvoie au tableau de bord. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
