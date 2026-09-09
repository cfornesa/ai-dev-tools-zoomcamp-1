"""Consolidate legacy `MistralCredential` rows into owner-scoped
`ProviderCredential(vendor="mistral")` rows (issue #498), then drop the
legacy table.

Ciphertext is copied verbatim between the two stores: both use the same
Fernet active-plus-previous-root key ring (`ai_provider.credentials`), so
no plaintext is ever decrypted, encrypted, logged, or persisted by this
migration. On a collision -- the owner already has a generic Mistral row
-- the generic row wins deterministically: it is left untouched, the
legacy row is removed, and a non-secret disposition (user id and reason
only) is written to stdout before the table drops.

Forward is atomic: either every legacy row is handled and the table
drops, or the transaction rolls back and nothing changes. The reverse
recreates the legacy table exactly as migration 0016 defined it and
restores one legacy row per generic Mistral row by verbatim ciphertext
copy, so a rollback needs no plaintext either. Legacy rows disposed as
generic-wins are intentionally not restored -- the generic row remains
the authoritative credential for those owners.
"""

from django.db import migrations


def migrate_legacy_to_provider(apps, schema_editor):
    MistralCredential = apps.get_model("scenes", "MistralCredential")
    ProviderCredential = apps.get_model("scenes", "ProviderCredential")
    alias = schema_editor.connection.alias

    migrated = 0
    generic_wins = 0
    for legacy in MistralCredential.objects.using(alias).all().iterator():
        existing = ProviderCredential.objects.using(alias).filter(
            owner_id=legacy.user_id, vendor="mistral"
        )
        if existing.exists():
            generic_wins += 1
            print(
                f"Legacy Mistral credential for user {legacy.user_id} skipped: "
                'an existing ProviderCredential(vendor="mistral") row is kept '
                "as the authoritative credential."
            )
        else:
            ProviderCredential.objects.using(alias).create(
                owner_id=legacy.user_id,
                vendor="mistral",
                encrypted_key=legacy.encrypted_key,
            )
            migrated += 1
        # Every legacy row is removed here, before DeleteModel drops the
        # table, so no row is ever left unhandled.
        legacy.delete()

    print(
        f"Migrated {migrated} legacy Mistral credential(s) into "
        f"ProviderCredential(vendor=\"mistral\"); {generic_wins} legacy row(s) "
        "removed in favor of existing generic credentials."
    )


def restore_legacy_from_provider(apps, schema_editor):
    MistralCredential = apps.get_model("scenes", "MistralCredential")
    ProviderCredential = apps.get_model("scenes", "ProviderCredential")
    alias = schema_editor.connection.alias

    restored = 0
    for provider in ProviderCredential.objects.using(alias).filter(vendor="mistral").iterator():
        # The legacy table was just recreated empty by the reverse of
        # DeleteModel, so a collision cannot occur; get_or_create keeps a
        # replay of this migration idempotent regardless.
        _, created = MistralCredential.objects.using(alias).get_or_create(
            user_id=provider.owner_id,
            defaults={"encrypted_key": provider.encrypted_key},
        )
        if created:
            restored += 1

    print(f"Restored {restored} legacy Mistral credential(s) from generic credentials.")


class Migration(migrations.Migration):

    dependencies = [
        ("scenes", "0035_ai_run"),
    ]

    operations = [
        # Order matters: forward runs the data move first and then drops
        # the table; reverse recreates the table first and then restores
        # the data into it.
        migrations.RunPython(migrate_legacy_to_provider, restore_legacy_from_provider),
        migrations.DeleteModel(name="MistralCredential"),
    ]
