"""Object storage (Cloudflare R2, or any S3-compatible service) for uploads.

Two buckets, because R2 makes a bucket public as a whole:
- "default" (public): branch logos/hero images and minister photos, served
  from the bucket's public domain with plain links. Pages are cached for an
  hour, so expiring links would break there.
- "private": media-library files, served through signed links that expire
  after an hour.
"""

PRIVATE_LINK_SECONDS = 3600


def object_storages(*, public_bucket, private_bucket, public_domain, endpoint_url,
                    access_key, secret_key, region_name="auto"):
    common = {
        "endpoint_url": endpoint_url,
        "access_key": access_key,
        "secret_key": secret_key,
        "region_name": region_name,  # R2 uses "auto"
        "signature_version": "s3v4",
        "default_acl": None,  # R2 has no object ACLs; access is per bucket
        "file_overwrite": False,  # same-named uploads get a unique suffix
    }
    return {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                **common,
                "bucket_name": public_bucket,
                "custom_domain": public_domain,
                "querystring_auth": False,
            },
        },
        "private": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                **common,
                "bucket_name": private_bucket,
                "querystring_auth": True,
                "querystring_expire": PRIVATE_LINK_SECONDS,
            },
        },
    }
