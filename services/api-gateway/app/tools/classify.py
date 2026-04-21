"""Document classification tool — heuristic-based, no LLM required.

Classifies documents by type (legislation, case_law, policy, general),
data classification level, and language using regex patterns and keyword
matching.  Designed to run fast with zero external dependencies.
"""

from __future__ import annotations

import logging
import re

from .registry import Tool, ToolMetadata

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Classification patterns
# ---------------------------------------------------------------------------

# Document type patterns — ordered by specificity (most specific first)
_LEGISLATION_PATTERNS = [
    re.compile(r"\b(Act|Loi)\b.*\b(Parliament|Parlement|Canada|R\.S\.C|L\.R\.C)\b", re.IGNORECASE),
    re.compile(r"\b(Regulation|Règlement)\b.*\b(SOR|DORS|C\.R\.C)\b", re.IGNORECASE),
    re.compile(r"\bS\.C\.\s+\d{4}", re.IGNORECASE),
    re.compile(r"\b(subsection|paragraph|alinéa|paragraphe)\s+\d+\(\d+\)", re.IGNORECASE),
    re.compile(r"\b(enacted|édictée?|assented|sanctionnée?)\b", re.IGNORECASE),
    re.compile(r"\bStatutes\s+of\s+Canada\b", re.IGNORECASE),
    re.compile(r"\bHer Majesty|His Majesty|Sa Majesté\b", re.IGNORECASE),
    re.compile(r"\b(section|article)\s+\d+\s+of\s+the\b", re.IGNORECASE),
]

_CASE_LAW_PATTERNS = [
    re.compile(r"\b(Tribunal|Court|Cour|Judge|Juge)\b", re.IGNORECASE),
    re.compile(r"\b\d{4}\s+(FC|CF|FCA|CAF|SCC|CSC|ONCA|BCCA)\s+\d+\b"),
    re.compile(r"\bAppeal\s+Division|Division\s+d['']appel\b", re.IGNORECASE),
    re.compile(r"\b(plaintiff|defendant|appellant|respondent|claimant)\b", re.IGNORECASE),
    re.compile(r"\b(plaignant|défendeur|appelant|intimé|demandeur)\b", re.IGNORECASE),
    re.compile(r"\b(v\.|c\.)\s+[A-Z]", re.MULTILINE),
    re.compile(r"\bSST|Social Security Tribunal\b", re.IGNORECASE),
    re.compile(r"\b(decision|décision|ruling|jugement|reasons|motifs)\b", re.IGNORECASE),
]

_POLICY_PATTERNS = [
    re.compile(r"\b(policy|politique|directive|guideline|ligne directrice)\b", re.IGNORECASE),
    re.compile(r"\b(Treasury Board|Conseil du Trésor|TBS|SCT)\b", re.IGNORECASE),
    re.compile(
        r"\b(standard|norme|procedure|procédure)\b.*\b(government|gouvernement)\b", re.IGNORECASE
    ),
    re.compile(r"\b(effective date|date d['']entrée en vigueur)\b", re.IGNORECASE),
    re.compile(r"\b(mandatory|obligatoire)\s+(requirements?|exigences?)\b", re.IGNORECASE),
]

# Language detection patterns
_FRENCH_PATTERNS = [
    re.compile(r"\b(le|la|les|du|des|un|une|dans|pour|avec|cette?|est|sont|aux)\b"),
    re.compile(r"[àâäéèêëïîôùûüÿçœæ]"),
]

_ENGLISH_PATTERNS = [
    re.compile(r"\b(the|is|are|was|were|have|has|been|will|shall|may|must)\b"),
    re.compile(r"\b(and|or|but|not|this|that|which|with|from)\b"),
]

# Data classification heuristics
_SENSITIVE_PATTERNS = [
    re.compile(r"\b(protected\s*b|protégé\s*b)\b", re.IGNORECASE),
    re.compile(
        r"\b(SIN|NAS|social insurance number|numéro d['']assurance sociale)\b", re.IGNORECASE
    ),
    re.compile(
        r"\b(medical|médicale?|health|santé)\s+(record|dossier|information|renseignement)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(personal|personnel)\s+(information|renseignement)\b", re.IGNORECASE),
]

