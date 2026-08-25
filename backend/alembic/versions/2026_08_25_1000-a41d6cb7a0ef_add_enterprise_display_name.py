"""add Google enterprise display name

Revision ID: a41d6cb7a0ef
Revises: b6eaf1309e42
Create Date: 2026-08-25 10:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a41d6cb7a0ef"
down_revision: Union[str, None] = "b6eaf1309e42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("enterprise_display_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "enterprise_display_name")
