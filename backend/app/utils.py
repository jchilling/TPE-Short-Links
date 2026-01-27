from __future__ import annotations

import datetime as dt
import secrets
import string
from urllib.parse import urlparse

from fastapi import HTTPException

ALPHABET = string.ascii_letters + string.digits  # A-Z a-z 0-9


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def validate_original_url(url: str, *, allow_http: bool) -> None:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=422, detail="original_url must be an absolute URL")
    if parsed.scheme not in ("https", "http"):
        raise HTTPException(status_code=422, detail="original_url must be http(s)")
    if parsed.scheme == "http" and not allow_http:
        raise HTTPException(status_code=422, detail="http:// URLs are not allowed")


def validate_expires_at(expires_at: dt.datetime | None) -> None:
    if expires_at is None:
        return
    if expires_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="expires_at must be timezone-aware")
    if expires_at <= now_utc():
        raise HTTPException(status_code=422, detail="expires_at must be in the future")


def generate_code(length: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))

