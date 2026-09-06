"""Tests for owner-initiated account deletion (issue #443).

`AccountDeletionView` is session-authenticated (not DRF token auth), so
every test drives it through Django's own test `Client`/`force_login`,
matching `test_account_sessions.py`/`test_account_export.py`'s own
convention -- this is what lets `force_login`'s real `user_logged_in`
signal populate `SessionMetadata` exactly like a real login would.
"""

from __future__ import annotations

import threading

import pytest
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.management import call_command
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from scenes import account_deletion
from scenes.models import (
    ArtPiece,
    BillingEvent,
    MistralCredential,
    Project,
    Project3D,
    ProviderCredential,
    SessionMetadata,
    Subscription,
)
from tests._postgres_routing import close_thread_connections, route_default_to_postgres_test


def _make_user(username, password="correct-horse-battery-staple"):
    return get_user_model().objects.create_user(username=username, password=password)


@pytest.mark.django_db
def test_requires_authentication():
    response = Client().post(reverse("account-delete"), {"confirmation": "DELETE"})
    assert response.status_code == 401


@pytest.mark.django_db
def test_wrong_password_is_rejected_and_account_is_untouched():
    user = _make_user("owner")
    client = Client()
    client.force_login(user)

    response = client.post(
        reverse("account-delete"), {"password": "wrong", "confirmation": "DELETE"}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "reauthentication_required"
    user.refresh_from_db()
    assert user.is_active is True


@pytest.mark.django_db
def test_missing_password_for_a_password_account_is_rejected():
    user = _make_user("owner")
    client = Client()
    client.force_login(user)

    response = client.post(reverse("account-delete"), {"confirmation": "DELETE"})

    assert response.status_code == 400
    assert response.json()["error"] == "reauthentication_required"


@pytest.mark.django_db
def test_wrong_confirmation_text_is_rejected_and_account_is_untouched():
    user = _make_user("owner")
    client = Client()
    client.force_login(user)

    response = client.post(
        reverse("account-delete"),
        {"password": "correct-horse-battery-staple", "confirmation": "delete my stuff"},
    )

    assert response.status_code == 400
    assert response.json()["error"] == "confirmation_mismatch"
    user.refresh_from_db()
    assert user.is_active is True


@pytest.mark.django_db
def test_oauth_only_account_needs_no_password_but_still_needs_confirmation():
    user = get_user_model().objects.create_user(username="oauth-owner")
    user.set_unusable_password()
    user.save()
    client = Client()
    client.force_login(user)

    missing_confirmation = client.post(reverse("account-delete"), {"confirmation": "nope"})
    assert missing_confirmation.status_code == 400
    assert missing_confirmation.json()["error"] == "confirmation_mismatch"

    response = client.post(reverse("account-delete"), {"confirmation": "DELETE"})
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.is_active is False


@pytest.mark.django_db
def test_full_deletion_soft_deletes_content_erases_credentials_and_anonymizes_user():
    user = _make_user("owner")
    project = Project.objects.create(owner=user, title="My animation")
    project3d = Project3D.objects.create(owner=user)
    piece = ArtPiece.objects.create(owner=user, engine=ArtPiece.Engine.CANVAS2D, prompt="a circle")
    SocialAccount.objects.create(user=user, provider="github", uid="12345")
    EmailAddress.objects.create(user=user, email="owner@example.test", verified=True, primary=True)
    MistralCredential.objects.create(user=user, encrypted_key=b"not-a-real-key")
    ProviderCredential.objects.create(owner=user, vendor="gemini", encrypted_key=b"also-not-real")

    client = Client()
    client.force_login(user)
    session_key = client.session.session_key
    assert SessionMetadata.objects.filter(user=user, session_key=session_key).exists()

    response = client.post(
        reverse("account-delete"),
        {"password": "correct-horse-battery-staple", "confirmation": "delete"},
    )

    assert response.status_code == 204

    project.refresh_from_db()
    project3d.refresh_from_db()
    piece.refresh_from_db()
    assert project.is_deleted is True and project.deleted_at is not None
    assert project3d.is_deleted is True and project3d.deleted_at is not None
    assert piece.is_deleted is True and piece.deleted_at is not None
    assert not Project.objects.filter(pk=project.pk).exists()  # hidden by the default manager

    assert not SocialAccount.objects.filter(user=user).exists()
    assert not EmailAddress.objects.filter(user=user).exists()
    # allauth's own EmailAddress.email is globally unique -- a real
    # signup later verifying the exact same address (e.g. a different
    # person, or the original person creating a brand-new account) must
    # not be blocked by a stale row this deletion left behind.
    another_user = get_user_model().objects.create_user(username="new-owner")
    EmailAddress.objects.create(
        user=another_user, email="owner@example.test", verified=True, primary=True
    )
    assert not MistralCredential.objects.filter(user=user).exists()
    assert not ProviderCredential.objects.filter(owner=user).exists()
    assert not Session.objects.filter(session_key=session_key).exists()
    assert not SessionMetadata.objects.filter(user=user).exists()

    user.refresh_from_db()
    assert user.is_active is False
    assert user.email != ""
    assert user.email.endswith("@deleted.invalid")
    assert user.username != "owner"
    assert user.first_name == "" and user.last_name == ""
    assert not user.check_password("correct-horse-battery-staple")

    # The response's own session cookie is now logged out -- a retried
    # request against it fails closed as unauthenticated, not as a second
    # deletion attempt.
    retry = client.post(reverse("account-delete"), {"confirmation": "DELETE"})
    assert retry.status_code == 401


@pytest.mark.django_db
def test_active_subscription_is_cancelled_at_period_end_not_immediately():
    user = _make_user("owner")
    paid_through = timezone.now().date()
    subscription = Subscription.objects.create(
        user=user,
        paypal_subscription_id="I-REALSUBID123",
        plan_key="pro",
        status=Subscription.Status.ACTIVE,
        paid_through=paid_through,
    )
    client = Client()
    client.force_login(user)

    response = client.post(
        reverse("account-delete"),
        {"password": "correct-horse-battery-staple", "confirmation": "DELETE"},
    )

    assert response.status_code == 204
    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.CANCELLED
    # Paid access is preserved through the already-paid period -- deletion
    # does not revoke it early.
    assert subscription.paid_through == paid_through
    event = BillingEvent.objects.get(subscription=subscription)
    assert event.event_type == "ACCOUNT.DELETION.CANCELLATION"
    assert event.outcome == BillingEvent.Outcome.APPLIED


@pytest.mark.django_db
def test_cancelled_or_absent_subscription_is_left_alone():
    user = _make_user("owner")
    subscription = Subscription.objects.create(
        user=user,
        paypal_subscription_id="I-ALREADYCANCELLED",
        plan_key="pro",
        status=Subscription.Status.CANCELLED,
    )
    client = Client()
    client.force_login(user)

    response = client.post(
        reverse("account-delete"),
        {"password": "correct-horse-battery-staple", "confirmation": "DELETE"},
    )

    assert response.status_code == 204
    assert not BillingEvent.objects.filter(subscription=subscription).exists()


@pytest.mark.django_db
def test_deleting_one_account_never_affects_another_users_data():
    owner = _make_user("owner")
    other = _make_user("other")
    other_project = Project.objects.create(owner=other, title="Untouched")

    client = Client()
    client.force_login(owner)
    response = client.post(
        reverse("account-delete"),
        {"password": "correct-horse-battery-staple", "confirmation": "DELETE"},
    )

    assert response.status_code == 204
    other_project.refresh_from_db()
    assert other_project.is_deleted is False
    other.refresh_from_db()
    assert other.is_active is True
    assert other.username == "other"


@pytest.mark.django_db
def test_a_second_request_after_deletion_is_reported_as_already_deleted():
    user = _make_user("owner")
    account_deletion.delete_account(
        user, password="correct-horse-battery-staple", confirmation="DELETE"
    )

    with pytest.raises(account_deletion.AccountAlreadyDeleted):
        account_deletion.delete_account(user, password=None, confirmation="DELETE")


# --- Purge management command -----------------------------------------------


@pytest.mark.django_db
def test_purge_command_only_removes_content_past_the_grace_period():
    user = _make_user("owner")
    old_deleted = Project.objects.create(owner=user, title="Old")
    old_deleted.is_deleted = True
    old_deleted.deleted_at = timezone.now() - timezone.timedelta(days=31)
    old_deleted.save(update_fields=["is_deleted", "deleted_at"])

    recently_deleted = Project.objects.create(owner=user, title="Recent")
    recently_deleted.is_deleted = True
    recently_deleted.deleted_at = timezone.now() - timezone.timedelta(days=1)
    recently_deleted.save(update_fields=["is_deleted", "deleted_at"])

    not_deleted = Project.objects.create(owner=user, title="Active")

    call_command("purge_deleted_content")

    assert not Project.all_objects.filter(pk=old_deleted.pk).exists()
    assert Project.all_objects.filter(pk=recently_deleted.pk).exists()
    assert Project.all_objects.filter(pk=not_deleted.pk).exists()


@pytest.mark.django_db
def test_purge_command_dry_run_deletes_nothing():
    user = _make_user("owner")
    old_deleted = Project.objects.create(owner=user, title="Old")
    old_deleted.is_deleted = True
    old_deleted.deleted_at = timezone.now() - timezone.timedelta(days=31)
    old_deleted.save(update_fields=["is_deleted", "deleted_at"])

    call_command("purge_deleted_content", "--dry-run")

    assert Project.all_objects.filter(pk=old_deleted.pk).exists()


@pytest.mark.django_db
def test_purge_command_respects_a_custom_grace_period():
    user = _make_user("owner")
    deleted = Project.objects.create(owner=user, title="Old")
    deleted.is_deleted = True
    deleted.deleted_at = timezone.now() - timezone.timedelta(days=8)
    deleted.save(update_fields=["is_deleted", "deleted_at"])

    call_command("purge_deleted_content", "--grace-days", "30")
    assert Project.all_objects.filter(pk=deleted.pk).exists()

    call_command("purge_deleted_content", "--grace-days", "7")
    assert not Project.all_objects.filter(pk=deleted.pk).exists()


@pytest.mark.django_db
def test_purge_command_cascades_to_versions_and_covers_all_three_families():
    user = _make_user("owner")
    project3d = Project3D.objects.create(owner=user)
    project3d.is_deleted = True
    project3d.deleted_at = timezone.now() - timezone.timedelta(days=31)
    project3d.save(update_fields=["is_deleted", "deleted_at"])

    piece = ArtPiece.objects.create(owner=user, engine=ArtPiece.Engine.CANVAS2D, prompt="x")
    piece.is_deleted = True
    piece.deleted_at = timezone.now() - timezone.timedelta(days=31)
    piece.save(update_fields=["is_deleted", "deleted_at"])

    call_command("purge_deleted_content")

    assert not Project3D.all_objects.filter(pk=project3d.pk).exists()
    assert not ArtPiece.all_objects.filter(pk=piece.pk).exists()


# --- PostgreSQL-only: genuine concurrent deletion attempts -------------------

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_deletion_requests_only_one_succeeds(django_db_blocker):
    """Two genuinely overlapping deletion requests for the same account
    must never both run to completion: `select_for_update()` on the user
    row serializes them, and the second sees `is_active=False` already
    committed and reports `already_deleted` rather than re-anonymizing
    (and potentially double-billing-eventing) an already-deleted account.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="concurrent-delete-user", password="correct-horse-battery-staple"
        )

        results = []
        barrier = threading.Barrier(2)

        def do_delete():
            barrier.wait()
            try:
                account_deletion.delete_account(
                    user, password="correct-horse-battery-staple", confirmation="DELETE"
                )
                results.append("deleted")
            except account_deletion.AccountAlreadyDeleted:
                results.append("already_deleted")
            finally:
                close_thread_connections()

        threads = [threading.Thread(target=do_delete) for _ in range(2)]
        with route_default_to_postgres_test():
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        assert sorted(results) == ["already_deleted", "deleted"]
        user.refresh_from_db(using="postgres_test")
        assert user.is_active is False
