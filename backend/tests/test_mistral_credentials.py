"""Security, migration, and rotation coverage for personal Mistral
credentials stored in the generic, owner-scoped `ProviderCredential` table
(issue #498). No assertion anywhere relies on plaintext key material
appearing in a response, log, migration output, or exception message."""

from io import StringIO

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, models
from django.db.models.query import QuerySet
from django.test import override_settings
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.credentials import encrypt_provider_key
from ai_provider.fake_provider import FakeAISceneProvider
from scenes.models import MistralCredentialDecryptionError, Project, ProviderCredential

LEGACY_URL = "/api/account/mistral-credential/"
GENERIC_URL = "/api/account/provider-credentials/"

PG = "postgres_test"

# The migration tests apply/unapply the real 0036 schema migration, which
# needs PostgreSQL DDL semantics and a database whose lifecycle the tests
# control; they follow the repo's `postgres_test` convention (see
# tests/_postgres_routing.py and test_account_deletion.py's PostgreSQL-only
# section) and skip themselves when POSTGRES_TEST_DATABASE_URL is unset.
pytestmark_postgres = pytest.mark.skipif(
    PG not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed migration tests.",
)


class LegacyMistralCredential(models.Model):
    """Unmanaged mirror of the legacy `scenes_mistralcredential` table that
    migration 0036 creates (on reverse) and drops (forward). Only used by
    the migration tests in this module -- never by application code."""

    user_id = models.IntegerField(db_column="user_id")
    encrypted_key = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "scenes_mistralcredential"
        app_label = "scenes"

    def __str__(self) -> str:
        return f"Legacy Mistral credential for user {self.user_id}"


def _migrate_to_before() -> None:
    call_command("migrate", "scenes", "0035_ai_run", verbosity=0, database=PG)


def _migrate_forward(capsys=None) -> str:
    call_command("migrate", "scenes", verbosity=0, database=PG)
    if capsys is not None:
        return capsys.readouterr().out
    return ""


def _pg_user(username: str, django_db_blocker):
    with django_db_blocker.unblock():
        return get_user_model().objects.db_manager(PG).create_user(username=username)


@pytest.fixture
def pg_owner(django_db_blocker):
    return _pg_user("credential-owner", django_db_blocker)


@pytest.fixture
def pg_other(django_db_blocker):
    return _pg_user("credential-other", django_db_blocker)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="credential-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="credential-other")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_client(other):
    client = APIClient()
    client.force_authenticate(other)
    return client


