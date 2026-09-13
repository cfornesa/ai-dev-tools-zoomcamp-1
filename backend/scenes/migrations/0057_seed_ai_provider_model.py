from django.db import migrations

# Mirrors `ai_provider.registry.PROVIDERS`' currently-implemented defaults.
# Seeded as agentic_supported=True for both task kinds so that deploying
# this catalog (issue #523) does not silently break the bounded 2D/3D agent
# workflows (#461-#463) that already work today for these models -- an
# admin can subsequently narrow or disable any entry. Any other
# user-declared model slug (e.g. via `MistralModelPreference`) simply has
# no catalog entry yet and is not agent-eligible until an admin adds one;
# one-shot generation is unaffected either way.
_SEED_MODELS = [
    ("mistral", "mistral-small-latest", "Mistral Small (default)"),
    ("gemini", "gemini-2.5-flash", "Gemini 2.5 Flash"),
    ("gemini", "gemini-2.5-pro", "Gemini 2.5 Pro"),
    ("deepseek", "deepseek-chat", "DeepSeek Chat"),
    ("deepseek", "deepseek-reasoner", "DeepSeek Reasoner"),
]


def seed_models(apps, schema_editor):
    AIProviderModel = apps.get_model("scenes", "AIProviderModel")
    for vendor, model_slug, display_label in _SEED_MODELS:
        AIProviderModel.objects.get_or_create(
            vendor=vendor,
            model_slug=model_slug,
            active=True,
            defaults={
                "display_label": display_label,
                "task_kinds": ["one_shot_2d", "one_shot_3d", "agent_2d", "agent_3d"],
                "agentic_supported": True,
                "revision": 1,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("scenes", "0056_ai_provider_model")]
    operations = [migrations.RunPython(seed_models, migrations.RunPython.noop)]
