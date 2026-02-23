"""Firebase ID token verification for admin-only API access.

This API expects a Firebase **ID token** (from the frontend) in:
  Authorization: Bearer <token>

Important:
- The Firebase ID token `aud` claim is the Firebase **Project ID**, not the Web App ID.
- We therefore verify with `FIREBASE_PROJECT_ID`.
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.settings import get_settings


def get_firebase_user(
    request: Request,
) -> dict[str, Any]:
    """
    Verify Authorization Bearer token as Firebase ID token and return decoded claims.
    If FIREBASE_PROJECT_ID is not set (e.g. local dev), skip verification and return a dummy dict.
    """
    settings = get_settings()
    if not settings.FIREBASE_PROJECT_ID:
        # If someone set the old/incorrect setting, fail fast instead of silently
        # bypassing auth in a misconfigured production environment.
        if settings.FIREBASE_APP_ID:
            raise HTTPException(
                status_code=500,
                detail="Server misconfigured: set FIREBASE_PROJECT_ID (Firebase Project ID) for auth enforcement",
            )
        return {"sub": "dev", "email": "dev@local"}

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        req = google_requests.Request()
        claims = id_token.verify_firebase_token(
            token,
            req,
            audience=settings.FIREBASE_PROJECT_ID,
        )
        return claims
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
