from __future__ import annotations

import csv
import datetime as dt
import io
from typing import Literal

import qrcode
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
from app.utils import (
    generate_code,
    is_english_word,
    load_seed_tags,
    now_utc,
    validate_expires_at,
    validate_original_url,
)

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
        try:
            db.commit()
        except Exception as e:
            import logging
            logging.error(f"Error committing tags: {e}")
            db.rollback()
            raise


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
    try:
        # Clear cache to ensure fresh load
        from app.utils import load_seed_tags
        load_seed_tags.cache_clear()
        
        sync_seed_tags(db)
        rows = db.execute(select(Tag).where(Tag.is_active == True).order_by(Tag.name.asc())).scalars().all()  # noqa: E712
        return [TagOut(id=t.id, name=t.name, is_active=t.is_active) for t in rows]
    except Exception as e:
        # Log error but don't fail - return empty list if sync fails
        import logging
        logging.error(f"Error syncing tags: {e}", exc_info=True)
        # Try to return existing tags even if sync failed
        try:
            rows = db.execute(select(Tag).where(Tag.is_active == True).order_by(Tag.name.asc())).scalars().all()  # noqa: E712
            return [TagOut(id=t.id, name=t.name, is_active=t.is_active) for t in rows]
        except:
            return []


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

    # If an active (non-expired) short link already exists for this URL, warn instead of silently creating a new one.
    now = now_utc()
    existing_row = (
        db.execute(
            select(ShortLink, Tag.name)
            .join(Tag, Tag.id == ShortLink.tag_id)
            .where(
                ShortLink.original_url == str(payload.original_url),
                ShortLink.status == "active",
                or_(ShortLink.expires_at.is_(None), ShortLink.expires_at > now),
            )
        ).first()
    )
    if existing_row is not None:
        existing_link, existing_tag_name = existing_row
        existing = link_to_out(existing_link, existing_tag_name)
        raise HTTPException(
            status_code=409,
            detail=f"A short link already exists for this URL: {existing.short_url}",
        )

    # Handle manual code or auto-generate
    if payload.code:
        # Manual code provided - relaxed validation (only check uniqueness and reserved)
        code = payload.code
        # Only check if code is reserved (system codes like 'api', 'docs' should still be blocked)
        if is_reserved(code, db):
            raise HTTPException(status_code=422, detail="Code is reserved")
        # Check if code already exists (uniqueness is still required)
        existing_link = db.execute(select(ShortLink).where(ShortLink.code == code)).scalar_one_or_none()
        if existing_link is not None:
            raise HTTPException(status_code=422, detail="Code already exists")
        # Note: Blocked word check and exact length requirement removed for custom codes
    else:
        # Auto-generate code
        code = None
        for _ in range(30):
            code = generate_code(settings.SHORTLINK_CODE_LENGTH)
            if is_reserved(code, db):
                continue
            existing_link = db.execute(select(ShortLink).where(ShortLink.code == code)).scalar_one_or_none()
            if existing_link is None:
                break
        if code is None:
            raise HTTPException(status_code=500, detail="Failed to generate a unique code")

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
        raise HTTPException(status_code=422, detail="Code already exists")
    db.refresh(link)
    return link_to_out(link, tag.name)


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


@app.get("/api/links/export")
def export_links_csv(
    query: str | None = Query(default=None),
    tag_id: int | None = Query(default=None, ge=1),
    status: Literal["active", "disabled", "blocked", "expired", "all"] | None = Query(default="all"),
    db: Session = Depends(get_db),
) -> Response:
    """Export links as CSV (applies same filters as list_links, but no pagination)."""
    settings = get_settings()
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
            if status == "active":
                where.append(or_(ShortLink.expires_at.is_(None), ShortLink.expires_at > now))

    if where:
        base = base.where(and_(*where))

    rows = db.execute(base.order_by(ShortLink.created_at.desc())).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "code",
            "short_url",
            "original_url",
            "tag_id",
            "tag_name",
            "status",
            "is_expired",
            "created_at",
            "expires_at",
            "note",
        ]
    )

    for link, tag_name in rows:
        expires_at = as_utc(link.expires_at)
        is_expired = expires_at is not None and expires_at <= now
        short_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/{link.code}"
        writer.writerow(
            [
                link.id,
                link.code,
                short_url,
                link.original_url,
                link.tag_id,
                tag_name,
                link.status,
                "true" if is_expired else "false",
                link.created_at.isoformat(),
                expires_at.isoformat() if expires_at is not None else "",
                (link.note or "").replace("\n", " ").replace("\r", " "),
            ]
        )

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="short_links.csv"'},
    )


