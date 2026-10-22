// Page d'inscription : création d'un compte (nom, email, mot de passe).
// Vérifie côté client que la confirmation du mot de passe correspond
// avant d'appeler AuthContext.register.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // --- Gestion de la soumission du formulaire ---
  const submit = async (e) => {
    e.preventDefault()
    // Contrôle de cohérence des deux mots de passe avant l'appel API
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setBusy(true)
    setError('')
    try {
      const user = await register({ name: form.name, email: form.email, password: form.password })
      toast.success(`Compte créé, bienvenue ${user.name} !`)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Générateur de handler : set('email') renvoie un onChange pour ce champ
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <span className="brand-mark brand-mark-lg">T</span>
        <h1>Taskify</h1>
        <p>Inscrivez-vous pour créer vos projets, inviter votre équipe et organiser vos tâches en colonnes.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Inscription</h2>
        {error && <div className="form-error">{error}</div>}
        <label>
          Nom complet
          <input required placeholder="Ada Lovelace" value={form.name} onChange={set('name')} />
        </label>
        <label>
          Email
          <input type="email" required autoComplete="email" placeholder="vous@exemple.com" value={form.email} onChange={set('email')} />
        </label>
        <label>
          Mot de passe
          <input type="password" required autoComplete="new-password" placeholder="6 caractères min." value={form.password} onChange={set('password')} />
        </label>
        <label>
          Confirmation
          <input type="password" required autoComplete="new-password" placeholder="Retapez le mot de passe" value={form.confirm} onChange={set('confirm')} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <p className="auth-switch">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  )
}
