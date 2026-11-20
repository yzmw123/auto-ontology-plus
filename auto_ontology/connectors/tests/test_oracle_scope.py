"""Oracle scope is an owner/table pair, including when different owners reuse a name."""

import pytest

from auto_ontology.connectors.oracle import OracleDatabase


def test_query_scope_uses_owner_and_preserves_quoted_names() -> None:
    connector = OracleDatabase.__new__(OracleDatabase)
    connector._schema = "READER"
    connector._tables = {("ONE", "SALES"), ("TWO", "SALES"), ("MixedCase", "Sales")}
    connector._sensitive_tables = {("TWO", "SALES")}
    for sql in (
        "SELECT * FROM ONE.SALES",
        "SELECT COUNT(*) FROM TWO.SALES",
        'SELECT * FROM "MixedCase"."Sales"',
        "WITH sales AS (SELECT * FROM ONE.sales) SELECT * FROM sales",
    ):
        assert connector._validate(sql) == sql
    for sql in (
        "SELECT * FROM sales",
        "SELECT * FROM THREE.sales",
        "SELECT * FROM TWO.sales",
        "SELECT * FROM mixedcase.sales",
    ):
        with pytest.raises(ValueError):
            connector._validate(sql)
