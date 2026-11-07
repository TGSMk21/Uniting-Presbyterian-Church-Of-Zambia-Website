from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.auth_views import IsStaff
from church_erp.core.models import Branch

from . import page_content
from .models import PageContent


def branch_for(scope):
    """The branch for a scope, None for the national pages. Unknown branches are a 404."""
    if scope == page_content.NATIONAL:
        return None
    return get_object_or_404(Branch, slug=scope, is_active=True)


class PageContentView(APIView):
    """Public: the changed wording for the national site or one branch."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, scope):
        branch = branch_for(scope)
        rows = PageContent.objects.filter(branch=branch)
        return Response({"pages": {row.page: row.fields for row in rows}})


class PageContentPageView(APIView):
    """Staff: read one page for the edit form, or save it."""
    permission_classes = [IsStaff]

    def get_target(self, request, scope, page):
        branch = branch_for(scope)
        kind = page_content.scope_kind(scope)
        if not page_content.field_specs(kind, page):
            raise NotFound()
        if not page_content.can_edit(request.user, branch):
            raise PermissionDenied("You can't edit this page.")
        return branch, kind

    def get(self, request, scope, page):
        branch, kind = self.get_target(request, scope, page)
        fields, row = page_content.current_fields(branch, page, kind)
        return Response({
            "fields": fields,
            "updated_by": row.updated_by.get_username() if row and row.updated_by else None,
            "updated_at": row.updated_at if row else None,
        })

    def put(self, request, scope, page):
        branch, kind = self.get_target(request, scope, page)
        submitted = request.data.get("fields")
        if not isinstance(submitted, dict):
            raise ValidationError({"detail": "Send the page's fields."})
        cleaned, errors = page_content.clean_fields(kind, page, submitted)
        if errors:
            raise ValidationError({"fields": errors})
        return Response({"fields": page_content.save_page(branch, page, kind, cleaned, request.user)})
