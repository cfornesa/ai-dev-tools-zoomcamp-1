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
            return handle.lstrip("@")
    return user.get_username()


def public_author_handle(user) -> str | None:
    """Return the normalized public handle, without the service ``@`` prefix."""
    profile = getattr(user, "public_profile", None)
    if profile is None:
        return None
    handle = (profile.handle or "").strip().lstrip("@")
    return handle or None


def public_author_attribution(user) -> str:
    """Return the public authorship label used by feeds and share metadata."""
    name = public_author_name(user)
    handle = public_author_handle(user)
    return f"By {name} (@{handle})" if handle else f"By {name}"