@app.get("/api/links/{code}/qrcode")
def get_qrcode(
    code: str = Path(..., min_length=1, max_length=32),
    db: Session = Depends(get_db),
) -> Response:
    """Generate QR code PNG for a short link."""
    settings = get_settings()
    link = db.execute(select(ShortLink).where(ShortLink.code == code)).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")

    short_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/{link.code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(short_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="PNG")
    img_buffer.seek(0)

    return Response(
        content=img_buffer.getvalue(),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="qrcode_{code}.png"'},
    )


@app.get("/api/blocked-words", response_model=list[str])
def list_blocked_words() -> list[str]:
    """List all blocked words (returns all words, but only 3-4 char words actually block codes)."""
    try:
        from app.utils import _load_blocked_words, _BLOCKED_WORDS_FILE
        
        # Clear cache to ensure fresh load
        _load_blocked_words.cache_clear()
        
        # Check if file exists
        if not _BLOCKED_WORDS_FILE.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Blocked words file not found at: {_BLOCKED_WORDS_FILE}",
            )

        words = _load_blocked_words()
        # Return all words (user can see what's in the list), but only 3-4 char words actually block
        return sorted(list(words))
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import logging
        logging.error(f"Error loading blocked words: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error loading blocked words: {str(e)}")


@app.post("/api/blocked-words")
def add_blocked_word(word: str = Query(..., min_length=1, max_length=4)) -> dict[str, str]:
    """Add a word to the blocked list."""
    from app.utils import _BLOCKED_WORDS_FILE

    word_lower = word.strip().lower()
    if not word_lower or len(word_lower) > 4:
        raise HTTPException(status_code=422, detail="Word must be 1-4 characters")

    # Read existing words
    existing = set()
    if _BLOCKED_WORDS_FILE.exists():
        with open(_BLOCKED_WORDS_FILE, "r") as f:
            for line in f:
                w = line.strip().lower()
                if w:
                    existing.add(w)

    # Add new word
    if word_lower in existing:
        raise HTTPException(status_code=409, detail="Word already exists")

    existing.add(word_lower)

    # Write back (sorted)
    with open(_BLOCKED_WORDS_FILE, "w") as f:
        for w in sorted(existing):
            f.write(f"{w}\n")

    # Clear cache
    from app.utils import _load_blocked_words
    _load_blocked_words.cache_clear()

    return {"message": "Word added", "word": word_lower}


@app.delete("/api/blocked-words/{word}")
def delete_blocked_word(word: str = Path(..., min_length=1, max_length=4)) -> dict[str, str]:
    """Remove a word from the blocked list."""
    from app.utils import _BLOCKED_WORDS_FILE

    word_lower = word.strip().lower()

    # Read existing words
    existing = set()
    if _BLOCKED_WORDS_FILE.exists():
        with open(_BLOCKED_WORDS_FILE, "r") as f:
            for line in f:
                w = line.strip().lower()
                if w:
                    existing.add(w)

    # Remove word
    if word_lower not in existing:
        raise HTTPException(status_code=404, detail="Word not found")

    existing.remove(word_lower)

    # Write back (sorted)
    with open(_BLOCKED_WORDS_FILE, "w") as f:
        for w in sorted(existing):
            f.write(f"{w}\n")

    # Clear cache
    from app.utils import _load_blocked_words
    _load_blocked_words.cache_clear()

    return {"message": "Word removed", "word": word_lower}


@app.post("/api/tags", response_model=TagOut)
def create_tag(name: str = Query(..., min_length=1, max_length=64), db: Session = Depends(get_db)) -> TagOut:
    """Create a new tag."""
    name_trimmed = name.strip()
    if not name_trimmed:
        raise HTTPException(status_code=422, detail="Tag name cannot be empty")

    # Check if exists
    existing = db.execute(select(Tag).where(Tag.name == name_trimmed)).scalar_one_or_none()
    if existing is not None:
        if existing.is_active:
            raise HTTPException(status_code=409, detail="Tag already exists")
        # Reactivate
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return TagOut(id=existing.id, name=existing.name, is_active=existing.is_active)

    # Create new
    tag = Tag(name=name_trimmed, is_active=True)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name, is_active=tag.is_active)


@app.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int = Path(..., ge=1), db: Session = Depends(get_db)) -> dict[str, str]:
    """Deactivate a tag (soft delete - doesn't delete rows)."""
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if tag is used by any links
    link_count = db.execute(select(func.count()).select_from(ShortLink).where(ShortLink.tag_id == tag_id)).scalar_one()
    if link_count > 0:
        raise HTTPException(status_code=409, detail=f"Cannot delete tag: {link_count} link(s) still use it")

    tag.is_active = False
    db.commit()
    return {"message": "Tag deactivated", "tag_id": tag_id}


@app.post("/api/links/{code}/disable", response_model=DisableOut)
def disable_link(
    code: str = Path(..., min_length=1, max_length=32),
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
    code: str = Path(..., min_length=1, max_length=32),
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

