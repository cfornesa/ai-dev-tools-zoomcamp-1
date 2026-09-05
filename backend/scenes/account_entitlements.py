"""Account-facing entitlement summary (issue #439).

#423 already resolves effective per-feature caps and owns granting/
revoking; this module only ever *reads* that plus the shared quota
cache's current usage count, for the caller's own account. Kept as its
own module (rather than inside `scenes.entitlements`) specifically to
avoid a circular import: `scenes.ai_api`/`scenes.art_piece_api` already
import `scenes.entitlements.get_effective_cap`, so reading their quota
cache-key builders from `entitlements.py` itself would cycle back.
"""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta

from django.core.cache import cache
from django.utils import timezone

from scenes import entitlements
from scenes.ai_api import _quota_cache_key as _scene_quota_cache_key
from scenes.art_piece_api import _quota_cache_key as _art_quota_cache_key

_FEATURE_QUOTA_KEYS = {
    "ai_scene_create": lambda user_id: _scene_quota_cache_key(user_id),
    "ai_scene_edit": lambda user_id: _scene_quota_cache_key(user_id, operation="edit"),
    "ai_art_generate": lambda user_id: _art_quota_cache_key(user_id),
}


def next_reset_at() -> str:
    """The next UTC-midnight quota reset, as an ISO 8601 timestamp --
    matches the daily quota window every AI endpoint already enforces."""
    tomorrow = timezone.localdate() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=UTC).isoformat()


def get_entitlement_summary(user) -> dict:
    """Effective tier, per-feature cap/used/remaining, and the shared
    reset window -- entirely from server-resolved state, never anything
    the client could derive or override itself."""
    features = []
    for feature in sorted(entitlements.FEATURE_KEYS):
        cap = entitlements.get_effective_cap(user, feature)
        cache_key = _FEATURE_QUOTA_KEYS[feature](user.id)
        used = cache.get(cache_key, 0)
        features.append(
            {
                "feature": feature,
                "cap": cap,
                "used": used,
                "remaining": max(cap - used, 0),
            }
        )
    return {
        "plan_key": entitlements.get_user_plan_key(user),
        "features": features,
        "reset_at": next_reset_at(),
    }
