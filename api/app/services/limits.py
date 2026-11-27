"""Rate limits (M1) on a Postgres log — no extra service. Approximate under concurrency (two
requests can both see `limit - 1`), which is fine for throttling abuse."""

import datetime as dt

from fastapi import Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models import RateHit

KEEP = dt.timedelta(days=1)  # longer than any window below
HOUR = dt.timedelta(hours=1)
QUARTER = dt.timedelta(minutes=15)


def client_ip(request: Request) -> str:
    """Vercel sets `x-forwarded-for` to the caller's address (it does not trust a client's)."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


async def hit(db: AsyncSession, key: str, limit: int, per: dt.timedelta) -> None:
    """Count one `key` request; 429 once `limit` were counted in the last `per`."""
    now = dt.datetime.now(dt.UTC)
    await db.execute(delete(RateHit).where(RateHit.at < now - KEEP))
    count = (
        await db.execute(select(func.count()).where(RateHit.key == key, RateHit.at > now - per))
    ).scalar_one()
    if count >= limit:
        raise ApiError("rate_limited", "Too many attempts — wait a few minutes and try again")
    db.add(RateHit(key=key, at=now))
    await db.commit()
