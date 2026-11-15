"""Páginas e ficheiros públicos, com controlo de acesso explícito."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse

from .auth import current_user
from .config import BASE

router = APIRouter()
HTML = BASE / 'frontend' / 'html'
FRONTEND = BASE / 'frontend'
PUBLIC_FILES = {
    'index.html': HTML / 'index.html',
    'sw.js': FRONTEND / 'pwa' / 'sw.js',
    'manifest.webmanifest': FRONTEND / 'pwa' / 'manifest.webmanifest',
    'image.png': FRONTEND / 'assets' / 'image.png',
    'style.css': FRONTEND / 'css' / 'legacy-style.css',
    'loading.js': FRONTEND / 'js' / 'loading.js',
}


@router.get('/')
def index():
    return FileResponse(HTML / 'index.html')


@router.get('/pages/login/index.html')
def login_page():
    return FileResponse(HTML / 'login' / 'index.html')


@router.get('/pages/start/loading.html')
def loading_page():
    return FileResponse(HTML / 'start' / 'loading.html')


@router.get('/pages/start/index.html')
def start_page(request: Request):
    try:
        user = current_user(request)
    except HTTPException as error:
        if error.status_code == 401:
            return RedirectResponse('/pages/login/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
        raise
    if user.get('is_first_login_done') is True:
        return RedirectResponse('/pages/start/HomePage.html', status_code=303, headers={'Cache-Control': 'no-store'})
    return FileResponse(HTML / 'start' / 'index.html', headers={'Cache-Control': 'no-store'})


def authenticated_start_page(request: Request, filename: str):
    try:
        user = current_user(request)
    except HTTPException as error:
        if error.status_code == 401:
            return RedirectResponse('/pages/login/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
        raise
    if user.get('is_first_login_done') is not True:
        return RedirectResponse('/pages/start/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
    return FileResponse(HTML / 'start' / filename, headers={'Cache-Control': 'no-store'})


@router.get('/pages/start/HomePage.html')
def home_page(request: Request):
    return authenticated_start_page(request, 'HomePage.html')


@router.get('/pages/start/account.html')
def account_page(request: Request):
    return authenticated_start_page(request, 'account.html')


@router.get('/pages/start/home-content.html')
def home_content(request: Request):
    return authenticated_start_page(request, 'home-content.html')


@router.get('/pages/start/not-found.html')
def unavailable_page(request: Request):
    return authenticated_start_page(request, 'not-found.html')


@router.get('/{filename}')
def public_file(filename: str):
    if filename not in PUBLIC_FILES:
        raise HTTPException(404)
    return FileResponse(PUBLIC_FILES[filename])


@router.get('/images/{filename}')
def image(filename: str):
    if filename not in {'Icon 192x192.png', 'Icon 512x512.png', 'Icon 2000x2000.png'}:
        raise HTTPException(404)
    return FileResponse(FRONTEND / 'assets' / 'icons' / filename)
