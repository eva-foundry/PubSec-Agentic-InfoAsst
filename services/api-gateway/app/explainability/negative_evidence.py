"""Negative evidence detection for explainability.

Identifies and reports gaps in retrieved evidence so users understand what the
system looked for but did not find.
"""

from __future__ import annotations

import re


# Regex for date-like patterns: YYYY, YYYY-MM, YYYY-MM-DD
_DATE_PATTERN = re.compile(
    r"\b((?:19|20)\d{2})(?:[-/](0[1-9]|1[0-2])(?:[-/](0[1-9]|[12]\d|3[01]))?)?\b"
)

# Regex for Act / regulation references (English and French)
# Uses (?:[A-Z][a-z]+\s+)+ to match capitalized word sequences before Act/Regulations/Code
_ACT_PATTERN = re.compile(
    r"\b("
    # English patterns: one or more capitalized words followed by Act/Regulations/Code
    r"(?:[A-Z][a-z]+(?:['-][A-Z]?[a-z]+)*\s+)+Act"
    r"|(?:[A-Z][a-z]+(?:['-][A-Z]?[a-z]+)*\s+)+Regulations?"
    r"|(?:[A-Z][a-z]+(?:['-][A-Z]?[a-z]+)*\s+)+Code"
    # French patterns
    r"|Loi\s+(?:sur|de|relative\s+[àa])\s+[a-zéèêëàâùûôîïç' -]+"
    r"|Règlement(?:s)?\s+(?:sur|de|relatif[s]?\s+[àa])\s+[a-zéèêëàâùûôîïç' -]+"
    r")\b",
)

# Hedging language that signals partial coverage
_HEDGING_PATTERNS = [
    re.compile(r"\b(?:may|might|could|possibly|potentially)\b", re.IGNORECASE),
    re.compile(r"\b(?:it is unclear|unclear whether|not certain)\b", re.IGNORECASE),
    re.compile(r"\b(?:insufficient information|no definitive)\b", re.IGNORECASE),
    re.compile(r"\b(?:further research|additional sources)\b", re.IGNORECASE),
]


class NegativeEvidenceDetector:
    """Identifies and reports gaps in retrieved evidence."""

    def detect(
        self,
        user_query: str,
        search_results: list[dict],
        answer_text: str,
    ) -> list[str]:
        """Detect and return negative evidence statements.

        Detection logic:
        1. If search returned 0 results -> report no sources found.
        2. If answer contains hedging language -> flag partial coverage.
        3. If query mentions a date range but no sources match -> report date gap.
        4. If query mentions a specific Act/regulation not in results -> report missing Act.

        Args:
            user_query: The user's original question.
            search_results: List of search result dicts (expected keys: 'content',
                'file', 'title', 'section', etc.).
            answer_text: The generated answer text.

        Returns:
            List of negative evidence disclosure strings.
        """
        negatives: list[str] = []

        # 1. No results at all
        if not search_results:
            negatives.append("No relevant sources found for this query")
            return negatives

        # 2. Hedging language detection
        negatives.extend(self._detect_hedging(answer_text))

        # 3. Date gap detection
        negatives.extend(self._detect_date_gaps(user_query, search_results))

        # 4. Missing Act/regulation detection
        negatives.extend(self._detect_missing_acts(user_query, search_results))

        return negatives

    def _detect_hedging(self, answer_text: str) -> list[str]:
        """Flag if the answer uses hedging language indicating partial coverage."""
        matched_hedges: list[str] = []
        for pattern in _HEDGING_PATTERNS:
            if pattern.search(answer_text):
                matched_hedges.append(pattern.pattern)

        if matched_hedges:
            return [
                "Answer contains hedging language, indicating partial source coverage"
            ]
        return []

    def _detect_date_gaps(
        self, user_query: str, search_results: list[dict]
    ) -> list[str]:
        """Check if query mentions dates not covered by any search result."""
        query_dates = _DATE_PATTERN.findall(user_query)
        if not query_dates:
            return []

        # Build a set of years mentioned in results (from content, title, file)
        result_text = " ".join(
            " ".join(str(v) for v in r.values() if isinstance(v, str))
            for r in search_results
        )
        result_dates = {m[0] for m in _DATE_PATTERN.findall(result_text)}

        negatives: list[str] = []
        for year, month, day in query_dates:
            if year not in result_dates:
                date_str = year
                if month:
                    date_str += f"-{month}"
                if day:
                    date_str += f"-{day}"
                negatives.append(
                    f"No sources found covering the period {date_str}"
                )

        return negatives

    def _detect_missing_acts(
        self, user_query: str, search_results: list[dict]
    ) -> list[str]:
        """Check if query references Acts/regulations not present in results."""
        query_acts = _ACT_PATTERN.findall(user_query)
        if not query_acts:
            return []

        # Normalize: strip whitespace, lowercase for comparison
        query_act_names = {a.strip().lower() for a in query_acts}

        # Build searchable text from all results
        result_text = " ".join(
            " ".join(str(v) for v in r.values() if isinstance(v, str))
            for r in search_results
        ).lower()

        negatives: list[str] = []
        for act_name in query_act_names:
            # Check if the act name (or a close substring) appears in results
            if act_name not in result_text:
                # Capitalize for display
                display_name = act_name.title()
                negatives.append(
                    f'No sources found referencing "{display_name}"'
                )

        return negatives
