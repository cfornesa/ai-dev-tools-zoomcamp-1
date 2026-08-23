from django.urls import path

from scenes.ai_api import AIAcceptProposalView, AICreateSceneView, AIEditSceneView
from scenes.api import (
    BlankProjectCreateView,
    DraftDetailView,
    ProjectDetailView,
    ProjectForkView,
    ProjectListCreateView,
    ProjectPublishView,
    ProjectThumbnailView,
    ProjectUnpublishView,
    PublicProjectDetailView,
    PublicProjectListView,
    PublicProjectThumbnailView,
    SaveVersionAsTemplateView,
    SceneVersionDetailView,
    SceneVersionListCreateView,
    SceneVersionRestoreView,
    TemplateCloneView,
    TemplateListView,
)
from scenes.credentials_api import MistralCredentialView

urlpatterns = [
    path("account/mistral-credential/", MistralCredentialView.as_view(), name="mistral-credential"),
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/blank/", BlankProjectCreateView.as_view(), name="project-create-blank"),
    path("templates/", TemplateListView.as_view(), name="template-list"),
    path(
        "templates/<uuid:public_id>/clone/",
        TemplateCloneView.as_view(),
        name="template-clone",
    ),
    path("projects/<uuid:public_id>/", ProjectDetailView.as_view(), name="project-detail"),
    path(
        "projects/<uuid:public_id>/thumbnail.png",
        ProjectThumbnailView.as_view(),
        name="project-thumbnail",
    ),
    path(
        "projects/<uuid:public_id>/publish/",
        ProjectPublishView.as_view(),
        name="project-publish",
    ),
    path(
        "projects/<uuid:public_id>/unpublish/",
        ProjectUnpublishView.as_view(),
        name="project-unpublish",
    ),
    path(
        "public/projects/",
        PublicProjectListView.as_view(),
        name="public-project-list",
    ),
    path(
        "public/projects/<uuid:public_id>/",
        PublicProjectDetailView.as_view(),
        name="public-project-detail",
    ),
    path(
        "public/projects/<uuid:public_id>/thumbnail.png",
        PublicProjectThumbnailView.as_view(),
        name="public-project-thumbnail",
    ),
    path(
        "public/projects/<uuid:public_id>/fork/",
        ProjectForkView.as_view(),
        name="project-fork",
    ),
    path(
        "projects/<uuid:public_id>/versions/",
        SceneVersionListCreateView.as_view(),
        name="scene-version-list-create",
    ),
    path(
        "projects/<uuid:public_id>/versions/<int:version_id>/",
        SceneVersionDetailView.as_view(),
        name="scene-version-detail",
    ),
    path(
        "projects/<uuid:public_id>/versions/<int:version_id>/restore/",
        SceneVersionRestoreView.as_view(),
        name="scene-version-restore",
    ),
    path(
        "projects/<uuid:public_id>/versions/<int:version_id>/save-as-template/",
        SaveVersionAsTemplateView.as_view(),
        name="scene-version-save-as-template",
    ),
    path(
        "projects/<uuid:public_id>/draft/<str:session_id>/",
        DraftDetailView.as_view(),
        name="draft-detail",
    ),
    path(
        "projects/<uuid:public_id>/ai/create-scene/",
        AICreateSceneView.as_view(),
        name="ai-create-scene",
    ),
    path(
        "projects/<uuid:public_id>/ai/edit-scene/",
        AIEditSceneView.as_view(),
        name="ai-edit-scene",
    ),
    path(
        "projects/<uuid:public_id>/ai/accept-proposal/",
        AIAcceptProposalView.as_view(),
        name="ai-accept-proposal",
    ),
]
