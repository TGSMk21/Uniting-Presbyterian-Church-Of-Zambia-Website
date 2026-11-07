"""Uploads go to public / private object storage (AGENT_EXECUTION_PLAN.md, Task 3.1).

Runs against moto's in-process S3 (pip install -r requirements-dev.txt), using
the same storage options production builds for Cloudflare R2.
"""
import io
import unittest
from urllib.parse import urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage, storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from church_erp.content.page_content import field_specs
from church_erp.content.page_images import remove_image, replace_image
from church_erp.core.tests.helpers import make_branch
from church_erp.media_library.models import MediaAsset
from church_erp.settings.storage import object_storages

try:
    import boto3
    from moto import mock_aws
except ImportError:  # dev requirements not installed
    mock_aws = None

PUBLIC, PRIVATE, DOMAIN = "upcz-public", "upcz-private", "media.upcz.example.org"


@unittest.skipIf(mock_aws is None, "needs moto: pip install -r requirements-dev.txt")
class ObjectStorageTests(TestCase):
    def setUp(self):
        aws = mock_aws()
        aws.start()
        self.addCleanup(aws.stop)
        self.s3 = boto3.client("s3", region_name="us-east-1")
        for bucket in (PUBLIC, PRIVATE):
            self.s3.create_bucket(Bucket=bucket)

        configured = object_storages(
            public_bucket=PUBLIC, private_bucket=PRIVATE, public_domain=DOMAIN,
            endpoint_url=None, access_key="test", secret_key="test", region_name="us-east-1",
        )
        override = override_settings(STORAGES={**settings.STORAGES, **configured})
        override.enable()
        self.addCleanup(override.disable)
        # FileField resolves a storage callable once, at import; point it at the new one.
        field = MediaAsset._meta.get_field("file")
        original = field.storage
        field.storage = storages["private"]
        self.addCleanup(setattr, field, "storage", original)

        self.branch = make_branch("alpha")

    def keys(self, bucket):
        return {o["Key"] for o in self.s3.list_objects_v2(Bucket=bucket).get("Contents", [])}

    def test_branch_images_go_to_the_public_bucket_with_plain_links(self):
        self.branch.hero_image.save("hero.png", ContentFile(b"png-bytes"))
        self.assertEqual(self.keys(PUBLIC), {"branch_hero/hero.png"})
        self.assertEqual(self.keys(PRIVATE), set())
        url = urlparse(self.branch.hero_image.url)
        self.assertEqual((url.scheme, url.netloc, url.path), ("https", DOMAIN, "/branch_hero/hero.png"))
        self.assertEqual(url.query, "")  # cached pages need links that don't expire

    def test_dashboard_images_go_to_the_public_bucket_as_webp_with_plain_links(self):
        data = io.BytesIO()
        Image.new("RGB", (40, 30), "red").save(data, "PNG")
        upload = SimpleUploadedFile("photo.png", data.getvalue(), content_type="image/png")
        spec = field_specs("branch", "home")["hero_image"]

        name = replace_image(self.branch, "home", spec, upload, None)

        self.assertEqual(self.keys(PUBLIC), {name})
        self.assertEqual(self.keys(PRIVATE), set())
        # Browsers refuse a page's image if the bucket labels it as the wrong type.
        self.assertEqual(self.s3.head_object(Bucket=PUBLIC, Key=name)["ContentType"], "image/webp")
        url = urlparse(default_storage.url(name))
        self.assertEqual((url.scheme, url.netloc, url.query), ("https", DOMAIN, ""))

        remove_image(self.branch, "home", spec, None)
        self.assertEqual(self.keys(PUBLIC), set())

    def test_media_library_files_go_to_the_private_bucket_with_expiring_links(self):
        asset = MediaAsset(branch=self.branch, file_type="document", title="Minutes")
        asset.file.save("minutes.pdf", ContentFile(b"%PDF"), save=True)
        self.assertEqual(len(self.keys(PRIVATE)), 1)
        self.assertEqual(self.keys(PUBLIC), set())
        url = urlparse(asset.file.url)
        self.assertNotEqual(url.netloc, DOMAIN)
        self.assertIn("X-Amz-Signature=", url.query)
        self.assertIn("X-Amz-Expires=3600", url.query)

    def test_uploads_never_overwrite_an_existing_file(self):
        first = make_branch("beta")
        self.branch.hero_image.save("hero.png", ContentFile(b"alpha"))
        first.hero_image.save("hero.png", ContentFile(b"beta"))
        self.assertEqual(len(self.keys(PUBLIC)), 2)
        self.assertNotEqual(self.branch.hero_image.name, first.hero_image.name)


class MediaAssetStorageChoiceTests(TestCase):
    def test_media_library_files_use_the_private_storage(self):
        # No overrides here: this is the storage the model itself picks.
        storage = MediaAsset._meta.get_field("file").storage
        self.assertEqual(storage.base_url, f"/{settings.PRIVATE_MEDIA_URL}")
        self.assertEqual(str(storage.location), str(settings.PRIVATE_MEDIA_ROOT))
