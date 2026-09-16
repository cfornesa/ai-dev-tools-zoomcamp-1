"""Validated content-level SEO/AEO metadata (#580)."""

from urllib.parse import urlparse


def sanitize_content_seo(value):
    if value in (None, {}):
        return {}
    if not isinstance(value, dict):
        raise ValueError("seo_config must be an object")
    allowed = {
        "title",
        "description",
        "canonical_policy",
        "indexing",
        "og_title",
        "og_description",
        "og_image_url",
        "twitter_card",
        "answer_summary",
        "structured_data",
    }
    if set(value) - allowed:
        raise ValueError("seo_config contains unknown fields")
    limits = {
        "title": 200,
        "description": 320,
        "og_title": 200,
        "og_description": 320,
        "answer_summary": 1000,
    }
    for key, limit in limits.items():
        if key in value and (not isinstance(value[key], str) or len(value[key]) > limit):
            raise ValueError(f"seo_config.{key} is invalid or too long")
    if value.get("canonical_policy", "self") not in {"self", "none"}:
        raise ValueError("seo_config.canonical_policy is invalid")
    if value.get("indexing", "index") not in {"index", "noindex"}:
        raise ValueError("seo_config.indexing is invalid")
    if value.get("twitter_card", "summary") not in {"summary", "summary_large_image"}:
        raise ValueError("seo_config.twitter_card is invalid")
    image = value.get("og_image_url", "")
    if image and urlparse(image).scheme not in {"http", "https"}:
        raise ValueError("seo_config.og_image_url must be an absolute URL")
    if "structured_data" in value and not isinstance(value["structured_data"], dict):
        raise ValueError("seo_config.structured_data must be an object")
    return value.copy()
