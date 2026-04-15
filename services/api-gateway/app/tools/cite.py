"""Citation tool — resolves search results to Citation objects with SAS URLs.

Currently generates placeholder SAS URLs. When Azure Blob Storage is wired in,
this tool will generate real short-lived SAS tokens per document.
"""

from __future__ import annotations

from ..provenance.models import Citation
from .registry import Tool, ToolMetadata


class CitationTool(Tool):
    """Resolves search results into Citation objects with SAS URLs."""

    metadata = ToolMetadata(
        name="cite",
        description="Resolve search results to citations with SAS-signed URLs",
        classification_ceiling="protected_b",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    async def execute(self, **kwargs) -> dict:
        """Map search results to Citation objects.

        Parameters
        ----------
        search_results : list[dict]
            Results from the search tool.

        Returns
        -------
        dict
            ``citations`` list of Citation model-dump dicts and ``duration_ms``.
        """
        search_results: list[dict] = kwargs.get("search_results", [])

        citations: list[Citation] = []
        for result in search_results:
            citation = Citation(
                file=result.get("file", "unknown"),
                page=result.get("page"),
                section=result.get("section"),
                sas_url=(
                    f"https://evastorage.blob.core.windows.net/"
                    f"{result.get('file', 'unknown')}?sv=mock&se=2026-04-15&sig=placeholder"
                ),
                last_verified=result.get("last_modified"),
                source_quality_score=max(result.get("relevance_score") or 0.0, 0.0),
            )
            citations.append(citation)

        return {
            "citations": citations,
            "duration_ms": 0,
        }
