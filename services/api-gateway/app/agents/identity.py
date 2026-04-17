"""Agent identity and delegation chain.

Every agent and tool in the EVA Agentic pipeline gets a distinct identity.
No shared service accounts — each identity carries its own scoped permissions
and participates in an auditable delegation chain.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal


@dataclass(frozen=True)
class AgentIdentity:
    """Immutable identity for an agent or tool instance.

    Each identity is unique per instantiation — even two instances of the
    same tool type get different ``agent_id`` values.
    """

    agent_id: str
    agent_type: Literal["orchestrator", "tool", "pipeline"]
    scoped_permissions: list[str]
    created_at: str  # ISO-8601


class DelegationChain:
    """Tracks parent-to-child delegation for audit and explainability.

    Every time an orchestrator delegates work to a tool or sub-agent,
    the delegation is recorded with a purpose string so the full chain
    can be reconstructed during post-hoc review.
    """

    def __init__(self) -> None:
        self._chain: list[dict] = []

    def delegate(self, parent_id: str, child_id: str, purpose: str) -> None:
        """Record a delegation from *parent_id* to *child_id*.

        Parameters
        ----------
        parent_id : str
            The ``agent_id`` of the delegating agent.
        child_id : str
            The ``agent_id`` of the agent receiving the delegation.
        purpose : str
            Human-readable description of why delegation occurred.
        """
        self._chain.append(
            {
                "parent_id": parent_id,
                "child_id": child_id,
                "purpose": purpose,
                "delegated_at": datetime.now(UTC).isoformat(),
            }
        )

    def get_chain(self) -> list[dict]:
        """Return the full delegation chain in chronological order."""
        return list(self._chain)

    def __len__(self) -> int:
        return len(self._chain)

    def __repr__(self) -> str:
        return f"DelegationChain(steps={len(self._chain)})"


def create_agent_identity(
    agent_type: Literal["orchestrator", "tool", "pipeline"],
    permissions: list[str] | None = None,
) -> AgentIdentity:
    """Factory function to create a new agent identity.

    Parameters
    ----------
    agent_type : str
        One of ``"orchestrator"``, ``"tool"``, or ``"pipeline"``.
    permissions : list[str] | None
        Scoped permissions for this agent. Defaults to an empty list.

    Returns
    -------
    AgentIdentity
        A new, unique agent identity.
    """
    return AgentIdentity(
        agent_id=f"agent-{agent_type[:3]}-{uuid.uuid4().hex[:12]}",
        agent_type=agent_type,
        scoped_permissions=permissions or [],
        created_at=datetime.now(UTC).isoformat(),
    )
