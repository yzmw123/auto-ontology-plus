# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Run and track administrator-requested catalog scans."""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from auto_ontology.dal.reset import delete_all_data
from auto_ontology.ingestion_service.config import is_semantic_compilation_enabled
from auto_ontology.ingestion_service.ingest import ingest_connection
from auto_ontology.ingestion_service.rules import replay_rules_in_thread
from auto_ontology.ingestion_service.semantic_scheduler import SemanticScheduler

logger = logging.getLogger(__name__)
ScanStatus = Literal[
    "queued",
    "scanning",
    "compiling",
    "scanned",
    "ready",
    "scan_failed",
    "compile_failed",
]


class ConnectionJobs:
    def __init__(self, scheduler: SemanticScheduler, work_lock: asyncio.Lock) -> None:
        self._scheduler = scheduler
        self._work_lock = work_lock
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._status: dict[str, ScanStatus] = {}

    def status(self) -> dict[str, ScanStatus]:
        return dict(self._status)

    def start(self, database_name: str, *, compile_ontology: bool) -> None:
        previous = self._tasks.get(database_name)
        self._status[database_name] = "queued"
        self._tasks[database_name] = asyncio.create_task(
            self._run(database_name, compile_ontology, previous)
        )

    async def _run(
        self,
        database_name: str,
        compile_ontology: bool,
        previous: asyncio.Task[None] | None,
    ) -> None:
        if previous is not None:
            await previous
        async with self._work_lock:
            self._status[database_name] = "scanning"
            failure_status: ScanStatus = "scan_failed"
            try:
                await asyncio.to_thread(ingest_connection, database_name)
                if compile_ontology or await asyncio.to_thread(
                    is_semantic_compilation_enabled
                ):
                    self._status[database_name] = "compiling"
                    failure_status = "compile_failed"
                    await self._scheduler.compile_connection(database_name)
                    self._status[database_name] = "ready"
                else:
                    await replay_rules_in_thread("ingest")
                    self._status[database_name] = "scanned"
            except Exception:
                self._status[database_name] = failure_status
                logger.exception("Connection scan/build failed for %s", database_name)

    async def delete(self, database_name: str) -> None:
        previous = self._tasks.get(database_name)
        if previous is not None:
            await previous
        async with self._work_lock:
            await asyncio.to_thread(delete_all_data, database_name)
            self._status.pop(database_name, None)
            self._tasks.pop(database_name, None)

    async def wait(self) -> None:
        await asyncio.gather(*self._tasks.values())
