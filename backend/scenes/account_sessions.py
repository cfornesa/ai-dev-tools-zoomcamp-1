"""Owner session listing/revocation (issue #441).

Django's own `Session.session_key` is the literal, unencoded cookie
value -- effectively a bearer credential for that session. It is never
exposed to the client: every session is identified to the client by
`public_id`, a one-way hash of its `session_key`, computed identically
on list and on revoke so a client-supplied `public_id` can be matched
back to the real row server-side without ever round-tripping the real
key. Ownership is established via `SessionMetadata` (populated at
login), never by decoding `Session.session_data` -- decoding untrusted
session payloads for authorization decisions is exactly the kind of
thing this module should not need to do.
"""

from __future__ import annotations

import hashlib

from django.contrib.sessions.models import Session
from django.utils import timezone

from scenes.models import SessionMetadata


def compute_public_id(session_key: str) -> str:
    return hashlib.sha256(session_key.encode()).hexdigest()[:16]


def _own_sessions(user):
    session_keys = SessionMetadata.objects.filter(user=user).values_list("session_key", flat=True)
    return Session.objects.filter(
        session_key__in=list(session_keys), expire_date__gt=timezone.now()
    )


def list_sessions(user, current_session_key: str | None) -> list[dict]:
    metadata_by_key = {m.session_key: m for m in SessionMetadata.objects.filter(user=user)}
    sessions = []
    for session in _own_sessions(user).order_by("-expire_date"):
        metadata = metadata_by_key.get(session.session_key)
        sessions.append(
            {
                "public_id": compute_public_id(session.session_key),
                "is_current": session.session_key == current_session_key,
                "user_agent": metadata.user_agent if metadata else "",
                "created_at": metadata.created_at.isoformat() if metadata else None,
                "expires_at": session.expire_date.isoformat(),
            }
        )
    return sessions


def revoke_session(user, public_id: str) -> bool:
    """Idempotent: revoking an already-gone or not-your-own session is a
    no-op returning False, never an error -- the caller's own session
    list looks the same either way afterward.
    """
    for session in _own_sessions(user):
        if compute_public_id(session.session_key) == public_id:
            SessionMetadata.objects.filter(session_key=session.session_key).delete()
            session.delete()
            return True
    return False
