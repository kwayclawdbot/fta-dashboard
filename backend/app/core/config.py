from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Database (async postgres via asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/family_trading_academy"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CHALLENGE_PRICE_ID: str = ""
    STRIPE_ACADEMY_PRICE_ID: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # OpenAI (TTS for coach voice responses)
    OPENAI_API_KEY: str = ""

    # Auth
    JWT_SECRET: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
