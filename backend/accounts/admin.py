"""Administration Django du compte utilisateur Taskify (formulaires sans username)."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .forms import TaskifyUserChangeForm, TaskifyUserCreationForm
from .models import User


@admin.register(User)
class TaskifyUserAdmin(UserAdmin):
    add_form = TaskifyUserCreationForm
    form = TaskifyUserChangeForm
    list_display = ('email', 'name', 'is_staff', 'date_joined')
    search_fields = ('email', 'name')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'password', 'name', 'avatar_color')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'fields': ('email', 'name', 'password1', 'password2')}),
    )
    filter_horizontal = ('groups', 'user_permissions')
