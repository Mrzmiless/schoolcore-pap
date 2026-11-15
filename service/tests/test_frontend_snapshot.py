import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import launch
from backend import pages
from backend.frontend_snapshot import FrontendSnapshot


class FrontendSnapshotTests(unittest.TestCase):
    def test_files_stay_fixed_until_new_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            css = base / 'frontend' / 'css'
            css.mkdir(parents=True)
            asset = css / 'example.css'
            asset.write_text('old style', encoding='utf-8')
            old = FrontendSnapshot(base)
            asset.write_text('new style', encoding='utf-8')
            (css / 'new.css').write_text('new file', encoding='utf-8')
            self.assertEqual(old.response('css/example.css').body, b'old style')
            with self.assertRaises(HTTPException):
                old.response('css/new.css')
            new = FrontendSnapshot(base)
            self.assertEqual(new.response('css/example.css').body, b'new style')
            self.assertEqual(new.response('css/new.css').body, b'new file')
            asset.unlink()
            self.assertEqual(old.response('css/example.css').body, b'old style')
            self.assertEqual(new.response('css/example.css').body, b'new style')

    def test_static_symlinks_cannot_escape_their_public_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            css = base / 'frontend' / 'css'
            html = base / 'frontend' / 'html'
            css.mkdir(parents=True)
            html.mkdir()
            secret = html / 'protected.html'
            secret.write_text('private page', encoding='utf-8')
            alias = css / 'alias.css'
            alias.write_text('placeholder', encoding='utf-8')
            resolve = Path.resolve

            def simulated_resolve(path, *args, **kwargs):
                return resolve(secret) if path == alias else resolve(path, *args, **kwargs)

            # Simular a resolução evita depender de permissões de symlink no Windows.
            with patch.object(Path, 'resolve', autospec=True, side_effect=simulated_resolve):
                snapshot = FrontendSnapshot(base)
            with self.assertRaises(HTTPException):
                snapshot.response('css/alias.css')

    def test_served_resources_revalidate_and_private_pages_stay_protected(self):
        with TestClient(launch.app) as client:
            self.assertEqual(client.get('/pages/start/account.html', follow_redirects=False).status_code, 303)
            with patch.object(pages, 'current_user', return_value={'is_first_login_done': True}):
                for path in ('/', '/pages/start/account.html', '/assets/css/home.css', '/assets/js/home.js',
                             '/loading.js', '/image.png', '/manifest.webmanifest', '/sw.js'):
                    with self.subTest(path=path):
                        response = client.get(path)
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response.headers['cache-control'], 'no-store')
                self.assertEqual(client.get('/assets/css/../html/start/account.html').status_code, 404)
                self.assertEqual(client.get('/assets/js/missing.js').status_code, 404)


if __name__ == '__main__':
    unittest.main()
