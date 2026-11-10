"""Servidor da SchoolCore e gestão inicial de utilizadores."""
import argparse
import getpass
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import uvicorn
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from security import check_login_rate

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / '.env')
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'), serverSelectionTimeoutMS=3000)
db = client[os.getenv('MONGODB_DATABASE', 'schoolcore')]
hasher = PasswordHasher()
app = FastAPI(title='SchoolCore', docs_url=None, redoc_url=None, openapi_url=None)
COOKIE = 'schoolcore_session'
SECURE_COOKIE = os.getenv('COOKIE_SECURE', 'true').lower() == 'true'
SESSION_SECONDS = 30 * 24 * 60 * 60
ROLES = {'aluno', 'professor', 'admin'}


def ensure_indexes():
    db.users.create_index('username', unique=True)
    db.sessions.create_index('expires_at', expireAfterSeconds=0)
    db.login_rate_limits.create_index('expires_at', expireAfterSeconds=0)


@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; "
        "connect-src 'self'; frame-src 'self'; object-src 'none'; "
        "base-uri 'self'; frame-ancestors 'self'; form-action 'self'"
    )
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


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
    if not account_allowed(user):
        raise HTTPException(401, 'Invalid session')
    return user


def require_same_origin(request: Request):
    # Browsers send Origin for these JSON POST requests; reject cross-site requests.
    origin = request.headers.get('origin')
    expected = os.getenv('APP_ORIGIN')
    if not origin or (expected and origin.rstrip('/') != expected.rstrip('/')):
        raise HTTPException(403, 'Invalid origin')
    if not expected and origin.rstrip('/') != str(request.base_url).rstrip('/'):
        raise HTTPException(403, 'Invalid origin')


@app.post('/api/login')
def login(credentials: Credentials, request: Request, response: Response):
    require_same_origin(request)
    try:
        allowed, retry_after = check_login_rate(db.login_rate_limits, request.client.host if request.client else 'unknown')
        if not allowed:
            raise HTTPException(429, 'Too many login attempts', headers={'Retry-After': str(retry_after)})
        user = db.users.find_one({'username': credentials.username.strip()})
        if not user:
            raise HTTPException(401, 'Invalid credentials')
        if user.get('is_active', True) is False:
            raise HTTPException(403, 'account_disabled')
        try:
            hasher.verify(user['password_hash'], credentials.password)
        except VerificationError:
            raise HTTPException(401, 'Invalid credentials')
        if not account_allowed(user):
            raise HTTPException(401, 'Invalid credentials')
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
        db.sessions.insert_one({'_id': token_hash(token), 'user_id': user['_id'], 'expires_at': expires})
    except PyMongoError:
        raise HTTPException(503, 'Database unavailable')
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True, secure=SECURE_COOKIE, samesite='strict', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'username': user['username']}


@app.get('/api/me')
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


@app.post('/api/onboarding/complete')
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


@app.post('/api/logout')
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


# Só os ficheiros públicos são disponibilizados; .env e código nunca são servidos.
@app.get('/')
def index():
    return FileResponse(BASE / 'index.html')


@app.get('/pages/login/index.html')
def login_page():
    return FileResponse(BASE / 'pages' / 'login' / 'index.html')


@app.get('/pages/start/loading.html')
def loading_page():
    return FileResponse(BASE / 'pages' / 'start' / 'loading.html')


@app.get('/pages/start/index.html')
def start_page(request: Request):
    try:
        me(request, Response())
    except HTTPException as error:
        if error.status_code == 401:
            return RedirectResponse('/pages/login/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
        raise
    return FileResponse(BASE / 'pages' / 'start' / 'index.html', headers={'Cache-Control': 'no-store'})


@app.get('/{filename}')
def public_file(filename: str):
    if filename not in {'index.html', 'sw.js', 'manifest.webmanifest', 'image.png', 'style.css', 'loading.js'}:
        raise HTTPException(404)
    return FileResponse(BASE / filename)


@app.get('/images/{filename}')
def image(filename: str):
    if filename not in {'Icon 192x192.png', 'Icon 512x512.png', 'Icon 2000x2000.png'}:
        raise HTTPException(404)
    return FileResponse(BASE / 'images' / filename)


def main():
    parser = argparse.ArgumentParser(description='SchoolCore')
    parser.add_argument('command', choices=['serve', 'create-user'], nargs='?', default='serve')
    args = parser.parse_args()
    if args.command == 'create-user':
        username = input('Username: ').strip()
        first_name = input('Primeiro nome: ').strip()
        last_name = input('Apelido: ').strip()
        email = input('Email (opcional): ').strip()
        phone_number = input('Telefone (opcional): ').strip()
        grade_text = input('Ano escolar, em número (opcional): ').strip()
        school_class = input('Turma (opcional): ').strip()
        if grade_text and (not grade_text.isascii() or not grade_text.isdigit() or not 1 <= int(grade_text) <= 99):
            parser.error('O ano escolar tem de ser um número entre 1 e 99.')
        grade = int(grade_text) if grade_text else None
        if ((email and (len(email) > 254 or email.count('@') != 1 or any(c.isspace() for c in email)
                        or not all(email.split('@'))))
                or len(phone_number) > 30 or len(school_class) > 30):
            parser.error('Email, telefone ou turma inválidos.')
        role = input('Perfil (aluno/professor/admin): ').strip().lower()
        date_text = input('Data de nascimento (DD/MM/AAAA): ').strip()
        try:
            birth_date = datetime.strptime(date_text, '%d/%m/%Y').replace(tzinfo=timezone.utc)
            if birth_date.date() > datetime.now(timezone.utc).date():
                raise ValueError
        except ValueError:
            parser.error('Data de nascimento inválida ou no futuro.')
        password = getpass.getpass('Password: ')
        confirmation = getpass.getpass('Confirmar password: ')
        if (not username or len(username) > 100 or not first_name or len(first_name) > 100
                or not last_name or len(last_name) > 100 or role not in ROLES
                or not 12 <= len(password) <= 256 or password != confirmation):
            parser.error('Dados inválidos: verifica os nomes, perfil e passwords (mínimo 12 caracteres).')
        try:
            ensure_indexes()
            db.users.insert_one({'username': username, 'password_hash': hasher.hash(password),
                                 'first_name': first_name, 'last_name': last_name, 'role': role,
                                 'email': email or None, 'phone_number': phone_number or None,
                                 'grade': grade, 'class': school_class or None,
                                 'date_of_birth': birth_date, 'is_active': True,
                                 'is_first_login_done': False, 'created_at': datetime.now(timezone.utc)})
        except DuplicateKeyError:
            parser.error('Este utilizador já existe.')
        except PyMongoError:
            parser.error('Não foi possível ligar ao MongoDB.')
        print('Utilizador criado.')
    else:
        try:
            ensure_indexes()
        except PyMongoError:
            parser.error('Não foi possível ligar ao MongoDB.')
        try:
            uvicorn.run(app, host=os.getenv('HOST', '127.0.0.1'),
                        port=int(os.getenv('PORT', '8080')), timeout_graceful_shutdown=5,
                        proxy_headers=False)
        finally:
            client.close()


if __name__ == '__main__':
    main()
