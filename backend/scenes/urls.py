from django.urls import path

from scenes.ai_api import AIAcceptProposalView, AICreateSceneView, AIEditSceneView
from scenes.ai_api3d import AIAcceptProposal3DView, AICreateScene3DView, AIEditScene3DView
from scenes.ai_preferences_api import (
    AIPersonaDetailView,
    AIPersonaListCreateView,
    MistralModelPreferenceDetailView,
    MistralModelPreferenceListCreateView,
)
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
from scenes.api3d import (
    Project3DDetailView,
    Project3DListCreateView,
    Project3DThumbnailView,
    SceneVersion3DListCreateView,
)
from scenes.art_piece_api import ArtPieceGenerateView
from scenes.credentials_api import MistralCredentialView

urlpatterns = [
    path("account/mistral-credential/", MistralCredentialView.as_view(), name="mistral-credential"),
    path(
        "account/mistral-model-preferences/",
        MistralModelPreferenceListCreateView.as_view(),
        name="mistral-model-preference-list-create",
    ),
    path(
        "account/mistral-model-preferences/<int:pk>/",
        MistralModelPreferenceDetailView.as_view(),
        name="mistral-model-preference-detail",
    ),
    path(
        "account/ai-personas/",
        AIPersonaListCreateView.as_view(),
        name="ai-persona-list-create",
    ),
    path(
        "account/ai-personas/<int:pk>/",
        AIPersonaDetailView.as_view(),
        name="ai-persona-detail",
    ),
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
    # Issue #199: deliberately not project-scoped -- see art_piece_api.py's
    # module docstring for why.
    path(
        "ai/art-pieces/generate/",
        ArtPieceGenerateView.as_view(),
        name="art-piece-generate",
    ),
    # #213: the 3D scene document family (Project3D/SceneVersion3D, #212) --
    # a genuinely separate URL namespace from "projects/" above, matching
    # #208's decision that this is a separate document family, not a 2D
    # project variant.
    path("projects3d/", Project3DListCreateView.as_view(), name="project3d-list-create"),
    path(
        "projects3d/<uuid:public_id>/",
        Project3DDetailView.as_view(),
        name="project3d-detail",
    ),
    # #228: save a new SceneVersion3D.
    path(
        "projects3d/<uuid:public_id>/versions/",
        SceneVersion3DListCreateView.as_view(),
        name="project3d-version-list-create",
    ),
    # #243: owner-facing gallery-card thumbnail.
    path(
        "projects3d/<uuid:public_id>/thumbnail/",
        Project3DThumbnailView.as_view(),
        name="project3d-thumbnail",
    ),
    # #232: the 3D AI-assisted editor's create/edit/accept endpoints.
    path(
        "projects3d/<uuid:public_id>/ai/create-scene/",
        AICreateScene3DView.as_view(),
        name="ai-create-scene3d",
    ),
    path(
        "projects3d/<uuid:public_id>/ai/edit-scene/",
        AIEditScene3DView.as_view(),
        name="ai-edit-scene3d",
    ),
    path(
        "projects3d/<uuid:public_id>/ai/accept-proposal/",
        AIAcceptProposal3DView.as_view(),
        name="ai-accept-proposal3d",
    ),
]
