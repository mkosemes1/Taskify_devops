// Constantes et utilitaires liés aux projets et aux tâches Kanban :
// colonnes du tableau, niveaux de priorité, formatage de dates,
// détection de retard et calcul de pourcentage d'avancement.

// Colonnes du tableau Kanban (utilisées dans ProjectDetail.jsx)
export const COLUMNS = [
  { id: 'todo', title: 'À faire', accent: '#868e96' },
  { id: 'doing', title: 'En cours', accent: '#f59f00' },
  { id: 'done', title: 'Terminé', accent: '#2f9e6e' },
]

// Niveaux de priorité des tâches, avec libellé et couleur d'affichage
export const PRIORITIES = {
  low: { label: 'Basse', color: '#4dabf7' },
  medium: { label: 'Moyenne', color: '#f59f00' },
  high: { label: 'Haute', color: '#fa5252' },
}

// Formate une date ISO en « 15 mars 2025 » (français, sans heure)
export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Vrai si l'échéance est passée ET que la tâche n'est pas terminée
export const isOverdue = (dateStr, status) => {
  if (!dateStr || status === 'done') return false
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0) // minuit courant : compare les jours, pas les heures
  return due < today
}

// Pourcentage d'avancement d'un projet (0 si aucune tâche)
export const progressOf = (tasks) => {
  if (!tasks.length) return 0
  return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
}
