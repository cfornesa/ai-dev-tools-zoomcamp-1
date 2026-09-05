"""Finite, provider-neutral catalog used at API and credential boundaries.

The catalog deliberately contains extension entries for providers whose live
adapters are delivered by later issues.  Keeping the identifiers here means
unknown vendors fail closed and settings can expose safe metadata without
ever returning credentials.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderDefinition:
    vendor: str
    label: str
    default_model: str
    implemented: bool
    models: tuple[str, ...] = ()


PROVIDERS: dict[str, ProviderDefinition] = {
    "mistral": ProviderDefinition("mistral", "Mistral", "mistral-small-latest", True),
    "gemini": ProviderDefinition(
        "gemini", "Google Gemini", "gemini-2.5-flash", True,
        ("gemini-2.5-flash", "gemini-2.5-pro"),
    ),
    "deepseek": ProviderDefinition(
        "deepseek", "DeepSeek", "deepseek-chat", True,
        ("deepseek-chat", "deepseek-reasoner"),
    ),
}

MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$")


def get_provider(vendor: str) -> ProviderDefinition:
    """Return a known provider or fail closed without contacting a vendor."""
    try:
        return PROVIDERS[vendor.strip().lower()]
    except (AttributeError, KeyError):
        raise ValueError("Unknown AI provider.") from None


def validate_model(vendor: str, model: str | None) -> str:
    provider = get_provider(vendor)
    candidate = (model or provider.default_model).strip()
    if not MODEL_ID_RE.fullmatch(candidate):
        raise ValueError("Invalid AI model.")
    if provider.models and candidate not in provider.models:
        raise ValueError("That model is not available for the selected AI provider.")
    return candidate


__all__ = ["MODEL_ID_RE", "PROVIDERS", "ProviderDefinition", "get_provider", "validate_model"]
