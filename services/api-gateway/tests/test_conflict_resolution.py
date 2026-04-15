"""Tests for multi-agent conflict resolution guardrail."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from app.guardrails.conflict import (
    ConflictResolver,
    SourceAuthority,
    SourceClaim,
    ConflictDetection,
    ConflictReport,
)


class TestAuthorityClassification:
    """Test source type classification into authority hierarchy."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_classify_legislation(self):
        """Act/legislation/statute → LEGISLATION (highest)."""
        assert self.resolver.classify_authority("act") == SourceAuthority.LEGISLATION
        assert self.resolver.classify_authority("Legislation") == SourceAuthority.LEGISLATION
        assert self.resolver.classify_authority("statute") == SourceAuthority.LEGISLATION

    def test_classify_regulation(self):
        """regulation/SOR → REGULATION."""
        assert self.resolver.classify_authority("regulation") == SourceAuthority.REGULATION
        assert self.resolver.classify_authority("SOR") == SourceAuthority.REGULATION

    def test_classify_tribunal_decision(self):
        """tribunal/SST/court/SCC/FCA → TRIBUNAL_DECISION."""
        assert self.resolver.classify_authority("tribunal") == SourceAuthority.TRIBUNAL_DECISION
        assert self.resolver.classify_authority("SST") == SourceAuthority.TRIBUNAL_DECISION
        assert self.resolver.classify_authority("court") == SourceAuthority.TRIBUNAL_DECISION
        assert self.resolver.classify_authority("SCC") == SourceAuthority.TRIBUNAL_DECISION
        assert self.resolver.classify_authority("FCA") == SourceAuthority.TRIBUNAL_DECISION

    def test_classify_policy_directive(self):
        """policy/TBS/directive → POLICY_DIRECTIVE."""
        assert self.resolver.classify_authority("policy") == SourceAuthority.POLICY_DIRECTIVE
        assert self.resolver.classify_authority("TBS") == SourceAuthority.POLICY_DIRECTIVE
        assert self.resolver.classify_authority("directive") == SourceAuthority.POLICY_DIRECTIVE

    def test_classify_operational_guidance(self):
        """guidance/manual/SOP → OPERATIONAL_GUIDANCE."""
        assert self.resolver.classify_authority("guidance") == SourceAuthority.OPERATIONAL_GUIDANCE
        assert self.resolver.classify_authority("manual") == SourceAuthority.OPERATIONAL_GUIDANCE
        assert self.resolver.classify_authority("SOP") == SourceAuthority.OPERATIONAL_GUIDANCE

    def test_classify_general_knowledge(self):
        """general/model → GENERAL_KNOWLEDGE (lowest)."""
        assert self.resolver.classify_authority("general") == SourceAuthority.GENERAL_KNOWLEDGE
        assert self.resolver.classify_authority("model") == SourceAuthority.GENERAL_KNOWLEDGE

    def test_classify_unknown_source_type(self):
        """Unknown source type → UNKNOWN."""
        assert self.resolver.classify_authority("xyz") == SourceAuthority.UNKNOWN
        assert self.resolver.classify_authority("foobar") == SourceAuthority.UNKNOWN
        assert self.resolver.classify_authority("") == SourceAuthority.UNKNOWN

    def test_classify_case_insensitive(self):
        """Classification is case-insensitive."""
        assert self.resolver.classify_authority("ACT") == SourceAuthority.LEGISLATION
        assert self.resolver.classify_authority("Tribunal") == SourceAuthority.TRIBUNAL_DECISION
        assert self.resolver.classify_authority("POLICY") == SourceAuthority.POLICY_DIRECTIVE


