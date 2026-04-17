"""Cosmos DB-backed chat history store."""

from __future__ import annotations

from collections import defaultdict

from ..chat_store import ChatHistoryRecord, ConversationSummary
from .cosmos_client import CosmosClientManager

CONTAINER = "chat-history"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosChatStore:
    """Chat history store backed by Cosmos DB (statusdb/chat-history)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    # -- Writes --

    async def add(self, record: ChatHistoryRecord) -> None:
        data = record.model_dump()
        # Cosmos needs a unique id — use message_id
        data["id"] = data["message_id"]
        await self._cosmos.upsert(CONTAINER, data)

    # -- Reads --

    async def list_conversations(
        self,
        workspace_id: str | None = None,
        user_id: str | None = None,
    ) -> list[ConversationSummary]:
        conditions = []
        params = []
        if workspace_id is not None:
            conditions.append("c.workspace_id = @ws")
            params.append({"name": "@ws", "value": workspace_id})
        if user_id is not None:
            conditions.append("c.user_id = @uid")
            params.append({"name": "@uid", "value": user_id})

        where = " AND ".join(conditions)
        q = f"SELECT * FROM c WHERE {where}" if where else "SELECT * FROM c"

        items = await self._cosmos.query(CONTAINER, q, parameters=params or None)
        records = [ChatHistoryRecord(**_strip(i)) for i in items]

        # Group by conversation_id
        convos: dict[str, list[ChatHistoryRecord]] = defaultdict(list)
        for r in records:
            convos[r.conversation_id].append(r)

        summaries: list[ConversationSummary] = []
        for cid, msgs in convos.items():
            msgs_sorted = sorted(msgs, key=lambda m: m.created_at)
            first_user = next((m for m in msgs_sorted if m.role == "user"), None)
            title = first_user.content_preview[:50] if first_user else "Untitled"

            assistant_msgs = [m for m in msgs_sorted if m.role == "assistant"]
            avg_conf = (
                sum(m.confidence_score for m in assistant_msgs) / len(assistant_msgs)
                if assistant_msgs
                else 0.0
            )

            summaries.append(
                ConversationSummary(
                    conversation_id=cid,
                    workspace_id=msgs_sorted[0].workspace_id,
                    user_id=msgs_sorted[0].user_id,
                    title=title,
                    message_count=len(msgs_sorted),
                    last_message_at=msgs_sorted[-1].created_at,
                    avg_confidence=round(avg_conf, 4),
                    mode=msgs_sorted[0].mode,
                )
            )

        summaries.sort(key=lambda s: s.last_message_at, reverse=True)
        return summaries

    async def get_conversation(self, conversation_id: str) -> list[ChatHistoryRecord]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.conversation_id = @cid",
            parameters=[{"name": "@cid", "value": conversation_id}],
        )
        records = [ChatHistoryRecord(**_strip(i)) for i in items]
        records.sort(key=lambda m: m.created_at)
        return records

    async def get_all_assistant_messages(self) -> list[ChatHistoryRecord]:
        """Return all assistant messages (for ops metrics computation)."""
        items = await self._cosmos.query(CONTAINER, "SELECT * FROM c WHERE c.role = 'assistant'")
        return [ChatHistoryRecord(**_strip(i)) for i in items]

    async def get_traces(
        self,
        workspace_id: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        conditions = ["c.role = 'assistant'"]
        params = []
        if workspace_id is not None:
            conditions.append("c.workspace_id = @ws")
            params.append({"name": "@ws", "value": workspace_id})

        where = " AND ".join(conditions)
        q = f"SELECT * FROM c WHERE {where} ORDER BY c.created_at DESC OFFSET 0 LIMIT @lim"
        params.append({"name": "@lim", "value": limit})

        items = await self._cosmos.query(CONTAINER, q, parameters=params)
        return [
            {
                "conversation_id": i["conversation_id"],
                "message_id": i["message_id"],
                "workspace_id": i.get("workspace_id"),
                "confidence_score": i.get("confidence_score", 0.0),
                "agent_steps": i.get("agent_steps", []),
                "citations_count": len(i.get("citations", [])),
                "model": i.get("model", ""),
                "mode": i.get("mode", ""),
                "created_at": i.get("created_at", ""),
            }
            for i in items
        ]

    async def confidence_calibration(self) -> list[dict]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.role = 'assistant'",
        )

        buckets = [
            ("0.0-0.2", 0.0, 0.2),
            ("0.2-0.4", 0.2, 0.4),
            ("0.4-0.6", 0.4, 0.6),
            ("0.6-0.8", 0.6, 0.8),
            ("0.8-1.0", 0.8, 1.0),
        ]

        result: list[dict] = []
        for label, lo, hi in buckets:
            in_bucket = [
                i
                for i in items
                if lo <= i.get("confidence_score", 0.0) < hi
                or (hi == 1.0 and i.get("confidence_score", 0.0) == 1.0)
            ]
            if not in_bucket:
                result.append(
                    {"range": label, "count": 0, "avg_confidence": 0.0, "with_citations_pct": 0.0}
                )
                continue

            avg_conf = sum(i.get("confidence_score", 0.0) for i in in_bucket) / len(in_bucket)
            with_citations = sum(1 for i in in_bucket if i.get("citations"))
            result.append(
                {
                    "range": label,
                    "count": len(in_bucket),
                    "avg_confidence": round(avg_conf, 4),
                    "with_citations_pct": round(with_citations / len(in_bucket) * 100, 1),
                }
            )
        return result
