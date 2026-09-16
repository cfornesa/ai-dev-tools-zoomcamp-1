import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0068_vendor_aware_model_preferences"),
    ]

    operations = [
        migrations.CreateModel(
            name="Collection",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "public_id",
                    models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
                ),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("slug", models.SlugField(max_length=120)),
                (
                    "visibility",
                    models.CharField(
                        choices=[("private", "Private"), ("public", "Public")],
                        default="private",
                        max_length=10,
                    ),
                ),
                ("published_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="collections",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["visibility", "-published_at", "-id"],
                        name="collection_public_gallery_idx",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="CollectionItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("project", "2D project"),
                            ("project3d", "3D project"),
                            ("art_piece", "Generated art piece"),
                        ],
                        max_length=20,
                    ),
                ),
                ("item_id", models.UUIDField()),
                ("position", models.PositiveIntegerField()),
                (
                    "collection",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="items",
                        to="scenes.collection",
                    ),
                ),
            ],
            options={"ordering": ["position", "id"]},
        ),
        migrations.AddConstraint(
            model_name="collection",
            constraint=models.UniqueConstraint(
                fields=("owner", "slug"), name="unique_collection_slug_per_owner"
            ),
        ),
        migrations.AddConstraint(
            model_name="collectionitem",
            constraint=models.UniqueConstraint(
                fields=("collection", "position"), name="unique_collection_item_position"
            ),
        ),
        migrations.AddConstraint(
            model_name="collectionitem",
            constraint=models.UniqueConstraint(
                fields=("collection", "kind", "item_id"), name="unique_collection_item_ref"
            ),
        ),
    ]
