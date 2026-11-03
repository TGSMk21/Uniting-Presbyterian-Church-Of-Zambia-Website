"""The create_branch onboarding command (AGENT_EXECUTION_PLAN.md, Task 2.1)."""
import re
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase

from church_erp.accounts.models import User
from church_erp.core.models import Branch

ARGS = [
    "--name", "Kabwe Presbyterian Church",
    "--slug", "kabwe",
    "--contact-email", "kabwe@example.org",
]


def create(*extra):
    out = StringIO()
    call_command("create_branch", *ARGS, *extra, stdout=out)
    return out.getvalue()


def printed_password(output):
    return re.search(r"Temporary password: (\S+)", output).group(1)


class CreateBranchTests(TestCase):
    def setUp(self):
        call_command("setup_roles", verbosity=0)

    def test_creates_the_branch(self):
        create("--youtube-channel-id", "UCabc123", "--phone", "0977 000 000", "--address", "Kabwe")
        branch = Branch.objects.get(slug="kabwe")
        self.assertEqual(branch.name, "Kabwe Presbyterian Church")
        self.assertEqual(branch.contact_email, "kabwe@example.org")
        self.assertEqual(branch.youtube_channel_id, "UCabc123")
        self.assertEqual(branch.contact_phone, "0977 000 000")
        self.assertEqual(branch.address, "Kabwe")
        self.assertTrue(branch.is_active)

    def test_creates_a_branch_admin_who_can_log_in_with_the_printed_password(self):
        output = create()
        admin = User.objects.get(username="kabwe-admin")
        self.assertEqual(admin.branch.slug, "kabwe")
        self.assertEqual(admin.role, "branch_admin")
        self.assertTrue(admin.is_staff)
        self.assertFalse(admin.is_superuser)
        self.assertEqual(admin.email, "kabwe@example.org")
        self.assertIn("Branch Admin", admin.groups.values_list("name", flat=True))
        self.assertTrue(admin.check_password(printed_password(output)))
        self.assertTrue(self.client.login(username="kabwe-admin", password=printed_password(output)))

    def test_admin_username_and_email_can_be_chosen(self):
        create("--admin-username", "rev.banda", "--admin-email", "banda@example.org")
        admin = User.objects.get(username="rev.banda")
        self.assertEqual(admin.email, "banda@example.org")

    def test_temporary_passwords_are_long_and_unique(self):
        first = printed_password(create())
        out = StringIO()
        call_command(
            "create_branch", "--name", "Ndola", "--slug", "ndola",
            "--contact-email", "ndola@example.org", stdout=out,
        )
        second = printed_password(out.getvalue())
        self.assertGreaterEqual(len(first), 16)
        self.assertNotEqual(first, second)

    def test_refuses_an_existing_slug_without_changing_anything(self):
        create()
        with self.assertRaisesMessage(CommandError, "kabwe"):
            call_command(
                "create_branch", "--name", "Other", "--slug", "kabwe",
                "--contact-email", "other@example.org", "--admin-username", "other-admin",
                stdout=StringIO(),
            )
        self.assertEqual(Branch.objects.get(slug="kabwe").name, "Kabwe Presbyterian Church")
        self.assertFalse(User.objects.filter(username="other-admin").exists())

    def test_existing_admin_username_creates_nothing(self):
        User.objects.create_user("kabwe-admin")
        with self.assertRaisesMessage(CommandError, "kabwe-admin"):
            create()
        self.assertFalse(Branch.objects.filter(slug="kabwe").exists())

    def test_failed_admin_creation_leaves_no_half_made_branch(self):
        from unittest import mock

        with mock.patch.object(User.objects, "create_user", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError):
                create()
        self.assertFalse(Branch.objects.filter(slug="kabwe").exists())

    def test_rejects_invalid_input(self):
        cases = [
            ("--slug", "Kabwe Town"),
            ("--contact-email", "not-an-email"),
            ("--youtube-channel-id", "not-a-channel"),
        ]
        for flag, value in cases:
            with self.subTest(flag=flag):
                args = dict(zip(ARGS[::2], ARGS[1::2]))
                args[flag] = value
                with self.assertRaises(CommandError):
                    call_command("create_branch", *sum(args.items(), ()), stdout=StringIO())
                self.assertFalse(Branch.objects.exists())
                self.assertFalse(User.objects.exists())
