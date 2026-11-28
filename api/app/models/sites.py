"""Templates, sites, members, the update log, publications and uploads (06 §A).

The live document of a site is `sites.snapshot` (a compacted Yjs update, built with pycrdt)
plus the `site_updates` tail above `snapshot_seq`; it is bytes, never JSON, until publish.
`publications.content` is the JSON export the published page renders.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedMixin, TimestampsMixin, UuidMixin

ROLES = ("owner", "editor")
TEMPLATE_KEYS = ("cafe", "salon", "freelancer", "gym", "launch", "restaurant")


class Template(Base):
    __tablename__ = "templates"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    business: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    premium: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    snapshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # a real Y.Doc update
    # The template's live showcase site (`/s/{slug}`), published by the seed.
    preview_url: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class Site(UuidMixin, TimestampsMixin, Base):
    __tablename__ = "sites"
    __table_args__ = (Index("ix_sites_updated_at", "updated_at"),)

    name: Mapped[str] = mapped_column(Text, nullable=False)
    template: Mapped[str] = mapped_column(Text, ForeignKey("templates.key"), nullable=False)
    # The site's address, reserved platform-wide from creation (lower-case; R2). Served at
    # /s/{slug} and {slug}.pagecraft… while `published_at` is set.
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    snapshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    snapshot_seq: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    seq: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class SiteMember(CreatedMixin, Base):
    __tablename__ = "site_members"
    __table_args__ = (Index("ix_site_members_user_id", "user_id"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)


class SiteUpdate(CreatedMixin, Base):
    __tablename__ = "site_updates"

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    seq: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    update: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class SiteAwareness(Base):
    """Presence of one open editor tab (L2): pointer, selected section, caret. Ephemeral."""

    __tablename__ = "site_awareness"
    __table_args__ = (Index("ix_site_awareness_site_id_rev", "site_id", "rev"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    client_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # the tab's Y.Doc clientID
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    state: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True))  # null: tab left
    n: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")  # tab's counter
    rev: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default=text("nextval('site_awareness_rev')")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SiteSnapshot(UuidMixin, CreatedMixin, Base):
    """Version history (L5): the site's content as JSON at one moment. Newest 10 kept."""

    __tablename__ = "site_snapshots"
    __table_args__ = (Index("ix_site_snapshots_site_id_created_at", "site_id", "created_at"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class Invite(UuidMixin, CreatedMixin, Base):
    """An invitation to edit a site (L4). Only the token's SHA-256 is stored."""

    __tablename__ = "invites"
    __table_args__ = (Index("ix_invites_site_id", "site_id"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)  # lower-cased
    role: Mapped[str] = mapped_column(Text, nullable=False, server_default="editor")
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Publication(UuidMixin, CreatedMixin, Base):
    __tablename__ = "publications"
    __table_args__ = (
        UniqueConstraint("site_id", "version"),
        Index("ix_publications_slug", "slug"),
    )

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    seo: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    published_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class Upload(UuidMixin, CreatedMixin, Base):
    """Image bytes for the no-Blob fallback, served at `/media/{id}`. With
    `BLOB_READ_WRITE_TOKEN` set, uploads go to Vercel Blob and this table stays empty."""

    __tablename__ = "uploads"
    __table_args__ = (Index("ix_uploads_site_id", "site_id"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
