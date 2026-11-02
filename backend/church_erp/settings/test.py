from .base import *

# Tests run against an in-memory SQLite database, never the real Postgres.
# pgvector's VectorField still creates its column here (SQLite accepts any
# column type), but vector similarity queries need Postgres and are not
# covered by this settings module.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
