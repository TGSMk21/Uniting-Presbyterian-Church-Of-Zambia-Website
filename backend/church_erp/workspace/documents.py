"""The document hub (AGENT_EXECUTION_PLAN.md, Task 8.5).

`readable_documents` is the one access rule, used by every address: the owner, or
anyone in one of the document's shares. The superuser has no special reading right
(pastoral confidentiality); they read what is shared with them like anyone else.
Only the owner renames, adds versions, restores, shares and deletes. Files are only
ever sent through the API after the rule is checked, never as public links."""
import logging
import mimetypes
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from church_erp.core.models import Branch, Presbytery
from church_erp.media_library.uploads import MAX_BYTES, checked_upload

from . import scopes
from .meetings import visible_meetings, when
from .models import BRANCH, PRESBYTERY, SYNOD, Document, DocumentShare, DocumentVersion, DocumentView, Meeting
from .notify import notify
from .structure_views import IsWorkspaceMember, members, person_name
from .word_preview import Unreadable, preview_blocks

logger = logging.getLogger(__name__)

MAX_TEXT = 100_000
CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image": "image/webp",
    "txt": "text/plain; charset=utf-8",
}
NOT_ALLOWED = ("This kind of file can't be shared here. Please choose a PDF, a Word, Excel or PowerPoint file, "
               "a text file or a picture.")
OLD_OFFICE = "This is an older Office file. Open it and save it again (File, Save As) as a .docx, .xlsx or .pptx."
OLE = bytes.fromhex("D0CF11E0A1B11AE1")


# --- The access rule --------------------------------------------------------------------

def readable_documents(user):
    if not scopes.is_member(user):
        return Document.objects.none()
    rule = Q(owner=user) | Q(shares__kind=DocumentShare.PERSON, shares__person=user) | Q(shares__kind=SYNOD)
    rule |= Q(shares__kind=DocumentShare.MEETING) & (Q(shares__meeting__attendees__person=user)
                                                     | Q(shares__meeting__organiser=user))
    if not user.is_superuser:
        # Those who organise meetings at a place read what's shared with its meetings.
        places = scopes.organising_places(user)
        rule |= Q(shares__kind=DocumentShare.MEETING) & (
            Q(shares__meeting__level=BRANCH, shares__meeting__branch__in=places["branches"])
            | Q(shares__meeting__level=PRESBYTERY, shares__meeting__presbytery__in=places["presbyteries"])
            | (Q(shares__meeting__level=SYNOD) if places["synod"] else Q(pk__in=[])))
        if user.branch_id:
            rule |= Q(shares__kind=BRANCH, shares__branch_id=user.branch_id)
        presbytery = scopes.presbytery_of(user)
        if presbytery is not None:
            rule |= Q(shares__kind=PRESBYTERY, shares__presbytery=presbytery)
    return Document.objects.filter(pk__in=Document.objects.filter(rule).values("pk"))


def can_share_with_synod(user):
    return user.is_superuser or scopes.current_appointments(user).filter(position__level=SYNOD).exists()


# --- Files ---------------------------------------------------------------------------

def checked_document(uploaded):
    """(content, file_type, extension) for a file that may be shared, or a ValidationError."""
    uploaded.seek(0)
    head = uploaded.read(8)
    uploaded.seek(0)
    if head.startswith(OLE):
        raise DjangoValidationError(OLD_OFFICE)
    try:
        content, kind, extension = checked_upload(uploaded)
    except DjangoValidationError as problem:
        if uploaded.size == 0 or uploaded.size > MAX_BYTES:
            raise
        text = plain_text(uploaded)
        if text is None:
            raise DjangoValidationError(NOT_ALLOWED) from problem
        return uploaded, "txt", "txt"
    if kind == "image":
        return content, "image", "webp"
    if kind != "document":
        raise DjangoValidationError(NOT_ALLOWED)
    return content, extension, extension


def plain_text(uploaded):
    uploaded.seek(0)
    data = uploaded.read()
    uploaded.seek(0)
    if b"\x00" in data:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def clean_filename(name, extension):
    base = "".join(ch for ch in str(name).rsplit("/", 1)[-1].rsplit("\\", 1)[-1] if ch.isprintable() and ch not in '"\\')
    base = base.rsplit(".", 1)[0].strip()[:150] or "document"
    return f"{base}.{extension}"


