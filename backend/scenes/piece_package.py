"""Validation and safe parsing for portable piece-package ZIPs (#930).

The frontend has a parallel implementation, but this module is authoritative
for server-side package intake. It validates the shared manifest schema,
allows only integer-indexed payload paths, verifies every SHA-256 checksum,
and returns data only after the complete archive has passed validation.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import zipfile
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from scenes.art_piece_validation import validate_art_piece_source
from scenes.validation import validate_scene
from scenes.validation3d import validate_scene3d

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "piece-package.schema.json"
with SCHEMA_PATH.open(encoding="utf-8") as schema_file:
    PIECE_PACKAGE_SCHEMA: dict[str, Any] = json.load(schema_file)

PIECE_PACKAGE_FORMAT_VERSION = 1
PIECE_PACKAGE_MAX_BYTES = 52_428_800
PIECE_PACKAGE_MAX_FILES = 100
_VALIDATOR = Draft202012Validator(PIECE_PACKAGE_SCHEMA, format_checker=FormatChecker())


class PiecePackageError(ValueError):
    """Raised when a package is malformed, unsafe, oversized, or corrupt."""


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_piece_package(manifest: Any, files: dict[str, bytes]) -> None:  # noqa: C901
    """Validate a decoded manifest and payload map without mutating storage."""

    errors = sorted(_VALIDATOR.iter_errors(manifest), key=lambda error: list(error.path))
    if errors:
        path = ".".join(str(part) for part in errors[0].path) or "$"
        raise PiecePackageError(f"Invalid package manifest at {path}: {errors[0].message}")
    if set(files) != {entry["path"] for entry in manifest["files"]}:
        raise PiecePackageError("Package payload files do not match the manifest.")
    if len(files) > PIECE_PACKAGE_MAX_FILES:
        raise PiecePackageError("Package contains too many files.")
    if len({entry["index"] for entry in manifest["files"]}) != len(manifest["files"]):
        raise PiecePackageError("Package file indexes must be unique.")
    if sum(len(payload) for payload in files.values()) > PIECE_PACKAGE_MAX_BYTES:
        raise PiecePackageError("Package exceeds the byte limit.")
    for entry in manifest["files"]:
        path = entry["path"]
        payload = files[path]
        if len(payload) != entry["byteSize"]:
            raise PiecePackageError(f"Package byte size mismatch: {path}.")
        if _sha256(payload) != entry["sha256"]:
            raise PiecePackageError(f"Package checksum mismatch: {path}.")
    file_by_index = {entry["index"]: entry for entry in manifest["files"]}
    for record in manifest["records"]:
        file = file_by_index.get(record["fileIndex"])
        if file is None or not file["path"].endswith(".json"):
            raise PiecePackageError("A record references a non-JSON or missing payload.")
        try:
            data = json.loads(files[file["path"]].decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PiecePackageError("A record payload is not valid JSON.") from exc
        if manifest["kind"] == "2d":
            scene_result = validate_scene(data)
            if not scene_result.valid:
                raise PiecePackageError("A 2D record does not satisfy the scene schema.")
        elif manifest["kind"] == "3d":
            scene3d_result = validate_scene3d(data)
            if not scene3d_result.valid:
                raise PiecePackageError("A 3D record does not satisfy the scene schema.")
    for asset in manifest["mediaAssets"]:
        file = file_by_index.get(asset["fileIndex"])
        if file is None or not file["path"].endswith(".bin"):
            raise PiecePackageError("A media asset references a non-binary or missing payload.")
        if asset["byteSize"] != file["byteSize"] or asset["sha256"] != file["sha256"]:
            raise PiecePackageError("A media asset descriptor does not match its payload.")
    if manifest["kind"] == "generated":
        source = manifest["source"]
        if (
            not isinstance(source, dict)
            or not isinstance(source.get("engine"), str)
            or not isinstance(source.get("code"), str)
        ):
            raise PiecePackageError("Generated packages require an engine and source code.")
        try:
            validate_art_piece_source(source["engine"], source["code"])
        except Exception as exc:
            raise PiecePackageError("Generated source does not match its declared engine.") from exc


def parse_piece_package_archive(archive: bytes) -> dict[str, Any]:
    """Decode and validate a ZIP atomically, returning manifest and payloads."""

    if len(archive) > PIECE_PACKAGE_MAX_BYTES:
        raise PiecePackageError("Package exceeds the byte limit.")
    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
            names = zip_file.namelist()
            if len(names) > PIECE_PACKAGE_MAX_FILES + 1:
                raise PiecePackageError("Package contains too many files.")
            if any(name != "manifest.json" and not _safe_payload_path(name) for name in names):
                raise PiecePackageError("Package contains an unsafe path.")
            if names.count("manifest.json") != 1:
                raise PiecePackageError("Package must contain exactly one manifest.")
            manifest = json.loads(zip_file.read("manifest.json").decode("utf-8"))
            infos = {info.filename: info for info in zip_file.infolist()}
            declared_uncompressed = sum(
                info.file_size for name, info in infos.items() if name != "manifest.json"
            )
            if declared_uncompressed > PIECE_PACKAGE_MAX_BYTES:
                raise PiecePackageError("Package exceeds the decompressed byte limit.")
            files = {name: zip_file.read(name) for name in names if name != "manifest.json"}
            if sum(len(payload) for payload in files.values()) > PIECE_PACKAGE_MAX_BYTES:
                raise PiecePackageError("Package exceeds the byte limit.")
    except PiecePackageError:
        raise
    except (OSError, KeyError, UnicodeDecodeError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        raise PiecePackageError("Package is not a readable ZIP archive.") from exc
    validate_piece_package(manifest, files)
    return {"manifest": manifest, "files": files}


def convert_legacy_json_package(value: Any) -> dict[str, Any]:
    """Convert the #512 base64 JSON package to the common in-memory shape."""

    if not isinstance(value, dict) or value.get("formatVersion") != 1:
        raise PiecePackageError("Unsupported legacy JSON package.")
    project = value.get("project")
    if not isinstance(project, dict) or not isinstance(project.get("title"), str):
        raise PiecePackageError("Legacy project is invalid.")
    scenes = value.get("scenes")
    assets = value.get("mediaAssets")
    if not isinstance(scenes, list) or not isinstance(assets, list):
        raise PiecePackageError("Legacy package is incomplete.")
    try:
        media = [
            {
                "filename": asset["filename"],
                "altText": asset["altText"],
                "mimeType": asset["mimeType"],
                "bytes": base64.b64decode(asset["dataBase64"], validate=True),
            }
            for asset in assets
        ]
    except (KeyError, TypeError, ValueError) as exc:
        raise PiecePackageError("Legacy media asset is invalid.") from exc
    return {
        "kind": "2d",
        "title": project["title"],
        "description": "",
        "appVersion": "legacy-512",
        "records": [{"schemaVersion": 1, "data": scene["sceneJson"]} for scene in scenes],
        "mediaAssets": media,
    }


