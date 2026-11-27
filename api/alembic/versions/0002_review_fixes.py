"""Review fixes 2026-11-27: `snapshot_seq <= seq` (C1) and the rate-limit log (M1).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # C1 could leave seq behind snapshot_seq (or behind a tail row); move it forward first.
    op.execute(
        "update sites s set seq = greatest(s.seq, s.snapshot_seq, coalesce("
        "(select max(u.seq) from site_updates u where u.site_id = s.id), 0))"
    )
    op.create_check_constraint("snapshot_seq_le_seq", "sites", "snapshot_seq <= seq")

    op.create_table(
        "rate_hits",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column(
            "at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rate_hits"),
    )
    op.create_index("ix_rate_hits_key_at", "rate_hits", ["key", "at"])
    op.create_index("ix_rate_hits_at", "rate_hits", ["at"])


def downgrade() -> None:
    op.drop_table("rate_hits")
    op.drop_constraint("snapshot_seq_le_seq", "sites", type_="check")
