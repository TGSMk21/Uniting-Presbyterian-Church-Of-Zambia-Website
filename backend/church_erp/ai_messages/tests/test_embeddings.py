"""Reading written sermons for the daily messages (AGENT_EXECUTION_PLAN.md, Task 4.2).

Each sermon is cut into overlapping passages, and each passage gets a vector
from Gemini's embedding model, so the passages nearest a day's theme can be
found later. Gemini is faked at the HTTP layer."""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings

from church_erp.ai_messages import embeddings, gemini
from church_erp.ai_messages.embeddings import chunk_words, documents_to_embed, embed_document, is_embedded
from church_erp.ai_messages.models import SermonDocument, SermonEmbedding
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch

from .fake_gemini import FakeGemini, length

KEY = "test-gemini-key"


def using(fake):
    return mock.patch("church_erp.ai_messages.gemini.httpx.Client", side_effect=lambda **kw: fake.client(**kw))


class ChunkingTests(SimpleTestCase):
    def test_short_sermons_are_one_passage(self):
        self.assertEqual(chunk_words("Grace and peace.\n\nAmen."), ["Grace and peace. Amen."])

    def test_long_sermons_are_cut_into_overlapping_passages_that_cover_every_word(self):
        words = [f"w{i}" for i in range(1000)]
        chunks = chunk_words(" ".join(words), size=300, overlap=50)
        self.assertEqual([len(c.split()) for c in chunks], [300, 300, 300, 250])
        # Each passage starts 50 words before the last one ended.
        self.assertEqual(chunks[1].split()[0], "w250")
        self.assertEqual(chunks[-1].split()[-1], "w999")
        covered = {word for chunk in chunks for word in chunk.split()}
        self.assertEqual(covered, set(words))

    def test_a_tail_shorter_than_the_overlap_isnt_its_own_passage(self):
        chunks = chunk_words(" ".join(f"w{i}" for i in range(320)), size=300, overlap=50)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[-1].split()[-1], "w319")

    def test_empty_text_has_no_passages(self):
        self.assertEqual(chunk_words("  \n "), [])


@override_settings(GEMINI_API_KEY=KEY, GEMINI_EMBEDDING_MODEL="gemini-embedding-001")
class GeminiEmbedTests(SimpleTestCase):
    def test_the_request_asks_for_1536_numbers_per_passage_with_the_key_in_a_header(self):
        fake = FakeGemini()
        with using(fake):
            vectors = gemini.embed(["first passage", "second passage"], "RETRIEVAL_DOCUMENT")
        self.assertEqual(len(vectors), 2)
        [call] = fake.embed_calls()
        self.assertEqual(call["url"], "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents")
        self.assertEqual(call["headers"]["x-goog-api-key"], KEY)
        self.assertNotIn(KEY, call["url"])
        first = call["json"]["requests"][0]
        self.assertEqual(first["model"], "models/gemini-embedding-001")
        self.assertEqual(first["taskType"], "RETRIEVAL_DOCUMENT")
        self.assertEqual(first["outputDimensionality"], 1536)
        self.assertEqual(first["content"]["parts"][0]["text"], "first passage")

    def test_vectors_are_made_unit_length(self):
        # Gemini only does this itself at its full 3072 numbers.
        fake = FakeGemini()
        with using(fake):
            [vector] = gemini.embed(["grace grace peace"], "RETRIEVAL_QUERY")
        self.assertAlmostEqual(length(vector), 1.0, places=6)

    def test_many_passages_go_in_batches_of_100(self):
        fake = FakeGemini()
        with using(fake):
            vectors = gemini.embed([f"passage {i}" for i in range(250)], "RETRIEVAL_DOCUMENT")
        self.assertEqual(len(vectors), 250)
        self.assertEqual([len(c["json"]["requests"]) for c in fake.embed_calls()], [100, 100, 50])

    def test_failures_become_one_kind_of_error(self):
        for fake in (FakeGemini(fail_with=429), FakeGemini(timeout=True), FakeGemini(dimensions=768)):
            with self.subTest(fail=fake.fail_with, timeout=fake.timeout, dimensions=fake.dimensions), using(fake):
                with self.assertRaises(gemini.AIUnavailable):
                    gemini.embed(["a passage"], "RETRIEVAL_DOCUMENT")

    @override_settings(GEMINI_API_KEY="")
    def test_nothing_is_sent_without_a_key(self):
        fake = FakeGemini()
        with using(fake), self.assertRaises(gemini.AIUnavailable):
            gemini.embed(["a passage"], "RETRIEVAL_DOCUMENT")
        self.assertEqual(fake.requests, [])

    def test_the_key_never_appears_in_error_messages(self):
        fake = FakeGemini(fail_with=400)
        with using(fake), self.assertRaises(gemini.AIUnavailable) as caught:
            gemini.embed(["a passage"], "RETRIEVAL_DOCUMENT")
        self.assertNotIn(KEY, str(caught.exception))


