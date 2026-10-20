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

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
