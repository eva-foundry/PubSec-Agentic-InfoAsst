"""Entra ID group → EVA role/portal/workspace mapping.

Group Object IDs are configured via environment variables so they
can differ per tenant without code changes.
"""

from __future__ import annotations

from ..config import settings

# Entra group object IDs (from env)
_ADMIN_GROUP = settings.entra_group_admin
_CONTRIBUTOR_GROUP = settings.entra_group_contributor
_READER_GROUP = settings.entra_group_reader
_OPS_GROUP = settings.entra_group_ops

# Portal access by group membership
_PORTAL_MAP: dict[str, list[str]] = {
    _ADMIN_GROUP: ["self-service", "admin", "ops"] if _ADMIN_GROUP else [],
    _OPS_GROUP: ["ops"] if _OPS_GROUP else [],
    _CONTRIBUTOR_GROUP: ["self-service"] if _CONTRIBUTOR_GROUP else [],
    _READER_GROUP: ["self-service"] if _READER_GROUP else [],
}


def resolve_role(groups: list[str]) -> str:
    """Map Entra group memberships to a single EVA role (highest wins)."""
    if _ADMIN_GROUP and _ADMIN_GROUP in groups:
        return "admin"
    if _CONTRIBUTOR_GROUP and _CONTRIBUTOR_GROUP in groups:
        return "contributor"
    return "reader"  # Default — least privilege


def resolve_portal_access(groups: list[str]) -> list[str]:
    """Determine which portals the user can access."""
    portals: set[str] = set()
    for group in groups:
        portals.update(_PORTAL_MAP.get(group, []))
    if not portals:
        portals.add("self-service")  # Minimum access
    return sorted(portals)


async def resolve_workspace_grants(oid: str, groups: list[str]) -> list[str]:
    """Resolve workspace access grants for a user.

    In production, this queries the workspace store for grants assigned
    to the user's OID or any of their groups. For now, returns empty
    list (workspace grants are checked at query time by the orchestrator).
    """
    # TODO: Query workspace_store.get_grants_for_user(oid, groups)
    # For now, workspace-level access is enforced by the orchestrator
    # checking user.workspace_grants against the requested workspace_id.
    return []
