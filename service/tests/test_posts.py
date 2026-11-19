import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

import launch
from backend import api


class Cursor:
    def __init__(self, posts):
        self.posts = list(posts)

    def sort(self, fields):
        self.posts.sort(key=lambda post: (post['created_at'], post['_id']), reverse=True)
        return self

    def skip(self, offset):
        self.posts = self.posts[offset:]
        return self

    def limit(self, limit):
        return iter(self.posts[:limit])


class PostsTests(unittest.TestCase):
    def setUp(self):
        self.posts = []
        self.db = MagicMock()
        def find(query=None):
            if not query:
                return Cursor(self.posts)
            date = query['$or'][0]['created_at']['$lt']
            post_id = query['$or'][1]['_id']['$lt']
            return Cursor(post for post in self.posts
                          if post['created_at'] < date or (post['created_at'] == date and post['_id'] < post_id))
        self.db.posts.find.side_effect = find
        def insert(post):
            post['_id'] = ObjectId()
            self.posts.append(post.copy())
            return MagicMock(inserted_id=post['_id'])
        self.db.posts.insert_one.side_effect = insert
        self.user = {'_id': 'id', 'username': 'alex', 'role': 'admin'}
        self.patches = [patch.object(api, 'db', self.db),
                        patch.object(api, 'current_user', side_effect=lambda request: self.user),
                        patch.dict(os.environ, {'APP_ORIGIN': 'https://localhost'})]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        self.client = TestClient(launch.app, base_url='https://localhost')
        self.addCleanup(self.client.close)
        self.origin = {'Origin': 'https://localhost'}

    def test_admin_creates_plain_text_post_and_all_roles_can_read(self):
        body = '<script>alert(1)</script>\nHello'
        response = self.client.post('/api/posts', headers=self.origin, json={'title': '  Notice  ', 'body': body})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['title'], 'Notice')
        self.assertEqual(response.json()['body'], body)
        self.assertEqual(response.json()['author'], 'alex')
        self.assertEqual(response.headers['cache-control'], 'no-store')
        for role in ('admin', 'professor', 'aluno'):
            self.user['role'] = role
            response = self.client.get('/api/posts')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['posts'][0]['body'], body)

    def test_only_authenticated_admin_and_correct_origin_can_publish(self):
        data = {'title': 'Notice', 'body': 'Hello'}
        for role in ('aluno', 'professor'):
            self.user['role'] = role
            self.assertEqual(self.client.post('/api/posts', headers=self.origin, json=data).status_code, 403)
        self.user['role'] = 'admin'
        self.assertEqual(self.client.post('/api/posts', headers={'Origin': 'https://evil.test'}, json=data).status_code, 403)
        with patch.object(api, 'current_user', side_effect=api.HTTPException(401, 'Invalid session')):
            self.assertEqual(self.client.post('/api/posts', headers=self.origin, json=data).status_code, 401)
            self.assertEqual(self.client.get('/api/posts').status_code, 401)
        self.assertEqual(self.posts, [])

    def test_validation_and_pagination(self):
        for data in ({'title': ' ', 'body': 'Message'}, {'title': 'ok', 'body': '  '},
                     {'title': 'x' * 121, 'body': 'Message'}, {'title': 'ok', 'body': 'x' * 5001},
                     {'title': 'ok', 'body': 'Message', 'author': 'fake'}):
            self.assertEqual(self.client.post('/api/posts', headers=self.origin, json=data).status_code, 422)
        now = datetime.now(timezone.utc)
        for index in range(3):
            self.posts.append({'_id': ObjectId(), 'title': str(index), 'body': 'Text',
                               'author': 'alex', 'created_at': now + timedelta(seconds=index)})
        first = self.client.get('/api/posts?limit=2').json()
        self.assertEqual([post['title'] for post in first['posts']], ['2', '1'])
        self.assertTrue(first['has_more'])
        last = self.client.get('/api/posts?limit=2&offset=2').json()
        self.assertEqual([post['title'] for post in last['posts']], ['0'])
        self.assertFalse(last['has_more'])
        self.assertEqual(self.client.get('/api/posts?limit=51').status_code, 422)
        self.assertEqual(self.client.get('/api/posts?offset=-1').status_code, 422)

    def test_naive_mongodb_date_is_returned_as_utc(self):
        self.posts.append({'_id': ObjectId(), 'title': 'Notice', 'body': 'Text', 'author': 'alex',
                           'created_at': datetime(2026, 1, 1, 12, 0)})
        date = self.client.get('/api/posts').json()['posts'][0]['created_at']
        self.assertEqual(datetime.fromisoformat(date).utcoffset(), timedelta(0))

    def test_cursor_pagination_stays_stable_when_a_new_post_arrives(self):
        now = datetime.now(timezone.utc)
        for index in range(3):
            self.posts.append({'_id': ObjectId(), 'title': str(index), 'body': 'Text',
                               'created_at': now + timedelta(seconds=index)})
        first = self.client.get('/api/posts', params={'limit': 2}).json()
        self.posts.append({'_id': ObjectId(), 'title': 'new', 'body': 'Text',
                           'created_at': now + timedelta(seconds=3)})
        last = self.client.get('/api/posts', params={'limit': 2, 'cursor': first['next_cursor']}).json()
        self.assertEqual([post['title'] for post in first['posts'] + last['posts']], ['2', '1', '0'])
        self.assertFalse(last['has_more'])
        self.assertIsNone(last['next_cursor'])
        self.assertEqual(self.client.get('/api/posts', params={'cursor': 'bad'}).status_code, 422)
        self.assertEqual(self.client.get('/api/posts', params={'cursor': first['next_cursor'], 'offset': 1}).status_code, 422)

    def test_cursor_uses_id_to_order_equal_timestamps(self):
        now = datetime.now(timezone.utc)
        ids = sorted(ObjectId() for _ in range(3))
        self.posts.extend({'_id': value, 'title': str(value), 'body': 'Text', 'created_at': now} for value in ids)
        first = self.client.get('/api/posts', params={'limit': 2}).json()
        last = self.client.get('/api/posts', params={'limit': 2, 'cursor': first['next_cursor']}).json()
        self.assertEqual([post['id'] for post in first['posts'] + last['posts']], [str(value) for value in reversed(ids)])

    def test_listing_includes_older_posts_without_an_author(self):
        now = datetime.now(timezone.utc)
        self.posts.extend([
            {'_id': ObjectId(), 'title': 'Older', 'body': 'Old text', 'created_at': now},
            {'_id': ObjectId(), 'title': 'Newer', 'body': 'New text', 'author': 'alex',
             'created_at': now + timedelta(seconds=1)},
        ])
        response = self.client.get('/api/posts?limit=20&offset=0')
        self.assertEqual(response.status_code, 200)
        posts = response.json()['posts']
        self.assertEqual([post['title'] for post in posts], ['Newer', 'Older'])
        self.assertEqual(posts[0]['author'], 'alex')
        self.assertIsNone(posts[1]['author'])
        self.assertNotIn('author', self.posts[0])

    def test_database_failure_is_reported(self):
        self.db.posts.find.side_effect = ServerSelectionTimeoutError('offline')
        self.assertEqual(self.client.get('/api/posts').status_code, 503)
        self.db.posts.insert_one.side_effect = ServerSelectionTimeoutError('offline')
        self.assertEqual(self.client.post('/api/posts', headers=self.origin,
                                          json={'title': 'Notice', 'body': 'Hello'}).status_code, 503)


if __name__ == '__main__':
    unittest.main()
