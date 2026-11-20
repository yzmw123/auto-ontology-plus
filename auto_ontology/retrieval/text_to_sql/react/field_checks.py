# SPDX-License-Identifier: Apache-2.0
"""Check administrator mappings when both endpoints of a SQL join can be resolved."""

from itertools import combinations

from sqlglot import exp
from sqlglot.optimizer.scope import traverse_scope


def _conjuncts(node):
    if isinstance(node, exp.Paren):
        return _conjuncts(node.this)
    if isinstance(node, exp.And):
        return _conjuncts(node.left) + _conjuncts(node.right)
    return [node]


def check_field_rules(statement, model, question):
    from auto_ontology.dal.field_model import query_references

    tables, references, classes = model
    references = list(query_references(references))

    def key(schema, table):
        return ((schema or "").lower(), table.lower())

    keys = {tid: key(t["schema"], t["name"]) for tid, t in tables.items()}
    named = {}
    for tid, (_, name) in keys.items():
        named.setdefault(name, []).append(tid)

    def identify(table):
        candidates = named.get(table.name.lower(), [])
        if table.db:
            return next(
                (tid for tid in candidates if keys[tid][0] == table.db.lower()), None
            )
        return candidates[0] if len(candidates) == 1 else None

    classes_by_id = {c["term_id"]: c for c in classes}
    required = {}
    for c in classes:
        if c["name"].casefold() not in question.casefold():
            continue
        while c and c["term_id"] not in required:
            required[c["term_id"]] = c
            c = classes_by_id.get(c["parent_id"])
    satisfied = set()
    for scope in traverse_scope(statement):
        query = scope.expression
        if not isinstance(query, exp.Select):
            continue
        aliases = {
            alias.lower(): identify(table)
            for alias, table in scope.sources.items()
            if isinstance(table, exp.Table)
        }
        predicates = []
        if query.args.get("where"):
            predicates += _conjuncts(query.args["where"].this)
        for join in query.args.get("joins") or []:
            if join.args.get("on"):
                predicates += _conjuncts(join.args["on"])

        def owner(col):
            return (
                col.table.lower()
                if col.table
                else next(iter(aliases))
                if len(aliases) == 1
                else ""
            )

        values = {}
        equal = set()
        for p in predicates:
            if isinstance(p, exp.EQ):
                a, b = p.left, p.right
                if isinstance(b, exp.Column) and not isinstance(a, exp.Column):
                    a, b = b, a
                if isinstance(a, exp.Column) and isinstance(b, exp.Column):
                    equal.add(
                        frozenset(
                            ((owner(a), a.name.lower()), (owner(b), b.name.lower()))
                        )
                    )
                elif isinstance(a, exp.Column) and isinstance(b, exp.Literal):
                    values.setdefault((owner(a), a.name.lower()), []).append(
                        {str(b.this)}
                    )
            if (
                isinstance(p, exp.In)
                and isinstance(p.this, exp.Column)
                and all(isinstance(v, exp.Literal) for v in p.expressions)
            ):
                values.setdefault((owner(p.this), p.this.name.lower()), []).append(
                    {str(v.this) for v in p.expressions}
                )
        for alias, tid in aliases.items():
            for cid, c in required.items():
                if (
                    tid == c["table_id"]
                    and c["valid"]
                    and all(
                        set(p["values"]) in values.get((alias, p["field"].lower()), [])
                        for p in c["predicates"]
                    )
                ):
                    satisfied.add(cid)

        # Orient both directions against this pair of SQL aliases. A self-join may
        # use either orientation, and two aliases may serve different business roles.
        def classification_matches(term, alias):
            while term in classes_by_id:
                rule = classes_by_id[term]
                if not rule["valid"] or not all(
                    set(p["values"]) in values.get((alias, p["field"].lower()), [])
                    for p in rule["predicates"]
                ):
                    return False
                term = rule["parent_id"]
            return True

        for (left, a), (right, b) in combinations(aliases.items(), 2):
            if not a or not b:
                continue
            refs = [
                r
                for r in references
                if {r["source_table"], r["target_table"]} == {a, b}
            ]
            if not any(r["origin"] == "manual" for r in refs):
                continue
            if len(aliases) > 2 and not any(
                {c[0] for c in pair} == {left, right} for pair in equal
            ):
                continue
            enabled = [r for r in refs if r["enabled"]]
            wanted = [r for r in enabled if r["name"].casefold() in question.casefold()]
            if not wanted and any(
                not r["enabled"] and r["name"].casefold() in question.casefold()
                for r in refs
            ):
                return [
                    "The requested field reference is disabled. Ask for an active role."
                ]
            if len(enabled) > 1 and not wanted:
                return [
                    "Clarify which business role the question means: "
                    + ", ".join(r["name"] for r in enabled)
                ]

            def matches(ref):
                return any(
                    all(
                        frozenset(((src, x.lower()), (dst, y.lower()))) in equal
                        for x, y in ref["fields"]
                    )
                    and classification_matches(ref.get("source_term"), src)
                    and classification_matches(ref.get("target_term"), dst)
                    for src, dst in ((left, right), (right, left))
                    if aliases[src] == ref["source_table"]
                    and aliases[dst] == ref["target_table"]
                )

            if not any(matches(r) for r in (wanted or enabled)):
                return [
                    "Use the complete enabled field reference and its endpoint classification filters: "
                    + ", ".join(r["name"] for r in (wanted or enabled))
                ]
    missing = [c["name"] for cid, c in required.items() if cid not in satisfied]
    return (
        ["Use the classification filter for: " + ", ".join(missing)] if missing else []
    )
