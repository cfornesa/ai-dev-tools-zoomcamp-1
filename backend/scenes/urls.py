from django.urls import path

from scenes.account_deletion_api import AccountDeletionView
from scenes.account_entitlements_api import AccountEntitlementsView
from scenes.account_export_api import AccountDataExportView
from scenes.account_identities_api import AccountIdentitiesView, AccountIdentityUnlinkView
from scenes.account_sessions_api import AccountSessionRevokeView, AccountSessionsView
from scenes.admin_content_api import (
    AdminContentAccessView,
    AdminContentActionView,
    AdminContentListView,
)
from scenes.admin_pages_api import AdminPageDetailView, AdminPageListCreateView
from scenes.admin_settings_api import (
    AdminAIModelDetailView,
    AdminAIModelsView,
    AdminGlobalCapabilitiesView,
    AdminPlansView,
    AdminRoleDetailView,
    AdminRolesView,
    AdminSiteSettingsView,
    SiteThemeView,
)
from scenes.ai_api import AIAcceptProposalView, AICreateSceneView, AIEditSceneView
from scenes.ai_api3d import AIAcceptProposal3DView, AICreateScene3DView, AIEditScene3DView
from scenes.ai_preferences_api import (
    AIPersonaDetailView,
    AIPersonaListCreateView,
    MistralModelPreferenceDetailView,
    MistralModelPreferenceListCreateView,
)
from scenes.ai_retry_preference_api import AIRetryPreferenceView
from scenes.ai_runs_api import (
    AIRunAcceptView,
    AIRunAdvanceView,
    AIRunCancelView,
    AIRunDetailView,
    AIRunListCreateView,
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
    PublicGalleryListView,
    PublicProjectDetailView,
    PublicProjectListView,
    PublicProjectThumbnailView,
    SaveVersionAsTemplateView,
    SceneDetailView,
    SceneDuplicateView,
    SceneListCreateView,
    SceneReorderView,
    SceneVersionDetailView,
    SceneVersionListCreateView,
    SceneVersionRestoreView,
    TemplateCloneView,
    TemplateListView,
)
from scenes.api3d import (
    Project3DDetailView,
    Project3DListCreateView,
    Project3DPublishView,
    Project3DThumbnailView,
    Project3DUnpublishView,
    PublicProject3DDetailView,
    SceneVersion3DListCreateView,
)
from scenes.art_piece_api import ArtPieceGenerateView
from scenes.art_piece_persistence import (
    ArtPieceDetailView,
    ArtPieceListCreateView,
    ArtPieceRegenerateThumbnailView,
    ArtPieceThumbnailUploadView,
    ArtPieceThumbnailView,
    ArtPieceVersionListCreateView,
    PublicArtPieceDetailView,
    PublicArtPieceListView,
    PublicArtPieceThumbnailView,
)
from scenes.billing_api import AccountBillingView, PayPalWebhookView
from scenes.cloud_backup_api import CloudBackupBlobView, CloudBackupManifestView, CloudBackupView
from scenes.cloud_retention_api import AdminCloudRetentionPurgeView, AdminCloudRetentionView
from scenes.pages_api import PublicPageDetailView
from scenes.profile_api import AccountProfileView, PublicProfileView
from scenes.provider_credentials_api import ProviderCredentialView
from scenes.scene_conversion_api import (
    SceneConversionAcceptView,
    SceneConversionAdvanceView,
    SceneConversionCancelView,
    SceneConversionDetailView,
    SceneConversionListCreateView,
)
from scenes.sync_mutation_api import SyncMutationReceiptView

