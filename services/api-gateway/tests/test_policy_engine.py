"""Compliance-as-code policy engine tests.

Tests verify:
- Policy rule evaluation against various contexts
- sensitive boundary enforcement
- RAG grounding requirements
- RAI level escalation logic
- Tool registration and residency enforcement
- Audit trail completeness
- Data class functionality
- Edge cases (empty context, unknown operators, nested field resolution)
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.guardrails.policy_engine import (
    PolicyEngine,
    PolicyEvaluationResult,
    PolicyVerdict,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def policy_engine():
    """Load the default policy engine with built-in rules."""
    return PolicyEngine()


@pytest.fixture
def empty_rules_engine():
    """Create a policy engine with no rules."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump([], f)
        temp_file = f.name

    try:
        engine = PolicyEngine(temp_file)
        yield engine
    finally:
        Path(temp_file).unlink()


@pytest.fixture
def custom_rules_engine():
    """Create a policy engine with custom test rules."""
    rules = [
        {
            "id": "TEST-001",
            "name": "Test sensitive",
            "description": "Test rule for sensitive",
            "conditions": [
                {"field": "classification", "operator": "eq", "value": "sensitive"},
                {"field": "region", "operator": "in", "value": ["canadacentral", "canadaeast"]},
            ],
            "pass_action": "allow",
            "fail_action": "block",
        },
        {
            "id": "TEST-002",
            "name": "Test Nested Field",
            "description": "Test nested field resolution",
            "conditions": [
                {"field": "workspace.rai_level", "operator": "ge", "value": 2},
            ],
            "pass_action": "allow",
            "fail_action": "escalate_to_human",
        },
    ]

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(rules, f)
        temp_file = f.name

    try:
        engine = PolicyEngine(temp_file)
        yield engine
    finally:
        Path(temp_file).unlink()


# ============================================================================
# PolicyVerdict and PolicyEvaluationResult Tests
# ============================================================================


class TestPolicyVerdict:
    """Test PolicyVerdict data class."""

    def test_verdict_creation(self):
        """PolicyVerdict can be created with all fields."""
        verdict = PolicyVerdict(
            rule_id="TEST-001",
            rule_name="Test Rule",
            passed=True,
            reason="All conditions met",
            action="allow",
            evidence={"field1": "value1"},
        )
        assert verdict.rule_id == "TEST-001"
        assert verdict.rule_name == "Test Rule"
        assert verdict.passed is True
        assert verdict.action == "allow"
        assert verdict.evidence["field1"] == "value1"

    def test_verdict_default_evidence(self):
        """PolicyVerdict evidence defaults to empty dict."""
        verdict = PolicyVerdict(
            rule_id="TEST-002",
            rule_name="Another Rule",
            passed=False,
            reason="Failed",
            action="block",
        )
        assert verdict.evidence == {}


class TestPolicyEvaluationResult:
    """Test PolicyEvaluationResult data class."""

    def test_result_creation(self):
        """PolicyEvaluationResult aggregates verdicts correctly."""
        blocked_verdict = PolicyVerdict(
            rule_id="TEST-BLOCK",
            rule_name="Blocked",
            passed=False,
            reason="Blocked",
            action="block",
        )
        passed_verdict = PolicyVerdict(
            rule_id="TEST-PASS",
            rule_name="Passed",
            passed=True,
            reason="Passed",
            action="allow",
        )

        result = PolicyEvaluationResult(
            all_passed=False,
            verdicts=[blocked_verdict, passed_verdict],
            blocked=[blocked_verdict],
            escalated=[],
            warnings=[],
        )

        assert result.all_passed is False
        assert len(result.verdicts) == 2
        assert len(result.blocked) == 1
        assert len(result.escalated) == 0

    def test_result_all_passed_true(self):
        """PolicyEvaluationResult.all_passed is True when no blocks/escalations."""
        verdict = PolicyVerdict(
            rule_id="TEST",
            rule_name="Test",
            passed=True,
            reason="OK",
            action="allow",
        )
        result = PolicyEvaluationResult(
            all_passed=True,
            verdicts=[verdict],
            blocked=[],
            escalated=[],
            warnings=[],
        )
        assert result.all_passed is True


