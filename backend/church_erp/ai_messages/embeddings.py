"""Reading written sermons for the daily messages (AGENT_EXECUTION_PLAN.md, Task 4.2).

Each sermon is cut into overlapping passages of about 350 words (roughly 500
tokens), and Gemini gives each passage a vector. Every row records the model
that made it: vectors from different models can't be compared, so a change of
GEMINI_EMBEDDING_MODEL puts every sermon back on the waiting list."""
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef

from . import gemini
from .models import SermonDocument, SermonEmbedding

CHUNK_WORDS = 350
OVERLAP_WORDS = 50


def chunk_words(text, size=CHUNK_WORDS, overlap=OVERLAP_WORDS):
    """Passages of `size` words, each starting `overlap` words before the last ended."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        chunks.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
        start += size - overlap
    return chunks


def _current():
    return SermonEmbedding.objects.filter(model=settings.GEMINI_EMBEDDING_MODEL)


def is_embedded(document):
    """Whether the sermon has been read with today's embedding model."""
    return _current().filter(document=document).exists()


def documents_to_embed():
    """Sermons not yet read with today's embedding model, oldest first."""
    read = _current().filter(document=OuterRef("pk"))
    return SermonDocument.objects.filter(~Exists(read)).order_by("created_at", "pk")


def embed_document(document):
    """Read one sermon, replacing any passages it had. Safe to run again (Rule 5):
    if Gemini fails, the passages it had are kept. Returns the number of passages."""
    chunks = chunk_words(document.text)
    vectors = gemini.embed(chunks, "RETRIEVAL_DOCUMENT") if chunks else []
    model = settings.GEMINI_EMBEDDING_MODEL
    with transaction.atomic():
        document.embeddings.all().delete()
        SermonEmbedding.objects.bulk_create([
            SermonEmbedding(document=document, chunk_index=index, chunk_text=chunk, embedding=vector, model=model)
            for index, (chunk, vector) in enumerate(zip(chunks, vectors))
        ])
    return len(chunks)
