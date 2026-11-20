# SPDX-License-Identifier: Apache-2.0
"""Integration regression for the field model, using rollback-only metadata and a synthetic source."""

import os
import unittest
from unittest.mock import patch
from uuid import uuid4

import sqlglot
from fastapi import HTTPException

from auto_ontology.dal import field_model as fm, schema as s
from auto_ontology.dal.session import store, write_transaction
from auto_ontology.dal.terms import upsert_table_term
from auto_ontology.retrieval.text_to_sql.react.field_checks import check_field_rules
from auto_ontology.retrieval.text_to_sql.tests.react_fakes import SQLiteConnector
from auto_ontology.server.exploration import field_rules as api

QUESTION = "各大收费站作为出口站的收费总额是多少？"
SCRIPT = """
CREATE TABLE stations (network INT, code INT, title TEXT, scale TEXT, parent INT, PRIMARY KEY(network,code));
CREATE TABLE tolls (network INT, entry_key INT, exit_key INT, amount INT);
INSERT INTO stations VALUES (1,1,'甲','L',NULL),(1,2,'乙','S',1),(2,1,'丙','L',NULL);
INSERT INTO tolls VALUES (1,2,1,10),(1,2,1,15),(1,1,2,90),(2,1,1,7);
"""
QUERY = """SELECT s.title, SUM(f.amount) FROM main.tolls f JOIN main.stations s
ON f.network=s.network AND f.exit_key=s.code WHERE s.scale='L' GROUP BY s.title"""


def fixture():
    def add(table, **values):
        return store().query_write(
            table.insert().values(**values).returning(table.c.id)
        )[0]["id"]

    name = "field_test_" + uuid4().hex
    db = add(s.catalog_database, name=name)
    schema = add(s.catalog_schema, name="main", database_id=db)
    ids = {}
    for table, names, pk in [
        (
            "stations",
            ["network", "code", "title", "scale", "parent"],
            ["network", "code"],
        ),
        ("tolls", ["network", "entry_key", "exit_key", "amount"], []),
    ]:
        tid = add(
            s.catalog_table,
            schema_id=schema,
            name=table,
            pk=pk,
            description="收费站名录" if table == "stations" else "收费流水",
        )
        ids[table] = tid
        term = add(s.term, name=name + table, source="semantic", description=table)
        store().query_write(s.table__term.insert().values(table_id=tid, term_id=term))
        ids[table + "_term"] = term
        for n in names:
            ids[table + "." + n] = add(
                s.catalog_column,
                table_id=tid,
                name=n,
                data_type="TEXT" if n in ("title", "scale") else "INT",
            )
    return name, ids


def reference(ids, role, key):
    return api.Reference(
        name=role,
        source_table=ids["tolls"],
        target_table=ids["stations"],
        source_term=ids["tolls_term"],
        target_term=ids["stations_term"],
        pairs=[
            (ids["tolls.network"], ids["stations.network"]),
            (ids["tolls." + key], ids["stations.code"]),
        ],
    )


class RolledBack(Exception):
    pass


