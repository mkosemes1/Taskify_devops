from django.test import TestCase
from rest_framework.test import APIClient

from .models import Membership, Project, Task


class BaseTestCase(TestCase):
    """Base : deux utilisateurs connectés, helper de création de projet."""

    def setUp(self):
        self.client = APIClient()
        self.owner = self.make_user('owner@exemple.com', 'Owner')
        self.other = self.make_user('other@exemple.com', 'Other')
        self.owner_token = self.login('owner@exemple.com')
        self.other_token = self.login('other@exemple.com')

    @staticmethod
    def make_user(email, name):
        from django.contrib.auth import get_user_model

        return get_user_model().objects.create_user(
            email=email, name=name, password='MotdePasse123'
        )

    def login(self, email):
        res = self.client.post(
            '/api/auth/login',
            {'email': email, 'password': 'MotdePasse123'},
            format='json',
        )
        return res.data['access']

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def create_project(self, token=None, name='Projet Test'):
        self.auth(token or self.owner_token)
        res = self.client.post('/api/projects', {'name': name, 'description': 'desc'}, format='json')
        assert res.status_code == 201, res.data
        return res.data

    def add_member(self, project_id, email, token=None):
        self.auth(token or self.owner_token)
        return self.client.post(
            f'/api/projects/{project_id}/members', {'email': email}, format='json'
        )

    def make_task(self, project_id, title='Tâche 1', token=None, **extra):
        self.auth(token or self.owner_token)
        res = self.client.post(
            f'/api/projects/{project_id}/tasks', {'title': title, **extra}, format='json'
        )
        assert res.status_code == 201, res.data
        return res.data


class ProjectTests(BaseTestCase):
    def test_create_project_makes_owner(self):
        data = self.create_project()
        self.assertEqual(data['role'], 'owner')
        self.assertEqual(data['status'], 'active')
        self.assertEqual(data['taskCount'], 0)

    def test_list_projects_only_mine(self):
        self.create_project(name='Chez moi')
        self.create_project(name='Chez lui', token=self.other_token)
        self.auth(self.owner_token)
        res = self.client.get('/api/projects')
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Chez moi')

    def test_non_member_cannot_access(self):
        data = self.create_project()
        self.auth(self.other_token)
        res = self.client.get(f"/api/projects/{data['id']}")
        self.assertEqual(res.status_code, 403)

    def test_update_project(self):
        data = self.create_project()
        self.auth(self.owner_token)
        res = self.client.put(
            f"/api/projects/{data['id']}", {'name': 'Renommé'}, format='json'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'Renommé')

    def test_member_role_cannot_edit_project(self):
        data = self.create_project()
        self.add_member(data['id'], 'other@exemple.com')
        self.auth(self.other_token)
        res = self.client.put(
            f"/api/projects/{data['id']}", {'name': 'Hacker'}, format='json'
        )
        self.assertEqual(res.status_code, 403)

    def test_rating(self):
        data = self.create_project()
        self.auth(self.owner_token)
        res = self.client.post(f"/api/projects/{data['id']}/rate", {'rating': 4}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['rating'], 4.0)
        self.assertEqual(res.data['ratingCount'], 1)

    def test_delete_only_creator(self):
        data = self.create_project()
        self.add_member(data['id'], 'other@exemple.com')
        self.auth(self.other_token)
        res = self.client.delete(f"/api/projects/{data['id']}")
        self.assertEqual(res.status_code, 403)
        self.auth(self.owner_token)
        self.assertEqual(self.client.delete(f"/api/projects/{data['id']}").status_code, 204)


