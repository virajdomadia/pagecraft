"""v2 L5: version history. The site's content as JSON at a moment (publish, every 30 minutes of
editing, before a restore); the newest 10 per site are kept.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "site_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_site_snapshots"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_site_snapshots_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_site_snapshots_author_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_site_snapshots_site_id_created_at", "site_snapshots", ["site_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("site_snapshots")
