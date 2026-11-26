"""Own auth (04 §9): users + opaque cookie sessions. Enum-like columns are text + check
constraints (see the migration), so v3's plan change needs no `ALTER TYPE`."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedMixin, UuidMixin

PLANS = ("free", "pro")


class User(UuidMixin, CreatedMixin, Base):
    __tablename__ = "users"

    # Stored lower-cased (the app normalises) and unique: what citext would do, minus the
    # extension.
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)  # argon2id; null = cannot sign in
    name: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[str] = mapped_column(Text, nullable=False, server_default="free")
    avatar_colour: Mapped[str] = mapped_column(Text, nullable=False, server_default="#4338CA")
    # The landing page's demo logins and the platform user: shared by every visitor.
    demo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Session(UuidMixin, CreatedMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_user_id", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # sha256 hex of the cookie value; the raw token exists only in the cookie.
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")
