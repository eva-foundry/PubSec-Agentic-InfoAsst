"""Compliance-as-code: executable TBS/ESDC policy rules evaluated per request.

Every request passes through the policy engine before a response is returned.
Rules are loaded from a JSON config file and evaluated against the request
context. Verdicts are logged to the audit trail.

ITSG-33: CM-6 (Configuration Settings), CM-7 (Least Functionality)
"""

from __future__ import annotations

import json
import logging
import operator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .audit import AuditLogger

logger = logging.getLogger("eva.guardrails.policy_engine")
_audit = AuditLogger()

# Default rules file path
_DEFAULT_RULES_PATH = Path(__file__).parent / "policy_rules.json"


@dataclass
class PolicyVerdict:
    """Result of evaluating a single policy rule."""

    rule_id: str
    rule_name: str
    passed: bool
    reason: str
    action: str  # "allow" | "block" | "escalate" | "escalate_to_human" | "warn"
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass
class PolicyEvaluationResult:
    """Aggregated result of evaluating all policy rules."""

    all_passed: bool
    verdicts: list[PolicyVerdict]
    blocked: list[PolicyVerdict]
    escalated: list[PolicyVerdict]
    warnings: list[PolicyVerdict]


# Supported operators for rule conditions
_OPS = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "ge": operator.ge,
    "lt": operator.lt,
    "le": operator.le,
    "in": lambda a, b: a in b,
    "not_in": lambda a, b: a not in b,
    "contains": lambda a, b: b in a,
    "is_true": lambda a, _: bool(a),
    "is_false": lambda a, _: not bool(a),
}


class PolicyEngine:
    """Evaluates compliance rules against request context.

    Rules are loaded from JSON and evaluated at runtime. Each rule
    specifies a field path, operator, expected value, and actions
    for pass/fail.
    """

    def __init__(self, rules_path: str | Path | None = None):
        self.rules: list[dict] = []
        rules_file = Path(rules_path) if rules_path else _DEFAULT_RULES_PATH

        if rules_file.exists():
            try:
                self.rules = json.loads(rules_file.read_text(encoding="utf-8"))
                logger.info("Loaded %d policy rules from %s", len(self.rules), rules_file)
            except (json.JSONDecodeError, OSError) as exc:
                logger.error("Failed to load policy rules from %s: %s", rules_file, exc)
        else:
            logger.warning(
                "Policy rules file not found: %s — running with empty ruleset", rules_file
            )

    def evaluate(self, context: dict[str, Any], correlation_id: str = "") -> PolicyEvaluationResult:
        """Run all rules against the provided context."""
        verdicts: list[PolicyVerdict] = []
        blocked: list[PolicyVerdict] = []
        escalated: list[PolicyVerdict] = []
        warnings: list[PolicyVerdict] = []

        for rule in self.rules:
            verdict = self._evaluate_rule(rule, context)
            verdicts.append(verdict)

            if not verdict.passed:
                if verdict.action == "block":
                    blocked.append(verdict)
                elif verdict.action in ("escalate", "escalate_to_human"):
                    escalated.append(verdict)
                elif verdict.action == "warn":
                    warnings.append(verdict)

            # Audit every rule evaluation
            _audit.log_action(
                subject=f"policy-{verdict.rule_id}",
                actor="policy-engine",
                action="evaluate",
                purpose=verdict.rule_name,
                resource=f"context-keys:{','.join(sorted(context.keys())[:5])}",
                policy_decision=f"{'pass' if verdict.passed else verdict.action}:{verdict.reason}",
                correlation_id=correlation_id,
                trace_id="",
            )

        all_passed = len(blocked) == 0 and len(escalated) == 0

        return PolicyEvaluationResult(
            all_passed=all_passed,
            verdicts=verdicts,
            blocked=blocked,
            escalated=escalated,
            warnings=warnings,
        )

    def _evaluate_rule(self, rule: dict, context: dict[str, Any]) -> PolicyVerdict:
        """Evaluate a single rule against context."""
        rule_id = rule.get("id", "UNKNOWN")
        rule_name = rule.get("name", "Unnamed rule")
        conditions = rule.get("conditions", [])
        pass_action = rule.get("pass_action", "allow")
        fail_action = rule.get("fail_action", "block")

        evidence: dict[str, Any] = {}

        for condition in conditions:
            field_path = condition.get("field", "")
            op_name = condition.get("operator", "eq")
            expected = condition.get("value")

            # Resolve nested field paths (e.g., "workspace.aicm_level")
            actual = self._resolve_field(context, field_path)
            evidence[field_path] = {"actual": actual, "expected": expected, "operator": op_name}

            op_func = _OPS.get(op_name)
            if op_func is None:
                return PolicyVerdict(
                    rule_id=rule_id,
                    rule_name=rule_name,
                    passed=False,
                    reason=f"Unknown operator: {op_name}",
                    action=fail_action,
                    evidence=evidence,
                )

            try:
                if not op_func(actual, expected):
                    return PolicyVerdict(
                        rule_id=rule_id,
                        rule_name=rule_name,
                        passed=False,
                        reason=(
                            f"Condition failed: {field_path} {op_name} {expected} "
                            f"(actual: {actual})"
                        ),
                        action=fail_action,
                        evidence=evidence,
                    )
            except (TypeError, ValueError) as exc:
                return PolicyVerdict(
                    rule_id=rule_id,
                    rule_name=rule_name,
                    passed=False,
                    reason=f"Evaluation error on {field_path}: {exc}",
                    action=fail_action,
                    evidence=evidence,
                )

        return PolicyVerdict(
            rule_id=rule_id,
            rule_name=rule_name,
            passed=True,
            reason="All conditions met",
            action=pass_action,
            evidence=evidence,
        )

    @staticmethod
    def _resolve_field(context: dict[str, Any], field_path: str) -> Any:
        """Resolve a dotted field path in the context dict."""
        current = context
        for part in field_path.split("."):
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        return current
