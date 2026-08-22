"""Re-encrypt all saved Mistral credentials with the active Fernet root."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from scenes.models import MistralCredential, MistralCredentialDecryptionError


class Command(BaseCommand):
    help = (
        "Re-encrypt saved Mistral credentials with MISTRAL_CREDENTIAL_ENCRYPTION_KEY. "
        "Keep previous roots configured until this completes without errors."
    )

    def handle(self, *args, **options):
        reencrypted = 0
        failures = 0
        credential_ids = MistralCredential.objects.values_list("pk", flat=True).iterator()
        for credential_id in credential_ids:
            try:
                with transaction.atomic():
                    # Lock and reload within the transaction rather than
                    # reusing the iterator's stale instance. A concurrent
                    # user replacement/delete consequently completes either
                    # before this fresh read or after this write; it can
                    # never be silently overwritten with older plaintext.
                    credential = MistralCredential.objects.select_for_update().get(pk=credential_id)
                    plaintext = credential.get_key()
                    credential.set_key(plaintext)
                    credential.save(update_fields=["encrypted_key", "updated_at"])
                reencrypted += 1
            except MistralCredential.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"Credential {credential_id} was deleted during rotation; it was skipped."
                    )
                )
            except MistralCredentialDecryptionError:
                failures += 1
                self.stderr.write(
                    self.style.ERROR(
                        f"Could not decrypt credential {credential_id}; it was left unchanged."
                    )
                )
        self.stdout.write(self.style.SUCCESS(f"Re-encrypted {reencrypted} credential(s)."))
        if failures:
            raise CommandError(f"{failures} credential(s) could not be decrypted.")
