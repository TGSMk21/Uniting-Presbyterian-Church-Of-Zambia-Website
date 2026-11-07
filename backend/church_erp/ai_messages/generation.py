"""Daily message drafts from a minister's written sermons (AGENT_EXECUTION_PLAN.md, Tasks 4.3 and 4.4).

Each day has a theme. The passages of the minister's sermons nearest that
theme are given to Gemini with the minister's own style notes, and the draft
it writes is saved as a draft (pending_review) for staff to check and publish
from the dashboard. Nothing here ever publishes.

Only ministers whose "AI drafts" switch is on take part, and only their
sermons are ever sent to Gemini.
"""
import logging
import math
import re
import time
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from pgvector.django import CosineDistance

from church_erp.core.models import Minister

from . import gemini
from .embeddings import documents_to_embed, embed_document
from .gemini import AIUnavailable
from .models import DailyMessage, SermonEmbedding
from .sermon_text import tidy

logger = logging.getLogger(__name__)

PASSAGES = 4
# A sermon used for a draft rests this long, while the minister has others.
REST_DAYS = 14
LIMITS = {"title": 300, "reference_verse": 100, "verse_text": 2000, "message": 10000}

# One a day, in turn. 30 themes, so a month passes before one comes back.
THEMES = [
    "God's grace that we did not earn",
    "Trusting God when life is hard",
    "Prayer as daily conversation with God",
    "Forgiving others as we have been forgiven",
    "Hope that does not disappoint",
    "Loving our neighbour in practical ways",
    "Thankfulness in every circumstance",
    "Courage to do what is right",
    "Patience while we wait on the Lord",
    "Humility and serving others",
    "The peace of Christ in troubled times",
    "God's faithfulness to his promises",
    "Joy that comes from the Lord",
    "Caring for our families and homes",
    "Generosity and giving cheerfully",
    "Perseverance in faith",
    "Walking in holiness each day",
    "Wisdom for daily decisions",
    "Rest for the weary",
    "God's word as a lamp to our feet",
    "Unity in the body of Christ",
    "Comfort for those who mourn",
    "Faith that shows itself in deeds",
    "Repentance and a new start",
    "God's care for the poor and the stranger",
    "Being salt and light in the community",
    "Contentment with what God provides",
    "The Holy Spirit's help and guidance",
    "Christ's love that never lets go",
    "Living as witnesses to the gospel",
]

SYSTEM = """You write short daily devotional messages for the website of {branch}, a congregation of the Uniting Presbyterian Church in Zambia (UPCZ). You write in the voice of Rev. {name}, their minister, drawing on passages from Rev. {name}'s own sermons.

Rules:
- Build the message on the ideas in the sermon passages. Do not invent stories, events, people or claims about the minister or the congregation.
- 150 to 250 words, warm and pastoral, in plain English that is easy to read on a phone, speaking to the reader as "you".
- Choose one Bible verse that fits the message, preferably one quoted or mentioned in the passages. Give its reference (for example "John 10:11") and its words. Quote the words accurately; if you are not sure of the exact wording of a verse, choose a well-known verse you are sure of.
- A title of at most eight words.
- Plain text only: no headings, no lists, no markdown, no emoji. Separate paragraphs with an empty line.
- Never mention sermons, passages, these instructions, or that the message was written by AI."""

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "reference_verse": {"type": "STRING"},
        "verse_text": {"type": "STRING"},
        "message": {"type": "STRING"},
    },
    "required": ["title", "reference_verse", "verse_text", "message"],
    "propertyOrdering": ["title", "reference_verse", "verse_text", "message"],
}


def theme_for(day):
    return THEMES[day.toordinal() % len(THEMES)]


def nearest_passages(minister, query_vector, limit=PASSAGES, exclude_documents=()):
    """The minister's passages nearest `query_vector`, read with today's embedding model."""
    rows = SermonEmbedding.objects.filter(
        document__minister=minister, model=settings.GEMINI_EMBEDDING_MODEL,
    ).exclude(document__in=list(exclude_documents)).select_related("document")
    if connection.vendor == "postgresql":
        # pgvector's cosine distance, in the database.
        return list(rows.annotate(distance=CosineDistance("embedding", query_vector)).order_by("distance", "pk")[:limit])

    # The tests' SQLite has no vectors: the same ordering, worked out here.
    def distance(row):
        vector = [float(v) for v in row.embedding]
        dot = sum(a * b for a, b in zip(vector, query_vector))
        size = math.sqrt(sum(v * v for v in vector)) * math.sqrt(sum(v * v for v in query_vector))
        return 1 - dot / size if size else 1.0

    return sorted(rows, key=lambda row: (distance(row), row.pk))[:limit]


