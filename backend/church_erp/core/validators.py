from django.core.exceptions import ValidationError

# Addresses the website already uses, so a branch can't take them over.
RESERVED_BRANCH_SLUGS = {
    "admin", "api", "branches", "contact", "dashboard", "find-a-branch", "find-a-church", "national",
}


def validate_not_reserved(slug):
    if slug.lower() in RESERVED_BRANCH_SLUGS:
        raise ValidationError(f"'{slug}' is used by the website; choose another address for this branch.")
