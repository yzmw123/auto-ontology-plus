# SPDX-License-Identifier: Apache-2.0
"""Administration of queryable field references and term classifications."""

from __future__ import annotations

import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError

from auto_ontology.dal import field_model as model, schema as s
from auto_ontology.dal.session import store, write_transaction
from auto_ontology.server.identity import resolve_internal_user
from auto_ontology.server.users.postgres_dal import is_admin
from auto_ontology.server.terms.service import refresh_term_embeddings
from auto_ontology.vdb import get_semantic_vdb

router = APIRouter(prefix="/exploration/model")
logger = logging.getLogger(__name__)
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


def admin(request: Request):
    caller = resolve_internal_user(request, required=True)
    if not is_admin(caller):
        raise HTTPException(403, "Administrator access required")
    return caller


class Reference(BaseModel):
    name: Name
    source_table: str
    target_table: str
    source_term: str | None = None
    target_term: str | None = None
    pairs: list[tuple[str, str]] = Field(min_length=1, max_length=32)
    enabled: bool = True
    version: int = Field(default=0, ge=0)


class Condition(BaseModel):
    column: str
    values: list[Name] = Field(min_length=1, max_length=100)


class Classification(BaseModel):
    term_id: str | None = None
    parent_id: str | None = None
    name: Name
    table_id: str
    conditions: list[Condition] = Field(min_length=1, max_length=24)
    display_columns: list[str] = Field(default_factory=list, max_length=512)


def lock_edits():
    # Serializes role rename/replacement, parent cycle checks and impact/delete.
    store().query_write("SELECT pg_advisory_xact_lock(917745624)")


@router.get("")
def workspace():
    tables, refs, classes = model.effective_model()
    terms = model.read("SELECT id,name FROM term WHERE source='semantic' ORDER BY name")
    return dict(
        tables=list(tables.values()),
        terms=terms,
        references=refs,
        classifications=classes,
    )


@router.get("/tables/{table_id}/columns")
def field_columns(table_id: str):
    return {"data": model.columns([table_id])}


def source_key_is_unique(table, names):
    """Probe the whole proposed key, using only quoted catalog identifiers and a read-only query."""
    from sqlglot import exp
    from auto_ontology.connectors.registry import get_connectors
    from auto_ontology.semantic.visit_enter import execute_capped

    try:
        connector = next(
            (c for c in get_connectors() if c.database_name == table["database"]), None
        )
        if connector is None:
            return False
        target = exp.Table(
            this=exp.to_identifier(table["name"], quoted=True),
            db=exp.to_identifier(table["schema"], quoted=True),
        )
        cols = [exp.column(n, quoted=True) for n in names]
        query = exp.select(exp.Literal.number(1)).from_(target)
        for col in cols:
            query = query.where(exp.not_(col.copy().is_(exp.Null())))
        # Empty keys do not establish uniqueness. Stop at the second row in a duplicate group.
        observed = execute_capped(
            connector, query.copy().limit(1).sql(dialect=connector.dialect)
        )
        if observed is None or observed.empty:
            return False
        duplicates = (
            query.group_by(*cols)
            .having(
                exp.GT(
                    this=exp.Count(this=exp.Star()), expression=exp.Literal.number(1)
                )
            )
            .limit(1)
        )
        result = execute_capped(connector, duplicates.sql(dialect=connector.dialect))
        return result is not None and result.empty
    except Exception:
        logger.warning(
            "Unable to verify target key on table %s", table["id"], exc_info=True
        )
        return False


