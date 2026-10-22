from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register'
        self.login_url = '/api/auth/login'

    def register(self, email='ada@exemple.com', name='Ada Lovelace', password='MotdePasse123'):
        return self.client.post(
            self.register_url,
            {'name': name, 'email': email, 'password': password},
            format='json',
        )

    def test_register_returns_tokens_and_user(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['email'], 'ada@exemple.com')
        self.assertEqual(res.data['user']['name'], 'Ada Lovelace')
        self.assertNotIn('password', res.data['user'])

    def test_register_duplicate_email(self):
        self.register()
        res = self.register()
        self.assertEqual(res.status_code, 400)
        self.assertIn('existe déjà', res.data['message'])

    def test_login_with_email(self):
        self.register()
        res = self.client.post(
            self.login_url,
            {'email': 'ada@exemple.com', 'password': 'MotdePasse123'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)

    def test_login_wrong_password(self):
        self.register()
        res = self.client.post(
            self.login_url,
            {'email': 'ada@exemple.com', 'password': 'faux'},
            format='json',
        )
        self.assertEqual(res.status_code, 401)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        res = self.register()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.client.get('/api/auth/me')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['email'], 'ada@exemple.com')

    def test_logout_blacklists_refresh(self):
        res = self.register()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        out = self.client.post('/api/auth/logout', {'refresh': res.data['refresh']}, format='json')
        self.assertEqual(out.status_code, 200)
        refresh_res = self.client.post(
            '/api/auth/refresh', {'refresh': res.data['refresh']}, format='json'
        )
        self.assertEqual(refresh_res.status_code, 401)

    def test_user_search(self):
        self.register()
        res = self.register(email='grace@exemple.com', name='Grace Hopper')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        found = self.client.get('/api/users?search=grace')
        self.assertEqual(found.status_code, 200)
        self.assertEqual(len(found.data), 1)
        self.assertEqual(found.data[0]['name'], 'Grace Hopper')
