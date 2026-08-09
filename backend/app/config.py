"""
Centralized application configuration.

All runtime configuration flows through this single `Settings` object so
that no module reaches into `os.environ` directly. This keeps config
testable (override via constructor / env vars in tests) and keeps the
"what can I configure" surface in one place.
"""
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

    # --- Demo mode (LLM only) ---
    # When true, agents call MockLLMProvider instead of Groq so the pipeline
    # works end-to-end with zero Groq credentials. This is independent of
    # DataHub, which has its own three-way mode below
    # (DATAHUB_ACCESS_MODE / datahub_access_mode_effective) — DataHub goes
    # live the moment DATAHUB_GMS_URL is set, regardless of DEMO_MODE.
    DEMO_MODE: bool = True

    # --- Database (Postgres from day one; asyncpg driver) ---
    DATABASE_URL: str = (
        "postgresql+asyncpg://atlas:atlas@localhost:5432/atlas"
    )
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # --- LLM provider: Groq (OpenAI-compatible chat completions) ---
    GROQ_API_KEY: str | None = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    # Groq's current best general-purpose model for structured JSON tasks.
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_MAX_RETRIES: int = 2

    # --- DataHub (metadata knowledge graph) ---
    DATAHUB_GMS_URL: str | None = None  # e.g. http://localhost:8080
    DATAHUB_TOKEN: str | None = None
    DATAHUB_TIMEOUT_SECONDS: float = 20.0

    # How Atlas talks to DataHub. "mcp" (default when DATAHUB_GMS_URL is
    # set) routes every read/write through mcp-server-datahub — this is
    # the primary, hackathon-relevant path. "direct" falls back to raw
    # GraphQL/REST (DataHubRestGateway) — kept as an escape hatch if the
    # MCP server isn't installed/working, not the intended default. "mock"
    # is forced automatically when no DATAHUB_GMS_URL is configured at
    # all, regardless of this setting — there's nothing to connect to.
    DATAHUB_ACCESS_MODE: Literal["mcp", "direct"] = "mcp"

    # Pure UX framing for the frontend's workspace setup — does NOT change
    # which gateway class is used (that's DATAHUB_ACCESS_MODE +
    # DATAHUB_GMS_URL above). "demo" and "existing" both connect to
    # whatever DATAHUB_GMS_URL points at; the distinction is only in how
    # the frontend explains the connection to the user. "fresh" means the
    # same thing as "existing" mechanically — Atlas doesn't provision a
    # new DataHub instance for you, "fresh" just means point
    # DATAHUB_GMS_URL at an instance you've started with nothing ingested.
    DATAHUB_WORKSPACE_MODE: Literal["demo", "existing", "fresh"] = "demo"

    @property
    def datahub_access_mode_effective(self) -> Literal["mcp", "direct", "mock"]:
        if not self.DATAHUB_GMS_URL:
            return "mock"
        return self.DATAHUB_ACCESS_MODE

    # --- CORS ---
    # Deliberately typed as `str`, not `list[str]`: pydantic-settings
    # attempts a JSON-decode on any list-typed field's raw env value
    # *before* field_validator("before") ever runs, so a plain
    # comma-separated ".env" value (CORS_ORIGINS=http://a,http://b) fails
    # to parse as JSON and crashes startup. Storing the raw string and
    # splitting it via a computed property sidesteps that entirely.
    CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    @property
    def CORS_ORIGINS(self) -> list[str]:  # noqa: N802 — matches env var casing
        return [o.strip() for o in self.CORS_ORIGINS_RAW.split(",") if o.strip()]

    # --- Derived / computed flags ---
    @property
    def llm_demo_mode(self) -> bool:
        """True if we should use the mock LLM provider."""
        return self.DEMO_MODE or not self.GROQ_API_KEY


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton. Tests can call get_settings.cache_clear()."""
    return Settings()
