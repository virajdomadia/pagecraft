"""v1 — users + sessions, templates, sites + site_members + site_updates, publications and
uploads (06 §A).

Enum-like columns are text guarded by check constraints, not native enums: v3 adds a plan and
three template keys without `ALTER TYPE`.

Revision ID: 0001
Revises:
Create Date: 2026-11-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid(name: str = "id", **kw: object) -> sa.Column:
    return sa.Column(name, postgresql.UUID(as_uuid=True), **kw)  # type: ignore[arg-type]


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "users",
        _uuid(primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text()),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("plan", sa.Text(), server_default="free", nullable=False),
        sa.Column("avatar_colour", sa.Text(), server_default="#4338CA", nullable=False),
        sa.Column("demo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("plan in ('free', 'pro')", name="ck_users_plan"),
        sa.CheckConstraint("email = lower(email)", name="ck_users_email_lower"),
    )

    op.create_table(
        "sessions",
        _uuid(primary_key=True),
        _uuid("user_id", nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sessions_user_id_users", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "templates",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("business", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("premium", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("snapshot", sa.LargeBinary(), nullable=False),
        sa.Column("preview_url", sa.Text(), server_default="", nullable=False),
        sa.Column("sort", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("key", name="pk_templates"),
    )

    op.create_table(
        "sites",
        _uuid(primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("template", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("snapshot", sa.LargeBinary(), nullable=False),
        sa.Column("snapshot_seq", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("seq", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("published_version", sa.Integer(), server_default="0", nullable=False),
        _uuid("created_by"),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sites"),
        sa.ForeignKeyConstraint(
            ["template"], ["templates.key"], name="fk_sites_template_templates"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_sites_created_by_users", ondelete="SET NULL"
        ),
        sa.UniqueConstraint("slug", name="uq_sites_slug"),
        sa.CheckConstraint("slug = lower(slug)", name="ck_sites_slug_lower"),
    )
    op.create_index("ix_sites_updated_at", "sites", ["updated_at"])

    op.create_table(
        "site_members",
        _uuid("site_id", nullable=False),
        _uuid("user_id", nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("site_id", "user_id", name="pk_site_members"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_site_members_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_site_members_user_id_users", ondelete="CASCADE"
        ),
        sa.CheckConstraint("role in ('owner', 'editor')", name="ck_site_members_role"),
    )
    op.create_index("ix_site_members_user_id", "site_members", ["user_id"])

    op.create_table(
        "site_updates",
        _uuid("site_id", nullable=False),
        sa.Column("seq", sa.BigInteger(), nullable=False),
        sa.Column("update", sa.LargeBinary(), nullable=False),
        _uuid("author_id"),
        _created_at(),
        sa.PrimaryKeyConstraint("site_id", "seq", name="pk_site_updates"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_site_updates_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name="fk_site_updates_author_id_users", ondelete="SET NULL"
        ),
    )

    op.create_table(
        "publications",
        _uuid(primary_key=True),
        _uuid("site_id", nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("seo", postgresql.JSONB(), nullable=False),
        _uuid("published_by"),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_publications"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_publications_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["published_by"],
            ["users.id"],
            name="fk_publications_published_by_users",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("site_id", "version", name="uq_publications_site_id_version"),
    )
    op.create_index("ix_publications_slug", "publications", ["slug"])

    op.create_table(
        "uploads",
        _uuid(primary_key=True),
        _uuid("site_id", nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name="pk_uploads"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_uploads_site_id_sites", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_uploads_site_id", "uploads", ["site_id"])


def downgrade() -> None:
    for table in (
        "uploads",
        "publications",
        "site_updates",
        "site_members",
        "sites",
        "templates",
        "sessions",
        "users",
    ):
        op.drop_table(table)
