"""Reading written sermons for the daily messages (AGENT_EXECUTION_PLAN.md, Task 4.2)."""
from django.conf import settings


def is_embedded(document):
    """Whether the sermon has been read with today's embedding model."""
    return document.embeddings.filter(model=settings.GEMINI_EMBEDDING_MODEL).exists()
