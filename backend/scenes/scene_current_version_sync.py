"""Issue #510: keep `Scene.current_version` in sync with the project-wide
`Project.current_version` mirror for code paths outside `scenes/api.py`.

`Project.current_version` is a denormalized mirror of
`Project.active_scene.current_version` (see `Project.current_version`'s own
docstring in `scenes/models.py`) — every scene-aware view in `scenes/api.py`
keeps both sides in sync explicitly, in the same transaction, whenever it
changes one of them.

But several pre-#510 call sites that create a `SceneVersion` and advance
`project.current_version` directly are explicitly out of this issue's scope
to modify (`scenes.ai_api.AIAcceptProposalView`, `scenes.ai_runs.accept_run`
— see issue #510's "keep the ~150+ existing call sites working unchanged"
policy). Those call sites have no idea `Scene` exists at all: they set
`project.current_version` and stop. Without something reconciling the other
side, `active_scene.current_version` would silently go stale the moment an
AI proposal is accepted, and this issue's own scene-management endpoints
(`GET .../scenes/`, duplicate, delete) would then read a wrong,
out-of-date "current version" for the active scene.

This `post_save` receiver on `Project` closes that gap generically, for
every caller, not just the two named above: whenever a `Project` row is
saved with `active_scene_id` set and `current_version_id` doesn't already
match the active scene's own `current_version_id`, it is brought into line
in one lean, conditional `UPDATE ... WHERE ... AND current_version_id !=`
query (a no-op, zero-row update on every save that doesn't actually change
`current_version` — the overwhelmingly common case). Uses `QuerySet.update()`
rather than `Scene.save()` so it can never itself trigger another signal or
touch `Scene.updated_at` for an unrelated project metadata edit.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from scenes.models import Project, Scene


@receiver(post_save, sender=Project)
def sync_active_scene_current_version(sender, instance: Project, using=None, **kwargs):
    if instance.active_scene_id is None:
        return
    # Bound to the exact database alias this save just happened on
    # (Django's `post_save` signal always passes `using` -- never inferred
    # from `instance._state.db` or left to default routing) so this stays
    # correct under this repo's own multi-database PostgreSQL-gated test
    # suite (`tests/test_scene_version_save_api.py` and friends run two
    # threads each doing `Project.objects.using("postgres_test")...`) as
    # well as ordinary single-database production use.
    db_alias = using or instance._state.db
    Scene.objects.using(db_alias).filter(pk=instance.active_scene_id).exclude(
        current_version_id=instance.current_version_id
    ).update(current_version_id=instance.current_version_id)
