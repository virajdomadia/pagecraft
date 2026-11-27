"""L4: invites, members and password resets, including the demo wall and the email-off
fallback (an invite link is shown to its owner; a reset link never is)."""

import re
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PasswordReset
from app.services import email

pytestmark = pytest.mark.db

PW = "correct horse"


async def sign_up(client: AsyncClient, address: str, name: str = "Asha") -> None:
    client.cookies.clear()
    res = await client.post("/auth/sign-up", json={"email": address, "password": PW, "name": name})
    assert res.status_code == 201, res.text


async def sign_in(client: AsyncClient, address: str, password: str = PW) -> int:
    client.cookies.clear()
    res = await client.post("/auth/sign-in", json={"email": address, "password": password})
    return res.status_code


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, str]]:
    """Email on, delivered here."""
    sent: list[dict[str, str]] = []

    async def send(_settings: Any, to: str, subject: str, body: str) -> bool:
        sent.append({"to": to, "subject": subject, "body": body})
        return True

    monkeypatch.setattr(email, "enabled", lambda _s: True)
    monkeypatch.setattr(email, "send", send)
    return sent


async def owner_with_site(client: AsyncClient) -> str:
    await sign_up(client, "asha@example.in")
    res = await client.post("/sites", json={"name": "Chai Point", "template": "cafe"})
    return res.json()["id"]


async def test_invite_with_email_off_shows_the_link_and_it_works_for_that_address(
    db_client: AsyncClient, seeded: AsyncSession
) -> None:
    sid = await owner_with_site(db_client)
    res = await db_client.post(f"/sites/{sid}/invites", json={"email": " Ravi@Example.in "})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["emailed"] is False and body["invite"]["email"] == "ravi@example.in"
    token = re.search(r"/invites/([\w-]+)$", body["link"]).group(1)  # type: ignore[union-attr]
    assert [i["email"] for i in (await db_client.get(f"/sites/{sid}/invites")).json()] == [
        "ravi@example.in"
    ]

    # Someone else holding the link can't use it.
    await sign_up(db_client, "meena@example.in", "Meena")
    assert (await db_client.post(f"/invites/{token}/accept")).status_code == 403

    await sign_up(db_client, "ravi@example.in", "Ravi")
    preview = (await db_client.get(f"/invites/{token}")).json()
    assert preview == {
        "site_name": "Chai Point",
        "invited_by": "Asha",
        "email": "ravi@example.in",
        "status": "pending",
        "demo": False,
    }
    card = await db_client.post(f"/invites/{token}/accept")
    assert card.status_code == 200 and card.json()["role"] == "editor"
    assert (await db_client.get(f"/sites/{sid}")).status_code == 200
    assert (await db_client.get(f"/invites/{token}")).json()["status"] == "used"
    assert (await db_client.post(f"/invites/{token}/accept")).status_code == 404
    # Editors can't manage people.
    assert (
        await db_client.post(f"/sites/{sid}/invites", json={"email": "x@e.in"})
    ).status_code == 403


async def test_invite_with_email_on_goes_by_email_only(
    db_client: AsyncClient, seeded: AsyncSession, outbox: list
) -> None:
    sid = await owner_with_site(db_client)
    body = (await db_client.post(f"/sites/{sid}/invites", json={"email": "ravi@example.in"})).json()
    assert body["emailed"] is True and body["link"] is None
    assert outbox[0]["to"] == "ravi@example.in" and "/invites/" in outbox[0]["body"]


