import secrets

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    """Manager : l'email est le seul identifiant (pas de username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('name', extra_fields.get('name', 'Admin'))
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Le superuser doit avoir is_staff=True')
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Utilisateur Taskify : l'email sert d'identifiant de connexion."""

    username = None
    email = models.EmailField('email', unique=True)
    name = models.CharField('nom complet', max_length=150)
    avatar_color = models.CharField(max_length=20, default='#7c5cff')

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        verbose_name = 'utilisateur'
        ordering = ['-date_joined']

    def __str__(self):
        return f'{self.name} <{self.email}>'

    @staticmethod
    def random_avatar_color():
        hue = secrets.randbelow(360)
        return f'hsl({hue}, 60%, 55%)'

    def save(self, *args, **kwargs):
        if not self.avatar_color or self.avatar_color == '#7c5cff':
            self.avatar_color = self.random_avatar_color()
        super().save(*args, **kwargs)
