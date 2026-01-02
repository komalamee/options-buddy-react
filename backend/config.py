"""Application configuration loaded from environment variables."""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Fallback: try parent directory
    load_dotenv()


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Environment mode: 'development' (default) or 'production'
    environment: str = os.environ.get('ENVIRONMENT', 'development')

    # IBKR Connection
    ibkr_host: str = "127.0.0.1"
    ibkr_port: int = 4001
    ibkr_client_id: int = 1
    ibkr_market_data_type: int = 2  # Frozen data (1=Live, 2=Frozen, 3=Delayed)

    # Database - SQLite for dev, PostgreSQL for production
    db_path: str = os.environ.get(
        'DB_PATH',
        os.path.join(os.path.dirname(__file__), 'data_store', 'options_buddy.db')
    )
    database_url: str = os.environ.get('DATABASE_URL', '')  # PostgreSQL URL for production

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # AI API Keys (optional)
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Production-only settings
    jwt_secret: str = os.environ.get('JWT_SECRET', '')  # Required in production
    jwt_expiry_days: int = 30  # 30-day persistent login
    resend_api_key: str = os.environ.get('RESEND_API_KEY', '')  # For magic link emails
    encryption_key: str = os.environ.get('ENCRYPTION_KEY', '')  # For API key encryption

    # Frontend URL for magic links
    frontend_url: str = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment.lower() == 'production'

    @property
    def use_postgres(self) -> bool:
        """Check if PostgreSQL should be used."""
        return bool(self.database_url) and self.is_production

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
