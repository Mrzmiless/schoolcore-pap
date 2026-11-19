"""Configuração partilhada pelo servidor e pelos comandos."""
import os
from urllib.parse import urlsplit
from dotenv import load_dotenv
from .config_paths import BASE, environment_path

load_dotenv(environment_path())


def validate_production_settings():
    """Recusa configurações inseguras quando o modo de produção é explícito."""
    if os.getenv('APP_ENV', '').strip().lower() != 'production':
        return
    try:
        origin = urlsplit(os.getenv('APP_ORIGIN', ''))
        port = origin.port
        if (origin.scheme != 'https' or not origin.hostname or origin.username is not None or origin.password is not None
                or origin.path not in ('', '/') or origin.query or origin.fragment
                or port == 0):
            raise ValueError
    except ValueError:
        raise RuntimeError('Em produção, APP_ORIGIN tem de ser uma origem HTTPS válida.') from None
    if os.getenv('COOKIE_SECURE', 'true').strip().lower() != 'true':
        raise RuntimeError('Em produção, COOKIE_SECURE tem de ser true.')


validate_production_settings()

COOKIE = 'schoolcore_session'
SECURE_COOKIE = os.getenv('COOKIE_SECURE', 'true').strip().lower() == 'true'
SESSION_SECONDS = 30 * 24 * 60 * 60
ROLES = {'aluno', 'professor', 'admin'}
