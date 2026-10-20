import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiClient } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser(await ApiClient.me())
    } catch {
      setUser(null)
    }
  }, [])

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

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
