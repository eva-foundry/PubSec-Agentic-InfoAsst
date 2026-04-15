from __future__ import annotations

import json
import logging
from datetime import datetime, timezone


logger = logging.getLogger("eva.guardrails.audit")


class AuditLogger:
    """Logs agent actions for forensic audit trail.

    Emits structured JSON log entries compatible with OpenTelemetry
    semantic conventions.  In production these are routed to Azure
    Log Analytics via the OTEL collector.
    """

    def log_action(
        self,
        subject: str,
        actor: str,
        action: str,
        purpose: str,
        resource: str,
        policy_decision: str,
        correlation_id: str,
        trace_id: str,
    ) -> None:
        """Log a structured audit entry."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "audit.subject": subject,
            "audit.actor": actor,
            "audit.action": action,
            "audit.purpose": purpose,
            "audit.resource": resource,
            "audit.policy_decision": policy_decision,
            "correlation_id": correlation_id,
            "trace_id": trace_id,
        }
        logger.info(json.dumps(entry, ensure_ascii=False))
