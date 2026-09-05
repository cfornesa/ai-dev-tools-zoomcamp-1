"""Application-admin authorization boundary (issue #421).

The single place any admin-only view/API should check. Deliberately
separate from Django's own `is_staff`/`is_superuser`: this only ever
reflects `ApplicationAdmin` rows, which only
`reconcile_admin_identities` creates or deletes, so granting or revoking
one can never silently touch the other.
"""

from scenes.models import ApplicationAdmin


def is_application_admin(user) -> bool:
    """Fail closed: anonymous, inactive, or ungranted users are never admins."""
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return ApplicationAdmin.objects.filter(user=user).exists()