@override_settings(GEMINI_API_KEY=KEY, GEMINI_EMBEDDING_MODEL="gemini-embedding-001")
class EmbedDocumentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        branch = make_branch("alpha")
        cls.minister = Minister.objects.create(branch=branch, name="Banda")

    def document(self, words=700, **extra):
        text = " ".join(f"word{i}" for i in range(words))
        return SermonDocument.objects.create(minister=self.minister, title="Grace", text=text, **extra)

    def test_each_passage_is_kept_with_its_place_text_vector_and_model(self):
        document = self.document()
        with using(FakeGemini()):
            count = embed_document(document)
        rows = list(document.embeddings.order_by("chunk_index"))
        self.assertEqual(count, len(rows))
        self.assertEqual([row.chunk_index for row in rows], list(range(len(rows))))
        self.assertEqual([row.chunk_text for row in rows], chunk_words(document.text))
        self.assertEqual({row.model for row in rows}, {"gemini-embedding-001"})
        self.assertEqual(len(rows[0].embedding), 1536)
        self.assertTrue(is_embedded(document))

    def test_running_it_again_replaces_the_passages_rather_than_adding_more(self):
        document = self.document()
        with using(FakeGemini()):
            embed_document(document)
            first = document.embeddings.count()
            embed_document(document)
        self.assertEqual(document.embeddings.count(), first)

    def test_a_failure_keeps_the_passages_it_had(self):
        document = self.document()
        with using(FakeGemini()):
            embed_document(document)
        before = list(document.embeddings.values_list("pk", flat=True))
        with using(FakeGemini(fail_with=500)), self.assertRaises(gemini.AIUnavailable):
            embed_document(document)
        self.assertEqual(list(document.embeddings.values_list("pk", flat=True)), before)

    def test_sermons_waiting_to_be_read_include_those_read_with_another_model(self):
        new = self.document()
        old_model = self.document()
        done = self.document()
        SermonEmbedding.objects.create(document=old_model, chunk_index=0, chunk_text="x", embedding=[0.1] * 1536, model="text-embedding-3-small")
        with using(FakeGemini()):
            embed_document(done)
        self.assertEqual(set(documents_to_embed()), {new, old_model})
        self.assertFalse(is_embedded(old_model))

    def test_reading_with_a_new_model_clears_the_old_models_passages(self):
        document = self.document(words=50)
        SermonEmbedding.objects.create(document=document, chunk_index=5, chunk_text="x", embedding=[0.1] * 1536, model="old-model")
        with using(FakeGemini()):
            embed_document(document)
        self.assertEqual(set(document.embeddings.values_list("model", flat=True)), {"gemini-embedding-001"})


@override_settings(GEMINI_API_KEY=KEY)
class EmbedSermonCommandTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        branch = make_branch("alpha")
        minister = Minister.objects.create(branch=branch, name="Banda")
        cls.first = SermonDocument.objects.create(minister=minister, title="One", text="Grace and peace.")
        cls.second = SermonDocument.objects.create(minister=minister, title="Two", text="Faith hope love.")

    def run_command(self, *args):
        out = StringIO()
        with using(FakeGemini()):
            call_command("embed_sermon", *args, stdout=out)
        return out.getvalue()

    def test_one_sermon_by_id(self):
        output = self.run_command("--id", str(self.first.pk))
        self.assertIn("One: 1 passage", output)
        self.assertTrue(is_embedded(self.first))
        self.assertFalse(is_embedded(self.second))

    def test_every_sermon_waiting(self):
        self.run_command("--waiting")
        self.assertTrue(is_embedded(self.first) and is_embedded(self.second))

    def test_an_unknown_id_or_no_choice_is_an_error(self):
        with self.assertRaises(CommandError):
            self.run_command("--id", "999999")
        with self.assertRaises(CommandError):
            self.run_command()

    def test_settings_are_pinned(self):
        self.assertEqual(embeddings.CHUNK_WORDS, 350)
        self.assertEqual(embeddings.OVERLAP_WORDS, 50)
