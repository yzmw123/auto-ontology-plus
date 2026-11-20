# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES.
# SPDX-License-Identifier: Apache-2.0
"""Read-only Oracle connector scoped to selected owners and readable business tables."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, unquote, urlparse

import oracledb
import pandas as pd
import sqlglot
from sqlglot import exp
from sqlglot.optimizer.scope import Scope, traverse_scope

from auto_ontology.connectors.base import SQLDatabase, StatementTimeout
from auto_ontology.utils.sql_identifiers import quoted_identifier

_SECRET_COLUMNS = {"PASSWORD", "PASSWD", "SECRET", "TOKEN", "CREDENTIAL"}


# ALL_TABLES includes objects visible through non-read grants as well.
_READABLE_TABLES = """
    SELECT t.owner, t.table_name FROM all_tables t
    JOIN all_users u ON u.username = t.owner
    WHERE u.oracle_maintained = 'N' AND t.nested = 'NO' AND t.secondary = 'N'
      AND (t.owner = USER OR EXISTS (
          SELECT 1 FROM session_privs WHERE privilege IN ('READ ANY TABLE','SELECT ANY TABLE')
      ) OR EXISTS (
          SELECT 1 FROM all_tab_privs p WHERE p.table_schema = t.owner AND p.table_name = t.table_name
          AND p.privilege IN ('SELECT','READ') AND
          (p.grantee IN (USER,'PUBLIC') OR p.grantee IN (SELECT role FROM session_roles))
      ))
