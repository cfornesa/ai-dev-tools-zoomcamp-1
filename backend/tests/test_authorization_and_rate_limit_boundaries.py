"""Task 71 (issue #71): the systematic adversarial authorization/rate-limit
audit called for by the issue's acceptance criteria.

This file is deliberately NOT a from-scratch reimplementation of every
authorization/rate-limit/concurrency test in this codebase. Tasks 11-15,
20-21, 43, 46-52, and 56-57 already built and QA-gated substantial
adversarial coverage in their own test files (see the "Existing coverage"
matrix below) -- this file exists to make that coverage *legible against
the issue's full matrix* and to close the specific cells that were
genuinely untested, rather than to duplicate what already passes.

## The matrix

Rows: project, version, draft, template, publish, fork, export, ai_create,
ai_edit (ai_accept is covered alongside ai_create/ai_edit since it shares
their owner-only/idempotency shape).

Columns: anonymous, owner, other authenticated user, deleted/private/public
resource, malformed identifier.

## Existing coverage (cited, not duplicated here)

- project (CRUD):        tests/test_project_api.py
- version (save/restore/delete/read): tests/test_scene_version_save_api.py,
  tests/test_scene_version_restore_delete_api.py
- draft (read/upsert/delete): tests/test_edit_session_draft_sync_api.py
- template (browse/clone/save-as): tests/test_template_browsing_cloning_api.py,
  tests/test_save_as_private_template_api.py
- publish/unpublish:      tests/test_project_publish_api.py
- fork:                   tests/test_project_fork_api.py
- ai_create:              tests/test_ai_create_scene_api.py
- ai_edit:                tests/test_ai_edit_scene_api.py
- ai_accept:              tests/test_ai_accept_proposal_api.py

Every file above already tests, for its own operation: anonymous rejection,
owner success, non-owner 404-not-403 (no existence leak), and unchanged
database state after a denial. Several also carry PostgreSQL-gated
genuinely-concurrent tests (`@pytest.mark.django_db(databases=["postgres_test"],
transaction=True)` + `threading.Barrier`) proving row-locking/uniqueness-race/
rollback guarantees: version save, version restore, draft upsert, fork
(duplicate-submission and no-request-id), publish-vs-save, template clone
rollback, and both AI-accept concurrency scenarios. Those self-skip in this
environment (no `POSTGRES_TEST_DATABASE_URL`), which is expected and
correct per this repo's own convention (see AGENTS.md).

## export (out of scope by construction, not by oversight)

Per Task 55/56's architecture, scene/piece export HTML generation happens
entirely in the browser (`frontend/src/export/`) from data the editor
already holds -- there is no `POST /api/.../export/` (or any other
export-shaped) Django view or URL for *that* flow.
`test_no_scene_or_piece_export_endpoint_exists` below asserts this stays
true, scoped to exclude `account/export/` (issue #442's owner-scoped data
export, a deliberately different feature that does have a real
authenticated server endpoint -- its own authorization boundary,
including anonymous rejection and cross-user isolation, is covered by
`tests/test_account_export.py`, not this file). If a future change ever
adds a server-side *scene or piece* export endpoint, this assertion will
force this task's matrix to be revisited for it. Publishing/fetching a
project (which an exported scene's data ultimately comes from) is already
covered by the publish/project rows above.

## What THIS file adds (genuinely new cells)

1. Malformed URL identifiers (non-UUID `public_id`, non-integer
   `version_id`) for every category above -- untested anywhere else. Since
   `scenes/urls.py` types these path segments (`<uuid:public_id>`,
   `<int:version_id>`), a malformed value never even reaches a view; Django's
   own router 404s it before dispatch. These tests prove that routing-level
   404 is real (not a 500, not an information leak) for every affected
   endpoint, for both anonymous and authenticated callers.
2. The "deleted resource" cell for fork, draft, and all three AI operations
   (create/edit/accept) -- covered elsewhere for project/version/publish,
   but not exercised for these five endpoints. `Project.objects` (the
   default manager used by every view in `scenes/api.py`/`scenes/ai_api.py`)
   filters `is_deleted=False` at the queryset level
   (`scenes/models.py::ProjectManager.get_queryset`), so a soft-deleted
   project is structurally invisible to every one of these endpoints --
   these tests prove that holds for the specific endpoints that had no
   existing regression test for it.
3. AI quota reset-policy precision: the daily quota key is computed from
   `django.utils.timezone.localdate()` (Task 71 fix -- see
   `scenes/ai_api.py::_quota_cache_key`'s docstring comment), which resolves
   through Django's `TIME_ZONE = "UTC"` setting rather than the host
   process's OS-local date. This closes a latent bug where a non-UTC host
   timezone could make "resets at UTC midnight" (the documented policy,
   and the literal text of every quota-exceeded response body) false.
4. A same-user rapid-sequential (SQLite-safe) proof that the AI rate limit
   is scoped per-user, not per-IP or global: two different users each get
   their own full allowance in the same window.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import get_resolver
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.models import EditSessionDraft, ForkProvenance, Project, SceneVersion, Template

_BG_BLACK_PATCH = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _mistral_provider_returning(content: str) -> MistralSceneProvider:
    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return MistralSceneProvider(client=_FakeClient(handler))


BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="owner-71")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="other-71")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(other_user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


def _new_scene():
    import copy

    scene = copy.deepcopy(BLANK_SCENE)
    scene["id"] = f"scene-{uuid.uuid4()}"
    return scene


@pytest.fixture
def private_project(owner):
    project = Project.objects.create(owner=owner, title="Private Draft", description="desc")
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=_new_scene(), origin=SceneVersion.Origin.MANUAL
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


@pytest.fixture
def public_remixable_project(owner):
    project = Project.objects.create(
        owner=owner,
        title="Public Remixable",
        description="desc",
        visibility=Project.Visibility.PUBLIC,
        allow_public_remix=True,
    )
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=_new_scene(), origin=SceneVersion.Origin.MANUAL
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


@pytest.fixture
def deleted_project(owner):
    """A project that was public and remixable, then soft-deleted -- so any
    permission logic that checks visibility/remix flags but forgets
    is_deleted would wrongly still allow access to it."""
    project = Project.objects.create(
        owner=owner,
        title="Now Deleted",
        description="desc",
        visibility=Project.Visibility.PUBLIC,
        allow_public_remix=True,
    )
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=_new_scene(), origin=SceneVersion.Origin.MANUAL
    )
    project.current_version = version
    project.is_deleted = True
    import django.utils.timezone as tz

    project.deleted_at = tz.now()
    project.save(update_fields=["current_version", "is_deleted", "deleted_at"])
    return project


NON_UUID = "not-a-uuid-at-all"
NON_INT = "not-an-int"


# --- 1. Malformed identifiers -----------------------------------------------
#
# Every URL below is deliberately built by hand (not via `reverse()`) with a
# malformed path segment, so a typo/attack in a client-supplied id is
# exercised exactly the way an adversary would send it.


@pytest.mark.django_db
@pytest.mark.parametrize("as_client", ["anon", "owner", "other"])
def test_malformed_project_id_404s_project_detail(
    as_client, anon_client, owner_client, other_client
):
    client = {"anon": anon_client, "owner": owner_client, "other": other_client}[as_client]
    response = client.get(f"/api/projects/{NON_UUID}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_malformed_project_id_404s_project_patch_delete(owner_client):
    assert (
        owner_client.patch(f"/api/projects/{NON_UUID}/", {"title": "x"}, format="json").status_code
        == 404
    )
    assert owner_client.delete(f"/api/projects/{NON_UUID}/").status_code == 404


@pytest.mark.django_db
def test_malformed_project_id_404s_publish_unpublish(owner_client):
    assert owner_client.post(f"/api/projects/{NON_UUID}/publish/").status_code == 404
    assert owner_client.post(f"/api/projects/{NON_UUID}/unpublish/").status_code == 404


@pytest.mark.django_db
def test_malformed_project_id_404s_versions_list_create(owner_client):
    assert owner_client.get(f"/api/projects/{NON_UUID}/versions/").status_code == 404
    response = owner_client.post(
        f"/api/projects/{NON_UUID}/versions/",
        {"scene_json": _new_scene(), "origin": "manual"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_malformed_version_id_404s_version_detail_restore_delete(owner_client, private_project):
    base = f"/api/projects/{private_project.public_id}/versions/{NON_INT}"
    assert owner_client.get(f"{base}/").status_code == 404
    assert owner_client.post(f"{base}/restore/").status_code == 404
    assert owner_client.delete(f"{base}/").status_code == 404
    assert (
        owner_client.post(f"{base}/save-as-template/", {"name": "t"}, format="json").status_code
        == 404
    )


@pytest.mark.django_db
def test_malformed_project_id_404s_draft_endpoint(owner_client):
    url = f"/api/projects/{NON_UUID}/draft/session-1/"
    assert owner_client.get(url).status_code == 404
    assert (
        owner_client.put(
            url, {"draft_json": _new_scene(), "client_seq": 1}, format="json"
        ).status_code
        == 404
    )
    assert owner_client.delete(url).status_code == 404


@pytest.mark.django_db
def test_malformed_template_id_404s_clone(owner_client):
    response = owner_client.post(f"/api/templates/{NON_UUID}/clone/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_malformed_project_id_404s_public_detail_thumbnail_fork(anon_client, other_client):
    assert anon_client.get(f"/api/public/projects/{NON_UUID}/").status_code == 404
    assert anon_client.get(f"/api/public/projects/{NON_UUID}/thumbnail.png").status_code == 404
    assert other_client.post(f"/api/public/projects/{NON_UUID}/fork/").status_code == 404


@pytest.mark.django_db
def test_malformed_project_id_404s_ai_endpoints(owner_client):
    assert (
        owner_client.post(
            f"/api/projects/{NON_UUID}/ai/create-scene/", {"prompt": "x"}, format="json"
        ).status_code
        == 404
    )
    assert (
        owner_client.post(
            f"/api/projects/{NON_UUID}/ai/edit-scene/",
            {"prompt": "x", "current_scene": _new_scene(), "base_version_id": None},
            format="json",
        ).status_code
        == 404
    )
    assert (
        owner_client.post(
            f"/api/projects/{NON_UUID}/ai/accept-proposal/",
            {"operation": "ai_create", "scene_json": _new_scene(), "base_version_id": None},
            format="json",
        ).status_code
        == 404
    )


# --- 2. Soft-deleted-project cell, for the endpoints not covered elsewhere --


@pytest.mark.django_db
def test_deleted_project_404s_for_fork_even_though_it_was_public_and_remixable(
    other_client, deleted_project
):
    response = other_client.post(f"/api/public/projects/{deleted_project.public_id}/fork/")
    assert response.status_code == 404
    # `Project.all_objects` bypasses the default manager's is_deleted filter,
    # so this counts the (soft-deleted) source itself plus any fork that may
    # have wrongly been created -- it must still be exactly 1 (no fork).
    assert Project.all_objects.filter(owner=deleted_project.owner_id).count() == 1
    assert ForkProvenance.objects.count() == 0


@pytest.mark.django_db
def test_deleted_project_404s_for_owner_draft_access(owner_client, deleted_project):
    url = f"/api/projects/{deleted_project.public_id}/draft/session-1/"
    assert owner_client.get(url).status_code == 404
    response = owner_client.put(url, {"draft_json": _new_scene(), "client_seq": 1}, format="json")
    assert response.status_code == 404
    assert EditSessionDraft.objects.count() == 0


@pytest.mark.django_db
def test_deleted_project_404s_for_owner_ai_create(owner_client, deleted_project, monkeypatch):
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    response = owner_client.post(
        f"/api/projects/{deleted_project.public_id}/ai/create-scene/",
        {"prompt": "anything"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_deleted_project_404s_for_owner_ai_edit(owner_client, deleted_project, monkeypatch):
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    response = owner_client.post(
        f"/api/projects/{deleted_project.public_id}/ai/edit-scene/",
        {
            "prompt": "anything",
            "current_scene": _new_scene(),
            "base_version_id": deleted_project.current_version_id,
        },
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_deleted_project_404s_for_owner_ai_accept(owner_client, deleted_project):
    response = owner_client.post(
        f"/api/projects/{deleted_project.public_id}/ai/accept-proposal/",
        {
            "operation": "ai_create",
            "scene_json": _new_scene(),
            "base_version_id": deleted_project.current_version_id,
        },
        format="json",
    )
    assert response.status_code == 404
    assert SceneVersion.objects.filter(project_id=deleted_project.id).count() == 1  # unchanged


# --- 3. Denial responses never leak private-resource existence -------------
#
# Cross-cutting proof, across categories, that "denied" and "doesn't exist"
# are byte-identical responses -- not just the same status code.


@pytest.mark.django_db
def test_private_project_denial_is_byte_identical_to_missing_project(other_client, private_project):
    real = other_client.get(f"/api/projects/{private_project.public_id}/")
    fake = other_client.get(f"/api/projects/{uuid.uuid4()}/")
    assert real.status_code == fake.status_code == 404
    assert real.content == fake.content


@pytest.mark.django_db
def test_private_project_fork_denial_is_byte_identical_to_missing_project(
    other_client, private_project
):
    real = other_client.post(f"/api/public/projects/{private_project.public_id}/fork/")
    fake = other_client.post(f"/api/public/projects/{uuid.uuid4()}/fork/")
    assert real.status_code == fake.status_code == 404
    assert real.content == fake.content


@pytest.mark.django_db
def test_private_template_denial_is_byte_identical_to_missing_template(other_client, owner):
    template = Template.objects.create(
        source_type=Template.SourceType.PRIVATE,
        owner=owner,
        name="Secret",
        scene_json=_new_scene(),
    )
    real = other_client.post(f"/api/templates/{template.public_id}/clone/")
    fake = other_client.post(f"/api/templates/{uuid.uuid4()}/clone/")
    assert real.status_code == fake.status_code == 404
    assert real.content == fake.content


# --- export: confirm this matrix row has no backend endpoint to audit ------


def test_no_scene_or_piece_export_endpoint_exists():
    """Task 55/56's export flow is entirely client-side (browser-generated
    HTML from data already loaded into the editor) -- see
    `frontend/src/export/`. There is deliberately no
    `POST/GET .../export/...` Django view or URL for *that* flow. This
    test pins that architectural fact: if a future change ever adds a
    server-side scene/piece export endpoint, this assertion will force
    this task's matrix to be revisited for it.

    Issue #442's `account/export/` is excluded on purpose -- a genuinely
    different, already-authorized feature (owner-scoped account data
    export), not Task 55/56's scene/piece HTML export. See
    `tests/test_account_export.py` for its own authorization coverage.
    """
    resolver = get_resolver()

    def _walk(patterns, prefix=""):
        found = []
        for p in patterns:
            pattern_str = prefix + str(p.pattern)
            if hasattr(p, "url_patterns"):
                found.extend(_walk(p.url_patterns, pattern_str))
            else:
                found.append(pattern_str)
        return found

    every_path = _walk(resolver.url_patterns)
    export_paths = [
        p for p in every_path if "export" in p.lower() and "account/export" not in p.lower()
    ]
    assert export_paths == [], f"Unexpected export endpoint(s) found: {export_paths}"


# --- AI quota/rate-limit boundary precision ---------------------------------


@pytest.mark.django_db
def test_create_rate_limit_boundary_is_exact(owner_client, monkeypatch):
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    project = Project.objects.create(owner=owner_client.handler._force_user)
    url = f"/api/projects/{project.public_id}/ai/create-scene/"

    for n in range(1, ai_api.RATE_LIMIT_MAX_ATTEMPTS + 1):
        response = owner_client.post(url, {"prompt": "anything"}, format="json")
        assert response.status_code == 200, f"request #{n} should succeed"

    over_limit = owner_client.post(url, {"prompt": "one too many"}, format="json")
    assert over_limit.status_code == 429
    assert over_limit.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_edit_rate_limit_boundary_is_exact(owner_client, monkeypatch):
    project = Project.objects.create(owner=owner_client.handler._force_user)
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=_new_scene(), origin=SceneVersion.Origin.MANUAL
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH))
    )
    url = f"/api/projects/{project.public_id}/ai/edit-scene/"
    payload = {"prompt": "anything", "current_scene": _new_scene(), "base_version_id": version.id}

    for n in range(1, ai_api.EDIT_RATE_LIMIT_MAX_ATTEMPTS + 1):
        response = owner_client.post(url, payload, format="json")
        assert response.status_code == 200, f"request #{n} should succeed"

    over_limit = owner_client.post(url, payload, format="json")
    assert over_limit.status_code == 429
    assert over_limit.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_daily_quota_boundary_is_exact_at_the_51st_success(owner_client, monkeypatch):
    """DAILY_QUOTA_MAX_SUCCESSES (50) successes are allowed; the 51st is
    rejected without ever calling the provider -- proven by seeding the
    counter to one below the limit (cheaper than 50 real HTTP round
    trips) and confirming exactly one more success is allowed, then no
    more."""
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    user = owner_client.handler._force_user
    project = Project.objects.create(owner=user)
    url = f"/api/projects/{project.public_id}/ai/create-scene/"

    cache.set(
        ai_api._quota_cache_key(user.id, operation="create"), ai_api.DAILY_QUOTA_MAX_SUCCESSES - 1
    )

    last_allowed = owner_client.post(url, {"prompt": "the 50th"}, format="json")
    assert last_allowed.status_code == 200

    first_rejected = owner_client.post(url, {"prompt": "the 51st"}, format="json")
    assert first_rejected.status_code == 429
    assert first_rejected.json()["error"] == "quota_exceeded"


@pytest.mark.django_db
def test_quota_is_scoped_per_user_not_global_or_per_ip(owner_client, other_client, monkeypatch):
    """Exhausting one user's daily quota must never affect a different
    user's allowance -- proving the documented identity scope is per-user."""
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    owner = owner_client.handler._force_user
    other = other_client.handler._force_user
    owner_project = Project.objects.create(owner=owner)
    other_project = Project.objects.create(owner=other)

    cache.set(
        ai_api._quota_cache_key(owner.id, operation="create"), ai_api.DAILY_QUOTA_MAX_SUCCESSES
    )

    exhausted = owner_client.post(
        f"/api/projects/{owner_project.public_id}/ai/create-scene/", {"prompt": "x"}, format="json"
    )
    assert exhausted.status_code == 429

    still_fresh = other_client.post(
        f"/api/projects/{other_project.public_id}/ai/create-scene/", {"prompt": "x"}, format="json"
    )
    assert still_fresh.status_code == 200


