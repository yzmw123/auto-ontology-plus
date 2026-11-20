# SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Resolve the databases used by ingestion and semantic compilation."""

from auto_ontology.connectors.registry import get_connectors


def resolve_database_names() -> list[str]:
    """Use the same catalog identities as ingestion and query routing."""
    return [connector.database_name for connector in get_connectors()]
