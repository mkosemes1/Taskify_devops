"""Racine des URL : administration Django + deux groupes d'API (auth et projets)."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Administration Django
    path('admin/', admin.site.urls),
    # Auth (JWT) : /api/auth/...
    path('api/auth/', include('accounts.urls')),
    # Projets, membres et tâches : /api/projects, /api/tasks, /api/users...
    path('api/', include('projects.urls')),
]
