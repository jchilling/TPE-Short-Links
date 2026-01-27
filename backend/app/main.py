from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ReservedCode, ShortLink, Tag
from app.schemas import (
    DisableOut,
    LinkCreateIn,
    LinkListOut,
    LinkOut,
    TagOut,
)
from app.settings import get_settings
from app.utils import generate_code, load_seed_tags, now_utc, validate_expires_at, validate_original_url

app = FastAPI(title="TPE Short Links")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def as_utc(value: dt.datetime | None) -> dt.datetime | None:
    """
    Normalize datetimes to timezone-aware UTC.

    Note: SQLite may return naive datetimes even if the column is timezone=True.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.UTC)
    return value.astimezone(dt.UTC)


def is_reserved(code: str, db: Session) -> bool:
    settings = get_settings()
    if code in settings.reserved_codes_set():
        return True
    exists = db.execute(select(ReservedCode.code).where(ReservedCode.code == code)).first()
    return exists is not None


def sync_seed_tags(db: Session) -> None:
    """Ensure DB tags match `backend/app/tags.txt` (by name).

    - Inserts missing tags (active)
    - Reactivates tags that exist but were inactive
    - Deactivates tags not present in the file (does NOT delete rows)
    """
    desired = load_seed_tags()
    if not desired:
        return

    desired_set = set(desired)
    existing = db.execute(select(Tag)).scalars().all()
    by_name = {t.name: t for t in existing}

    changed = False

    for name in desired:
        t = by_name.get(name)
        if t is None:
            db.add(Tag(name=name, is_active=True))
            changed = True
        elif not t.is_active:
            t.is_active = True
            changed = True

    for t in existing:
        if t.is_active and t.name not in desired_set:
            t.is_active = False
            changed = True

    if changed:
        db.commit()


def link_to_out(link: ShortLink, tag_name: str) -> LinkOut:
    settings = get_settings()
    expires_at = as_utc(link.expires_at)
    is_expired = expires_at is not None and expires_at <= now_utc()
    return LinkOut(
        id=link.id,
        code=link.code,
        original_url=link.original_url,
        tag_id=link.tag_id,
        tag_name=tag_name,
        expires_at=expires_at,
        note=link.note,
        status=link.status,
        created_at=link.created_at,
        is_expired=is_expired,
        short_url=f"{settings.PUBLIC_BASE_URL.rstrip('/')}/{link.code}",
    )


@app.get("/api/tags", response_model=list[TagOut])
def get_tags(db: Session = Depends(get_db)) -> list[TagOut]:
    sync_seed_tags(db)
    rows = db.execute(select(Tag).where(Tag.is_active == True).order_by(Tag.name.asc())).scalars().all()  # noqa: E712
    return [TagOut(id=t.id, name=t.name, is_active=t.is_active) for t in rows]


@app.post("/api/links", response_model=LinkOut)
def create_link(payload: LinkCreateIn, db: Session = Depends(get_db)) -> LinkOut:
    settings = get_settings()
    sync_seed_tags(db)

    # Avoid logging full URL in error logs; validate explicitly with minimal messages.
    validate_original_url(str(payload.original_url), allow_http=settings.ALLOW_HTTP_URLS)
    validate_expires_at(payload.expires_at)

    tag = db.get(Tag, payload.tag_id)
    if tag is None or not tag.is_active:
        raise HTTPException(status_code=422, detail="tag_id is invalid")

    for _ in range(30):
        code = generate_code(settings.SHORTLINK_CODE_LENGTH)
        if is_reserved(code, db):
            continue
        link = ShortLink(
            code=code,
            original_url=str(payload.original_url),
            tag_id=payload.tag_id,
            expires_at=payload.expires_at,
            note=payload.note,
            status="active",
        )
        db.add(link)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        db.refresh(link)
        return link_to_out(link, tag.name)

    raise HTTPException(status_code=500, detail="Failed to generate a unique code")


@app.get("/api/links", response_model=LinkListOut)
def list_links(
    query: str | None = Query(default=None),
    tag_id: int | None = Query(default=None, ge=1),
    status: Literal["active", "disabled", "blocked", "expired", "all"] | None = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> LinkListOut:
    now = now_utc()

    base = select(ShortLink, Tag.name).join(Tag, Tag.id == ShortLink.tag_id)
    where = []

    if query:
        q = f"%{query.lower()}%"
        where.append(
            or_(
                func.lower(ShortLink.code).like(q),
                func.lower(ShortLink.original_url).like(q),
                func.lower(func.coalesce(ShortLink.note, "")).like(q),
            )
        )
    if tag_id:
        where.append(ShortLink.tag_id == tag_id)

    if status and status != "all":
        if status == "expired":
            where.append(and_(ShortLink.expires_at.is_not(None), ShortLink.expires_at <= now))
        else:
            where.append(ShortLink.status == status)
            # Exclude expired links from "active" by default (active means redirectable)
            if status == "active":
                where.append(or_(ShortLink.expires_at.is_(None), ShortLink.expires_at > now))

    if where:
        base = base.where(and_(*where))

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    rows = (
        db.execute(base.order_by(ShortLink.created_at.desc()).limit(limit).offset(offset))
        .all()
    )
    items = [link_to_out(link, tag_name) for (link, tag_name) in rows]
    return LinkListOut(items=items, total=total, limit=limit, offset=offset)


@app.post("/api/links/{code}/disable", response_model=DisableOut)
def disable_link(
    code: str = Path(..., min_length=1, max_length=32, pattern=r"^[A-Za-z0-9]+$"),
    db: Session = Depends(get_db),
) -> DisableOut:
    # Even if present in DB, reserved codes should not be manageable via this API (treat as not found).
    if is_reserved(code, db):
        raise HTTPException(status_code=404, detail="Not found")
    link = db.execute(select(ShortLink).where(ShortLink.code == code)).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")
    link.status = "disabled"
    db.add(link)
    db.commit()
    return DisableOut(code=code, status=link.status)


@app.get("/{code}")
def redirect(
    code: str = Path(..., min_length=1, max_length=32, pattern=r"^[A-Za-z0-9]+$"),
    db: Session = Depends(get_db),
) -> Response:
    # Reserved codes must never resolve, even if present in DB.
    if is_reserved(code, db):
        raise HTTPException(status_code=404, detail="Not found")

    link = db.execute(select(ShortLink).where(ShortLink.code == code)).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")

    if link.status in ("disabled", "blocked"):
        raise HTTPException(status_code=404, detail="Not found")

    expires_at = as_utc(link.expires_at)
    if expires_at is not None and expires_at <= now_utc():
        raise HTTPException(status_code=410, detail="Gone")

    return RedirectResponse(url=link.original_url, status_code=302)

