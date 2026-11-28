"""Publish (04 §6): compact → pycrdt export → validation → `publications` v(n) → revalidate.

The published page is a pure function of the CRDT: `publications.content` is what pycrdt exports
from the compacted document, as validated and normalised (tested), never anything the browser
sent.
"""

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.errors import ApiError
from app.models import Publication, Site
from app.sections import ContentError, Seo, validate_content
from app.services import crdt, history, slugs
from app.services.documents import compact_locked, lock_site
from app.services.revalidate import revalidate, site_tag


def site_path(slug: str) -> str:
    return f"/s/{slug}"


def site_url(slug: str, settings: Settings) -> str:
    """The address a person shares. `/s/{slug}` on web is the one that works everywhere; the
    `{slug}.{site_host}` subdomain works once wildcard DNS exists (PRD resolved questions)."""
    return settings.web_url.rstrip("/") + site_path(slug)


async def slug_taken(db: AsyncSession, slug: str, exclude: uuid.UUID | None = None) -> bool:
    query = select(func.count()).select_from(Site).where(Site.slug == slug)
    if exclude is not None:
        query = query.where(Site.id != exclude)
    return bool((await db.execute(query)).scalar_one())


async def check_slug(db: AsyncSession, slug: str, exclude: uuid.UUID | None = None) -> None:
    """422 `reserved_slug` / `invalid_slug`, 409 `slug_taken` with a suggestion."""
    issue = slugs.problem(slug)
    if issue is not None:
        raise ApiError(issue[0], issue[1], status=422)
    if await slug_taken(db, slug, exclude):
        suggestion = await slugs.suggest(slug, lambda s: slug_taken(db, s, exclude))
        raise ApiError(
            "slug_taken",
            f"{slug} is taken — try {suggestion}",
            status=409,
            details={"suggestion": suggestion},
        )


def validate_seo(seo: dict[str, Any]) -> dict[str, Any]:
    from pydantic import ValidationError

    try:
        return Seo.model_validate(seo).model_dump()
    except ValidationError as exc:
        err = exc.errors()[0]
        field = ".".join(str(p) for p in err["loc"])
        raise ApiError(
            "validation",
            str(err["msg"]).removeprefix("Value error, "),
            details={"fields": {f"seo.{field}": str(err["msg"])}},
        ) from exc


async def publish_site(
    db: AsyncSession,
    site_id: uuid.UUID,
    *,
    slug: str,
    seo: dict[str, Any],
    user_id: uuid.UUID | None,
    settings: Settings,
) -> Publication:
    slug = slug.strip().lower()
    await check_slug(db, slug, exclude=site_id)
    seo = validate_seo(seo)

    site = await lock_site(db, site_id)
    await compact_locked(db, site)
    draft = content = crdt.export(crdt.load(site.snapshot))
    try:
        content = validate_content(content)
    except ContentError as exc:
        raise ApiError(
            "invalid_content",
            exc.message,
            status=422,
            details={"section_id": exc.section_id, "field": exc.field},
        ) from exc

    old_slug = site.slug if site.published_at else None
    site.published_version += 1
    publication = Publication(
        site_id=site.id,
        version=site.published_version,
        slug=slug,
        content=content,
        seo=seo,
        published_by=user_id,
    )
    db.add(publication)
    await history.take(db, site.id, draft, f"Published v{site.published_version}", user_id)
    site.slug = slug
    site.published_at = dt.datetime.now(dt.UTC)
    await db.commit()

    tags = {site_tag(slug)}
    if old_slug and old_slug != slug:
        tags.add(site_tag(old_slug))
    await revalidate(sorted(tags), settings)
    return publication


async def unpublish_site(db: AsyncSession, site: Site, settings: Settings) -> None:
    was = site.slug if site.published_at else None
    site.published_at = None
    await db.commit()
    if was:
        await revalidate([site_tag(was)], settings)
