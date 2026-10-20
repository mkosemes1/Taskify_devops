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
      onClose()
    } catch (e) {
      setError(e.message)
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
