import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from argon2 import PasswordHasher
from fastapi.testclient import TestClient

import launch
from backend import api, auth


class AccountSecurityTests(unittest.TestCase):
    def setUp(self):
        self.passwords = PasswordHasher(time_cost=1, memory_cost=8192, parallelism=1)
        self.user = {'_id': 'user', 'username': 'example', 'password_hash': self.passwords.hash('original-password')}
        self.sessions = {}
        self.db = MagicMock()
        self.db.users.find_one.side_effect = lambda query: self.user if query.get('username') == 'example' or query.get('_id') == 'user' else None
        self.db.sessions.insert_one.side_effect = lambda session: self.sessions.update({session['_id']: session})
        self.db.sessions.find_one.side_effect = self.find_session
        self.db.sessions.update_one.side_effect = self.update_session
        self.db.users.update_one.side_effect = self.update_user
        self.patches = [patch.object(api, 'db', self.db), patch.object(auth, 'db', self.db),
                        patch.object(api, 'hasher', self.passwords),
                        patch.object(api, 'check_login_rate', return_value=(True, 1)),
                        patch.dict(os.environ, {'APP_ORIGIN': 'https://localhost'})]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        self.client = TestClient(launch.app, base_url='https://localhost')
        self.addCleanup(self.client.close)
        self.origin = {'Origin': 'https://localhost'}

    def find_session(self, query):
        session = self.sessions.get(query['_id'])
        if not session or ('user_id' in query and session['user_id'] != query['user_id']):
            return None
        for field in ('expires_at', 'security_until'):
            if field in query and (field not in session or session[field] <= query[field]['$gt']):
                return None
        return session.copy()

    def update_session(self, query, update):
        session = self.find_session(query)
        if session:
            record = self.sessions[query['_id']]
            record.update(update.get('$set', {}))
            for field in update.get('$unset', {}):
                record.pop(field, None)
        return MagicMock(matched_count=int(session is not None))

    def update_user(self, query, update):
        matched = query['password_hash'] == self.user['password_hash']
        if matched:
            self.user.update(update.get('$set', {}))
            for field, increment in update.get('$inc', {}).items():
                self.user[field] = self.user.get(field, 0) + increment
        return MagicMock(matched_count=int(matched))

    def login(self, client=None):
        return (client or self.client).post('/api/login', headers=self.origin,
                                            json={'username': 'example', 'password': 'original-password'})

    def unlock(self, password='original-password'):
        return self.client.post('/api/security/unlock', headers=self.origin, json={'password': password})

    def test_invalid_or_missing_password_hash_does_not_crash_login(self):
        for value in ('not-an-argon-hash', None):
            with self.subTest(value=value):
                self.user['password_hash'] = value
                self.assertEqual(self.login().status_code, 401)
        del self.user['password_hash']
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.sessions, {})

    def test_security_requires_password_session_origin_and_expiry(self):
        self.assertEqual(self.client.post('/api/security/unlock', headers=self.origin, json={'password': 'wrong'}).status_code, 401)
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.client.post('/api/security/unlock', json={'password': 'original-password'}).status_code, 403)
        self.assertEqual(self.unlock('wrong').status_code, 401)
        self.assertEqual(self.client.post('/api/security/email', headers=self.origin, json={'email': 'x@example.com'}).status_code, 403)
        self.assertEqual(self.unlock().status_code, 200)
        self.assertEqual(self.client.post('/api/security/email', headers=self.origin, json={'email': 'invalid'}).status_code, 422)
        self.assertEqual(self.client.post('/api/security/email', headers=self.origin, json={'email': 'x@example.com'}).status_code, 200)
        self.assertEqual(self.user['email'], 'x@example.com')
        for session in self.sessions.values():
            session['security_until'] = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertEqual(self.client.post('/api/security/email', headers=self.origin, json={'email': 'y@example.com'}).status_code, 403)

    def test_lock_and_rate_limit(self):
        self.login()
        with patch.object(api, 'check_login_rate', return_value=(False, 42)):
            response = self.unlock()
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers['retry-after'], '42')
        self.assertEqual(self.unlock().status_code, 200)
        self.assertEqual(self.client.post('/api/security/lock', headers=self.origin).status_code, 200)
        self.assertEqual(self.client.post('/api/security/email', headers=self.origin, json={'email': 'x@example.com'}).status_code, 403)

    def test_password_change_invalidates_all_sessions_including_legacy(self):
        self.login()
        other = TestClient(launch.app, base_url='https://localhost')
        self.addCleanup(other.close)
        self.login(other)
        # Existing sessions from older releases have no version field.
        for session in self.sessions.values():
            session.pop('auth_version')
        self.assertEqual(self.unlock().status_code, 200)
        self.assertEqual(self.client.post('/api/security/password', headers=self.origin, json={'password': 'short'}).status_code, 422)
        response = self.client.post('/api/security/password', headers=self.origin, json={'password': 'new-strong-password'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.passwords.verify(self.user['password_hash'], 'new-strong-password'))
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.assertEqual(other.get('/api/me').status_code, 401)
        self.assertEqual(self.client.post('/api/login', headers=self.origin, json={'username': 'example', 'password': 'original-password'}).status_code, 401)
        self.assertEqual(self.client.post('/api/login', headers=self.origin, json={'username': 'example', 'password': 'new-strong-password'}).status_code, 200)


if __name__ == '__main__':
    unittest.main()
