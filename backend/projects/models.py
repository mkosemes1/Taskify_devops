from django.conf import settings
from django.db import models


class Project(models.Model):
    """Projet Taskify : créé par un utilisateur, partagé via des memberships et des tâches."""

    STATUS_ACTIVE = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'En cours'),
        (STATUS_COMPLETED, 'Clôturé'),
    ]

    name = models.CharField('nom', max_length=200)
    description = models.TextField('description', blank=True)
    due_date = models.DateField('date limite', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    # Date de clôture, vide tant que le projet est actif
    closed_at = models.DateTimeField(null=True, blank=True)
    # PROTECT : un projet avec des références ne peut pas être supprimé par cascade
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_projects',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name

    @property
    def is_closed(self):
        """Vrai si le projet a été clôturé (lecture seule pour les vues)."""
        return self.status == self.STATUS_COMPLETED


class Membership(models.Model):
    """Lien (projet, utilisateur) portant le rôle qui détermine les permissions."""

    ROLE_OWNER = 'owner'
    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'
    ROLE_VIEWER = 'viewer'
    ROLE_CHOICES = [
        (ROLE_OWNER, 'Propriétaire'),
        (ROLE_ADMIN, 'Administrateur'),
        (ROLE_MEMBER, 'Membre'),
        (ROLE_VIEWER, 'Observateur'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    # Un seul rôle par membre ; ROLE_MEMBER est la valeur par défaut
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            # Un utilisateur ne peut être membre d'un projet qu'une seule fois
            models.UniqueConstraint(fields=['project', 'user'], name='unique_project_member'),
        ]

    def __str__(self):
        return f'{self.user} — {self.project} ({self.role})'


class Task(models.Model):
    """Tâche d'un projet, avec statut (kanban), priorité et responsable optionnel."""

    STATUS_TODO = 'todo'
    STATUS_DOING = 'doing'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_TODO, 'À faire'),
        (STATUS_DOING, 'En cours'),
        (STATUS_DONE, 'Terminé'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH = 'high'
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Basse'),
        (PRIORITY_MEDIUM, 'Moyenne'),
        (PRIORITY_HIGH, 'Haute'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField('titre', max_length=200)
    description = models.TextField('description', blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_TODO)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    # SET_NULL : la tâche reste si son responsable quitte le projet
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
    )
    due_date = models.DateField('échéance', null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_tasks',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class ProjectRating(models.Model):
    """Note de 1 à 5 donnée par un utilisateur à un projet (une seule par utilisateur)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='ratings')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_ratings',
    )
    rating = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Une seule note par couple (projet, utilisateur)
            models.UniqueConstraint(fields=['project', 'user'], name='unique_project_rating'),
        ]

    def __str__(self):
        return f'{self.project} ★{self.rating}'


class Activity(models.Model):
    """Trace horodatée d'une action sur un projet (journal visible par l'équipe)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activity')
    # SET_NULL : le journal est conservé même si l'auteur est supprimé
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='activities',
    )
    # Code technique de l'action, ex : 'task.create'
    action = models.CharField(max_length=40)
    # Phrase lisible affichée dans le journal, ex : « a créé la tâche « X » »
    detail = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action}: {self.detail}'
