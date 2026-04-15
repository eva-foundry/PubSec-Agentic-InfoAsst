"""Search tool — hybrid vector + keyword search over workspace documents.

Currently returns mock results. When Azure AI Search is wired in,
only the internals of ``execute`` change — the interface stays the same.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from .registry import Tool, ToolMetadata


class SearchTool(Tool):
    """Hybrid vector + keyword search over workspace documents."""

    metadata = ToolMetadata(
        name="search",
        description="Hybrid vector + keyword search over workspace documents",
        classification_ceiling="protected_b",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    def __init__(self, model_client=None) -> None:
        self._model_client = model_client

    async def execute(self, **kwargs) -> dict:
        """Search for documents matching the query.

        Parameters
        ----------
        query : str
            The user's search query.
        workspace_id : str
            The workspace to search within.
        top_k : int
            Maximum number of results to return (default 5).

        Returns
        -------
        dict
            ``results`` list and ``duration_ms``.
        """
        query: str = kwargs["query"]
        workspace_id: str = kwargs.get("workspace_id", "default")
        top_k: int = kwargs.get("top_k", 5)

        start = time.monotonic()

        # ----- Mock results (replaced by Azure AI Search SDK later) -----
        results = [
            {
                "id": f"doc-{i}",
                "file": f"workspace/{workspace_id}/document-{i}.pdf",
                "title": f"Policy Document {i}",
                "content": (
                    f"This is a relevant excerpt from document {i} that addresses "
                    f"the query: '{query}'. The Old Age Security Act provides benefits "
                    f"to eligible Canadian residents aged 65 and over. Section {i}.{i} "
                    f"details the qualifying criteria and payment schedules."
                ),
                "page": i * 3,
                "section": f"Section {i}.{i}",
                "relevance_score": round(0.95 - (i * 0.08), 4),
                "last_modified": datetime.now(timezone.utc).isoformat(),
            }
            for i in range(1, min(top_k, 5) + 1)
        ]

        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "results": results,
            "duration_ms": duration_ms,
            "query_used": query,
            "workspace_id": workspace_id,
        }
