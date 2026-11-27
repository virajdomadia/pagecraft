"""Live fan-out (04 §5) as Server-Sent Events over the Postgres update log.

The design picked Upstash Redis (`XREAD BLOCK`) for this; it was never created. Postgres is
already the durable log with a gap-free `seq` per site, so each open stream polls it instead:
one indexed read per tick while nothing changes, the new rows when something does.
shortcut: polling costs ~10 tiny queries/s per active editor (2/s once quiet); move to
Redis/LISTEN when a site has more than a handful of simultaneous editors.

Each tick reads in one REPEATABLE READ transaction, so a compaction that lands mid-tick can't
leave a gap: if the reader is behind the snapshot it gets the snapshot itself (Yjs replay is
idempotent), then the tail. Every tick re-checks the member row and the session that opened the
stream, so a removed editor or a signed-out tab gets `gone`.
"""

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.models import Session, Site, SiteAwareness, SiteMember, SiteUpdate, User
from app.services.documents import b64
from app.services.presence import LIVE

POLL = 0.1  # seconds between reads: with the 100 ms autosave, edits show up in ~250 ms
IDLE_POLL = 0.5  # once nothing has changed for IDLE_AFTER seconds
IDLE_AFTER = 30.0
PING = 20.0  # keep proxies from closing an idle stream
LIFETIME = 280.0  # under Vercel's 300 s maxDuration; the client reconnects with `from=`


def event(name: str, data: object, event_id: int | None = None) -> str:
    head = f"id: {event_id}\n" if event_id is not None else ""
    return f"{head}event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def _tick(
    engine: AsyncEngine,
    site_id: uuid.UUID,
    user_id: uuid.UUID,
    session: str,
    last: int,
    last_aw: int,
) -> tuple[list[str], int, int] | None:
    """New events since `last` (updates) / `last_aw` (presence rev), and the new cursors; None
    once the user is no longer a member or the session that opened the stream has ended."""
    aw_rev = select(func.max(SiteAwareness.rev)).where(SiteAwareness.site_id == site_id)
    live = exists().where(
        Session.token_hash == session, Session.user_id == user_id, Session.expires_at > func.now()
    )
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="REPEATABLE READ")
        async with conn.begin():
            row = (
                await conn.execute(
                    select(Site.seq, Site.snapshot_seq, aw_rev.scalar_subquery())
                    .join(SiteMember, SiteMember.site_id == Site.id)
                    .where(Site.id == site_id, SiteMember.user_id == user_id, live)
                )
            ).first()
            if row is None:
                return None
            seq, snapshot_seq, rev = row
            out: list[str] = []
            if rev and rev > last_aw:
                out += await _presence(conn, site_id, last_aw)
                last_aw = rev
            if seq <= last:
                return out, last, last_aw
            if last < snapshot_seq:  # compacted past the reader: send the snapshot first
                snapshot = (
                    await conn.execute(select(Site.snapshot).where(Site.id == site_id))
                ).scalar_one()
                out.append(
                    event(
                        "update",
                        {"seq": snapshot_seq, "author": None, "data": b64(snapshot)},
                        snapshot_seq,
                    )
                )
            rows = await conn.execute(
                select(SiteUpdate.seq, SiteUpdate.author_id, SiteUpdate.update)
                .where(SiteUpdate.site_id == site_id, SiteUpdate.seq > max(last, snapshot_seq))
                .order_by(SiteUpdate.seq)
            )
            for r_seq, author, update in rows:
                author_id = str(author) if author else None
                out.append(
                    event("update", {"seq": r_seq, "author": author_id, "data": b64(update)}, r_seq)
                )
            return out, seq, last_aw


async def _presence(conn: AsyncConnection, site_id: uuid.UUID, after: int) -> list[str]:
    rows = await conn.execute(
        select(SiteAwareness.client_id, SiteAwareness.state, User.id, User.name, User.avatar_colour)
        .join(User, User.id == SiteAwareness.user_id)
        .where(
            SiteAwareness.site_id == site_id,
            SiteAwareness.rev > after,
            SiteAwareness.updated_at > func.now() - LIVE,
        )
        .order_by(SiteAwareness.rev)
    )
    return [
        event(
            "aw",
            {
                "client": client,
                "user": {"id": str(uid), "name": name, "colour": colour},
                "state": state,
            },
        )
        for client, state, uid, name, colour in rows
    ]


async def events(
    engine: AsyncEngine, site_id: uuid.UUID, user_id: uuid.UUID, session: str, since: int
) -> AsyncIterator[str]:
    last, last_aw = since, 0
    started = pinged = changed = time.monotonic()
    yield event("hello", {"seq": last})
    while time.monotonic() - started < LIFETIME:
        result = await _tick(engine, site_id, user_id, session, last, last_aw)
        if result is None:
            yield event("gone", {})
            return
        out, last, last_aw = result
        for item in out:
            yield item
        now = time.monotonic()
        if out:
            changed = now
        if now - pinged >= PING:
            pinged = now
            yield ": ping\n\n"
        await asyncio.sleep(POLL if now - changed < IDLE_AFTER else IDLE_POLL)
