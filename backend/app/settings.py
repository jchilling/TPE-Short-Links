from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default supports "local-first" dev (docker compose Postgres).
    DATABASE_URL: str = "postgresql+psycopg://tpe:tpe@localhost:5432/tpe_short_links"
    ALLOW_HTTP_URLS: bool = False
    SHORTLINK_CODE_LENGTH: int = 4
    RESERVED_CODES: str = ""
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    def reserved_codes_set(self) -> set[str]:
        raw = (self.RESERVED_CODES or "").strip()
        if not raw:
            return set()
        return {c.strip() for c in raw.split(",") if c.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()

