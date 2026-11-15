"""Aplicação FastAPI e cabeçalhos de segurança."""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from . import api, pages
from .config import BASE

app = FastAPI(title='SchoolCore', docs_url=None, redoc_url=None, openapi_url=None)


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


app.include_router(api.router)
app.mount('/assets/css', StaticFiles(directory=BASE / 'frontend' / 'css'), name='css')
app.mount('/assets/js', StaticFiles(directory=BASE / 'frontend' / 'js'), name='js')
app.include_router(pages.router)
