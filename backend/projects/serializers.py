from django.db.models import Avg
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Activity, Membership, Project, ProjectRating, Task


class ProjectSerializer(serializers.ModelSerializer):
    """Champs en camelCase, exactement ce que consomme le frontend React."""

    dueDate = serializers.DateField(source='due_date', allow_null=True, required=False)
    closedAt = serializers.DateTimeField(source='closed_at', read_only=True)
    createdBy = serializers.IntegerField(source='created_by_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    rating = serializers.SerializerMethodField()
    ratingCount = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    taskCount = serializers.SerializerMethodField()
    doneCount = serializers.SerializerMethodField()
    memberCount = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id',
            'name',
            'description',
            'dueDate',
            'status',
            'rating',
            'ratingCount',
            'role',
            'taskCount',
            'doneCount',
            'memberCount',
            'createdBy',
            'createdAt',
            'updatedAt',
            'closedAt',
        ]
        read_only_fields = ['status', 'createdBy', 'createdAt', 'updatedAt', 'closedAt']

    def get_rating(self, obj):
        avg = getattr(obj, 'rating_avg', None)
        if avg is None and obj.pk:
            avg = obj.ratings.aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg is not None else 0

    def get_ratingCount(self, obj):
        count = getattr(obj, 'rating_count', None)
        if count is None and obj.pk:
            count = obj.ratings.count()
        return count

    def get_role(self, obj):
        role = getattr(obj, 'role', None)
        if role is None and 'user' in self.context:
            role = obj.memberships.filter(user=self.context['user']).values_list('role', flat=True).first()
        return role

    def get_taskCount(self, obj):
        count = getattr(obj, 'task_count', None)
        return count if count is not None else obj.tasks.count()

    def get_doneCount(self, obj):
        count = getattr(obj, 'done_count', None)
        if count is None:
            count = obj.tasks.filter(status=Task.STATUS_DONE).count()
        return count

    def get_memberCount(self, obj):
        count = getattr(obj, 'member_count', None)
        return count if count is not None else obj.memberships.count()


class TaskSerializer(serializers.ModelSerializer):
    projectId = serializers.IntegerField(source='project_id', read_only=True)
    assigneeId = serializers.IntegerField(source='assignee_id', allow_null=True, required=False)
    dueDate = serializers.DateField(source='due_date', allow_null=True, required=False)
    createdBy = serializers.IntegerField(source='created_by_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'projectId',
            'title',
            'description',
            'status',
            'priority',
            'assigneeId',
            'dueDate',
            'createdBy',
            'createdAt',
            'updatedAt',
        ]
        read_only_fields = ['createdBy', 'createdAt', 'updatedAt']

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Le titre est requis')
        return value.strip()

    def validate_dueDate(self, value):
        return value or None

    def validate_assigneeId(self, value):
        if value is None:
            return value
        project_id = self.context.get('project_id')
        if project_id and not Membership.objects.filter(project_id=project_id, user_id=value).exists():
            raise serializers.ValidationError("Cet utilisateur n'est pas membre du projet")
        return value


class MembershipSerializer(serializers.ModelSerializer):
    projectId = serializers.IntegerField(source='project_id', read_only=True)
    userId = serializers.IntegerField(source='user_id', read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'projectId', 'userId', 'role', 'user', 'created_at']
        read_only_fields = ['projectId', 'userId']


class ActivitySerializer(serializers.ModelSerializer):
    projectId = serializers.IntegerField(source='project_id', read_only=True)
    userId = serializers.IntegerField(source='user_id', read_only=True)
    at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Activity
        fields = ['id', 'projectId', 'userId', 'action', 'detail', 'at']


class ProjectCreateSerializer(serializers.ModelSerializer):
    dueDate = serializers.DateField(source='due_date', allow_null=True, required=False)

    class Meta:
        model = Project
        fields = ['name', 'description', 'dueDate']

    def validate_dueDate(self, value):
        return value or None

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Le nom du projet est requis')
        return value.strip()


class RateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)


class MemberInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Membership.ROLE_CHOICES)


class MoveTaskSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.STATUS_CHOICES)
