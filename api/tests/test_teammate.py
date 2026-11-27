"""L3 "Open as your teammate": a demo user gets a session for the other half of their own
sandbox, carried by one tab in a header while the cookie stays theirs. Real accounts can't use
the header, and the teammate can't reach anything outside the sandbox."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import TAB_HEADER

pytestmark = pytest.mark.db


async def test_the_teammate_tab_is_rohan_while_the_cookie_stays_deepa(
    db_client: AsyncClient, seeded: AsyncSession
) -> None:
    await db_client.post("/auth/demo", json={"as": "creator"})
    site = (await db_client.get("/sites")).json()["sites"][0]
    res = await db_client.post("/auth/demo/teammate")
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    assert "set-cookie" not in res.headers
    body = res.json()
    assert body["me"]["name"] == "Rohan Mehta"
    tab = {TAB_HEADER: body["token"]}

    assert (await db_client.get("/auth/me", headers=tab)).json()["name"] == "Rohan Mehta"
    assert (await db_client.get("/auth/me")).json()["name"] == "Deepa Nair"
    detail = (await db_client.get(f"/sites/{site['id']}", headers=tab)).json()
    assert detail["role"] == "editor"

    # And back: Rohan's tab can open Deepa.
    back = (await db_client.post("/auth/demo/teammate", headers=tab)).json()
    assert back["me"]["name"] == "Deepa Nair"


async def test_the_teammate_stays_inside_the_sandbox(
    db_client: AsyncClient, seeded: AsyncSession
) -> None:
    await db_client.post("/auth/demo", json={"as": "creator"})
    other_sandbox = (await db_client.get("/sites")).json()["sites"][0]
    db_client.cookies.clear()
    await db_client.post("/auth/demo", json={"as": "creator"})
    tab = {TAB_HEADER: (await db_client.post("/auth/demo/teammate")).json()["token"]}
    assert (await db_client.get(f"/sites/{other_sandbox['id']}", headers=tab)).status_code == 404


async def test_real_accounts_have_no_teammate_and_never_use_the_header(
    db_client: AsyncClient, seeded: AsyncSession
) -> None:
    await db_client.post(
        "/auth/sign-up",
        json={"email": "asha@example.com", "password": "correct horse", "name": "Asha"},
    )
    real_token = db_client.cookies.get("pc_session") or ""
    assert (await db_client.post("/auth/demo/teammate")).status_code == 403
    db_client.cookies.clear()
    # A real session in the header is ignored: no cookie, so not signed in.
    assert (await db_client.get("/auth/me", headers={TAB_HEADER: real_token})).status_code == 401
