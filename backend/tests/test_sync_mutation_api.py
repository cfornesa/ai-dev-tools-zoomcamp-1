"""Focused authenticated mutation acknowledgement coverage for #543."""

import hashlib
import json
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, SyncMutationReceipt


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="sync-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="sync-other")


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner, title="Sync project")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def _payload_checksum(payload):
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _operation(payload=None, *, sequence=1, operation_id=None):
    payload = payload or {"scene_id": "scene-1", "name": "Updated"}
    return {
        "project_id": "will-be-replaced",
        "operation_id": str(operation_id or uuid.uuid4()),
        "client_sequence": sequence,
        "kind": "scene",
        "payload": payload,
        "payload_checksum": _payload_checksum(payload),
        "schema_version": 1,
        "dependency_operation_ids": [],
        "client_created_at": "2026-09-15T19:30:00Z",
    }


def _url(project):
    return f"/api/projects/{project.public_id}/sync/mutations/"


@pytest.mark.django_db
def test_owner_receives_same_acknowledgement_for_an_identical_replay(owner_client, project):
    payload = _operation()
    payload["project_id"] = str(project.public_id)

    first = owner_client.post(_url(project), payload, format="json")
    replay = owner_client.post(_url(project), payload, format="json")

    assert first.status_code == 201
    assert replay.status_code == 200
    assert first.json()["acknowledged"] is True
    assert replay.json()["replayed"] is True
    assert replay.json()["server_operation_id"] == first.json()["server_operation_id"]
    assert SyncMutationReceipt.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_reusing_operation_id_with_different_payload_is_a_conflict(owner_client, project):
    operation_id = uuid.uuid4()
    first_payload = _operation({"value": 1}, operation_id=operation_id)
    first_payload["project_id"] = str(project.public_id)
    assert owner_client.post(_url(project), first_payload, format="json").status_code == 201

    conflicting = _operation({"value": 2}, operation_id=operation_id)
    conflicting["project_id"] = str(project.public_id)
    response = owner_client.post(_url(project), conflicting, format="json")

    assert response.status_code == 409
    assert response.json() == {"error": "operation_id_conflict"}
    assert SyncMutationReceipt.objects.count() == 1


@pytest.mark.django_db
def test_client_sequence_is_unique_per_owner_project(owner_client, project):
    first = _operation({"value": 1}, sequence=3)
    first["project_id"] = str(project.public_id)
    assert owner_client.post(_url(project), first, format="json").status_code == 201
    second = _operation({"value": 2}, sequence=3)
    second["project_id"] = str(project.public_id)

    response = owner_client.post(_url(project), second, format="json")

    assert response.status_code == 409
    assert response.json() == {"error": "client_sequence_conflict"}


@pytest.mark.django_db
def test_anonymous_and_non_owner_cannot_discover_receipts(project, other):
    operation = _operation()
    operation["project_id"] = str(project.public_id)
    assert APIClient().post(_url(project), operation, format="json").status_code == 401
    other_client = APIClient()
    other_client.force_authenticate(other)
    assert other_client.post(_url(project), operation, format="json").status_code == 404
    assert not SyncMutationReceipt.objects.exists()


@pytest.mark.django_db
def test_checksum_mismatch_is_rejected_before_persistence(owner_client, project):
    operation = _operation()
    operation["project_id"] = str(project.public_id)
    operation["payload_checksum"] = "0" * 64

    response = owner_client.post(_url(project), operation, format="json")

    assert response.status_code == 409
    assert response.json() == {"error": "payload_checksum_mismatch"}
    assert not SyncMutationReceipt.objects.exists()
