"""Fotografia dos ficheiros do frontend, mantida até ao reinício do processo."""
import mimetypes

from fastapi import HTTPException
from fastapi.responses import Response

from .config_paths import BASE


class FrontendSnapshot:
    def __init__(self, base=BASE):
        root = (base / 'frontend').resolve()
        self.files = {}
        for folder in ('html', 'css', 'js', 'pwa', 'assets'):
            directory = root / folder
            allowed_root = directory.resolve()
            if not allowed_root.is_relative_to(root):
                continue
            for path in directory.rglob('*'):
                if path.is_file() and path.resolve().is_relative_to(allowed_root):
                    self.files[path.relative_to(root).as_posix()] = path.read_bytes()

    def response(self, name):
        content = self.files.get(name)
        if content is None:
            raise HTTPException(404)
        media_type = 'application/javascript' if name.endswith('.js') else mimetypes.guess_type(name)[0]
        return Response(content, media_type=media_type or 'application/octet-stream',
                        headers={'Cache-Control': 'no-store'})


frontend = FrontendSnapshot()
