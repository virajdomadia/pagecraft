"""The v1 API end to end against Postgres: auth, sites, the document log, publish, settings,
uploads, membership and the seed. Covers 04 §12's `test_publish_export`,
`test_slug_unique_and_reserved` and `test_membership`."""

import base64
import io
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image
from pycrdt import Doc, Text
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Publication, Site, SiteUpdate, Template, User
from app.seed.__main__ import seed
from app.services import crdt
from app.services.documents import COMPACT_EVERY
from tests.settings import make_settings

pytestmark = pytest.mark.db


# --- helpers ------------------------------------------------------------------------------------


async def sign_up(client: AsyncClient, email: str = "asha@example.com") -> dict[str, Any]:
    res = await client.post(
        "/auth/sign-up", json={"email": email, "password": "correct horse", "name": "Asha"}
    )
    assert res.status_code == 201, res.text
    return res.json()


async def new_site(
    client: AsyncClient, name: str = "Chai Point", template: str = "cafe", **extra: Any
) -> dict[str, Any]:
    res = await client.post("/sites", json={"name": name, "template": template, **extra})
    assert res.status_code == 201, res.text
    return res.json()


async def load_doc(client: AsyncClient, site_id: str) -> Doc:
    body = (await client.get(f"/sites/{site_id}/doc")).json()
    updates = [base64.b64decode(u) for u in body["updates"]]
    return crdt.load(base64.b64decode(body["snapshot"]), updates)


async def push(client: AsyncClient, site_id: str, doc: Doc, edit: Any) -> int:
    before = doc.get_state()
    site, sections = crdt.roots(doc)
    with doc.transaction():
        edit(site, sections)
    update = base64.b64encode(doc.get_update(before)).decode()
    res = await client.post(f"/sites/{site_id}/updates", json={"updates": [update]})
    assert res.status_code == 200, res.text
    return res.json()["seq"]


def set_headline(text: str):  # type: ignore[no-untyped-def]
    def edit(_site, sections) -> None:  # type: ignore[no-untyped-def]
        headline = sections[1]["props"]["headline"]
        assert isinstance(headline, Text)
        del headline[:]
        headline += text

    return edit


SEO = {"title": "Chai Point", "description": "Chai in Indiranagar", "og_image": ""}


@pytest.fixture
async def templates(db: AsyncSession) -> AsyncSession:
    await seed(db, make_settings())
    return db


# --- health + auth ------------------------------------------------------------------------------


async def test_health(client: AsyncClient) -> None:
    res = await client.get("/health")
    assert res.json() == {"ok": True, "service": "pagecraft-api", "version": "1.0.0"}


