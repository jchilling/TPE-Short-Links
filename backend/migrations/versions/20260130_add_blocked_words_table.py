"""add blocked_words table

Revision ID: 20260130_0001
Revises: 20260128_155544
Create Date: 2026-01-30

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from pathlib import Path


revision = "20260130_0001"
down_revision = "20260128_155544"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create blocked_words table
    op.create_table(
        "blocked_words",
        sa.Column("word", sa.String(length=4), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Seed from blocked_words.txt if it exists
    blocked_words_file = Path(__file__).parent.parent.parent / "app" / "blocked_words.txt"
    if blocked_words_file.exists():
        words = []
        with open(blocked_words_file, "r") as f:
            for line in f:
                word = line.strip().lower()
                if word and len(word) <= 4:
                    words.append(word)
        
        if words:
            # Insert in batches to avoid too large queries
            batch_size = 500
            for i in range(0, len(words), batch_size):
                batch = words[i:i + batch_size]
                values = ", ".join([f"('{w}')" for w in batch])
                op.execute(sa.text(f"INSERT INTO blocked_words (word) VALUES {values} ON CONFLICT (word) DO NOTHING"))


def downgrade() -> None:
    op.drop_table("blocked_words")
