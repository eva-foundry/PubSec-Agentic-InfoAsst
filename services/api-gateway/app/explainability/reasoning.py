"""Structured reasoning summaries for explainability.

Generates human-readable reasoning summaries from the agent's tool execution
trace, describing what was retrieved, what was used, and why.
"""

from __future__ import annotations


class ReasoningSummarizer:
    """Generates human-readable reasoning summaries from agent execution data."""

    def summarize(
        self,
        search_query: str,
        sources_consulted: int,
        sources_used: int,
        sources_excluded: int,
        exclusion_reasons: list[str],
        answer_approach: str,  # "grounded" | "ungrounded"
    ) -> str:
        """Produce a structured summary of the reasoning process.

        Example output:
            "5 sources retrieved from the social benefits Act corpus; 3 selected based on section
            relevance; 1 excluded (superseded by newer version); 1 excluded (below
            relevance threshold). Answer is grounded in retrieved sources."

        Args:
            search_query: The search query that drove retrieval.
            sources_consulted: Total number of sources retrieved.
            sources_used: Number of sources selected for the answer.
            sources_excluded: Number of sources excluded.
            exclusion_reasons: Human-readable reason for each exclusion.
            answer_approach: Whether the answer is "grounded" or "ungrounded".

        Returns:
            Structured reasoning summary string.
        """
        if sources_consulted == 0:
            return (
                f'No sources were retrieved for query "{search_query}". '
                "The answer is not grounded in any retrieved sources."
            )

        parts: list[str] = []

        parts.append(f'{sources_consulted} sources retrieved for query "{search_query}"')

        if sources_used > 0:
            parts.append(f"{sources_used} selected based on section relevance")

        for reason in exclusion_reasons:
            parts.append(f"1 excluded ({reason})")

        # Approach disclosure
        if answer_approach == "grounded":
            parts.append("Answer is grounded in retrieved sources")
        else:
            parts.append("Answer could not be fully grounded in retrieved sources")

        return "; ".join(parts) + "."
