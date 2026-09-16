from django.db import migrations, models
from django.utils.text import slugify


def populate_slugs(apps, schema_editor):
    for model_name in ("Project", "Project3D", "ArtPiece"):
        model = apps.get_model("scenes", model_name)
        used = set()
        for item in model.objects.order_by("owner_id", "created_at", "id"):
            base = slugify(item.title)[:200] or "piece"
            candidate = base
            suffix = 2
            while (item.owner_id, candidate) in used:
                candidate = f"{base[: 220 - len(str(suffix)) - 1]}-{suffix}"
                suffix += 1
            item.public_slug = candidate
            item.save(update_fields=["public_slug"])
            used.add((item.owner_id, candidate))


class Migration(migrations.Migration):
    dependencies = [("scenes", "0070_style_presentation")]
    operations = [
        migrations.AddField(
            model_name="project",
            name="public_slug",
            field=models.SlugField(blank=True, default="", max_length=220),
        ),
        migrations.AddField(
            model_name="project3d",
            name="public_slug",
            field=models.SlugField(blank=True, default="", max_length=220),
        ),
        migrations.AddField(
            model_name="artpiece",
            name="public_slug",
            field=models.SlugField(blank=True, default="", max_length=220),
        ),
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.UniqueConstraint(
                fields=("owner", "public_slug"), name="unique_project_public_slug_per_owner"
            ),
        ),
        migrations.AddConstraint(
            model_name="project3d",
            constraint=models.UniqueConstraint(
                fields=("owner", "public_slug"), name="unique_project3d_public_slug_per_owner"
            ),
        ),
        migrations.AddConstraint(
            model_name="artpiece",
            constraint=models.UniqueConstraint(
                fields=("owner", "public_slug"), name="unique_artpiece_public_slug_per_owner"
            ),
        ),
    ]
