"""add sync status, device reports, published policy state, and managed apps

Revision ID: 1f4a9c6d2b10
Revises: d98d38f10ac1
Create Date: 2026-08-25 09:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "1f4a9c6d2b10"
down_revision: Union[str, None] = "d98d38f10ac1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "amapi_connection_status",
            sa.String(length=30),
            nullable=False,
            server_default="not_configured",
        ),
    )
    op.add_column("tenants", sa.Column("last_amapi_success_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("last_amapi_error", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("last_sync_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("last_sync_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("tenants", "amapi_connection_status", server_default=None)

    op.add_column("devices", sa.Column("security_patch_level", sa.String(length=50), nullable=True))
    op.add_column("devices", sa.Column("last_reported_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "devices",
        sa.Column("application_reports", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.add_column("policies", sa.Column("google_policy_name", sa.String(length=500), nullable=True))
    op.add_column("policies", sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("policies", sa.Column("last_publish_error", sa.Text(), nullable=True))

    op.add_column("enrollment_tokens", sa.Column("google_token_name", sa.String(length=500), nullable=True))
    op.add_column(
        "enrollment_tokens",
        sa.Column("management_mode", sa.String(length=50), nullable=False, server_default="fully_managed"),
    )
    op.create_unique_constraint("uq_enrollment_tokens_google_token_name", "enrollment_tokens", ["google_token_name"])
    op.alter_column("enrollment_tokens", "management_mode", server_default=None)

    op.create_table(
        "managed_applications",
        sa.Column("tenant_id", sa.BigInteger(), nullable=False),
        sa.Column("package_name", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("install_type", sa.String(length=50), nullable=False),
        sa.Column("auto_update_mode", sa.String(length=80), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("is_kiosk_app", sa.Boolean(), nullable=False),
        sa.Column("last_known_version", sa.String(length=100), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "package_name", name="uq_managed_apps_tenant_package"),
    )
    op.create_index("ix_managed_applications_tenant_id", "managed_applications", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_managed_applications_tenant_id", table_name="managed_applications")
    op.drop_table("managed_applications")

    op.drop_column("policies", "last_publish_error")
    op.drop_column("policies", "last_published_at")
    op.drop_column("policies", "google_policy_name")

    op.drop_column("devices", "application_reports")
    op.drop_column("devices", "last_reported_at")
    op.drop_column("devices", "security_patch_level")

    op.drop_constraint("uq_enrollment_tokens_google_token_name", "enrollment_tokens", type_="unique")
    op.drop_column("enrollment_tokens", "management_mode")
    op.drop_column("enrollment_tokens", "google_token_name")

    op.drop_column("tenants", "last_sync_completed_at")
    op.drop_column("tenants", "last_sync_started_at")
    op.drop_column("tenants", "last_amapi_error")
    op.drop_column("tenants", "last_amapi_success_at")
    op.drop_column("tenants", "amapi_connection_status")
