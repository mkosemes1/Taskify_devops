"""Administration Django des modèles de l'app projets (projets, membres, tâches)."""
from django.contrib import admin

from .models import Activity, Membership, Project, ProjectRating, Task


class MembershipInline(admin.TabularInline):
    """Édition des membres directement dans la fiche d'un projet."""

    model = Membership
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'created_by', 'due_date', 'updated_at')
    list_filter = ('status',)
    search_fields = ('name', 'description')
    inlines = [MembershipInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'project', 'role', 'created_at')
    list_filter = ('role',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'status', 'priority', 'assignee', 'due_date')
    list_filter = ('status', 'priority')
    search_fields = ('title', 'description')


@admin.register(ProjectRating)
class ProjectRatingAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'rating')


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'action', 'detail', 'created_at')
    list_filter = ('action',)
