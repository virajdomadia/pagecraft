"""Invites, members and password resets (L4).

Tokens are 32 random bytes; only their SHA-256 is stored. The demo wall (27 Nov review):
- a demo sandbox's owner can only invite `@example.com` addresses (reserved, never a real
  inbox), and those invites are never emailed;
- real owners can't invite demo addresses, and an invite is only accepted by an account of the
  same kind as the site's (a real account never joins a demo sandbox, and vice versa);
- password resets exist only for real accounts with a password, and their link only ever goes
  by email: never in an API response, so never on screen.
"""

import datetime as dt
import secrets
import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.deps import Access
from app.errors import ApiError
from app.models import Invite, PasswordReset, Session, Site, SiteAwareness, SiteMember, User
from app.services import auth, email
from app.services.sites import DEMO_DOMAIN

INVITE_TTL = dt.timedelta(days=7)
RESET_TTL = dt.timedelta(hours=1)
DEMO_INVITE_DOMAIN = "@example.com"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, auth.hash_token(token)


async def _site_is_demo(db: AsyncSession, site: Site) -> bool:
    if site.created_by is None:
        return False
    return bool((await db.execute(select(User.demo).where(User.id == site.created_by))).scalar())


async def create_invite(
    db: AsyncSession, access: Access, raw_email: str, settings: Settings
) -> tuple[Invite, str | None, bool]:
    """→ (invite, link to show the owner or None, emailed)."""
    address = auth.normalise_email(raw_email)
    demo = access.user.demo
    if demo and not address.endswith(DEMO_INVITE_DOMAIN):
        raise ApiError(
            "forbidden",
            "In the demo you can invite @example.com addresses only. Sign up to invite real people",
        )
    if not demo and address.endswith(DEMO_DOMAIN):
        raise ApiError("validation", "That address can't be invited")
    member = (
        await db.execute(
            select(SiteMember.user_id)
            .join(User, User.id == SiteMember.user_id)
            .where(SiteMember.site_id == access.site.id, User.email == address)
        )
    ).first()
    if member is not None:
        raise ApiError("conflict", "They can already edit this site")

    # One pending invite per address: inviting again replaces the link.
    await db.execute(
        delete(Invite).where(
            Invite.site_id == access.site.id, Invite.email == address, Invite.accepted_at.is_(None)
        )
    )
    token, token_hash = _token()
    invite = Invite(
        site_id=access.site.id,
        email=address,
        token_hash=token_hash,
        invited_by=access.user.id,
        expires_at=_now() + INVITE_TTL,
    )
    db.add(invite)
    await db.commit()

    link = f"{settings.web_url.rstrip('/')}/invites/{token}"
    emailed = not demo and await email.send(
        settings,
        address,
        f"{access.user.name} invited you to edit {access.site.name} on Pagecraft",
        f"{access.user.name} invited you to edit the site “{access.site.name}” on Pagecraft.\n\n"
        f"Open this link to join (it works for 7 days, for {address}):\n{link}\n\n"
        "If you weren't expecting this, you can ignore it.\n",
    )
    # The inviting owner may always see their own invite link; it only works for `address`.
    return invite, None if emailed else link, emailed


async def pending(db: AsyncSession, site_id: uuid.UUID) -> list[Invite]:
    return list(
        (
            await db.execute(
                select(Invite)
                .where(
                    Invite.site_id == site_id,
                    Invite.accepted_at.is_(None),
                    Invite.expires_at > _now(),
                )
                .order_by(Invite.created_at)
            )
        ).scalars()
    )


async def revoke(db: AsyncSession, site_id: uuid.UUID, invite_id: uuid.UUID) -> None:
    await db.execute(delete(Invite).where(Invite.site_id == site_id, Invite.id == invite_id))
    await db.commit()


async def find(db: AsyncSession, token: str) -> tuple[Invite, Site, User | None]:
    row = (
        await db.execute(
            select(Invite, Site, User)
            .join(Site, Site.id == Invite.site_id)
            .outerjoin(User, User.id == Invite.invited_by)
            .where(Invite.token_hash == auth.hash_token(token))
        )
    ).first()
    if row is None:
        raise ApiError("not_found", "This invite link doesn't work. Ask for a new one")
    return row[0], row[1], row[2]


async def accept(db: AsyncSession, token: str, user: User) -> Site:
    invite, site, _ = await find(db, token)
    if invite.accepted_at is not None or invite.expires_at <= _now():
        raise ApiError("not_found", "This invite has been used or has expired. Ask for a new one")
    if user.email != invite.email:
        raise ApiError("forbidden", f"This invite is for {invite.email}. Sign in with that email")
    if user.demo != await _site_is_demo(db, site):
        raise ApiError("forbidden", "Demo invites can't be accepted. Sign up to invite real people")
    exists = await db.get(SiteMember, (site.id, user.id))
    if exists is None:
        db.add(SiteMember(site_id=site.id, user_id=user.id, role=invite.role))
    invite.accepted_at = _now()
    await db.commit()
    return site


async def remove_member(db: AsyncSession, access: Access, user_id: uuid.UUID) -> None:
    if user_id == access.user.id:
        raise ApiError("validation", "You own this site; you can't remove yourself")
    member = await db.get(SiteMember, (access.site.id, user_id))
    if member is None:
        raise ApiError("not_found", "They aren't a member of this site")
    if member.role == "owner":
        raise ApiError("forbidden", "The owner can't be removed")
    await db.delete(member)
    # Their cursor goes at once; their open stream ends on its next tick (membership check).
    await db.execute(
        delete(SiteAwareness).where(
            SiteAwareness.site_id == access.site.id, SiteAwareness.user_id == user_id
        )
    )
    await db.commit()


# --- password reset -----------------------------------------------------------------------------


async def start_reset(db: AsyncSession, raw_email: str, settings: Settings) -> None:
    """Email a reset link if a real account with a password has this address. Says nothing
    either way (no account enumeration), and never returns the link."""
    if not email.enabled(settings):
        return
    user = (
        await db.execute(select(User).where(User.email == auth.normalise_email(raw_email)))
    ).scalar_one_or_none()
    if user is None or user.demo or not user.password_hash:
        return
    token, token_hash = _token()
    db.add(PasswordReset(token_hash=token_hash, user_id=user.id, expires_at=_now() + RESET_TTL))
    await db.commit()
    link = f"{settings.web_url.rstrip('/')}/reset#token={token}"
    await email.send(
        settings,
        user.email,
        "Reset your Pagecraft password",
        f"Someone asked to reset the password for {user.email} on Pagecraft.\n\n"
        f"Choose a new one here (the link works once, for 1 hour):\n{link}\n\n"
        "If it wasn't you, ignore this email: your password stays the same.\n",
    )


async def finish_reset(db: AsyncSession, token: str, password: str) -> User:
    reset = await db.get(PasswordReset, auth.hash_token(token))
    if reset is None or reset.used_at is not None or reset.expires_at <= _now():
        raise ApiError(
            "not_found", "This reset link has been used or has expired. Ask for a new one"
        )
    user = await db.get(User, reset.user_id)
    if user is None or user.demo:
        raise ApiError(
            "not_found", "This reset link has been used or has expired. Ask for a new one"
        )
    user.password_hash = auth.hash_password(password)
    reset.used_at = _now()
    # Every other session ends: whoever knew the old password is signed out, and older links die.
    await db.execute(delete(Session).where(Session.user_id == user.id))
    await db.execute(
        update(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
        .values(used_at=_now())
    )
    await db.commit()
    return user
