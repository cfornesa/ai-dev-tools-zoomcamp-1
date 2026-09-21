from django.db import migrations


PARETO_STYLE = {
    "key": "pareto",
    "label": "Pareto",
    "description": "A geometric indigo style with hard borders and offset shadows.",
    "tokens": {
        "light": {
            "background": "#f4f5ff",
            "surface": "#ffffff",
            "text": "#17172b",
            "muted": "#545476",
            "accent": "#4f46e5",
        },
        "dark": {
            "background": "#101226",
            "surface": "#181b3a",
            "text": "#f4f5ff",
            "muted": "#aab0d6",
            "accent": "#818cf8",
        },
    },
    "presentation": {
        "font_family": "system",
        "density": "comfortable",
        "radius": "sharp",
        "border_style": "solid",
        "shadow": "offset",
        "backdrop": "plain",
    },
    "enabled": True,
    "revision": 1,
}


def seed_pareto(apps, schema_editor):
    ProfileStyle = apps.get_model("scenes", "ProfileStyle")
    ProfileStyle.objects.update_or_create(key=PARETO_STYLE["key"], defaults=PARETO_STYLE)


class Migration(migrations.Migration):
    dependencies = [("scenes", "0080_collection_slug_redirect")]

    operations = [migrations.RunPython(seed_pareto, migrations.RunPython.noop)]
