"""No-auth routes: `/health`, the published content web renders (`/public/sites/{slug}`) and
uploaded images in the no-Blob fallback (`/media/{id}`)."""

import re
import uuid

from fastapi import APIRouter, Response
from sqlalchemy import select

from app.deps import Db
from app.errors import ApiError
from app.models import Publication, Site, SiteMember, Upload, User
from app.schemas.models import Health, PublishedSite, SeoIn, SiteContentModel

router = APIRouter(tags=["public"])

PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300"
MEDIA_RE = re.compile(r"^([0-9a-f-]{36})(?:\.(?:jpg|png))?$")


@router.get("/health", response_model=Health)
async def health() -> Health:
    return Health(ok=True, service="pagecraft-api", version="1.0.0")


@router.get("/public/sites/{slug}", response_model=PublishedSite)
async def published_site(slug: str, response: Response, db: Db) -> PublishedSite:
    row = (
        await db.execute(
            select(Site, Publication, User.plan)
            .join(Publication, Publication.site_id == Site.id)
            .join(
                SiteMember,
                (SiteMember.site_id == Site.id) & (SiteMember.role == "owner"),
                isouter=True,
            )
            .join(User, User.id == SiteMember.user_id, isouter=True)
            .where(
                Site.slug == slug.lower(),
                Site.published_at.is_not(None),
                Publication.version == Site.published_version,
            )
        )
    ).first()
    if row is None:
        raise ApiError("not_published", "This site is not published", status=404)
    site, pub, plan = row
    response.headers["Cache-Control"] = PUBLIC_CACHE
    return PublishedSite(
        slug=site.slug,
        version=pub.version,
        content=SiteContentModel(**pub.content),
        seo=SeoIn(**pub.seo),
        plan="pro" if plan == "pro" else "free",
        template=site.template,
        published_at=site.published_at,  # type: ignore[arg-type]
    )


@router.get("/media/{name}", include_in_schema=False)
async def media(name: str, db: Db) -> Response:
    match = MEDIA_RE.match(name)
    if match is None:
        raise ApiError("not_found", "Not found")
    row = await db.get(Upload, uuid.UUID(match.group(1)))
    if row is None:
        raise ApiError("not_found", "Not found")
    return Response(
        content=row.data,
        media_type=row.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
