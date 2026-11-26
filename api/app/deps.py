"""Request dependencies: the session user, and site access (06 §C — 🔒 signed in, 👥 member of
the site with 404 for everyone else, 👑 owner)."""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import get_session
from app.errors import ApiError
from app.models import Site, SiteMember, User
from app.services.auth import COOKIE_NAME, find_session

Db = Annotated[AsyncSession, Depends(get_session)]


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


AppSettings = Annotated[Settings, Depends(get_settings_dep)]


async def current_user(request: Request, db: Db) -> User | None:
    token = request.cookies.get(COOKIE_NAME, "")
    session = await find_session(db, token) if token else None
    return session.user if session else None


async def require_user(user: Annotated[User | None, Depends(current_user)]) -> User:
    if user is None:
        raise ApiError("unauthorized", "Sign in to continue")
    return user


CurrentUser = Annotated[User, Depends(require_user)]


@dataclass
class Access:
    site: Site
    role: str
    user: User

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    @property
    def protected(self) -> bool:
        """A seeded showcase site seen through a shared demo login: its address and existence
        are fixed (the landing page links to it), its content is the demo."""
        return self.user.demo and self.site.created_by is None


NOT_FOUND = "Site not found"


async def load_access(db: AsyncSession, site_id: uuid.UUID, user: User) -> Access:
    row = (
        await db.execute(
            select(Site, SiteMember.role)
            .join(SiteMember, SiteMember.site_id == Site.id)
            .where(Site.id == site_id, SiteMember.user_id == user.id)
        )
    ).first()
    if row is None:
        raise ApiError("not_found", NOT_FOUND)
    return Access(site=row[0], role=row[1], user=user)


async def site_member(site_id: uuid.UUID, user: CurrentUser, db: Db) -> Access:
    return await load_access(db, site_id, user)


async def site_owner(access: Annotated[Access, Depends(site_member)]) -> Access:
    if not access.is_owner:
        raise ApiError("forbidden", "Only the site's owner can do that")
    return access


Member = Annotated[Access, Depends(site_member)]
Owner = Annotated[Access, Depends(site_owner)]
