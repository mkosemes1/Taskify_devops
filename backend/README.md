# Taskify — Backend (Django)

API REST qui alimente le frontend React : authentification JWT, projets, membres
avec rôles, tâches Kanban et journal d'activité. **PostgreSQL est la seule base
de données** (aucun fallback SQLite).

## Stack

| Élément | Technologie |
|---|---|
| Framework | Django 6 + Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) — access 60 min / refresh 7 j (rotation + blacklist) |
| Base | PostgreSQL (psycopg 3) |
| CORS | django-cors-headers (frontend Vite) |
| Statique | WhiteNoise (`collectstatic`) |
| Serveur | gunicorn (conteneur) / runserver (dev) |
| Tests | Django test runner (24 tests) sur PostgreSQL |

## Structure

```
backend/
├── manage.py
├── requirements.txt
├── entrypoint.sh             # conteneur : attend la BDD → migrate → collectstatic → gunicorn
├── Dockerfile                # python:3.13-slim + gunicorn
├── .env.example              # variables d'environnement
├── config/
│   ├── settings.py           # env-driven, REST, JWT, CORS, PostgreSQL
│   ├── urls.py               # /api/auth/… et /api/…
│   └── exceptions.py         # forme d'erreur unique : {"message": …}
├── accounts/                 # User (email = identifiant), auth, recherche d'utilisateurs
└── projects/                 # Project, Membership, Task, ProjectRating, Activity
```

## Modèles

- **User** : `email` (USERNAME_FIELD), `name`, `avatar_color` — pas de `username`.
- **Project** : nom, description, `due_date`, statut `active | completed`, `closed_at`.
- **Membership** : `project + user` unique, rôle `owner | admin | member | viewer`.
- **Task** : titre, description, statut `todo | doing | done`,
  priorité `low | medium | high`, `assignee` (membre du projet), `due_date`.
- **ProjectRating** : note 1-5 par utilisateur et par projet (moyenne calculée).
- **Activity** : journal (`project.create`, `task.status`, `member.role`…).

## Endpoints

Toutes les routes sont sous `/api/`, réponse en **camelCase**, erreurs au format
`{"message": "…", "detail": "…", "status": 400}`.

### Authentification (`/api/auth`)
| Méthode | Route | Rôle |
|---|---|---|
| POST | `/register` | public → `{access, refresh, user}` |
| POST | `/login` | public (email + mot de passe) → `{access, refresh, user}` |
| POST | `/refresh` | public → nouveau `access` |
| POST | `/logout` | connecté (blackliste le refresh) |
| GET | `/me` | connecté → profil |

### Projets
| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/projects` | mes projets (compteurs pré-calculés : `taskCount`, `doneCount`, `memberCount`, `rating`…) |
| POST | `/api/projects` | connecté → crée + devient `owner` |
| GET | `/api/projects/:id` | membre → projet + `tasks` + `members` + `stats` + `activity` |
| PUT | `/api/projects/:id` | `project.edit` |
| DELETE | `/api/projects/:id` | créateur du projet |
| POST | `/api/projects/:id/rate` | `project.rate` (1-5) |
| POST | `/api/projects/:id/close` | `project.close` — refusé si tâches non terminées |

### Membres
| Méthode | Route | Permission |
|---|---|---|
| GET/POST | `/api/projects/:id/members` | lecture / `member.add` (par email) |
| PUT | `/api/members/:id` | `member.edit` (changement de rôle) |
| DELETE | `/api/members/:id` | `member.remove` ou quitter soi-même |

### Tâches
| Méthode | Route | Permission |
|---|---|---|
| GET/POST | `/api/projects/:id/tasks` | `task.view` / `task.create` |
| PUT | `/api/tasks/:id` | `task.edit` |
| DELETE | `/api/tasks/:id` | `task.delete` |

### Utilisateurs
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/users?search=…` | connecté (invitation d'un membre, ≥ 2 caractères) |

## Permissions par rôle (`projects/permissions.py`)

| Permission | owner | admin | member | viewer |
|---|:--:|:--:|:--:|:--:|
| Voir le projet / les tâches | ✓ | ✓ | ✓ | ✓ |
| Modifier le projet, clôturer, gérer les membres | ✓ | ✓ | | |
| Évaluer le projet | ✓ | ✓ | ✓ | |
| Créer / modifier / déplacer / supprimer / attribuer des tâches | ✓ | ✓ | ✓ | |

Règles supplémentaires :
- un projet **clôturé** est en lecture seule (403 sur toute écriture) ;
- le projet doit toujours garder **au moins un propriétaire** ;
- seul le **créateur** peut supprimer un projet ;
- assigner une tâche exige que l'utilisateur soit **membre du projet**.

## Variables d'environnement (`.env`)

| Variable | Défaut | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | valeur de dev | **à changer en production** |
| `DJANGO_DEBUG` | `1` | `0` en production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | hôtes acceptés |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `taskify` | base PostgreSQL |
| `DB_HOST` / `DB_PORT` | `localhost` / `5434` | `db` / `5432` dans docker-compose |
| `CORS_ALLOWED_ORIGINS` | `http://localhost` | origines autorisées (dev Vite : `http://localhost:5173`) |

## Démarrage en développement

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                # DB_PORT=5434 → conteneur taskify-db
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 8000
```

> La base PostgreSQL tourne via `docker compose up -d db` (port `5434`).
> Attention : le port **8080 est déjà occupé par Jenkins** sur cette machine.

### Admin Django
```bash
.venv/bin/python manage.py createsuperuser   # http://localhost:8000/admin/
```

## Tests

```bash
cd backend
.venv/bin/python manage.py test            # 24 tests, base test_taskify sur PostgreSQL
.venv/bin/python manage.py test projects   # une seule app
```

Couverture : auth JWT, CRUD projets, invitations/rôles, permissions par rôle
(viewer en lecture seule), clôture conditionnelle, lecture seule après clôture,
journal d'activité.

## Conteneurisation

```bash
# inclus dans docker-compose.yml à la racine
docker compose build backend
docker compose up -d backend
docker compose logs -f backend
```

`entrypoint.sh` : boucle d'attente → `migrate` → `collectstatic` → `gunicorn`
sur `0.0.0.0:8000` (3 workers). Le service n'expose pas de port hôte :
nginx (`frontend`) proxifie `/api/` vers `backend:8000` sur le réseau interne.

## Commandes utiles

```bash
docker compose exec db psql -U taskify -d taskify   # requêter PostgreSQL
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```