_RESTRICTED_PATTERNS = [
    re.compile(r"\b(protected\s*a|protégé\s*a)\b", re.IGNORECASE),
    re.compile(r"\b(confidential|confidentiel)\b", re.IGNORECASE),
    re.compile(r"\b(internal use|usage interne)\b", re.IGNORECASE),
]


def _count_matches(text: str, patterns: list[re.Pattern]) -> int:
    """Count how many patterns match at least once in text."""
    return sum(1 for p in patterns if p.search(text))


def _detect_document_type(text: str) -> tuple[str, float]:
    """Classify document type and return (type, confidence)."""
    leg_score = _count_matches(text, _LEGISLATION_PATTERNS)
    case_score = _count_matches(text, _CASE_LAW_PATTERNS)
    pol_score = _count_matches(text, _POLICY_PATTERNS)

    max_score = max(leg_score, case_score, pol_score)

    if max_score == 0:
        return "general", 0.3

    # Confidence based on how many patterns matched out of total
    if leg_score == max_score and leg_score > case_score:
        confidence = min(0.5 + leg_score * 0.08, 0.95)
        return "legislation", round(confidence, 2)

    if case_score == max_score and case_score > leg_score:
        confidence = min(0.5 + case_score * 0.08, 0.95)
        return "case_law", round(confidence, 2)

    if pol_score == max_score:
        confidence = min(0.5 + pol_score * 0.1, 0.95)
        return "policy", round(confidence, 2)

    # Tie-break: legislation > case_law > policy
    if leg_score >= case_score:
        return "legislation", round(min(0.4 + leg_score * 0.06, 0.85), 2)
    return "case_law", round(min(0.4 + case_score * 0.06, 0.85), 2)


def _detect_language(text: str) -> str:
    """Detect language: en, fr, or bilingual."""
    # Sample first 2000 chars for speed
    sample = text[:2000]

    en_matches = sum(len(p.findall(sample)) for p in _ENGLISH_PATTERNS)
    fr_matches = sum(len(p.findall(sample)) for p in _FRENCH_PATTERNS)

    total = en_matches + fr_matches
    if total == 0:
        return "en"

    en_ratio = en_matches / total
    fr_ratio = fr_matches / total

    # If both languages are well-represented, it's bilingual
    if en_ratio > 0.3 and fr_ratio > 0.3:
        return "bilingual"
    if fr_ratio > en_ratio:
        return "fr"
    return "en"


def _detect_classification(text: str) -> str:
    """Detect data classification level."""
    if _count_matches(text, _SENSITIVE_PATTERNS) > 0:
        return "sensitive"
    if _count_matches(text, _RESTRICTED_PATTERNS) > 0:
        return "restricted"
    return "unclassified"


class ClassifyTool(Tool):
    """Heuristic document classifier — no LLM call needed."""

    metadata = ToolMetadata(
        name="classify",
        description=(
            "Classify document type, data classification, and language "
            "using keyword heuristics"
        ),
        classification_ceiling="sensitive",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    async def execute(self, **kwargs) -> dict:
        """Classify a document.

        Parameters
        ----------
        text : str
            The document text to classify.

        Returns
        -------
        dict
            ``document_type``, ``data_classification``, ``language``,
            ``confidence``.
        """
        text: str = kwargs["text"]

        if not text or not text.strip():
            return {
                "document_type": "general",
                "data_classification": "unclassified",
                "language": "en",
                "confidence": 0.0,
            }

        doc_type, confidence = _detect_document_type(text)
        data_class = _detect_classification(text)
        language = _detect_language(text)

        logger.info(
            "ClassifyTool: type=%s class=%s lang=%s conf=%.2f (text_len=%d)",
            doc_type,
            data_class,
            language,
            confidence,
            len(text),
        )

        return {
            "document_type": doc_type,
            "data_classification": data_class,
            "language": language,
            "confidence": confidence,
        }
