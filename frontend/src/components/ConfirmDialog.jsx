// Boîte de dialogue de confirmation (suppression, clôture…).
// Attend une fonction asynchrone `onConfirm` ; affiche une erreur
// si celle-ci échoue, et ferme le modal seulement en cas de succès.

import { useState } from 'react'
import Modal from './Modal'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirmer', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose() // fermeture uniquement si l'action a réussi
    } catch (e) {
      setError(e.message) // l'erreur reste affichée dans le modal
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="confirm-message">{message}</p>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={handle} disabled={busy}>
          {busy ? '...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
