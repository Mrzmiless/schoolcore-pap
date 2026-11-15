import tempfile
import unittest
from pathlib import Path

from backend.config_paths import environment_path


class ConfigPathsTests(unittest.TestCase):
    def test_new_location_is_default_and_legacy_is_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            self.assertEqual(environment_path(base), base / 'config' / '.env')
            legacy = base / '.env'
            legacy.touch()
            self.assertEqual(environment_path(base), legacy)
            legacy.unlink()
            (base / 'config').mkdir()
            current = base / 'config' / '.env'
            current.touch()
            self.assertEqual(environment_path(base), current)

    def test_conflicting_files_are_not_silently_chosen(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / '.env').touch()
            (base / 'config').mkdir()
            (base / 'config' / '.env').touch()
            with self.assertRaisesRegex(RuntimeError, 'dois ficheiros'):
                environment_path(base)
