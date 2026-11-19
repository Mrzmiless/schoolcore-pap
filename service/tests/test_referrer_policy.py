import unittest

from fastapi.testclient import TestClient

from backend.app import app


class ReferrerPolicyTests(unittest.TestCase):
    def test_login_page_keeps_referrers_within_the_same_origin(self):
        with TestClient(app) as client:
            response = client.get('/pages/login/index.html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['referrer-policy'], 'same-origin')
