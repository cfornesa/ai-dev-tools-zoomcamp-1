"""Task 49: server-side "meaningful content" rules for public publishing.

`docs/plan.md`'s "Metadata is not versioned creative state" section says
only "Users can edit metadata any time... Require a meaningful title and
description only for public publishing and export" — it does not spell
out numeric minimums or a forbidden-word list. Task 17 already
anticipated this (see `frontend/src/validation/projectMetadata.ts`'s
`validateProjectMetadataForPublish`, written but never called until this
task): the documented rule is "non-blank after trimming, and not equal to
the untouched default placeholder." This module is the authoritative
server-side twin of that same rule, so the two can never disagree about
what counts as publishable:

- Title: non-empty after trimming, and not exactly
  `PLACEHOLDER_TITLE` ("Untitled animation" — `Project.title`'s own
  default). A title that's merely whitespace, or that a user never
  bothered to change from the default, is not "meaningful."
- Description: non-empty after trimming. `Project.description`'s own
  default is already `""`, so there is no separate placeholder string to
  special-case the way title has one.

Deliberately no minimum character count or banned-word list: `plan.md`
never specifies one, and inventing an arbitrary number (e.g. "at least 10
characters") would be an undocumented rule this module's own docstring
would then have to defend. "Says something, and isn't the untouched
default" is the rule this task documents and enforces.
"""

PLACEHOLDER_TITLE = "Untitled animation"


def validate_meaningful_metadata(title: str, description: str) -> dict[str, list[str]]:
    """Return field-level errors (empty dict if valid) for publishing `title`/`description`.

    Never raises; callers turn a non-empty result into a 400 response with
    field-level detail, per Task 49's acceptance criteria ("blocked ... with
    field-level errors", not a generic failure).
    """
    errors: dict[str, list[str]] = {}

    trimmed_title = (title or "").strip()
    if not trimmed_title or trimmed_title == PLACEHOLDER_TITLE:
        errors["title"] = ["Choose a meaningful title before publishing."]

    trimmed_description = (description or "").strip()
    if not trimmed_description:
        errors["description"] = ["Add a description before publishing."]

    return errors


# Issue #296: `Project3D` has no `description` field, and -- unlike the
# 2D `Project` -- no title-rename UI anywhere in this app today either
# (a separate, unfiled gap, out of this issue's scope). Gating publish on
# "the title isn't the untouched default" the way `validate_meaningful_metadata`
# does for 2D would therefore be a usability dead end: a user could never
# satisfy it. The only meaningful-content rule enforced here is "at least
# one saved version exists" (checked directly in
# `Project3DPublishView`/`Project3DUnpublishView`, `scenes/api3d.py`) --
# this function exists as the documented placeholder for that scope
# decision, kept separate from the view so a future title-rename feature
# has one obvious place to add the check back, mirroring
# `validate_meaningful_metadata`'s shape.
def validate_meaningful_metadata_3d(title: str) -> dict[str, list[str]]:
    """Currently always returns no errors -- see the module-level comment
    above for why Project3D's publish gate is title-check-free today."""
    del title  # unused until a 3D title-rename feature exists
    return {}