def save_reference(body, key=None):
    with write_transaction():
        lock_edits()
        tables, refs, _ = model.effective_model()
        old = next((r for r in refs if r["id"] == key), None)
        if key and not old:
            raise HTTPException(404, "Reference no longer exists")
        if old and old["version"] != body.version:
            raise HTTPException(409, "Reference changed. Reopen it before saving.")
        for tid, term in [
            (body.source_table, body.source_term),
            (body.target_table, body.target_term),
        ]:
            if tid not in tables or (term and term not in tables[tid]["terms"]):
                raise HTTPException(422, "Select a table represented by the term")
        if (
            tables[body.source_table]["database_id"]
            != tables[body.target_table]["database_id"]
        ):
            raise HTTPException(422, "Choose tables in the same database")
        validate = (
            body.enabled or not old or body.pairs != [tuple(p) for p in old["pairs"]]
        )
        if validate:
            cols = {
                c["id"]: c
                for c in model.columns([body.source_table, body.target_table])
            }
            left, right = zip(*body.pairs)
            if len(set(left)) != len(left) or len(set(right)) != len(right):
                raise HTTPException(422, "A key column can appear only once")
            for a, b in body.pairs:
                if (
                    a not in cols
                    or b not in cols
                    or cols[a]["table_id"] != body.source_table
                    or cols[b]["table_id"] != body.target_table
                ):
                    raise HTTPException(
                        422, "Select existing columns on the indicated tables"
                    )
                kind = model.type_group(cols[a]["data_type"])
                if not kind or kind != model.type_group(cols[b]["data_type"]):
                    raise HTTPException(422, "Column types are incompatible")
            distinct_concepts = (
                body.source_term
                and body.target_term
                and body.source_term != body.target_term
            )
            if (
                body.source_table == body.target_table
                and not distinct_concepts
                and all(a == b for a, b in body.pairs)
            ):
                raise HTTPException(422, "A self-reference must join different fields")
            physical = (
                old
                and old["origin"] == "physical"
                and old["enabled"]
                and list(body.pairs) == [tuple(p) for p in old["pairs"]]
            )
            if (
                body.enabled
                and not physical
                and not model.unique_key(
                    tables[body.target_table], [cols[c] for c in right]
                )
                and not source_key_is_unique(
                    tables[body.target_table], [cols[c]["name"] for c in right]
                )
            ):
                raise HTTPException(
                    422,
                    "Target columns must cover a primary key or a verified unique column",
                )
        values = body.model_dump(exclude={"version"})
        table = s.field_reference
        if old and old["origin"] == "manual":
            statement = (
                update(table)
                .where(table.c.id == key)
                .values(**values, version=body.version + 1)
            )
        else:
            statement = insert(table).values(**values, origin_key=key)
        try:
            saved = store().query_write(statement.returning(table.c.id))[0]
        except IntegrityError as exc:
            raise HTTPException(
                409, "A reference with this role already exists"
            ) from exc
        return saved


@router.post("/references", dependencies=[Depends(admin)])
def add_reference(body: Reference):
    return save_reference(body)


@router.put("/references/{key}", dependencies=[Depends(admin)])
def edit_reference(key: str, body: Reference):
    return save_reference(body, key)


@router.delete("/references/{key}", dependencies=[Depends(admin)])
def remove_reference(key: str, version: int):
    with write_transaction():
        lock_edits()
        table = s.field_reference
        row = store().query_read(select(table).where(table.c.id == key))
        if not row:
            raise HTTPException(404, "Reference no longer exists")
        if row[0]["version"] != version:
            raise HTTPException(409, "Reference changed. Reopen it before saving.")
        if row[0]["origin_key"]:
            # Keep an explicit suppression when removing a correction to an inferred role.
            store().query_write(
                update(table)
                .where(table.c.id == key)
                .values(enabled=False, version=version + 1)
            )
        else:
            store().query_write(delete(table).where(table.c.id == key))
    return {"id": key}


