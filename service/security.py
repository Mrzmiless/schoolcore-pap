"""Shared security helpers for the SchoolCore API."""
import hashlib
import time
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument

LOGIN_WINDOW_SECONDS = 300
LOGIN_ATTEMPTS_PER_WINDOW = 15


def check_login_rate(collection, client_ip, now=None):
    """Atomically count login requests per client in a fixed five-minute window.

    MongoDB TTL is used only for cleanup, not for enforcing the time window.
    """
    timestamp = time.time() if now is None else now
    window = int(timestamp // LOGIN_WINDOW_SECONDS)
    key = hashlib.sha256(f'{client_ip}:{window}'.encode()).hexdigest()
    expiry = datetime.fromtimestamp((window + 1) * LOGIN_WINDOW_SECONDS, timezone.utc)
    record = collection.find_one_and_update(
        {'_id': key},
        {'$inc': {'count': 1}, '$setOnInsert': {'expires_at': expiry + timedelta(minutes=5)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return record['count'] <= LOGIN_ATTEMPTS_PER_WINDOW, max(1, int((window + 1) * LOGIN_WINDOW_SECONDS - timestamp))
