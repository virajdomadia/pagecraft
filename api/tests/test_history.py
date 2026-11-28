"""L5: version history: an autosave per 30 minutes of editing, one per publish, one before a
restore, the newest 10 kept, members only."""

import datetime as dt

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteSnapshot
from app.services import crdt
from app.services.history import KEEP
from tests.test_api import SEO, load_doc, new_site, push, set_headline, sign_up

pytestmark = pytest.mark.db


async def labels(client: AsyncClient, sid: str) -> list[str]:
    res = await client.get(f"/sites/{sid}/snapshots")
    assert res.status_code == 200, res.text
    return [s["label"] for s in res.json()]


async def test_autosave_publish_and_restore_points(
    db_client: AsyncClient, db: AsyncSession, seeded: AsyncSession
) -> None:
    await sign_up(db_client)
    sid = (await new_site(db_client))["id"]
    doc = await load_doc(db_client, sid)
    await push(db_client, sid, doc, set_headline("First"))
    await push(db_client, sid, doc, set_headline("Second"))
    assert await labels(db_client, sid) == ["Autosave"]  # not one per keystroke

    await db.execute(
        update(SiteSnapshot).values(created_at=SiteSnapshot.created_at - dt.timedelta(minutes=31))
    )
    await db.commit()
    await push(db_client, sid, doc, set_headline("Third"))
    assert await labels(db_client, sid) == ["Autosave", "Autosave"]

    pub = await db_client.post(f"/sites/{sid}/publish", json={"slug": "chai-point", "seo": SEO})
    assert pub.status_code == 200
    snaps = (await db_client.get(f"/sites/{sid}/snapshots")).json()
    assert snaps[0]["label"] == "Published v1" and snaps[0]["author"] == "Asha"
    content = (await db_client.get(f"/sites/{sid}/snapshots/{snaps[0]['id']}")).json()["content"]
    assert content == crdt.export(await load_doc(db_client, sid))
    assert content["sections"][1]["props"]["headline"] == "Third"

    assert (await db_client.post(f"/sites/{sid}/snapshots")).status_code == 204
    assert (await labels(db_client, sid))[0] == "Before restore"


async def test_only_the_newest_ten_are_kept(db_client: AsyncClient, seeded: AsyncSession) -> None:
    await sign_up(db_client)
    sid = (await new_site(db_client))["id"]
    first = None
    for i in range(KEEP + 1):
        await db_client.post(f"/sites/{sid}/snapshots")
        if i == 0:
            first = (await db_client.get(f"/sites/{sid}/snapshots")).json()[0]["id"]
    snaps = (await db_client.get(f"/sites/{sid}/snapshots")).json()
    assert len(snaps) == KEEP and first not in {s["id"] for s in snaps}


async def test_history_is_members_only(db_client: AsyncClient, seeded: AsyncSession) -> None:
    await sign_up(db_client)
    sid = (await new_site(db_client))["id"]
    await db_client.post(f"/sites/{sid}/snapshots")
    snap = (await db_client.get(f"/sites/{sid}/snapshots")).json()[0]["id"]
    other = (await new_site(db_client, "Dosa Ghar"))["id"]
    assert (await db_client.get(f"/sites/{other}/snapshots/{snap}")).status_code == 404

    db_client.cookies.clear()
    await sign_up(db_client, "ravi@example.com")
    for path in (f"/sites/{sid}/snapshots", f"/sites/{sid}/snapshots/{snap}"):
        assert (await db_client.get(path)).status_code == 404
    assert (await db_client.post(f"/sites/{sid}/snapshots")).status_code == 404
