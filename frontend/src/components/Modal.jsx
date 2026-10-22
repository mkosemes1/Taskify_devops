// Composant Modal générique réutilisé dans toute l'application.
// Affiche un fond semi-transparent (backdrop) : cliquer dessus ferme
// le modal. Le contenu est passé via `children`, le pied via `footer`.

export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  return (
    // onMouseDown + vérification e.target === currentTarget : ferme uniquement
    // si on clique sur le fond, pas si on clique dans le contenu du modal
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
