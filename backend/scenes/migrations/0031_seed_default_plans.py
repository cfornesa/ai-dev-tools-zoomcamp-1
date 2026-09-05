# Generated for issue #422/#423: seed the two plan rows every existing
# user implicitly used before Plan existed as a persisted model --
# `daily_ai_requests=50` for every feature key matches the pre-#422
# create/edit defaults exactly (art generation's separate 20/day default
# is consolidated onto this one admin-editable number, per #422's own
# design -- see scenes/entitlements.py and scenes/art_piece_api.py). A
# fresh install with no seeded "free" plan denies every AI feature by
# design (get_effective_cap fails closed), so this data migration keeps
# that from being every deployment's default state.

from django.db import migrations

FREE_DAILY_AI_REQUESTS = 50
PAID_DAILY_AI_REQUESTS = 200
FEATURE_KEYS = ["ai_scene_create", "ai_scene_edit", "ai_art_generate"]


def seed_default_plans(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    Plan.objects.get_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": FREE_DAILY_AI_REQUESTS,
            "feature_keys": FEATURE_KEYS,
            "active": True,
        },
    )
    Plan.objects.get_or_create(
        plan_key="paid",
        defaults={
            "daily_ai_requests": PAID_DAILY_AI_REQUESTS,
            "feature_keys": FEATURE_KEYS,
            "active": True,
        },
    )


def unseed_default_plans(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    Plan.objects.filter(plan_key__in=["free", "paid"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("scenes", "0030_admin_settings"),
    ]

    operations = [
        migrations.RunPython(seed_default_plans, unseed_default_plans),
    ]
