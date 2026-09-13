"""Admin AI provider/model catalog service (issue #523).

The one place `AdminAIModelsView`/`AdminAIModelDetailView`
(`scenes/admin_settings_api.py`) call to create, list, edit, deactivate, or
delete `AIProviderModel` rows, and the one place `scenes.ai_runs.start_run`
calls to gate a bounded agent run against the admin-declared
`agentic_supported` capability. Every write is `@transaction.atomic` and
uses the same optimistic-concurrency `revision` pattern as
`scenes.admin_settings` -- a stale `expected_revision` is rejected as a
conflict, never silently overwritten. Authorization is the caller's
responsibility, exactly like `scenes.admin_settings`.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import IntegrityError, transaction

from ai_provider.registry import PROVIDERS
from scenes.models import AIProviderModel

TASK_KINDS: set[str] = {choice.value for choice in AIProviderModel.TaskKind}

# Task kinds for which a real provider adapter is registered today. Keeping
# this separate from `TASK_KINDS` lets the catalog accept a task kind as a
# known concept while still rejecting `agentic_supported=True` for a
# provider/task combination this codebase cannot actually run.
AGENT_TASK_KINDS: set[str] = {
    AIProviderModel.TaskKind.AGENT_2D,
    AIProviderModel.TaskKind.AGENT_3D,
}


class RevisionConflict(Exception):
    """Raised when the caller's `expected_revision` no longer matches the
    stored row -- someone else changed it first."""


class ValidationFailed(Exception):
    """Raised for any invalid field value or unknown key. The whole write
    is rejected; nothing is partially applied."""


class NotFound(Exception):
    """Raised when no catalog row matches the given id."""


@dataclass(frozen=True)
class AIProviderModelView:
    id: int
    vendor: str
    model_slug: str
    display_label: str
    task_kinds: list[str]
    agentic_supported: bool
    active: bool
    revision: int


def _view(row: AIProviderModel) -> AIProviderModelView:
    return AIProviderModelView(
        id=row.id,
        vendor=row.vendor,
        model_slug=row.model_slug,
        display_label=row.display_label,
        task_kinds=sorted(row.task_kinds),
        agentic_supported=row.agentic_supported,
        active=row.active,
        revision=row.revision,
    )


def _validate_fields(
    *,
    vendor: str,
    model_slug: str,
    display_label: str,
    task_kinds: list[str],
    agentic_supported: bool,
) -> None:
    if not isinstance(vendor, str) or vendor.strip().lower() not in PROVIDERS:
        raise ValidationFailed(f"Unknown AI provider: {vendor!r}.")
    if not isinstance(model_slug, str) or not model_slug.strip():
        raise ValidationFailed("model_slug must be a non-empty string.")
    if len(model_slug) > 200:
        raise ValidationFailed("model_slug must be at most 200 characters.")
    if not isinstance(display_label, str) or not display_label.strip():
        raise ValidationFailed("display_label must be a non-empty string.")
    if len(display_label) > 200:
        raise ValidationFailed("display_label must be at most 200 characters.")
    if (
        not isinstance(task_kinds, list)
        or not task_kinds
        or any(not isinstance(k, str) for k in task_kinds)
    ):
        raise ValidationFailed("task_kinds must be a non-empty list of strings.")
    unknown_kinds = set(task_kinds) - TASK_KINDS
    if unknown_kinds:
        raise ValidationFailed(f"Unsupported task kind(s): {', '.join(sorted(unknown_kinds))}.")
    if not isinstance(agentic_supported, bool):
        raise ValidationFailed("agentic_supported must be a boolean.")
    if agentic_supported and not (set(task_kinds) & AGENT_TASK_KINDS):
        raise ValidationFailed(
            "agentic_supported requires at least one agent task kind "
            f"({', '.join(sorted(AGENT_TASK_KINDS))})."
        )


def list_models(*, include_inactive: bool = True) -> list[AIProviderModelView]:
    qs = AIProviderModel.objects.all()
    if not include_inactive:
        qs = qs.filter(active=True)
    return [_view(row) for row in qs]


@transaction.atomic
def create_model(
    *,
    actor,
    vendor: str,
    model_slug: str,
    display_label: str,
    task_kinds: list[str],
    agentic_supported: bool = False,
) -> AIProviderModelView:
    _validate_fields(
        vendor=vendor,
        model_slug=model_slug,
        display_label=display_label,
        task_kinds=task_kinds,
        agentic_supported=agentic_supported,
    )
    vendor = vendor.strip().lower()
    model_slug = model_slug.strip()
    if AIProviderModel.objects.filter(vendor=vendor, model_slug=model_slug, active=True).exists():
        raise ValidationFailed(f"An active catalog entry already exists for {vendor}/{model_slug}.")
    try:
        row = AIProviderModel.objects.create(
            vendor=vendor,
            model_slug=model_slug,
            display_label=display_label.strip(),
            task_kinds=sorted(set(task_kinds)),
            agentic_supported=agentic_supported,
            active=True,
            updated_by=actor,
        )
    except IntegrityError as exc:
        raise ValidationFailed(
            f"An active catalog entry already exists for {vendor}/{model_slug}."
        ) from exc
    return _view(row)


@transaction.atomic
def update_model(
    *,
    actor,
    model_id: int,
    expected_revision: int,
    display_label: str | None = None,
    task_kinds: list[str] | None = None,
    agentic_supported: bool | None = None,
    active: bool | None = None,
) -> AIProviderModelView:
    try:
        row = AIProviderModel.objects.select_for_update().get(pk=model_id)
    except AIProviderModel.DoesNotExist as exc:
        raise NotFound(f"No catalog entry with id {model_id}.") from exc

    if row.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {row.revision}."
        )

    next_label = display_label if display_label is not None else row.display_label
    next_kinds = task_kinds if task_kinds is not None else row.task_kinds
    next_agentic = agentic_supported if agentic_supported is not None else row.agentic_supported
    _validate_fields(
        vendor=row.vendor,
        model_slug=row.model_slug,
        display_label=next_label,
        task_kinds=next_kinds,
        agentic_supported=next_agentic,
    )
    if active is not None and not isinstance(active, bool):
        raise ValidationFailed("active must be a boolean.")

    next_active = active if active is not None else row.active
    if next_active:
        clash = (
            AIProviderModel.objects.filter(
                vendor=row.vendor, model_slug=row.model_slug, active=True
            )
            .exclude(pk=row.pk)
            .exists()
        )
        if clash:
            raise ValidationFailed(
                f"An active catalog entry already exists for {row.vendor}/{row.model_slug}."
            )

    row.display_label = next_label.strip()
    row.task_kinds = sorted(set(next_kinds))
    row.agentic_supported = next_agentic
    row.active = next_active
    row.revision += 1
    row.updated_by = actor
    row.save()
    return _view(row)


@transaction.atomic
def delete_model(*, model_id: int, expected_revision: int) -> None:
    try:
        row = AIProviderModel.objects.select_for_update().get(pk=model_id)
    except AIProviderModel.DoesNotExist as exc:
        raise NotFound(f"No catalog entry with id {model_id}.") from exc
    if row.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {row.revision}."
        )
    row.delete()


def is_agentic_supported(*, vendor: str, model_slug: str, task_kind: str) -> bool:
    """Used by `scenes.ai_runs.start_run` to gate an agent run. Fails
    closed: an unknown or inactive catalog entry is never agent-eligible.

    Filters in Python rather than with a JSONField array-containment
    lookup: this repository's test suite runs against SQLite
    (`backend.test_settings`), which does not reliably support PostgreSQL
    jsonb `@>` containment semantics for list-valued `JSONField`s.
    """
    row = (
        AIProviderModel.objects.filter(
            vendor=vendor.strip().lower() if isinstance(vendor, str) else vendor,
            model_slug=(model_slug or "").strip(),
            active=True,
            agentic_supported=True,
        )
        .only("task_kinds")
        .first()
    )
    return row is not None and task_kind in row.task_kinds


__all__ = [
    "AGENT_TASK_KINDS",
    "TASK_KINDS",
    "AIProviderModelView",
    "NotFound",
    "RevisionConflict",
    "ValidationFailed",
    "create_model",
    "delete_model",
    "is_agentic_supported",
    "list_models",
    "update_model",
]
