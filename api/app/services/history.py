"""Version history (L5): snapshots of a site's content as JSON, taken on publish, after every 30
minutes of editing, and before a restore. The newest KEEP per site are kept. Restoring happens
in the browser as an ordinary local edit, so it syncs to everyone and is undoable."""

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteSnapshot

KEEP = 10
EVERY = dt.timedelta(minutes=30)


async def take(
    db: AsyncSession,
    site_id: uuid.UUID,
    content: dict[str, Any],
    label: str,
    author_id: uuid.UUID | None,
) -> None:
    """Caller commits."""
    db.add(SiteSnapshot(site_id=site_id, content=content, label=label, author_id=author_id))
    await db.flush()
    newest = (
        select(SiteSnapshot.id)
        .where(SiteSnapshot.site_id == site_id)
        .order_by(SiteSnapshot.created_at.desc())
        .limit(KEEP)
    )
    await db.execute(
        delete(SiteSnapshot).where(SiteSnapshot.site_id == site_id, SiteSnapshot.id.not_in(newest))
    )


async def maybe_autosave(
    db: AsyncSession, site_id: uuid.UUID, content: dict[str, Any], author_id: uuid.UUID | None
) -> None:
    """One "Autosave" per 30 minutes of editing (checked on every saved change)."""
    last = (
        await db.execute(
            select(func.max(SiteSnapshot.created_at)).where(SiteSnapshot.site_id == site_id)
        )
    ).scalar()
    if last is None or last < dt.datetime.now(dt.UTC) - EVERY:
        await take(db, site_id, content, "Autosave", author_id)
