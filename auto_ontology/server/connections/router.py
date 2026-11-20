# SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""API routes for UI-managed database connections."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from auto_ontology.connectors.registry import (
    environment_connection_strings,
    environment_database_names,
)
from auto_ontology.dal.connections import list_connections as _list_connections
from auto_ontology.server.connections import service
from auto_ontology.server.ingestion.proxy import connection_scan_status, trigger_ingest
from auto_ontology.server.responses import (
    ConnectionListResponse,
    ConnectionResponse,
    ConnectionTestResponse,
    SsoFederationResponse,
    StatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionBody(BaseModel):
    connection: dict[str, Any]


class ConnectionTestBody(ConnectionBody):
    replacing: str | None = None


class ConnectionCreateBody(ConnectionBody):
    compile_ontology: bool = False


class ConnectionScanBody(BaseModel):
    database: str


class PublicConnection(TypedDict):
    database_name: str
    connection: dict[str, Any]


def _serialize_connection(connection: dict[str, Any]) -> PublicConnection:
    """Shape a connection object into a credential-free public payload."""
    public_connection = {
        key: value
        for key, value in connection.items()
        if key not in service.SECRET_FIELDS
    }
    return {
        "database_name": str(connection.get("database") or ""),
        "connection": public_connection,
    }


@router.get("/connections/source", response_model=bool)
def is_env_source() -> bool:
    """Report whether connections are managed via the ``CONNECTION_STRINGS`` env."""
    return bool(environment_connection_strings())


@router.get("/connections/scan")
def scan_status() -> dict[str, list[str] | dict[str, str]]:
    """Report connection scan progress and deployment-managed database names."""
    try:
        return {
            "jobs": connection_scan_status(),
            "environment": environment_database_names(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="Ingestion service unavailable"
        ) from exc


@router.post("/connections/scan", status_code=202, response_model=StatusResponse)
def scan_connection(body: ConnectionScanBody) -> dict[str, str]:
    """Scan and build one configured source without resetting its ontology."""
    name = body.database.strip()
    if name not in environment_database_names() and not any(
        connection.get("database") == name for connection in _list_connections()
    ):
        raise HTTPException(status_code=404, detail="Connection not found")
    if not trigger_ingest({"database": name}, compile_ontology=True):
        raise HTTPException(status_code=503, detail="Ingestion service unavailable")
    return {"status": "accepted"}


@router.get("/connections", response_model=ConnectionListResponse)
def list_connections() -> dict:
    """List every configured database connection, credential-free.

    Credentials — passwords, private keys and the Kyuubi truststore password —
    are stripped from each connection object, so the payload is safe to render
    in the UI. ``database_name`` doubles as the connection's identity in the
    other routes here.
    """
    rows = [_serialize_connection(conn) for conn in _list_connections()]
    return {"data": rows, "count": len(rows)}


@router.post("/connections/test", response_model=ConnectionTestResponse)
def test_connection(body: ConnectionTestBody) -> dict:
    """Validate a connection and return its schemas (for the schema picker).

    Set ``replacing`` to the ``database_name`` of the connection an edit is
    about to overwrite. Without it the test rejects the connection for already
    existing, and blank credentials stay blank instead of being taken from the
    stored connection the way ``PUT /connections/{database_name}`` would.
    """
    try:
        schemas = service.test_connection(body.connection, replacing=body.replacing)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Connection test failed: {exc}",
        ) from exc
    return {"success": True, "schemas": schemas}


@router.post("/connections", status_code=201, response_model=ConnectionResponse)
def create_connection(body: ConnectionCreateBody) -> dict:
    """Register a database connection and return it credential-free.

    The connection is validated on the way in; anything the driver rejects comes
    back as 422 with the failure message rather than a 500. Call
    ``POST /connections/test`` first to check credentials and list the schemas
    available for the picker.
    """
    try:
        row = service.create_connection(
            connection=body.connection, compile_ontology=body.compile_ontology
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to create connection: {exc}",
        ) from exc

    return {"data": _serialize_connection(row)}


@router.put("/connections/{database_name}", response_model=ConnectionResponse)
def update_connection(
    body: ConnectionBody,
    database_name: str = Path(
        description=(
            "Catalog database name, which doubles as the connection's identity."
        )
    ),
) -> dict:
    """Rewrite a connection's settings and return it credential-free.

    ``database`` and ``type`` are the connection's identity and cannot change —
    sending different ones is a 422. Credentials left blank keep their stored
    value, since the UI is never given them to send back. Re-ingest is
    triggered only when the ``schemas`` allowlist changed.

    404 when no connection carries that ``database_name``.
    """
    try:
        row = service.update_connection(
            database_name=database_name, connection=body.connection
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to update connection: {exc}",
        ) from exc

    return {"data": _serialize_connection(row)}


class SsoFederationBody(BaseModel):
    enabled: bool


@router.patch(
    "/connections/{database_name}/sso-federation",
    response_model=SsoFederationResponse,
)
def set_sso_federation(
    body: SsoFederationBody,
    database_name: str = Path(
        description=(
            "Catalog database name, which doubles as the connection's identity."
        )
    ),
) -> dict:
    """Toggle whether chat runs this connection's SQL as the signed-in user."""
    try:
        row = service.set_sso_federation(
            database_name=database_name, enabled=body.enabled
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to update connection: {exc}",
        ) from exc

    return {"data": row}


@router.delete("/connections/{database_name}", response_model=ConnectionResponse)
def delete_connection(
    database_name: str = Path(
        description=(
            "Catalog database name, which doubles as the connection's identity."
        )
    ),
) -> dict:
    """Remove a connection, echoing the database name it tore down.

    404 when no connection carries that ``database_name``. The connection
    record is removed synchronously, but deleting the data already ingested
    from it is handed to the ingestion service and is best-effort — a 200 means
    the connection is gone, not that its graph is.
    """
    try:
        row = service.delete_connection(database_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to delete connection: {exc}",
        ) from exc

    if row is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    return {"data": row}
