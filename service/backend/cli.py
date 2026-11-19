"""Comandos para iniciar o servidor e criar utilizadores."""
import argparse
import getpass
import os
from datetime import datetime, timezone

import uvicorn
from pymongo.errors import DuplicateKeyError, PyMongoError

from .app import app
from .auth import hasher
from .config import ROLES
from .database import client, db, ensure_indexes


def main():
    parser = argparse.ArgumentParser(description='SchoolCore')
    parser.add_argument('command', choices=['serve', 'create-user'], nargs='?', default='serve')
    args = parser.parse_args()
    if args.command == 'create-user':
        # Recolher e validar os dados antes de escrever qualquer coisa na base.
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
        # Falhar logo no arranque evita anunciar uma app sem base de dados acessível.
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
