from django.db import migrations


_SEEDED_ART_PIECE_MODELS = {
    ("mistral", "mistral-small-latest"),
    ("gemini", "gemini-2.5-flash"),
    ("gemini", "gemini-2.5-pro"),
    ("deepseek", "deepseek-chat"),
    ("deepseek", "deepseek-reasoner"),
}


def add_art_piece_task_kind(apps, schema_editor):
    AIProviderModel = apps.get_model("scenes", "AIProviderModel")
    for row in AIProviderModel.objects.filter(active=True):
        if (row.vendor, row.model_slug) not in _SEEDED_ART_PIECE_MODELS:
            continue
        task_kinds = list(row.task_kinds or [])
        if "art_piece" not in task_kinds:
            row.task_kinds = sorted({*task_kinds, "art_piece"})
            row.revision += 1
            row.save(update_fields=["task_kinds", "revision", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("scenes", "0091_artpiece_visibility_slug_constraints")]

    operations = [migrations.RunPython(add_art_piece_task_kind, migrations.RunPython.noop)]
