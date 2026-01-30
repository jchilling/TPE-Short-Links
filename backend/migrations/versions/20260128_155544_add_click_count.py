"""add click_count

Revision ID: 20260128_155544
Revises: 20260126_0001
Create Date: 2026-01-28

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260128_155544"
down_revision = "20260126_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "short_links",
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("short_links", "click_count")
