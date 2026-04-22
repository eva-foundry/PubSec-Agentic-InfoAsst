from __future__ import annotations

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    """Authenticated user context extracted from Entra ID token and RBAC."""

    user_id: str = Field(description="Entra ID object identifier")
    email: str
    name: str
    role: str = Field(description="RBAC role: 'reader', 'contributor', or 'admin'")
    portal_access: list[str] = Field(
        default_factory=list,
        description="Portals the user can access: 'self-service', 'admin', 'ops'",
    )
    workspace_grants: list[str] = Field(
        default_factory=list,
        description="Workspace IDs the user has been granted access to",
    )
    data_classification_level: str = Field(
        default="unclassified",
        description="Highest classification: 'unclassified', 'restricted', 'sensitive'",
    )
    language: str = Field(default="en", description="Preferred language: 'en' or 'fr'")
