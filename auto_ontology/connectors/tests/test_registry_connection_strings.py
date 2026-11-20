# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from typing import Any
from urllib.parse import urlparse

import pytest

from auto_ontology.connectors import registry
from auto_ontology.dal import connections


def test_parse_connection_strings_accepts_commas_and_newlines() -> None:
    raw = """
        postgresql://localhost/first
        clickhouse://localhost/second,

        snowflake://account?database=third
    """

    assert registry.parse_connection_strings(raw) == [
        "postgresql://localhost/first",
        "clickhouse://localhost/second",
        "snowflake://account?database=third",
    ]


def test_loads_deployment_and_web_connections_together(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CONNECTION_STRINGS", "oracle://user:password@db/traffic")
    monkeypatch.setattr(registry, "_connectors", None)
    monkeypatch.setattr(
        connections,
        "list_connections",
        lambda: [
            {
                "type": "postgresql",
                "host": "db",
                "user": "app",
                "password": "password",
                "database": "new_source",
            },
        ],
    )

    class Connector:
        def __init__(self, name: str) -> None:
            self.database_name = name

    def create(url: str, **kwargs: Any) -> Connector:
        return Connector(urlparse(url).path.lstrip("/"))

    monkeypatch.setattr(registry, "create_connector", create)
    assert registry.environment_database_names() == ["traffic"]
    assert [conn.database_name for conn in registry.get_connectors()] == [
        "traffic",
        "new_source",
    ]
