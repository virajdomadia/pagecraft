"""Settings: every api/ env var from docs/04-technical-design.md §13 (v1 subset).

Secrets are `SecretStr | None` so the app imports and serves `/health` with no environment at all
(CI has no secrets) and never reprs a secret. Keys arrive just-in-time per plan row: Neon in S2,
Vercel Blob in F3. Without `BLOB_READ_WRITE_TOKEN` uploads fall back to Postgres (`uploads`
table, served at `/media/{id}`), so the editor works end to end before the Blob store exists.
"""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Database (Neon; any postgres URL, converted to asyncpg). TEST_DATABASE_URL: dev/CI. ---
    database_url: SecretStr | None = None
    test_database_url: SecretStr | None = None

    # --- Uploads (Vercel Blob) — F3. Unset → images are stored in Postgres. ---
    blob_read_write_token: SecretStr | None = None

    # --- Publish → web revalidate hook (F1/F4). Unset → publish skips the hook (ISR 60 s). ---
    revalidate_secret: SecretStr | None = None

    # --- Shared with web, which forwards the visitor's address with it (limits.client_ip). ---
    proxy_secret: SecretStr | None = None

    # --- Email (L4: invites, password resets) over SMTP. Unset → email is off: invites show
    # their link to the inviting owner instead, and password resets can't be sent. ---
    smtp_host: str | None = None
    smtp_port: int = 587  # STARTTLS
    smtp_user: str | None = None
    smtp_password: SecretStr | None = None
    mail_from: str | None = None  # e.g. "Pagecraft <hello@…>"; defaults to smtp_user

    # --- Cross-service ---
    # Where the web app lives: the revalidate hook and the secure-cookie decision.
    web_url: str = "http://localhost:3000"
    # The public host published sites hang off: `{slug}.{site_host}`; `/s/{slug}` works without it.
    site_host: str = "pagecraft.virajdomadia.com"


@lru_cache
def get_settings() -> Settings:
    """FastAPI dependency; cached so the env file is read once per process."""
    return Settings()