urlpatterns = [
    path("pages/<slug:slug>/", PublicPageDetailView.as_view(), name="public-page-detail"),
    path("admin/pages/", AdminPageListCreateView.as_view(), name="admin-page-list-create"),
    path("admin/pages/<int:pk>/", AdminPageDetailView.as_view(), name="admin-page-detail"),
    path("admin/content/", AdminContentListView.as_view(), name="admin-content-list"),
    path("admin/content/actions/", AdminContentActionView.as_view(), name="admin-content-action"),
    path("admin/content/access/", AdminContentAccessView.as_view(), name="admin-content-access"),
    path("admin/settings/", AdminSiteSettingsView.as_view(), name="admin-settings"),
    path("site-theme/", SiteThemeView.as_view(), name="site-theme"),
    path("admin/plans/", AdminPlansView.as_view(), name="admin-plans"),
    path("admin/roles/", AdminRolesView.as_view(), name="admin-roles"),
    path("admin/roles/<str:role_key>/", AdminRoleDetailView.as_view(), name="admin-role-detail"),
    path(
        "admin/global-capabilities/",
        AdminGlobalCapabilitiesView.as_view(),
        name="admin-global-capabilities",
    ),
    path("admin/ai-models/", AdminAIModelsView.as_view(), name="admin-ai-models"),
    path(
        "admin/ai-models/<int:model_id>/",
        AdminAIModelDetailView.as_view(),
        name="admin-ai-model-detail",
    ),
    path("admin/cloud-retention/", AdminCloudRetentionView.as_view(), name="admin-cloud-retention"),
    path(
        "admin/cloud-retention/purge/",
        AdminCloudRetentionPurgeView.as_view(),
        name="admin-cloud-retention-purge",
    ),
    path("billing/paypal/webhook/", PayPalWebhookView.as_view(), name="paypal-webhook"),
    path("account/billing/", AccountBillingView.as_view(), name="account-billing"),
    path("account/entitlements/", AccountEntitlementsView.as_view(), name="account-entitlements"),
    path("account/export/", AccountDataExportView.as_view(), name="account-data-export"),
    path("account/delete/", AccountDeletionView.as_view(), name="account-delete"),
    path("account/sessions/", AccountSessionsView.as_view(), name="account-sessions"),
    path(
        "account/sessions/<str:public_id>/",
        AccountSessionRevokeView.as_view(),
        name="account-session-revoke",
    ),
    path("account/identities/", AccountIdentitiesView.as_view(), name="account-identities"),
    path(
        "account/identities/<str:provider>/",
        AccountIdentityUnlinkView.as_view(),
        name="account-identity-unlink",
    ),
    path(
        "account/provider-credentials/",
        ProviderCredentialView.as_view(),
        name="provider-credentials",
    ),
    path("account/profile/", AccountProfileView.as_view(), name="account-profile"),
    path("users/@<str:handle>/", PublicProfileView.as_view(), name="public-profile"),
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
    path(
        "account/ai-retry-preference/",
        AIRetryPreferenceView.as_view(),
        name="ai-retry-preference",
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
    path("projects/<uuid:public_id>/cloud-backup/", CloudBackupView.as_view(), name="cloud-backup"),
    path(
        "projects/<uuid:public_id>/sync/mutations/",
        SyncMutationReceiptView.as_view(),
        name="sync-mutation-receipt",
    ),
    path(
        "projects/<uuid:public_id>/cloud-backup/manifest/",
        CloudBackupManifestView.as_view(),
        name="cloud-backup-manifest",
    ),
    path(
        "projects/<uuid:public_id>/cloud-backup/assets/<uuid:asset_id>/",
        CloudBackupBlobView.as_view(),
        name="cloud-backup-blob",
    ),
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
    # Issue #491: canonical unified anonymous listing (2D + 3D + generated).
    # Additive only -- the legacy "public/projects/" listing above and
    # "public/art-pieces/" below keep their existing contracts unchanged.
    path(
        "public/gallery/",
        PublicGalleryListView.as_view(),
        name="public-gallery",
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
    # Issue #510: ordered scene collection for a project. Deliberately
    # placed before "versions/" is scoped per-scene in any future work --
    # today's "versions/" routes below stay project-scoped (unchanged) per
    # this issue's own "don't touch existing call sites" boundary.
    path(
        "projects/<uuid:public_id>/scenes/",
        SceneListCreateView.as_view(),
        name="scene-list-create",
    ),
    path(
        "projects/<uuid:public_id>/scenes/reorder/",
        SceneReorderView.as_view(),
        name="scene-reorder",
    ),
    path(
        "projects/<uuid:public_id>/scenes/<uuid:scene_id>/",
        SceneDetailView.as_view(),
        name="scene-detail",
    ),
    path(
        "projects/<uuid:public_id>/scenes/<uuid:scene_id>/duplicate/",
        SceneDuplicateView.as_view(),
        name="scene-duplicate",
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
    # Issue #461: deliberately not project-scoped in the URL -- a run's
    # target is identified in its own request body at `start`, and every
    # later action addresses the run itself by its own id, not by
    # project. Never returns 404 to a non-owner via a different code path
    # than "run doesn't exist" -- see scenes/ai_runs_api.py's docstring.
    path("ai/runs/", AIRunListCreateView.as_view(), name="ai-run-list-create"),
    path("ai/runs/<int:pk>/", AIRunDetailView.as_view(), name="ai-run-detail"),
    path("ai/runs/<int:pk>/advance/", AIRunAdvanceView.as_view(), name="ai-run-advance"),
    path("ai/runs/<int:pk>/cancel/", AIRunCancelView.as_view(), name="ai-run-cancel"),
    path("ai/runs/<int:pk>/accept/", AIRunAcceptView.as_view(), name="ai-run-accept"),
    path(
        "scene-conversions/",
        SceneConversionListCreateView.as_view(),
        name="scene-conversion-list-create",
    ),
    path(
        "scene-conversions/<int:pk>/",
        SceneConversionDetailView.as_view(),
        name="scene-conversion-detail",
    ),
    path(
        "scene-conversions/<int:pk>/advance/",
        SceneConversionAdvanceView.as_view(),
        name="scene-conversion-advance",
    ),
    path(
        "scene-conversions/<int:pk>/cancel/",
        SceneConversionCancelView.as_view(),
        name="scene-conversion-cancel",
    ),
    path(
        "scene-conversions/<int:pk>/accept/",
        SceneConversionAcceptView.as_view(),
        name="scene-conversion-accept",
    ),
    # Issue #199: deliberately not project-scoped -- see art_piece_api.py's
    # module docstring for why.
    path(
        "ai/art-pieces/generate/",
        ArtPieceGenerateView.as_view(),
        name="art-piece-generate",
    ),
    path("art-pieces/", ArtPieceListCreateView.as_view(), name="art-piece-list-create"),
    path("art-pieces/<uuid:public_id>/", ArtPieceDetailView.as_view(), name="art-piece-detail"),
    path(
        "art-pieces/<uuid:public_id>/versions/",
        ArtPieceVersionListCreateView.as_view(),
        name="art-piece-version-list-create",
    ),
    path(
        "art-pieces/<uuid:public_id>/thumbnail.png",
        ArtPieceThumbnailView.as_view(),
        name="art-piece-thumbnail",
    ),
    path(
        "art-pieces/<uuid:public_id>/thumbnail/regenerate/",
        ArtPieceRegenerateThumbnailView.as_view(),
        name="art-piece-thumbnail-regenerate",
    ),
    path(
        "art-pieces/<uuid:public_id>/versions/<int:version_id>/thumbnail/",
        ArtPieceThumbnailUploadView.as_view(),
        name="art-piece-thumbnail-upload",
    ),
    path("public/art-pieces/", PublicArtPieceListView.as_view(), name="public-art-piece-list"),
    path(
        "public/art-pieces/<uuid:public_id>/",
        PublicArtPieceDetailView.as_view(),
        name="public-art-piece-detail",
    ),
    path(
        "public/art-pieces/<uuid:public_id>/thumbnail.png",
        PublicArtPieceThumbnailView.as_view(),
        name="public-art-piece-thumbnail",
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
    # #243: owner-facing gallery-card thumbnail (also now resolves for
    # anonymous/non-owner callers once a project is public -- issue #296
    # widened Action.PROJECT3D_READ; no separate public thumbnail route
    # needed).
    path(
        "projects3d/<uuid:public_id>/thumbnail/",
        Project3DThumbnailView.as_view(),
        name="project3d-thumbnail",
    ),
    # Issue #296: publish/unpublish + the public detail route, mirroring
    # the 2D "projects/<id>/publish/"/"unpublish/"/"public/projects/<id>/"
    # trio above.
    path(
        "projects3d/<uuid:public_id>/publish/",
        Project3DPublishView.as_view(),
        name="project3d-publish",
    ),
    path(
        "projects3d/<uuid:public_id>/unpublish/",
        Project3DUnpublishView.as_view(),
        name="project3d-unpublish",
    ),
    path(
        "public/projects3d/<uuid:public_id>/",
        PublicProject3DDetailView.as_view(),
        name="public-project3d-detail",
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