@router.post("/classifications")
def set_classification(body: Classification, caller: str = Depends(admin)):
    with write_transaction():
        lock_edits()
        table = model.catalog().get(body.table_id)
        if (
            not table
            or (body.term_id and body.term_id not in table["terms"])
            or (body.parent_id and body.parent_id not in table["terms"])
        ):
            raise HTTPException(
                422,
                "The classification and its parent must represent the selected table",
            )
        columns = {c["id"] for c in model.columns([body.table_id])}
        if (
            not set(body.display_columns).union(c.column for c in body.conditions)
            <= columns
        ):
            raise HTTPException(422, "Choose fields from the classification table")
        classifications = model.read(
            "SELECT term_id,parent_id,table_id FROM term_classification"
        )
        if any(
            row["table_id"] != body.table_id
            and (
                row["term_id"] == body.parent_id
                or (body.term_id and row["parent_id"] == body.term_id)
            )
            for row in classifications
        ):
            raise HTTPException(
                422,
                "The classification and its parent must represent the selected table",
            )
        ancestors = {row["term_id"]: row["parent_id"] for row in classifications}
        parent = body.parent_id
        while parent:
            if parent == body.term_id:
                raise HTTPException(422, "A classification cannot be its own ancestor")
            parent = ancestors.get(parent)
        tid = body.term_id
        if not tid:
            if not body.parent_id:
                raise HTTPException(422, "Choose a parent term")
            try:
                tid = store().query_write(
                    insert(s.term)
                    .values(
                        name=body.name,
                        source="semantic",
                        modified_by=caller,
                        description=body.name,
                        synonyms=[],
                    )
                    .returning(s.term.c.id)
                )[0]["id"]
            except IntegrityError as exc:
                raise HTTPException(
                    409, "A term with this name already exists"
                ) from exc
            store().query_write(
                insert(s.table__term).values(term_id=tid, table_id=body.table_id)
            )
        store().query_write(
            delete(s.term_classification).where(s.term_classification.c.term_id == tid)
        )
        store().query_write(
            insert(s.term_classification).values(
                term_id=tid,
                parent_id=body.parent_id,
                table_id=body.table_id,
                conditions=[c.model_dump() for c in body.conditions],
                display_columns=list(dict.fromkeys(body.display_columns)),
            )
        )
    try:
        refresh_term_embeddings(tid, refresh_dependent_attrs=False)
    except Exception:
        logger.warning(
            "Classification embedding refresh deferred for %s", tid, exc_info=True
        )
    return {"id": tid}


def impact(term_id):
    terms = model.read(
        "SELECT id,name FROM term WHERE id=:id AND source='semantic'", id=term_id
    )
    if not terms:
        raise HTTPException(404, "Term no longer exists")
    children = model.read(
        "SELECT t.name FROM term_classification c JOIN term t ON t.id=c.term_id WHERE c.parent_id=:id",
        id=term_id,
    )
    tables, refs, classes = model.effective_model()
    names = [
        r["name"]
        for r in refs
        if any(
            r[side + "_term"] == term_id
            or (
                r[side + "_term"] is None
                and term_id in tables[r[side + "_table"]]["terms"]
            )
            for side in ("source", "target")
        )
    ]
    return dict(
        name=terms[0]["name"],
        references=names,
        children=[c["name"] for c in children],
        classified=any(c["term_id"] == term_id for c in classes),
    )


@router.get("/terms/{term_id}/impact", dependencies=[Depends(admin)])
def deletion_impact(term_id: str):
    return impact(term_id)


@router.delete("/terms/{term_id}", dependencies=[Depends(admin)])
def delete_term(term_id: str):
    with write_transaction():
        lock_edits()
        info = impact(term_id)
        if info["children"]:
            raise HTTPException(409, "Move or remove child classifications first")
        ids = [
            r["table_id"]
            for r in model.read(
                "SELECT table_id FROM table__term WHERE term_id=:id", id=term_id
            )
        ]
        store().query_write(
            insert(s.retired_term).values(
                term_id=term_id, name=info["name"], table_ids=ids
            )
        )
        store().query_write(delete(s.term).where(s.term.c.id == term_id))
    try:
        get_semantic_vdb().delete_by_id(term_id)
    except Exception:
        logger.warning(
            "Retired term embedding cleanup deferred for %s", term_id, exc_info=True
        )
    return {"id": term_id}
