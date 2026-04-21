"""In-memory client and interview store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.admin import Client, Interview


class ClientStore:
    """In-memory store for business clients and onboarding interviews."""

    def __init__(self) -> None:
        self._clients: dict[str, Client] = {}
        self._interviews: dict[str, Interview] = {}
        self._seed()

    # ------------------------------------------------------------------
    # Seed data
    # ------------------------------------------------------------------

    def _seed(self) -> None:
        """Pre-populate with demo clients matching the walkthrough story."""
        seed_clients = [
            Client(
                id="client-bdm",
                org_name="Benefits Delivery Modernization",
                entra_group_id="grp-bdm-001",
                billing_contact="bdm-finance@example.org",
                data_classification_level="sensitive",
                onboarded_at="2026-01-15T00:00:00Z",
                status="active",
                workspace_ids=["ws-oas-act", "ws-ei-juris", "ws-bdm-km"],
            ),
            Client(
                id="client-sco",
                org_name="Service Canada Operations",
                entra_group_id="grp-sco-001",
                billing_contact="sco-admin@example.org",
                data_classification_level="unclassified",
                onboarded_at="2026-03-01T00:00:00Z",
                status="active",
                workspace_ids=["ws-faq"],
            ),
        ]
        for c in seed_clients:
            self._clients[c.id] = c

    # ------------------------------------------------------------------
    # Client CRUD
    # ------------------------------------------------------------------

    def create_client(self, client: Client) -> Client:
        """Store a new client."""
        self._clients[client.id] = client
        return client

    def list_clients(self) -> list[Client]:
        """Return all clients."""
        return list(self._clients.values())

    def get_client(self, client_id: str) -> Client | None:
        """Look up a client by ID."""
        return self._clients.get(client_id)

    def update_client(self, client_id: str, updates: dict) -> Client | None:
        """Partially update a client. Returns None if not found."""
        cl = self._clients.get(client_id)
        if cl is None:
            return None
        data = cl.model_dump()
        data.update(updates)
        updated = Client(**data)
        self._clients[client_id] = updated
        return updated

    # ------------------------------------------------------------------
    # Interview CRUD
    # ------------------------------------------------------------------

    def create_interview(self, interview: Interview) -> Interview:
        """Store a new onboarding interview."""
        self._interviews[interview.id] = interview
        return interview

    def get_interviews_by_client(self, client_id: str) -> list[Interview]:
        """Return all interviews for a specific client."""
        return [iv for iv in self._interviews.values() if iv.client_id == client_id]

    def get_interview(self, interview_id: str) -> Interview | None:
        """Look up an interview by ID."""
        return self._interviews.get(interview_id)
