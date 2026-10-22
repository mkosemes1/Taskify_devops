from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, Count, OuterRef, Q, Subquery
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Membership, Project, ProjectRating, Task
from .permissions import (
    get_membership_or_404,
    log_activity,
    require_permission,
    require_writable_project,
)
from .serializers import (
    ActivitySerializer,
    MemberInviteSerializer,
    MembershipSerializer,
    ProjectCreateSerializer,
    ProjectSerializer,
    RateSerializer,
    RoleSerializer,
    TaskSerializer,
)

User = get_user_model()


def project_queryset_for(user):
    """Projets accessibles par l'utilisateur, avec les compteurs pré-agrégés."""
    membership_role = (
        Membership.objects.filter(project=OuterRef('pk'), user=user).values('role')[:1]
    )
    member_count = (
        Membership.objects.filter(project=OuterRef('pk'))
        .values('project')
        .annotate(c=Count('id'))
        .values('c')
    )
    rating_agg = (
        ProjectRating.objects.filter(project=OuterRef('pk'))
        .values('project')
        .annotate(avg=Avg('rating'), c=Count('id'))
        .values('avg', 'c')
    )
    return (
        Project.objects.filter(memberships__user=user)
        .annotate(
            role=Subquery(membership_role),
            task_count=Count('tasks', distinct=True),
            done_count=Count('tasks', filter=Q(tasks__status=Task.STATUS_DONE), distinct=True),
            member_count=Subquery(member_count),
            rating_avg=Subquery(rating_agg.values('avg')),
            rating_count=Subquery(rating_agg.values('c')),
        )
        .distinct()
    )


def project_detail_payload(project, user, membership):
    """Payload complet du projet : infos, tâches, membres, statistiques et activité."""
    tasks = project.tasks.all()
    members = project.memberships.select_related('user').all()
    activity = project.activity.select_related('user')[:30]
    data = ProjectSerializer(project, context={'user': user}).data
    data.update(
        {
            'role': membership.role,
            'tasks': TaskSerializer(tasks, many=True).data,
            'members': MembershipSerializer(members, many=True).data,
            'stats': {
                'total': tasks.count(),
                'todo': tasks.filter(status=Task.STATUS_TODO).count(),
                'doing': tasks.filter(status=Task.STATUS_DOING).count(),
                'done': tasks.filter(status=Task.STATUS_DONE).count(),
            },
            'activity': ActivitySerializer(activity, many=True).data,
        }
    )
    return data


