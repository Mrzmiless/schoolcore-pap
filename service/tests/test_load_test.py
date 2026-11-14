import contextlib
import io
import unittest
from unittest.mock import MagicMock, patch

import httpx
from bson import ObjectId

import load_test


class LoadTestTests(unittest.TestCase):
    def test_cleanup_is_limited_to_run_accounts_and_their_sessions(self):
        db = MagicMock()
        user_id = ObjectId()
        db.users.find.return_value = [{'_id': user_id}]
        db.users.delete_many.return_value.deleted_count = 1
        db.sessions.delete_many.return_value.deleted_count = 2
        self.assertEqual(load_test.cleanup(db, 'run-id'), (1, 2))
        db.users.find.assert_called_once_with({'load_test_run': 'run-id'}, {'_id': 1})
        db.sessions.delete_many.assert_called_once_with({'user_id': {'$in': [user_id]}})
        db.users.delete_many.assert_called_once_with({'_id': {'$in': [user_id]}, 'load_test_run': 'run-id'})

    def test_test_database_confirmation_is_required(self):
        for args in (['--database', 'schoolcore', '--confirm-test-db', '--url', 'http://localhost:8081'],
                     ['--database', 'schoolcore_loadtest', '--url', 'http://localhost:8081']):
            with self.subTest(args=args), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                load_test.main(args)

    def test_cleanup_runs_when_simulation_fails(self):
        client = MagicMock()
        db = client.__getitem__.return_value
        db.users.find.return_value = []
        with patch.dict('os.environ', {'MONGODB_URI': 'mongodb://localhost'}), \
             patch.object(load_test, 'MongoClient', return_value=client), \
             patch.object(load_test, 'simulate_user', side_effect=RuntimeError('simulated failure')), \
             contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            load_test.main(['--database', 'schoolcore_loadtest', '--confirm-test-db',
                            '--url', 'http://localhost:8081', '--users', '1'])
        db.users.insert_many.assert_called_once()
        db.users.delete_many.assert_called_once()
        db.sessions.delete_many.assert_called_once()
        client.close.assert_called_once()

    def test_user_flow_records_statuses_and_origin(self):
        user_id = ObjectId()
        calls = []

        def handler(request):
            calls.append(request)
            if request.url.path == '/api/login':
                return httpx.Response(200, json={}, headers={'set-cookie': 'schoolcore_session=abc; Path=/'})
            if request.url.path == '/api/me':
                self.assertIn('schoolcore_session=abc', request.headers['cookie'])
                return httpx.Response(200, json={'id': str(user_id)})
            return httpx.Response(200, json={})

        real_client = httpx.Client
        with patch.object(load_test.httpx, 'Client', side_effect=lambda **kwargs: real_client(
                transport=httpx.MockTransport(handler), **kwargs)):
            results = load_test.simulate_user('http://localhost:8081', 'temporary', 'password', user_id, 2, 5)
        self.assertEqual([(path, code) for path, code, _ in results],
                         [('/api/login', 200), ('/api/me', 200), ('/api/me', 200), ('/api/logout', 200)])
        self.assertEqual(calls[0].headers['origin'], 'http://localhost:8081')
        self.assertEqual(calls[-1].headers['origin'], 'http://localhost:8081')

    def test_rate_limit_is_reported_and_no_more_requests_are_sent(self):
        real_client = httpx.Client
        with patch.object(load_test.httpx, 'Client', side_effect=lambda **kwargs: real_client(
                transport=httpx.MockTransport(lambda request: httpx.Response(429)), **kwargs)):
            results = load_test.simulate_user('http://localhost:8081', 'temporary', 'password', ObjectId(), 2, 5)
        self.assertEqual([(path, code) for path, code, _ in results], [('/api/login', 429)])


if __name__ == '__main__':
    unittest.main()
