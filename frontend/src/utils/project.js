export const COLUMNS = [
  { id: 'todo', title: 'À faire', accent: '#868e96' },
  { id: 'doing', title: 'En cours', accent: '#f59f00' },
  { id: 'done', title: 'Terminé', accent: '#2f9e6e' },
]

export const PRIORITIES = {
  low: { label: 'Basse', color: '#4dabf7' },
  medium: { label: 'Moyenne', color: '#f59f00' },
  high: { label: 'Haute', color: '#fa5252' },
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const isOverdue = (dateStr, status) => {
  if (!dateStr || status === 'done') return false
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export const progressOf = (tasks) => {
  if (!tasks.length) return 0
  return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
}
