"""Daily message drafts from a minister's written sermons (AGENT_EXECUTION_PLAN.md, Tasks 4.3 and 4.4).

Each day has a theme. The passages of the minister's sermons nearest that
theme are given to Gemini with the minister's style notes, and its draft is
saved for staff to check: never published by itself. Gemini is faked at the
HTTP layer; tests run on SQLite, so the nearest-passage search uses its
fallback here (the Postgres query is checked separately, see the plan)."""
from datetime import date, timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone

from church_erp.ai_messages import generation
from church_erp.ai_messages.embeddings import embed_document
from church_erp.ai_messages.generation import (
    THEMES,
    draft_for,
    nearest_passages,
    run_daily,
    theme_for,
)
from church_erp.ai_messages.models import DailyMessage, SermonDocument, SermonEmbedding
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch

from .fake_gemini import FakeGemini, vector_for
from .test_embeddings import KEY, using

DAY = date(2026, 11, 9)


def unit(text):
    values = vector_for(text)
    size = sum(v * v for v in values) ** 0.5
    return [v / size for v in values]


@override_settings(GEMINI_API_KEY=KEY, GEMINI_EMBEDDING_MODEL="gemini-embedding-001")
class GenerationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.minister = Minister.objects.create(
            branch=cls.alpha, name="Banda", ai_drafts=True,
            bio="Minister at Alpha since 2019.", style_notes="Short sentences. Ends with a prayer.",
        )

    def sermon(self, title, text, minister=None):
        document = SermonDocument.objects.create(minister=minister or self.minister, title=title, text=text)
        with using(FakeGemini()):
            embed_document(document)
        return document


class ThemeTests(TestCase):
    def test_every_day_has_a_theme_and_neighbouring_days_differ(self):
        self.assertGreaterEqual(len(THEMES), 28)
        days = [DAY + timedelta(days=n) for n in range(len(THEMES))]
        self.assertEqual({theme_for(day) for day in days}, set(THEMES))
        self.assertNotEqual(theme_for(DAY), theme_for(DAY + timedelta(days=1)))


class NearestPassageTests(GenerationTestCase):
    def test_the_passages_nearest_the_theme_come_first(self):
        shepherd = self.sermon("Shepherd", "the shepherd leads his sheep beside still waters")
        self.sermon("Money", "give generously from your money and your harvest")
        found = nearest_passages(self.minister, unit("shepherd sheep waters"), limit=2)
        self.assertEqual(found[0].document, shepherd)
        self.assertEqual(len(found), 2)

    def test_only_this_ministers_passages_with_todays_model(self):
        other = Minister.objects.create(branch=make_branch("beta"), name="Phiri", ai_drafts=True)
        self.sermon("Theirs", "shepherd sheep waters", minister=other)
        mine = self.sermon("Mine", "a quiet word about patience")
        SermonEmbedding.objects.create(
            document=mine, chunk_index=99, chunk_text="old", embedding=unit("shepherd sheep waters"), model="old-model",
        )
        found = nearest_passages(self.minister, unit("shepherd sheep waters"), limit=5)
        self.assertEqual([(p.document, p.model) for p in found], [(mine, "gemini-embedding-001")])

    def test_some_sermons_can_be_left_out(self):
        used = self.sermon("Used", "shepherd sheep")
        fresh = self.sermon("Fresh", "patience")
        found = nearest_passages(self.minister, unit("shepherd sheep"), limit=5, exclude_documents=[used.pk])
        self.assertEqual([p.document for p in found], [fresh])


