"""Sessões, validação de origem e regras de acesso às contas."""
import hashlib
import os
from datetime import datetime, timezone

from argon2 import PasswordHasher
from fastapi import HTTPException, Request
from pymongo.errors import PyMongoError

from .config import COOKIE, ROLES
from .database import db

hasher = PasswordHasher()


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def account_allowed(user):
    # Contas antigas sem estes campos mantêm o acesso de aluno.
    return user and user.get('is_active', True) is True and user.get('role', 'aluno') in ROLES


def current_user(request):
    token = request.cookies.get(COOKIE)
    try:
        session = db.sessions.find_one({'_id': token_hash(token), 'expires_at': {'$gt': datetime.now(timezone.utc)}}) if token else None
        user = db.users.find_one({'_id': session['user_id']}) if session else None
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if (not account_allowed(user) or
            session.get('auth_version', 0) != user.get('auth_version', 0)):
        raise HTTPException(401, 'Invalid session')
    return user


def require_same_origin(request: Request):
    origin = request.headers.get('origin')
    expected = os.getenv('APP_ORIGIN')
    if not origin or (expected and origin.rstrip('/') != expected.rstrip('/')):
        raise HTTPException(403, 'Invalid origin')
    if not expected and origin.rstrip('/') != str(request.base_url).rstrip('/'):
        raise HTTPException(403, 'Invalid origin')
