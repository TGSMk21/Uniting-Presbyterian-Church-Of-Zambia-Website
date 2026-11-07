"""A stand-in for Google's Gemini API at the HTTP layer, for the tests."""
import json
import math

import httpx

DIMENSIONS = 1536
# The tests replace httpx.Client where the code under test uses it; keep the real one.
RealClient = httpx.Client


def vector_for(text, dimensions=DIMENSIONS):
    """A made-up, repeatable vector: texts sharing words point the same way."""
    values = [0.0] * dimensions
    for word in text.lower().split():
        word = word.strip(".,;:!?\"'")
        if word:
            values[sum(map(ord, word)) % dimensions] += 1.0
    if not any(values):
        values[0] = 1.0
    return [v * 3.0 for v in values]  # not unit length, like Gemini's below 3072 dimensions


class FakeGemini:
    def __init__(self, *, fail_with=None, timeout=False, dimensions=DIMENSIONS, reply=None, finish="STOP"):
        self.fail_with = fail_with
        self.timeout = timeout
        self.dimensions = dimensions
        self.reply = reply if reply is not None else {
            "title": "Held by the Shepherd",
            "reference_verse": "Psalm 23:1",
            "verse_text": "The Lord is my shepherd; I shall not want.",
            "message": "Today, remember that the Lord leads you.\n\nRest in him.",
        }
        self.finish = finish
        self.requests = []

    def handler(self, request):
        body = json.loads(request.content or b"{}")
        self.requests.append({"url": str(request.url), "headers": dict(request.headers), "json": body})
        if self.timeout:
            raise httpx.ReadTimeout("timed out", request=request)
        if self.fail_with:
            return httpx.Response(self.fail_with, json={"error": {"message": "quota exceeded"}})
        if request.url.path.endswith(":batchEmbedContents"):
            return httpx.Response(200, json={"embeddings": [
                {"values": vector_for(item["content"]["parts"][0]["text"], self.dimensions)} for item in body["requests"]
            ]})
        if request.url.path.endswith(":generateContent"):
            text = self.reply if isinstance(self.reply, str) else json.dumps(self.reply)
            return httpx.Response(200, json={"candidates": [
                {"content": {"parts": [{"text": text}], "role": "model"}, "finishReason": self.finish},
            ]})
        return httpx.Response(404)

    def client(self, **kwargs):
        return RealClient(transport=httpx.MockTransport(self.handler), **kwargs)

    def embed_calls(self):
        return [r for r in self.requests if r["url"].endswith(":batchEmbedContents")]

    def generate_calls(self):
        return [r for r in self.requests if r["url"].endswith(":generateContent")]


def length(vector):
    return math.sqrt(sum(v * v for v in vector))
