"""Hard-deletes creative content that has passed its retention grace
period after a soft delete (issue #443).

`Project`/`Project3D`/`ArtPiece` are already soft-deleted by their own
single-item delete endpoints (`is_deleted`/`deleted_at`) and by
`scenes.account_deletion.delete_account` for every project/piece an
account owned. Neither of those permanently removes rows -- this command
is the one place that does, and only for rows soft-deleted longer ago
than the grace period (30 days by default). This repo has no task queue,
so this is a plain management command meant to be invoked manually or by
an external scheduler (e.g. a cron entry, a scheduled Replit/CI job),
never run automatically as part of a request or the deployment build.

    uv run --env-file .env python manage.py purge_deleted_content
    uv run --env-file .env python manage.py purge_deleted_content --dry-run
    uv run --env-file .env python manage.py purge_deleted_content --grace-days 7

Hard-deleting a `Project`/`Project3D`/`ArtPiece` row cascades
(`on_delete=CASCADE`) to its versions/thumbnails automatically -- nothing
else needs to be deleted explicitly here.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from scenes.models import ArtPiece, Project, Project3D

DEFAULT_GRACE_DAYS = 30

_PURGEABLE_MODELS = (Project, Project3D, ArtPiece)


class Command(BaseCommand):
    help = (
        "Hard-deletes Project/Project3D/ArtPiece rows that have been "
        "soft-deleted for longer than the retention grace period."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--grace-days",
            type=int,
            default=DEFAULT_GRACE_DAYS,
            help=f"Retention grace period in days (default: {DEFAULT_GRACE_DAYS}).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be purged without deleting anything.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        grace_days = options["grace_days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(days=grace_days)

        for model in _PURGEABLE_MODELS:
            queryset = model.all_objects.filter(is_deleted=True, deleted_at__lt=cutoff)
            count = queryset.count()
            if dry_run:
                self.stdout.write(f"Would purge {count} {model.__name__} row(s).")
            else:
                queryset.delete()
                self.stdout.write(f"Purged {count} {model.__name__} row(s).")
