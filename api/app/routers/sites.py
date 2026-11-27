"""`/templates`, `/sites/*` and `/uploads` (06 §C). Every `/sites/{id}/*` route resolves the
member row first; a non-member gets 404, never a hint that the site exists."""

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, Header, Query, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from pycrdt import Array, Map
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.deps import AppSettings, CurrentUser, Db, Member, Owner, load_access, session_token
from app.errors import ApiError
from app.models import Template
from app.schemas.models import (
    AwarenessIn,
    CreateSite,
    DocOut,
    InviteCreated,
    InviteIn,
    InviteOut,
    PatchSite,
    PublishIn,
    PublishOut,
    SeqOut,
    SiteCard,
    SiteContentModel,
    SiteDetail,
    SitesOut,
    SlugCheck,
    TemplateOut,
    UpdatesIn,
    UploadOut,
)
from app.services import (
    crdt,
    documents,
    invites,
    limits,
    presence,
    publish,
    sites,
    slugs,
    stream,
    uploads,
)
from app.services.auth import hash_token
from app.services.revalidate import revalidate, site_tag

router = APIRouter(tags=["sites"])

MAX_SEQ = 2**63 - 1  # bigint
PROTECTED = "Demo sites keep the address they were given — sign up to choose your own"


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(db: Db, user: CurrentUser, settings: AppSettings) -> list[TemplateOut]:
    rows = (await db.execute(select(Template).order_by(Template.sort))).scalars()
    return [
        TemplateOut(
            key=t.key,
            name=t.name,
            business=t.business,
            description=t.description,
            premium=t.premium,
            locked=t.premium and user.plan != "pro",
            preview_url=t.preview_url,
            content=SiteContentModel(**crdt.export(crdt.load(t.snapshot))),
        )
        for t in rows
    ]


@router.get("/sites", response_model=SitesOut)
async def list_sites(db: Db, user: CurrentUser, settings: AppSettings) -> SitesOut:
    return SitesOut(
        sites=await sites.list_cards(db, user, settings),
        limit=sites.site_limit(user),
        owned=await sites.owned_count(db, user),
    )


@router.get("/sites/slug-check", response_model=SlugCheck)
async def slug_check(
    slug: str, db: Db, user: CurrentUser, site_id: uuid.UUID | None = None
) -> SlugCheck:
    """Live check for the template picker, the publish dialog and settings (R2)."""
    if site_id is not None:
        await load_access(db, site_id, user)
    slug = slug.strip().lower()
    issue = slugs.problem(slug)
    if issue is not None:
        code, message = issue
        return SlugCheck(
            slug=slug,
            available=False,
            reason="reserved" if code == "reserved_slug" else "invalid",
            message=message,
            suggestion=None,
        )
    if await publish.slug_taken(db, slug, site_id):
        suggestion = await sites.slug_suggestion(db, slug, site_id)
        return SlugCheck(
            slug=slug,
            available=False,
            reason="taken",
            message=f"{slug} is taken",
            suggestion=suggestion,
        )
    return SlugCheck(slug=slug, available=True, reason="ok", message="Available", suggestion=None)


@router.post("/sites", response_model=SiteCard, status_code=201)
async def create_site(
    body: CreateSite, db: Db, user: CurrentUser, settings: AppSettings
) -> SiteCard:
    await limits.hit(db, f"create-site:{user.id}", 20, limits.HOUR)
    site = await sites.create_site(
        db, user, name=body.name, template_key=body.template, slug=body.slug
    )
    content = await documents.current_content(db, site)
    return sites.card(site, "owner", content, settings, user)


@router.get("/sites/{site_id}", response_model=SiteDetail)
async def get_site(access: Member, db: Db, settings: AppSettings) -> SiteDetail:
    return await sites.detail(db, access, settings)


