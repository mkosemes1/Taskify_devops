# Taskify — Frontend (React)

Interface web de l'application de gestion de projets collaborative (type Trello/Jira).
Le frontend ne contient **aucune donnée simulée** : toutes les requêtes partent vers le
backend Django via `src/api/client.js`.

## Stack

| Élément | Technologie |
|---|---|
| Framework | React 18 |
| Bundler | Vite 5 |
| Routage | react-router-dom 6 (routes protégées) |
| Styles | CSS pur (design system dans `src/styles/index.css`) |
| Lint | ESLint (`eslint` + `eslint-plugin-react`) |
| API | REST + JWT Bearer (backend Django) |

## Fonctionnalités

- **Auth** : inscription, connexion, déconnexion (tokens JWT stockés dans `localStorage`).
- **Projets** : création, modification, suppression, évaluation par étoiles (moyenne),
  barre d'avancement, filtres/recherche, statut actif/clôturé.
- **Tableau Kanban** : colonnes *À faire / En cours / Terminé*, glisser-déposer natif,
  création/édition/suppression de tâches, priorités, échéances (alerte « en retard »).
- **Membres & droits** : invitation par email, changement de rôle
  (propriétaire / administrateur / membre / observateur), retrait, matrice des permissions.
- **Suivi** : statistiques, journal d'activité, répartition des tâches par membre.
- **Clôture** : bouton actif uniquement quand toutes les tâches sont terminées,
  projet clôturé en lecture seule (réouverture possible).

## Structure

```
frontend/
├── index.html
├── vite.config.js            # proxy /api → backend (:8000) en dev
├── Dockerfile                # multi-stage : node build → nginx
├── nginx.conf                # SPA + proxy /api → backend:8000
└── src/
    ├── main.jsx              # BrowserRouter + providers
    ├── App.jsx               # routes (protégées / invité)
    ├── api/client.js         # client REST unique + gestion JWT
    ├── context/              # AuthContext, ToastContext
    ├── utils/                # permissions (matrice des rôles), helpers projet
    ├── components/           # Modal, Avatar, StarRating, ProgressBar, Tabs…
    ├── pages/                # Login, Register, Dashboard, ProjectDetail,
    │                         # Members, Activity, ProjectSettings
    └── styles/index.css      # design system complet
```

## Démarrage en développement

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=/api
npm run dev               # http://localhost:5173
```

Le backend doit tourner sur `:8000` (le proxy Vite redirige `/api`).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev Vite (HMR, port 5173) |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert le build `dist/` |
| `npm run lint` | ESLint sur `src/` |

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | préfixe de l'API. Vide/absent = proxy `/api` (dev et prod nginx) |

## Conteneurisation

```bash
# inclus dans docker-compose.yml à la racine
docker compose build frontend
docker compose up -d
# application sur http://localhost (nginx)
```

- **Étape 1** (`node:20-alpine`) : `npm ci` puis `npm run build`
  avec `ARG VITE_API_URL` (défaut `/api`).
- **Étape 2** (`nginx:1.27-alpine`) : sert `dist/` avec fallback SPA
  (`try_files … /index.html`) et proxifie `/api/` vers `http://backend:8000/api/`
  sur le réseau interne de docker-compose.

## Notes

- Plus aucune API simulée : `mockBackend.js` a été supprimé, tout est branché sur le backend.
- Les réponses d'erreur backend (`{"message": …}`) sont affichées telles quelles (toasts, formulaires).
- Les pages `/projects/:id/*` (tableau, membres, activité, réglages) partagent l'ongletterie `ProjectTabs`.