class TestConflictDetection:
    """Test conflict detection between claims."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_single_claim_no_conflict(self):
        """Single claim cannot generate a conflict."""
        claim = SourceClaim(
            source_id="src-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="Eligibility requires 600 hours",
        )
        report = self.resolver.detect_conflicts([claim])
        assert report.conflicts_detected == 0
        assert len(report.detections) == 0

    def test_empty_claims_no_conflict(self):
        """Empty claim list generates no conflict."""
        report = self.resolver.detect_conflicts([])
        assert report.conflicts_detected == 0
        assert len(report.detections) == 0

    def test_same_source_no_conflict(self):
        """Two claims from same source cannot conflict."""
        claim_a = SourceClaim(
            source_id="src-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="Claim A",
        )
        claim_b = SourceClaim(
            source_id="src-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="Claim B",
        )
        report = self.resolver.detect_conflicts([claim_a, claim_b])
        assert report.conflicts_detected == 0

    def test_different_authority_levels_conflict(self):
        """Different authority levels with different source types may conflict."""
        claim_legislation = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="Eligibility requires 600 hours",
        )
        claim_guidance = SourceClaim(
            source_id="guid-001",
            source_type="guidance",
            source_title="Service SOP",
            claim_text="Eligibility requires 700 hours",
        )
        report = self.resolver.detect_conflicts([claim_legislation, claim_guidance])
        assert report.conflicts_detected == 1
        assert report.conflicts_resolved == 1


class TestConflictResolutionByAuthority:
    """Test conflict resolution using authority hierarchy."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_resolve_legislation_vs_policy(self):
        """Legislation (60) beats policy (30)."""
        claim_act = SourceClaim(
            source_id="act-001",
            source_type="act",
            source_title="EI Act s.6",
            claim_text="600 hours minimum",
            authority=SourceAuthority.LEGISLATION,
        )
        claim_policy = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="ESDC Directive",
            claim_text="500 hours minimum",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        report = self.resolver.detect_conflicts(
            [claim_act, claim_policy],
            topic="EI eligibility hours",
            correlation_id="corr-001",
        )
        assert report.conflicts_detected == 1
        assert report.conflicts_resolved == 1
        detection = report.detections[0]
        assert detection.resolution == "authority_hierarchy"
        assert detection.winning_claim == claim_act
        assert detection.confidence_adjustment == -0.1

    def test_resolve_regulation_vs_tribunal(self):
        """Regulation (50) beats tribunal decision (40)."""
        claim_reg = SourceClaim(
            source_id="sor-001",
            source_type="regulation",
            source_title="EI Regulations",
            claim_text="Waiting period is 1 week",
            authority=SourceAuthority.REGULATION,
        )
        claim_tribunal = SourceClaim(
            source_id="sst-001",
            source_type="tribunal",
            source_title="SST Case #123",
            claim_text="Waiting period is 2 weeks",
            authority=SourceAuthority.TRIBUNAL_DECISION,
        )
        report = self.resolver.detect_conflicts([claim_reg, claim_tribunal])
        assert report.conflicts_detected == 1
        detection = report.detections[0]
        assert detection.winning_claim == claim_reg

    def test_confidence_penalty_on_authority_conflict(self):
        """Confidence is reduced when authority conflict is found."""
        claim_legislation = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="Position A",
        )
        claim_guidance = SourceClaim(
            source_id="guid-001",
            source_type="guidance",
            source_title="SOP",
            claim_text="Position B",
        )
        report = self.resolver.detect_conflicts([claim_legislation, claim_guidance])
        assert report.confidence_penalty == pytest.approx(0.1, abs=1e-9)


