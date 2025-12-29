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

    # IBKR Connection
    ibkr_host: str = "127.0.0.1"
    ibkr_port: int = 4001
    ibkr_client_id: int = 1
    ibkr_market_data_type: int = 2  # Frozen data (1=Live, 2=Frozen, 3=Delayed)

    # Database path - defaults to data_store folder in backend
    db_path: str = os.environ.get(
        'DB_PATH',
        os.path.join(os.path.dirname(__file__), 'data_store', 'options_buddy.db')
    )

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # AI API Keys (optional)
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
