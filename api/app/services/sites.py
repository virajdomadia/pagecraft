"""Sites: create from a template (R2), the dashboard cards (R1), settings (R6)."""

import datetime as dt
import secrets
import uuid
from typing import Any

from pycrdt import Array, Map
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.deps import Access
from app.errors import ApiError
from app.models import Publication, Site, SiteMember, Template, User
from app.schemas.models import Member, SeoIn, SiteCard, SiteContentModel, SiteDetail
from app.services import crdt, documents, uploads
from app.services.publish import check_slug, site_url, slug_taken
from app.services.slugs import slugify, suggest

FREE_SITE_LIMIT = 3
PRO_SITE_LIMIT = 20
PREVIEW_TYPES = ("nav", "hero")


def site_limit(user: User) -> int:
    return PRO_SITE_LIMIT if user.plan == "pro" else FREE_SITE_LIMIT


async def owned_count(db: AsyncSession, user: User) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(SiteMember)
            .where(SiteMember.user_id == user.id, SiteMember.role == "owner")
        )
    ).scalar_one()


def rename_in_doc(name: str, old_name: str | None = None) -> Any:
    """Server-side edit used on create: the site's name, its SEO title and every nav / footer
    brand that still carries the template's name become the new name."""

    def edit(site: Map, sections: Array) -> None:
        crdt.set_text(site, "name", name)
        seo = site.get("seo")
        if isinstance(seo, Map):
            crdt.set_text(seo, "title", name)
        for section in sections:
            props = section.get("props") if isinstance(section, Map) else None
            if isinstance(props, Map) and "brand" in props:
                if old_name is None or str(props["brand"]).lower() == old_name.lower():
                    crdt.set_text(props, "brand", name)

    return edit


async def create_site(
    db: AsyncSession, user: User, *, name: str, template_key: str, slug: str | None
) -> Site:
    tpl = await db.get(Template, template_key)
    if tpl is None:
        raise ApiError("validation", "Unknown template", details={"fields": {"template": "?"}})
    if tpl.premium and user.plan != "pro":
        raise ApiError("premium_template", "That template is part of Pro", status=402)

    name = name.strip()
    wanted = (slug or slugify(name)).strip().lower()
    if user.demo:  # a visitor's sandbox never claims a real-looking address (H1)
        wanted = f"demo-{secrets.token_hex(4)}"
    await check_slug(db, wanted)

    # Serialise one user's creates, so parallel requests can't each pass the limit (L1).
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    if await owned_count(db, user) >= site_limit(user):
        raise ApiError(
            "plan_limit",
            f"The free plan includes {FREE_SITE_LIMIT} sites — delete one to make another",
            status=402,
            details={"limit": FREE_SITE_LIMIT},
        )

    template_name = crdt.export(crdt.load(tpl.snapshot))["site"].get("name")
    edit = crdt.server_edit(tpl.snapshot, [], rename_in_doc(name, template_name))
    snapshot = crdt.compact(tpl.snapshot, [edit] if edit else [])
    site = Site(name=name, template=tpl.key, slug=wanted, snapshot=snapshot, created_by=user.id)
    db.add(site)
    await db.flush()
    db.add(SiteMember(site_id=site.id, user_id=user.id, role="owner"))
    await db.commit()
    return site


def _preview(content: dict[str, Any]) -> SiteContentModel:
    picked = [s for s in content.get("sections", []) if s.get("type") in PREVIEW_TYPES][:2]
    return SiteContentModel(site=content.get("site", {}), sections=picked)


def card(
    site: Site, role: str, content: dict[str, Any], settings: Settings, user: User
) -> SiteCard:
    published = site.published_at is not None
    return SiteCard(
        id=site.id,
        name=site.name,
        template=site.template,
        slug=site.slug,
        status="published" if published else "draft",
        published_url=site_url(site.slug, settings) if published else None,
        published_version=site.published_version,
        updated_at=site.updated_at,
        role=role,  # type: ignore[arg-type]
        protected=user.demo,
        preview=_preview(content),
    )


