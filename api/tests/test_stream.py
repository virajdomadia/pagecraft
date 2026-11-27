"""L1: two real clients editing one site through the real endpoints — updates fan out over
`GET /sites/{id}/stream`, a reconnect replays what was missed, compaction resyncs, and a
removed member's stream ends. Covers 04 §12's `test_stream_replays_after_reconnect`."""

import base64
from collections.abc import AsyncIterator, Iterator

import pytest
from httpx import AsyncClient
from pycrdt import Doc, Text
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SiteMember, User
from app.seed.__main__ import seed
from app.services import crdt
from app.services.documents import COMPACT_EVERY
from tests.live import apply_events, collect, edit_update, live_server, sse
from tests.settings import make_settings

pytestmark = pytest.mark.db


@pytest.fixture
def base_url(migrated_database_url: str) -> Iterator[str]:
    with live_server(migrated_database_url) as url:
        yield url


@pytest.fixture
async def site(db: AsyncSession, base_url: str) -> AsyncIterator[dict]:
    """Asha (owner) and Ravi (editor) on one café site, each with their own client."""
    await seed(db, make_settings())
    async with AsyncClient(base_url=base_url) as asha, AsyncClient(base_url=base_url) as ravi:
        for client, email, name in (
            (asha, "asha@example.com", "Asha"),
            (ravi, "ravi@example.com", "Ravi"),
        ):
            res = await client.post(
                "/auth/sign-up", json={"email": email, "password": "correct horse", "name": name}
            )
            assert res.status_code == 201, res.text
        res = await asha.post("/sites", json={"name": "Chai Point", "template": "cafe"})
        site_id = res.json()["id"]
        ravi_id = (
            await db.execute(select(User.id).where(User.email == "ravi@example.com"))
        ).scalar_one()
        db.add(SiteMember(site_id=site_id, user_id=ravi_id, role="editor"))
        await db.commit()
        yield {"id": site_id, "asha": asha, "ravi": ravi, "ravi_id": ravi_id}


async def open_doc(client: AsyncClient, site_id: str) -> tuple[Doc, int]:
    body = (await client.get(f"/sites/{site_id}/doc")).json()
    doc = crdt.load(
        base64.b64decode(body["snapshot"]), [base64.b64decode(u) for u in body["updates"]]
    )
    return doc, body["seq"]


def headline(doc: Doc) -> Text:
    _, sections = crdt.roots(doc)
    text = sections[1]["props"]["headline"]
    assert isinstance(text, Text)
    return text


def insert_at(offset: int, piece: str):  # type: ignore[no-untyped-def]
    def edit(_site, sections) -> None:  # type: ignore[no-untyped-def]
        sections[1]["props"]["headline"].insert(offset, piece)

    return edit


async def post(client: AsyncClient, site_id: str, update: str) -> int:
    res = await client.post(f"/sites/{site_id}/updates", json={"updates": [update]})
    assert res.status_code == 200, res.text
    return res.json()["seq"]


def updates(n: int):  # type: ignore[no-untyped-def]
    return lambda got: sum(1 for name, _ in got if name == "update") >= n


async def test_two_editors_type_into_one_headline(site: dict) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    a_doc, seq = await open_doc(asha, sid)
    r_doc, _ = await open_doc(ravi, sid)
    a_stream = sse(asha, f"/sites/{sid}/stream?from={seq}")
    r_stream = sse(ravi, f"/sites/{sid}/stream?from={seq}")
    assert (await collect(a_stream, lambda g: len(g) == 1))[0][0] == "hello"
    assert (await collect(r_stream, lambda g: len(g) == 1))[0][0] == "hello"

    # Both type at the very same offset of the same headline before seeing the other's edit.
    a_update = edit_update(a_doc, insert_at(0, "Asha "))
    r_update = edit_update(r_doc, insert_at(0, "Ravi "))
    await post(asha, sid, a_update)
    await post(ravi, sid, r_update)

    apply_events(a_doc, await collect(a_stream, updates(2)))
    apply_events(r_doc, await collect(r_stream, updates(2)))
    server, _ = await open_doc(asha, sid)
    assert str(headline(a_doc)) == str(headline(r_doc)) == str(headline(server))
    assert "Asha " in str(headline(a_doc)) and "Ravi " in str(headline(a_doc))
    await a_stream.aclose()
    await r_stream.aclose()


async def test_stream_replays_after_reconnect(site: dict) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    doc, _ = await open_doc(asha, sid)
    seqs = [await post(asha, sid, edit_update(doc, insert_at(0, c))) for c in "xyz"]

    # Reconnect after the second: only the third comes again (Last-Event-ID works too).
    for kw in ({"params": {"from": seqs[1]}}, {"headers": {"Last-Event-ID": str(seqs[1])}}):
        stream = sse(ravi, f"/sites/{sid}/stream", **kw)
        got = await collect(stream, updates(1))
        assert [d["seq"] for n, d in got if n == "update"] == [seqs[2]]
        with pytest.raises(TimeoutError):  # and nothing else follows
            await collect(stream, updates(1), timeout=0.5)
        await stream.aclose()


async def test_reader_behind_compaction_gets_the_snapshot(site: dict) -> None:
    sid, asha, ravi = site["id"], site["asha"], site["ravi"]
    doc, start = await open_doc(asha, sid)
    reader, _ = await open_doc(ravi, sid)
    for i in range(COMPACT_EVERY + 3):
        last = await post(asha, sid, edit_update(doc, insert_at(0, str(i % 10))))

    stream = sse(ravi, f"/sites/{sid}/stream?from={start}")
    got = await collect(stream, lambda g: any(n == "update" and d["seq"] == last for n, d in g))
    apply_events(reader, got)
    assert str(headline(reader)) == str(headline(doc))
    await stream.aclose()


async def test_removed_editor_stream_ends(site: dict, db: AsyncSession) -> None:
    sid, ravi = site["id"], site["ravi"]
    stream = sse(ravi, f"/sites/{sid}/stream")
    await collect(stream, lambda g: len(g) == 1)
    await db.execute(delete(SiteMember).where(SiteMember.user_id == site["ravi_id"]))
    await db.commit()
    got = await collect(stream, lambda g: g[-1][0] == "gone")
    assert got[-1] == ("gone", {})
    assert (await ravi.get(f"/sites/{sid}/stream")).status_code == 404


async def test_signing_out_ends_the_stream(site: dict) -> None:
    sid, ravi = site["id"], site["ravi"]
    stream = sse(ravi, f"/sites/{sid}/stream")
    await collect(stream, lambda g: len(g) == 1)
    await ravi.post("/auth/sign-out")
    got = await collect(stream, lambda g: g[-1][0] == "gone")
    assert got[-1] == ("gone", {})
