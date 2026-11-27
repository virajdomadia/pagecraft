"""Presence (L2): each open editor tab posts its pointer, selected section and caret; the stream
fans the rows out (services/stream.py). One row per (site, tab), overwritten in place. Identity
comes from the session, never from the client: the stream attaches the row owner's name and
colour, and a tab id another user already holds can't be taken over."""

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models import SiteAwareness

LIVE = dt.timedelta(
    seconds=30
)  # a tab that hasn't posted for this long is gone (it beats every 15 s)
SWEEP = dt.timedelta(seconds=60)
MIN_GAP = dt.timedelta(milliseconds=40)  # clients send ≤ 10/s; a faster write gets 429 + resend
MAX_TABS = 12  # rows per user per site in the last LIVE seconds (reloads leave rows behind)


async def publish(
    db: AsyncSession,
    site_id: uuid.UUID,
    user_id: uuid.UUID,
    client: int,
    n: int,
    state: dict[str, Any] | None,
) -> None:
    """`n` is the tab's own post counter: an older post that arrives late never overwrites a
    newer one."""
    now = func.now()
    # One user's posts to one site are serialised, so the tab cap can't be raced.
    await db.execute(select(func.pg_advisory_xact_lock(func.hashtext(f"aw:{site_id}:{user_id}"))))
    await db.execute(
        delete(SiteAwareness).where(
            SiteAwareness.site_id == site_id, SiteAwareness.updated_at < now - SWEEP
        )
    )
    row = (
        SiteAwareness.site_id == site_id,
        SiteAwareness.client_id == client,
        SiteAwareness.user_id == user_id,
        SiteAwareness.n < n,
    )
    bump = {"n": n, "rev": func.nextval("site_awareness_rev"), "updated_at": now}
    if state is None:  # leaving: only ever marks this user's own row, never creates one
        await db.execute(update(SiteAwareness).where(*row).values(state=None, **bump))
        await db.commit()
        return
    tabs = (
        await db.execute(
            select(func.count()).where(
                SiteAwareness.site_id == site_id,
                SiteAwareness.user_id == user_id,
                SiteAwareness.client_id != client,
                SiteAwareness.updated_at > now - LIVE,
            )
        )
    ).scalar_one()
    if tabs >= MAX_TABS:
        raise ApiError("rate_limited", "Too many open tabs on this site")
    stmt = insert(SiteAwareness).values(
        site_id=site_id, client_id=client, user_id=user_id, state=state, n=n
    )
    done = await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[SiteAwareness.site_id, SiteAwareness.client_id],
            set_={"state": stmt.excluded.state, **bump},
            # Another user's tab id is never taken over; a stale post never wins.
            where=and_(*row[2:], SiteAwareness.updated_at < now - MIN_GAP),
        )
    )
    await db.commit()
    if getattr(done, "rowcount", 1) == 0:
        mine = (await db.execute(select(SiteAwareness.n).where(*row[:3]))).scalar_one_or_none()
        if mine is not None and mine < n:  # too soon after the last write: the tab resends
            raise ApiError("rate_limited", "Presence is sent at most 10 times a second")
