"""Hymns from the dashboard (MOBILE_APP_PLAN.md, Phase 6): superusers add, edit and
bulk-import; every change is recorded in the change history (core.changes.record)."""
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.validators import UniqueTogetherValidator

from church_erp.accounts.auth_views import IsStaff
from church_erp.core.changes import IsSuperuser, changed, editable_names, record

from .models import Hymn
from .serializers import HymnSerializer


class StaffHymnViewSet(viewsets.ModelViewSet):
    """Church-wide hymns: superusers only. Hymns have no branch."""
    serializer_class = HymnSerializer
    permission_classes = [IsStaff, IsSuperuser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_superuser:
            raise PermissionDenied("Only superusers manage the hymn collections.")

    def get_queryset(self):
        rows = Hymn.objects.all()
        collection = self.request.query_params.get("collection", "").strip()
        if collection:
            rows = rows.filter(collection=collection)
        return rows

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            hymn = Hymn.objects.get(pk=response.data["id"])
            record(request.user, "hymns", "create", target=str(hymn), target_id=hymn.pk)
        return response

    def update(self, request, *args, **kwargs):
        hymn = self.get_object()
        before = HymnSerializer(hymn).data
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200:
            hymn.refresh_from_db()
            names = editable_names(HymnSerializer())
            changes = changed(before, response.data, names)
            record(request.user, "hymns", "update", target=str(hymn), target_id=hymn.pk, changes=changes)
        return response

    def destroy(self, request, *args, **kwargs):
        hymn = self.get_object()
        target, target_id = str(hymn), hymn.pk
        response = super().destroy(request, *args, **kwargs)
        if response.status_code == 204:
            record(request.user, "hymns", "delete", target=target, target_id=target_id)
        return response

    @action(detail=False, methods=["post"], url_path="import", url_name="import")
    def bulk_import(self, request):
        """Upsert many hymns at once, keyed by (collection, number).

        Body: {"hymns": [{collection, number, title, verses, chorus?, notes?}, ...]}.
        All-or-nothing: if any row is invalid, nothing is applied and the errors are returned.
        """
        rows = request.data.get("hymns")
        if not isinstance(rows, list) or not rows:
            return Response({"error": "Send a non-empty 'hymns' list."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = HymnSerializer(data=rows, many=True)
        # Import upserts by (collection, number), so the unique-together check must not reject existing hymns.
        serializer.child.validators = [
            v for v in serializer.child.validators
            if not isinstance(v, UniqueTogetherValidator)
        ]
        if not serializer.is_valid():
            errors = [
                {"index": i, "errors": e}
                for i, e in enumerate(serializer.errors)
                if e
            ]
            return Response({"error": "Some rows are invalid; nothing was applied.", "errors": errors},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            created = updated = 0
            for data in serializer.validated_data:
                _, was_created = Hymn.objects.update_or_create(
                    collection=data["collection"], number=data["number"],
                    defaults={"title": data["title"], "verses": data["verses"],
                              "chorus": data.get("chorus", ""), "notes": data.get("notes", "")},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        record(request.user, "hymns", "bulk_import",
               target=f"{created + updated} hymns ({created} new, {updated} updated)")
        return Response({"created": created, "updated": updated, "total": created + updated})
