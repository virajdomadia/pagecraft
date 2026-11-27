"""Live fan-out (04 §5) as Server-Sent Events over the Postgres update log.

The design picked Upstash Redis (`XREAD BLOCK`) for this; it was never created. Postgres is
already the durable log with a gap-free `seq` per site, so each open stream polls it instead:
one indexed read every `POLL` seconds while nothing changes, the new rows when something does.
shortcut: polling costs ~10 tiny queries/s per open editor; move to Redis/LISTEN when a site has
more than a handful of simultaneous editors.

Each tick reads in one REPEATABLE READ transaction, so a compaction that lands mid-tick can't
leave a gap: if the reader is behind the snapshot it gets the snapshot itself (Yjs replay is
idempotent), then the tail. The membership join re-checks access every tick, so a removed
editor's stream ends with `gone`.
"""

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.models import Site, SiteMember, SiteUpdate
from app.services.documents import b64

POLL = 0.1  # seconds between reads: with the 100 ms autosave, edits show up in ~250 ms
PING = 20.0  # keep proxies from closing an idle stream
LIFETIME = 280.0  # under Vercel's 300 s maxDuration; the client reconnects with `from=`


def event(name: str, data: object, event_id: int | None = None) -> str:
    head = f"id: {event_id}\n" if event_id is not None else ""
    return f"{head}event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def _tick(
    engine: AsyncEngine, site_id: uuid.UUID, user_id: uuid.UUID, last: int
) -> tuple[list[str], int] | None:
    """New events since `last`, and the new `last`; None once the user is no longer a member."""
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="REPEATABLE READ")
        async with conn.begin():
            row = (
                await conn.execute(
                    select(Site.seq, Site.snapshot_seq)
                    .join(SiteMember, SiteMember.site_id == Site.id)
                    .where(Site.id == site_id, SiteMember.user_id == user_id)
                )
            ).first()
            if row is None:
                return None
            seq, snapshot_seq = row
            if seq <= last:
                return [], last
            out: list[str] = []
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
            return out, seq


async def events(
    engine: AsyncEngine, site_id: uuid.UUID, user_id: uuid.UUID, since: int
) -> AsyncIterator[str]:
    last = since
    started = pinged = time.monotonic()
    yield event("hello", {"seq": last})
    while time.monotonic() - started < LIFETIME:
        result = await _tick(engine, site_id, user_id, last)
        if result is None:
            yield event("gone", {})
            return
        out, last = result
        for item in out:
            yield item
        now = time.monotonic()
        if now - pinged >= PING:
            pinged = now
            yield ": ping\n\n"
        await asyncio.sleep(POLL)