class DraftTests(GenerationTestCase):
    def test_a_draft_is_saved_for_staff_to_check_never_published(self):
        source = self.sermon("Shepherd", "The Lord is my shepherd. He leads me beside still waters.")
        fake = FakeGemini()
        with using(fake):
            message = draft_for(self.minister, DAY)
        self.assertEqual(message.status, "pending_review")
        self.assertTrue(message.ai_generated)
        self.assertIsNone(message.published_at)
        self.assertIsNone(message.reviewed_by)
        self.assertEqual((message.minister, message.date), (self.minister, DAY))
        self.assertEqual(message.title, "Held by the Shepherd")
        self.assertEqual(message.reference_verse, "Psalm 23:1")
        self.assertEqual(message.verse_text, "The Lord is my shepherd; I shall not want.")
        self.assertEqual(message.message, "Today, remember that the Lord leads you.\n\nRest in him.")
        self.assertEqual(list(message.source_documents.all()), [source])

    def test_the_prompt_carries_the_theme_passages_and_the_ministers_style(self):
        self.sermon("Shepherd", "The Lord is my shepherd. He leads me beside still waters.")
        fake = FakeGemini()
        with using(fake):
            draft_for(self.minister, DAY)
        [query] = [c for c in fake.embed_calls() if c["json"]["requests"][0]["taskType"] == "RETRIEVAL_QUERY"]
        self.assertIn(theme_for(DAY), query["json"]["requests"][0]["content"]["parts"][0]["text"])
        [call] = fake.generate_calls()
        body = call["json"]
        prompt = body["contents"][0]["parts"][0]["text"]
        system = body["systemInstruction"]["parts"][0]["text"]
        self.assertIn("He leads me beside still waters.", prompt)
        self.assertIn("Short sentences. Ends with a prayer.", prompt)
        self.assertIn("Minister at Alpha since 2019.", prompt)
        self.assertIn(theme_for(DAY), prompt)
        self.assertIn("Rev. Banda", system)
        self.assertIn("Uniting Presbyterian Church in Zambia", system)
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(
            set(body["generationConfig"]["responseSchema"]["required"]),
            {"title", "reference_verse", "verse_text", "message"},
        )
        self.assertTrue(call["url"].endswith("models/gemini-flash-latest:generateContent"))

    def test_nothing_is_written_when_the_minister_already_has_a_message_that_day(self):
        self.sermon("Shepherd", "The Lord is my shepherd.")
        DailyMessage.objects.create(minister=self.minister, title="Written by staff", message="m", date=DAY)
        fake = FakeGemini()
        with using(fake):
            self.assertIsNone(draft_for(self.minister, DAY))
        self.assertEqual(fake.requests, [])
        self.assertEqual(DailyMessage.objects.count(), 1)

    def test_nothing_is_written_without_any_read_sermons(self):
        fake = FakeGemini()
        with using(fake):
            self.assertIsNone(draft_for(self.minister, DAY))
        self.assertEqual(fake.generate_calls(), [])

    def test_sermons_used_in_the_last_fortnight_are_rested_while_others_remain(self):
        shepherd = self.sermon("Shepherd", "shepherd sheep")
        patience = self.sermon("Patience", "patience waiting")
        earlier = DailyMessage.objects.create(
            minister=self.minister, title="Earlier", message="m", date=DAY - timedelta(days=3), ai_generated=True,
        )
        earlier.source_documents.set([shepherd])
        with using(FakeGemini()):
            message = draft_for(self.minister, DAY)
        self.assertEqual(list(message.source_documents.all()), [patience])

    def test_with_only_rested_sermons_left_they_are_used_again(self):
        shepherd = self.sermon("Shepherd", "shepherd sheep")
        earlier = DailyMessage.objects.create(
            minister=self.minister, title="Earlier", message="m", date=DAY - timedelta(days=1), ai_generated=True,
        )
        earlier.source_documents.set([shepherd])
        with using(FakeGemini()):
            message = draft_for(self.minister, DAY)
        self.assertEqual(list(message.source_documents.all()), [shepherd])

    def test_answers_are_tidied_and_kept_within_the_boxes_limits(self):
        self.sermon("Shepherd", "The Lord is my shepherd.")
        reply = {
            "title": "  " + "T" * 400 + "  ",
            "reference_verse": "R" * 150,
            "verse_text": "  The Lord is my shepherd.  ",
            "message": "First.\r\n\r\n\r\n\r\nSecond.  ",
        }
        with using(FakeGemini(reply=reply)):
            message = draft_for(self.minister, DAY)
        self.assertEqual(len(message.title), 300)
        self.assertEqual(message.reference_verse, "")  # too long to be a real reference
        self.assertEqual(message.verse_text, "The Lord is my shepherd.")
        self.assertEqual(message.message, "First.\n\nSecond.")

    def test_unusable_answers_save_nothing(self):
        self.sermon("Shepherd", "The Lord is my shepherd.")
        for fake in (
            FakeGemini(reply={"title": "", "reference_verse": "", "verse_text": "", "message": "Words"}),
            FakeGemini(reply={"title": "T", "reference_verse": "", "verse_text": "", "message": "   "}),
            FakeGemini(reply={"title": ["not", "text"], "message": "Words"}),
            FakeGemini(reply="not json at all"),
            FakeGemini(finish="SAFETY"),
            FakeGemini(fail_with=503),
        ):
            with self.subTest(reply=str(fake.reply)[:40], finish=fake.finish, fail=fake.fail_with), using(fake):
                with self.assertRaises(generation.AIUnavailable):
                    draft_for(self.minister, DAY)
        self.assertFalse(DailyMessage.objects.exists())


