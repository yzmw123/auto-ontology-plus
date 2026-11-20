"""Curated field references, classifications and retirement decisions."""

# SPDX-License-Identifier: Apache-2.0
from alembic import op

revision = "5df49f29a231"
down_revision = "caee572fa81c"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE field_reference (
        id text PRIMARY KEY DEFAULT (gen_random_uuid())::text, name text NOT NULL,
        source_table text NOT NULL REFERENCES catalog_table(id) ON DELETE CASCADE,
        target_table text NOT NULL REFERENCES catalog_table(id) ON DELETE CASCADE,
        source_term text REFERENCES term(id) ON DELETE CASCADE,
        target_term text REFERENCES term(id) ON DELETE CASCADE,
        pairs jsonb NOT NULL, enabled boolean NOT NULL, origin_key text UNIQUE,
        version integer NOT NULL DEFAULT 1,
        CONSTRAINT uq_field_reference_role UNIQUE(source_table,target_table,name))""")
    op.execute("""CREATE TABLE term_classification (
        term_id text PRIMARY KEY REFERENCES term(id) ON DELETE CASCADE,
        parent_id text REFERENCES term(id) ON DELETE RESTRICT,
        table_id text NOT NULL REFERENCES catalog_table(id) ON DELETE CASCADE,
        conditions jsonb NOT NULL, display_columns jsonb NOT NULL)""")
    op.execute(
        "CREATE TABLE retired_term (term_id text PRIMARY KEY, name text NOT NULL, table_ids text[] NOT NULL)"
    )


def downgrade():
    op.drop_table("term_classification")
    op.drop_table("field_reference")
    op.drop_table("retired_term")
