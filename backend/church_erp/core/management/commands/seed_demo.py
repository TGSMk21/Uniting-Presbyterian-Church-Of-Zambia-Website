from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from church_erp.core.models import Branch, Minister
from church_erp.content.models import Activity, Project, Sermon


class Command(BaseCommand):
    help = (
        "Seed a demo Chilanga branch with a minister and placeholder sermons, "
        "projects and activities. Development only: the sermons point at "
        "unrelated public YouTube videos. Create users with createsuperuser."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "seed_demo only runs with DEBUG=True; it creates placeholder "
                "content that must never reach production."
            )
        self.stdout.write("Seeding demo data for Chilanga Presbyterian Church...")

        # --- Branch ---
        branch, branch_created = Branch.objects.get_or_create(
            slug="chilanga",
            defaults={
                "name": "Chilanga Presbyterian Church",
                "logo": "",
                "contact_email": "info@chilangapresbyterian.org",
                "contact_phone": "+260 21 123 4567",
                "address": "Freedom Compound, Chilanga, Lusaka, Zambia",
                "youtube_channel_id": "UCwmZC66RTQGv2y7-AiX2H-A",
                "is_active": True,
            },
        )
        self.stdout.write(
            self.style.SUCCESS("Branch") if branch_created else "Branch already exists"
        )

        # --- Minister ---
        minister, minister_created = Minister.objects.get_or_create(
            branch=branch,
            name="Thomson Mkandawire",
            defaults={
                "bio": (
                    "Reverend Thomson Mkandawire is a dedicated servant of God whose "
                    "pastoral journey began over fifteen years ago. He was called to "
                    "ministry with a deep conviction to preach the Word, disciple "
                    "believers, and extend the love of Christ to the lost and the hurting."
                ),
            },
        )
        self.stdout.write(
            self.style.SUCCESS("Minister") if minister_created else "Minister already exists"
        )

        # --- Sermons ---
        sermons = [
            {
                "title": "The Light That Exposes",
                "series": "1 John",
                "description": "Walking in the light means honest confession and fellowship with God.",
                "video_id": "dQw4w9WgXcQ",
                "reference_verse": "1 John 1:5-10",
                "preached_at": timezone.make_aware(datetime(2026, 1, 7, 9, 0)),
            },
            {
                "title": "Fellowship With the Father",
                "series": "1 John",
                "description": "True fellowship with God is the foundation of Christian joy.",
                "video_id": "9bZkp7q19f0",
                "reference_verse": "1 John 1:1-4",
                "preached_at": timezone.make_aware(datetime(2025, 12, 31, 9, 0)),
            },
            {
                "title": "The Promise Fulfilled",
                "series": "Advent",
                "description": "God's promise of a Saviour is fulfilled in Jesus Christ.",
                "video_id": "kJQP7kiw5Fk",
                "reference_verse": "Luke 2:10-11",
                "preached_at": timezone.make_aware(datetime(2025, 12, 24, 9, 0)),
            },
            {
                "title": "Rooted When the Storm Comes",
                "series": "Faith",
                "description": "Building our lives on Christ keeps us standing through trials.",
                "video_id": "60ItHLz5WEA",
                "reference_verse": "Matthew 7:24-27",
                "preached_at": timezone.make_aware(datetime(2025, 12, 17, 9, 0)),
            },
            {
                "title": "Standing on the Rock",
                "series": "Faith",
                "description": "A firm foundation in Christ for every season of life.",
                "video_id": "fJ9rUzIMcZQ",
                "reference_verse": "Psalm 40:1-2",
                "preached_at": timezone.make_aware(datetime(2025, 12, 10, 9, 0)),
            },
            {
                "title": "The Gift We Didn't Earn",
                "series": "Grace",
                "description": "Salvation is God's gift of grace, received by faith alone.",
                "video_id": "hTWKbfoikeg",
                "reference_verse": "Ephesians 2:8-9",
                "preached_at": timezone.make_aware(datetime(2025, 12, 3, 9, 0)),
            },
        ]
        for s in sermons:
            _, created = Sermon.objects.get_or_create(
                branch=branch,
                title=s["title"],
                defaults={
                    "minister": minister,
                    "series": s["series"],
                    "description": s["description"],
                    "video_id": s["video_id"],
                    "reference_verse": s["reference_verse"],
                    "preached_at": s["preached_at"],
                },
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(sermons)} sermons"))

        # --- Projects ---
        projects = [
            {
                "title": "Community Water Well",
                "status": "ONGOING",
                "description": "Providing clean and safe drinking water to over 500 households in the Mabiri community.",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 8, 31),
                "progress": 65,
            },
            {
                "title": "Youth Education Fund",
                "status": "ONGOING",
                "description": "Sponsoring tuition for underprivileged youth, empowering the next generation.",
                "start_date": date(2026, 1, 1),
                "end_date": None,
                "progress": 42,
            },
            {
                "title": "Church Roof Restoration",
                "status": "COMPLETED",
                "description": "Complete restoration of the main church sanctuary roof.",
                "start_date": date(2025, 3, 1),
                "end_date": date(2025, 11, 30),
                "progress": 100,
            },
        ]
        for p in projects:
            Project.objects.get_or_create(branch=branch, title=p["title"], defaults=p)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(projects)} projects"))

        # --- Activities ---
        activities = [
            {
                "title": "Prayer & Worship Night",
                "start_time": time(18, 0),
                "end_time": time(20, 0),
                "date": date(2026, 1, 18),
                "details": "An evening of corporate prayer, heartfelt worship, and seeking God's presence together.",
                "location": "Main Church Sanctuary",
            },
            {
                "title": "Community Outreach Day",
                "start_time": time(9, 0),
                "end_time": time(13, 0),
                "date": date(2026, 1, 25),
                "details": "Serving meals and sharing the love of Christ with families in the downtown area.",
                "location": "Chilanga Township",
            },
            {
                "title": "Youth Fellowship Gathering",
                "start_time": time(14, 0),
                "end_time": time(17, 0),
                "date": date(2026, 2, 1),
                "details": "Games, teaching, and fellowship for teens and young adults.",
                "location": "Fellowship Hall",
            },
        ]
        for a in activities:
            Activity.objects.get_or_create(branch=branch, title=a["title"], date=a["date"], defaults=a)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(activities)} activities"))

        self.stdout.write(self.style.SUCCESS("Seeding complete."))
