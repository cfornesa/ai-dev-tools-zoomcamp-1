"""Print a read-only storage measurement report for quota planning (#931)."""

from __future__ import annotations

import csv
import json

from django.core.management.base import BaseCommand

from scenes.storage_usage import usage_report


class Command(BaseCommand):
    help = "Report measured piece, scene/code, and known media usage without writing data."

    def add_arguments(self, parser):
        parser.add_argument("--format", choices=("json", "csv"), default="json")

    def handle(self, *args, **options):
        report = usage_report()
        if options["format"] == "json":
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
            return
        writer = csv.DictWriter(
            self.stdout,
            fieldnames=(
                "owner_id",
                "piece_id",
                "kind",
                "title",
                "scene_bytes",
                "code_bytes",
                "media_bytes",
                "total_bytes",
                "files",
                "public",
            ),
        )
        writer.writeheader()
        for row in report["pieces"]:
            writer.writerow(row)
