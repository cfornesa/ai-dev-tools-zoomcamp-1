from django.urls import path

from scenes.api import (
    BlankProjectCreateView,
    ProjectDetailView,
    ProjectListCreateView,
    SceneVersionDetailView,
    SceneVersionListCreateView,
    SceneVersionRestoreView,
)

urlpatterns = [
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/blank/", BlankProjectCreateView.as_view(), name="project-create-blank"),
    path("projects/<uuid:public_id>/", ProjectDetailView.as_view(), name="project-detail"),
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
]