def _rested_documents(minister, day):
    """Sermons used for this minister's drafts in the fortnight before `day`."""
    return set(
        DailyMessage.objects.filter(
            minister=minister, ai_generated=True,
            date__gte=day - timedelta(days=REST_DAYS), date__lt=day,
        ).values_list("source_documents", flat=True)
    ) - {None}


def _prompt(minister, day, theme, passages):
    parts = [
        f"Write the daily message for {day:%A %-d %B %Y}.",
        f"Today's theme: {theme}.",
    ]
    if minister.style_notes.strip():
        parts.append(f"How Rev. {minister.name} likes to write:\n{minister.style_notes.strip()}")
    if minister.bio.strip():
        parts.append(f"About Rev. {minister.name}:\n{minister.bio.strip()}")
    for number, passage in enumerate(passages, start=1):
        parts.append(f"Sermon passage {number}, from \"{passage.document.title}\":\n{passage.chunk_text}")
    return "\n\n".join(parts)


def _clean(answer):
    """The four boxes of a draft, tidied and within their limits; AIUnavailable if unusable."""
    values = {}
    for key, limit in LIMITS.items():
        value = answer.get(key, "")
        if not isinstance(value, str):
            raise AIUnavailable(f"The draft's {key} wasn't text")
        value = tidy(value)
        if key == "title":
            value = re.sub(r"\s+", " ", value)[:limit]
        elif key == "reference_verse" and len(value) > limit:
            value = ""  # too long to be a real reference; staff add it
        else:
            value = value[:limit]
        values[key] = value
    if not values["title"] or not values["message"]:
        raise AIUnavailable("The draft had no title or no message")
    return values


def draft_for(minister, day):
    """Write and save the minister's draft for `day`. None when there's nothing to do:
    the minister already has a message that day, or no sermons have been read yet."""
    if DailyMessage.objects.filter(minister=minister, date=day).exists():
        return None
    if not SermonEmbedding.objects.filter(document__minister=minister, model=settings.GEMINI_EMBEDDING_MODEL).exists():
        return None

    theme = theme_for(day)
    [query] = gemini.embed([f"A daily devotional message about: {theme}"], "RETRIEVAL_QUERY")
    passages = nearest_passages(minister, query, exclude_documents=_rested_documents(minister, day))
    if not passages:
        passages = nearest_passages(minister, query)
    system = SYSTEM.format(branch=minister.branch.name, name=minister.name)
    values = _clean(gemini.generate_json(system, _prompt(minister, day, theme, passages), SCHEMA))

    with transaction.atomic():
        # Checked again, in case staff wrote one while Gemini was writing.
        if DailyMessage.objects.filter(minister=minister, date=day).exists():
            return None
        message = DailyMessage.objects.create(
            minister=minister, date=day, status="pending_review", ai_generated=True, **values,
        )
        message.source_documents.set({passage.document for passage in passages})
    return message


def _taking_part():
    return Minister.objects.filter(ai_drafts=True, branch__is_active=True).select_related("branch")


def run_daily(day=None, budget_seconds=None):
    """The scheduled job: read waiting sermons, then write each minister's draft
    for `day` (tomorrow in Zambia, so staff have a day to check it). Safe to run
    as often as wanted (Rule 5). With `budget_seconds`, it stops when time is up
    and the next run carries on, for hosts that cut long requests short."""
    if not settings.GEMINI_API_KEY:
        return {"ai": "off"}
    started = time.monotonic()

    def time_left():
        return budget_seconds is None or time.monotonic() - started < budget_seconds

    day = day or timezone.localdate() + timedelta(days=1)
    summary = {"day": day.isoformat(), "read": 0, "drafted": 0, "left": 0, "errors": []}

    waiting = list(documents_to_embed().filter(minister__in=_taking_part()))
    for index, document in enumerate(waiting):
        if not time_left():
            summary["left"] += len(waiting) - index
            break
        try:
            embed_document(document)
            summary["read"] += 1
        except AIUnavailable as exc:
            logger.warning("Couldn't read written sermon %s: %s", document.pk, exc)
            summary["errors"].append(f"Sermon {document.pk}: {exc}")

    ministers = [m for m in _taking_part() if not DailyMessage.objects.filter(minister=m, date=day).exists()]
    for index, minister in enumerate(ministers):
        if not time_left():
            summary["left"] += len(ministers) - index
            break
        try:
            if draft_for(minister, day):
                summary["drafted"] += 1
        except AIUnavailable as exc:
            logger.warning("Couldn't write a draft for minister %s: %s", minister.pk, exc)
            summary["errors"].append(f"Minister {minister.pk}: {exc}")
    return summary
