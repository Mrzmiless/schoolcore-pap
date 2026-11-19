"""Páginas e ficheiros públicos, com controlo de acesso explícito."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from .auth import current_user
from .frontend_snapshot import frontend

router = APIRouter()
# Lista explícita: nem tudo o que vive no disco tem bilhete para a internet.
PUBLIC_FILES = {
    'index.html': 'html/index.html',
    'sw.js': 'pwa/sw.js',
    'manifest.webmanifest': 'pwa/manifest.webmanifest',
    'image.png': 'assets/image.png',
    'style.css': 'css/legacy-style.css',
    'loading.js': 'js/loading.js',
}


@router.get('/')
def index():
    return frontend.response('html/index.html')


@router.get('/pages/login/index.html')
def login_page():
    return frontend.response('html/login/index.html')


@router.get('/pages/start/loading.html')
def loading_page():
    return frontend.response('html/start/loading.html')


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
    return frontend.response('html/start/index.html')


def authenticated_start_page(request: Request, filename: str):
    # A introdução deve estar concluída antes de abrir as páginas principais.
    try:
        user = current_user(request)
    except HTTPException as error:
        if error.status_code == 401:
            return RedirectResponse('/pages/login/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
        raise
    if user.get('is_first_login_done') is not True:
        return RedirectResponse('/pages/start/index.html', status_code=303, headers={'Cache-Control': 'no-store'})
    return frontend.response('html/start/' + filename)


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
    return frontend.response(PUBLIC_FILES[filename])


@router.get('/images/{filename}')
def image(filename: str):
    if filename not in {'Icon 192x192.png', 'Icon 512x512.png', 'Icon 2000x2000.png'}:
        raise HTTPException(404)
    return frontend.response('assets/icons/' + filename)
