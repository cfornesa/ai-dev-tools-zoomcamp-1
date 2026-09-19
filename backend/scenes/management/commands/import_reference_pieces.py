"""Import a small, sanitized reference-piece matrix with explicit opt-in.

This is deliberately a management command rather than an API endpoint: the
fixtures are a QA bridge from the augment-humankind runtime contract, not a
general content-ingestion surface. Development/test imports remain disposable
and owner-scoped. Production requires an explicit opt-in, resolves an existing
profile rather than creating an account, supports a no-write dry run, and can
remove only rows carrying its provenance marker.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from scenes.art_piece_persistence import regenerate_thumbnail
from scenes.canonical_piece_signals import normalize_public_slug
from scenes.models import ArtPiece, ArtPieceVersion, PublicProfile

IMPORT_NAME = "augment-humankind-reference-v1"


@dataclass(frozen=True)
class ReferenceFixture:
    source_id: str
    engine: str
    title: str
    slug: str
    source: str
    capabilities: dict[str, bool]


FIXTURES = (
    ReferenceFixture(
        "legacy-svg-default",
        "svg",
        "Reference SVG Study",
        "reference-svg-study",
        (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">'
            '<rect width="320" height="240" fill="#172554"/>'
            '<circle cx="160" cy="120" r="64" fill="#fbbf24"/></svg>'
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
    ReferenceFixture(
        "legacy-p5-default",
        "p5js",
        "Reference p5 Study",
        "reference-p5-study",
        (
            "window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; "
            "p.draw = () => { p.background(17, 24, 39); p.fill(251, 191, 36); "
            "p.circle(160, 120, 120); }; };"
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
    ReferenceFixture(
        "legacy-c2-default",
        "c2js",
        "Reference C2 Study",
        "reference-c2-study",
        (
            "window.sketch = ({ c2, canvas, startFrame }) => { "
            "const context = canvas.getContext('2d'); startFrame((frame) => { "
            "context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); "
            "context.fillStyle = '#22d3ee'; context.beginPath(); "
            "context.arc(160 + Math.sin(frame / 20) * 40, 120, 42, 0, Math.PI * 2); "
            "context.fill(); }); };"
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
    ReferenceFixture(
        "legacy-c2-interactive-default",
        "c2js-interactive",
        "Reference C2 Interactive Study",
        "reference-c2-interactive-study",
        (
            "window.sketch = ({ c2, canvas, startFrame }) => { "
            "canvas.addEventListener('pointermove', (event) => { "
            "canvas.dataset.pointerX = String(event.offsetX); }); "
            "const context = canvas.getContext('2d'); startFrame(() => { "
            "context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); "
            "context.fillStyle = '#fb7185'; context.beginPath(); "
            "context.arc(Number(canvas.dataset.pointerX || 160), 120, 42, 0, Math.PI * 2); "
            "context.fill(); }); };"
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
    ReferenceFixture(
        "legacy-three-default",
        "threejs",
        "Reference Three.js Study",
        "reference-threejs-study",
        (
            "const scene = new THREE.Scene(); "
            "const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); "
            "camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); "
            "renderer.setSize(320, 240); "
            "document.getElementById('art-piece-container').appendChild(renderer.domElement); "
            "const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), "
            "new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); scene.add(mesh); "
            "function render() { mesh.rotation.y += 0.01; renderer.render(scene, camera); "
            "requestAnimationFrame(render); } render();"
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
    ReferenceFixture(
        "legacy-aframe-default",
        "aframe",
        "Reference A-Frame Study",
        "reference-aframe-study",
        (
            '<a-scene embedded><a-box position="0 1 -4" rotation="0 30 0" '
            'color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>'
        ),
        {"screenshot": True, "fullscreen": True, "immersive": True, "download": True},
    ),
)


def _fixture_marker(source_id: str) -> dict[str, str]:
    return {
        "import_name": IMPORT_NAME,
        "source_id": source_id,
        "source_repository": "augment-humankind-react-node/legacy",
        "source_contract": "art-piece-generation.php",
    }


class Command(BaseCommand):
    help = (
        "Import or remove sanitized augment-humankind reference pieces "
        "with explicit production opt-in."
    )

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["import", "cleanup"])
        parser.add_argument(
            "--username",
            default=None,
            help=(
                "Optional expected login username; production resolves the owner by public handle."
            ),
        )
        parser.add_argument("--handle", default="cfornesa")
        parser.add_argument("--email", default=None)
        parser.add_argument(
            "--allow-production",
            action="store_true",
            help="Permit a non-debug import only after the existing owner/profile is resolved.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report the owner and planned changes without writing any rows.",
        )
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        production = not settings.DEBUG
        if production and not options["allow_production"]:
            raise CommandError(
                "Production reference imports require the explicit --allow-production opt-in."
            )
        username = options["username"]
        handle = normalize_public_slug(options["handle"])
        if not handle:
            raise CommandError("--handle must contain a letter or number.")
        User = get_user_model()
        if production:
            owner = self._resolve_existing_owner(username, handle, options["email"])
        else:
            username = username or "cfornesa"
            owner = User.objects.filter(username=username).first()
            if not owner and options["dry_run"]:
                result = self._dry_run_missing_owner(username, handle, options["action"])
                return self._write_result(result, options["json"])
            if options["dry_run"]:
                result = self._dry_run(owner, handle, options["action"])
                return self._write_result(result, options["json"])
            with transaction.atomic():
                owner, _ = User.objects.get_or_create(
                    username=username,
                    defaults={"email": f"{username}@example.test", "is_active": True},
                )
                PublicProfile.objects.update_or_create(
                    user=owner,
                    defaults={
                        "handle": handle,
                        "display_name": "Christopher Fornesa",
                        "is_public": True,
                    },
                )
                if options["action"] == "cleanup":
                    result = self._cleanup(owner)
                else:
                    result = self._import(owner)
            return self._write_result(result, options["json"])

        if options["dry_run"]:
            result = self._dry_run(owner, handle, options["action"])
        else:
            with transaction.atomic():
                if options["action"] == "cleanup":
                    result = self._cleanup(owner)
                else:
                    result = self._import(owner)
        return self._write_result(result, options["json"])

    def _write_result(self, result: dict[str, object], as_json: bool) -> None:
        if as_json:
            self.stdout.write(json.dumps(result, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(result, indent=2, sort_keys=True)))

    def _resolve_existing_owner(self, username: str | None, handle: str, email: str | None):
        profile = PublicProfile.objects.select_related("user").filter(handle=handle).first()
        if not profile:
            raise CommandError(
                f"No existing public profile owns @{handle}; production imports "
                "never create profiles."
            )
        owner = profile.user
        if username and owner.username != username:
            raise CommandError(
                f"Profile @{handle} belongs to username {owner.username!r}, not {username!r}."
            )
        if email and owner.email.lower() != email.lower():
            raise CommandError(f"Profile @{handle} does not belong to the requested email.")
        return owner

    def _dry_run_missing_owner(self, username: str, handle: str, action: str) -> dict[str, object]:
        return {
            "dry_run": True,
            "no_write": True,
            "action": action,
            "owner": username,
            "handle": handle,
            "owner_exists": False,
            "planned_fixture_count": len(FIXTURES) if action == "import" else 0,
        }

    def _dry_run(self, owner, handle: str, action: str) -> dict[str, object]:
        marked = [
            piece
            for piece in ArtPiece.all_objects.filter(owner=owner)
            if piece.current_version
            and piece.current_version.generation_metadata.get("reference_import", {}).get(
                "import_name"
            )
            == IMPORT_NAME
        ]
        if action == "cleanup":
            return {
                "dry_run": True,
                "no_write": True,
                "action": action,
                "owner": owner.username,
                "owner_id": owner.pk,
                "handle": handle,
                "marked_piece_count": len(marked),
            }
        occupied = set(
            ArtPiece.all_objects.filter(owner=owner).values_list("public_slug", flat=True)
        )
        conflicts: list[str] = []
        existing_markers: set[str] = set()
        for piece in marked:
            version = piece.current_version
            if version:
                existing_markers.add(version.generation_metadata["reference_import"]["source_id"])
        for fixture in FIXTURES:
            if fixture.source_id in existing_markers:
                continue
            if fixture.slug in occupied:
                conflicts.append(fixture.slug)
        return {
            "dry_run": True,
            "no_write": True,
            "action": action,
            "owner": owner.username,
            "owner_id": owner.pk,
            "handle": handle,
            "planned_fixture_count": len(FIXTURES),
            "existing_reference_count": len(existing_markers),
            "would_create": len(FIXTURES) - len(existing_markers),
            "slug_conflicts": conflicts,
            "idempotent": True,
        }

    def _import(self, owner) -> dict[str, object]:
        rows: list[dict[str, object]] = []
        for fixture in FIXTURES:
            marker = _fixture_marker(fixture.source_id)
            existing = next(
                (
                    piece
                    for piece in ArtPiece.all_objects.filter(owner=owner)
                    if piece.current_version
                    and piece.current_version.generation_metadata.get("reference_import") == marker
                ),
                None,
            )
            if existing:
                piece = existing
                version = piece.current_version
                if version and version.capabilities != fixture.capabilities:
                    version = ArtPieceVersion.objects.create(
                        piece=piece,
                        sequence=version.sequence + 1,
                        source=version.source,
                        capabilities=fixture.capabilities,
                        generation_metadata=version.generation_metadata,
                    )
                    piece.current_version = version
                    piece.save(update_fields=["current_version", "updated_at"])
                    regenerate_thumbnail(version)
            else:
                slug = normalize_public_slug(fixture.slug)
                suffix = 2
                while ArtPiece.all_objects.filter(owner=owner, public_slug=slug).exists():
                    slug = f"{fixture.slug}-{suffix}"
                    suffix += 1
                piece = ArtPiece.objects.create(
                    owner=owner,
                    title=fixture.title,
                    public_slug=slug,
                    description="Sanitized reference-runtime fixture.",
                    prompt="Imported sanitized reference fixture.",
                    engine=fixture.engine,
                    status=ArtPiece.Status.PUBLISHED,
                    published_at=timezone.now(),
                )
                version = ArtPieceVersion.objects.create(
                    piece=piece,
                    sequence=1,
                    source=fixture.source,
                    capabilities=fixture.capabilities,
                    generation_metadata={"reference_import": marker},
                )
                piece.current_version = version
                piece.save(update_fields=["current_version", "updated_at"])
                regenerate_thumbnail(version)
            rows.append(
                {
                    "source_id": fixture.source_id,
                    "public_id": str(piece.public_id),
                    "slug": piece.public_slug,
                    "engine": piece.engine,
                    "thumbnail": "fallback-until-browser-capture",
                }
            )
        return {"import": IMPORT_NAME, "owner": owner.username, "pieces": rows}

    def _cleanup(self, owner) -> dict[str, object]:
        pieces = []
        for piece in ArtPiece.all_objects.filter(owner=owner):
            version = piece.current_version
            if (
                version
                and version.generation_metadata.get("reference_import", {}).get("import_name")
                == IMPORT_NAME
            ):
                pieces.append(piece)
        for piece in pieces:
            piece.current_version = None
            piece.save(update_fields=["current_version", "updated_at"])
        deleted = len(pieces)
        for piece in pieces:
            piece.delete()
        return {"cleanup": IMPORT_NAME, "owner": owner.username, "deleted": deleted}
