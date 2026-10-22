from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Profil utilisateur public en camelCase (aucun champ sensible, lecture seule)."""

    avatarColor = serializers.CharField(source='avatar_color', read_only=True)
    createdAt = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'avatarColor', 'createdAt']
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    """Inscription : email unique, mot de passe validé par Django, nom requis."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['name', 'email', 'password']

    def validate_email(self, value):
        """Normalise l'email et refuse un doublon d'inscription."""
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Cet email est déjà utilisé')
        return email

    def create(self, validated_data):
        """Crée l'utilisateur via le manager (hash du mot de passe + couleur d'avatar)."""
        return User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'].strip(),
            password=validated_data['password'],
            avatar_color=User.random_avatar_color(),
        )
