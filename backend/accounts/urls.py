"""Routes d'authentification (JWT) — incluses sous /api/auth/ par config/urls.py."""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, LogoutView, MeView, RegisterView

urlpatterns = [
    # Auth : inscription, connexion, rafraîchissement du token d'accès
    path('register', RegisterView.as_view(), name='auth-register'),
    path('login', LoginView.as_view(), name='auth-login'),
    path('refresh', TokenRefreshView.as_view(), name='auth-refresh'),
    # Auth : déconnexion (blacklist) et profil de l'utilisateur connecté
    path('logout', LogoutView.as_view(), name='auth-logout'),
    path('me', MeView.as_view(), name='auth-me'),
]