class ProjectListCreateView(APIView):
    """Liste et création des projets de l'utilisateur connecté (authentification requise).

    GET  : renvoie les projets dont l'utilisateur est membre.
    POST : crée un projet ; le créateur devient automatiquement propriétaire.
    """

    def get(self, request):
        """Liste les projets accessibles à l'utilisateur, avec leurs compteurs."""
        projects = project_queryset_for(request.user)
        return Response(ProjectSerializer(projects, many=True, context={'user': request.user}).data)

    def post(self, request):
        """Crée le projet et le membership « propriétaire », puis renvoie le projet (201)."""
        serializer = ProjectCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            project = Project.objects.create(
                name=serializer.validated_data['name'],
                description=serializer.validated_data.get('description', ''),
                due_date=serializer.validated_data.get('due_date'),
                created_by=request.user,
            )
            Membership.objects.create(
                project=project, user=request.user, role=Membership.ROLE_OWNER
            )
            log_activity(project, request.user, 'project.create', f'a créé le projet « {project.name} »')
        data = ProjectSerializer(project, context={'user': request.user}).data
        return Response(data, status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    """Détail, modification et suppression d'un projet.

    L'accès exige d'être membre du projet, sinon 404/403 (get_membership_or_404).
    """

    def get_object(self, request, project_id):
        """Renvoie (projet, membership de l'appelant), ou 404/403 s'il n'est pas membre."""
        return get_membership_or_404(project_id, request.user)

    def get(self, request, project_id):
        """Détail complet : tâches, membres, statistiques et journal d'activité."""
        project, membership = self.get_object(request, project_id)
        return Response(project_detail_payload(project, request.user, membership))

    def put(self, request, project_id):
        """Mise à jour partielle — permission 'project.edit' et projet non clôturé."""
        project, membership = self.get_object(request, project_id)
        require_permission(membership, 'project.edit')
        require_writable_project(project)
        serializer = ProjectCreateSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(project, request.user, 'project.update', 'a mis à jour les informations du projet')
        return Response(ProjectSerializer(project, context={'user': request.user}).data)

    def delete(self, request, project_id):
        """Suppression — réservée au créateur du projet (403 sinon)."""
        project, _ = self.get_object(request, project_id)
        if project.created_by_id != request.user.id:
            raise PermissionDenied('Seul le créateur peut supprimer')
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectRateView(APIView):
    """Notation d'un projet — POST, permission 'project.rate' (membre du projet)."""

    def post(self, request, project_id):
        """Note le projet de 1 à 5 ; remplace la note précédente de l'utilisateur."""
        project, membership = get_membership_or_404(project_id, request.user)
        require_permission(membership, 'project.rate')
        serializer = RateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ProjectRating.objects.update_or_create(
            project=project,
            user=request.user,
            defaults={'rating': serializer.validated_data['rating']},
        )
        return Response(ProjectSerializer(project, context={'user': request.user}).data)


class ProjectCloseView(APIView):
    """Clôture d'un projet — POST, permission 'project.close' (owner ou admin)."""

    def post(self, request, project_id):
        """Passe le projet en « Clôturé » si toutes ses tâches sont terminées (400 sinon)."""
        project, membership = get_membership_or_404(project_id, request.user)
        require_permission(membership, 'project.close')
        statuses = list(project.tasks.values_list('status', flat=True))
        if not statuses:
            raise ValidationError('Aucune tâche à clôturer')
        if any(s != Task.STATUS_DONE for s in statuses):
            raise ValidationError('Toutes les tâches doivent être terminées')
        project.status = Project.STATUS_COMPLETED
        project.closed_at = timezone.now()
        project.save(update_fields=['status', 'closed_at', 'updated_at'])
        log_activity(project, request.user, 'project.close', 'a clôturé le projet')
        return Response(ProjectSerializer(project, context={'user': request.user}).data)


class MemberListCreateView(APIView):
    """Membres d'un projet.

    GET  : liste réservée aux membres du projet.
    POST : ajout d'un membre — permission 'member.add'.
    """

    def get(self, request, project_id):
        """Liste les membres du projet avec leur profil utilisateur."""
        project, _ = get_membership_or_404(project_id, request.user)
        members = project.memberships.select_related('user')
        return Response(MembershipSerializer(members, many=True).data)

    def post(self, request, project_id):
        """Ajoute un utilisateur déjà inscrit (identifié par email) comme membre (201)."""
        project, membership = get_membership_or_404(project_id, request.user)
        require_permission(membership, 'member.add')
        serializer = MemberInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target = User.objects.filter(email=serializer.validated_data['email']).first()
        if target is None:
            raise ValidationError('Aucun utilisateur avec cet email (il doit être inscrit)')
        if Membership.objects.filter(project=project, user=target).exists():
            raise ValidationError('Déjà membre du projet')

        member = Membership.objects.create(project=project, user=target, role=Membership.ROLE_MEMBER)
        log_activity(project, request.user, 'member.add', f'a ajouté {target.name} au projet')
        return Response(MembershipSerializer(member).data, status=status.HTTP_201_CREATED)


class MemberDetailView(APIView):
    """Changement de rôle et retrait d'un membre.

    L'appelant doit appartenir au projet concerné (404/403 sinon).
    """

    def get_object(self, request, member_id):
        """Charge le membership visé et vérifie que l'appelant est membre du même projet."""
        member = Membership.objects.select_related('user', 'project').filter(pk=member_id).first()
        if member is None:
            raise NotFound('Membre introuvable')
        _, my_membership = get_membership_or_404(member.project_id, request.user)
        return member, my_membership

    def put(self, request, member_id):
        """Changement de rôle — permission 'member.edit' (transfert de propriété réservé au propriétaire)."""
        member, my_membership = self.get_object(request, member_id)
        require_permission(my_membership, 'member.edit')
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data['role']

        if member.role == Membership.ROLE_OWNER and new_role != Membership.ROLE_OWNER:
            owners = Membership.objects.filter(project=member.project, role=Membership.ROLE_OWNER)
            if owners.count() <= 1:
                raise ValidationError('Le projet doit garder un propriétaire')
        if new_role == Membership.ROLE_OWNER and my_membership.role != Membership.ROLE_OWNER:
            raise PermissionDenied('Seul le propriétaire peut transférer la propriété')

        member.role = new_role
        member.save(update_fields=['role'])
        log_activity(member.project, request.user, 'member.role', f'a défini le rôle « {new_role} »')
        return Response(MembershipSerializer(member).data)

    def delete(self, request, member_id):
        """Retrait — permission 'member.remove', ou départ volontaire si c'est son propre membership."""
        member, my_membership = self.get_object(request, member_id)
        is_self = member.user_id == request.user.id
        if not is_self:
            require_permission(my_membership, 'member.remove')
        if member.role == Membership.ROLE_OWNER and not is_self:
            raise PermissionDenied('Impossible de retirer le propriétaire')
        if member.role == Membership.ROLE_OWNER and is_self:
            if member.project.memberships.count() <= 1:
                raise ValidationError("Supprimez le projet, il n'aurait plus de propriétaire")

        project = member.project
        Task.objects.filter(project=project, assignee_id=member.user_id).update(assignee=None)
        member.delete()
        log_activity(
            project,
            request.user,
            'member.remove',
            'a quitté le projet' if is_self else 'a retiré un membre',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskListCreateView(APIView):
    """Tâches d'un projet.

    GET  : liste réservée aux membres du projet.
    POST : création — permission 'task.create' et projet non clôturé.
    """

    def get(self, request, project_id):
        """Liste toutes les tâches du projet."""
        project, _ = get_membership_or_404(project_id, request.user)
        return Response(TaskSerializer(project.tasks.all(), many=True).data)

    def post(self, request, project_id):
        """Crée une tâche dans le projet et journalise l'action (201)."""
        project, membership = get_membership_or_404(project_id, request.user)
        require_permission(membership, 'task.create')
        require_writable_project(project)
        serializer = TaskSerializer(data=request.data, context={'project_id': project.id})
        serializer.is_valid(raise_exception=True)
        task = serializer.save(project=project, created_by=request.user)
        log_activity(project, request.user, 'task.create', f'a créé la tâche « {task.title} »')
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    """Modification et suppression d'une tâche.

    L'appelant doit appartenir au projet de la tâche (404/403 sinon).
    """

    def get_object(self, request, task_id):
        """Charge la tâche puis vérifie l'appartenance de l'appelant à son projet."""
        task = Task.objects.select_related('project').filter(pk=task_id).first()
        if task is None:
            raise NotFound('Tâche introuvable')
        _, membership = get_membership_or_404(task.project_id, request.user)
        return task, membership

    def put(self, request, task_id):
        """Mise à jour partielle — permission 'task.edit' ; journalise le changement de statut."""
        task, membership = self.get_object(request, task_id)
        require_permission(membership, 'task.edit')
        require_writable_project(task.project)
        old_status = task.status
        serializer = TaskSerializer(
            task, data=request.data, partial=True, context={'project_id': task.project_id}
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        if old_status != task.status:
            log_activity(
                task.project,
                request.user,
                'task.status',
                f'a déplacé « {task.title} » vers {task.status}',
            )
        return Response(TaskSerializer(task).data)

    def delete(self, request, task_id):
        """Suppression — permission 'task.delete' et projet non clôturé."""
        task, membership = self.get_object(request, task_id)
        require_permission(membership, 'task.delete')
        require_writable_project(task.project)
        title = task.title
        log_activity(task.project, request.user, 'task.delete', f'a supprimé la tâche « {title} »')
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
