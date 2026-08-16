"""Table-driven tests for scenes.permissions (Task 11).

Every project/version/draft/publish/template/fork/export decision in the
API views must go through `scenes.permissions.can`/`require` — this test
is the single place that pins down every role x resource x action
combination, so an endpoint that bypasses the service (and hand-rolls its
own `owner_id ==` check) has nothing enforcing it stays correct.
"""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from scenes.models import EditSessionDraft, Project, SceneVersion, Template
from scenes.permissions import Action, PermissionDenied, can, require

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="owner")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="other")


@pytest.fixture
def anonymous():
    return AnonymousUser()


@pytest.fixture
def private_project(owner):
    return Project.objects.create(owner=owner, visibility=Project.Visibility.PRIVATE)


@pytest.fixture
def public_no_remix_project(owner):
    return Project.objects.create(
        owner=owner, visibility=Project.Visibility.PUBLIC, allow_public_remix=False
    )


@pytest.fixture
def public_remix_project(owner):
    return Project.objects.create(
        owner=owner, visibility=Project.Visibility.PUBLIC, allow_public_remix=True
    )


@pytest.fixture
def owner_draft(private_project, owner):
    return EditSessionDraft.objects.create(
        project=private_project, user=owner, session_id="s1", draft_json=BLANK_SCENE
    )


@pytest.fixture
def built_in_template():
    return Template.objects.create(
        source_type=Template.SourceType.BUILT_IN, owner=None, name="Blank", scene_json=BLANK_SCENE
    )


@pytest.fixture
def private_template(owner):
    return Template.objects.create(
        source_type=Template.SourceType.PRIVATE,
        owner=owner,
        name="Mine",
        scene_json=BLANK_SCENE,
    )


# fmt: off
# (role, action, resource_fixture_name, expected)
TABLE = [
    # project.read
    ("anonymous", Action.PROJECT_READ, "private_project", False),
    ("owner", Action.PROJECT_READ, "private_project", True),
    ("other", Action.PROJECT_READ, "private_project", False),
    ("anonymous", Action.PROJECT_READ, "public_no_remix_project", True),
    ("owner", Action.PROJECT_READ, "public_no_remix_project", True),
    ("other", Action.PROJECT_READ, "public_no_remix_project", True),

    # project.write / delete / publish / export — owner-only regardless of visibility
    ("anonymous", Action.PROJECT_WRITE, "private_project", False),
    ("owner", Action.PROJECT_WRITE, "private_project", True),
    ("other", Action.PROJECT_WRITE, "private_project", False),
    ("anonymous", Action.PROJECT_WRITE, "public_remix_project", False),
    ("owner", Action.PROJECT_WRITE, "public_remix_project", True),
    ("other", Action.PROJECT_WRITE, "public_remix_project", False),
    ("other", Action.PROJECT_DELETE, "public_remix_project", False),
    ("owner", Action.PROJECT_DELETE, "public_remix_project", True),
    ("other", Action.PROJECT_PUBLISH, "public_remix_project", False),
    ("owner", Action.PROJECT_PUBLISH, "public_remix_project", True),
    ("other", Action.PROJECT_EXPORT, "public_remix_project", False),
    ("owner", Action.PROJECT_EXPORT, "public_remix_project", True),

    # version.* — owner-only regardless of visibility
    ("anonymous", Action.VERSION_READ, "public_remix_project", False),
    ("other", Action.VERSION_READ, "public_remix_project", False),
    ("owner", Action.VERSION_READ, "public_remix_project", True),
    ("other", Action.VERSION_CREATE, "public_remix_project", False),
    ("owner", Action.VERSION_CREATE, "public_remix_project", True),
    ("other", Action.VERSION_RESTORE, "private_project", False),
    ("owner", Action.VERSION_RESTORE, "private_project", True),
    ("other", Action.VERSION_DELETE, "private_project", False),
    ("owner", Action.VERSION_DELETE, "private_project", True),

    # draft.* — owner of the draft only (drafts are never public)
    ("anonymous", Action.DRAFT_READ, "owner_draft", False),
    ("other", Action.DRAFT_READ, "owner_draft", False),
    ("owner", Action.DRAFT_READ, "owner_draft", True),
    ("other", Action.DRAFT_WRITE, "owner_draft", False),
    ("owner", Action.DRAFT_WRITE, "owner_draft", True),

    # project.fork — public + remix-enabled + authenticated only
    ("anonymous", Action.PROJECT_FORK, "public_remix_project", False),
    ("other", Action.PROJECT_FORK, "public_remix_project", True),
    ("owner", Action.PROJECT_FORK, "public_remix_project", True),
    ("other", Action.PROJECT_FORK, "public_no_remix_project", False),
    ("anonymous", Action.PROJECT_FORK, "private_project", False),
    ("other", Action.PROJECT_FORK, "private_project", False),

    # template.read — built-in always readable, private only by its owner
    ("anonymous", Action.TEMPLATE_READ, "built_in_template", True),
    ("other", Action.TEMPLATE_READ, "built_in_template", True),
    ("anonymous", Action.TEMPLATE_READ, "private_template", False),
    ("other", Action.TEMPLATE_READ, "private_template", False),
    ("owner", Action.TEMPLATE_READ, "private_template", True),

    # template.create / project.create — any authenticated user, no resource
    ("anonymous", Action.TEMPLATE_CREATE, None, False),
    ("other", Action.TEMPLATE_CREATE, None, True),
    ("anonymous", Action.PROJECT_CREATE, None, False),
    ("other", Action.PROJECT_CREATE, None, True),
]
# fmt: on


@pytest.mark.django_db
@pytest.mark.parametrize("role,action,resource_name,expected", TABLE)
def test_permission_table(
    request, owner, other_user, anonymous, role, action, resource_name, expected
):
    user = {"owner": owner, "other": other_user, "anonymous": anonymous}[role]
    resource = request.getfixturevalue(resource_name) if resource_name else None

    assert can(user, action, resource) is expected

    if expected:
        require(user, action, resource)  # must not raise
    else:
        with pytest.raises(PermissionDenied):
            require(user, action, resource)


@pytest.mark.django_db
def test_unknown_action_defaults_to_deny(owner, private_project):
    assert can(owner, "not.a.real.action", private_project) is False


@pytest.mark.django_db
def test_none_resource_defaults_to_deny_for_resource_scoped_actions(owner):
    assert can(owner, Action.PROJECT_READ, None) is False
    assert can(owner, Action.PROJECT_WRITE, None) is False
    assert can(owner, Action.VERSION_READ, None) is False
    assert can(owner, Action.DRAFT_READ, None) is False
    assert can(owner, Action.TEMPLATE_READ, None) is False
    assert can(owner, Action.PROJECT_FORK, None) is False


@pytest.mark.django_db
def test_malformed_resource_type_defaults_to_deny(owner, private_project):
    # A SceneVersion passed where a Project is expected — deny, not a crash.
    version = SceneVersion.objects.create(
        project=private_project, sequence=1, scene_json=BLANK_SCENE, origin="manual"
    )
    assert can(owner, Action.PROJECT_READ, version) is False
    assert can(owner, Action.DRAFT_READ, private_project) is False
