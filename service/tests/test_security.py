import os
import unittest
from datetime import datetime, timezone
from html.parser import HTMLParser
from unittest.mock import MagicMock, patch
from urllib.parse import urljoin, urlparse

from fastapi.testclient import TestClient

import launch
from backend import api, auth, cli, pages, rate_limit as security
from backend.preferences import preferences_for


class FakeLimits:
    def __init__(self):
        self.counts = {}

    def find_one_and_update(self, query, update, **kwargs):
        key = query['_id']
        self.counts[key] = self.counts.get(key, 0) + 1
        return {'count': self.counts[key]}


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.inline_tags = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'style' or (tag == 'script' and 'src' not in attrs):
            self.inline_tags.append(tag)
        if tag == 'script' and 'src' in attrs:
            self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet' and 'href' in attrs:
            self.urls.append(attrs['href'])


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
             patch.object(api, 'check_login_rate', return_value=(False, 42)):
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
             for path in ('/.env', '/config/.env', '/config/.env.example', '/launch.py', '/security.py', '/backend/app.py', '/backend/config.py',
                          '/frontend/html/start/account.html', '/assets/html/start/account.html'):
                self.assertEqual(client.get(path).status_code, 404)

    def test_home_and_account_require_session_and_onboarding(self):
        with TestClient(launch.app) as client:
            for path in ('/pages/start/HomePage.html', '/pages/start/account.html', '/pages/start/home-content.html', '/pages/start/not-found.html'):
                response = client.get(path, follow_redirects=False)
                self.assertEqual(response.status_code, 303)
                self.assertEqual(response.headers['location'], '/pages/login/index.html')
                with patch.object(pages, 'current_user', return_value={'is_first_login_done': False}):
                    response = client.get(path, follow_redirects=False)
                self.assertEqual(response.status_code, 303)
                self.assertEqual(response.headers['location'], '/pages/start/index.html')
                with patch.object(pages, 'current_user', return_value={'is_first_login_done': True}):
                    response = client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_home_assets_are_public_and_referenced_by_protected_page(self):
        with TestClient(launch.app) as client:
            with patch.object(pages, 'current_user', return_value={'is_first_login_done': True}):
                response = client.get('/pages/start/HomePage.html')
            self.assertIn('../../assets/css/home.css', response.text)
            self.assertIn('../../assets/js/home.js', response.text)
            for path, content_type in (('/assets/css/home.css', 'text/css'),
                                       ('/assets/js/home.js', 'javascript')):
                asset = client.get(path)
                self.assertEqual(asset.status_code, 200)
                self.assertIn(content_type, asset.headers['content-type'])
            self.assertEqual(client.get('/assets/css/missing.css').status_code, 404)
            self.assertEqual(client.get('/assets/js/missing.js').status_code, 404)

    def test_legacy_public_urls_still_serve_their_resources(self):
        with TestClient(launch.app) as client:
            for path in ('/sw.js', '/manifest.webmanifest', '/loading.js', '/style.css',
                         '/image.png', '/images/Icon%20192x192.png',
                         '/images/Icon%20512x512.png', '/images/Icon%202000x2000.png'):
                with self.subTest(path=path):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.content)
            self.assertEqual(client.get('/images/other.png').status_code, 404)

    def test_pages_reference_existing_local_assets(self):
        paths = ('/', '/index.html', '/pages/login/index.html', '/pages/start/index.html', '/pages/start/HomePage.html',
                 '/pages/start/account.html', '/pages/start/home-content.html',
                 '/pages/start/not-found.html', '/pages/start/loading.html')
        with TestClient(launch.app, base_url='https://localhost') as client, \
             patch.object(pages, 'current_user', return_value={'is_first_login_done': True}):
            for path in paths:
                with self.subTest(page=path):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 200)
                    parser = AssetParser()
                    parser.feed(response.text)
                    self.assertEqual(parser.inline_tags, [], path)
                    for url in parser.urls:
                        absolute = urljoin(str(response.url), url)
                        if urlparse(absolute).netloc != 'localhost':
                            continue
                        asset = client.get(absolute)
                        self.assertEqual(asset.status_code, 200, f'{path}: {url}')

    def test_worker_no_longer_caches_or_intercepts_requests(self):
        with TestClient(launch.app) as client:
            worker = client.get('/sw.js')
            self.assertEqual(worker.status_code, 200)
            self.assertNotIn('addAll', worker.text)
            self.assertNotIn("addEventListener('fetch'", worker.text)

    def test_preference_defaults_and_invalid_legacy_values(self):
        expected = {'theme': 'normal', 'navbar_blur': True, 'motion': 'system', 'text_size': 'normal'}
        self.assertEqual(preferences_for({}).model_dump(), expected)
        self.assertEqual(preferences_for({'preferences': None}).model_dump(), expected)
        self.assertEqual(preferences_for({'preferences': {'theme': 'light', 'navbar_blur': 'yes',
                                                          'motion': 'invalid', 'unknown': 'x'}}).model_dump(),
                         {**expected, 'theme': 'light'})

    def test_preferences_require_session_and_validate_updates(self):
        values = {'theme': 'amoled', 'navbar_blur': False, 'motion': 'reduced', 'text_size': 'large'}
        with TestClient(launch.app, base_url='https://localhost') as client, \
             patch.dict(os.environ, {'APP_ORIGIN': 'https://localhost'}):
            self.assertEqual(client.get('/api/preferences').status_code, 401)
            self.assertEqual(client.post('/api/preferences', json=values,
                                         headers={'Origin': 'https://localhost'}).status_code, 401)
            user = {'_id': 'my-id', 'username': 'test'}
            db = MagicMock()
            db.users.update_one.return_value.matched_count = 1
            with patch.object(api, 'current_user', return_value=user), patch.object(api, 'db', db):
                response = client.get('/api/preferences')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['theme'], 'normal')
                self.assertEqual(response.headers['cache-control'], 'no-store')
                self.assertEqual(client.post('/api/preferences', json=values).status_code, 403)
                self.assertEqual(client.post('/api/preferences', json=values,
                                             headers={'Origin': 'https://evil.test'}).status_code, 403)
                for invalid in ({**values, 'theme': 'other'}, {**values, 'navbar_blur': 'false'},
                                {**values, 'role': 'admin'}, {'theme': 'light'}):
                    self.assertEqual(client.post('/api/preferences', json=invalid,
                                                 headers={'Origin': 'https://localhost'}).status_code, 422)
                db.users.update_one.assert_not_called()
                response = client.post('/api/preferences', json=values,
                                       headers={'Origin': 'https://localhost'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), values)
                self.assertEqual(response.headers['cache-control'], 'no-store')
                db.users.update_one.assert_called_once_with(
                    {'_id': 'my-id', 'is_active': {'$ne': False}},
                    {'$set': {'preferences': values}})

    def test_welcome_dependencies_exist(self):
        with TestClient(launch.app) as client:
            for path in ('/assets/css/welcome.css', '/assets/js/welcome.js',
                         '/assets/css/notice.css', '/assets/css/loading-overlay.css'):
                self.assertEqual(client.get(path).status_code, 200)
            self.assertEqual(client.get('/image.png').status_code, 200)

    def test_login_onboarding_and_logout_flow(self):
        db = MagicMock()
        user = {'_id': 'user-id', 'username': 'test', 'password_hash': 'hash',
                'is_first_login_done': False}
        sessions = {}
        db.users.find_one.side_effect = lambda query: user if (
            query.get('username') == 'test' or query.get('_id') == 'user-id') else None
        db.sessions.insert_one.side_effect = lambda session: sessions.update({session['_id']: session})
        db.sessions.find_one.side_effect = lambda query: sessions.get(query['_id'])
        db.sessions.delete_one.side_effect = lambda query: sessions.pop(query['_id'], None)
        db.users.update_one.return_value.matched_count = 1

        with patch.object(api, 'db', db), patch.object(auth, 'db', db), \
             patch.object(api, 'hasher', MagicMock()), \
             patch.object(api, 'check_login_rate', return_value=(True, 1)), \
             patch.dict(os.environ, {'APP_ORIGIN': 'https://localhost'}):
            with TestClient(launch.app, base_url='https://localhost') as client:
                origin = {'Origin': 'https://localhost'}
                response = client.post('/api/login', headers=origin,
                                       json={'username': 'test', 'password': 'password'})
                self.assertEqual(response.status_code, 200)
                self.assertIn('HttpOnly', response.headers['set-cookie'])
                self.assertEqual(client.get('/api/me').json()['username'], 'test')
                self.assertEqual(client.get('/pages/start/HomePage.html', follow_redirects=False).status_code, 303)
                self.assertEqual(client.post('/api/onboarding/complete', headers=origin).status_code, 200)
                user['is_first_login_done'] = True
                self.assertEqual(client.get('/pages/start/HomePage.html').status_code, 200)
                self.assertEqual(client.post('/api/logout', headers=origin).status_code, 200)
                self.assertEqual(client.get('/api/me').status_code, 401)

    def test_account_details_exclude_password_and_require_session(self):
        user = {'_id': 'example-id', 'username': 'example', 'first_name': 'Alex',
                'last_name': 'Smith', 'password_hash': 'secret', 'role': 'aluno',
                'date_of_birth': datetime(2008, 11, 1, tzinfo=timezone.utc),
                'created_at': datetime(2026, 1, 1, tzinfo=timezone.utc),
                'email': 'alex@example.org', 'phone_number': '+351 900000000',
                'grade': 12, 'class': 'G'}
        with TestClient(launch.app) as client:
            self.assertEqual(client.get('/api/me').status_code, 401)
            with patch.object(api, 'current_user', return_value=user):
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
        with patch.object(cli, 'db', db), patch.object(cli, 'ensure_indexes'), \
             patch.object(cli, 'hasher', MagicMock(hash=MagicMock(return_value='test-hash'))), \
             patch('builtins.input', side_effect=answers), \
             patch.object(cli.getpass, 'getpass', side_effect=['long-password', 'long-password']), \
             patch('sys.argv', ['launch.py', 'create-user']):
            launch.main()
        user = db.users.insert_one.call_args.args[0]
        self.assertEqual((user['email'], user['phone_number'], user['grade'], user['class']),
                         ('alex@example.org', '+351 900000000', 12, 'G'))


if __name__ == '__main__':
    unittest.main()
