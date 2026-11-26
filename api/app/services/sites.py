"""Sites: create from a template (R2), the dashboard cards (R1), settings (R6)."""

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
from app.services import crdt, documents
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


async def _recycle_demo_site(db: AsyncSession, user: User) -> None:
    """The landing page's demo creator is shared by every visitor, so its free-plan limit would
    lock the next visitor out. Instead of a dead end, the oldest site a visitor made with it
    (never the seeded showcase) is recycled. Real accounts get the 402."""
    oldest = (
        await db.execute(
            select(Site).where(Site.created_by == user.id).order_by(Site.created_at).limit(1)
        )
    ).scalar_one_or_none()
    if oldest is None:
        raise ApiError("plan_limit", "The demo account is full right now", status=402)
    await db.delete(oldest)
    await db.flush()


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
    await check_slug(db, wanted)

    if await owned_count(db, user) >= site_limit(user):
        if not user.demo:
            raise ApiError(
                "plan_limit",
                f"The free plan includes {FREE_SITE_LIMIT} sites — delete one to make another",
                status=402,
                details={"limit": FREE_SITE_LIMIT},
            )
        await _recycle_demo_site(db, user)

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
        protected=user.demo and site.created_by is None,
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
        seo=SeoIn(
            title=seo.get("title", ""),
            description=seo.get("description", ""),
            og_image=seo.get("og_image", ""),
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


async def delete_site(db: AsyncSession, site: Site) -> None:
    await db.execute(delete(Publication).where(Publication.site_id == site.id))
    await db.delete(site)
    await db.commit()
