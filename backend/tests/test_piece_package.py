import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest

from scenes.piece_package import (
    PiecePackageError,
    convert_legacy_archive,
    convert_legacy_json_package,
    parse_piece_package_archive,
    validate_piece_package,
)

PIECE_FIXTURES = Path(__file__).resolve().parents[2] / "schema" / "fixtures" / "piece-package"


def manifest_and_files() -> tuple[dict, dict[str, bytes]]:
    record = json.dumps(
        {
            "schemaVersion": 1,
            "id": "scene-blank",
            "canvas": {"width": 800, "height": 600, "backgroundColor": "#ffffff"},
            "renderer": {"preferred": "p5"},
            "layers": [
                {"id": "layer-1", "name": "Layer 1", "order": 0, "visible": True, "locked": False}
            ],
            "shapes": [],
            "groups": [],
            "bindings": [],
            "graph": {"nodes": [], "connections": []},
            "accessibility": {"reducedMotion": "auto"},
            "randomness": {"seed": 0, "enabled": False},
        }
    ).encode()
    checksum = hashlib.sha256(record).hexdigest()
    manifest = {
        "formatVersion": 1,
        "kind": "2d",
        "metadata": {
            "title": "Fixture",
            "description": "Portable package fixture.",
            "tags": [],
            "visibilityIntent": "private",
            "origin": {"appVersion": "test", "exportedAt": "2026-09-26T00:00:00Z"},
        },
        "records": [{"index": 0, "schemaVersion": 1, "fileIndex": 0}],
        "mediaAssets": [],
        "files": [
            {"index": 0, "path": "files/0.json", "byteSize": len(record), "sha256": checksum}
        ],
    }
    return manifest, {"files/0.json": record}


def archive(manifest: dict, files: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_STORED) as zip_file:
        zip_file.writestr("manifest.json", json.dumps(manifest))
        for path, payload in files.items():
            zip_file.writestr(path, payload)
    return output.getvalue()


def test_validates_and_parses_a_package_atomically() -> None:
    manifest, files = manifest_and_files()
    validate_piece_package(manifest, files)
    parsed = parse_piece_package_archive(archive(manifest, files))
    assert parsed["manifest"]["kind"] == "2d"
    assert parsed["files"]["files/0.json"] == files["files/0.json"]


def test_shared_valid_manifest_fixtures_match_the_backend_schema() -> None:
    for path in sorted(PIECE_FIXTURES.glob("valid-*.json")):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        validate_piece_package(manifest, {})


def test_rejects_checksum_mismatch() -> None:
    manifest, files = manifest_and_files()
    files["files/0.json"] = b"tampered"
    with pytest.raises(PiecePackageError, match="byte size|checksum"):
        validate_piece_package(manifest, files)


def test_rejects_path_traversal() -> None:
    manifest, files = manifest_and_files()
    manifest["files"][0]["path"] = "files/../escape.bin"
    with pytest.raises(PiecePackageError, match="Invalid package manifest|unsafe path"):
        parse_piece_package_archive(archive(manifest, files))


def test_converts_legacy_json_package() -> None:
    package = convert_legacy_json_package(
        {
            "formatVersion": 1,
            "project": {"title": "Legacy"},
            "scenes": [{"sceneJson": {"schemaVersion": 1, "shapes": []}}],
            "mediaAssets": [
                {
                    "filename": "x.bin",
                    "altText": "",
                    "mimeType": "application/octet-stream",
                    "dataBase64": "AQ==",
                }
            ],
        }
    )
    assert package["title"] == "Legacy"
    assert package["mediaAssets"][0]["bytes"] == b"\x01"


def test_converts_legacy_archive() -> None:
    manifest = {
        "formatVersion": 1,
        "projects": [{"index": 0, "title": "Legacy archive", "scenes": [{"index": 0}]}],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_STORED) as zip_file:
        zip_file.writestr("manifest.json", json.dumps(manifest))
        zip_file.writestr(
            "projects/0/scenes/0.json", json.dumps({"schemaVersion": 1, "shapes": []})
        )
    package = convert_legacy_archive(output.getvalue())
    assert package["title"] == "Legacy archive"
    assert package["records"][0]["data"]["schemaVersion"] == 1
