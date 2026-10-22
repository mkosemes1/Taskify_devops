"""Routes de l'API projets/membres/tâches — incluses sous /api/ par config/urls.py."""
from django.urls import path

from accounts.views import UserSearchView

from .views import (
    MemberDetailView,
    MemberListCreateView,
    ProjectCloseView,
    ProjectDetailView,
    ProjectListCreateView,
    ProjectRateView,
    TaskDetailView,
    TaskListCreateView,
)

urlpatterns = [
    # Recherche d'utilisateurs (invitation d'un membre par email)
    path('users', UserSearchView.as_view(), name='user-search'),
    # Projets : liste/création, détail, notation, clôture
    path('projects', ProjectListCreateView.as_view(), name='project-list'),
    path('projects/<int:project_id>', ProjectDetailView.as_view(), name='project-detail'),
    path('projects/<int:project_id>/rate', ProjectRateView.as_view(), name='project-rate'),
    path('projects/<int:project_id>/close', ProjectCloseView.as_view(), name='project-close'),
    # Membres : liste/ajout d'un projet, gestion d'un membre (rôle, retrait)
    path('projects/<int:project_id>/members', MemberListCreateView.as_view(), name='member-list'),
    path('members/<int:member_id>', MemberDetailView.as_view(), name='member-detail'),
    # Tâches : liste/création dans un projet, détail d'une tâche
    path('projects/<int:project_id>/tasks', TaskListCreateView.as_view(), name='task-list'),
    path('tasks/<int:task_id>', TaskDetailView.as_view(), name='task-detail'),
]
