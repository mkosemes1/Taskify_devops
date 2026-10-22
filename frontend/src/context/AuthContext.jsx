// Contexte d'authentification : partage l'état de l'utilisateur connecté
// (user, loading) et les fonctions login / register / logout / refresh
// dans toute l'application via le hook useAuth().

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiClient } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true tant que la session n'est pas vérifiée

  // Recharge l'utilisateur courant depuis le serveur (token en localStorage)
  const refresh = useCallback(async () => {
    try {
      setUser(await ApiClient.me())
    } catch {
      setUser(null) // pas de session valide
    }
  }, [])

  // --- Vérification de session au montage ---
  // `alive` évite de mettre à jour l'état si le composant est démonté
  // pendant que la requête est en vol (nettoyage du useEffect).
  useEffect(() => {
    let alive = true
    ApiClient.me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // --- Actions d'authentification ---
  const login = useCallback(async (credentials) => {
    const u = await ApiClient.login(credentials)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (payload) => {
    const u = await ApiClient.register(payload)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await ApiClient.logout()
    setUser(null)
  }, [])

  // useMemo : l'objet de contexte n'est recréé que si une de ses dépendances change
  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook d'accès au contexte ; lève une erreur hors <AuthProvider>
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