def new_version(document, author, *, upload=None, text=None, note=""):
    number = (document.versions.order_by("-number").values_list("number", flat=True).first() or 0) + 1
    if document.kind == Document.WRITTEN:
        version = DocumentVersion.objects.create(document=document, number=number, file_type="written",
                                                 text=text, note=note, author=author)
    else:
        content, file_type, extension = upload
        version = DocumentVersion(document=document, number=number, file_type=file_type, note=note, author=author,
                                  filename=clean_filename(content.name, extension), size=content.size)
        version.file.save(f"v{number}.{extension}", content, save=False)
        version.save()
    Document.objects.filter(pk=document.pk).update(updated_at=timezone.now())
    return version


# --- Labels and answers --------------------------------------------------------------

def share_label(share):
    if share.kind == DocumentShare.PERSON:
        return person_name(share.person)
    if share.kind == DocumentShare.MEETING:
        return f"People at {share.meeting.title}, {when(share.meeting)}"
    if share.kind == BRANCH:
        return f"Everyone at {share.branch.name}"
    if share.kind == PRESBYTERY:
        return f"Everyone in {share.presbytery.name} Presbytery"
    return "The whole synod"


def shares_of(document):
    return list(document.shares.select_related("person", "meeting", "branch", "presbytery"))


def version_row(version):
    return {"number": version.number, "file_type": version.file_type, "filename": version.filename,
            "size": version.size, "note": version.note, "created_at": version.created_at,
            "author": person_name(version.author) if version.author else ""}


def seen_by(user, document, current):
    if document.owner_id == user.pk or current is None:
        return True
    return DocumentView.objects.filter(version=current, person=user).exists()


def list_row(document, user):
    current = document.current
    return {
        "id": document.pk, "title": document.title, "kind": document.kind, "owner": person_name(document.owner),
        "updated_at": document.updated_at, "version": current.number if current else 0,
        "file_type": current.file_type if current else "", "is_mine": document.owner_id == user.pk,
        "seen": seen_by(user, document, current), "shared_with": [share_label(s) for s in shares_of(document)],
    }


def detail_row(document, user):
    current = document.current
    row = {**list_row(document, user), "description": document.description,
           "versions": [version_row(v) for v in document.versions.select_related("author")],
           "text": current.text if current and document.kind == Document.WRITTEN else ""}
    if document.owner_id == user.pk:
        shares = shares_of(document)
        row["shares"] = [{"id": s.pk, "kind": s.kind, "label": share_label(s)} for s in shares]
        latest = {}
        for view in document.views.select_related("person", "version").order_by("viewed_at"):
            latest[view.person_id] = {"name": person_name(view.person), "version": view.version.number,
                                      "viewed_at": view.viewed_at}
        row["viewers"] = sorted(latest.values(), key=lambda v: v["name"])
    return row


def brief(document):
    return {"id": document.pk, "title": document.title}


def meeting_documents(meeting, user):
    rows = readable_documents(user).filter(shares__kind=DocumentShare.MEETING, shares__meeting=meeting).distinct()
    return [{**brief(d), "owner": person_name(d.owner), "file_type": d.current.file_type if d.current else ""}
            for d in rows.select_related("owner")]


def unread_count(user):
    """Documents shared with me in the last 60 days that I haven't opened."""
    since = timezone.now() - timedelta(days=60)
    rows = readable_documents(user).exclude(owner=user).filter(updated_at__gte=since)
    seen = DocumentView.objects.filter(person=user).values("document_id")
    return rows.exclude(pk__in=seen).count()


# --- The API ---------------------------------------------------------------------------

class DocumentCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    file = serializers.FileField(required=False)
    text = serializers.CharField(max_length=MAX_TEXT, required=False, allow_blank=False, trim_whitespace=False)

    def validate_file(self, uploaded):
        try:
            return checked_document(uploaded)
        except DjangoValidationError as problem:
            raise serializers.ValidationError(problem.messages)

    def validate(self, attrs):
        if ("file" in attrs) == ("text" in attrs):
            raise serializers.ValidationError({"file": ["Upload a file, or write the document here."]})
        return attrs


class VersionSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    text = serializers.CharField(max_length=MAX_TEXT, required=False, allow_blank=False, trim_whitespace=False)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def validate_file(self, uploaded):
        return DocumentCreateSerializer.validate_file(self, uploaded)

    def validate(self, attrs):
        kind = self.context["document"].kind
        if kind == Document.WRITTEN and "text" not in attrs:
            raise serializers.ValidationError({"text": ["This document is written here: change its words instead."]})
        if kind == Document.UPLOADED and "file" not in attrs:
            raise serializers.ValidationError({"file": ["Choose the new file to upload."]})
        return attrs


class ShareTargetSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[k for k, _ in DocumentShare.KINDS])
    person = serializers.IntegerField(required=False)
    meeting = serializers.IntegerField(required=False)
    branch = serializers.SlugField(required=False)
    presbytery = serializers.SlugField(required=False)

    def validate(self, attrs):
        user, kind = self.context["request"].user, attrs["kind"]
        if kind == DocumentShare.PERSON:
            person = members().filter(pk=attrs.get("person")).first()
            if person is None:
                raise serializers.ValidationError("Choose someone who uses the shared workspace.")
            return {"kind": kind, "person": person}
        if kind == DocumentShare.MEETING:
            meeting = visible_meetings(user).filter(pk=attrs.get("meeting")).first()
            if meeting is None:
                raise serializers.ValidationError("Choose one of your meetings.")
            return {"kind": kind, "meeting": meeting}
        if kind == BRANCH:
            branch = Branch.objects.filter(slug=attrs.get("branch", ""), is_active=True).first()
            if branch is None or not (user.is_superuser or user.branch_id == branch.pk):
                raise serializers.ValidationError("You can share with your own branch.")
            return {"kind": kind, "branch": branch}
        if kind == PRESBYTERY:
            presbytery = Presbytery.objects.filter(slug=attrs.get("presbytery", "")).first()
            if presbytery is None or not (user.is_superuser or scopes.presbytery_of(user) == presbytery):
                raise serializers.ValidationError("You can share with your own presbytery.")
            return {"kind": kind, "presbytery": presbytery}
        if not can_share_with_synod(user):
            raise serializers.ValidationError("Only synod office bearers share with the whole synod.")
        return {"kind": kind}


