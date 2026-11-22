"""CORS for the Android app (review finding F01; task T01).

The app's WebView origin (https://localhost, capacitor://localhost) may only make
public reads of /api/app/ and /api/branches/. Staff addresses stay limited to the
website's origin in CORS_ALLOWED_ORIGINS."""
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.core.tests.helpers import make_branch

APP_ORIGIN = "https://localhost"
CAPACITOR_ORIGIN = "capacitor://localhost"


class AppCorsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("chilanga")

    def get(self, path, origin):
        return self.client.get(path, HTTP_ORIGIN=origin)

    def test_app_origin_allowed_on_app_home(self):
        response = self.get(f"{reverse('app-home')}?branch={self.branch.slug}", APP_ORIGIN)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), APP_ORIGIN)

    def test_app_origin_allowed_on_branches(self):
        response = self.get("/api/branches/", APP_ORIGIN)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), APP_ORIGIN)

    def test_capacitor_scheme_allowed(self):
        response = self.get("/api/app/hymns/collections/", CAPACITOR_ORIGIN)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), CAPACITOR_ORIGIN)

    def test_app_origin_refused_on_staff_paths(self):
        response = self.get("/api/staff-overview/", APP_ORIGIN)
        self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))

    def test_app_origin_refused_for_writes(self):
        response = self.client.post(
            f"{reverse('app-home')}?branch={self.branch.slug}", {}, format="json", HTTP_ORIGIN=APP_ORIGIN
        )
        self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))

    def test_unknown_origin_refused(self):
        response = self.get(f"{reverse('app-home')}?branch={self.branch.slug}", "https://evil.example")
        self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))

    def test_website_origin_unchanged(self):
        website_origin = settings.CORS_ALLOWED_ORIGINS[0]
        response = self.get("/api/branches/", website_origin)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), website_origin)