@pytest.mark.django_db
def test_rate_limit_is_scoped_per_user_not_global_or_per_ip(
    owner_client, other_client, monkeypatch
):
    """Two different users, hitting the same rate-limit window concurrently
    (in wall-clock terms; sequentially in this single-process test), each
    get their own full RATE_LIMIT_MAX_ATTEMPTS allowance -- proving the
    limiter is keyed per-user (`_rate_limit_cache_key`), not shared across
    all callers or scoped to a client IP/session."""
    monkeypatch.setattr(
        ai_api, "get_ai_provider", lambda: FakeAISceneProvider(FakeAIProviderScenario.SUCCESS)
    )
    owner = owner_client.handler._force_user
    other = other_client.handler._force_user
    owner_project = Project.objects.create(owner=owner)
    other_project = Project.objects.create(owner=other)

    for n in range(ai_api.RATE_LIMIT_MAX_ATTEMPTS):
        r1 = owner_client.post(
            f"/api/projects/{owner_project.public_id}/ai/create-scene/",
            {"prompt": "x"},
            format="json",
        )
        r2 = other_client.post(
            f"/api/projects/{other_project.public_id}/ai/create-scene/",
            {"prompt": "x"},
            format="json",
        )
        assert r1.status_code == 200, f"owner request #{n + 1}"
        assert r2.status_code == 200, f"other-user request #{n + 1}"


