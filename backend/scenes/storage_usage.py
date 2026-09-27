"""Read-only storage measurement and transfer estimates (#931)."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from scenes.cloud_backup import _plan_quota, _public_plan_quota
from scenes.models import ArtPiece, CloudBackupBlob, CloudBackupProject, Project, Project3D


def json_bytes(value: Any) -> int:
    return len(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def _percentile(values: list[int], fraction: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))
    return ordered[index]


@dataclass(frozen=True)
class PieceUsage:
    owner_id: int
    piece_id: str
    kind: str
    title: str
    scene_bytes: int
    code_bytes: int
    media_bytes: int
    file_count: int
    public: bool

    @property
    def total_bytes(self) -> int:
        return self.scene_bytes + self.code_bytes + self.media_bytes


def _piece_usage_rows() -> list[PieceUsage]:
    rows: list[PieceUsage] = []
    for project in Project.all_objects.filter(is_deleted=False).select_related("current_version"):
        if not project.current_version:
            continue
        rows.append(
            PieceUsage(
                owner_id=project.owner_id,
                piece_id=str(project.public_id),
                kind="2d",
                title=project.title,
                scene_bytes=json_bytes(project.current_version.scene_json),
                code_bytes=0,
                media_bytes=0,
                file_count=1,
                public=project.visibility == Project.Visibility.PUBLIC,
            )
        )
    for project3d in Project3D.all_objects.filter(is_deleted=False).select_related(
        "current_version"
    ):
        if not project3d.current_version:
            continue
        rows.append(
            PieceUsage(
                owner_id=project3d.owner_id,
                piece_id=str(project3d.public_id),
                kind="3d",
                title=project3d.title,
                scene_bytes=json_bytes(project3d.current_version.scene_json),
                code_bytes=0,
                media_bytes=0,
                file_count=1,
                public=project3d.visibility == Project3D.Visibility.PUBLIC,
            )
        )
    for piece in ArtPiece.all_objects.filter(is_deleted=False).select_related("current_version"):
        version = piece.current_version
        if not version:
            continue
        rows.append(
            PieceUsage(
                owner_id=piece.owner_id,
                piece_id=str(piece.public_id),
                kind="generated",
                title=piece.title,
                scene_bytes=0,
                code_bytes=len(version.source.encode("utf-8")),
                media_bytes=0,
                file_count=1,
                public=piece.status == ArtPiece.Status.PUBLISHED,
            )
        )
    media_by_project: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))
    for blob in CloudBackupBlob.objects.filter(backup__enabled=True).values(
        "backup__project__public_id", "byte_size"
    ):
        key = str(blob["backup__project__public_id"])
        old_bytes, old_files = media_by_project[key]
        media_by_project[key] = (old_bytes + int(blob["byte_size"]), old_files + 1)
    return [
        PieceUsage(
            **{
                **row.__dict__,
                "media_bytes": row.media_bytes + media_by_project.get(row.piece_id, (0, 0))[0],
                "file_count": row.file_count + media_by_project.get(row.piece_id, (0, 0))[1],
            }
        )
        for row in rows
    ]


def usage_report() -> dict[str, object]:
    rows = _piece_usage_rows()
    by_account: dict[int, dict[str, int]] = defaultdict(
        lambda: {
            "private_bytes": 0,
            "private_files": 0,
            "public_bytes": 0,
            "public_files": 0,
            "pieces": 0,
        }
    )
    for row in rows:
        account = by_account[row.owner_id]
        prefix = "public" if row.public else "private"
        account[f"{prefix}_bytes"] += row.total_bytes
        account[f"{prefix}_files"] += row.file_count
        account["pieces"] += 1
    totals = [row.total_bytes for row in rows]
    return {
        "accounts": [
            {"user_id": user_id, **values} for user_id, values in sorted(by_account.items())
        ],
        "pieces": [
            {
                "owner_id": row.owner_id,
                "piece_id": row.piece_id,
                "kind": row.kind,
                "title": row.title,
                "scene_bytes": row.scene_bytes,
                "code_bytes": row.code_bytes,
                "media_bytes": row.media_bytes,
                "total_bytes": row.total_bytes,
                "files": row.file_count,
                "public": row.public,
            }
            for row in rows
        ],
        "percentiles": {
            "p50_bytes": _percentile(totals, 0.5),
            "p95_bytes": _percentile(totals, 0.95),
        },
        "piece_count": len(rows),
    }


def estimate_transfer(
    user, *, piece_bytes: int, media_bytes: int, piece_files: int, media_files: int
) -> dict[str, object]:
    if min(piece_bytes, media_bytes, piece_files, media_files) < 0:
        raise ValueError("Storage estimates must not be negative.")
    private_bytes, private_files = _current_usage(user, public=False)
    public_bytes, public_files = _current_usage(user, public=True)
    private_cap = _plan_quota(user)
    public_cap = _public_plan_quota(user)
    estimate = {
        "bytes": piece_bytes + media_bytes,
        "files": piece_files + media_files,
        "piece_bytes": piece_bytes,
        "media_bytes": media_bytes,
        "piece_files": piece_files,
        "media_files": media_files,
    }
    return {
        "current_usage": {
            "private": {"bytes": private_bytes, "files": private_files},
            "public": {"bytes": public_bytes, "files": public_files},
        },
        "quotas": {
            "private": {"bytes": private_cap[0], "files": private_cap[1]},
            "public": {"bytes": public_cap[0], "files": public_cap[1]},
        },
        "estimate": estimate,
        "remaining_after": {
            "private": {
                "bytes": private_cap[0] - private_bytes - estimate["bytes"],
                "files": private_cap[1] - private_files - estimate["files"],
            },
            "public": {
                "bytes": public_cap[0] - public_bytes - estimate["bytes"],
                "files": public_cap[1] - public_files - estimate["files"],
            },
        },
        "fits": {
            "private": private_bytes + estimate["bytes"] <= private_cap[0]
            and private_files + estimate["files"] <= private_cap[1],
            "public": public_bytes + estimate["bytes"] <= public_cap[0]
            and public_files + estimate["files"] <= public_cap[1],
        },
    }


def _current_usage(user, *, public: bool) -> tuple[int, int]:
    rows = [row for row in _piece_usage_rows() if row.owner_id == user.id and row.public == public]
    if not public:
        backed_up = set(
            str(value)
            for value in CloudBackupProject.objects.filter(
                project__owner=user, enabled=True
            ).values_list("project__public_id", flat=True)
        )
        rows = [row for row in rows if row.piece_id in backed_up]
    return sum(row.total_bytes for row in rows), sum(row.file_count for row in rows)