@router.get("/sites/{site_id}/doc", response_model=DocOut)
async def get_doc(access: Member, db: Db, since: int | None = None) -> DocOut:
    """Snapshot + tail (04 §4). With `since` ≥ the snapshot's seq only the newer tail is sent —
    the v2 polling fallback; otherwise the whole document."""
    site = access.site
    if since is not None and since >= site.snapshot_seq:
        rows = await documents.tail(db, site, since)
        return DocOut(snapshot="", updates=[documents.b64(r.update) for r in rows], seq=site.seq)
    rows = await documents.tail(db, site)
    return DocOut(
        snapshot=documents.b64(site.snapshot),
        updates=[documents.b64(r.update) for r in rows],
        seq=site.seq,
    )


@router.post("/sites/{site_id}/updates", response_model=SeqOut)
async def post_updates(body: UpdatesIn, access: Member, db: Db) -> SeqOut:
    seq = await documents.append(db, access.site.id, body.updates, access.user.id)
    return SeqOut(seq=seq)


@router.get(
    "/sites/{site_id}/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_site(
    request: Request,
    access: Member,
    db: Db,
    from_: Annotated[int | None, Query(alias="from", ge=0, le=MAX_SEQ)] = None,
    last_event_id: Annotated[int | None, Header(ge=0, le=MAX_SEQ)] = None,
) -> StreamingResponse:
    """SSE (04 §5): `hello`, then `update` (id = seq) for every change after `from` /
    `Last-Event-ID`, `gone` when access ends, a comment ping every 20 s; closes after ~280 s."""
    engine = db.bind
    assert isinstance(engine, AsyncEngine)
    since = from_ if from_ is not None else last_event_id if last_event_id is not None else 0
    site_id, user_id = access.site.id, access.user.id
    await db.close()  # don't hold a pooled connection for the stream's lifetime
    return StreamingResponse(
        stream.events(engine, site_id, user_id, hash_token(session_token(request)), since),
        media_type="text/event-stream",
        # no-transform: a compressing proxy (Next's own server does) would buffer the stream.
        headers={"Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no"},
    )


@router.post("/sites/{site_id}/awareness", status_code=204)
async def post_awareness(body: AwarenessIn, access: Member, db: Db) -> Response:
    """Presence (L2): this tab's pointer / selected section / caret, or null when it leaves.
    Never stored past a minute; fanned out by the stream with the poster's name and colour."""
    state = body.state.model_dump(exclude_none=True) if body.state else None
    await presence.publish(db, access.site.id, access.user.id, body.client, body.n, state)
    return Response(status_code=204)


@router.get("/sites/{site_id}/invites", response_model=list[InviteOut])
async def list_invites(access: Owner, db: Db) -> list[InviteOut]:
    return [InviteOut.model_validate(i) for i in await invites.pending(db, access.site.id)]


@router.post("/sites/{site_id}/invites", response_model=InviteCreated, status_code=201)
async def create_invite(
    body: InviteIn, request: Request, access: Owner, db: Db, settings: AppSettings
) -> InviteCreated:
    """L4. Emails the link when email is on; otherwise (and always in the demo) returns it so the
    owner can share it. It only works for the invited address."""
    await limits.hit(db, f"invite:{limits.client_ip(request)}", 30, limits.HOUR)
    await limits.hit(db, f"invite-user:{access.user.id}", 30, limits.HOUR)
    invite, link, emailed = await invites.create_invite(db, access, body.email, settings)
    return InviteCreated(invite=InviteOut.model_validate(invite), emailed=emailed, link=link)


@router.delete("/sites/{site_id}/invites/{invite_id}", status_code=204)
async def revoke_invite(invite_id: uuid.UUID, access: Owner, db: Db) -> Response:
    await invites.revoke(db, access.site.id, invite_id)
    return Response(status_code=204)


@router.delete("/sites/{site_id}/members/{user_id}", status_code=204)
async def remove_member(user_id: uuid.UUID, access: Owner, db: Db) -> Response:
    """L4. Their next request is 404; an open editor of theirs gets `gone` on the stream."""
    await invites.remove_member(db, access, user_id)
    return Response(status_code=204)


