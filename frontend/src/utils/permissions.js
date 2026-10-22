// Système de permissions basé sur les rôles (RBAC simplifié).
// Chaque rôle possède une liste de permissions (ex : 'task.create').
// La fonction can(role, permission) est utilisée dans les pages pour
// afficher ou masquer les boutons et actions selon le rôle de l'utilisateur.

// Rôles disponibles dans un projet, avec libellé et couleur d'affichage
export const ROLES = {
  owner: { label: 'Propriétaire', color: '#7c5cff' },
  admin: { label: 'Administrateur', color: '#f59f00' },
  member: { label: 'Membre', color: '#2f9e6e' },
  viewer: { label: 'Observateur', color: '#868e96' },
}

// Liste des clés de rôles (utilisée pour les selects et la matrice)
export const ROLE_OPTIONS = Object.keys(ROLES)

// Matrice rôle → permissions accordées.
// Le propriétaire reçoit '*' : il a toutes les permissions.
const MATRIX = {
  owner: ['*'],
  admin: [
    'project.view',
    'project.edit',
    'project.rate',
    'project.close',
    'member.add',
    'member.edit',
    'member.remove',
    'task.view',
    'task.create',
    'task.edit',
    'task.delete',
    'task.move',
    'task.assign',
  ],
  member: [
    'project.view',
    'project.rate',
    'task.view',
    'task.create',
    'task.edit',
    'task.delete',
    'task.move',
    'task.assign',
  ],
  viewer: ['project.view', 'task.view'], // lecture seule
}

// Vérifie si un rôle possède une permission ('*' = toutes les permissions)
export function can(role, permission) {
  const grants = MATRIX[role]
  if (!grants) return false
  return grants.includes('*') || grants.includes(permission)
}

// Libellés lisibles des permissions (affichés dans la matrice de Members.jsx)
export const PERMISSIONS = {
  'project.edit': 'Modifier les informations du projet',
  'project.rate': 'Évaluer le projet',
  'project.close': 'Clôturer le projet',
  'member.add': 'Ajouter des membres',
  'member.edit': 'Changer les rôles',
  'member.remove': 'Retirer des membres',
  'task.create': 'Créer des tâches',
  'task.edit': 'Modifier les tâches',
  'task.delete': 'Supprimer des tâches',
  'task.move': 'Déplacer les tâches',
  'task.assign': 'Attribuer des tâches',
}
