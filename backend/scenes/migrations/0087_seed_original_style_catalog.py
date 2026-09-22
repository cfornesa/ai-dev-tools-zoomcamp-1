from django.db import migrations

STYLE_SEEDS = [
    {
        "key": "traditional",
        "label": "Traditional",
        "description": "Serif body text with hairline borders.",
        "presentation": {
            "font_family": "serif",
            "density": "comfortable",
            "radius": "sharp",
            "border_style": "solid",
            "shadow": "none",
            "backdrop": "plain",
        },
    },
    {
        "key": "minimalist",
        "label": "Minimalist",
        "description": "Generous whitespace with no borders.",
        "presentation": {
            "font_family": "system",
            "density": "comfortable",
            "radius": "soft",
            "border_style": "none",
            "shadow": "none",
            "backdrop": "plain",
        },
    },
    {
        "key": "academic",
        "label": "Academic",
        "description": "Old-style serif with a scholarly feel.",
        "presentation": {
            "font_family": "serif",
            "density": "compact",
            "radius": "sharp",
            "border_style": "solid",
            "shadow": "none",
            "backdrop": "plain",
        },
    },
    {
        "key": "airy",
        "label": "Airy",
        "description": "Light weights, soft shadows, and rounded surfaces.",
        "presentation": {
            "font_family": "system",
            "density": "comfortable",
            "radius": "soft",
            "border_style": "none",
            "shadow": "soft",
            "backdrop": "plain",
        },
    },
    {
        "key": "nature",
        "label": "Nature",
        "description": "Friendly typography and organic surfaces.",
        "presentation": {
            "font_family": "system",
            "density": "comfortable",
            "radius": "soft",
            "border_style": "solid",
            "shadow": "soft",
            "backdrop": "gradient",
        },
    },
    {
        "key": "comfort",
        "label": "Comfort",
        "description": "Quicksand-like softness with pillowy corners.",
        "presentation": {
            "font_family": "system",
            "density": "comfortable",
            "radius": "pill",
            "border_style": "none",
            "shadow": "soft",
            "backdrop": "plain",
        },
    },
    {
        "key": "audacious",
        "label": "Audacious",
        "description": "Oversized borders and expressive contrast.",
        "presentation": {
            "font_family": "mono",
            "density": "compact",
            "radius": "sharp",
            "border_style": "solid",
            "shadow": "offset",
            "backdrop": "plain",
        },
    },
    {
        "key": "artistic",
        "label": "Artistic",
        "description": "Layered, expressive, and hand-drawn in spirit.",
        "presentation": {
            "font_family": "script",
            "density": "comfortable",
            "radius": "soft",
            "border_style": "dashed",
            "shadow": "soft",
            "backdrop": "gradient",
        },
    },
]


def seed_original_catalog(apps, schema_editor):
    ProfileStyle = apps.get_model("scenes", "ProfileStyle")
    for seed in STYLE_SEEDS:
        ProfileStyle.objects.update_or_create(
            key=seed["key"],
            defaults={
                "label": seed["label"],
                "description": seed["description"],
                "tokens": {
                    "light": {
                        "background": "#f8fafc",
                        "surface": "#ffffff",
                        "text": "#111827",
                        "muted": "#64748b",
                        "accent": "#7c3aed",
                    },
                    "dark": {
                        "background": "#0b0d12",
                        "surface": "#151923",
                        "text": "#f3f4f6",
                        "muted": "#9ca3af",
                        "accent": "#c084fc",
                    },
                },
                "presentation": seed["presentation"],
                "enabled": True,
                "revision": 1,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("scenes", "0086_shared_design_palettes")]
    operations = [migrations.RunPython(seed_original_catalog, migrations.RunPython.noop)]
