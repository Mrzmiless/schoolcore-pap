import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend import api
from backend.app import app


class LegacyPreferenceTests(unittest.TestCase):
    def test_non_object_preferences_can_be_saved_without_overwriting_newer_changes(self):
        values = {'theme': 'light', 'navbar_blur': True, 'motion': 'system',
                  'text_size': 'normal', 'language': 'pt-PT'}
        for old in (None, 'invalid'):
            with self.subTest(old=old), TestClient(app, base_url='https://localhost') as client, \
                    patch.dict(os.environ, {'APP_ORIGIN': 'https://localhost'}), \
                    patch.object(api, 'current_user', return_value={'_id': 'user', 'preferences': old}), \
                    patch.object(api, 'db') as db:
                db.users.update_one.return_value = MagicMock(matched_count=1)
                response = client.post('/api/preferences', json=values, headers={'Origin': 'https://localhost'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), values)
                db.users.update_one.assert_called_once_with(
                    {'_id': 'user', 'is_active': {'$ne': False}, 'preferences': {'$eq': old}},
                    {'$set': {'preferences': values}},
                )
                db.users.update_one.return_value.matched_count = 0
                self.assertEqual(client.post('/api/preferences', json=values,
                                             headers={'Origin': 'https://localhost'}).status_code, 409)
