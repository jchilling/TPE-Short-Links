"""init

Revision ID: 20260126_0001
Revises: 
Create Date: 2026-01-26

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260126_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ux_tags_name", "tags", ["name"], unique=True)

    op.create_table(
        "reserved_codes",
        sa.Column("code", sa.String(length=32), primary_key=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("type", sa.String(length=16), nullable=False, server_default=sa.text("'reserved'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "short_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], name="fk_short_links_tag_id_tags", ondelete="RESTRICT"),
    )
    op.create_index("ux_short_links_code", "short_links", ["code"], unique=True)
    op.create_index("ix_short_links_tag_id", "short_links", ["tag_id"], unique=False)
    op.create_index("ix_short_links_created_at", "short_links", ["created_at"], unique=False)

    # Seed a few default tags (safe to re-run? This migration runs once).
    op.execute(
        sa.text(
            """
            INSERT INTO tags (name, is_active)
            VALUES
              ('General', true),
              ('Marketing', true),
              ('Engineering', true),
              ('Support', true)
            """
        )
    )

    # Seed a few always-blocked/reserved codes.
    op.execute(
        sa.text(
            """
            INSERT INTO reserved_codes (code, reason, type)
            VALUES
              ('api', 'reserved path', 'reserved'),
              ('docs', 'reserved path', 'reserved'),
              ('admin', 'reserved path', 'reserved'),
              ('health', 'reserved path', 'reserved'),
              ('metrics', 'reserved path', 'reserved')
            ON CONFLICT (code) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_short_links_created_at", table_name="short_links")
    op.drop_index("ix_short_links_tag_id", table_name="short_links")
    op.drop_index("ux_short_links_code", table_name="short_links")
    op.drop_table("short_links")
    op.drop_table("reserved_codes")
    op.drop_index("ux_tags_name", table_name="tags")
    op.drop_table("tags")