# --- Migration: legacy-only owner ----------------------------------------


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_forward_migration_moves_legacy_row_verbatim(pg_owner, capsys):
    legacy_ciphertext = encrypt_provider_key("sk-legacy-owner-key-1")
    _migrate_to_before()
    LegacyMistralCredential.objects.using(PG).create(
        user_id=pg_owner.id, encrypted_key=legacy_ciphertext
    )

    output = _migrate_forward(capsys)

    generic = ProviderCredential.objects.using(PG).get(owner=pg_owner, vendor="mistral")
    # The exact encrypted bytes moved across -- never decrypted, re-encrypted,
    # or exposed along the way.
    assert bytes(generic.encrypted_key) == legacy_ciphertext
    assert ProviderCredential.objects.using(PG).filter(vendor="mistral").count() == 1
    assert "Migrated 1 legacy Mistral credential" in output
    # No plaintext anywhere in the migration output.
    assert "sk-legacy-owner-key-1" not in output
    with pytest.raises(DatabaseError):
        # The legacy table is gone after the forward migration.
        LegacyMistralCredential.objects.using(PG).exists()


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_forward_migration_collision_generic_row_wins(pg_owner, capsys):
    # Migrate to the pre-0036 state first: unapplying the migration would
    # otherwise restore a legacy row for this owner from the generic row
    # created below.
    _migrate_to_before()
    generic_ciphertext = encrypt_provider_key("sk-generic-authoritative-key")
    ProviderCredential.objects.using(PG).create(
        owner=pg_owner, vendor="mistral", encrypted_key=generic_ciphertext
    )
    legacy_ciphertext = encrypt_provider_key("sk-legacy-superseded-key")
    LegacyMistralCredential.objects.using(PG).create(
        user_id=pg_owner.id, encrypted_key=legacy_ciphertext
    )

    output = _migrate_forward(capsys)

    # The pre-existing generic row is authoritative and untouched.
    generic = ProviderCredential.objects.using(PG).get(owner=pg_owner, vendor="mistral")
    assert bytes(generic.encrypted_key) == generic_ciphertext
    assert (
        ProviderCredential.objects.using(PG).filter(owner=pg_owner, vendor="mistral").count() == 1
    )
    assert "removed in favor of existing generic credentials" in output
    assert f"user {pg_owner.id}" in output
    # Disposition output is deterministic and secret-free.
    assert "sk-legacy-superseded-key" not in output
    assert "sk-generic-authoritative-key" not in output


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_reverse_migration_restores_legacy_table_and_rows(pg_owner, pg_other):
    owner_ct = encrypt_provider_key("sk-rollback-owner-key")
    other_ct = encrypt_provider_key("sk-rollback-other-key")
    _migrate_to_before()
    LegacyMistralCredential.objects.using(PG).create(user_id=pg_owner.id, encrypted_key=owner_ct)
    LegacyMistralCredential.objects.using(PG).create(user_id=pg_other.id, encrypted_key=other_ct)
    _migrate_forward()

    _migrate_to_before()

    restored = LegacyMistralCredential.objects.using(PG).get(user_id=pg_owner.id)
    assert bytes(restored.encrypted_key) == owner_ct
    assert (
        bytes(LegacyMistralCredential.objects.using(PG).get(user_id=pg_other.id).encrypted_key)
        == other_ct
    )

    # Leave the database in the session-setup state (0036 applied, legacy
    # table dropped): pytest-django's flush-based teardown cannot see the
    # recreated unmanaged legacy table, so it must not exist at teardown.
    _migrate_forward()


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_migration_replay_is_idempotent(pg_owner):
    owner_ct = encrypt_provider_key("sk-replay-owner-key")
    _migrate_to_before()
    LegacyMistralCredential.objects.using(PG).create(user_id=pg_owner.id, encrypted_key=owner_ct)
    _migrate_forward()

    # Replay: reverse then forward again -- the generic row must win the
    # collision deterministically and keep the same ciphertext.
    _migrate_to_before()
    _migrate_forward()

    generic = ProviderCredential.objects.using(PG).get(owner=pg_owner, vendor="mistral")
    assert bytes(generic.encrypted_key) == owner_ct
    assert (
        ProviderCredential.objects.using(PG).filter(owner=pg_owner, vendor="mistral").count() == 1
    )


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_migration_preserves_owner_isolation(pg_owner, pg_other):
    owner_ct = encrypt_provider_key("sk-isolated-owner-key")
    _migrate_to_before()
    LegacyMistralCredential.objects.using(PG).create(user_id=pg_owner.id, encrypted_key=owner_ct)
    _migrate_forward()

    # The migrated credential belongs to exactly its legacy owner: the other
    # owner has no generic Mistral row, and the row's ciphertext is the
    # verbatim legacy bytes (endpoint owner-scoping itself is covered by
    # test_provider_credentials.py's redaction/isolation tests).
    assert ProviderCredential.objects.using(PG).filter(vendor="mistral").count() == 1
    assert ProviderCredential.objects.using(PG).filter(owner=pg_other).exists() is False
    generic = ProviderCredential.objects.using(PG).get(owner=pg_owner, vendor="mistral")
    assert bytes(generic.encrypted_key) == owner_ct


# --- Legacy endpoint retirement ------------------------------------------


@pytest.mark.django_db
def test_legacy_credential_endpoint_is_retired(owner_client, owner):
    assert owner_client.get(LEGACY_URL).status_code == 404
    assert (
        owner_client.put(LEGACY_URL, {"key": "sk-should-not-persist"}, format="json").status_code
        == 404
    )
    assert owner_client.delete(LEGACY_URL).status_code == 404
    assert not ProviderCredential.objects.filter(owner=owner).exists()


# --- Generic endpoint redaction and isolation -----------------------------