@unittest.skipUnless(
    os.environ.get("POSTGRES_USER"), "requires migrated ontology database"
)
class FieldModelTest(unittest.TestCase):
    def test_withdrawing_inference_removes_only_its_own_connection(self):
        tables = {
            "log": {"terms": ["log term"]},
            "station": {"terms": ["station term"]},
        }
        ref = dict(
            source_table="log",
            target_table="station",
            source_term=None,
            target_term=None,
            enabled=False,
        )
        paths = [
            dict(table_id="log", term_id="log term", path="REPRESENTS"),
            dict(table_id="log", term_id="station term", path="SEMANTIC_FK"),
        ]
        with patch(
            "auto_ontology.dal.terms.fetch_term_table_pairs", return_value=paths
        ):
            self.assertFalse(fm.neighbors((tables, [ref], []), True)["log term"])
            paths.append(
                dict(table_id="log", term_id="station term", path="HAS_ATTRIBUTE")
            )
            self.assertEqual(
                fm.neighbors((tables, [ref], []), True)["log term"], {"station term"}
            )

    def test_read_only_composite_key_probe(self):
        connector = SQLiteConnector(SCRIPT)
        connector.database_name = "fixture"
        with patch(
            "auto_ontology.connectors.registry.get_connectors", return_value=[connector]
        ):
            table = {
                "database": "fixture",
                "schema": "main",
                "name": "stations",
                "id": "fixture",
            }
            self.assertTrue(api.source_key_is_unique(table, ["network", "code"]))
            self.assertFalse(api.source_key_is_unique(table, ["code"]))

    def test_exit_station_before_after_and_withdrawal(self):
        with (
            self.assertRaises(RolledBack),
            write_transaction(),
            patch.object(api, "refresh_term_embeddings"),
            patch.object(api, "get_semantic_vdb"),
            patch.object(api, "source_key_is_unique", return_value=False),
        ):
            name, ids = fixture()

            def snapshot():
                return fm.effective_model(name)

            before = snapshot()
            seed = [ids["stations"]]
            self.assertEqual(
                fm.retrieval_evidence(before, seed, set(), QUESTION), ([], [])
            )
            outgoing = reference(ids, "出口站", "exit_key")
            with self.assertRaises(HTTPException):
                api.save_reference(
                    outgoing.model_copy(update={"pairs": outgoing.pairs[1:]})
                )
            key = api.save_reference(outgoing)["id"]
            api.save_reference(reference(ids, "入口站", "entry_key"))
            # A unique term name lets this transaction coexist with a production catalog.
            child_name = "大收费站" + name
            cid = api.set_classification(
                api.Classification(
                    name=child_name,
                    parent_id=ids["stations_term"],
                    table_id=ids["stations"],
                    conditions=[
                        api.Condition(column=ids["stations.scale"], values=["L"])
                    ],
                    display_columns=[ids["stations.title"]],
                ),
                caller="test",
            )["id"]
            question = QUESTION.replace("大收费站", child_name)
            model = snapshot()
            additions, notes = fm.retrieval_evidence(model, seed, set(), question)
            self.assertIn(ids["tolls"], additions)
            named_tables, _ = fm.retrieval_evidence(model, [], set(), "按出口站统计")
            self.assertEqual(set(named_tables), {ids["tolls"], ids["stations"]})
            self.assertTrue(any("exit_key" in n and "network" in n for n in notes))
            self.assertTrue(any("scale" in n and "'L'" in n for n in notes))

            def check(sql, q=question):
                return check_field_rules(sqlglot.parse_one(sql), model, q)

            self.assertEqual(check(QUERY), [])
            for bad in [
                QUERY.replace("exit_key", "entry_key"),
                QUERY.replace("f.network=s.network AND ", ""),
                QUERY.replace("WHERE s.scale='L'", ""),
            ]:
                self.assertTrue(check(bad))
            self.assertTrue(check(QUERY, "按收费站统计"))
            connector = SQLiteConnector(SCRIPT)
            self.assertEqual(
                dict(connector.execute(QUERY).itertuples(index=False, name=None)),
                {"甲": 25, "丙": 7},
            )
            graph = fm.project_graph(
                {
                    "nodes": [{"id": ids["stations_term"]}, {"id": ids["tolls_term"]}],
                    "links": [],
                },
                True,
                model,
            )
            self.assertEqual(len(graph["links"][0]["field_references"]), 2)
            self.assertEqual(len(api.impact(ids["stations_term"])["children"]), 1)
            with self.assertRaises(HTTPException):
                api.delete_term(ids["stations_term"])
            api.save_reference(
                outgoing.model_copy(update={"enabled": False, "version": 1}), key
            )
            self.assertFalse(
                any(
                    "exit_key" in n
                    for n in fm.retrieval_evidence(snapshot(), seed, set(), question)[1]
                )
            )
            self.assertTrue(
                check_field_rules(
                    sqlglot.parse_one(QUERY.replace("exit_key", "entry_key")),
                    snapshot(),
                    question,
                )
            )
            with self.assertRaises(HTTPException):
                api.save_reference(outgoing, key)
            # Distinct concepts can refer to the same row through the very same key.
            same_key = api.Reference(
                name="同站点",
                source_table=ids["stations"],
                target_table=ids["stations"],
                source_term=ids["stations_term"],
                target_term=cid,
                pairs=[
                    (ids["stations." + n], ids["stations." + n])
                    for n in ("network", "code")
                ],
            )
            same_id = api.save_reference(same_key)["id"]
            latest = snapshot()
            same_sql = "SELECT b.title FROM stations a JOIN stations b ON a.network=b.network AND a.code=b.code"
            self.assertTrue(
                check_field_rules(sqlglot.parse_one(same_sql), latest, "同站点")
            )
            self.assertFalse(
                check_field_rules(
                    sqlglot.parse_one(same_sql + " WHERE b.scale='L'"), latest, "同站点"
                )
            )
            api.remove_reference(same_id, 1)
            self.assertNotIn(same_id, [r["id"] for r in snapshot()[1]])
            api.delete_term(cid)
            self.assertFalse(snapshot()[2])
            api.delete_term(ids["stations_term"])
            self.assertIsNone(
                upsert_table_term(name + "stations", "again", ids["stations"])
            )
            self.assertIn(ids["stations"], snapshot()[0])
            raise RolledBack
