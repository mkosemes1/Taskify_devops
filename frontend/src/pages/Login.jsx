// Page de connexion : formulaire email + mot de passe.
// Appelle AuthContext.login, affiche un toast de bienvenue puis redirige
// vers le tableau de bord en cas de succès.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false) // désactive le bouton pendant l'appel API

  // --- Gestion de la soumission du formulaire ---
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(form)
      toast.success(`Bienvenue, ${user.name} !`)
      navigate('/')
    } catch (err) {
      setError(err.message) // message renvoyé par le client API
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <span className="brand-mark brand-mark-lg">T</span>
        <h1>Taskify</h1>
        <p>Créez vos espaces de travail, pilotez vos tableaux Kanban et suivez l'avancement de vos projets en temps réel.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Connexion</h2>
        {error && <div className="form-error">{error}</div>}
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="auth-switch">
          Pas encore de compte ? <Link to="/register">S'inscrire</Link>
        </p>
      </form>
    </div>
  )
}
