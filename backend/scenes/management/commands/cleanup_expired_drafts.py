"""Task 43: batch cleanup for the ~24-hour recovery-draft expiry policy.

Documented clock policy: `EditSessionDraft.expires_at` is set to "now +
24 hours" at creation (`scenes.models.default_draft_expiry`) and *reset*
to "now + 24 hours" on every server-accepted sync write
(`scenes.api._upsert_draft`) — so a draft only ever expires after roughly
a day of the caller's browser tab being closed/crashed/offline, not a day
after it was first opened. Two things enforce this together:

1. Lazy, per-request expiry: every read/write path
   (`scenes.models.EditSessionDraftManager.active`, used by
   `DraftDetailView.get`) already excludes any row whose `expires_at` has
   passed, so an expired draft is invisible to the app immediately once
   its clock runs out, with no batch job required for correctness.
2. This command: expired rows are still present in the table until
   something actually deletes them (`.active()` filtering hides them, it
   doesn't remove them). Run this periodically (e.g. a daily cron/
   scheduled task in deployment, or by hand) to reclaim that space. It is
   intentionally just a `DELETE ... WHERE expires_at <= now()` — no
   locking, batching, or backoff — because deleting an already-invisible,
   already-abandoned row is never contentious with any in-flight request.
"""

from django.core.management.base import BaseCommand

from scenes.models import EditSessionDraft


class Command(BaseCommand):
    help = "Deletes EditSessionDraft rows past their ~24-hour expires_at clock."

    def handle(self, *args, **options):
        deleted_count, _ = EditSessionDraft.objects.expired().delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} expired draft(s)."))
