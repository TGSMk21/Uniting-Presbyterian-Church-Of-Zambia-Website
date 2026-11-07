from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.auth_views import IsStaff
from church_erp.core.models import Branch

from . import page_content, page_images
from .models import PageContent


def branch_for(scope):
    """The branch for a scope, None for the national pages. Unknown branches are a 404."""
    if scope == page_content.NATIONAL:
        return None
    return get_object_or_404(Branch, slug=scope, is_active=True)


def editable_page(request, scope, page):
    """(branch, kind) for a page this person may edit, or the right refusal."""
    branch = branch_for(scope)
    kind = page_content.scope_kind(scope)
    if not page_content.field_specs(kind, page):
        raise NotFound()
    if not page_content.can_edit(request.user, branch):
        raise PermissionDenied("You can't edit this page.")
    return branch, kind


class PageContentView(APIView):
    """Public: the changed wording and images for the national site or one branch."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, scope):
        branch = branch_for(scope)
        kind = page_content.scope_kind(scope)
        rows = PageContent.objects.filter(branch=branch)
        return Response({"pages": {
            row.page: page_content.with_image_links(row.fields, kind, row.page, request.build_absolute_uri)
            for row in rows
        }})


class PageContentPageView(APIView):
    """Staff: read one page for the edit form, or save its wording."""
    permission_classes = [IsStaff]

    def get(self, request, scope, page):
        branch, kind = editable_page(request, scope, page)
        fields, row = page_content.current_fields(branch, page, kind)
        return Response({
            "fields": page_content.with_image_links(fields, kind, page, request.build_absolute_uri),
            "updated_by": row.updated_by.get_username() if row and row.updated_by else None,
            "updated_at": row.updated_at if row else None,
        })

    def put(self, request, scope, page):
        branch, kind = editable_page(request, scope, page)
        submitted = request.data.get("fields")
        if not isinstance(submitted, dict):
            raise ValidationError({"detail": "Send the page's fields."})
        cleaned, errors = page_content.clean_fields(kind, page, submitted)
        if errors:
            raise ValidationError({"fields": errors})
        saved = page_content.save_page(branch, page, kind, cleaned, request.user)
        return Response({"fields": page_content.with_image_links(saved, kind, page, request.build_absolute_uri)})


class PageImageView(APIView):
    """Staff: upload one of a page's images, or go back to the original."""
    permission_classes = [IsStaff]
    parser_classes = [MultiPartParser]

    def get_target(self, request, scope, page, key):
        branch, kind = editable_page(request, scope, page)
        spec = page_content.field_specs(kind, page).get(key)
        if not spec or not page_content.is_image(spec):
            raise NotFound()
        return branch, spec

    def post(self, request, scope, page, key):
        branch, spec = self.get_target(request, scope, page, key)
        uploaded = request.FILES.get("image")
        if not uploaded:
            raise ValidationError({"image": ["Please choose a photo."]})
        try:
            name = page_images.replace_image(branch, page, spec, uploaded, request.user)
        except DjangoValidationError as exc:
            raise ValidationError({"image": exc.messages})
        return Response({"url": page_content.image_link(name, request.build_absolute_uri)})

    def delete(self, request, scope, page, key):
        branch, spec = self.get_target(request, scope, page, key)
        page_images.remove_image(branch, page, spec, request.user)
        return Response({"url": spec["default"]})