async def test_the_demo_wall(db_client: AsyncClient, seeded: AsyncSession, outbox: list) -> None:
    await db_client.post("/auth/demo", json={"as": "creator"})
    sid = (await db_client.get("/sites")).json()["sites"][0]["id"]
    real = await db_client.post(f"/sites/{sid}/invites", json={"email": "someone@gmail.com"})
    assert real.status_code == 403
    demo = (
        await db_client.post(f"/sites/{sid}/invites", json={"email": "ravi@example.com"})
    ).json()
    assert demo["emailed"] is False and demo["link"] and outbox == []  # never emailed
    token = demo["link"].rsplit("/", 1)[1]
    assert (await db_client.get(f"/invites/{token}")).json()["demo"] is True

    # A real account with that address still can't join a demo sandbox.
    await sign_up(db_client, "ravi@example.com", "Ravi")
    assert (await db_client.post(f"/invites/{token}/accept")).status_code == 403
    assert (await db_client.get(f"/sites/{sid}")).status_code == 404

    # And a real owner can't invite a demo login.
    real_site = await owner_with_site(db_client)
    bad = {"email": "creator-0000@demo.pagecraft.app"}
    assert (await db_client.post(f"/sites/{real_site}/invites", json=bad)).status_code == 422


async def test_removing_an_editor_404s_them_and_the_owner_stays(
    db_client: AsyncClient, seeded: AsyncSession
) -> None:
    sid = await owner_with_site(db_client)
    link = (await db_client.post(f"/sites/{sid}/invites", json={"email": "ravi@example.in"})).json()
    await sign_up(db_client, "ravi@example.in", "Ravi")
    await db_client.post(f"/invites/{link['link'].rsplit('/', 1)[1]}/accept")
    ravi_id = (await db_client.get("/auth/me")).json()["id"]

    assert await sign_in(db_client, "asha@example.in") == 200
    members = (await db_client.get(f"/sites/{sid}")).json()["members"]
    asha_id = next(m["id"] for m in members if m["role"] == "owner")
    assert (await db_client.delete(f"/sites/{sid}/members/{asha_id}")).status_code == 422
    assert (await db_client.delete(f"/sites/{sid}/members/{ravi_id}")).status_code == 204

    assert await sign_in(db_client, "ravi@example.in") == 200
    assert (await db_client.get(f"/sites/{sid}")).status_code == 404


async def test_forgot_password_with_email_off_sends_nothing_and_says_so(
    db_client: AsyncClient, db: AsyncSession, seeded: AsyncSession
) -> None:
    await sign_up(db_client, "asha@example.in")
    res = await db_client.post("/auth/forgot", json={"email": "asha@example.in"})
    assert res.json() == {"email_on": False}
    assert (await db.execute(select(func.count()).select_from(PasswordReset))).scalar_one() == 0


async def test_reset_password_by_email_link(
    db_client: AsyncClient, seeded: AsyncSession, outbox: list
) -> None:
    await sign_up(db_client, "asha@example.in")
    old_cookie = db_client.cookies.get("pc_session")
    for address in ("asha@example.in", "nobody@example.in"):
        res = await db_client.post("/auth/forgot", json={"email": address})
        assert res.json() == {"email_on": True}  # same answer either way
    assert [m["to"] for m in outbox] == ["asha@example.in"]
    token = re.search(r"#token=([\w-]+)", outbox[0]["body"]).group(1)  # type: ignore[union-attr]

    db_client.cookies.clear()
    res = await db_client.post("/auth/reset", json={"token": token, "password": "new horse 2"})
    assert res.status_code == 200 and res.json()["email"] == "asha@example.in"
    assert (await db_client.get("/auth/me")).status_code == 200  # signed in by the reset
    assert (
        await db_client.post("/auth/reset", json={"token": token, "password": "x" * 9})
    ).status_code == 404

    db_client.cookies.clear()
    db_client.cookies.set("pc_session", old_cookie or "")
    assert (await db_client.get("/auth/me")).status_code == 401  # the old session ended
    assert await sign_in(db_client, "asha@example.in") == 401
    assert await sign_in(db_client, "asha@example.in", "new horse 2") == 200


async def test_demo_accounts_get_no_reset(
    db_client: AsyncClient, seeded: AsyncSession, outbox: list
) -> None:
    me = (await db_client.post("/auth/demo", json={"as": "creator"})).json()
    await db_client.post("/auth/forgot", json={"email": me["email"]})
    assert outbox == []