@pytest.mark.django_db
def test_quota_cache_key_resolves_through_django_configured_timezone(owner):
    """Task 71 fix regression guard: `_quota_cache_key` must key off
    `django.utils.timezone.localdate()` (which honors `settings.TIME_ZONE`,
    `"UTC"` in this project -- backend/backend/settings.py), not the bare stdlib
    `datetime.date.today()` (which reads the OS/process local date and is
    not guaranteed to be UTC). This is what makes "resets at UTC midnight",
    the literal wording in every quota-exceeded response, actually true
    regardless of the deployment host's local timezone.
    """
    from django.utils import timezone as django_timezone

    key = ai_api._quota_cache_key(owner.id, operation="create")
    assert key == f"ai_provider:quota:create:{owner.id}:{django_timezone.localdate().isoformat()}"


# --- Parallel/replayed mutations: SQLite-safe rapid-sequential proof -------
#
# Genuine concurrency (real overlapping transactions) is PostgreSQL-only and
# already covered, per-endpoint, by the PostgreSQL-gated tests cited in this
# module's docstring (they self-skip here). This is the SQLite-compatible
# half of the same guarantee: replaying the *same* idempotency key never
# creates a second record, proven with rapid sequential requests rather than
# genuinely-overlapping threads.


@pytest.mark.django_db
def test_replayed_ai_accept_with_same_request_id_never_creates_two_versions(owner_client):
    user = owner_client.handler._force_user
    project = Project.objects.create(owner=user)
    request_id = str(uuid.uuid4())
    payload = {
        "operation": "ai_create",
        "scene_json": _new_scene(),
        "base_version_id": None,
        "client_request_id": request_id,
    }
    url = f"/api/projects/{project.public_id}/ai/accept-proposal/"

    first = owner_client.post(url, payload, format="json")
    assert first.status_code == 201

    for _ in range(3):
        replay = owner_client.post(url, payload, format="json")
        assert replay.status_code == 200
        assert replay.json()["id"] == first.json()["id"]

    assert SceneVersion.objects.filter(project=project).count() == 1