@router.post("/sites/{site_id}/publish", response_model=PublishOut)
async def publish_site(
    body: PublishIn, access: Member, db: Db, settings: AppSettings
) -> PublishOut:
    if body.slug.strip().lower() != access.site.slug:
        if access.protected:
            raise ApiError("forbidden", PROTECTED)
        if not access.is_owner:
            raise ApiError("forbidden", "Only the site's owner can change its address")
    pub = await publish.publish_site(
        db,
        access.site.id,
        slug=body.slug,
        seo=body.seo.model_dump(),
        user_id=access.user.id,
        settings=settings,
    )
    return PublishOut(
        version=pub.version,
        slug=pub.slug,
        url=publish.site_url(pub.slug, settings),
        path=publish.site_path(pub.slug),
    )


@router.post("/sites/{site_id}/unpublish", status_code=204)
async def unpublish_site(access: Member, db: Db, settings: AppSettings) -> Response:
    if access.protected:
        raise ApiError(
            "forbidden", "Demo sites stay up until the demo resets — sign up to try this"
        )
    await publish.unpublish_site(db, access.site, settings)
    return Response(status_code=204)


@router.patch("/sites/{site_id}", response_model=SiteDetail)
async def patch_site(body: PatchSite, access: Owner, db: Db, settings: AppSettings) -> SiteDetail:
    site = access.site
    tags: set[str] = set()
    if body.slug is not None and body.slug.strip().lower() != site.slug:
        if access.protected:
            raise ApiError("forbidden", PROTECTED)
        new_slug = body.slug.strip().lower()
        await publish.check_slug(db, new_slug, exclude=site.id)
        if site.published_at:
            tags |= {site_tag(site.slug), site_tag(new_slug)}
        site.slug = new_slug

    if body.name is not None or body.seo is not None:
        name = body.name.strip() if body.name is not None else None
        seo = publish.validate_seo(body.seo.model_dump()) if body.seo is not None else None

        def edit(site_map: Map, _: Array) -> None:
            if name is not None:
                crdt.set_text(site_map, "name", name)
            if seo is not None:
                seo_map = site_map.get("seo")
                if not isinstance(seo_map, Map):
                    site_map["seo"] = seo_map = Map({})
                crdt.set_text(seo_map, "title", seo["title"])
                crdt.set_text(seo_map, "description", seo["description"])
                seo_map["og_image"] = seo["og_image"]

        await documents.server_edit(db, site.id, edit, access.user.id)
        if name is not None:
            site.name = name
    await db.commit()
    if tags:
        await revalidate(sorted(tags), settings)
    return await sites.detail(db, await load_access(db, site.id, access.user), settings)


@router.delete("/sites/{site_id}", status_code=204)
async def delete_site(access: Owner, db: Db, settings: AppSettings) -> Response:
    if access.protected:
        raise ApiError(
            "forbidden", "Demo sites are deleted when the demo resets — sign up to try this"
        )
    site = access.site
    slug = site.slug if site.published_at else None
    await sites.delete_site(db, site, settings)
    if slug:
        await revalidate([site_tag(slug)], settings)
    return Response(status_code=204)


@router.post("/uploads", response_model=UploadOut, status_code=201)
async def upload_image(
    db: Db,
    user: CurrentUser,
    settings: AppSettings,
    site_id: Annotated[uuid.UUID, Form()],
    file: Annotated[UploadFile, File()],
) -> UploadOut:
    access = await load_access(db, site_id, user)
    await limits.hit(db, f"upload:{user.id}", 60, limits.HOUR)  # M2: bounds what one user stores
    data = await file.read(uploads.MAX_BYTES + 1)
    if len(data) > uploads.MAX_BYTES:
        size = file.size or len(data)
        raise ApiError("file_too_large", uploads.too_large_message(size), status=413)
    image = await asyncio.to_thread(uploads.process, data)  # decoding must not stall the loop
    url = await uploads.store(db, access.site.id, image, settings)
    return UploadOut(url=url, width=image.width, height=image.height)
