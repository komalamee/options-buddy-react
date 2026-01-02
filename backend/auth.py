"""Authentication module for Options Buddy production environment.

Provides:
- Magic link token generation and verification
- JWT token creation and validation
- User session management
"""

import secrets
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel

from config import settings


class User(BaseModel):
    """User model."""
    id: str
    email: str
    is_admin: bool = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user_id
    email: str
    is_admin: bool
    exp: datetime
    iat: datetime


def generate_magic_token() -> str:
    """Generate a secure random token for magic links."""
    return secrets.token_urlsafe(32)


def create_jwt_token(user: User) -> str:
    """Create a JWT token for authenticated user.

    Args:
        user: The authenticated user

    Returns:
        JWT token string
    """
    if not settings.jwt_secret:
        raise ValueError("JWT_SECRET not configured")

    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_expiry_days)

    payload = {
        "sub": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "exp": expire,
        "iat": now
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_jwt_token(token: str) -> Optional[TokenPayload]:
    """Verify and decode a JWT token.

    Args:
        token: JWT token string

    Returns:
        TokenPayload if valid, None otherwise
    """
    if not settings.jwt_secret:
        return None

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return TokenPayload(
            sub=payload["sub"],
            email=payload["email"],
            is_admin=payload.get("is_admin", False),
            exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_magic_link_url(token: str) -> str:
    """Generate the full magic link URL.

    Args:
        token: Magic link token

    Returns:
        Full URL for the magic link
    """
    return f"{settings.frontend_url}/auth/verify?token={token}"
