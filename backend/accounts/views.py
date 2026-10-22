from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


def token_payload(user):
    """Construit la réponse d'authentification : tokens JWT + profil utilisateur."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }


class RegisterView(APIView):
    """Inscription d'un compte — ouverte à tous (AllowAny)."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Crée le compte puis renvoie directement access, refresh et user (201)."""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(token_payload(user), status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """Connexion (ouverte à tous) : renvoie access + refresh + profil utilisateur.

    La vue par défaut de simplejwt ne renvoie que les tokens ; le frontend
    attend aussi l'objet `user` pour afficher le nom immédiatement.
    """

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """Authentifie puis renvoie {access, refresh, user} (même forme que /register)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            {
                'access': serializer.validated_data['access'],
                'refresh': serializer.validated_data['refresh'],
                'user': UserSerializer(serializer.user).data,
            }
        )


class LogoutView(APIView):
    """Déconnexion — authentification requise, blacklist du refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Invalide le refresh token fourni (best effort) puis confirme la déconnexion."""
        refresh = request.data.get('refresh')
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except (InvalidToken, TokenError):
                pass
        return Response({'message': 'Déconnexion réussie'}, status=status.HTTP_200_OK)


class MeView(APIView):
    """Profil de l'utilisateur connecté — authentification requise."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Renvoie les champs publics de l'utilisateur courant (nom, email, avatar)."""
        return Response(UserSerializer(request.user).data)


class UserSearchView(APIView):
    """Recherche d'utilisateurs pour une invitation — authentification requise."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Filtre par email ou nom (?search=, min. 2 caractères), 6 résultats maximum."""
        q = (request.query_params.get('search') or '').strip().lower()
        if len(q) < 2:
            return Response([])
        users = User.objects.filter(email__icontains=q) | User.objects.filter(
            name__icontains=q
        )
        users = users.distinct()[:6]
        return Response(UserSerializer(users, many=True).data)
