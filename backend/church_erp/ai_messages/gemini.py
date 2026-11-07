"""Google's Gemini API, for the daily message drafts (AGENT_EXECUTION_PLAN.md, Phase 4).

Two calls: embeddings (numbers that place a passage by its meaning) and
writing a draft as JSON. Every failure becomes AIUnavailable, so callers can
log it and carry on (Rule 6). The key goes in a header, never in the address,
so it can't end up in logs."""
import json
import logging
import math

import httpx
from django.conf import settings

from .models import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)

API = "https://generativelanguage.googleapis.com/v1beta"
TIMEOUT_SECONDS = 30
BATCH = 100  # the most passages Gemini takes in one embedding request


class AIUnavailable(Exception):
    """Gemini couldn't be reached, refused, or answered something unusable."""


def _post(path, body):
    key = settings.GEMINI_API_KEY
    if not key:
        raise AIUnavailable("GEMINI_API_KEY is not set")
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.post(f"{API}/{path}", json=body, headers={"x-goog-api-key": key})
    except httpx.HTTPError as exc:
        raise AIUnavailable(f"Gemini couldn't be reached: {type(exc).__name__}") from None
    if response.status_code != 200:
        try:
            reason = response.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            reason = ""
        raise AIUnavailable(f"Gemini answered {response.status_code}: {reason}"[:300])
    try:
        return response.json()
    except ValueError:
        raise AIUnavailable("Gemini's answer wasn't JSON") from None


def _unit(values):
    if len(values) != EMBEDDING_DIMENSIONS:
        raise AIUnavailable(f"Expected {EMBEDDING_DIMENSIONS} numbers, got {len(values)}")
    size = math.sqrt(sum(v * v for v in values))
    if not size:
        raise AIUnavailable("Gemini sent an empty vector")
    return [v / size for v in values]


def embed(texts, task_type):
    """One unit-length vector per text. `task_type` is RETRIEVAL_DOCUMENT for
    sermon passages and RETRIEVAL_QUERY for what's searched for."""
    model = settings.GEMINI_EMBEDDING_MODEL
    vectors = []
    for start in range(0, len(texts), BATCH):
        batch = texts[start:start + BATCH]
        data = _post(f"models/{model}:batchEmbedContents", {"requests": [
            {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            }
            for text in batch
        ]})
        try:
            found = [item["values"] for item in data["embeddings"]]
        except (KeyError, TypeError):
            raise AIUnavailable("Gemini's embeddings answer was missing its numbers") from None
        if len(found) != len(batch):
            raise AIUnavailable("Gemini sent back a different number of embeddings")
        vectors.extend(_unit(values) for values in found)
    return vectors


def generate_json(system, prompt, schema, *, temperature=0.7):
    """Gemini's answer to `prompt`, as a dict shaped by `schema`."""
    data = _post(f"models/{settings.GEMINI_MODEL}:generateContent", {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": temperature,
        },
    })
    try:
        candidate = data["candidates"][0]
        if candidate.get("finishReason") not in (None, "STOP"):
            raise AIUnavailable(f"Gemini stopped early: {candidate.get('finishReason')}")
        text = "".join(part.get("text", "") for part in candidate["content"]["parts"])
    except (KeyError, IndexError, TypeError):
        raise AIUnavailable("Gemini's answer had no text") from None
    try:
        answer = json.loads(text)
    except ValueError:
        raise AIUnavailable("Gemini's draft wasn't valid JSON") from None
    if not isinstance(answer, dict):
        raise AIUnavailable("Gemini's draft wasn't a JSON object")
    return answer
