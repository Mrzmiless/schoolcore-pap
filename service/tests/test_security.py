import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import launch
import security


class FakeLimits:
    def __init__(self):
        self.counts = {}

    def find_one_and_update(self, query, update, **kwargs):
        key = query['_id']
        self.counts[key] = self.counts.get(key, 0) + 1
        return {'count': self.counts[key]}


class SecurityTests(unittest.TestCase):
    def test_rate_limit_and_new_window(self):
        limits = FakeLimits()
        for _ in range(security.LOGIN_ATTEMPTS_PER_WINDOW):
            self.assertTrue(security.check_login_rate(limits, 'client', now=10)[0])
        allowed, retry = security.check_login_rate(limits, 'client', now=10)
        self.assertFalse(allowed)
        self.assertEqual(retry, 290)
        self.assertTrue(security.check_login_rate(limits, 'client', now=300)[0])
        self.assertTrue(security.check_login_rate(limits, 'other-client', now=10)[0])

    def test_login_rate_limit_headers_and_origin(self):
        with patch.dict(os.environ, {'APP_ORIGIN': 'http://localhost'}), \
             patch.object(launch, 'check_login_rate', return_value=(False, 42)):
            with TestClient(launch.app, base_url='http://localhost') as client:
                response = client.post('/api/login', headers={'Origin': 'http://localhost'},
                                       json={'username': 'test', 'password': 'test'})
                self.assertEqual(response.status_code, 429)
                self.assertEqual(response.headers['retry-after'], '42')
                self.assertEqual(response.headers['cache-control'], 'no-store')
                self.assertEqual(response.headers['x-content-type-options'], 'nosniff')
                response = client.post('/api/login', headers={'Origin': 'http://evil.example'},
                                       json={'username': 'test', 'password': 'test'})
                self.assertEqual(response.status_code, 403)

    def test_private_files_not_served(self):
        with TestClient(launch.app) as client:
            for path in ('/.env', '/launch.py', '/security.py'):
                self.assertEqual(client.get(path).status_code, 404)

    def test_account_details_exclude_password_and_require_session(self):
        user = {'_id': 'example-id', 'username': 'example', 'first_name': 'Alex',
                'last_name': 'Smith', 'password_hash': 'secret', 'role': 'aluno',
                'date_of_birth': datetime(2008, 11, 1, tzinfo=timezone.utc),
                'created_at': datetime(2026, 1, 1, tzinfo=timezone.utc),
                'email': 'alex@example.org', 'phone_number': '+351 900000000',
                'grade': 12, 'class': 'G'}
        with TestClient(launch.app) as client:
            self.assertEqual(client.get('/api/me').status_code, 401)
            with patch.object(launch, 'current_user', return_value=user):
                response = client.get('/api/me')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['last_name'], 'Smith')
            self.assertEqual(response.json()['id'], 'example-id')
            self.assertTrue(response.json()['date_of_birth'].startswith('2008-11-01'))
            self.assertTrue(response.json()['created_at'].startswith('2026-01-01'))
            self.assertEqual(response.json()['email'], 'alex@example.org')
            self.assertEqual(response.json()['phone_number'], '+351 900000000')
            self.assertEqual(response.json()['grade'], 12)
            self.assertEqual(response.json()['class'], 'G')
            self.assertNotIn('password_hash', response.json())
            self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_create_user_includes_new_fields(self):
        db = MagicMock()
        answers = ['test', 'Alex', 'Smith', 'alex@example.org', '+351 900000000',
                   '12', 'G', 'aluno', '01/11/2008']
        with patch.object(launch, 'db', db), patch.object(launch, 'ensure_indexes'), \
             patch.object(launch, 'hasher', MagicMock(hash=MagicMock(return_value='test-hash'))), \
             patch('builtins.input', side_effect=answers), \
             patch.object(launch.getpass, 'getpass', side_effect=['long-password', 'long-password']), \
             patch('sys.argv', ['launch.py', 'create-user']):
            launch.main()
        user = db.users.insert_one.call_args.args[0]
        self.assertEqual((user['email'], user['phone_number'], user['grade'], user['class']),
                         ('alex@example.org', '+351 900000000', 12, 'G'))


if __name__ == '__main__':
    unittest.main()