async def test_sign_up_sign_in_me_sign_out(db_client: AsyncClient) -> None:
    me = await sign_up(db_client, "Asha@Example.com ")
    assert me["email"] == "asha@example.com" and me["plan"] == "free" and not me["demo"]
    assert "pc_session" in db_client.cookies
    assert (await db_client.get("/auth/me")).json()["id"] == me["id"]

    again = await db_client.post(
        "/auth/sign-up", json={"email": "asha@example.com", "password": "x" * 8, "name": "A"}
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "email_taken"

    assert (await db_client.post("/auth/sign-out")).status_code == 204
    db_client.cookies.clear()
    assert (await db_client.get("/auth/me")).status_code == 401

    bad = await db_client.post(
        "/auth/sign-in", json={"email": "asha@example.com", "password": "wrong password"}
    )
    assert bad.status_code == 401
    ok = await db_client.post(
        "/auth/sign-in", json={"email": "ASHA@example.com", "password": "correct horse"}
    )
    assert ok.status_code == 200 and ok.json()["id"] == me["id"]


async def test_protected_routes_need_a_session(db_client: AsyncClient) -> None:
    for path in ("/sites", "/templates"):
        res = await db_client.get(path)
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "unauthorized"


async def test_demo_logins(db_client: AsyncClient, templates: AsyncSession) -> None:
    creator = (await db_client.post("/auth/demo", json={"as": "creator"})).json()
    assert creator["name"] == "Deepa Nair" and creator["demo"]
    sites = (await db_client.get("/sites")).json()["sites"]
    assert [s["slug"] for s in sites] == ["kaapi-corner"]
    assert sites[0]["role"] == "owner" and sites[0]["status"] == "published"
    assert sites[0]["protected"]

    collab = (await db_client.post("/auth/demo", json={"as": "collaborator"})).json()
    assert collab["name"] == "Rohan Mehta"
    sites = (await db_client.get("/sites")).json()["sites"]
    assert [(s["slug"], s["role"]) for s in sites] == [("kaapi-corner", "editor")]


# --- seed + templates ---------------------------------------------------------------------------


async def test_seed_is_idempotent(db: AsyncSession) -> None:
    first = await seed(db, make_settings())
    second = await seed(db, make_settings())
    assert first == {"templates": 6, "sites_created": 6, "published": 6}
    assert second == {"templates": 6, "sites_created": 0, "published": 0}
    assert (await db.execute(select(func.count()).select_from(Template))).scalar_one() == 6
    assert (await db.execute(select(func.count()).select_from(Site))).scalar_one() == 6
    assert (await db.execute(select(func.count()).select_from(User))).scalar_one() == 3
    assert (await db.execute(select(func.count()).select_from(Publication))).scalar_one() == 6


async def test_templates_list_six_with_content(
    db_client: AsyncClient, templates: AsyncSession
) -> None:
    await sign_up(db_client)
    body = (await db_client.get("/templates")).json()
    assert [t["key"] for t in body] == [
        "cafe",
        "salon",
        "freelancer",
        "gym",
        "launch",
        "restaurant",
    ]
    assert body[0]["preview_url"] == "/s/kaapi-corner"
    assert body[0]["content"]["site"]["theme"]["palette"] == "espresso"
    assert not any(t["locked"] for t in body)


async def test_seeded_showcase_sites_are_public(
    db_client: AsyncClient, templates: AsyncSession
) -> None:
    for slug in ("kaapi-corner", "loop-studio", "meera-rao", "ironline", "nimbus-kettle"):
        res = await db_client.get(f"/public/sites/{slug}")
        assert res.status_code == 200, slug
        assert "s-maxage=60" in res.headers["cache-control"]
    body = (await db_client.get("/public/sites/bistro-nine")).json()
    assert body["version"] == 1 and body["plan"] == "free" and body["template"] == "restaurant"
    assert body["content"]["sections"][0]["type"] == "nav"


# --- sites --------------------------------------------------------------------------------------


async def test_create_site_clones_template_and_renames(
    db_client: AsyncClient, templates: AsyncSession
) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    assert site["slug"] == "chai-point" and site["status"] == "draft" and site["role"] == "owner"
    assert [s["type"] for s in site["preview"]["sections"]] == ["nav", "hero"]

    content = crdt.export(await load_doc(db_client, site["id"]))
    assert content["site"]["name"] == "Chai Point"
    assert content["site"]["seo"]["title"] == "Chai Point"
    assert content["sections"][0]["props"]["brand"] == "Chai Point"
    assert content["sections"][-1]["props"]["brand"] == "Chai Point"
    assert content["sections"][1]["props"]["headline"] == "Filter coffee, done properly."

    listing = (await db_client.get("/sites")).json()
    assert listing["owned"] == 1 and listing["limit"] == 3


async def test_slug_unique_and_reserved(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    taken = await db_client.post("/sites", json={"name": "Kaapi Corner", "template": "cafe"})
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "slug_taken"
    assert taken.json()["error"]["details"]["suggestion"] == "kaapi-corner-2"

    reserved = await db_client.post(
        "/sites", json={"name": "Mine", "template": "cafe", "slug": "www"}
    )
    assert reserved.status_code == 422 and reserved.json()["error"]["code"] == "reserved_slug"

    check = (await db_client.get("/sites/slug-check", params={"slug": "kaapi-corner"})).json()
    assert check == {
        "slug": "kaapi-corner",
        "available": False,
        "reason": "taken",
        "message": "kaapi-corner is taken",
        "suggestion": "kaapi-corner-2",
    }
    assert (await db_client.get("/sites/slug-check", params={"slug": "api"})).json()[
        "reason"
    ] == "reserved"

    site = await new_site(db_client, "Second Cup")
    pub = await db_client.post(
        f"/sites/{site['id']}/publish", json={"slug": "ironline", "seo": SEO}
    )
    assert pub.status_code == 409 and pub.json()["error"]["details"]["suggestion"] == "ironline-2"
    pub = await db_client.post(f"/sites/{site['id']}/publish", json={"slug": "admin", "seo": SEO})
    assert pub.status_code == 422 and pub.json()["error"]["code"] == "reserved_slug"


async def test_free_plan_limit(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    for name in ("One Cafe", "Two Cafe", "Three Cafe"):
        await new_site(db_client, name)
    res = await db_client.post("/sites", json={"name": "Four Cafe", "template": "gym"})
    assert res.status_code == 402 and res.json()["error"]["code"] == "plan_limit"


async def test_demo_creator_recycles_instead_of_hitting_the_limit(
    db_client: AsyncClient, templates: AsyncSession
) -> None:
    await db_client.post("/auth/demo", json={"as": "creator"})
    made = [await new_site(db_client, f"Visitor Site {i}") for i in range(4)]
    slugs = {s["slug"] for s in (await db_client.get("/sites")).json()["sites"]}
    assert "kaapi-corner" in slugs  # the showcase is never recycled
    assert made[0]["slug"] not in slugs and made[3]["slug"] in slugs
    assert len(slugs) == 3


# --- the document log ---------------------------------------------------------------------------


async def test_updates_persist_and_compact(db_client: AsyncClient, db: AsyncSession) -> None:
    await seed(db, make_settings())
    await sign_up(db_client)
    site = await new_site(db_client)
    doc = await load_doc(db_client, site["id"])

    seq = await push(db_client, site["id"], doc, set_headline("Chai, done properly."))
    assert seq == 1
    reloaded = crdt.export(await load_doc(db_client, site["id"]))
    assert reloaded["sections"][1]["props"]["headline"] == "Chai, done properly."

    for i in range(COMPACT_EVERY - 1):
        seq = await push(db_client, site["id"], doc, set_headline(f"Edit {i}"))
    assert seq == COMPACT_EVERY
    row = (await db.execute(select(Site).where(Site.id == site["id"]))).scalar_one()
    await db.refresh(row)
    assert row.snapshot_seq == COMPACT_EVERY
    left = await db.execute(select(func.count()).select_from(SiteUpdate))
    assert left.scalar_one() == 0
    body = (await db_client.get(f"/sites/{site['id']}/doc")).json()
    assert body["updates"] == [] and body["seq"] == COMPACT_EVERY
    final = crdt.export(await load_doc(db_client, site["id"]))
    assert final["sections"][1]["props"]["headline"] == f"Edit {COMPACT_EVERY - 2}"

    since = (await db_client.get(f"/sites/{site['id']}/doc", params={"since": seq})).json()
    assert since["snapshot"] == "" and since["updates"] == []


async def test_bad_updates_are_rejected(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    garbage = base64.b64encode(b"\xff\x00nope").decode()
    res = await db_client.post(f"/sites/{site['id']}/updates", json={"updates": [garbage]})
    assert res.status_code == 422
    res = await db_client.post(f"/sites/{site['id']}/updates", json={"updates": ["%%%"]})
    assert res.status_code == 422
    res = await db_client.post(f"/sites/{site['id']}/updates", json={"updates": []})
    assert res.status_code == 422


# --- publish ------------------------------------------------------------------------------------


async def test_publish_export(db_client: AsyncClient, db: AsyncSession) -> None:
    """`publications.content` equals a fresh pycrdt export of the site document; an invalid
    variant is a 422 naming the section."""
    await seed(db, make_settings())
    await sign_up(db_client)
    site = await new_site(db_client)
    doc = await load_doc(db_client, site["id"])
    await push(db_client, site["id"], doc, set_headline("Published from a test."))

    res = await db_client.post(
        f"/sites/{site['id']}/publish", json={"slug": "chai-point", "seo": SEO}
    )
    assert res.status_code == 200, res.text
    assert res.json() == {
        "version": 1,
        "slug": "chai-point",
        "url": "http://localhost:3000/s/chai-point",
        "path": "/s/chai-point",
    }
    pub = (
        await db.execute(select(Publication).where(Publication.site_id == site["id"]))
    ).scalar_one()
    row = (await db.execute(select(Site).where(Site.id == site["id"]))).scalar_one()
    await db.refresh(row)
    assert pub.content == crdt.export(crdt.load(row.snapshot))
    assert pub.content == crdt.export(doc)
    assert pub.content["sections"][1]["props"]["headline"] == "Published from a test."

    public = (await db_client.get("/public/sites/chai-point")).json()
    assert public["content"] == pub.content and public["seo"] == SEO and public["version"] == 1

    def break_variant(_site, sections) -> None:  # type: ignore[no-untyped-def]
        sections[2]["variant"] = "zigzag"

    await push(db_client, site["id"], doc, break_variant)
    bad = await db_client.post(
        f"/sites/{site['id']}/publish", json={"slug": "chai-point", "seo": SEO}
    )
    assert bad.status_code == 422
    error = bad.json()["error"]
    assert error["code"] == "invalid_content"
    assert error["details"]["section_id"] == "s_menu01"
    # The live site keeps serving v1.
    assert (await db_client.get("/public/sites/chai-point")).json()["version"] == 1


async def test_republish_new_slug_and_unpublish(
    db_client: AsyncClient, templates: AsyncSession
) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    url = f"/sites/{site['id']}"
    assert (
        await db_client.post(f"{url}/publish", json={"slug": "chai-point", "seo": SEO})
    ).is_success
    second = await db_client.post(f"{url}/publish", json={"slug": "chai-point-blr", "seo": SEO})
    assert second.json()["version"] == 2
    assert (await db_client.get("/public/sites/chai-point")).status_code == 404  # no redirects
    assert (await db_client.get("/public/sites/chai-point-blr")).json()["version"] == 2

    assert (await db_client.post(f"{url}/unpublish")).status_code == 204
    gone = await db_client.get("/public/sites/chai-point-blr")
    assert gone.status_code == 404 and gone.json()["error"]["code"] == "not_published"
    detail = (await db_client.get(url)).json()
    assert detail["status"] == "draft" and detail["published_version"] == 2


async def test_publish_calls_the_revalidate_hook(
    db_client: AsyncClient, templates: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    async def fake(tags, settings, **_):  # type: ignore[no-untyped-def]
        calls.append(list(tags))
        return True

    monkeypatch.setattr("app.services.publish.revalidate", fake)
    await sign_up(db_client)
    site = await new_site(db_client)
    await db_client.post(f"/sites/{site['id']}/publish", json={"slug": "chai-point", "seo": SEO})
    await db_client.post(f"/sites/{site['id']}/publish", json={"slug": "chai-two", "seo": SEO})
    assert calls == [["site:chai-point"], ["site:chai-point", "site:chai-two"]]


# --- settings -----------------------------------------------------------------------------------


async def test_patch_rename_slug_and_seo(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    url = f"/sites/{site['id']}"
    body = {
        "name": "Chai Point Indiranagar",
        "slug": "chai-indiranagar",
        "seo": {
            "title": "Chai!",
            "description": "Best chai",
            "og_image": "/templates/cafe/hero.jpg",
        },
    }
    res = await db_client.patch(url, json=body)
    assert res.status_code == 200, res.text
    detail = res.json()
    assert detail["name"] == "Chai Point Indiranagar" and detail["slug"] == "chai-indiranagar"
    assert detail["seo"]["title"] == "Chai!" and detail["seo"]["og_image"].endswith("hero.jpg")
    content = crdt.export(await load_doc(db_client, site["id"]))
    assert content["site"]["name"] == "Chai Point Indiranagar"
    assert content["site"]["seo"]["description"] == "Best chai"

    taken = await db_client.patch(url, json={"slug": "loop-studio"})
    assert taken.status_code == 409


async def test_delete_removes_site_updates_and_publications(
    db_client: AsyncClient, db: AsyncSession
) -> None:
    await seed(db, make_settings())
    await sign_up(db_client)
    site = await new_site(db_client)
    doc = await load_doc(db_client, site["id"])
    await push(db_client, site["id"], doc, set_headline("Gone soon"))
    await db_client.post(f"/sites/{site['id']}/publish", json={"slug": "chai-point", "seo": SEO})

    assert (await db_client.delete(f"/sites/{site['id']}")).status_code == 204
    assert (await db_client.get(f"/sites/{site['id']}")).status_code == 404
    assert (await db_client.get("/public/sites/chai-point")).status_code == 404
    for model in (SiteUpdate, Publication):
        count = await db.execute(
            select(func.count()).select_from(model).where(model.site_id == site["id"])
        )
        assert count.scalar_one() == 0


async def test_demo_showcase_is_protected(db_client: AsyncClient, templates: AsyncSession) -> None:
    await db_client.post("/auth/demo", json={"as": "creator"})
    kaapi = (await db_client.get("/sites")).json()["sites"][0]
    url = f"/sites/{kaapi['id']}"
    assert (await db_client.delete(url)).status_code == 403
    assert (await db_client.post(f"{url}/unpublish")).status_code == 403
    assert (await db_client.patch(url, json={"slug": "my-cafe"})).status_code == 403
    assert (
        await db_client.post(f"{url}/publish", json={"slug": "mine", "seo": SEO})
    ).status_code == 403
    # …but editing and publishing the demo itself works: that is the demo.
    doc = await load_doc(db_client, kaapi["id"])
    await push(db_client, kaapi["id"], doc, set_headline("Edited by a visitor"))
    seo = {"title": "Kaapi Corner", "description": "", "og_image": ""}
    ok = await db_client.post(f"{url}/publish", json={"slug": "kaapi-corner", "seo": seo})
    assert ok.status_code == 200 and ok.json()["version"] == 2


# --- membership ---------------------------------------------------------------------------------


async def test_membership(db_client: AsyncClient, templates: AsyncSession) -> None:
    """Non-member → 404 on doc, updates, publish; editor → cannot delete or rename."""
    await sign_up(db_client, "owner@example.com")
    site = await new_site(db_client)
    url = f"/sites/{site['id']}"

    db_client.cookies.clear()
    await sign_up(db_client, "stranger@example.com")
    update = base64.b64encode(crdt.build_update({"site": {}, "sections": []})).decode()
    for res in (
        await db_client.get(url),
        await db_client.get(f"{url}/doc"),
        await db_client.post(f"{url}/updates", json={"updates": [update]}),
        await db_client.post(f"{url}/publish", json={"slug": "chai-point", "seo": SEO}),
        await db_client.post(f"{url}/unpublish"),
        await db_client.patch(url, json={"name": "Mine now"}),
        await db_client.delete(url),
    ):
        assert res.status_code == 404, res.request.url
        assert res.json()["error"]["code"] == "not_found"
    assert (await db_client.get("/sites")).json()["sites"] == []

    db_client.cookies.clear()
    await db_client.post("/auth/demo", json={"as": "collaborator"})
    kaapi = (await db_client.get("/sites")).json()["sites"][0]
    assert kaapi["role"] == "editor"
    kurl = f"/sites/{kaapi['id']}"
    assert (await db_client.get(f"{kurl}/doc")).status_code == 200
    assert (await db_client.patch(kurl, json={"name": "Hijacked"})).status_code == 403
    assert (await db_client.delete(kurl)).status_code == 403
    assert (await db_client.get(url)).status_code == 404  # the owner's other site


# --- uploads ------------------------------------------------------------------------------------


def _jpeg(width: int = 2400, height: int = 1200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "#2F5D45").save(buf, "JPEG")
    return buf.getvalue()


async def test_upload_resizes_and_serves(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    res = await db_client.post(
        "/uploads",
        data={"site_id": site["id"]},
        files={"file": ("photo.jpg", _jpeg(), "image/jpeg")},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["width"] == 2000 and body["height"] == 1000
    assert body["url"].startswith("/api/media/") and body["url"].endswith(".jpg")
    media = await db_client.get(body["url"].removeprefix("/api"))
    assert media.status_code == 200 and media.headers["content-type"] == "image/jpeg"
    assert "immutable" in media.headers["cache-control"]
    assert Image.open(io.BytesIO(media.content)).size == (2000, 1000)


async def test_upload_limits(db_client: AsyncClient, templates: AsyncSession) -> None:
    await sign_up(db_client)
    site = await new_site(db_client)
    big = os_random(6 * 1024 * 1024)
    res = await db_client.post(
        "/uploads", data={"site_id": site["id"]}, files={"file": ("big.jpg", big, "image/jpeg")}
    )
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "file_too_large"
    assert "5 MB" in res.json()["error"]["message"]

    gif = io.BytesIO()
    Image.new("RGB", (10, 10)).save(gif, "GIF")
    res = await db_client.post(
        "/uploads",
        data={"site_id": site["id"]},
        files={"file": ("a.jpg", gif.getvalue(), "image/jpeg")},
    )
    assert res.status_code == 415
    res = await db_client.post(
        "/uploads",
        data={"site_id": site["id"]},
        files={"file": ("a.jpg", b"<svg onload=alert(1)>", "image/jpeg")},
    )
    assert res.status_code == 415

    db_client.cookies.clear()
    await sign_up(db_client, "stranger@example.com")
    res = await db_client.post(
        "/uploads", data={"site_id": site["id"]}, files={"file": ("a.jpg", _jpeg(), "image/jpeg")}
    )
    assert res.status_code == 404


def os_random(n: int) -> bytes:
    import os

    return os.urandom(n)
