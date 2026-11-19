"""Endpoints da API autenticada."""
import secrets
from datetime import datetime, timedelta, timezone

from argon2.exceptions import InvalidHashError, VerificationError
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import PyMongoError

from .auth import account_allowed, current_user, hasher, require_same_origin, token_hash
from .config import COOKIE, SECURE_COOKIE, SESSION_SECONDS
from .database import db
from .preferences import PreferencesUpdate, preferences_for
from .rate_limit import check_login_rate

router = APIRouter()


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class PasswordCheck(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class NewPassword(BaseModel):
    password: str = Field(min_length=12, max_length=256)


class NewEmail(BaseModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        value = value.strip()
        if value.count('@') != 1 or any(c.isspace() for c in value) or not all(value.split('@')):
            raise ValueError('Invalid email')
        return value


class NewPost(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=5000)


def public_post(post):
    created_at = post['created_at']
    # PyMongo returns naive UTC datetimes unless the client enables tz_aware.
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {'id': str(post['_id']), 'title': post['title'], 'body': post['body'],
            'author': post.get('author'), 'created_at': created_at}


def post_cursor(post):
    date = post['created_at']
    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    return f'{date.astimezone(timezone.utc).isoformat()}~{post["_id"]}'


def posts_before(cursor):
    try:
        date_text, post_id = cursor.split('~')
        date = datetime.fromisoformat(date_text)
        if date.tzinfo is None or not ObjectId.is_valid(post_id):
            raise ValueError
        date = date.astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise HTTPException(422, 'Invalid posts cursor')
    return {'$or': [
        {'created_at': {'$lt': date}},
        {'created_at': date, '_id': {'$lt': ObjectId(post_id)}},
    ]}


@router.get('/api/posts')
def list_posts(request: Request, offset: int = Query(default=0, ge=0),
               limit: int = Query(default=20, ge=1, le=50),
               cursor: str | None = Query(default=None, min_length=1, max_length=128)):
    current_user(request)
    if cursor and offset:
        raise HTTPException(422, 'Cannot combine cursor and offset')
    query = posts_before(cursor) if cursor else None
    try:
        # Pedir mais um registo permite saber se há outra página sem contar a coleção inteira.
        results = db.posts.find(query) if query else db.posts.find()
        posts = list(results.sort([('created_at', -1), ('_id', -1)]).skip(offset).limit(limit + 1))
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    has_more = len(posts) > limit
    return {'posts': [public_post(post) for post in posts[:limit]], 'has_more': has_more,
            'next_cursor': post_cursor(posts[limit - 1]) if has_more else None}


@router.post('/api/posts', status_code=201)
def create_post(data: NewPost, request: Request):
    require_same_origin(request)
    user = current_user(request)
    # A interface esconde o formulário, mas é o servidor que decide quem publica.
    if user.get('role', 'aluno') != 'admin':
        raise HTTPException(403, 'Administrator access required')
    post = {'title': data.title, 'body': data.body, 'author': user['username'],
            'created_at': datetime.now(timezone.utc)}
    try:
        post['_id'] = db.posts.insert_one(post).inserted_id
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    return public_post(post)


@router.post('/api/login')
def login(credentials: Credentials, request: Request, response: Response):
    require_same_origin(request)
    try:
        # Contabiliza todas as tentativas, incluindo as que têm sucesso.
        allowed, retry_after = check_login_rate(db.login_rate_limits, request.client.host if request.client else 'unknown')
        if not allowed:
            raise HTTPException(429, 'Too many login attempts', headers={'Retry-After': str(retry_after)})
        user = db.users.find_one({'username': credentials.username.strip()})
        if not user:
            raise HTTPException(401, 'Invalid credentials')
        if user.get('is_active', True) is False:
            raise HTTPException(403, 'account_disabled')
        if not isinstance(user.get('password_hash'), str):
            raise HTTPException(401, 'Invalid credentials')
        try:
            hasher.verify(user['password_hash'], credentials.password)
        except (VerificationError, InvalidHashError):
            raise HTTPException(401, 'Invalid credentials')
        if not account_allowed(user):
            raise HTTPException(401, 'Invalid credentials')
        # O navegador guarda o token; a base de dados guarda apenas o respetivo hash.
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
        db.sessions.insert_one({'_id': token_hash(token), 'user_id': user['_id'], 'expires_at': expires,
                                'auth_version': user.get('auth_version', 0)})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True, secure=SECURE_COOKIE, samesite='strict', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'username': user['username']}


def security_session(request, user):
    # Ter sessão iniciada não chega: alterações sensíveis exigem confirmação recente.
    token = request.cookies.get(COOKIE)
    now = datetime.now(timezone.utc)
    try:
        session = db.sessions.find_one({'_id': token_hash(token), 'user_id': user['_id'],
                                        'expires_at': {'$gt': now}, 'security_until': {'$gt': now}}) if token else None
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if not session or session.get('auth_version', 0) != user.get('auth_version', 0):
        raise HTTPException(403, 'Reauthentication required')
    return token_hash(token)


@router.post('/api/security/unlock')
def unlock_security(credentials: PasswordCheck, request: Request):
    require_same_origin(request)
    user = current_user(request)
    try:
        for key in (f"security-ip:{request.client.host if request.client else 'unknown'}", f"security-user:{user['_id']}"):
            allowed, retry = check_login_rate(db.login_rate_limits, key)
            if not allowed:
                raise HTTPException(429, 'Too many attempts', headers={'Retry-After': str(retry)})
        if not isinstance(user.get('password_hash'), str):
            raise HTTPException(401, 'Incorrect password')
        try:
            hasher.verify(user['password_hash'], credentials.password)
        except (VerificationError, InvalidHashError):
            raise HTTPException(401, 'Incorrect password')
        now = datetime.now(timezone.utc)
        result = db.sessions.update_one({'_id': token_hash(request.cookies.get(COOKIE)), 'user_id': user['_id'],
                                         'expires_at': {'$gt': now}},
                                        {'$set': {'security_until': now + timedelta(minutes=5)}})
        if not result.matched_count:
            raise HTTPException(401, 'Invalid session')
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    return {'ok': True, 'expires_in': 300}


@router.post('/api/security/lock')
def lock_security(request: Request):
    require_same_origin(request)
    user = current_user(request)
    try:
        db.sessions.update_one({'_id': token_hash(request.cookies.get(COOKIE)), 'user_id': user['_id']},
                               {'$unset': {'security_until': ''}})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    return {'ok': True}


@router.post('/api/security/email')
def change_email(data: NewEmail, request: Request):
    require_same_origin(request)
    user = current_user(request)
    security_session(request, user)
    try:
        result = db.users.update_one({'_id': user['_id'], 'is_active': {'$ne': False},
                                      'password_hash': user['password_hash']}, {'$set': {'email': data.email}})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if not result.matched_count:
        raise HTTPException(401, 'Invalid session')
    return {'email': data.email}


@router.post('/api/security/password')
def change_password(data: NewPassword, request: Request, response: Response):
    require_same_origin(request)
    user = current_user(request)
    security_session(request, user)
    try:
        # A versão de autenticação invalida as sessões antigas após a mudança.
        result = db.users.update_one({'_id': user['_id'], 'is_active': {'$ne': False},
                                      'password_hash': user['password_hash']},
                                     {'$set': {'password_hash': hasher.hash(data.password)},
                                      '$inc': {'auth_version': 1}})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if not result.matched_count:
        raise HTTPException(401, 'Invalid session')
    response.delete_cookie(COOKIE, path='/', secure=SECURE_COOKIE, httponly=True, samesite='strict')
    return {'ok': True}


@router.get('/api/me')
def me(request: Request, response: Response):
    user = current_user(request)
    response.headers['Cache-Control'] = 'no-store'
    return {'id': str(user['_id']), 'username': user['username'],
            'first_name': user.get('first_name', ''), 'last_name': user.get('last_name', ''),
            'email': user.get('email'), 'phone_number': user.get('phone_number'),
            'grade': user.get('grade'), 'class': user.get('class'),
            'date_of_birth': user.get('date_of_birth'), 'created_at': user.get('created_at'),
            'role': user.get('role', 'aluno'), 'is_active': user.get('is_active', True),
            'is_first_login_done': user.get('is_first_login_done') is True}


@router.get('/api/preferences')
def get_preferences(request: Request):
    return preferences_for(current_user(request)).model_dump()


@router.post('/api/preferences')
def update_preferences(preferences: PreferencesUpdate, request: Request):
    require_same_origin(request)
    user = current_user(request)
    values = preferences.model_dump(exclude_unset=True)
    if values.get('language', ...) is None:
        raise HTTPException(422, 'Invalid language')
    query = {'_id': user['_id'], 'is_active': {'$ne': False}}
    stored = user.get('preferences')
    if 'preferences' in user and not isinstance(stored, dict):
        # MongoDB cannot update a dotted field under a null or scalar value.
        # Compare the old value so we do not overwrite a concurrent update.
        query['preferences'] = {'$eq': stored}
        changes = {'preferences': {**preferences_for(user).model_dump(), **values}}
    else:
        changes = {f'preferences.{key}': value for key, value in values.items()}
    try:
        result = db.users.update_one(
            query,
            {'$set': changes},
        )
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if not result.matched_count:
        if 'preferences' in query:
            raise HTTPException(409, 'Preferences changed; try again')
        raise HTTPException(401, 'Invalid session')
    # Um cliente antigo pode não enviar o idioma; preserva a escolha já guardada.
    existing = preferences_for(user).model_dump()
    return {**existing, **values}


@router.post('/api/onboarding/complete')
def complete_onboarding(request: Request, response: Response):
    require_same_origin(request)
    user = current_user(request)
    try:
        result = db.users.update_one(
            {'_id': user['_id'], 'is_active': {'$ne': False}},
            {'$set': {'is_first_login_done': True}},
        )
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    if not result.matched_count:
        raise HTTPException(401, 'Invalid session')
    response.headers['Cache-Control'] = 'no-store'
    return {'ok': True}


@router.post('/api/logout')
def logout(request: Request, response: Response):
    require_same_origin(request)
    token = request.cookies.get(COOKIE)
    try:
        if token:
            db.sessions.delete_one({'_id': token_hash(token)})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    response.delete_cookie(COOKIE, path='/', secure=SECURE_COOKIE, httponly=True, samesite='strict')
    response.headers['Cache-Control'] = 'no-store'
    return {'ok': True}
