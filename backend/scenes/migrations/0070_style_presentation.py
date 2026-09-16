from django.db import migrations, models
import django.db.models.deletion


STYLE_PRESENTATION = {
    "font_family": "system",
    "density": "comfortable",
    "radius": "soft",
    "border_style": "solid",
}


def seed_presentation(apps, schema_editor):
    ProfileStyle = apps.get_model("scenes", "ProfileStyle")
    SiteSettings = apps.get_model("scenes", "SiteSettings")
    ProfileStyle.objects.all().update(presentation=STYLE_PRESENTATION)
    ProfileStyle.objects.filter(key="default").update(presentation=STYLE_PRESENTATION)
    ProfileStyle.objects.update_or_create(
        key="bauhaus",
        defaults={
            "label": "Bauhaus",
            "description": "A geometric, high-contrast studio style.",
            "tokens": {
                "background": "#f4efe6",
                "surface": "#fffaf0",
                "text": "#1f2937",
                "muted": "#6b7280",
                "accent": "#dc2626",
            },
            "presentation": {
                "font_family": "system",
                "density": "compact",
                "radius": "sharp",
                "border_style": "solid",
            },
            "enabled": True,
            "revision": 1,
        },
    )
    ProfileStyle.objects.update_or_create(
        key="minimal",
        defaults={
            "label": "Minimal",
            "description": "A restrained, spacious presentation.",
            "tokens": {
                "background": "#ffffff",
                "surface": "#f8fafc",
                "text": "#111827",
                "muted": "#64748b",
                "accent": "#334155",
            },
            "presentation": {
                "font_family": "serif",
                "density": "comfortable",
                "radius": "soft",
                "border_style": "none",
            },
            "enabled": True,
            "revision": 1,
        },
    )
    default = ProfileStyle.objects.filter(key="default").first()
    SiteSettings.objects.filter(style__isnull=True).update(style=default)


class Migration(migrations.Migration):
    dependencies = [("scenes", "0069_owner_collections")]
    operations = [
        migrations.AddField(
            model_name="profilestyle",
            name="presentation",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="style",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="site_settings",
                to="scenes.profilestyle",
            ),
        ),
        migrations.RunPython(seed_presentation, migrations.RunPython.noop),
    ]
