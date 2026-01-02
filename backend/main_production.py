"""Production FastAPI backend with authentication and multi-user support.

This module wraps the main application and adds:
- Magic link authentication
- JWT session management
- User-scoped data access
- IBKR WebSocket relay

In development mode, this file is not used. Use main.py directly.
"""

from fastapi import FastAPI, HTTPException, Depends, Cookie, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from contextlib import asynccontextmanager
import logging

from config import settings
from auth import (
    User, generate_magic_token, create_jwt_token,
    verify_jwt_token, get_magic_link_url
)
from email_service import email_service
import database_pg as db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer(auto_error=False)


# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Options Buddy Production API")
    await db.init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    await db.close_pool()
    logger.info("Database connection pool closed")


# Create FastAPI app
app = FastAPI(
    title="Options Buddy API (Production)",
    description="Backend API for Options Buddy trading dashboard - Multi-user production version",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",  # Keep for testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== PYDANTIC MODELS ====================

class MagicLinkRequest(BaseModel):
    email: EmailStr


class VerifyTokenRequest(BaseModel):
    token: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None


class WhitelistAdd(BaseModel):
    email: EmailStr


# ==================== AUTH DEPENDENCY ====================

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_token: Optional[str] = Cookie(default=None)
) -> User:
    """Extract and validate user from JWT token.

    Accepts token from:
    1. Authorization header (Bearer token)
    2. auth_token cookie
    """
    token = None

    # Try Authorization header first
    if credentials:
        token = credentials.credentials

    # Fall back to cookie
    if not token and auth_token:
        token = auth_token

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_data = await db.get_user_by_id(payload.sub)
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")

    return User(
        id=str(user_data['id']),
        email=user_data['email'],
        is_admin=user_data.get('is_admin', False),
        created_at=user_data.get('created_at'),
        last_login=user_data.get('last_login')
    )


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_token: Optional[str] = Cookie(default=None)
) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising."""
    try:
        return await get_current_user(request, credentials, auth_token)
    except HTTPException:
        return None


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require the current user to be an admin."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== PUBLIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {
        "name": "Options Buddy API",
        "version": "2.0.0",
        "environment": "production",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "environment": "production"}


# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/magic-link", response_model=AuthResponse)
async def request_magic_link(request: MagicLinkRequest):
    """Request a magic link for email-based authentication."""
    email = request.email.lower()

    # Check whitelist
    if not await db.is_email_whitelisted(email):
        # Don't reveal whether email exists or not
        return AuthResponse(
            success=True,
            message="If this email is registered, you will receive a sign-in link shortly."
        )

    try:
        # Get or create user
        user_data = await db.get_or_create_user(email)

        # Generate magic token
        token = generate_magic_token()
        await db.create_magic_token(user_data['id'], token)

        # Send email
        magic_link_url = get_magic_link_url(token)
        await email_service.send_magic_link(email, magic_link_url)

        return AuthResponse(
            success=True,
            message="Check your email for a sign-in link."
        )

    except Exception as e:
        logger.error(f"Magic link request failed: {e}")
        return AuthResponse(
            success=True,  # Don't reveal errors
            message="If this email is registered, you will receive a sign-in link shortly."
        )


@app.post("/api/auth/verify")
async def verify_magic_link(request: VerifyTokenRequest, response: Response):
    """Verify a magic link token and return JWT."""
    user_id = await db.verify_magic_token(request.token)

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Get user data
    user_data = await db.get_user_by_id(user_id)
    if not user_data:
        raise HTTPException(status_code=400, detail="User not found")

    # Update last login
    await db.update_user_last_login(user_id)

    # Create user object
    user = User(
        id=str(user_data['id']),
        email=user_data['email'],
        is_admin=user_data.get('is_admin', False)
    )

    # Generate JWT
    jwt_token = create_jwt_token(user)

    # Set httpOnly cookie (30 days)
    response.set_cookie(
        key="auth_token",
        value=jwt_token,
        httponly=True,
        secure=True,  # HTTPS only in production
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "is_admin": user.is_admin
        },
        "token": jwt_token  # Also return token for clients that prefer headers
    }


@app.get("/api/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin
    }


@app.post("/api/auth/logout")
async def logout(response: Response):
    """Log out by clearing the auth cookie."""
    response.delete_cookie("auth_token")
    return {"success": True, "message": "Logged out"}


# ==================== ADMIN ENDPOINTS ====================

@app.get("/api/admin/whitelist")
async def get_whitelist(admin: User = Depends(require_admin)):
    """Get all whitelisted emails (admin only)."""
    return await db.get_whitelist()


@app.post("/api/admin/whitelist")
async def add_to_whitelist(request: WhitelistAdd, admin: User = Depends(require_admin)):
    """Add an email to the whitelist (admin only)."""
    success = await db.add_email_to_whitelist(request.email, admin.id)
    if not success:
        raise HTTPException(status_code=400, detail="Email already whitelisted")
    return {"success": True, "message": f"Added {request.email} to whitelist"}


@app.delete("/api/admin/whitelist/{email}")
async def remove_from_whitelist(email: str, admin: User = Depends(require_admin)):
    """Remove an email from the whitelist (admin only)."""
    success = await db.remove_email_from_whitelist(email)
    if not success:
        raise HTTPException(status_code=404, detail="Email not found in whitelist")
    return {"success": True, "message": f"Removed {email} from whitelist"}


# ==================== USER-SCOPED ENDPOINTS ====================

# These endpoints require authentication and scope data to the current user

@app.get("/api/positions")
async def get_positions(
    status: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get positions for current user."""
    if status == "open":
        return await db.get_open_positions(user.id)
    elif status == "closed":
        return await db.get_closed_positions(user.id)
    else:
        open_pos = await db.get_open_positions(user.id)
        closed_pos = await db.get_closed_positions(user.id)
        return {"open": open_pos, "closed": closed_pos}


@app.get("/api/holdings")
async def get_holdings(user: User = Depends(get_current_user)):
    """Get stock holdings for current user."""
    return await db.get_stock_holdings(user.id)


@app.get("/api/watchlists")
async def get_watchlists(user: User = Depends(get_current_user)):
    """Get watchlists for current user."""
    return await db.get_watchlists(user.id)


@app.get("/api/performance")
async def get_performance(user: User = Depends(get_current_user)):
    """Get performance stats for current user."""
    return await db.get_performance_stats(user.id)


@app.get("/api/settings")
async def get_settings(user: User = Depends(get_current_user)):
    """Get all settings for current user."""
    return await db.get_all_settings(user.id)


@app.post("/api/settings")
async def update_setting(
    key: str,
    value: str,
    user: User = Depends(get_current_user)
):
    """Update a setting for current user."""
    await db.set_setting(user.id, key, value)
    return {"success": True}


# ==================== IMPORT MAIN APP ROUTES ====================

# For non-user-scoped routes (market data, IBKR status, etc.),
# we import and mount from the main app
# These don't require user context

from main import app as main_app

# Re-export market endpoints that don't need user context
# These are proxied through to the main app

@app.get("/api/market/status")
async def market_status(user: User = Depends(get_current_user)):
    """Get market status (requires auth but not user-scoped)."""
    # Import the actual implementation
    from main import get_market_status
    return await get_market_status()


@app.get("/api/market/price/{symbol}")
async def market_price(symbol: str, user: User = Depends(get_current_user)):
    """Get current price for a symbol."""
    from main import get_stock_price
    return await get_stock_price(symbol)


# TODO: Add more proxied endpoints as needed
# The full implementation would wrap all main.py endpoints with auth


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main_production:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