class TestConflictResolutionByRecency:
    """Test conflict resolution using temporal recency."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_resolve_same_authority_newer_wins(self):
        """When authority is same, newer source wins."""
        claim_old = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Old Policy",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2020-01-01"},
        )
        claim_new = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="New Policy",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2024-01-01"},
        )
        report = self.resolver.detect_conflicts([claim_old, claim_new])
        assert report.conflicts_detected == 1
        detection = report.detections[0]
        assert detection.resolution == "recency"
        assert detection.winning_claim == claim_new
        assert detection.confidence_adjustment == pytest.approx(-0.15, abs=1e-9)

    def test_resolve_same_authority_older_wins_when_reversed(self):
        """Recency correctly identifies older date when reversed."""
        claim_new = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy A",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2024-06-01"},
        )
        claim_old = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="Policy B",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2020-03-15"},
        )
        report = self.resolver.detect_conflicts([claim_new, claim_old])
        assert report.conflicts_detected == 1
        detection = report.detections[0]
        assert detection.resolution == "recency"
        assert detection.winning_claim == claim_new


class TestConflictUnresolved:
    """Test unresolved conflicts."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_unresolved_same_authority_no_dates(self):
        """Same authority, no dates → unresolved."""
        claim_a = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy A",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        claim_b = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="Policy B",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        report = self.resolver.detect_conflicts([claim_a, claim_b])
        assert report.conflicts_detected == 1
        assert report.conflicts_unresolved == 1
        detection = report.detections[0]
        assert detection.resolution == "unresolved"
        assert detection.winning_claim is None
        assert detection.confidence_adjustment == pytest.approx(-0.25, abs=1e-9)

    def test_unresolved_same_authority_partial_dates(self):
        """Same authority with only one date → unresolved."""
        claim_with_date = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy A",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2024-01-01"},
        )
        claim_no_date = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="Policy B",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        report = self.resolver.detect_conflicts([claim_with_date, claim_no_date])
        assert report.conflicts_detected == 1
        assert report.conflicts_unresolved == 1
        detection = report.detections[0]
        assert detection.resolution == "unresolved"


class TestMultipleConflictAccumulation:
    """Test confidence penalty accumulation with multiple conflicts."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_confidence_penalty_accumulates(self):
        """Multiple conflicts accumulate confidence penalties."""
        claims = [
            SourceClaim(
                source_id="act-001",
                source_type="legislation",
                source_title="Act",
                claim_text="Position A",
            ),
            SourceClaim(
                source_id="policy-001",
                source_type="policy",
                source_title="Policy 1",
                claim_text="Position B",
            ),
            SourceClaim(
                source_id="policy-002",
                source_type="policy",
                source_title="Policy 2",
                claim_text="Position C",
            ),
        ]
        report = self.resolver.detect_conflicts(claims)
        # act vs policy-001: -0.1, policy-001 vs policy-002: -0.25
        assert report.confidence_penalty == pytest.approx(0.35, abs=1e-9)
        assert report.conflicts_detected == 2

    def test_multiple_conflicts_report_structure(self):
        """ConflictReport correctly aggregates multiple conflicts."""
        claims = [
            SourceClaim(
                source_id="src-a",
                source_type="legislation",
                source_title="Act A",
                claim_text="Claim A",
            ),
            SourceClaim(
                source_id="src-b",
                source_type="policy",
                source_title="Policy B",
                claim_text="Claim B",
            ),
            SourceClaim(
                source_id="src-c",
                source_type="guidance",
                source_title="Guide C",
                claim_text="Claim C",
            ),
        ]
        report = self.resolver.detect_conflicts(claims, topic="benefits eligibility")
        assert report.conflicts_detected >= 1
        assert len(report.detections) >= 1
        for detection in report.detections:
            assert detection.topic == "benefits eligibility"


class TestConflictExplanation:
    """Test that conflicts include clear explanations."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_authority_hierarchy_explanation(self):
        """Authority hierarchy resolution includes clear explanation."""
        claim_act = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="600 hours",
            authority=SourceAuthority.LEGISLATION,
        )
        claim_policy = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="ESDC Policy",
            claim_text="500 hours",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        report = self.resolver.detect_conflicts([claim_act, claim_policy])
        detection = report.detections[0]
        assert "authority_hierarchy" in detection.explanation.lower() or "authority hierarchy" in detection.explanation.lower()
        assert "precedence" in detection.explanation.lower()

    def test_recency_explanation(self):
        """Recency resolution includes clear explanation."""
        claim_old = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Old Policy",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2020-01-01"},
        )
        claim_new = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="New Policy",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
            metadata={"date": "2024-01-01"},
        )
        report = self.resolver.detect_conflicts([claim_old, claim_new])
        detection = report.detections[0]
        assert "recency" in detection.explanation.lower()
        assert "recent" in detection.explanation.lower()

    def test_unresolved_explanation(self):
        """Unresolved conflicts include explanation and recommendation."""
        claim_a = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy A",
            claim_text="Position A",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        claim_b = SourceClaim(
            source_id="policy-002",
            source_type="policy",
            source_title="Policy B",
            claim_text="Position B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        report = self.resolver.detect_conflicts([claim_a, claim_b])
        detection = report.detections[0]
        assert "unresolved" in detection.explanation.lower()
        assert "human review" in detection.explanation.lower()

    def test_all_positions_summary(self):
        """All positions are summarized for transparency."""
        claim_a = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="600 hours required",
        )
        claim_b = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="ESDC Policy",
            claim_text="500 hours required",
        )
        report = self.resolver.detect_conflicts([claim_a, claim_b])
        detection = report.detections[0]
        assert "Position A" in detection.all_positions_summary
        assert "Position B" in detection.all_positions_summary
        assert claim_a.claim_text in detection.all_positions_summary
        assert claim_b.claim_text in detection.all_positions_summary


