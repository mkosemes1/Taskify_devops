"""Règles d'accès par rôle — miroir exact de la matrice du frontend."""
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied

from .models import Activity, Membership, Project

ROLE_PERMISSIONS = {
    Membership.ROLE_OWNER: {'*'},
    Membership.ROLE_ADMIN: {
        'project.view',
        'project.edit',
        'project.rate',
        'project.close',
        'member.add',
        'member.edit',
        'member.remove',
        'task.view',
        'task.create',
        'task.edit',
        'task.delete',
        'task.move',
        'task.assign',
    },
    Membership.ROLE_MEMBER: {
        'project.view',
        'project.rate',
        'task.view',
        'task.create',
        'task.edit',
        'task.delete',
        'task.move',
        'task.assign',
    },
    Membership.ROLE_VIEWER: {
        'project.view',
        'task.view',
    },
}


def role_can(role, permission):
    grants = ROLE_PERMISSIONS.get(role, set())
    return '*' in grants or permission in grants


def log_activity(project, user, action, detail):
    Activity.objects.create(project=project, user=user, action=action, detail=detail)


def get_membership_or_404(project_id, user):
    """Charge un projet et l'appartenance de l'utilisateur, ou lève 404/403."""
    project = Project.objects.filter(pk=project_id).first()
    if project is None:
        raise NotFound('Projet introuvable')
    membership = Membership.objects.filter(project=project, user=user).first()
    if membership is None:
        raise DRFPermissionDenied('Accès refusé')
    return project, membership


def require_permission(membership, permission):
    if not role_can(membership.role, permission):
        raise DRFPermissionDenied('Permission refusée')


def require_writable_project(project):
    if project.is_closed:
        raise DRFPermissionDenied('Projet clôturé, lecture seule')


def require_admin(membership):
    if membership.role not in (Membership.ROLE_OWNER, Membership.ROLE_ADMIN):
        raise DRFPermissionDenied('Permission refusée')


__all__ = [
    'role_can',
    'log_activity',
    'get_membership_or_404',
    'require_permission',
    'require_writable_project',
    'require_admin',
]
