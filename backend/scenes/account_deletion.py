"""Owner-initiated account deletion (issue #443).

Deletion is deactivation + PII scrub, never a literal `auth.User.delete()`:
`Subscription`/`BillingEvent`/`IdentityLinkEvent` only ever reference the
owner by FK and never embedded PII directly (see their own docstrings in
`scenes/models.py`), so anonymizing this one row is what makes every
audit/billing record "anonymized, retained indefinitely" without a schema
change or a per-table anonymization pass. Keeping the row also sidesteps
every CASCADE FK pointed at `auth.User` (`Subscription`, `MistralCredential`,
`ProviderCredential`, `SocialAccount`, ...) -- this function deletes the
ones with no retention reason (identities, credentials, sessions) and
leaves the rest (billing/audit history) exactly where they are, pointed at
the now-anonymized row.

Retention policy (repository owner decision, 2026-09-06):
- Creative content (`Project`/`Project3D`/`ArtPiece` + their versions) is
  soft-deleted immediately -- the same `is_deleted`/`deleted_at` flag every
  single-item delete endpoint already sets (see e.g. `ProjectDetailView.
  delete`) -- then hard-purged after a 30-day grace period by
  `manage.py purge_deleted_content` (a separate, manually/externally
  scheduled command; this function never purges anything itself).
- An active `Subscription` is marked `CANCELLED` locally -- the exact same
  state transition `scenes.billing`'s webhook handler already applies for
  a real PayPal-initiated cancellation -- so `paid_through` is preserved
  and paid access continues through the current billing period ("cancel at
  period end", not immediate revocation). This does not call a live PayPal
  cancel-subscription API request: no such client exists in this codebase
  yet (that's #440's own scope, still open). A real PayPal-side
  cancellation is still needed to stop the next renewal charge; tracked as
  a follow-up once #440 adds a PayPal API client.
- Billing/identity-link audit rows (`Subscription`, `BillingEvent`,
  `IdentityLinkEvent`) are retained indefinitely and are never deleted or
  individually redacted -- anonymizing the `User` row they point at is the
  entire anonymization step, since none of them store PII of their own.
- Sign-in identities (`SocialAccount`), personal AI provider credentials
  (`MistralCredential`, `ProviderCredential`), and every session are
  deleted outright -- there is no retention reason to keep decryptable key
  material or a still-usable identity link/session around.
"""

from __future__ import annotations

import uuid

from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string

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

REQUIRED_CONFIRMATION_TEXT = "DELETE"


class AccountDeletionError(Exception):
    code = "account_deletion_error"


class ReauthenticationRequired(AccountDeletionError):
    """The caller's password didn't match, or one was required but missing."""

    code = "reauthentication_required"


class ConfirmationMismatch(AccountDeletionError):
    """The caller's typed confirmation text didn't match what was required."""

    code = "confirmation_mismatch"


class AccountAlreadyDeleted(AccountDeletionError):
    """A concurrent or repeated deletion request found the account already
    deactivated -- a safe, idempotent no-op rather than a second pass over
    already-anonymized data."""

    code = "already_deleted"


def _verify_reauthentication(user, password: str | None) -> None:
    if user.has_usable_password():
        if not password or not user.check_password(password):
            raise ReauthenticationRequired(
                "Your current password is required to delete your account."
            )
    # An OAuth-only account (no usable password) has nothing further to
    # re-check here beyond the explicit confirmation text below -- there is
    # no password to verify, and forcing a full OAuth round trip solely to
    # reprove "still logged in" adds no real security for an already
    # authenticated session.


def _verify_confirmation(confirmation: str) -> None:
    if (confirmation or "").strip().upper() != REQUIRED_CONFIRMATION_TEXT:
        raise ConfirmationMismatch(f'Type "{REQUIRED_CONFIRMATION_TEXT}" to confirm.')


@transaction.atomic
def delete_account(user, *, password: str | None, confirmation: str) -> None:
    """Deletes `user`'s account per the retention policy documented above.

    Atomic end to end: any failure partway through leaves the account
    completely untouched (a rollback, not a partial deletion) -- there is
    no separate "recoverable deletion state" to model beyond the
    transaction boundary itself. `user` is re-fetched under
    `select_for_update()` first so two concurrent deletion requests for the
    same account can never both proceed: the second sees the first's
    committed `is_active=False` and raises `AccountAlreadyDeleted` instead
    of re-running (and double-cancelling a subscription, double-purging
    identities, etc.) against already-anonymized data.
    """
    locked_user = get_user_model().objects.select_for_update().get(pk=user.pk)
    if not locked_user.is_active:
        raise AccountAlreadyDeleted("This account has already been deleted.")

    _verify_reauthentication(locked_user, password)
    _verify_confirmation(confirmation)

    now = timezone.now()
    Project.all_objects.filter(owner=locked_user, is_deleted=False).update(
        is_deleted=True, deleted_at=now
    )
    Project3D.all_objects.filter(owner=locked_user, is_deleted=False).update(
        is_deleted=True, deleted_at=now
    )
    ArtPiece.all_objects.filter(owner=locked_user, is_deleted=False).update(
        is_deleted=True, deleted_at=now
    )

    active_subscription = (
        Subscription.objects.select_for_update()
        .filter(user=locked_user, status=Subscription.Status.ACTIVE)
        .first()
    )
    if active_subscription is not None:
        active_subscription.status = Subscription.Status.CANCELLED
        active_subscription.save(update_fields=["status", "updated_at"])
        BillingEvent.objects.create(
            paypal_event_id=f"account-deletion-{uuid.uuid4()}",
            event_type="ACCOUNT.DELETION.CANCELLATION",
            subscription=active_subscription,
            outcome=BillingEvent.Outcome.APPLIED,
            detail=(
                "Cancelled locally as part of account deletion; paid access "
                "continues through paid_through."
            ),
        )

    SocialAccount.objects.filter(user=locked_user).delete()
    # allauth's own `EmailAddress.email` is globally unique -- since this
    # function anonymizes rather than deletes the `User` row, leaving a
    # verified `EmailAddress` behind would permanently squat that address
    # against ever verifying it again (e.g. a later real signup via
    # Google OAuth using the same email). Erasing it is both correct
    # identity cleanup and required to free the address up.
    EmailAddress.objects.filter(user=locked_user).delete()
    MistralCredential.objects.filter(user=locked_user).delete()
    ProviderCredential.objects.filter(owner=locked_user).delete()

    session_keys = list(
        SessionMetadata.objects.filter(user=locked_user).values_list("session_key", flat=True)
    )
    Session.objects.filter(session_key__in=session_keys).delete()
    SessionMetadata.objects.filter(user=locked_user).delete()

    anonymized_username = f"deleted-user-{locked_user.id}-{get_random_string(8).lower()}"
    locked_user.username = anonymized_username
    locked_user.email = f"{anonymized_username}@deleted.invalid"
    locked_user.first_name = ""
    locked_user.last_name = ""
    locked_user.is_active = False
    locked_user.password = make_password(get_random_string(32))
    locked_user.save(
        update_fields=["username", "email", "first_name", "last_name", "is_active", "password"]
    )
