"""Encryption helpers for per-user provider credentials."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernets() -> list[Fernet]:
    try:
        keys = [
            settings.MISTRAL_CREDENTIAL_ENCRYPTION_KEY,
            *settings.MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS,
        ]
        return [Fernet(key.encode("ascii")) for key in keys]
    except Exception as exc:
        raise RuntimeError("Mistral credential encryption is not configured correctly.") from exc


def encrypt_mistral_key(plaintext: str) -> bytes:
    return _fernets()[0].encrypt(plaintext.encode("utf-8"))


def decrypt_mistral_key(ciphertext: bytes) -> str:
    for fernet in _fernets():
        try:
            return fernet.decrypt(ciphertext).decode("utf-8")
        except (InvalidToken, UnicodeDecodeError):
            continue
    raise ValueError("Could not decrypt Mistral credential.")