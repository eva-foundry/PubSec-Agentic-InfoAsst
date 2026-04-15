"""In-memory workspace store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import Workspace


class WorkspaceStore:
    """In-memory workspace store with seed data for the 5 workspace archetypes."""

    def __init__(self) -> None:
        self._workspaces: dict[str, Workspace] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with 5 workspace types matching the EVA DA plan."""
        seed = [
            Workspace(
                id="ws-protb",
                name="Protected B Environment",
                name_fr="Environnement Protege B",
                description="Secure workspace for Protected B classified documents and analysis.",
                description_fr="Espace de travail securise pour les documents et analyses classifies Protege B.",
                type="restricted",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_b",
                document_capacity=1000,
                document_count=234,
                monthly_cost=5000.00,
                cost_centre="CC-PB01",
                created_at="2025-06-01T00:00:00Z",
                updated_at="2026-04-01T00:00:00Z",
            ),
            Workspace(
                id="ws-ocr",
                name="OCR Processing Suite",
                name_fr="Suite de traitement ROC",
                description="Document digitization with OCR, layout analysis, and form recognition.",
                description_fr="Numerisation de documents avec ROC, analyse de mise en page et reconnaissance de formulaires.",
                type="standard",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_a",
                document_capacity=2000,
                document_count=876,
                monthly_cost=3500.00,
                cost_centre="CC-OCR1",
                created_at="2025-07-15T00:00:00Z",
                updated_at="2026-03-20T00:00:00Z",
            ),
            Workspace(
                id="ws-translation",
                name="Translation Hub",
                name_fr="Centre de traduction",
                description="EN/FR translation services with terminology management and review workflows.",
                description_fr="Services de traduction EN/FR avec gestion terminologique et flux de revision.",
                type="standard",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_a",
                document_capacity=500,
                document_count=312,
                monthly_cost=2000.00,
                cost_centre="CC-TR01",
                created_at="2025-08-01T00:00:00Z",
                updated_at="2026-04-05T00:00:00Z",
            ),
            Workspace(
                id="ws-summarization",
                name="Summarization Studio",
                name_fr="Studio de resume",
                description="Multi-document summarization with configurable detail levels and citation tracking.",
                description_fr="Resume multi-documents avec niveaux de detail configurables et suivi des citations.",
                type="premium",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_a",
                document_capacity=1500,
                document_count=543,
                monthly_cost=4000.00,
                cost_centre="CC-SM01",
                created_at="2025-09-01T00:00:00Z",
                updated_at="2026-04-10T00:00:00Z",
            ),
            Workspace(
                id="ws-general",
                name="General Purpose AI Lab",
                name_fr="Laboratoire IA general",
                description="Sandbox workspace for experimentation, prototyping, and general-purpose RAG.",
                description_fr="Espace bac a sable pour experimentation, prototypage et RAG general.",
                type="sandbox",
                status="active",
                owner_id="demo-carol",
                data_classification="unclassified",
                document_capacity=200,
                document_count=45,
                monthly_cost=800.00,
                cost_centre="CC-GEN1",
                created_at="2025-03-01T00:00:00Z",
                updated_at="2026-03-15T00:00:00Z",
            ),
        ]
        for ws in seed:
            self._workspaces[ws.id] = ws

    def list(self, workspace_grants: list[str]) -> list[Workspace]:
        """List workspaces filtered by user grants. 'all' returns everything."""
        if "all" in workspace_grants:
            return list(self._workspaces.values())
        return [ws for ws in self._workspaces.values() if ws.id in workspace_grants]

    def get(self, workspace_id: str) -> Workspace | None:
        """Get a single workspace by ID."""
        return self._workspaces.get(workspace_id)

    def create(self, workspace: Workspace) -> Workspace:
        """Add a workspace to the store."""
        self._workspaces[workspace.id] = workspace
        return workspace

    def update(self, workspace_id: str, updates: dict) -> Workspace | None:
        """Partially update a workspace. Returns None if not found."""
        ws = self._workspaces.get(workspace_id)
        if ws is None:
            return None
        data = ws.model_dump()
        data.update(updates)
        updated = Workspace(**data)
        self._workspaces[workspace_id] = updated
        return updated
