"""Idempotently reconcile ApplicationAdmin grants against ADMIN_IDENTITIES.

Run this after changing `ADMIN_IDENTITIES` (or on a deploy hook) to apply
the change -- authorization is a persisted grant looked up by
`scenes.admin_authorization.is_application_admin`, not config re-parsed on
every request. Removing an identity from `ADMIN_IDENTITIES` and rerunning
this command revokes *only* that user's `ApplicationAdmin` grant; the
account, its content, and any separately managed Django `is_staff`/
`is_superuser` role are left untouched. Running this command twice in a
row with no configuration change makes no further changes (issue #421).
"""

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from scenes.models import ApplicationAdmin


class Command(BaseCommand):
    help = "Reconcile ApplicationAdmin grants against the ADMIN_IDENTITIES environment variable."

    def handle(self, *args, **options):
        user_model = get_user_model()
        matched_user_ids: set[int] = set()

        for kind, value in settings.ADMIN_IDENTITIES:
            if kind == "username":
                candidates = user_model.objects.filter(username=value, is_active=True)
            else:
                candidates = user_model.objects.filter(email__iexact=value, is_active=True)
            for candidate in candidates:
                if (
                    kind == "email"
                    and not EmailAddress.objects.filter(
                        user=candidate, email__iexact=value, verified=True
                    ).exists()
                ):
                    # An unverified claim of this email never counts as
                    # ownership -- see the module docstring on issue #421.
                    continue
                matched_user_ids.add(candidate.id)

        with transaction.atomic():
            revoked = ApplicationAdmin.objects.exclude(user_id__in=matched_user_ids)
            revoked_count = revoked.count()
            revoked.delete()
            granted_count = 0
            for user_id in matched_user_ids:
                _, created = ApplicationAdmin.objects.get_or_create(user_id=user_id)
                if created:
                    granted_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Reconciled application-admin grants: {granted_count} newly granted, "
                f"{revoked_count} revoked, {len(matched_user_ids)} currently granted."
            )
        )