@pytest.mark.django_db
def test_mistral_key_via_generic_endpoint_never_exposes_plaintext(owner_client, owner):
    key = "sk-personal-key-that-must-not-leak"
    assert owner_client.get(GENERIC_URL).json()["providers"][0] == {
        "vendor": "mistral",
        "label": "Mistral",
        "implemented": True,
        "configured": False,
    }

    response = owner_client.put(GENERIC_URL, {"vendor": "mistral", "key": key}, format="json")
    assert response.status_code == 200
    assert response.json() == {"vendor": "mistral", "configured": True}
    credential = ProviderCredential.objects.get(owner=owner, vendor="mistral")
    assert bytes(credential.encrypted_key) != key.encode()
    assert key.encode() not in bytes(credential.encrypted_key)
    assert key not in response.content.decode()
    status_response = owner_client.get(GENERIC_URL)
    mistral = next(
        item for item in status_response.json()["providers"] if item["vendor"] == "mistral"
    )
    assert mistral["configured"] is True
    assert key not in status_response.content.decode()


# --- Generation-path credential resolution --------------------------------


@pytest.mark.django_db
def test_missing_key_rejects_ai_before_provider_creation(owner_client, owner, monkeypatch):
    project = Project.objects.create(owner=owner)
    called = False

    class ShouldNotConstruct:
        def __init__(self, **kwargs):
            nonlocal called
            called = True

    monkeypatch.setattr(ai_api, "MistralSceneProvider", ShouldNotConstruct)
    response = owner_client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "draw teal circles"},
        format="json",
    )
    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert called is False


@pytest.mark.django_db
def test_owner_key_is_selected_for_real_provider(owner, monkeypatch):
    credential = ProviderCredential(owner=owner, vendor="mistral")
    credential.set_key("sk-owner-only-key-12345")
    credential.save()
    captured = {}

    class CapturingProvider:
        def __init__(self, *, api_key, model=None, persona_prompt=None):
            captured["api_key"] = api_key
            captured["model"] = model
            captured["persona_prompt"] = persona_prompt

    monkeypatch.setattr(ai_api, "MistralSceneProvider", CapturingProvider)
    ai_api._provider_for_user(owner)
    assert captured == {
        "api_key": "sk-owner-only-key-12345",
        "model": None,
        "persona_prompt": None,
    }


@pytest.mark.django_db
def test_caller_supplied_model_reaches_the_real_provider(owner, monkeypatch):
    """Issue #198: a caller-supplied model id, threaded through
    `_provider_for_user`'s second (optional) argument, replaces
    `MistralSceneProvider`'s own `DEFAULT_MODEL` fallback for this call
    only -- the same contextvar plumbing as `owner` above, so
    `get_ai_provider`'s zero-argument signature stays test-compatible."""
    credential = ProviderCredential(owner=owner, vendor="mistral")
    credential.set_key("sk-owner-only-key-12345")
    credential.save()
    captured = {}

    class CapturingProvider:
        def __init__(self, *, api_key, model=None, persona_prompt=None):
            captured["api_key"] = api_key
            captured["model"] = model
            captured["persona_prompt"] = persona_prompt

    monkeypatch.setattr(ai_api, "MistralSceneProvider", CapturingProvider)
    ai_api._provider_for_user(owner, "codestral-2405")
    assert captured == {
        "api_key": "sk-owner-only-key-12345",
        "model": "codestral-2405",
        "persona_prompt": None,
    }

    # A blank/falsy model means "use the provider's own default", not the
    # literal string -- confirmed by omission from `captured`'s expected
    # value above, and re-confirmed explicitly here for `""`.
    ai_api._provider_for_user(owner, "")
    assert captured["model"] is None

    # Issue #260: a persona's resolved prompt text reaches the provider the
    # same way `model` does.
    ai_api._provider_for_user(owner, "codestral-2405", "Be whimsical.")
    assert captured["persona_prompt"] == "Be whimsical."


@pytest.mark.django_db
def test_owner_isolation_for_provider_resolution(owner, other, monkeypatch):
    other_credential = ProviderCredential(owner=other, vendor="mistral")
    other_credential.set_key("sk-other-users-key-12345")
    other_credential.save()

    with pytest.raises(ai_api.MissingPersonalMistralCredential):
        ai_api._provider_for_user(owner)