@override_settings(GEMINI_API_KEY=KEY, GEMINI_EMBEDDING_MODEL="gemini-embedding-001")
class RunDailyTests(TestCase):
    """What the scheduled job does: read waiting sermons, then write tomorrow's drafts."""

    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.on = Minister.objects.create(branch=cls.alpha, name="Banda", ai_drafts=True)
        cls.off = Minister.objects.create(branch=cls.alpha, name="Mwale", ai_drafts=False)
        cls.on_sermon = SermonDocument.objects.create(minister=cls.on, title="Shepherd", text="The Lord is my shepherd.")
        cls.off_sermon = SermonDocument.objects.create(minister=cls.off, title="Private", text="Kept private words.")

    def run_it(self, fake=None, **kwargs):
        fake = fake or FakeGemini()
        with using(fake):
            return run_daily(**kwargs), fake

    def test_waiting_sermons_are_read_and_tomorrows_drafts_written(self):
        summary, _ = self.run_it()
        tomorrow = timezone.localdate() + timedelta(days=1)
        self.assertEqual(summary["read"], 1)
        self.assertEqual(summary["drafted"], 1)
        self.assertEqual(summary["day"], tomorrow.isoformat())
        message = DailyMessage.objects.get()
        self.assertEqual((message.minister, message.date, message.status), (self.on, tomorrow, "pending_review"))

    def test_sermons_of_ministers_with_drafts_off_are_never_sent(self):
        _, fake = self.run_it()
        sent = " ".join(str(call["json"]) for call in fake.requests)
        self.assertNotIn("Kept private words.", sent)
        self.assertFalse(self.off_sermon.embeddings.exists())
        self.assertFalse(DailyMessage.objects.filter(minister=self.off).exists())

    def test_ministers_of_branches_taken_off_the_website_are_left_alone(self):
        self.alpha.is_active = False
        self.alpha.save()
        summary, fake = self.run_it()
        self.assertEqual((summary["read"], summary["drafted"]), (0, 0))
        self.assertEqual(fake.requests, [])

    def test_running_it_again_adds_nothing(self):
        self.run_it()
        summary, fake = self.run_it()
        self.assertEqual((summary["read"], summary["drafted"]), (0, 0))
        self.assertEqual(fake.generate_calls(), [])
        self.assertEqual(DailyMessage.objects.count(), 1)

    def test_a_failure_for_one_minister_doesnt_stop_the_others(self):
        second = Minister.objects.create(branch=self.alpha, name="Zulu", ai_drafts=True)
        SermonDocument.objects.create(minister=second, title="Hope", text="Hope does not disappoint.")
        calls = {"n": 0}
        real = generation.gemini.generate_json

        def first_fails(*args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise generation.AIUnavailable("busy")
            return real(*args, **kwargs)

        with mock.patch.object(generation.gemini, "generate_json", side_effect=first_fails):
            summary, _ = self.run_it()
        self.assertEqual(summary["drafted"], 1)
        self.assertEqual(len(summary["errors"]), 1)
        self.assertNotIn(KEY, str(summary))

    def test_it_stops_when_its_time_is_up_and_says_what_is_left(self):
        second = Minister.objects.create(branch=self.alpha, name="Zulu", ai_drafts=True)
        SermonDocument.objects.create(minister=second, title="Hope", text="Hope does not disappoint.")
        clock = iter([0.0, 0.0, 0.0, 100.0, 100.0, 100.0, 100.0, 100.0])
        with mock.patch.object(generation.time, "monotonic", side_effect=lambda: next(clock, 100.0)):
            summary, _ = self.run_it(budget_seconds=25)
        self.assertGreater(summary["left"], 0)
        # The next run picks up where this one stopped.
        summary, _ = self.run_it(budget_seconds=25)
        self.assertEqual(DailyMessage.objects.count(), 2)
        self.assertEqual(summary["left"], 0)

    @override_settings(GEMINI_API_KEY="")
    def test_without_a_key_it_does_nothing_and_says_so(self):
        summary, fake = self.run_it()
        self.assertEqual(summary, {"ai": "off"})
        self.assertEqual(fake.requests, [])

    def test_a_given_day_can_be_drafted(self):
        self.run_it(day=DAY)
        self.assertEqual(DailyMessage.objects.get().date, DAY)
