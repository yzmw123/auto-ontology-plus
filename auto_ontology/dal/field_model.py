# SPDX-License-Identifier: Apache-2.0
"""The field references and classifications shared by Exploration and SQL retrieval."""

from __future__ import annotations

from itertools import product
import re


from auto_ontology.dal.session import store


def read(sql, **params):
    return store().query_read(sql, params)


def catalog(database_name=None):
    tables = read(
        """
        SELECT t.id,t.name,t.pk,t.table_type,h.id AS schema_id,d.name AS database, d.id database_id,h.name AS schema
        FROM catalog_table t JOIN catalog_schema h ON t.schema_id=h.id
        JOIN catalog_database d ON h.database_id=d.id
        WHERE (CAST(:db AS text) IS NULL OR d.name=:db) ORDER BY d.name,h.name,t.name
    """,
        db=database_name,
    )
    by_id = {t["id"]: dict(t, terms=[]) for t in tables}
    for row in read(
        """SELECT l.term_id,l.table_id FROM table__term l JOIN term t ON t.id=l.term_id
                        WHERE t.source='semantic' AND l.table_id=ANY(:ids)""",
        ids=list(by_id),
    ):
        by_id[row["table_id"]]["terms"].append(row["term_id"])
    return by_id


def columns(table_ids):
    return read(
        """SELECT id,table_id,name,data_type,is_unique,distinct_ratio
                   FROM catalog_column WHERE table_id=ANY(:ids)
                   ORDER BY table_id,ordinal_position,name""",
        ids=list(table_ids),
    )


def type_group(raw):
    value = re.split(r"[\s(]", (raw or "").upper())[0]
    if re.fullmatch(
        r"(?:U?INT(?:EGER|[1248]|16|32|64)?|BIGINT|SMALLINT|TINYINT|NUMBER|NUMERIC|DECIMAL|FLOAT[48]?|DOUBLE|REAL|BINARY_FLOAT|BINARY_DOUBLE)",
        value,
    ):
        return "number"
    if re.fullmatch(
        r"(?:N?(?:VAR)?CHAR2?|VARCHAR|CHARACTER|STRING|TEXT|NVARCHAR2?)", value
    ):
        return "text"
    return value


def unique_key(table, targets):
    names = {c["name"] for c in targets}
    pk = set(table.get("pk") or [])
    return bool(pk and pk <= names) or any(
        c["is_unique"] and c["distinct_ratio"] in (None, 1.0) for c in targets
    )