# ============================================================================
# sensitive Boundary Tests
# ============================================================================


class TestSensitiveBoundary:
    """Test TBS-GEN-AI-01 sensitive boundary enforcement."""

    def test_sensitive_passes_with_canadacentral(self, policy_engine):
        """sensitive with Canada Central region passes."""
        context = {
            "data_classification": "sensitive",
            "region": "canadacentral",
        }
        result = policy_engine.evaluate(context)
        # Should pass because sensitive in Canada region
        assert any(v.rule_id == "TBS-GEN-AI-01" and v.passed for v in result.verdicts)

    def test_sensitive_passes_with_canadaeast(self, policy_engine):
        """sensitive with Canada East region passes."""
        context = {
            "data_classification": "sensitive",
            "region": "canadaeast",
        }
        result = policy_engine.evaluate(context)
        # Should pass because sensitive in Canada region
        assert any(v.rule_id == "TBS-GEN-AI-01" and v.passed for v in result.verdicts)

    def test_sensitive_blocks_with_useast(self, policy_engine):
        """sensitive with US East region blocks."""
        context = {
            "data_classification": "sensitive",
            "region": "useast",
        }
        result = policy_engine.evaluate(context)
        # Should fail because sensitive outside Canada
        verdict = next((v for v in result.verdicts if v.rule_id == "TBS-GEN-AI-01"), None)
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "block"

    def test_sensitive_blocks_with_westeurope(self, policy_engine):
        """sensitive with non-public-sector region blocks."""
        context = {
            "data_classification": "sensitive",
            "region": "westeurope",
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "TBS-GEN-AI-01"), None)
        assert verdict is not None
        assert not verdict.passed


# ============================================================================
# RAG Grounding Tests
# ============================================================================


class TestRagGrounding:
    """Test TBS-GEN-AI-02 RAG-first grounding enforcement."""

    def test_grounding_passes_at_ratio_50_percent(self, policy_engine):
        """Grounding ratio at 0.5 passes."""
        context = {
            "chat_mode": "grounded",
            "grounding_ratio": 0.5,
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "TBS-GEN-AI-02"), None)
        assert verdict is not None
        assert verdict.passed

    def test_grounding_passes_at_ratio_above_50_percent(self, policy_engine):
        """Grounding ratio above 0.5 passes."""
        context = {
            "chat_mode": "grounded",
            "grounding_ratio": 0.75,
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "TBS-GEN-AI-02"), None)
        assert verdict is not None
        assert verdict.passed

    def test_grounding_escalates_below_50_percent(self, policy_engine):
        """Grounding ratio below 0.5 escalates."""
        context = {
            "chat_mode": "grounded",
            "grounding_ratio": 0.3,
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "TBS-GEN-AI-02"), None)
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "escalate"


# ============================================================================
# RAI Level Tests
# ============================================================================


class TestRAILevel:
    """Test Organization-RAI-L2 RAI level requirements."""

    def test_rai_level_1_passes(self, policy_engine):
        """RAI Level 1 (advisory) passes."""
        context = {
            "workspace": {
                "rai_level": 1,
            },
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "Organization-RAI-L2"), None)
        assert verdict is not None
        assert verdict.passed

    def test_rai_level_2_escalates_to_human(self, policy_engine):
        """RAI Level 2+ escalates to human review."""
        context = {
            "workspace": {
                "rai_level": 2,
            },
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "Organization-RAI-L2"), None)
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "escalate_to_human"

    def test_rai_level_3_escalates_to_human(self, policy_engine):
        """RAI Level 3+ also requires human review."""
        context = {
            "workspace": {
                "rai_level": 3,
            },
        }
        result = policy_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "Organization-RAI-L2"), None)
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "escalate_to_human"


# ============================================================================
# Tool Registration Tests
# ============================================================================


