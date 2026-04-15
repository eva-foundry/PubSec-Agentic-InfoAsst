from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class GroundingResult:
    """Result of grounding analysis on an answer."""

    total_sentences: int
    grounded_sentences: int
    grounding_ratio: float
    ungrounded_assertions: list[str] = field(default_factory=list)


# Regex matching citation references like [File0], [File1], [doc2], etc.
_CITATION_PATTERN = re.compile(r"\[(?:File|doc|Source|Ref)\d+\]", re.IGNORECASE)

# Sentence splitter — splits on period/exclamation/question followed by whitespace or end.
_SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, filtering out empty strings."""
    raw = _SENTENCE_PATTERN.split(text.strip())
    return [s.strip() for s in raw if s.strip()]


class GroundingEnforcer:
    """Ensures responses are grounded in source documents."""

    DEFAULT_THRESHOLD = 0.5

    def __init__(self, threshold: float = DEFAULT_THRESHOLD):
        self.threshold = threshold

    def check_grounding(
        self, answer: str, citations: list | None = None
    ) -> GroundingResult:
        """Analyze *answer* for inline citation references.

        Counts sentences and determines which ones contain citation markers
        such as ``[File0]``, ``[doc1]``, ``[Source2]``, ``[Ref3]``.

        *citations* is accepted for interface compatibility but the check
        relies on inline markers in the answer text itself.
        """
        sentences = _split_sentences(answer)
        if not sentences:
            return GroundingResult(
                total_sentences=0,
                grounded_sentences=0,
                grounding_ratio=1.0,
                ungrounded_assertions=[],
            )

        grounded: list[str] = []
        ungrounded: list[str] = []

        for sentence in sentences:
            if _CITATION_PATTERN.search(sentence):
                grounded.append(sentence)
            else:
                ungrounded.append(sentence)

        total = len(sentences)
        grounded_count = len(grounded)
        ratio = grounded_count / total if total > 0 else 1.0

        return GroundingResult(
            total_sentences=total,
            grounded_sentences=grounded_count,
            grounding_ratio=ratio,
            ungrounded_assertions=ungrounded,
        )

    def enforce(
        self,
        answer: str,
        citations: list | None = None,
        require_grounding: bool = True,
    ) -> str:
        """Append a disclaimer if grounding ratio falls below threshold.

        Returns the original answer (possibly with appended disclaimer).
        """
        if not require_grounding:
            return answer

        result = self.check_grounding(answer, citations)
        if result.grounding_ratio < self.threshold:
            disclaimer = (
                "\n\nNote: Some statements in this response may not be "
                "fully supported by the available sources."
            )
            return answer + disclaimer

        return answer
