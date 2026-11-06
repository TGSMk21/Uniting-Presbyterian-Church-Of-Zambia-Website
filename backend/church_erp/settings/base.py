import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

INSECURE_DEV_SECRET_KEY = "insecure-dev-key-change-in-production"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", INSECURE_DEV_SECRET_KEY)

DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "import_export",
    "axes",
    # Local
    "church_erp.core",
    "church_erp.accounts",
    "church_erp.content",
    "church_erp.media_library",
    "church_erp.ai_messages",
    "church_erp.finance",
    "church_erp.api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "church_erp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "church_erp.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "church_erp"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "OPTIONS": {"sslmode": os.environ.get("DB_SSLMODE", "prefer")},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lusaka"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
# Media-library files are internal; production keeps them in a private
# bucket (settings/storage.py). Locally both live on disk.
PRIVATE_MEDIA_URL = "media-private/"
PRIVATE_MEDIA_ROOT = BASE_DIR / "media_private"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "private": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": PRIVATE_MEDIA_ROOT, "base_url": f"/{PRIVATE_MEDIA_URL}"},
    },
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# --- Admin login ---
# Set DJANGO_ADMIN_PATH to keep bots from finding the login page at /admin/.
ADMIN_PATH = os.environ.get("DJANGO_ADMIN_PATH", "").strip().strip("/") or "admin"
# Locks a username (bots rotate addresses) or an address (bots try one password
# on many usernames). Anyone who knows a username can lock it for 15 minutes; a
# superuser can clear it sooner under Axes > Access attempts in the admin.
AXES_FAILURE_LIMIT = 10
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_PARAMETERS = ["username", "ip_address"]
AXES_RESET_ON_SUCCESS = True
AXES_CLIENT_IP_CALLABLE = "church_erp.core.client_address.client_address"

# --- CORS ---
CORS_ALLOWED_ORIGINS = [
    os.environ.get("FRONTEND_URL", "http://localhost:3000"),
]

# --- CSV export ---
# A cell starting with "=" could run as a formula when opened in a spreadsheet.
IMPORT_EXPORT_ESCAPE_FORMULAE_ON_EXPORT = True

# --- REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "church_erp.accounts.authentication.StaffJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "church_erp.api.throttling.PublicReadThrottle",
        "church_erp.api.throttling.StaffThrottle",
        "church_erp.api.throttling.WriteThrottle",
    ],
    # The website builds and refreshes its pages from a few shared Vercel
    # addresses, so "anon" must stay high enough for a full site build.
    "DEFAULT_THROTTLE_RATES": {
        "anon": "600/min",
        "user": "600/min",
        "write": "60/min",
        "login": "30/min",
    },
}

# --- Staff sign-in ---
# Shared with the website's server; sign-in stays off until it's set.
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    # Each use replaces it, so a session ends after 3 days without a visit.
    "REFRESH_TOKEN_LIFETIME": timedelta(days=3),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # Changing a password ends the access tokens issued before it.
    "CHECK_REVOKE_TOKEN": True,
    "USER_AUTHENTICATION_RULE": "church_erp.accounts.authentication.is_active_staff",
}

# --- Celery ---
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Lusaka"
CELERY_BEAT_SCHEDULE = {
    "sync-youtube-sermons": {
        "task": "church_erp.content.tasks.sync_youtube_sermons",
        "schedule": 300.0,  # every 5 minutes; ~2 quota units per branch per run
    },
}

# --- External APIs ---
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
# Shared secret for POST /api/tasks/sync-youtube/ (empty disables the endpoint)
SYNC_TOKEN = os.environ.get("SYNC_TOKEN", "")

# --- Security ---
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
