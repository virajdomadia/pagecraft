"""Own cookie-session auth (04 §9), the same recipe as Tripsmith: argon2id passwords, opaque
30-day tokens whose SHA-256 is all the database keeps, cookie `pc_session` (HttpOnly,
SameSite=Lax, Secure on https, host-only — it arrives through web's `/api/*` rewrite, so it
belongs to the web origin)."""

import asyncio
import datetime as dt
import functools
import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models import Session, User

COOKIE_NAME = "pc_session"
SESSION_TTL = dt.timedelta(days=30)
AVATAR_COLOURS = ("#4338CA", "#FF6B6B", "#2EC4B6", "#F59E0B", "#0EA5E9", "#A855F7")

hasher = PasswordHasher()


@functools.cache
def dummy_hash() -> str:
    """Unknown emails verify against this, so timing does not reveal which emails exist."""
    return hasher.hash("pagecraft-no-such-user")


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        hasher.verify(password_hash or dummy_hash(), password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return bool(password_hash)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def avatar_colour(email: str) -> str:
    return AVATAR_COLOURS[int(hashlib.sha256(email.encode()).hexdigest(), 16) % len(AVATAR_COLOURS)]


def normalise_email(email: str) -> str:
    return email.strip().lower()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


async def open_session(db: AsyncSession, user: User) -> tuple[Session, str]:
    """A new session for `user`, committed; expired sessions are swept on the way."""
    now = _now()
    await db.execute(delete(Session).where(Session.expires_at <= now))
    token = secrets.token_urlsafe(32)
    session = Session(user_id=user.id, token_hash=hash_token(token), expires_at=now + SESSION_TTL)
    db.add(session)
    await db.commit()
    return session, token


async def login(db: AsyncSession, email: str, password: str) -> tuple[User, Session, str] | None:
    user = (
        await db.execute(select(User).where(User.email == normalise_email(email)))
    ).scalar_one_or_none()
    ok = await asyncio.to_thread(verify_password, user.password_hash if user else None, password)
    if not ok or user is None:
        return None
    session, token = await open_session(db, user)
    return user, session, token


async def find_session(db: AsyncSession, token: str) -> Session | None:
    if not token:
        return None
    session = (
        await db.execute(
            select(Session)
            .options(selectinload(Session.user))
            .where(Session.token_hash == hash_token(token))
        )
    ).scalar_one_or_none()
    if session is None:
        return None
    if session.expires_at <= _now():
        await db.delete(session)
        await db.commit()
        return None
    return session


async def delete_session(db: AsyncSession, token: str) -> None:
    await db.execute(delete(Session).where(Session.token_hash == hash_token(token)))
    await db.commit()


def _secure(settings: Settings) -> bool:
    return settings.web_url.startswith("https://")


def set_session_cookie(
    response: Response, token: str, expires_at: dt.datetime, settings: Settings
) -> None:
    max_age = max(0, int((expires_at - _now()).total_seconds()))
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite="lax",
        secure=_secure(settings),
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME, path="/", httponly=True, samesite="lax", secure=_secure(settings)
    )
