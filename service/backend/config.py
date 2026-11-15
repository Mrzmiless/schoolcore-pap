"""Configuração partilhada pelo servidor e pelos comandos."""
import os
from dotenv import load_dotenv
from .config_paths import BASE, environment_path

load_dotenv(environment_path())

COOKIE = 'schoolcore_session'
SECURE_COOKIE = os.getenv('COOKIE_SECURE', 'true').lower() == 'true'
SESSION_SECONDS = 30 * 24 * 60 * 60
ROLES = {'aluno', 'professor', 'admin'}
