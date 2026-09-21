from django.db import migrations


CELESTIAL_STYLE = {
    "key": "celestial",
    "label": "Celestial",
    "description": "A cosmic deep-teal and plum style with script headings and gold accents.",
    "tokens": {
        "light": {
            "background": "#f4ead3",
            "surface": "#fff8e7",
            "text": "#2b1e1a",
            "muted": "#6f6258",
            "accent": "#b8892e",
        },
        "dark": {
            "background": "#071b2a",
            "surface": "#2a1238",
            "text": "#f8edd3",
            "muted": "#c8bca5",
            "accent": "#e4b95c",
        },
    },
    "presentation": {
        "font_family": "script",
        "density": "comfortable",
        "radius": "soft",
        "border_style": "solid",
        "shadow": "soft",
        "backdrop": "cosmic",
    },
    "enabled": True,
    "revision": 1,
}


def seed_celestial(apps, schema_editor):
    ProfileStyle = apps.get_model("scenes", "ProfileStyle")
    ProfileStyle.objects.update_or_create(key=CELESTIAL_STYLE["key"], defaults=CELESTIAL_STYLE)


class Migration(migrations.Migration):
    dependencies = [("scenes", "0081_seed_pareto_style")]

    operations = [migrations.RunPython(seed_celestial, migrations.RunPython.noop)]
