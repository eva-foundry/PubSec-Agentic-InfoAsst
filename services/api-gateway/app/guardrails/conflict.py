"""Multi-agent conflict resolution guardrail.

Detects when multiple tool results or sources contradict each other
within a single agent run. Applies an arbitration hierarchy to resolve
conflicts and surfaces both positions with full provenance.

Arbitration hierarchy (highest authority wins):
  1. Legislation (Acts of Parliament)
  2. Regulations (Governor in Council)
  3. Tribunal decisions (SST, courts)
  4. Policy directives (TBS, ESDC)
  5. Operational guidance (manuals, SOPs)
  6. General knowledge (model generation)

ITSG-33: SI-5 (Security Alerts & Advisories) — extended to agent conflicts
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any

from .audit import AuditLogger

logger = logging.getLogger("eva.guardrails.conflict")
_audit = AuditLogger()


class SourceAuthority(IntEnum):
    """Authority hierarchy for conflict arbitration (higher = more authoritative)."""

    UNKNOWN = 0
    GENERAL_KNOWLEDGE = 10
    OPERATIONAL_GUIDANCE = 20
    POLICY_DIRECTIVE = 30
    TRIBUNAL_DECISION = 40
    REGULATION = 50
    LEGISLATION = 60


# Map source type strings to authority levels
_AUTHORITY_MAP: dict[str, SourceAuthority] = {
    "act": SourceAuthority.LEGISLATION,
    "legislation": SourceAuthority.LEGISLATION,
    "statute": SourceAuthority.LEGISLATION,
    "regulation": SourceAuthority.REGULATION,
    "sor": SourceAuthority.REGULATION,  # Statutory Orders and Regulations
    "tribunal": SourceAuthority.TRIBUNAL_DECISION,
    "sst": SourceAuthority.TRIBUNAL_DECISION,  # Social Security Tribunal
    "court": SourceAuthority.TRIBUNAL_DECISION,
    "scc": SourceAuthority.TRIBUNAL_DECISION,  # Supreme Court of Canada
    "fca": SourceAuthority.TRIBUNAL_DECISION,  # Federal Court of Appeal
    "policy": SourceAuthority.POLICY_DIRECTIVE,
    "tbs": SourceAuthority.POLICY_DIRECTIVE,
    "directive": SourceAuthority.POLICY_DIRECTIVE,
    "guidance": SourceAuthority.OPERATIONAL_GUIDANCE,
    "manual": SourceAuthority.OPERATIONAL_GUIDANCE,
    "sop": SourceAuthority.OPERATIONAL_GUIDANCE,
    "general": SourceAuthority.GENERAL_KNOWLEDGE,
    "model": SourceAuthority.GENERAL_KNOWLEDGE,
}


@dataclass
class SourceClaim:
    """A claim made by a specific source."""

    source_id: str
    source_type: str  # e.g., "legislation", "tribunal", "policy"
    source_title: str
    claim_text: str
    authority: SourceAuthority = SourceAuthority.UNKNOWN
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ConflictDetection:
    """Result of conflict detection between two or more claims."""

    conflict_id: str
    topic: str
    claims: list[SourceClaim]
    is_conflict: bool
    resolution: str  # "authority_hierarchy" | "recency" | "unresolved" | "no_conflict"
    winning_claim: SourceClaim | None = None
    confidence_adjustment: float = 0.0  # Negative adjustment to apply to confidence
    explanation: str = ""
    all_positions_summary: str = ""  # EN summary of all positions for transparency


@dataclass
class ConflictReport:
    """Aggregated conflict report for a single query."""

    conflicts_detected: int = 0
    conflicts_resolved: int = 0
    conflicts_unresolved: int = 0
    detections: list[ConflictDetection] = field(default_factory=list)
    confidence_penalty: float = 0.0  # Total confidence reduction


class ConflictResolver:
    """Detects and resolves conflicts between multiple source claims."""

    def __init__(self):
        pass

    def classify_authority(self, source_type: str) -> SourceAuthority:
        """Map a source type string to its authority level."""
        normalized = source_type.lower().strip()
        for key, authority in _AUTHORITY_MAP.items():
            if key in normalized:
                return authority
        return SourceAuthority.UNKNOWN

    def detect_conflicts(
        self,
        claims: list[SourceClaim],
        topic: str = "",
        correlation_id: str = "",
    ) -> ConflictReport:
        """Analyze a set of claims for contradictions.

        Claims are grouped by topic. Within each group, if claims
        express opposing positions, a conflict is detected and
        arbitration is attempted.
        """
        report = ConflictReport()

        if len(claims) < 2:
            return report

        # Assign authority levels
        for claim in claims:
            if claim.authority == SourceAuthority.UNKNOWN:
                claim.authority = self.classify_authority(claim.source_type)

        # Compare all pairs for potential conflicts
        seen_pairs: set[tuple[str, str]] = set()
        for i, claim_a in enumerate(claims):
            for j, claim_b in enumerate(claims):
                if i >= j:
                    continue

                pair_key = (claim_a.source_id, claim_b.source_id)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Detect if claims conflict (heuristic: different authority sources
                # making claims about the same topic with different conclusions)
                if self._claims_may_conflict(claim_a, claim_b):
                    detection = self._resolve_conflict(claim_a, claim_b, topic, correlation_id)
                    report.detections.append(detection)

                    if detection.is_conflict:
                        report.conflicts_detected += 1
                        if detection.resolution != "unresolved":
                            report.conflicts_resolved += 1
                        else:
                            report.conflicts_unresolved += 1
                        report.confidence_penalty += abs(detection.confidence_adjustment)

        return report

    def _claims_may_conflict(self, a: SourceClaim, b: SourceClaim) -> bool:
        """Heuristic: do two claims potentially conflict?

        Two claims may conflict if they come from different sources
        with different authority levels and make substantively different
        statements. This is a conservative heuristic — false positives
        are better than missed conflicts for audit purposes.
        """
        # Same source can't conflict with itself
        if a.source_id == b.source_id:
            return False

        # Different authority levels + different source types suggests
        # potentially conflicting interpretations
        if a.authority != b.authority and a.source_type != b.source_type:
            return True

        # Same authority level but different sources may also conflict
        if a.source_id != b.source_id and a.authority == b.authority:
            return True

        return False

    def _resolve_conflict(
        self,
        claim_a: SourceClaim,
        claim_b: SourceClaim,
        topic: str,
        correlation_id: str,
    ) -> ConflictDetection:
        """Attempt to resolve a conflict between two claims."""
        conflict_id = f"conflict-{hash((claim_a.source_id, claim_b.source_id)) & 0xFFFFFFFF:08x}"

        # Sort by authority (higher wins)
        higher = claim_a if claim_a.authority >= claim_b.authority else claim_b
        lower = claim_b if higher is claim_a else claim_a

        # Determine resolution strategy
        if higher.authority > lower.authority:
            resolution = "authority_hierarchy"
            winning_claim = higher
            confidence_adj = -0.1  # Small penalty for having a conflict at all
            explanation = (
                f"Conflict resolved by authority hierarchy: "
                f"{higher.source_type} ({higher.authority.name}, "
                f"authority={higher.authority.value}) "
                f"takes precedence over {lower.source_type} "
                f"({lower.authority.name}, authority={lower.authority.value})."
            )
        elif higher.authority == lower.authority:
            # Same authority level — check recency if available
            higher_date = higher.metadata.get("date", "")
            lower_date = lower.metadata.get("date", "")

            if higher_date and lower_date and higher_date > lower_date:
                resolution = "recency"
                winning_claim = higher
                confidence_adj = -0.15
                explanation = (
                    f"Same authority level ({higher.authority.name}). "
                    f"Resolved by recency: {higher.source_title} ({higher_date}) "
                    f"is more recent than {lower.source_title} ({lower_date})."
                )
            elif lower_date and higher_date and lower_date > higher_date:
                resolution = "recency"
                winning_claim = lower
                confidence_adj = -0.15
                explanation = (
                    f"Same authority level ({higher.authority.name}). "
                    f"Resolved by recency: {lower.source_title} ({lower_date}) "
                    f"is more recent than {higher.source_title} ({higher_date})."
                )
            else:
                resolution = "unresolved"
                winning_claim = None
                confidence_adj = -0.25  # Larger penalty for unresolved conflicts
                explanation = (
                    f"Unresolved conflict: both sources have equal authority "
                    f"({higher.authority.name}) and no recency data available. "
                    f"Human review recommended."
                )
        else:
            resolution = "unresolved"
            winning_claim = None
            confidence_adj = -0.2
            explanation = "Unable to determine authority relationship."

        all_positions = (
            f"Position A ({claim_a.source_type}, {claim_a.source_title}): {claim_a.claim_text}\n"
            f"Position B ({claim_b.source_type}, {claim_b.source_title}): {claim_b.claim_text}"
        )

        # Audit the conflict detection
        _audit.log_action(
            subject=f"conflict-{conflict_id}",
            actor="conflict-resolver",
            action="resolve",
            purpose=f"Conflict detected on topic: {topic}",
            resource=f"{claim_a.source_id} vs {claim_b.source_id}",
            policy_decision=f"{resolution}:{winning_claim.source_id if winning_claim else 'none'}",
            correlation_id=correlation_id,
            trace_id="",
        )

        if resolution == "unresolved":
            logger.warning(
                "Unresolved conflict: %s vs %s on topic '%s'",
                claim_a.source_id,
                claim_b.source_id,
                topic,
                extra={"correlation_id": correlation_id},
            )

        return ConflictDetection(
            conflict_id=conflict_id,
            topic=topic,
            claims=[claim_a, claim_b],
            is_conflict=True,
            resolution=resolution,
            winning_claim=winning_claim,
            confidence_adjustment=confidence_adj,
            explanation=explanation,
            all_positions_summary=all_positions,
        )
