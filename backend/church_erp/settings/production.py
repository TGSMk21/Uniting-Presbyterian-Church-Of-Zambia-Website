import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *
from .storage import object_storages


def required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"{name} must be set in production.")
    return value


def env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = False

if not SECRET_KEY or SECRET_KEY == INSECURE_DEV_SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a long random value in production.")

# Render provides the service's own hostname; other hosts come from the env.
ALLOWED_HOSTS = env_list(os.environ.get("DJANGO_ALLOWED_HOSTS", ""))
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production (or run on Render).")

# FRONTEND_URL may list several origins: the domain, www., a Vercel preview URL.
CORS_ALLOWED_ORIGINS = env_list(required_env("FRONTEND_URL"))
CSRF_TRUSTED_ORIGINS = env_list(os.environ.get("CSRF_TRUSTED_ORIGINS", ""))

DATABASES = {
    "default": dj_database_url.parse(
        required_env("DATABASE_URL"),
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True,
    )
}
# Supabase's transaction pooler (port 6543) can't hold server-side cursors.
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = DATABASES["default"].get("PORT") == 6543

MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    **STORAGES,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# Uploads go to object storage once a bucket is configured; without it they
# land on the server's disk, which Render wipes on every deploy.
if os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip():
    STORAGES.update(object_storages(
        public_bucket=required_env("AWS_STORAGE_BUCKET_NAME"),
        private_bucket=required_env("AWS_PRIVATE_BUCKET_NAME"),
        public_domain=required_env("MEDIA_PUBLIC_DOMAIN"),
        endpoint_url=required_env("AWS_S3_ENDPOINT_URL"),
        access_key=required_env("AWS_ACCESS_KEY_ID"),
        secret_key=required_env("AWS_SECRET_ACCESS_KEY"),
    ))

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
