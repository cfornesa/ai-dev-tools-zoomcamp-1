"""Issue #134: backfill/repair gallery thumbnails for already-public
projects whose current version has no usable thumbnail yet.

`maybe_schedule_thumbnail_generation` (`scenes/thumbnail_generation.py`)
only ever fires from the same request that changes `current_version` or
publishes a project, so a project that was already public before
thumbnail generation existed (or whose current version's render failed,
leaving a stored `is_fallback=True` row) never gets a real thumbnail on
its own. `PublicProjectThumbnailView`'s own lazy-generation-at-serve-time
path (`scenes/api.py`) only helps the "no row at all yet" case — once a
fallback row exists, `thumbnail is None` is false, so that view keeps
serving the same stale fallback forever and never retries. This command
is the retry path `ensure_thumbnail_for_version`'s own docstring
anticipates ("a later retry ... from a management command ... can replace
[a fallback row] with a successful render").

Only ever touches public projects with a current version — the same
content-source boundary every other thumbnail trigger enforces (a private
project's scene is never rendered via any path, including this one).
"""

from django.core.management.base import BaseCommand

from scenes.models import Project
from scenes.thumbnail_generation import ensure_thumbnail_for_version


class Command(BaseCommand):
    help = (
        "Generates or regenerates gallery thumbnails for public projects "
        "whose current version has no thumbnail yet, or only a fallback one."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be generated without rendering anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        candidates = Project.objects.filter(
            visibility=Project.Visibility.PUBLIC, current_version_id__isnull=False
        ).exclude(current_version__thumbnail__is_fallback=False)

        total = candidates.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No public projects need a thumbnail backfill."))
            return

        if dry_run:
            self.stdout.write(
                f"{total} public project(s) would be backfilled (dry run, no changes made)."
            )
            return

        generated = 0
        still_fallback = 0
        for project in candidates.iterator():
            thumbnail = ensure_thumbnail_for_version(project.current_version_id)
            if thumbnail is None:
                continue
            if thumbnail.is_fallback:
                still_fallback += 1
            else:
                generated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {total} public project(s): {generated} thumbnail(s) generated, "
                f"{still_fallback} still fell back to the placeholder (render failed again)."
            )
        )
