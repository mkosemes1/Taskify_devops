// Contexte des toasts : notifications éphémères (succès, erreur, info)
// affichées en bas d'écran et retirées automatiquement après 4 secondes.
// Utilisable partout via le hook useToast().success / .error / .info.

import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0) // compteur incrémenté sans provoquer de rendu

  const push = useCallback((message, type = 'success') => {
    const id = ++counter.current
    setToasts((list) => [...list, { id, message, type }])
    // Retire le toast après 4 s (setTimeout non nettoyé mais inoffensif ici)
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000)
  }, [])

  // API exposée aux composants : toast.success('…'), toast.error('…'), …
  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Pile de toasts rendus en overlay, au-dessus de la page */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-dot" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Hook d'accès au contexte ; lève une erreur hors <ToastProvider>
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
