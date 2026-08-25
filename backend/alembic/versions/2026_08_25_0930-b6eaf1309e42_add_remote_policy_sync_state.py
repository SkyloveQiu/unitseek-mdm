"""add remote policy synchronization state

Revision ID: b6eaf1309e42
Revises: 1f4a9c6d2b10
Create Date: 2026-08-25 09:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "b6eaf1309e42"
down_revision: Union[str, None] = "1f4a9c6d2b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "policies", sa.Column("last_remote_sync_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "policies",
        sa.Column(
            "remote_policy_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("policies", "remote_policy_json")
    op.drop_column("policies", "last_remote_sync_at")
