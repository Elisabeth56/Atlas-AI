"""All runtime configuration, read from the environment once and validated at boot."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    APP_NAME: str = "Atlas AI Backend"
    ENVIRONMENT: Literal["development", "production", "test"] = "development"

    # Mock LLM responses. DataHub is separate: it goes live whenever DATAHUB_GMS_URL is set.
    DEMO_MODE: bool = True

    # --- Auth ---
    # "off" skips sign-in and puts every run in the demo workspace: local development only.
    AUTH_MODE: Literal["supabase", "off"] = "supabase"
    SUPABASE_URL: str | None = None  # verifies tokens against the project's JWKS
    SUPABASE_JWT_SECRET: str | None = None  # legacy HS256 projects and tests
    DEMO_WORKSPACE_ID: str = "00000000-0000-0000-0000-0000000000d0"  # matches supabase/seed.sql
    RUNS_PER_HOUR: int = 10

    # --- Worker ---
    # The API process runs the job loop (app/worker.py). Tests turn it off and drive phases directly.
    WORKER_ENABLED: bool = True

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://atlas:atlas@localhost:5432/atlas"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # --- LLM providers, tried in this order; any without a key is skipped (app/llm/chain.py) ---
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    CEREBRAS_API_KEY: str | None = None
    CEREBRAS_MODEL: str = "gpt-oss-120b"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    LLM_TIMEOUT_SECONDS: float = 60.0

    # --- DataHub ---
    DATAHUB_GMS_URL: str | None = None  # e.g. http://localhost:8080
    DATAHUB_TOKEN: str | None = None
    DATAHUB_TIMEOUT_SECONDS: float = 20.0

    @property
    def datahub_mode(self) -> Literal["mcp", "mock"]:
        """mcp when a DataHub URL is configured, otherwise the seeded sample catalog."""
        return "mcp" if self.DATAHUB_GMS_URL else "mock"

    # --- CORS ---
    # a str, not list[str]: pydantic-settings JSON-decodes list fields, which breaks "a,b" values
    CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    @property
    def CORS_ORIGINS(self) -> list[str]:  # noqa: N802 — matches env var casing
        return [o.strip() for o in self.CORS_ORIGINS_RAW.split(",") if o.strip()]

    # Vercel preview URLs change per branch, so they're matched by pattern, e.g.
    # https://atlas-ai-[a-z0-9-]+-elisabeth-nnamanis-projects\.vercel\.app
    CORS_ORIGIN_REGEX: str | None = None

    # --- Derived / computed flags ---
    @property
    def llm_demo_mode(self) -> bool:
        """True if we should use the mock LLM provider."""
        return self.DEMO_MODE or not (
            self.GROQ_API_KEY or self.CEREBRAS_API_KEY or self.GEMINI_API_KEY
        )


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton. Tests can call get_settings.cache_clear()."""
    return Settings()
