"""Presence (L2): each open editor tab posts its pointer, selected section and caret; the stream
fans the rows out (services/stream.py). One row per (site, tab), overwritten in place. Identity
comes from the session, never from the client: the stream attaches the row owner's name and
colour, and a tab id another user already holds can't be taken over."""

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import delete, func, select, true
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models import SiteAwareness

LIVE = dt.timedelta(
    seconds=30
)  # a tab that hasn't posted for this long is gone (it beats every 15 s)
SWEEP = dt.timedelta(seconds=60)
MIN_GAP = dt.timedelta(milliseconds=40)  # clients send ≤ 10/s; faster writes are dropped
MAX_TABS = 8  # live tabs per user per site


async def publish(
    db: AsyncSession,
    site_id: uuid.UUID,
    user_id: uuid.UUID,
    client: int,
    state: dict[str, Any] | None,
) -> None:
    now = func.now()
    await db.execute(
        delete(SiteAwareness).where(
            SiteAwareness.site_id == site_id, SiteAwareness.updated_at < now - SWEEP
        )
    )
    if state is not None:
        tabs = (
            await db.execute(
                select(func.count()).where(
                    SiteAwareness.site_id == site_id,
                    SiteAwareness.user_id == user_id,
                    SiteAwareness.client_id != client,
                    SiteAwareness.state.is_not(None),
                    SiteAwareness.updated_at > now - LIVE,
                )
            )
        ).scalar_one()
        if tabs >= MAX_TABS:
            raise ApiError("rate_limited", "Too many open tabs on this site")
    stmt = insert(SiteAwareness).values(
        site_id=site_id, client_id=client, user_id=user_id, state=state
    )
    mine = SiteAwareness.user_id == stmt.excluded.user_id
    # A leaving tab (state null) is never throttled, or its cursor would linger.
    due = SiteAwareness.updated_at < now - MIN_GAP if state is not None else true()
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[SiteAwareness.site_id, SiteAwareness.client_id],
            set_={
                "state": stmt.excluded.state,
                "rev": func.nextval("site_awareness_rev"),
                "updated_at": now,
            },
            where=mine & due,
        )
    )
    await db.commit()
