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


# "Open as your teammate" (L3): a second tab of the same browser signs in as the demo
# teammate without replacing this tab's cookie, by sending its session in this header.
TAB_HEADER = "x-pagecraft-session"


def session_token(request: Request) -> str:
    """The token `current_user` authenticated this request with ("" if none)."""
    return getattr(request.state, "session_token", "")


async def current_user(request: Request, db: Db) -> User | None:
    tab = request.headers.get(TAB_HEADER, "")
    session = await find_session(db, tab) if tab else None
    # Only demo sessions may travel in a script-readable header; a real account's never does.
    if session is None or not session.user.demo:
        tab = request.cookies.get(COOKIE_NAME, "")
        session = await find_session(db, tab) if tab else None
    request.state.session_token = tab if session else ""
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
        """Seen from a demo sandbox: the address is generated (`demo-…`) and stays fixed, and the
        site can't be unpublished or deleted — the sandbox expires instead (H1)."""
        return self.user.demo


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