def effective_model(database_name=None):
    """Resolve persisted field IDs to current names. Removed columns invalidate the whole key."""
    tables = catalog(database_name)
    ids = list(tables)
    rows = read(
        """
        SELECT f.source_column_id AS a,f.target_column_id AS b,'physical' AS origin,true AS enabled
        FROM column__foreign_key f JOIN catalog_column c ON c.id=f.source_column_id
        WHERE c.table_id=ANY(:ids)
        UNION ALL
        SELECT f.column_id,h.column_id,'semantic',f.use_in_join_paths
        FROM column__semantic_fk f JOIN column__has_attribute h USING(attribute_id)
        JOIN catalog_column c ON c.id=f.column_id WHERE c.table_id=ANY(:ids)
        """,
        ids=ids,
    )
    manual = read(
        "SELECT * FROM field_reference WHERE source_table=ANY(:ids) ORDER BY name,id",
        ids=ids,
    )
    classes = read(
        """SELECT c.*,t.name FROM term_classification c JOIN term t ON t.id=c.term_id
                      WHERE c.table_id=ANY(:ids) ORDER BY t.name""",
        ids=ids,
    )
    needed = {v for row in rows for v in (row["a"], row["b"])}
    for row in manual:
        needed.update(v for pair in row["pairs"] for v in pair)
    for item in classes:
        needed.update(condition["column"] for condition in item["conditions"])
        needed.update(item["display_columns"])
    found = read(
        """SELECT id,name,table_id,is_unique,distinct_ratio FROM catalog_column WHERE id=ANY(:ids)""",
        ids=list(needed),
    )
    cols = {c["id"]: c for c in found}
    automatic = {}
    for row in rows:
        a, b = cols.get(row["a"]), cols.get(row["b"])
        if not a or not b or a["id"] == b["id"] or b["table_id"] not in tables:
            continue
        if tables[a["table_id"]]["database_id"] != tables[b["table_id"]]["database_id"]:
            continue
        key = f"auto:{a['id']}:{b['id']}"
        enabled = row["enabled"] and unique_key(tables[b["table_id"]], [b])
        # The catalog does not group composite FK columns by constraint. A partial key
        # remains visible for repair; never advertise that one part is a complete join.
        if row["origin"] == "physical" and len(tables[b["table_id"]]["pk"] or []) < 2:
            enabled = True
        if key in automatic and automatic[key]["origin"] == "physical":
            continue
        automatic[key] = dict(
            id=key,
            origin_key=key,
            origin=row["origin"],
            name=f"{a['name']} → {b['name']}",
            source_table=a["table_id"],
            target_table=b["table_id"],
            source_term=None,
            target_term=None,
            pairs=[[a["id"], b["id"]]],
            enabled=enabled,
            version=0,
        )
    for row in manual:
        if row["origin_key"]:
            original = automatic.pop(row["origin_key"], None)
            if original and original["pairs"] != row["pairs"]:
                a, b = cols[original["pairs"][0][0]], cols[original["pairs"][0][1]]
                row["replaced"] = dict(
                    original,
                    enabled=False,
                    origin="manual",
                    fields=[[a["name"], b["name"]]],
                    source_path=[
                        tables[a["table_id"]][k] for k in ("database", "schema", "name")
                    ],
                    target_path=[
                        tables[b["table_id"]][k] for k in ("database", "schema", "name")
                    ],
                )
    refs = []
    for row in [*automatic.values(), *manual]:
        left, right = tables.get(row["source_table"]), tables.get(row["target_table"])
        if not left or not right or left["database_id"] != right["database_id"]:
            continue
        fields = []
        for a, b in row["pairs"]:
            ca, cb = cols.get(a), cols.get(b)
            if (
                not ca
                or not cb
                or ca["table_id"] != left["id"]
                or cb["table_id"] != right["id"]
            ):
                break
            fields.append([ca["name"], cb["name"]])
        valid = len(fields) == len(row["pairs"]) and bool(fields)
        refs.append(
            dict(
                row,
                origin=row.get("origin", "manual"),
                enabled=bool(valid and row["enabled"]),
                valid=valid,
                fields=fields,
                source_path=[left["database"], left["schema"], left["name"]],
                target_path=[right["database"], right["schema"], right["name"]],
            )
        )
    for item in classes:
        item["display_names"] = [
            cols[key]["name"] for key in item["display_columns"] if key in cols
        ]
        item["valid"] = all(c["column"] in cols for c in item["conditions"])
        item["predicates"] = [
            dict(c, field=cols[c["column"]]["name"])
            for c in item["conditions"]
            if c["column"] in cols
        ]
    return tables, refs, classes


def reference_ends(ref, tables, semantic):
    def ends(side):
        table = ref[side + "_table"]
        owner = ref[side + "_term"]
        if not semantic:
            return [table]
        return [owner] if owner else tables[table]["terms"]

    return [
        (a, b)
        for a, b in product(ends("source"), ends("target"))
        if a != b
        or not semantic
        or ref["source_term"] == a
        or ref["source_table"] == ref["target_table"]
    ]


