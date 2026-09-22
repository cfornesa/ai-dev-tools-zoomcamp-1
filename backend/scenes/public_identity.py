"""Public-facing identity resolution for attribution text."""


def public_author_name(user) -> str:
    """Return display name, current public handle, then account username."""
    profile = getattr(user, "public_profile", None)
    if profile is not None:
        display_name = (profile.display_name or "").strip()
        if display_name:
            return display_name
        handle = (profile.handle or "").strip()
        if handle:
            return handle
    return user.get_username()
