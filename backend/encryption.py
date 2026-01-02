"""Encryption utilities for sensitive data storage.

Uses Fernet symmetric encryption for API keys at rest.
"""

from cryptography.fernet import Fernet, InvalidToken
from typing import Optional
import base64
import hashlib

from config import settings


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self):
        self._fernet: Optional[Fernet] = None

    def _get_fernet(self) -> Fernet:
        """Get or create Fernet instance."""
        if self._fernet is None:
            key = settings.encryption_key
            if not key:
                raise ValueError("ENCRYPTION_KEY not configured")

            # Ensure key is proper Fernet format (32 bytes, base64-encoded)
            if len(key) == 32:
                # Raw 32-byte key, need to base64 encode it
                key = base64.urlsafe_b64encode(key.encode()).decode()
            elif len(key) == 44:
                # Already base64-encoded, use as-is
                pass
            else:
                # Derive a proper key from arbitrary string
                key = base64.urlsafe_b64encode(
                    hashlib.sha256(key.encode()).digest()
                ).decode()

            self._fernet = Fernet(key.encode())

        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a plaintext string.

        Args:
            plaintext: The string to encrypt

        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return ""

        fernet = self._get_fernet()
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt an encrypted string.

        Args:
            ciphertext: Base64-encoded encrypted string

        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return ""

        try:
            fernet = self._get_fernet()
            decrypted = fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except InvalidToken:
            # Return empty string if decryption fails
            return ""

    def is_available(self) -> bool:
        """Check if encryption is properly configured."""
        return bool(settings.encryption_key)


# Singleton instance
encryption_service = EncryptionService()


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage."""
    if not encryption_service.is_available():
        # In development, store as-is (not recommended for production)
        return api_key
    return encryption_service.encrypt(api_key)


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key."""
    if not encryption_service.is_available():
        return encrypted_key
    return encryption_service.decrypt(encrypted_key)


def mask_api_key(api_key: str) -> str:
    """Mask an API key for display (show only last 4 characters)."""
    if not api_key or len(api_key) < 8:
        return "****"
    return f"{'*' * (len(api_key) - 4)}{api_key[-4:]}"
