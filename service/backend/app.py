"""Aplicação FastAPI e cabeçalhos de segurança."""
from fastapi import FastAPI, Request

from . import api, pages
from .frontend_snapshot import frontend

app = FastAPI(title='SchoolCore', docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    # Same-origin requests retain their origin, without sending referrers to external sites.
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; "
        "connect-src 'self'; frame-src 'self'; object-src 'none'; "
        "base-uri 'self'; frame-ancestors 'self'; form-action 'self'"
    )
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


app.include_router(api.router)


@app.api_route('/assets/css/{filename:path}', methods=['GET', 'HEAD'])
def css_asset(filename: str):
    return frontend.response('css/' + filename)


@app.api_route('/assets/js/{filename:path}', methods=['GET', 'HEAD'])
def js_asset(filename: str):
    return frontend.response('js/' + filename)


app.include_router(pages.router)
