"""v2 L2: presence (cursor, selected section, caret) per open editor tab.

Ephemeral: one row per (site, tab), overwritten in place, swept a minute after the tab goes
quiet. `rev` comes from one sequence and is bumped on every write, so the stream sends only the
rows that changed since its last read.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("create sequence site_awareness_rev")
    op.create_table(
        "site_awareness",
        sa.Column("site_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("state", postgresql.JSONB()),
        sa.Column("n", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "rev",
            sa.BigInteger(),
            server_default=sa.text("nextval('site_awareness_rev')"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("site_id", "client_id", name="pk_site_awareness"),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name="fk_site_awareness_site_id_sites", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_site_awareness_user_id_users", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_site_awareness_site_id_rev", "site_awareness", ["site_id", "rev"])


def downgrade() -> None:
    op.drop_table("site_awareness")
    op.execute("drop sequence site_awareness_rev")