@pytest.mark.django_db
def test_fake_provider_does_not_require_a_personal_key(owner, monkeypatch):
    monkeypatch.setattr(ai_api, "use_fake_ai_provider", lambda: True)
    monkeypatch.setattr(ai_api, "build_e2e_provider", lambda scenario: None, raising=False)
    provider = ai_api._provider_for_user(owner)
    assert isinstance(provider, FakeAISceneProvider) is False


# --- Rotation (reencrypt_provider_credentials) -----------------------------


@pytest.mark.django_db
def test_previous_rotation_key_can_be_reencrypted_to_primary(owner):
    old_key = "qIyk0jXwtVILr2fiNQ6ENyotYN6dCUh-22uIxi5-Uy0="
    active_key = "sQ4uXAFoZOPNskTNgoat6I_t0WBquxBEbcLaI1Cqf_Q="
    with override_settings(
        MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
        MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[old_key],
    ):
        credential = ProviderCredential(
            owner=owner,
            vendor="mistral",
            encrypted_key=encrypt_provider_key("sk-rotation-test-key"),
        )
        # Store ciphertext made with the old root, then use the key ring to
        # run the controlled command and re-encrypt it with the active root.
        with override_settings(
            MISTRAL_CREDENTIAL_ENCRYPTION_KEY=old_key,
            MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
        ):
            credential.encrypted_key = encrypt_provider_key("sk-rotation-test-key")
        credential.save()
        call_command("reencrypt_provider_credentials", stdout=StringIO())
        credential.refresh_from_db()

    with override_settings(
        MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
        MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
    ):
        assert credential.get_key() == "sk-rotation-test-key"


@pytest.mark.django_db
def test_rotation_decrypt_failure_leaves_ciphertext_unchanged(owner):
    undecryptable = b"not-a-valid-fernet-token"
    credential = ProviderCredential.objects.create(
        owner=owner, vendor="mistral", encrypted_key=undecryptable
    )
    output = StringIO()
    errout = StringIO()
    with pytest.raises(CommandError, match="could not be decrypted"):
        call_command("reencrypt_provider_credentials", stdout=output, stderr=errout)

    credential.refresh_from_db()
    assert bytes(credential.encrypted_key) == undecryptable
    # The controlled failure names the record, never the key material or
    # the underlying decryption exception detail.
    assert "Could not decrypt credential" in errout.getvalue()
    assert "not-a-valid-fernet-token" not in errout.getvalue()
    assert "not-a-valid-fernet-token" not in output.getvalue()


@pytest.mark.django_db
def test_rotation_skips_a_record_deleted_between_enumeration_and_lock(owner, other, monkeypatch):
    deleted = ProviderCredential(owner=owner, vendor="mistral")
    deleted.set_key("sk-key-being-deleted")
    deleted.save()
    retained = ProviderCredential(owner=other, vendor="mistral")
    retained.set_key("sk-key-that-stays")
    retained.save()
    original_get = QuerySet.get

    def get_with_deleted_row(self, *args, **kwargs):
        if kwargs.get("pk") == deleted.pk:
            raise ProviderCredential.DoesNotExist
        return original_get(self, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "get", get_with_deleted_row)
    output = StringIO()
    call_command("reencrypt_provider_credentials", stdout=output)

    assert "was deleted during rotation" in output.getvalue()
    retained.refresh_from_db()
    assert retained.get_key() == "sk-key-that-stays"


@pytest.mark.django_db
def test_decryption_error_is_controlled_and_secret_free(owner):
    credential = ProviderCredential.objects.create(
        owner=owner, vendor="mistral", encrypted_key=b"still-not-valid"
    )
    with pytest.raises(MistralCredentialDecryptionError) as excinfo:
        credential.get_key()
    # The exception carries a stable, actionable message -- never the
    # ciphertext, plaintext, or the underlying library error.
    assert "provider credential is unavailable" in str(excinfo.value)
    assert "still-not-valid" not in str(excinfo.value)
