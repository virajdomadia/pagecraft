"""L2: presence through the real endpoints: one tab's cursor reaches the other over the stream
with the server's idea of who it is, a tab id can't be hijacked, leaving is announced, and the
payload is validated."""

import datetime as dt

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteAwareness
from app.services import presence
from app.services.presence import MAX_TABS
from tests.live import collect, sse

pytestmark = pytest.mark.db

STATE = {"section": "s_hero01", "pointer": {"s": "s_hero01", "x": 0.25, "y": 0.5}}


def aw(got: list) -> list[dict]:
    return [d for name, d in got if name == "aw"]


_n = iter(range(1, 10**6))


async def post(client: AsyncClient, sid: str, body: dict) -> int:
    body = {"n": next(_n), **body}
    return (await client.post(f"/sites/{sid}/awareness", json=body)).status_code


async def test_a_cursor_reaches_the_teammate_with_the_server_identity(site: dict) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    stream = sse(ravi, f"/sites/{sid}/stream")
    await collect(stream, lambda g: len(g) == 1)
    assert await post(asha, sid, {"client": 11, "state": STATE}) == 204
    got = aw(await collect(stream, lambda g: aw(g)))
    assert got[0]["client"] == 11
    assert got[0]["user"]["name"] == "Asha"
    assert got[0]["state"] == STATE

    # Leaving is announced (state null), so the cursor disappears at once.
    assert await post(asha, sid, {"client": 11, "state": None}) == 204
    got = aw(await collect(stream, lambda g: aw(g)))
    assert got[-1]["client"] == 11 and got[-1]["state"] is None
    await stream.aclose()


async def test_a_late_joiner_sees_who_is_already_here(site: dict) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    assert await post(asha, sid, {"client": 12, "state": STATE}) == 204
    stream = sse(ravi, f"/sites/{sid}/stream")
    got = aw(await collect(stream, lambda g: aw(g)))
    assert [(d["client"], d["user"]["name"]) for d in got] == [(12, "Asha")]
    await stream.aclose()


async def test_a_tab_id_cannot_be_taken_over(site: dict, db: AsyncSession) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    assert await post(asha, sid, {"client": 13, "state": STATE}) == 204
    hijack = {"section": "s_other1"}
    assert await post(ravi, sid, {"client": 13, "state": hijack}) == 204
    row = (
        await db.execute(select(SiteAwareness).where(SiteAwareness.client_id == 13))
    ).scalar_one()
    assert row.state == STATE


async def test_presence_is_validated_and_member_only(site: dict, base_url: str) -> None:
    sid, asha = site["id"], site["asha"]
    assert await post(asha, sid, {"client": 1, "state": {"name": "Spoofed"}}) == 422
    assert (
        await post(asha, sid, {"client": 1, "state": {"pointer": {"s": "x", "x": 2, "y": 0}}})
        == 422
    )
    async with AsyncClient(base_url=base_url) as stranger:
        await stranger.post(
            "/auth/sign-up",
            json={"email": "x@example.com", "password": "correct horse", "name": "X"},
        )
        assert await post(stranger, sid, {"client": 1, "state": STATE}) == 404


async def test_one_user_cannot_flood_a_site_with_tabs(site: dict, db: AsyncSession) -> None:
    sid, asha = site["id"], site["asha"]
    # Leaving never creates a row, and a tab that left still counts while recent.
    assert await post(asha, sid, {"client": 50, "state": None}) == 204
    for client in range(MAX_TABS):
        assert await post(asha, sid, {"client": 100 + client, "state": STATE}) == 204
        assert await post(asha, sid, {"client": 100 + client, "state": None}) == 204
    assert await post(asha, sid, {"client": 999, "state": STATE}) == 429
    rows = (await db.execute(select(SiteAwareness.client_id))).scalars().all()
    assert 50 not in rows and len(rows) == MAX_TABS


async def test_a_late_post_never_overwrites_a_newer_one(
    site: dict, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        presence, "MIN_GAP", dt.timedelta(seconds=30)
    )  # every rewrite is "too soon"
    sid, asha = site["id"], site["asha"]
    url = f"/sites/{sid}/awareness"
    assert (await asha.post(url, json={"client": 21, "n": 5, "state": STATE})).status_code == 204
    old = {"client": 21, "n": 4, "state": {"section": "s_old001"}}
    assert (await asha.post(url, json=old)).status_code == 204
    row = (
        await db.execute(select(SiteAwareness).where(SiteAwareness.client_id == 21))
    ).scalar_one()
    assert row.state == STATE
    # Too soon after the last write: 429, so the tab sends its latest state again shortly.
    soon = {"client": 21, "n": 6, "state": {"section": "s_new001"}}
    assert (await asha.post(url, json=soon)).status_code == 429
