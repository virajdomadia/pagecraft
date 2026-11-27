"""C1: a request's `Site` is loaded by `load_access` before `lock_site` takes the row lock; the
lock must re-read the row, or a writer that committed in between is silently overwritten."""

import base64
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.deps import Access, load_access
from app.models import User
from app.services import crdt, documents
from app.services.documents import COMPACT_EVERY
from app.services.sites import rename_in_doc
from tests.test_api import load_doc, new_site, sign_up, templates  # noqa: F401

pytestmark = pytest.mark.db


def headline_update(doc, value: str) -> str:  # type: ignore[no-untyped-def]
    before = doc.get_state()
    _, sections = crdt.roots(doc)
    with doc.transaction():
        headline = sections[1]["props"]["headline"]
        del headline[:]
        headline += value
    return base64.b64encode(doc.get_update(before)).decode()


async def stale_request(
    engine: AsyncEngine, site_id: str, email: str
) -> tuple[AsyncSession, Access]:
    """Session B, as a request has it after `load_access`: the Site is in its identity map
    (held by the returned Access, as the route's dependency holds it)."""
    b = async_sessionmaker(engine, expire_on_commit=False)()
    user = (await b.execute(select(User).where(User.email == email))).scalar_one()
    return b, await load_access(b, uuid.UUID(site_id), user)


async def test_append_after_a_concurrent_compaction_keeps_both_edits(
    db_client: AsyncClient,
    db_engine: AsyncEngine,
    templates: AsyncSession,  # noqa: F811
) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    url = f"/sites/{site['id']}/updates"
    doc = await load_doc(db_client, site["id"])
    for i in range(COMPACT_EVERY - 2):
        await db_client.post(url, json={"updates": [headline_update(doc, f"edit {i}")]})

    b, access = await stale_request(db_engine, site["id"], "asha@example.com")
    # A: two more appends, the second compacts.
    for value in ("A49", "A50"):
        assert (
            await db_client.post(url, json={"updates": [headline_update(doc, value)]})
        ).is_success
    # B, holding a Site loaded before A committed, appends its own edit.
    async with b:
        seq = await documents.append(
            b, access.site.id, [headline_update(doc, "B wins")], access.user.id
        )
    assert seq == COMPACT_EVERY + 1

    final = crdt.export(await load_doc(db_client, site["id"]))
    assert final["sections"][1]["props"]["headline"] == "B wins"


async def test_server_edit_after_a_concurrent_compaction_keeps_the_folded_edits(
    db_client: AsyncClient,
    db_engine: AsyncEngine,
    templates: AsyncSession,  # noqa: F811
) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    url = f"/sites/{site['id']}/updates"
    doc = await load_doc(db_client, site["id"])
    b, access = await stale_request(db_engine, site["id"], "asha@example.com")
    for i in range(COMPACT_EVERY):
        await db_client.post(url, json={"updates": [headline_update(doc, f"edit {i}")]})
    async with b:
        await documents.server_edit(b, access.site.id, rename_in_doc("Renamed"), access.user.id)
        await b.commit()

    final = crdt.export(await load_doc(db_client, site["id"]))
    assert final["site"]["name"] == "Renamed"
    assert final["sections"][1]["props"]["headline"] == f"edit {COMPACT_EVERY - 1}"


async def test_snapshot_seq_never_exceeds_seq(db: AsyncSession, templates: AsyncSession) -> None:  # noqa: F811
    with pytest.raises(IntegrityError):
        await db.execute(text("update sites set snapshot_seq = seq + 1"))