def convert_legacy_archive(archive: bytes) -> dict[str, Any]:
    """Convert a one-project #526 archive to the common in-memory shape."""

    try:
        with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
            manifest = json.loads(zip_file.read("manifest.json").decode("utf-8"))
            if manifest.get("formatVersion") != 1 or len(manifest.get("projects", [])) != 1:
                raise PiecePackageError("Unsupported legacy archive.")
            project = manifest["projects"][0]
            prefix = f"projects/{project['index']}"
            records = [
                {
                    "schemaVersion": 1,
                    "data": json.loads(
                        zip_file.read(f"{prefix}/scenes/{scene['index']}.json").decode("utf-8")
                    ),
                }
                for scene in project["scenes"]
            ]
    except PiecePackageError:
        raise
    except (KeyError, OSError, UnicodeDecodeError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        raise PiecePackageError("Legacy archive is not readable.") from exc
    return {
        "kind": "2d",
        "title": project["title"],
        "description": "",
        "appVersion": "legacy-526",
        "records": records,
        "mediaAssets": [],
    }


def _safe_payload_path(path: str) -> bool:
    parts = path.split("/")
    return (
        len(parts) == 2
        and parts[0] == "files"
        and parts[1].rsplit(".", 1)[0].isdigit()
        and parts[1].endswith((".json", ".bin"))
    )