async def list_cards(db: AsyncSession, user: User, settings: Settings) -> list[SiteCard]:
    rows = (
        await db.execute(
            select(Site, SiteMember.role)
            .join(SiteMember, SiteMember.site_id == Site.id)
            .where(SiteMember.user_id == user.id)
            .order_by(Site.updated_at.desc())
        )
    ).all()
    cards = []
    for site, role in rows:
        content = await documents.current_content(db, site)
        cards.append(card(site, role, content, settings, user))
    return cards


async def detail(db: AsyncSession, access: Access, settings: Settings) -> SiteDetail:
    site = access.site
    content = await documents.current_content(db, site)
    members = (
        await db.execute(
            select(User, SiteMember.role)
            .join(SiteMember, SiteMember.user_id == User.id)
            .where(SiteMember.site_id == site.id)
            .order_by(SiteMember.created_at)
        )
    ).all()
    base = card(site, access.role, content, settings, access.user)
    seo = content.get("site", {}).get("seo", {})
    return SiteDetail(
        **base.model_dump(),
        # Clipped: a draft may be over a limit (publish refuses it); the response model may not.
        seo=SeoIn(
            title=seo.get("title", "")[:70],
            description=seo.get("description", "")[:160],
            og_image=seo.get("og_image", "")[:300],
        ),
        members=[
            Member.model_validate(
                {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                    "role": r,
                    "avatar_colour": u.avatar_colour,
                }
            )
            for u, r in members
        ],
        published_at=site.published_at,
        site_host=settings.site_host,
    )


async def slug_suggestion(db: AsyncSession, slug: str, exclude: uuid.UUID | None) -> str:
    return await suggest(slug, lambda s: slug_taken(db, s, exclude))


async def delete_site(db: AsyncSession, site: Site, settings: Settings) -> None:
    """Database first, then best-effort Blob cleanup: a failed cleanup leaves orphan images,
    never a live site with broken ones (L5)."""
    await db.execute(delete(Publication).where(Publication.site_id == site.id))
    await db.delete(site)
    await db.commit()
    await uploads.delete_prefix(site.id, settings)


# --- the landing page's demo (H1) ---------------------------------------------------------------

DEMO_TTL = dt.timedelta(hours=24)
DEMO_DOMAIN = "@demo.pagecraft.app"
DEMO_PEOPLE = {"creator": ("Deepa Nair", "#2EC4B6"), "collaborator": ("Rohan Mehta", "#FF6B6B")}


async def open_demo(db: AsyncSession, persona: str, settings: Settings) -> User:
    """Each click is a private sandbox: a fresh Deepa (owner) + Rohan (editor) and their own
    copy of Kaapi Corner. Visitors never share a site, never see the public showcase, and
    everything they make is gone after `DEMO_TTL`."""
    await sweep_demo(db, settings)
    tag = secrets.token_hex(4)
    people = {
        key: User(email=f"{key}-{tag}{DEMO_DOMAIN}", name=name, avatar_colour=colour, demo=True)
        for key, (name, colour) in DEMO_PEOPLE.items()
    }
    db.add_all(people.values())
    await db.flush()
    site = await create_site(
        db, people["creator"], name="Kaapi Corner", template_key="cafe", slug=None
    )
    db.add(SiteMember(site_id=site.id, user_id=people["collaborator"].id, role="editor"))
    await db.commit()
    return people[persona]


async def sweep_demo(db: AsyncSession, settings: Settings) -> None:
    expired = select(User.id).where(
        User.demo, User.email.endswith(DEMO_DOMAIN), User.created_at < func.now() - DEMO_TTL
    )
    for site in (await db.execute(select(Site).where(Site.created_by.in_(expired)))).scalars():
        await delete_site(db, site, settings)
    await db.execute(delete(User).where(User.id.in_(expired)))
    await db.commit()
