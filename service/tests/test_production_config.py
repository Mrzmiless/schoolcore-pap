import os
import unittest
from unittest.mock import patch

from backend.config import validate_production_settings


class ProductionConfigTests(unittest.TestCase):
    def test_production_requires_https_origin_and_secure_cookie(self):
        with patch.dict(os.environ, {'APP_ENV': 'production', 'APP_ORIGIN': 'https://school.example',
                                    'COOKIE_SECURE': 'true'}, clear=True):
            validate_production_settings()
            for origin in ('', 'http://school.example', 'https://school.example/path',
                           'https://user:password@school.example', 'https://@school.example', 'https://school.example:bad'):
                with self.subTest(origin=origin), patch.dict(os.environ, {'APP_ORIGIN': origin}):
                    with self.assertRaises(RuntimeError):
                        validate_production_settings()
            with patch.dict(os.environ, {'COOKIE_SECURE': 'false'}):
                with self.assertRaises(RuntimeError):
                    validate_production_settings()

    def test_development_can_use_http(self):
        with patch.dict(os.environ, {'APP_ENV': 'development', 'APP_ORIGIN': 'http://localhost:8080',
                                    'COOKIE_SECURE': 'false'}, clear=True):
            validate_production_settings()
