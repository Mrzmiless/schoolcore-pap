"""Guarda capturas de todos os ecrãs numa pasta escolhida."""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description='Guarda uma captura de ecrã a cada dois minutos.'
    )
    parser.add_argument('pasta', type=Path, help='Pasta onde guardar as capturas')
    args = parser.parse_args()

    try:
        from PIL import ImageGrab
    except ImportError:
        print('Instala primeiro a dependência: python -m pip install Pillow', file=sys.stderr)
        return 1

    if sys.platform != 'win32':
        print('Este script foi preparado para capturar todos os ecrãs no Windows.', file=sys.stderr)
        return 1

    try:
        args.pasta.mkdir(parents=True, exist_ok=True)
        print(f'Capturas em: {args.pasta.resolve()}')
        print('A captura começa agora e repete-se a cada 2 minutos. Para terminar, carrega em Ctrl+C.')
        while True:
            nome = datetime.now().strftime('captura_%Y-%m-%d_%H-%M-%S_%f.png')
            caminho = args.pasta / nome
            with ImageGrab.grab(all_screens=True) as imagem:
                imagem.save(caminho)
            print(f'Guardada: {caminho}', flush=True)
            time.sleep(120)
    except KeyboardInterrupt:
        print('\nCapturas terminadas.')
        return 0
    except OSError as erro:
        print(f'Não foi possível criar ou guardar a captura: {erro}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