def neighbors(model, semantic):
    from auto_ontology.dal.terms import fetch_term_table_pairs
    from collections import defaultdict

    tables, refs, _ = model
    groups = defaultdict(set)
    if semantic:
        # Legacy term adjacency traverses inferred foreign keys as well as shared
        # tables. Remove withdrawn paths while retaining independent active roles.
        inactive, active = set(), set()
        for ref in query_references(refs):
            owners = (
                [ref["target_term"]]
                if ref["target_term"]
                else tables[ref["target_table"]]["terms"]
            )
            paths = active if ref["enabled"] else inactive
            paths.update((ref["source_table"], owner) for owner in owners)
        withdrawn = inactive - active
        for row in fetch_term_table_pairs(table_ids=list(tables)) if tables else []:
            if (
                row["path"] == "SEMANTIC_FK"
                and (row["table_id"], row["term_id"]) in withdrawn
            ):
                continue
            groups[row["table_id"]].add(row["term_id"])
    else:
        for row in read(
            """SELECT l.sql_query_id,l.table_id FROM sql_query__table l
                      JOIN sql_query q ON q.id=l.sql_query_id WHERE l.table_id=ANY(:ids)
                      AND trim(coalesce(q.sql_full_query,''))<>''""",
            ids=list(tables),
        ):
            groups[row["sql_query_id"]].add(row["table_id"])
    result = defaultdict(set)
    for group in groups.values():
        for node in group:
            result[node].update(group - {node})
    for ref in refs:
        if ref["enabled"]:
            for a, b in reference_ends(ref, tables, semantic):
                if a != b:
                    result[a].add(b)
                    result[b].add(a)
    return result


def related_nodes(node_id, semantic, skip, limit):
    model = effective_model()
    adjacent = neighbors(model, semantic)
    ids = adjacent[node_id]
    if semantic:
        rows = read(
            "SELECT id,name FROM term WHERE id=ANY(:ids) ORDER BY lower(name),id",
            ids=list(ids),
        )
    else:
        rows = sorted(
            (model[0][tid] for tid in ids), key=lambda r: (r["name"].lower(), r["id"])
        )
    return {
        "total": len(rows),
        "nodes": [
            dict(r, relationship_count=len(adjacent[r["id"]]))
            for r in rows[skip : None if limit is None else skip + limit]
        ],
    }


def project_graph(graph, semantic, model):
    """Overlay actual roles onto the existing shared-table/shared-query graph."""
    tables, refs, classes = model
    nodes = {node["id"]: node for node in graph["nodes"]}
    links = {tuple(sorted((e["source"], e["target"]))): e for e in graph["links"]}
    prior_fields = {
        (
            link["source"],
            link["target"],
            pair["source_column"],
            pair["target_column"],
        ): pair
        for link in links.values()
        for pair in link.get("foreign_keys", [])
    }
    if not semantic:
        # Rebuild FK evidence from the effective model so disabling the last role removes it.
        for key, link in list(links.items()):
            if link.get("via_foreign_key") and not link.get("queries"):
                del links[key]
            else:
                link["via_foreign_key"] = False
                link["foreign_keys"] = []
                link["relationship_types"] = [
                    k for k in link.get("relationship_types", []) if k != "FOREIGN_KEY"
                ]
    for ref in refs:
        if not ref["enabled"]:
            continue
        for a, b in reference_ends(ref, tables, semantic):
            if a not in nodes or b not in nodes:
                continue
            key = tuple(sorted((a, b)))
            link = links.setdefault(
                key, dict(source=key[0], target=key[1], relationship_types=[])
            )
            values = link.setdefault("field_references", [])
            if ref["id"] not in values:
                values.append(ref["id"])
            if not semantic:
                link["via_foreign_key"] = True
                link.setdefault("queries", [])
                kind = "FOREIGN_KEY" if ref["origin"] == "physical" else "SEMANTIC_FK"
                if kind not in link["relationship_types"]:
                    link["relationship_types"].append(kind)
                for source_name, target_name in ref["fields"]:
                    if link["source"] != ref["source_table"]:
                        source_name, target_name = target_name, source_name
                    evidence = prior_fields.get(
                        (link["source"], link["target"], source_name, target_name)
                    )
                    if evidence is None:
                        reverse = prior_fields.get(
                            (link["target"], link["source"], target_name, source_name),
                            {},
                        )
                        evidence = dict(
                            source_column=source_name,
                            target_column=target_name,
                            source_sample_values=reverse.get("target_sample_values"),
                            target_sample_values=reverse.get("source_sample_values"),
                        )
                    if evidence not in link.setdefault("foreign_keys", []):
                        link["foreign_keys"].append(evidence)
    for item in classes:
        if semantic and item["term_id"] in nodes:
            nodes[item["term_id"]]["classification"] = " AND ".join(
                p["field"] + " ∈ " + ", ".join(p["values"]) for p in item["predicates"]
            )
    adjacency = neighbors(model, semantic)
    for node in nodes.values():
        node["relationship_count"] = len(adjacency[node["id"]])
    graph["links"] = [
        link
        for link in links.values()
        if not semantic
        or link.get("field_references")
        or link["target"] in adjacency[link["source"]]
    ]
    return graph


