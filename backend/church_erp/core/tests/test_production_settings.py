"""settings/production.py (AGENT_EXECUTION_PLAN.md, Task 1.3).

Settings load once per process, so each case runs a fresh interpreter with
an explicit environment. Every variable is set (empty if "missing") so a
developer's backend/.env, which load_dotenv() never lets override, can't
leak in.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parents[3]

GOOD_ENV = {
    "DJANGO_SETTINGS_MODULE": "church_erp.settings.production",
    "DJANGO_SECRET_KEY": "x9!kq2-very-long-random-secret-for-tests-0123456789abcdefghij",
    "DJANGO_ALLOWED_HOSTS": "api.example.org, admin.example.org",
    "DATABASE_URL": "postgres://user:pw@db.example.org:5432/church",
    "FRONTEND_URL": "https://upcz.example.org, https://www.upcz.example.org",
    "CSRF_TRUSTED_ORIGINS": "https://api.example.org",
    "DJANGO_DEBUG": "",
    "RENDER_EXTERNAL_HOSTNAME": "",
    "AWS_STORAGE_BUCKET_NAME": "", "AWS_PRIVATE_BUCKET_NAME": "", "MEDIA_PUBLIC_DOMAIN": "",
    "AWS_S3_ENDPOINT_URL": "", "AWS_ACCESS_KEY_ID": "", "AWS_SECRET_ACCESS_KEY": "",
    "DB_NAME": "", "DB_USER": "", "DB_PASSWORD": "", "DB_HOST": "", "DB_PORT": "",
}

READ_SETTINGS = """
import json, django
django.setup()
from django.conf import settings as s
db = s.DATABASES["default"]
print(json.dumps({
    "DEBUG": s.DEBUG,
    "ALLOWED_HOSTS": s.ALLOWED_HOSTS,
    "CORS_ALLOWED_ORIGINS": s.CORS_ALLOWED_ORIGINS,
    "CORS_ALLOW_ALL_ORIGINS": getattr(s, "CORS_ALLOW_ALL_ORIGINS", False),
    "CSRF_TRUSTED_ORIGINS": s.CSRF_TRUSTED_ORIGINS,
    "DB": {k: db.get(k) for k in ("ENGINE", "NAME", "HOST", "PORT", "CONN_MAX_AGE",
                                   "DISABLE_SERVER_SIDE_CURSORS")},
    "DB_SSLMODE": db.get("OPTIONS", {}).get("sslmode"),
    "MIDDLEWARE": s.MIDDLEWARE,
    "STATICFILES_BACKEND": s.STORAGES["staticfiles"]["BACKEND"],
    "STORAGES": {k: v for k, v in s.STORAGES.items() if k != "staticfiles"},
    "ROOT_LOG_HANDLERS": s.LOGGING["root"]["handlers"],
}, default=str))
"""


def run(code_or_args, **overrides):
    env = {**os.environ, **GOOD_ENV, **overrides}
    args = code_or_args if isinstance(code_or_args, list) else ["-c", code_or_args]
    return subprocess.run(
        [sys.executable, *args], cwd=BACKEND_DIR, env=env,
        capture_output=True, text=True, timeout=120,
    )


def settings_with(**overrides):
    result = run(READ_SETTINGS, **overrides)
    if result.returncode != 0:
        raise AssertionError(result.stderr[-2000:])
    return json.loads(result.stdout.strip().splitlines()[-1])


class ProductionSettingsTests(SimpleTestCase):
    def test_debug_is_off_even_if_env_says_otherwise(self):
        self.assertFalse(settings_with(DJANGO_DEBUG="True")["DEBUG"])

    def test_hosts_and_origins_are_read_from_comma_separated_env(self):
        s = settings_with()
        self.assertEqual(s["ALLOWED_HOSTS"], ["api.example.org", "admin.example.org"])
        self.assertEqual(
            s["CORS_ALLOWED_ORIGINS"], ["https://upcz.example.org", "https://www.upcz.example.org"]
        )
        self.assertFalse(s["CORS_ALLOW_ALL_ORIGINS"])
        self.assertEqual(s["CSRF_TRUSTED_ORIGINS"], ["https://api.example.org"])

    def test_database_comes_from_database_url_with_ssl_and_pooling(self):
        s = settings_with()
        self.assertEqual(s["DB"]["HOST"], "db.example.org")
        self.assertEqual(s["DB"]["NAME"], "church")
        self.assertEqual(s["DB_SSLMODE"], "require")
        self.assertGreater(s["DB"]["CONN_MAX_AGE"], 0)
        self.assertFalse(s["DB"]["DISABLE_SERVER_SIDE_CURSORS"])

    def test_supabase_transaction_pooler_disables_server_side_cursors(self):
        s = settings_with(DATABASE_URL="postgres://u:p@pooler.supabase.com:6543/postgres")
        self.assertTrue(s["DB"]["DISABLE_SERVER_SIDE_CURSORS"])

    def test_static_files_are_served_by_whitenoise(self):
        s = settings_with()
        security = s["MIDDLEWARE"].index("django.middleware.security.SecurityMiddleware")
        self.assertEqual(
            s["MIDDLEWARE"][security + 1], "whitenoise.middleware.WhiteNoiseMiddleware"
        )
        self.assertIn("whitenoise", s["STATICFILES_BACKEND"])

    R2_ENV = {
        "AWS_STORAGE_BUCKET_NAME": "upcz-public",
        "AWS_PRIVATE_BUCKET_NAME": "upcz-private",
        "MEDIA_PUBLIC_DOMAIN": "media.upcz.example.org",
        "AWS_S3_ENDPOINT_URL": "https://acct.r2.cloudflarestorage.com",
        "AWS_ACCESS_KEY_ID": "key-id",
        "AWS_SECRET_ACCESS_KEY": "key-secret",
    }

    def test_uploads_use_object_storage_when_configured(self):
        storages = settings_with(**self.R2_ENV)["STORAGES"]
        public, private = storages["default"], storages["private"]
        for storage in (public, private):
            self.assertEqual(storage["BACKEND"], "storages.backends.s3.S3Storage")
            self.assertEqual(storage["OPTIONS"]["endpoint_url"], "https://acct.r2.cloudflarestorage.com")
            self.assertEqual(storage["OPTIONS"]["region_name"], "auto")
            self.assertIsNone(storage["OPTIONS"]["default_acl"])
            self.assertFalse(storage["OPTIONS"]["file_overwrite"])
        self.assertEqual(public["OPTIONS"]["bucket_name"], "upcz-public")
        self.assertEqual(public["OPTIONS"]["custom_domain"], "media.upcz.example.org")
        self.assertFalse(public["OPTIONS"]["querystring_auth"])
        self.assertEqual(private["OPTIONS"]["bucket_name"], "upcz-private")
        self.assertTrue(private["OPTIONS"]["querystring_auth"])
        self.assertNotIn("custom_domain", private["OPTIONS"])

    def test_without_object_storage_uploads_stay_on_local_disk(self):
        storages = settings_with()["STORAGES"]
        self.assertEqual(storages["default"]["BACKEND"], "django.core.files.storage.FileSystemStorage")
        self.assertEqual(storages["private"]["BACKEND"], "django.core.files.storage.FileSystemStorage")

    def test_partial_object_storage_config_is_refused(self):
        for missing in ("AWS_PRIVATE_BUCKET_NAME", "MEDIA_PUBLIC_DOMAIN", "AWS_S3_ENDPOINT_URL",
                        "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
            with self.subTest(missing=missing):
                result = run(READ_SETTINGS, **{**self.R2_ENV, missing: ""})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(missing, result.stderr)

    def test_refuses_the_same_bucket_for_public_and_private_files(self):
        # R2 makes a bucket public as a whole, so sharing one would expose private files.
        result = run(READ_SETTINGS, **{**self.R2_ENV, "AWS_PRIVATE_BUCKET_NAME": "upcz-public"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AWS_PRIVATE_BUCKET_NAME", result.stderr)

    def test_refuses_the_s3_api_host_as_the_public_domain(self):
        # That host needs signed requests, so visitors would get errors instead of images.
        bad = "acct.r2.cloudflarestorage.com"
        result = run(READ_SETTINGS, **{**self.R2_ENV, "MEDIA_PUBLIC_DOMAIN": bad})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("MEDIA_PUBLIC_DOMAIN", result.stderr)

    def test_public_domain_with_a_scheme_is_refused(self):
        result = run(READ_SETTINGS, **{**self.R2_ENV, "MEDIA_PUBLIC_DOMAIN": "https://pub-x.r2.dev"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("MEDIA_PUBLIC_DOMAIN", result.stderr)

    def test_logs_go_to_stdout(self):
        self.assertEqual(settings_with()["ROOT_LOG_HANDLERS"], ["console"])

    def test_render_hostname_is_allowed_automatically(self):
        hosts = settings_with(DJANGO_ALLOWED_HOSTS="", RENDER_EXTERNAL_HOSTNAME="upcz-api.onrender.com")
        self.assertEqual(hosts["ALLOWED_HOSTS"], ["upcz-api.onrender.com"])
        both = settings_with(RENDER_EXTERNAL_HOSTNAME="upcz-api.onrender.com")["ALLOWED_HOSTS"]
        self.assertEqual(both, ["api.example.org", "admin.example.org", "upcz-api.onrender.com"])

    def test_refuses_to_start_without_required_settings(self):
        for name, bad in [
            ("DJANGO_SECRET_KEY", ""),
            ("DJANGO_SECRET_KEY", "insecure-dev-key-change-in-production"),
            ("DJANGO_ALLOWED_HOSTS", ""),
            ("DATABASE_URL", ""),
            ("FRONTEND_URL", ""),
        ]:
            with self.subTest(name=name, value=bad):
                result = run(READ_SETTINGS, **{name: bad})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ImproperlyConfigured", result.stderr)
                self.assertIn(name, result.stderr)

    def test_deploy_check_passes(self):
        result = run(["manage.py", "check", "--deploy", "--fail-level", "WARNING"])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
