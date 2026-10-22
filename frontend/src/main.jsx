// Point d'entrée de l'application React.
// Monte l'arbre de composants dans le conteneur #root du index.html.
// Enveloppe l'app dans les providers globaux : routeur, toasts, authentification.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import './styles/index.css'

// Ordre des providers : le plus externe (Toast) doit être disponible pour les autres.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