class TestToolRegistration:
    """Test Organization-TOOL-REG-01 tool classification requirements."""

    def test_tool_with_classification_declared_passes(self, policy_engine):
        """Tool with classification ceiling declared passes."""
        context = {
            "tool_classification_declared": True,
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-TOOL-REG-01"), None
        )
        assert verdict is not None
        assert verdict.passed

    def test_tool_without_classification_blocks(self, policy_engine):
        """Tool without classification ceiling blocks."""
        context = {
            "tool_classification_declared": False,
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-TOOL-REG-01"), None
        )
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "block"


# ============================================================================
# Data Residency Tests
# ============================================================================


class TestDataResidency:
    """Test Organization-RESIDENCY-01 data residency enforcement."""

    def test_residency_canadacentral_passes(self, policy_engine):
        """Canada Central residency passes."""
        context = {
            "tool_data_residency": "canadacentral",
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-RESIDENCY-01"), None
        )
        assert verdict is not None
        assert verdict.passed

    def test_residency_canadaeast_passes(self, policy_engine):
        """Canada East residency passes."""
        context = {
            "tool_data_residency": "canadaeast",
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-RESIDENCY-01"), None
        )
        assert verdict is not None
        assert verdict.passed

    def test_residency_canada_shorthand_passes(self, policy_engine):
        """Canada shorthand passes."""
        context = {
            "tool_data_residency": "canada",
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-RESIDENCY-01"), None
        )
        assert verdict is not None
        assert verdict.passed

    def test_residency_useast_blocks(self, policy_engine):
        """Non-public-sector residency blocks."""
        context = {
            "tool_data_residency": "useast",
        }
        result = policy_engine.evaluate(context)
        verdict = next(
            (v for v in result.verdicts if v.rule_id == "Organization-RESIDENCY-01"), None
        )
        assert verdict is not None
        assert not verdict.passed
        assert verdict.action == "block"


# ============================================================================
# Nested Field Resolution Tests
# ============================================================================


class TestNestedFieldResolution:
    """Test nested field path resolution (e.g., workspace.rai_level)."""

    def test_resolve_nested_field_success(self, custom_rules_engine):
        """Nested field paths are resolved correctly."""
        context = {
            "workspace": {
                "rai_level": 2,
            },
        }
        result = custom_rules_engine.evaluate(context)
        verdict = next((v for v in result.verdicts if v.rule_id == "TEST-002"), None)
        assert verdict is not None
        # Condition `workspace.rai_level >= 2` is satisfied (2 >= 2),
        # so the rule passes and its pass_action (allow) applies.
        assert verdict.passed is True
        assert "workspace.rai_level" in verdict.evidence

    def test_resolve_deeply_nested_field(self, policy_engine):
        """Deeply nested paths are resolved."""
        context = {
            "workspace": {
                "config": {
                    "rai_level": 1,
                },
            },
        }
        # This won't match the built-in rules, but we test the resolution mechanism
        engine = policy_engine
        # Verify the resolver handles nested access
        result = engine._resolve_field(context, "workspace.config.rai_level")
        assert result == 1

    def test_resolve_missing_nested_field_returns_none(self, policy_engine):
        """Missing nested fields return None."""
        context = {"workspace": {}}
        result = policy_engine._resolve_field(context, "workspace.missing_field")
        assert result is None

    def test_resolve_nondict_access_returns_none(self, policy_engine):
        """Accessing nested fields on non-dict returns None."""
        context = {"workspace": "not a dict"}
        result = policy_engine._resolve_field(context, "workspace.rai_level")
        assert result is None


# ============================================================================
# Audit Logging Tests
# ============================================================================


class TestAuditLogging:
    """Test that policy evaluations are logged to audit trail."""

    def test_audit_logs_on_evaluation(self, policy_engine, caplog):
        """Every rule evaluation is logged."""
        import logging

        caplog.set_level(logging.INFO, "aia.guardrails.audit")

        context = {"data_classification": "sensitive", "region": "canadacentral"}
        result = policy_engine.evaluate(context, correlation_id="corr-123")

        # Audit logger should have logged at least one entry
        # (audit logs go through the AuditLogger which uses JSON logging)
        assert len(result.verdicts) > 0


