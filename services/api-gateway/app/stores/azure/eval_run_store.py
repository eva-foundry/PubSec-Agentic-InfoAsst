"""Cosmos DB-backed adversarial-evaluation run store.

Runs are ephemeral (runs are replayed from their seed on demand) but we
persist the metadata so `/ops/eval/results` survives pod restarts and
scale events.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Iterator

from ..eval_run_store import (
    _CATEGORY_BASELINES,
    PROBES_PER_CATEGORY,
    EvalRunRecord,
    replay_events,
)
from .cosmos_client import CosmosClientManager

CONTAINER = "eval-runs"


class CosmosEvalRunStore:
    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def create(
        self,
        test_set_id: str,
        categories: list[str],
        workspace_id: str,
    ) -> EvalRunRecord:
        valid = [c for c in categories if c in _CATEGORY_BASELINES]
        if not valid:
            raise ValueError("No valid attack categories selected")
        run_id = f"run-{uuid.uuid4().hex[:10]}"
        seed_input = (
            f"{run_id}|{test_set_id}|{workspace_id}|{','.join(valid)}".encode()
        )
        seed = int(hashlib.sha256(seed_input).hexdigest()[:16], 16)
        record = EvalRunRecord(
            run_id=run_id,
            test_set_id=test_set_id,
            categories=valid,
            workspace_id=workspace_id,
            seed=seed,
            total=len(valid) * PROBES_PER_CATEGORY,
        )
        await self._cosmos.upsert(CONTAINER, _record_to_dict(record))
        return record

    async def get(self, run_id: str) -> EvalRunRecord | None:
        item = await self._cosmos.read(CONTAINER, run_id, partition_key=run_id)
        if item is None:
            return None
        return _dict_to_record(self._strip(item))

    def events(self, record: EvalRunRecord) -> Iterator[dict]:
        """Generator — uses the shared replay logic."""
        return replay_events(record)

    @staticmethod
    def _strip(item: dict) -> dict:
        return {k: v for k, v in item.items() if not k.startswith("_")}


def _record_to_dict(r: EvalRunRecord) -> dict:
    return {
        "id": r.run_id,  # Cosmos requires an `id` property
        "run_id": r.run_id,
        "test_set_id": r.test_set_id,
        "categories": r.categories,
        "workspace_id": r.workspace_id,
        "seed": r.seed,
        "total": r.total,
        "status": r.status,
    }


def _dict_to_record(d: dict) -> EvalRunRecord:
    rec = EvalRunRecord(
        run_id=d["run_id"],
        test_set_id=d["test_set_id"],
        categories=list(d["categories"]),
        workspace_id=d["workspace_id"],
        seed=int(d["seed"]),
        total=int(d["total"]),
    )
    rec.status = d.get("status", "queued")
    return rec
