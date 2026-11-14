"""Teste de carga com contas temporárias numa base de dados de teste."""
import argparse
import math
import os
import secrets
import statistics
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from argon2 import PasswordHasher
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


def origin_url(value):
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username
            or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise argparse.ArgumentTypeError('Usa apenas a origem, por exemplo http://127.0.0.1:8081')
    try:
        parsed.port
    except ValueError as exc:
        raise argparse.ArgumentTypeError('Porta inválida') from exc
    return value.rstrip('/')


def positive(value):
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError('Introduz um número inteiro positivo') from exc
    if number < 1:
        raise argparse.ArgumentTypeError('Introduz um número inteiro positivo')
    return number


def percentile(values, percent):
    values = sorted(values)
    return values[max(0, math.ceil(len(values) * percent / 100) - 1)]


def cleanup(db, run_id):
    # Only accounts marked by this run, and their sessions, are eligible for deletion.
    selector = {'load_test_run': run_id}
    ids = [user['_id'] for user in db.users.find(selector, {'_id': 1})]
    sessions = db.sessions.delete_many({'user_id': {'$in': ids}}).deleted_count
    users = db.users.delete_many({'_id': {'$in': ids}, **selector}).deleted_count
    return users, sessions


def simulate_user(base_url, username, password, expected_id, requests_per_user, timeout):
    results = []

    def request(client, method, path, **kwargs):
        start = time.perf_counter()
        try:
            response = client.request(method, base_url + path, **kwargs)
            results.append((path, response.status_code, time.perf_counter() - start))
            return response
        except httpx.RequestError:
            results.append((path, 'erro de ligação', time.perf_counter() - start))
            return None

    with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
        response = request(client, 'POST', '/api/login', headers={'Origin': base_url},
                           json={'username': username, 'password': password})
        if response is None or response.status_code != 200:
            return results
        for index in range(requests_per_user):
            response = request(client, 'GET', '/api/me')
            if response is None or response.status_code != 200:
                break
            if index == 0:
                try:
                    matches = response.json().get('id') == str(expected_id)
                except (ValueError, AttributeError):
                    matches = False
                if not matches:
                    results.append(('/api/me', 'conta inesperada', 0))
                    break
        request(client, 'POST', '/api/logout', headers={'Origin': base_url})
    return results


def print_report(results, elapsed):
    print(f'\nDuração do teste: {elapsed:.2f} s')
    for path in ('/api/login', '/api/me', '/api/logout'):
        entries = [(status, duration) for endpoint, status, duration in results if endpoint == path]
        if not entries:
            continue
        times = [duration * 1000 for status, duration in entries if isinstance(status, int)]
        statuses = Counter(str(status) for status, _ in entries)
        print(f'\n{path}: {len(entries)} pedidos; resultados: {dict(statuses)}')
        if times:
            print(f'  Tempo de resposta em ms: média {statistics.mean(times):.1f}, '
                  f'mediana {statistics.median(times):.1f}, p95 {percentile(times, 95):.1f}, '
                  f'p99 {percentile(times, 99):.1f}, máximo {max(times):.1f}')
    print(f'Pedidos concluídos por segundo: {len(results) / elapsed:.2f}' if elapsed else '')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, help='Base isolada cujo nome termina em _loadtest')
    parser.add_argument('--url', type=origin_url, help='Origem exata do servidor de teste')
    parser.add_argument('--users', type=positive, default=5, help='Contas temporárias (padrão: 5)')
    parser.add_argument('--concurrency', type=positive, default=5, help='Utilizadores simultâneos (padrão: 5)')
    parser.add_argument('--requests', type=positive, default=5, help='Pedidos /api/me por utilizador')
    parser.add_argument('--timeout', type=positive, default=10, help='Timeout por pedido em segundos')
    parser.add_argument('--confirm-test-db', action='store_true', help='Confirma que a base e o servidor são de teste')
    parser.add_argument('--cleanup-run', help='Limpa contas restantes de uma execução anterior pelo seu ID')
    args = parser.parse_args(argv)
    if not args.database.endswith('_loadtest') or not args.confirm_test_db:
        parser.error('É obrigatória uma base isolada terminada em _loadtest e --confirm-test-db')
    if not args.cleanup_run and not args.url:
        parser.error('--url é obrigatório para executar o teste')
    if args.cleanup_run and (len(args.cleanup_run) != 32 or any(c not in '0123456789abcdef' for c in args.cleanup_run)):
        parser.error('ID de execução inválido')

    load_dotenv(Path(__file__).resolve().parent / '.env')
    uri = os.getenv('MONGODB_URI')
    if not uri:
        parser.error('Configura MONGODB_URI em service/.env')
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    db = client[args.database]
    run_id = args.cleanup_run or secrets.token_hex(16)
    print(f'Base de teste: {args.database}; ID da execução: {run_id}', flush=True)
    if args.cleanup_run:
        try:
            users, sessions = cleanup(db, run_id)
            print(f'Limpeza concluída: {users} contas e {sessions} sessões removidas.')
            return 0
        finally:
            client.close()

    print('Usa um servidor isolado ligado à mesma base; os limites de login continuam ativos.')
    password = secrets.token_urlsafe(24)
    hashed = PasswordHasher().hash(password)
    accounts = [{'_id': ObjectId(), 'username': f'loadtest_{run_id}_{i}',
                 'password_hash': hashed, 'first_name': 'Teste', 'last_name': 'Carga',
                 'role': 'aluno', 'is_active': True, 'load_test_run': run_id}
                for i in range(args.users)]
    results = []
    cleanup_failed = False
    try:
        db.users.insert_many(accounts)
        start = time.perf_counter()
        with ThreadPoolExecutor(max_workers=min(args.concurrency, args.users)) as executor:
            futures = [executor.submit(simulate_user, args.url, account['username'], password,
                                       account['_id'], args.requests, args.timeout)
                       for account in accounts]
            for future in futures:
                results.extend(future.result())
        print_report(results, time.perf_counter() - start)
    finally:
        try:
            users, sessions = cleanup(db, run_id)
            print(f'\nLimpeza concluída: {users} contas e {sessions} sessões removidas.')
        except PyMongoError:
            cleanup_failed = True
            print(f'Limpeza falhou. Repete com --cleanup-run {run_id} e a mesma base.', file=sys.stderr)
        finally:
            client.close()
    return int(cleanup_failed or any(status != 200 for _, status, _ in results))


if __name__ == '__main__':
    sys.exit(main())
