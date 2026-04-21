"""In-memory team member store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import TeamMember


class TeamStore:
    """In-memory store for team membership, keyed by booking_id."""

    def __init__(self) -> None:
        # booking_id -> list of members
        self._members: dict[str, list[TeamMember]] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with team members matching the demo walkthrough story."""
        self._members["bk-alice-oas"] = [
            TeamMember(
                id="tm-alice-1",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                email="alice@example.org",
                name="Alice Chen",
                role="admin",
                added_at="2026-02-01T00:00:00Z",
                added_by="demo-alice",
            ),
            TeamMember(
                id="tm-bob-1",
                workspace_id="ws-oas-act",
                user_id="demo-bob",
                email="bob@example.org",
                name="Bob Wilson",
                role="reader",
                added_at="2026-02-01T00:00:00Z",
                added_by="demo-alice",
            ),
            TeamMember(
                id="tm-eve-1",
                workspace_id="ws-oas-act",
                user_id="demo-eve",
                email="eve@example.org",
                name="Eve Tremblay",
                role="contributor",
                added_at="2026-02-05T00:00:00Z",
                added_by="demo-alice",
            ),
        ]
        self._members["bk-eve-ei"] = [
            TeamMember(
                id="tm-eve-2",
                workspace_id="ws-ei-juris",
                user_id="demo-eve",
                email="eve@example.org",
                name="Eve Tremblay",
                role="admin",
                added_at="2026-03-15T00:00:00Z",
                added_by="demo-eve",
            ),
            TeamMember(
                id="tm-alice-2",
                workspace_id="ws-ei-juris",
                user_id="demo-alice",
                email="alice@example.org",
                name="Alice Chen",
                role="reader",
                added_at="2026-03-16T00:00:00Z",
                added_by="demo-eve",
            ),
        ]

    def list_by_booking(self, booking_id: str) -> list[TeamMember]:
        """List all members for a booking."""
        return list(self._members.get(booking_id, []))

    def add(self, booking_id: str, member: TeamMember) -> TeamMember:
        """Add a member to a booking's team."""
        if booking_id not in self._members:
            self._members[booking_id] = []
        self._members[booking_id].append(member)
        return member

    def get(self, booking_id: str, user_id: str) -> TeamMember | None:
        """Find a specific member by user_id within a booking."""
        for m in self._members.get(booking_id, []):
            if m.user_id == user_id:
                return m
        return None

    def update_role(self, booking_id: str, user_id: str, role: str) -> TeamMember | None:
        """Change a member's role. Returns None if not found."""
        members = self._members.get(booking_id, [])
        for i, m in enumerate(members):
            if m.user_id == user_id:
                data = m.model_dump()
                data["role"] = role
                updated = TeamMember(**data)
                members[i] = updated
                return updated
        return None

    def remove(self, booking_id: str, user_id: str) -> bool:
        """Remove a member from a booking. Returns True if they existed."""
        members = self._members.get(booking_id, [])
        for i, m in enumerate(members):
            if m.user_id == user_id:
                members.pop(i)
                return True
        return False

    def is_admin(self, booking_id: str, user_id: str) -> bool:
        """Check if a user is an admin on this booking's team."""
        member = self.get(booking_id, user_id)
        return member is not None and member.role == "admin"
