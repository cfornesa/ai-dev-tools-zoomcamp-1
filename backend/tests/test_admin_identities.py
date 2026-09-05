"""Tests for application-admin identity reconciliation (issue #421).

`ADMIN_IDENTITIES` parsing itself is covered by `tests/test_env_config.py`
(settings-load behavior). These tests exercise the persisted-grant half:
`scenes.management.commands.reconcile_admin_identities` and
`scenes.admin_authorization.is_application_admin`, against a fixture set
matching the issue's own closure contract: a verified active exact-match
user, an unverified email claimant, a near-match username, an inactive
user, and a user granted admin by a previous run who is later removed
from configuration.
"""

from io import StringIO

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings

from scenes.admin_authorization import is_application_admin
from scenes.models import ApplicationAdmin


def _make_user(username, email, *, is_active=True):
    return get_user_model().objects.create_user(
        username=username, email=email, password="not-used-for-oauth", is_active=is_active
    )


def _verify_email(user, email, *, verified=True):
    EmailAddress.objects.create(user=user, email=email, verified=verified, primary=True)


def _reconcile():
    out = StringIO()
    call_command("reconcile_admin_identities", stdout=out)
    return out.getvalue()


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("email", "owner@example.com")}))
def test_verified_exact_match_email_is_granted():
    owner = _make_user("owner", "owner@example.com")
    _verify_email(owner, "owner@example.com", verified=True)

    _reconcile()

    assert ApplicationAdmin.objects.filter(user=owner).exists()
    assert is_application_admin(owner) is True


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("email", "claimant@example.com")}))
def test_unverified_email_claimant_is_not_granted():
    claimant = _make_user("claimant", "claimant@example.com")
    _verify_email(claimant, "claimant@example.com", verified=False)

    _reconcile()

    assert not ApplicationAdmin.objects.filter(user=claimant).exists()
    assert is_application_admin(claimant) is False


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("username", "site-admin")}))
def test_near_match_username_is_not_granted():
    near_match = _make_user("site-admin-2", "notquite@example.com")

    _reconcile()

    assert not ApplicationAdmin.objects.filter(user=near_match).exists()
    assert is_application_admin(near_match) is False


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("username", "inactive-admin")}))
def test_inactive_user_is_not_granted():
    inactive_user = _make_user("inactive-admin", "inactive@example.com", is_active=False)

    _reconcile()

    assert not ApplicationAdmin.objects.filter(user=inactive_user).exists()
    assert is_application_admin(inactive_user) is False


@pytest.mark.django_db
def test_removing_identity_from_config_revokes_on_next_reconciliation():
    previous_admin = _make_user("previous-admin", "previous@example.com")
    _verify_email(previous_admin, "previous@example.com", verified=True)

    with override_settings(ADMIN_IDENTITIES=frozenset({("email", "previous@example.com")})):
        _reconcile()
    assert ApplicationAdmin.objects.filter(user=previous_admin).exists()

    # Configuration no longer names this user -- account and content are
    # untouched, only the grant is revoked.
    with override_settings(ADMIN_IDENTITIES=frozenset()):
        _reconcile()

    previous_admin.refresh_from_db()
    assert previous_admin.is_active is True
    assert not ApplicationAdmin.objects.filter(user=previous_admin).exists()
    assert is_application_admin(previous_admin) is False


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("email", "owner@example.com")}))
def test_reconciliation_is_idempotent_across_reruns():
    owner = _make_user("owner", "owner@example.com")
    _verify_email(owner, "owner@example.com", verified=True)

    _reconcile()
    first_grant = ApplicationAdmin.objects.get(user=owner)
    _reconcile()
    second_grant = ApplicationAdmin.objects.get(user=owner)

    assert ApplicationAdmin.objects.filter(user=owner).count() == 1
    assert first_grant.pk == second_grant.pk
    assert first_grant.granted_at == second_grant.granted_at


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset())
def test_missing_config_grants_nobody():
    someone = _make_user("someone", "someone@example.com")

    _reconcile()

    assert ApplicationAdmin.objects.count() == 0
    assert is_application_admin(someone) is False


def test_is_application_admin_fails_closed_for_anonymous_user():
    from django.contrib.auth.models import AnonymousUser

    assert is_application_admin(AnonymousUser()) is False
    assert is_application_admin(None) is False


@pytest.mark.django_db
@override_settings(ADMIN_IDENTITIES=frozenset({("email", "owner@example.com")}))
def test_reconciliation_never_touches_django_staff_or_superuser_flags():
    owner = _make_user("owner", "owner@example.com")
    owner.is_staff = True
    owner.is_superuser = False
    owner.save()
    _verify_email(owner, "owner@example.com", verified=True)

    _reconcile()

    owner.refresh_from_db()
    assert owner.is_staff is True
    assert owner.is_superuser is False
    assert is_application_admin(owner) is True
