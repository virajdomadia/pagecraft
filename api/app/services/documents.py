"""The durable document log (04 §4, 06 §A row-lock recipe).

`append` takes the `sites` row lock (`SELECT … FOR UPDATE`), writes the merged batch as
`site_updates(seq + 1)` and bumps `sites.seq` — so seq is gap-free per site — and every
`COMPACT_EVERY` updates folds the tail into `sites.snapshot` with pycrdt. Compaction runs under
the same lock, so a tail row above `snapshot_seq` is never lost.
"""

import base64
import binascii
import uuid
from collections.abc import Callable

from pycrdt import Array, Map
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models import Site, SiteUpdate
from app.sections import shape_problem
from app.services import crdt, history

COMPACT_EVERY = 50
MAX_BATCH_BYTES = 256 * 1024
MAX_DOC_BYTES = 2 * 1024 * 1024  # a landing page is ~20 KB; this only stops abuse


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(text: str) -> bytes:
    try:
        return base64.b64decode(text, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ApiError("validation", "Updates must be base64-encoded Yjs updates") from exc


async def lock_site(db: AsyncSession, site_id: uuid.UUID) -> Site:
    # populate_existing: the request already loaded this row (load_access) before another writer
    # committed; without it the lock is taken but the stale seq / snapshot are kept (C1).
    site = (
        await db.execute(
            select(Site)
            .where(Site.id == site_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if site is None:
        raise ApiError("not_found", "Site not found")
    return site


async def tail(db: AsyncSession, site: Site, since: int | None = None) -> list[SiteUpdate]:
    floor = max(site.snapshot_seq, since or 0)
    return list(
        (
            await db.execute(
                select(SiteUpdate)
                .where(SiteUpdate.site_id == site.id, SiteUpdate.seq > floor)
                .order_by(SiteUpdate.seq)
            )
        ).scalars()
    )


async def compact_locked(db: AsyncSession, site: Site) -> None:
    """Fold the tail into the snapshot. The caller holds the row lock."""
    rows = await tail(db, site)
    if not rows:
        return
    site.snapshot = crdt.compact(site.snapshot, [r.update for r in rows])
    site.snapshot_seq = rows[-1].seq
    await db.execute(
        delete(SiteUpdate).where(SiteUpdate.site_id == site.id, SiteUpdate.seq <= site.snapshot_seq)
    )


async def append(
    db: AsyncSession, site_id: uuid.UUID, updates_b64: list[str], author_id: uuid.UUID | None
) -> int:
    raw = [unb64(u) for u in updates_b64]
    if sum(len(u) for u in raw) > MAX_BATCH_BYTES:
        raise ApiError("too_large", "Too many changes in one request", status=413)
    if not all(crdt.is_valid_update(u) for u in raw):
        raise ApiError("validation", "Not a Yjs update")
    update = crdt.merge(raw)

    site = await lock_site(db, site_id)
    rows = await tail(db, site)
    doc = crdt.load(site.snapshot, [r.update for r in rows] + [update])
    if crdt.missing_dependencies(doc, update):
        raise ApiError("conflict", "This site changed since you opened it — reload to keep editing")
    if len(doc.get_update()) > MAX_DOC_BYTES:
        raise ApiError("too_large", "This site is too large to save", status=413)
    content = crdt.export(doc)
    problem = shape_problem(content)
    if problem is not None:
        raise ApiError("validation", problem)
    seq = await _append_locked(db, site, update, author_id)
    await history.maybe_autosave(db, site.id, content, author_id)
    await db.commit()
    return seq


async def _append_locked(
    db: AsyncSession, site: Site, update: bytes, author_id: uuid.UUID | None
) -> int:
    site.seq += 1
    db.add(SiteUpdate(site_id=site.id, seq=site.seq, update=update, author_id=author_id))
    await db.flush()
    if site.seq - site.snapshot_seq >= COMPACT_EVERY:
        await compact_locked(db, site)
    return site.seq


async def server_edit(
    db: AsyncSession,
    site_id: uuid.UUID,
    edit: Callable[[Map, Array], None],
    author_id: uuid.UUID | None,
) -> Site:
    """An edit made by the API (settings rename / SEO) appended as an ordinary update, so the
    browser's copy merges it like any other change. Caller commits."""
    site = await lock_site(db, site_id)
    rows = await tail(db, site)
    update = crdt.server_edit(site.snapshot, [r.update for r in rows], edit)
    if update is not None:
        await _append_locked(db, site, update, author_id)
    return site


async def current_content(db: AsyncSession, site: Site) -> dict:
    rows = await tail(db, site)
    return crdt.export(crdt.load(site.snapshot, [r.update for r in rows]))