def audience(share):
    """Who to tell when a document is shared with them: people and meetings, not whole groups."""
    if share.kind == DocumentShare.PERSON:
        return [share.person]
    if share.kind == DocumentShare.MEETING:
        return [row.person for row in share.meeting.attendees.select_related("person")]
    return []


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsWorkspaceMember]
    parser_classes = [JSONParser, MultiPartParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return readable_documents(self.request.user).select_related("owner")

    def owned(self):
        document = self.get_object()
        if document.owner_id != self.request.user.pk:
            raise PermissionDenied("Only the person who added this document can change it.")
        return document

    def list(self, request, *args, **kwargs):
        rows, params = self.get_queryset(), request.query_params
        if params.get("view") == "mine":
            rows = rows.filter(owner=request.user)
        elif params.get("view") == "shared":
            rows = rows.exclude(owner=request.user)
        q = str(params.get("q", "")).strip()[:80]
        if q:
            rows = rows.filter(Q(title__icontains=q) | Q(description__icontains=q))
        page = self.paginate_queryset(rows.order_by("-updated_at", "-pk"))
        return self.get_paginated_response([list_row(d, request.user) for d in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(detail_row(self.get_object(), request.user))

    def create(self, request, *args, **kwargs):
        serializer = DocumentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            document = Document.objects.create(
                title=values["title"].strip(), description=values.get("description", "").strip(), owner=request.user,
                kind=Document.UPLOADED if "file" in values else Document.WRITTEN)
            new_version(document, request.user, upload=values.get("file"), text=values.get("text"))
        return Response(detail_row(document, request.user), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        document = self.owned()
        title = request.data.get("title", document.title)
        description = request.data.get("description", document.description)
        field = serializers.CharField(max_length=200)
        document.title = field.run_validation(title).strip()
        document.description = serializers.CharField(max_length=1000, allow_blank=True).run_validation(description)
        document.save(update_fields=["title", "description", "updated_at"])
        return Response(detail_row(document, request.user))

    def destroy(self, request, *args, **kwargs):
        document = self.owned()
        files = [v.file.name for v in document.versions.all() if v.file]
        document.delete()
        storage = DocumentVersion._meta.get_field("file").storage
        for name in files:
            try:
                storage.delete(name)
            except Exception:  # a file left behind costs little
                logger.exception("Couldn't delete the document file %s", name)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def versions(self, request, *args, **kwargs):
        document = self.owned()
        serializer = VersionSerializer(data=request.data, context={"document": document})
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            new_version(document, request.user, upload=values.get("file"), text=values.get("text"),
                        note=values.get("note", "").strip())
        return Response(detail_row(document, request.user))

    @action(detail=True, methods=["post"])
    def restore(self, request, *args, **kwargs):
        document = self.owned()
        number = str(request.data.get("version", ""))
        old = document.versions.filter(number=int(number)).first() if number.isdigit() and len(number) < 9 else None
        if old is None:
            raise serializers.ValidationError({"version": ["Choose a version to bring back."]})
        with transaction.atomic():
            if document.kind == Document.WRITTEN:
                new_version(document, request.user, text=old.text, note=f"Restored version {old.number}")
            else:
                with old.file.open("rb") as handle:
                    content = ContentFile(handle.read(), name=old.filename)
                extension = old.filename.rsplit(".", 1)[-1] if "." in old.filename else old.file_type
                new_version(document, request.user, upload=(content, old.file_type, extension),
                            note=f"Restored version {old.number}")
        return Response(detail_row(document, request.user))

    @action(detail=True, methods=["post"])
    def shares(self, request, *args, **kwargs):
        document = self.owned()
        add = request.data.get("add") or []
        remove = request.data.get("remove") or []
        if not isinstance(add, list) or not isinstance(remove, list):
            raise serializers.ValidationError({"add": ["Choose who to share with."]})
        targets = ShareTargetSerializer(data=add[:20], many=True, context={"request": request})
        targets.is_valid(raise_exception=True)
        told = []
        with transaction.atomic():
            document.shares.filter(pk__in=[int(i) for i in remove if str(i).isdigit()]).delete()
            for target in targets.validated_data:
                share, made = DocumentShare.objects.get_or_create(document=document, **target,
                                                                  defaults={"shared_by": request.user})
                if made:
                    told += audience(share)
        notify(told, "document_shared", f"{person_name(request.user)} shared {document.title} with you",
               f"/dashboard/documents/{document.pk}", actor=request.user)
        return Response(detail_row(document, request.user))

    def chosen_version(self, document):
        number = str(self.request.query_params.get("version", ""))
        rows = document.versions.order_by("-number")
        version = rows.filter(number=int(number)).first() if number.isdigit() and len(number) < 9 else rows.first()
        if version is None:
            raise Http404
        if document.owner_id != self.request.user.pk:
            DocumentView.objects.get_or_create(document=document, version=version, person=self.request.user)
        return version

    @action(detail=True, methods=["get"])
    def file(self, request, *args, **kwargs):
        document = self.get_object()
        version = self.chosen_version(document)
        if not version.file:
            raise Http404
        response = FileResponse(version.file.open("rb"), content_type=CONTENT_TYPES.get(version.file_type,
                                                                                         "application/octet-stream"))
        inline = version.file_type in ("pdf", "image", "txt")
        filename = version.filename or f"document.{mimetypes.guess_extension(response['Content-Type']) or 'bin'}"
        response["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{filename}"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=True, methods=["get"])
    def preview(self, request, *args, **kwargs):
        document = self.get_object()
        version = self.chosen_version(document)
        if version.file_type == "written":
            return Response({"number": version.number, "text": version.text})
        if version.file_type != "docx":
            return Response({"number": version.number, "blocks": None})
        try:
            with version.file.open("rb") as handle:
                blocks = preview_blocks(handle.read())
        except Unreadable:
            blocks = None
        return Response({"number": version.number, "blocks": blocks})

    @action(detail=False, methods=["get"], url_path="share-options")
    def share_options(self, request, *args, **kwargs):
        """The groups this person may share with, and their recent and coming meetings."""
        user = request.user
        presbytery = scopes.presbytery_of(user)
        since = timezone.now() - timedelta(days=60)
        meetings = (visible_meetings(user).filter(starts_at__gte=since).exclude(status=Meeting.CANCELLED)
                    .filter(Q(attendees__person=user) | Q(organiser=user)).distinct().order_by("starts_at")[:30])
        return Response({
            "branch": {"slug": user.branch.slug, "name": user.branch.name} if user.branch and not user.is_superuser else None,
            "presbytery": {"slug": presbytery.slug, "name": presbytery.name} if presbytery else None,
            "synod": can_share_with_synod(user),
            "meetings": [{"id": m.pk, "title": m.title, "when": when(m)} for m in meetings],
        })


def attach_to_deliverable(row, document_id, user):
    """Handing in a deliverable with a document shares it with the meeting's people."""
    document = Document.objects.filter(pk=document_id, owner=user).first() if str(document_id).isdigit() else None
    if document is None:
        raise serializers.ValidationError({"document": ["Choose one of your own documents."]})
    DocumentShare.objects.get_or_create(document=document, kind=DocumentShare.MEETING, meeting=row.meeting,
                                        defaults={"shared_by": user})
    return document