"""


class OracleDatabase(SQLDatabase):
    supports_statement_timeout = True
    supports_read_only = True

    def __init__(
        self, connection_string: str, schemas: list[str] | None = None
    ) -> None:
        parsed = urlparse(connection_string)
        if not parsed.hostname or not parsed.username or not parsed.path.strip("/"):
            raise ValueError("Oracle URL must provide user, host and service name")
        self._schema = unquote(parsed.username).upper()
        service_name = unquote(parsed.path.strip("/"))
        self._database_name = parse_qs(parsed.query).get(
            "metadata_database", [service_name]
        )[0]
        self._pool = oracledb.create_pool(
            user=unquote(parsed.username),
            password=unquote(parsed.password or ""),
            dsn=oracledb.makedsn(
                parsed.hostname, parsed.port or 1521, service_name=service_name
            ),
            tcp_connect_timeout=8,
            min=1,
            max=4,
            increment=1,
        )
        # Environment connections created before schema selection retain their own owner.
        self._owners = list(dict.fromkeys(schemas or [self._schema]))
        slots = ", ".join(f":{i}" for i in range(1, len(self._owners) + 1))
        self._catalog_cte = (
            f"WITH readable AS ({_READABLE_TABLES} AND t.owner IN ({slots})) "
        )
        try:
            inventory = self._metadata("""
                SELECT t.owner, t.table_name, MAX(CASE WHEN UPPER(c.column_name) IN
                    ('PASSWORD','PASSWD','SECRET','TOKEN','CREDENTIAL') THEN 1 ELSE 0 END) sensitive
                FROM readable t JOIN all_tab_columns c ON c.owner=t.owner AND c.table_name=t.table_name
                GROUP BY t.owner, t.table_name
            """)
            self._tables = {(r.owner, r.table_name) for r in inventory.itertuples()}
            self._sensitive_tables = {
                (r.owner, r.table_name) for r in inventory.itertuples() if r.sensitive
            }
        except Exception:
            self.close()
            raise

    def get_schemas(self) -> list[str]:
        frame = self._query(
            f"SELECT DISTINCT owner FROM ({_READABLE_TABLES}) ORDER BY owner",
            lowercase_columns=True,
        )
        return frame["owner"].tolist()

    def _metadata(self, sql: str) -> pd.DataFrame:
        return self._query(
            self._catalog_cte + sql, self._owners, timeout_s=120, lowercase_columns=True
        )

    @property
    def dialect(self) -> str:
        return "oracle"

    @property
    def database_name(self) -> str:
        return self._database_name

    def ping(self) -> None:
        self._query("SELECT 1 FROM dual")

    def _query(
        self,
        sql: str,
        parameters: list | None = None,
        timeout_s: float = 60,
        *,
        lowercase_columns: bool = False,
    ) -> pd.DataFrame:
        with self._pool.acquire() as connection:
            connection.call_timeout = max(1, int(timeout_s * 1000))
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")
                    cursor.execute(sql, parameters or [])
                    names = [
                        column.name.lower() if lowercase_columns else column.name
                        for column in cursor.description
                    ]
                    rows = cursor if lowercase_columns else cursor.fetchmany(10001)
                    if not lowercase_columns and len(rows) > 10000:
                        raise ValueError(
                            "Query exceeded the 10,000-row safety limit; add a filter or aggregation"
                        )
                    materialized = []
                    for row in rows:
                        values = []
                        for value in row:
                            if isinstance(value, oracledb.LOB):
                                if value.size() > 1_000_000:
                                    raise ValueError(
                                        "Oracle LOB exceeds the 1 MB result limit"
                                    )
                                value = value.read()
                            elif isinstance(value, oracledb.DbObject):
                                raise ValueError(
                                    "Oracle spatial/object values are not supported in query results"
                                )
                            values.append(value)
                        materialized.append(values)
                    return pd.DataFrame(materialized, columns=names)
            except oracledb.Error as exc:
                if "DPY-4024" in str(exc):
                    raise StatementTimeout(timeout_s) from exc
                raise
            finally:
                connection.rollback()
                connection.call_timeout = 0

    def _validate(self, sql: str) -> str:
        # Internal profiling currently emits LIMIT regardless of dialect.
        sql = re.sub(
            r"(?i)\s+LIMIT\s+(\d+)\s*;?\s*$", r" FETCH FIRST \1 ROWS ONLY", sql
        )
        statements = sqlglot.parse(sql, read="oracle")
        if len(statements) != 1 or not isinstance(statements[0], exp.Query):
            raise ValueError("Only a single SELECT query is allowed")
        tree = statements[0]
        if any(
            tree.find(kind)
            for kind in (exp.Insert, exp.Update, exp.Delete, exp.Command, exp.Lock)
        ):
            raise ValueError("Writes and locking queries are not allowed")
        if tree.find(exp.Anonymous):
            raise ValueError(
                "Unrecognized or user-defined SQL functions are not allowed"
            )
        if any(
            column.name.upper() in _SECRET_COLUMNS
            for column in tree.find_all(exp.Column)
        ):
            raise ValueError("Credential fields are excluded from this evaluation")

        def identifier(node: exp.Expression | None) -> str:
            if node is None:
                return ""
            return node.name if node.args.get("quoted") else node.name.upper()

        # Exempt only actual references to a CTE in the scope that defines it.
        cte_refs = {
            id(node)
            for scope in traverse_scope(tree)
            for node, source in scope.selected_sources.values()
            if isinstance(source, Scope) and isinstance(node, exp.Table) and not node.db
        }
        sensitive_table_used = False
        for table in tree.find_all(exp.Table):
            if id(table) in cte_refs:
                continue
            key = (
                identifier(table.args.get("db")) or self._schema,
                identifier(table.this),
            )
            if table.catalog or "@" in table.sql() or key not in self._tables:
                raise ValueError(
                    "Queries must use readable tables in the selected Oracle schemas"
                )
            sensitive_table_used |= key in self._sensitive_tables
        if sensitive_table_used and any(
            isinstance(projection, exp.Star)
            or (
                isinstance(projection, exp.Column)
                and isinstance(projection.this, exp.Star)
            )
            for select in tree.find_all(exp.Select)
            for projection in select.expressions
        ):
            raise ValueError(
                "SELECT * is not allowed on tables containing credential fields"
            )
        return sql

    def execute(
        self,
        sql: str,
        parameters: list | None = None,
        *,
        timeout_s: float | None = None,
        read_only: bool = False,
    ) -> pd.DataFrame:
        return self._query(self._validate(sql), parameters, timeout_s=timeout_s or 60)

    def profile_projection(self, columns: list[dict]) -> str:
        """Sample scalar columns only; keep LOB and spatial metadata in the catalog."""
        scalar = {"VARCHAR2", "NVARCHAR2", "NUMBER", "DATE", "CHAR"}
        return ", ".join(
            quoted_identifier(column["name"], self.dialect)
            for column in columns
            if column.get("name")
            and column["name"].upper() not in _SECRET_COLUMNS
            and (
                str(column.get("data_type", "")).upper() in scalar
                or str(column.get("data_type", "")).upper().startswith("TIMESTAMP")
            )
        )

    def get_tables(self) -> pd.DataFrame:
        frame = self._metadata("""
            SELECT t.owner AS table_schema, t.table_name, c.comments AS description
            FROM readable t LEFT JOIN all_tab_comments c ON c.owner=t.owner AND c.table_name=t.table_name
            ORDER BY t.owner, t.table_name
        """)
        frame["table_type"] = "base table"
        return frame

    def get_columns(self) -> pd.DataFrame:
        frame = self._metadata("""
            SELECT c.owner AS table_schema, c.table_name, c.column_name, c.data_type,
                   c.nullable AS is_nullable, c.column_id AS ordinal_position, cc.comments AS description
            FROM readable t JOIN all_tab_columns c ON c.owner=t.owner AND c.table_name=t.table_name
            LEFT JOIN all_col_comments cc ON cc.owner=c.owner AND cc.table_name=c.table_name AND cc.column_name=c.column_name
            ORDER BY c.owner,c.table_name,c.column_id
        """)
        frame["is_nullable"] = frame["is_nullable"].eq("Y")
        return frame

    def get_pks(self) -> pd.DataFrame:
        return self._metadata("""
            SELECT c.owner AS table_schema, c.table_name, cc.column_name, cc.position AS ordinal_position
            FROM readable t JOIN all_constraints c ON c.owner=t.owner AND c.table_name=t.table_name
            JOIN all_cons_columns cc ON cc.owner=c.owner AND cc.constraint_name=c.constraint_name
            WHERE c.constraint_type='P' ORDER BY c.owner,c.table_name,cc.position
        """)

    def get_fks(self) -> pd.DataFrame:
        return self._metadata("""
            SELECT c.owner AS table_schema,c.table_name,cc.column_name,r.owner AS referenced_schema,
                   r.table_name AS referenced_table,rc.column_name AS referenced_column
            FROM readable t JOIN all_constraints c ON c.owner=t.owner AND c.table_name=t.table_name
            JOIN all_cons_columns cc ON cc.owner=c.owner AND cc.constraint_name=c.constraint_name
            JOIN all_constraints r ON r.owner=c.r_owner AND r.constraint_name=c.r_constraint_name
            JOIN readable rt ON rt.owner=r.owner AND rt.table_name=r.table_name
            JOIN all_cons_columns rc ON rc.owner=r.owner AND rc.constraint_name=r.constraint_name AND rc.position=cc.position
            WHERE c.constraint_type='R' ORDER BY c.owner,c.table_name,c.constraint_name,cc.position
        """)

    def get_views(self) -> pd.DataFrame:
        return pd.DataFrame(columns=["table_schema", "table_name", "view_definition"])

    def get_queries(self, hours: int = 24) -> pd.DataFrame:
        return pd.DataFrame(columns=["end_time", "query_text"])

    def close(self) -> None:
        self._pool.close()