class TestAuditLogging:
    """Test that conflicts trigger audit logging."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    @patch("app.guardrails.conflict._audit.log_action")
    def test_conflict_audit_logged(self, mock_audit):
        """Conflict resolution is logged to audit trail."""
        claim_act = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="EI Act",
            claim_text="600 hours",
            authority=SourceAuthority.LEGISLATION,
        )
        claim_policy = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy",
            claim_text="500 hours",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        self.resolver.detect_conflicts(
            [claim_act, claim_policy],
            topic="eligibility",
            correlation_id="corr-123",
        )
        mock_audit.log_action.assert_called()
        call_args = mock_audit.log_action.call_args
        assert call_args[1]["actor"] == "conflict-resolver"
        assert call_args[1]["action"] == "resolve"
        assert call_args[1]["correlation_id"] == "corr-123"

    @patch("app.guardrails.conflict._audit.log_action")
    def test_audit_includes_resolution_strategy(self, mock_audit):
        """Audit log includes which strategy resolved the conflict."""
        claim_a = SourceClaim(
            source_id="act-001",
            source_type="legislation",
            source_title="Act",
            claim_text="A",
            authority=SourceAuthority.LEGISLATION,
        )
        claim_b = SourceClaim(
            source_id="policy-001",
            source_type="policy",
            source_title="Policy",
            claim_text="B",
            authority=SourceAuthority.POLICY_DIRECTIVE,
        )
        self.resolver.detect_conflicts([claim_a, claim_b])
        call_args = mock_audit.log_action.call_args
        policy_decision = call_args[1]["policy_decision"]
        assert "authority_hierarchy" in policy_decision
        assert "act-001" in policy_decision


class TestConflictReportDataStructure:
    """Test ConflictReport data structure and fields."""

    def setup_method(self):
        self.resolver = ConflictResolver()

    def test_empty_report_defaults(self):
        """Empty conflict report has correct defaults."""
        report = ConflictReport()
        assert report.conflicts_detected == 0
        assert report.conflicts_resolved == 0
        assert report.conflicts_unresolved == 0
        assert report.detections == []
        assert report.confidence_penalty == 0.0

    def test_report_detection_tracking(self):
        """Report correctly tracks detected, resolved, and unresolved."""
        claims = [
            SourceClaim(
                source_id="act-001",
                source_type="legislation",
                source_title="Act",
                claim_text="Position A",
            ),
            SourceClaim(
                source_id="policy-001",
                source_type="policy",
                source_title="Policy A",
                claim_text="Position B",
            ),
            SourceClaim(
                source_id="policy-002",
                source_type="policy",
                source_title="Policy B",
                claim_text="Position C",
            ),
        ]
        report = self.resolver.detect_conflicts(claims)
        # act vs policy-001: resolved by authority
        # policy-001 vs policy-002: unresolved (same authority, no dates)
        assert report.conflicts_detected == 2
        assert report.conflicts_resolved == 1
        assert report.conflicts_unresolved == 1