def query_references(references):
    for reference in references:
        yield reference
        if reference.get("replaced"):
            yield reference["replaced"]


def superseded_hop(model, hop):
    """A graph path assembled from legacy edges must respect an explicit override."""
    _, references, _ = model
    endpoint = frozenset(
        (hop.get(side + "_schema"), hop.get(side + "_table"))
        for side in ("source", "target")
    )
    return any(
        (r["origin"] == "manual" or not r["enabled"])
        and frozenset(tuple(r[side + "_path"][1:]) for side in ("source", "target"))
        == endpoint
        for r in query_references(references)
    )


def retrieval_evidence(model, seed_ids, term_ids, question):
    tables, refs, classes = model
    seeds = set(seed_ids)
    matched = {
        c["term_id"]
        for c in classes
        if c["name"].casefold() in question.casefold() or c["term_id"] in term_ids
    }
    by_term = {c["term_id"]: c for c in classes}
    selected = set(matched)
    for term in matched:
        parent = by_term[term]["parent_id"]
        while parent in by_term and parent not in selected:
            selected.add(parent)
            parent = by_term[parent]["parent_id"]
    additions, notes = [], []
    seeds.update(by_term[term]["table_id"] for term in selected)
    # Only one-hop expansion from the original hits. Named business roles rank ahead of incidental neighbours.
    roles = [
        r
        for r in refs
        if seeds.intersection((r["source_table"], r["target_table"]))
        or (r["origin"] == "manual" and r["name"].casefold() in question.casefold())
    ]
    for role in roles:
        if not role["enabled"] and role["name"].casefold() in question.casefold():
            notes.append(
                f"DISABLED FIELD REFERENCE {role['name']}: ask for an active role."
            )
    roles.sort(
        key=lambda r: (
            r["name"].casefold() not in question.casefold(),
            r["origin"] != "manual",
            r["name"],
        )
    )
    roles = [role for role in roles if role["enabled"]][:12]
    for role in roles:
        for side in ("source_term", "target_term"):
            term = role[side]
            while term in by_term and term not in selected:
                selected.add(term)
                term = by_term[term]["parent_id"]
    for c in classes:
        if c["term_id"] not in selected:
            continue
        table = tables[c["table_id"]]
        seeds.add(table["id"])
        additions.append(table["id"])
        predicates = " AND ".join(
            f"{p['field']} IN {p['values']!r}" for p in c["predicates"]
        )
        notes.append(
            f"CLASS {c['name']} on {table['schema']}.{table['name']}: "
            + (
                predicates
                if c["valid"]
                else "invalid classification; ask for correction before querying"
            )
            + (
                f"; display fields: {c['display_names']}"
                if c.get("display_names")
                else ""
            )
        )
    for r in roles:
        a, b = r["source_table"], r["target_table"]
        left, right = ".".join(r["source_path"][1:]), ".".join(r["target_path"][1:])
        condition = " AND ".join(f"src.{x} = dst.{y}" for x, y in r["fields"])
        notes.append(
            f"FIELD REFERENCE {r['name']}: {left} AS src → {right} AS dst ON {condition}"
            + "".join(
                f"; {alias} CLASS {by_term[r[side]]['name']}"
                for alias, side in (("src", "source_term"), ("dst", "target_term"))
                if r[side] in by_term
            )
        )
        additions.extend((a, b))
    return list(dict.fromkeys(additions)), notes
