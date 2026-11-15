"""Localização da configuração, incluindo compatibilidade com instalações antigas."""
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


def environment_path(base=BASE):
    current = base / 'config' / '.env'
    legacy = base / '.env'
    if current.exists() and legacy.exists():
        raise RuntimeError('Existem dois ficheiros .env: escolhe apenas config/.env ou o antigo .env.')
    return legacy if legacy.exists() else current
