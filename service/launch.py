"""Ponto de entrada compatível para o servidor e os comandos SchoolCore."""
from backend.app import app
from backend.cli import main


if __name__ == '__main__':
    main()
