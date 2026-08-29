"""One centralized authorization service for every project-related operation.

Task 11: no view anywhere should scatter its own `owner_id ==` checks —
every project, version, draft, publish, template, fork, and export
decision goes through `can()` (or its raising counterpart `require()`)
here instead. Unknown actions and malformed/`None` resources default to
deny, per the task's explicit constraint.

V1 has no teams/workspaces/shared editing (`_docs/plan.md`'s V1
exclusions), so every decision reduces to: anonymous, owner, or
authenticated-non-owner, plus whatever a resource's own public/remix
flags allow.
"""

from enum import StrEnum

from scenes.models import EditSessionDraft, Project, Project3D, Template


class Action(StrEnum):
    PROJECT_CREATE = "project.create"
    PROJECT_READ = "project.read"
    PROJECT_WRITE = "project.write"
    PROJECT_DELETE = "project.delete"
    PROJECT_PUBLISH = "project.publish"
    PROJECT_EXPORT = "project.export"
    PROJECT_FORK = "project.fork"
    VERSION_READ = "version.read"
    VERSION_CREATE = "version.create"
    VERSION_RESTORE = "version.restore"
    VERSION_DELETE = "version.delete"
    DRAFT_READ = "draft.read"
    DRAFT_WRITE = "draft.write"
    TEMPLATE_READ = "template.read"
    TEMPLATE_CREATE = "template.create"
    AI_CREATE_SCENE = "ai.create_scene"
    AI_EDIT_SCENE = "ai.edit_scene"
    # #213: the 3D document family (Project3D/SceneVersion3D, #212) has no
    # `visibility` field yet -- unlike PROJECT_READ above, PROJECT3D_READ is
    # unconditionally owner-only until a publish/gallery feature gives it
    # one, same shape as _OWNER_ONLY_PROJECT_ACTIONS' 2D actions.
    PROJECT3D_CREATE = "project3d.create"
    PROJECT3D_READ = "project3d.read"
    # #228: saving a new SceneVersion3D is owner-only, same shape as
    # PROJECT3D_READ above (no visibility field yet to allow anyone else).
    PROJECT3D_WRITE = "project3d.write"


class PermissionDenied(Exception):
    """Raised by require() when can() returns False."""


def _is_authenticated(user) -> bool:
    return bool(user) and getattr(user, "is_authenticated", False)


def _is_owner(user, project: Project | None) -> bool:
    return _is_authenticated(user) and project is not None and project.owner_id == user.id


def _is_owner_3d(user, project: Project3D | None) -> bool:
    return _is_authenticated(user) and project is not None and project.owner_id == user.id


# Actions whose resource is a Project and whose answer is simply "is this
# user the project's owner" — every action in this set treats public
# visibility as irrelevant, per "Public visibility does not grant edit,
# version, draft, publish, or export-owner permissions."
_OWNER_ONLY_PROJECT_ACTIONS = frozenset(
    {
        Action.PROJECT_WRITE,
        Action.PROJECT_DELETE,
        Action.PROJECT_PUBLISH,
        Action.PROJECT_EXPORT,
        Action.VERSION_READ,
        Action.VERSION_CREATE,
        Action.VERSION_RESTORE,
        Action.VERSION_DELETE,
        # Task 46/47: an AI-generated create-scene proposal is scoped to one
        # project (for quota/rate-limiting and future prompt-context reuse)
        # but never creates a SceneVersion or touches current_version -- see
        # scenes/ai_api.py. Owner-only, same as every other working
        # operation on a project.
        Action.AI_CREATE_SCENE,
        # Task 50: same reasoning -- an AI edit proposal is scoped to one
        # project and never creates a SceneVersion or touches
        # current_version, but it's still owner-only working state.
        Action.AI_EDIT_SCENE,
    }
)


def can(user, action: Action, resource=None) -> bool:
    """Return whether `user` may perform `action` on `resource`. Default deny."""
    if action == Action.PROJECT_CREATE:
        return _is_authenticated(user)

    if action == Action.PROJECT_READ:
        if not isinstance(resource, Project):
            return False
        if resource.visibility == Project.Visibility.PUBLIC:
            return True
        return _is_owner(user, resource)

    if action in _OWNER_ONLY_PROJECT_ACTIONS:
        if not isinstance(resource, Project):
            return False
        return _is_owner(user, resource)

    if action == Action.PROJECT_FORK:
        if not isinstance(resource, Project):
            return False
        if not _is_authenticated(user):
            return False
        return resource.visibility == Project.Visibility.PUBLIC and resource.allow_public_remix

    if action in (Action.DRAFT_READ, Action.DRAFT_WRITE):
        if not isinstance(resource, EditSessionDraft):
            return False
        return _is_authenticated(user) and resource.user_id == user.id

    if action == Action.TEMPLATE_READ:
        if not isinstance(resource, Template):
            return False
        if resource.source_type == Template.SourceType.BUILT_IN:
            return True
        return _is_authenticated(user) and resource.owner_id == user.id

    if action == Action.TEMPLATE_CREATE:
        return _is_authenticated(user)

    if action == Action.PROJECT3D_CREATE:
        return _is_authenticated(user)

    if action in (Action.PROJECT3D_READ, Action.PROJECT3D_WRITE):
        if not isinstance(resource, Project3D):
            return False
        return _is_owner_3d(user, resource)

    return False


def require(user, action: Action, resource=None) -> None:
    """Like can(), but raises PermissionDenied instead of returning False."""
    if not can(user, action, resource):
        raise PermissionDenied(f"{action.value} denied for this user/resource.")