class MemberTests(BaseTestCase):
    def test_invite_and_roles(self):
        data = self.create_project()
        res = self.add_member(data['id'], 'other@exemple.com')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['role'], 'member')
        self.assertEqual(res.data['user']['name'], 'Other')

        member_id = res.data['id']
        self.auth(self.owner_token)
        up = self.client.put(f'/api/members/{member_id}', {'role': 'admin'}, format='json')
        self.assertEqual(up.status_code, 200)
        self.assertEqual(up.data['role'], 'admin')

    def test_invite_unknown_email(self):
        data = self.create_project()
        res = self.add_member(data['id'], 'inconnu@exemple.com')
        self.assertEqual(res.status_code, 400)

    def test_admin_cannot_promote_to_owner(self):
        data = self.create_project()
        member = self.add_member(data['id'], 'other@exemple.com').data
        self.auth(self.other_token)  # other est member, pas admin
        # un simple membre ne peut pas changer les rôles
        res = self.client.put(f"/api/members/{member['id']}", {'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_leave_project(self):
        data = self.create_project()
        member = self.add_member(data['id'], 'other@exemple.com').data
        self.auth(self.other_token)
        res = self.client.delete(f"/api/members/{member['id']}")
        self.assertEqual(res.status_code, 204)
        self.auth(self.owner_token)
        detail = self.client.get(f"/api/projects/{data['id']}")
        self.assertEqual(len(detail.data['members']), 1)


class TaskTests(BaseTestCase):
    def test_create_assign_and_move(self):
        project = self.create_project()
        self.add_member(project['id'], 'other@exemple.com')
        task = self.make_task(
            project['id'],
            title='Rédiger le spec',
            assigneeId=self.other.id,
            priority='high',
        )
        self.assertEqual(task['assigneeId'], self.other.id)
        self.assertEqual(task['priority'], 'high')

        self.auth(self.owner_token)
        res = self.client.put(f"/api/tasks/{task['id']}", {'status': 'done'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'done')

    def test_assign_to_non_member_rejected(self):
        project = self.create_project()
        stranger = self.make_user('stranger@exemple.com', 'Stranger')
        self.auth(self.owner_token)
        res = self.client.post(
            f"/api/projects/{project['id']}/tasks",
            {'title': 'Tâche', 'assigneeId': stranger.id},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_viewer_is_read_only(self):
        project = self.create_project()
        self.add_member(project['id'], 'other@exemple.com')
        member = Membership.objects.get(user__email='other@exemple.com')
        member.role = Membership.ROLE_VIEWER
        member.save()

        self.auth(self.other_token)
        res = self.client.get(f"/api/projects/{project['id']}/tasks")
        self.assertEqual(res.status_code, 200)
        create = self.client.post(
            f"/api/projects/{project['id']}/tasks", {'title': 'Non'}, format='json'
        )
        self.assertEqual(create.status_code, 403)

    def test_close_project_requires_all_done(self):
        project = self.create_project()
        task = self.make_task(project['id'])
        self.auth(self.owner_token)

        closed = self.client.post(f"/api/projects/{project['id']}/close")
        self.assertEqual(closed.status_code, 400)

        self.client.put(f"/api/tasks/{task['id']}", {'status': 'done'}, format='json')
        closed = self.client.post(f"/api/projects/{project['id']}/close")
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.data['status'], 'completed')
        self.assertIsNotNone(closed.data['closedAt'])

    def test_closed_project_is_read_only(self):
        project = self.create_project()
        task = self.make_task(project['id'])
        self.auth(self.owner_token)
        self.client.put(f"/api/tasks/{task['id']}", {'status': 'done'}, format='json')
        self.client.post(f"/api/projects/{project['id']}/close")

        create = self.client.post(
            f"/api/projects/{project['id']}/tasks", {'title': 'Encore'}, format='json'
        )
        self.assertEqual(create.status_code, 403)
        move = self.client.put(f"/api/tasks/{task['id']}", {'status': 'todo'}, format='json')
        self.assertEqual(move.status_code, 403)

    def test_activity_is_recorded(self):
        project = self.create_project()
        self.make_task(project['id'], title='Tâche loggée')
        self.auth(self.owner_token)
        res = self.client.get(f"/api/projects/{project['id']}")
        actions = [a['action'] for a in res.data['activity']]
        self.assertIn('project.create', actions)
        self.assertIn('task.create', actions)
