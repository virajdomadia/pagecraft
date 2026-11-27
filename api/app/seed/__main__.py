"""Seed (R7, 07 S2): idempotent — run it twice and nothing is duplicated.

    uv run python -m app.seed            # create what is missing, publish what never was
    uv run python -m app.seed --reset    # also rebuild every showcase site from its template

- users: the platform account (no password; it owns every showcase site). The landing page's
  demo logins are per-visitor sandboxes made by `POST /auth/demo`, not seeded.
- templates: six, each a real Yjs snapshot built by pycrdt from `seed/templates/*.json`
  (snapshots are refreshed on every run, so editing a JSON file and re-seeding is enough).
- showcase sites: one per template, published through `services/publish.py` (export +
  validate, exactly like the editor's Publish), all owned by the platform account and nobody
  else — so no demo visitor can edit what the landing page links to.

Database: `DATABASE_URL` (api/.env.local or the environment).
"""

import argparse
import asyncio

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import dispose_engine, session_factory
from app.models import Site, SiteMember, SiteUpdate, Template, User
from app.services.auth import avatar_colour
from app.services.publish import publish_site
from app.services.templates import load_templates

PLATFORM = ("platform@pagecraft.app", "Pagecraft")


async def upsert_user(db: AsyncSession, email: str, name: str, colour: str | None = None) -> User:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(email=email, name=name, avatar_colour=colour or avatar_colour(email))
        db.add(user)
    user.demo = False  # v1 seeded it as a demo user
    await db.flush()
    return user


async def seed(db: AsyncSession, settings: Settings, *, reset: bool = False) -> dict[str, int]:
    platform = await upsert_user(db, *PLATFORM, colour="#1B1B2F")

    counts = {"templates": 0, "sites_created": 0, "published": 0}
    for spec in load_templates():
        tpl = await db.get(Template, spec.key)
        snapshot = spec.snapshot()
        if tpl is None:
            tpl = Template(key=spec.key)
            db.add(tpl)
        tpl.name, tpl.business, tpl.description = spec.name, spec.business, spec.description
        tpl.sort, tpl.premium, tpl.snapshot = spec.sort, False, snapshot
        tpl.preview_url = f"/s/{spec.showcase_slug}"
        counts["templates"] += 1
    await db.commit()

    for spec in load_templates():
        site = (
            await db.execute(select(Site).where(Site.slug == spec.showcase_slug))
        ).scalar_one_or_none()
        if site is None:
            site = Site(
                name=spec.content["site"]["name"],
                template=spec.key,
                slug=spec.showcase_slug,
                snapshot=spec.snapshot(),
                created_by=None,  # seeded
            )
            db.add(site)
            await db.flush()
            db.add(SiteMember(site_id=site.id, user_id=platform.id, role="owner"))
            await db.commit()
            counts["sites_created"] += 1
        else:
            # v1 shared Kaapi Corner with the demo logins: the platform is the only member now.
            await db.execute(delete(SiteMember).where(SiteMember.site_id == site.id))
            db.add(SiteMember(site_id=site.id, user_id=platform.id, role="owner"))
            if reset:
                site.snapshot, site.snapshot_seq, site.seq = spec.snapshot(), 0, 0
                await db.execute(delete(SiteUpdate).where(SiteUpdate.site_id == site.id))
            await db.commit()

        if reset or site.published_at is None:
            await publish_site(
                db,
                site.id,
                slug=spec.showcase_slug,
                seo=spec.content["site"]["seo"],
                user_id=platform.id,
                settings=settings,
            )
            counts["published"] += 1
    return counts


async def main(reset: bool) -> None:
    settings = get_settings()
    try:
        async with session_factory(settings)() as db:
            counts = await seed(db, settings, reset=reset)
        print(
            f"templates: {counts['templates']} · showcase sites created: "
            f"{counts['sites_created']} · published: {counts['published']}"
        )
    finally:
        await dispose_engine()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="rebuild showcase sites")
    asyncio.run(main(parser.parse_args().reset))
