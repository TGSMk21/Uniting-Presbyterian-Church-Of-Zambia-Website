from .base import *

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Optional dev tools (pip install -r requirements-dev.txt)
try:
    import django_extensions  # noqa: F401
    INSTALLED_APPS += ["django_extensions"]
except ImportError:
    pass

CORS_ALLOW_ALL_ORIGINS = True
