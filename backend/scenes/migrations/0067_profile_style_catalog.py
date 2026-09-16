from django.db import migrations, models
import django.db.models.deletion


STYLE_SEEDS = [
    {
        "key": "default",
        "label": "Midnight",
        "description": "The original AugmentrART dark palette.",
        "tokens": {
            "background": "#0b0d12",
            "surface": "#151923",
            "text": "#f3f4f6",
            "muted": "#9ca3af",
            "accent": "#c084fc",
        },
    },
    {
        "key": "ocean",
        "label": "Ocean",
        "description": "A cool blue studio palette.",
        "tokens": {
            "background": "#07111f",
            "surface": "#0f2338",
            "text": "#e5f3ff",
            "muted": "#8fb4cc",
            "accent": "#38bdf8",
        },
    },
    {
        "key": "forest",
        "label": "Forest",
        "description": "A high-contrast green palette.",
        "tokens": {
            "background": "#071611",
            "surface": "#10251b",
            "text": "#ecfdf5",
            "muted": "#9cc9b0",
            "accent": "#34d399",
        },
    },
    {
        "key": "sunset",
        "label": "Sunset",
        "description": "A warm plum and amber palette.",
        "tokens": {
            "background": "#1b1015",
            "surface": "#2d1721",
            "text": "#fff7ed",
            "muted": "#d6a9a0",
            "accent": "#fb923c",
        },
    },
]


def seed_styles(apps, schema_editor):
    ProfileStyle = apps.get_model("scenes", "ProfileStyle")
    PublicProfile = apps.get_model("scenes", "PublicProfile")
    for seed in STYLE_SEEDS:
        style, _ = ProfileStyle.objects.update_or_create(
            key=seed["key"], defaults={**seed, "revision": 1, "enabled": True}
        )
        PublicProfile.objects.filter(style__isnull=True).update(style=style)


class Migration(migrations.Migration):
    dependencies = [("scenes", "0066_publicprofilehandleredirect")]

    operations = [
        migrations.CreateModel(
            name="ProfileStyle",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("key", models.SlugField(max_length=48, unique=True)),
                ("label", models.CharField(max_length=80)),
                ("description", models.CharField(blank=True, default="", max_length=240)),
                ("tokens", models.JSONField(default=dict)),
                ("enabled", models.BooleanField(default=True)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["key"]},
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="style",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="profiles",
                to="scenes.profilestyle",
            ),
        ),
        migrations.RunPython(seed_styles, migrations.RunPython.noop),
    ]
