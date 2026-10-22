// Barre de progression horizontale.
// La valeur est bornée entre 0 et 100 ; la couleur change selon
// l'avancement : gris (0 %), violet (en cours), vert (100 %).

export default function ProgressBar({ value = 0, height = 8 }) {
  const v = Math.max(0, Math.min(100, value)) // clamp pour éviter tout débordement
  const color = v === 100 ? '#2f9e6e' : v > 0 ? '#7c5cff' : '#dee2e6'
  return (
    <div className="progress" style={{ height }}>
      <div className="progress-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}
