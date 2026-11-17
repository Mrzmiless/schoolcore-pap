"""Ligação MongoDB e índices usados pela aplicação."""
import os

from pymongo import MongoClient

from . import config  # Carrega o .env antes de ler as variáveis.

client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'), serverSelectionTimeoutMS=3000)
db = client[os.getenv('MONGODB_DATABASE', 'schoolcore')]


def ensure_indexes():
    db.users.create_index('username', unique=True)
    db.sessions.create_index('expires_at', expireAfterSeconds=0)
    db.login_rate_limits.create_index('expires_at', expireAfterSeconds=0)
    db.posts.create_index([('created_at', -1), ('_id', -1)])
