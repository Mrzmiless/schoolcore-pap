import os
import unittest
from unittest.mock import patch

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


if __name__ == '__main__':
    unittest.main()
