"""Keep existing production rows while Replit synchronizes added fields."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0076_alter_mistralmodelpreference_vendor")]

    operations = [
        migrations.SeparateDatabaseAndState(
            # These columns are nullable in the physical development schema so
            # Replit can add them to populated production tables without a
            # table-wide truncate. The model state remains unchanged: defaults
            # and application validation continue to provide values for new
            # writes, while legacy rows can be backfilled separately.
            database_operations=[
                migrations.AlterField(
                    model_name="project",
                    name="public_slug",
                    field=models.SlugField(blank=True, default="", max_length=220, null=True),
                ),
                migrations.AlterField(
                    model_name="project3d",
                    name="public_slug",
                    field=models.SlugField(blank=True, default="", max_length=220, null=True),
                ),
                migrations.AlterField(
                    model_name="artpiece",
                    name="public_slug",
                    field=models.SlugField(blank=True, default="", max_length=220, null=True),
                ),
                migrations.AlterField(
                    model_name="page",
                    name="seo_config",
                    field=models.JSONField(blank=True, default=dict, null=True),
                ),
                migrations.AlterField(
                    model_name="collection",
                    name="seo_config",
                    field=models.JSONField(blank=True, default=dict, null=True),
                ),
                migrations.AlterField(
                    model_name="artpiece",
                    name="seo_config",
                    field=models.JSONField(blank=True, default=dict, null=True),
                ),
                migrations.AlterField(
                    model_name="sitesettings",
                    name="site_description",
                    field=models.TextField(blank=True, default="", max_length=500, null=True),
                ),
                migrations.AlterField(
                    model_name="sitesettings",
                    name="metadata_tags",
                    field=models.JSONField(default=list, blank=True, null=True),
                ),
            ],
            state_operations=[],
        )
    ]