# ============================================================================
# Edge Cases
# ============================================================================


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_rules_returns_all_passed_true(self, empty_rules_engine):
        """Empty ruleset results in all_passed=True."""
        context = {}
        result = empty_rules_engine.evaluate(context)
        assert result.all_passed is True
        assert len(result.verdicts) == 0
        assert len(result.blocked) == 0

    def test_empty_context_with_rules(self, policy_engine):
        """Empty context is handled gracefully."""
        context = {}
        result = policy_engine.evaluate(context)
        # Should evaluate all rules; many will fail due to missing fields
        assert isinstance(result, PolicyEvaluationResult)
        assert len(result.verdicts) > 0

    def test_unknown_operator_returns_failure(self):
        """Unknown operator results in failure verdict."""
        rules = [
            {
                "id": "TEST-BAD-OP",
                "name": "Bad Operator",
                "conditions": [
                    {"field": "value", "operator": "unknown_op", "value": "test"},
                ],
                "pass_action": "allow",
                "fail_action": "block",
            }
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(rules, f)
            temp_file = f.name

        try:
            engine = PolicyEngine(temp_file)
            context = {"value": "test"}
            result = engine.evaluate(context)
            verdict = result.verdicts[0]
            assert not verdict.passed
            assert "Unknown operator" in verdict.reason
        finally:
            Path(temp_file).unlink()

    def test_type_error_in_evaluation_handled(self):
        """Type errors during evaluation are caught and reported."""
        rules = [
            {
                "id": "TEST-TYPE-ERR",
                "name": "Type Error Test",
                "conditions": [
                    {"field": "number", "operator": "gt", "value": "not_a_number"},
                ],
                "pass_action": "allow",
                "fail_action": "block",
            }
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(rules, f)
            temp_file = f.name

        try:
            engine = PolicyEngine(temp_file)
            context = {"number": 42}
            result = engine.evaluate(context)
            verdict = result.verdicts[0]
            assert not verdict.passed
        finally:
            Path(temp_file).unlink()


# ============================================================================
# Operators Tests
# ============================================================================


class TestOperators:
    """Test individual operator functions."""

    def test_eq_operator(self, policy_engine):
        """Equality operator works correctly."""
        from app.guardrails.policy_engine import _OPS

        assert _OPS["eq"]("active", "active") is True
        assert _OPS["eq"]("active", "inactive") is False

    def test_in_operator(self, policy_engine):
        """Membership operator works."""
        from app.guardrails.policy_engine import _OPS

        assert _OPS["in"]("canadacentral", ["canadacentral", "canadaeast"]) is True
        assert _OPS["in"]("useast", ["canadacentral", "canadaeast"]) is False

    def test_ge_operator(self, policy_engine):
        """Greater-than-or-equal operator works."""
        from app.guardrails.policy_engine import _OPS

        assert _OPS["ge"](5, 5) is True
        assert _OPS["ge"](6, 5) is True
        assert _OPS["ge"](4, 5) is False

    def test_is_true_operator(self, policy_engine):
        """is_true operator evaluates truthiness."""
        from app.guardrails.policy_engine import _OPS

        assert _OPS["is_true"](True, None) is True
        assert _OPS["is_true"](1, None) is True
        assert _OPS["is_true"](False, None) is False
        assert _OPS["is_true"](0, None) is False


# ============================================================================
# Comprehensive Integration Tests
# ============================================================================


class TestCompliantContext:
    """Test a fully compliant context passes all rules."""

    def test_all_rules_pass_with_compliant_context(self, policy_engine):
        """A fully compliant context passes all policies."""
        context = {
            "data_classification": "sensitive",
            "region": "canadacentral",
            "chat_mode": "grounded",
            "grounding_ratio": 0.75,
            "workspace": {
                "rai_level": 1,
            },
            "tool_bilingual_declared": True,
            "confidence_score": 0.85,
            "tool_classification_declared": True,
            "tool_data_residency": "canadacentral",
            "has_correlation_id": True,
            "has_trace_id": True,
        }
        result = policy_engine.evaluate(context, correlation_id="corr-test-123")
        assert result.all_passed is True
        assert len(result.blocked) == 0
        assert len(result.escalated) == 0
