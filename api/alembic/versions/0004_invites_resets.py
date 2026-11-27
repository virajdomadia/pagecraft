"""v2 L4: invites to a site, and password-reset tokens.

Both store only the SHA-256 of their token (like sessions); the raw token exists in the link.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _ts(name: str, nullable: bool = True, now: bool = False) -> sa.Column:
    default = sa.text("now()") if now else None
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable, server_default=default)


def upgrade() -> None:
    op.create_table(
        "invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), server_default="editor", nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True)),
        _ts("expires_at", nullable=False),
        _ts("accepted_at"),
        _ts("created_at", nullable=False, now=True),
        sa.PrimaryKeyConstraint("id", name="pk_invites"),
        sa.UniqueConstraint("token_hash", name="uq_invites_token_hash"),
        sa.CheckConstraint("role in ('editor')", name="ck_invites_role"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_invites_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"], ["users.id"], name="fk_invites_invited_by_users", ondelete="SET NULL"
        ),
    )
    op.create_index("ix_invites_site_id", "invites", ["site_id"])
    op.create_table(
        "password_resets",
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        _ts("expires_at", nullable=False),
        _ts("used_at"),
        _ts("created_at", nullable=False, now=True),
        sa.PrimaryKeyConstraint("token_hash", name="pk_password_resets"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_password_resets_user_id_users",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("password_resets")
    op.drop_table("invites")
