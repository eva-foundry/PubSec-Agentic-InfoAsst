"""In-memory workspace store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import Workspace


class WorkspaceStore:
    """In-memory workspace store with seed data for the 5 workspace archetypes."""

    def __init__(self) -> None:
        self._workspaces: dict[str, Workspace] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with 5 workspaces matching demo user workspace_grants."""
        seed = [
            Workspace(
                id="ws-oas-act",
                name="OAS Act Legislation",
                name_fr="Legislation sur la Loi sur la SV",
                description="Protected B workspace for Old Age Security Act legislative analysis with hierarchical chunking and cross-references.",
                description_fr="Espace de travail Protege B pour l'analyse legislative de la Loi sur la securite de la vieillesse avec decoupage hierarchique et references croisees.",
                type="legislation",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_b",
                document_capacity=10,
                document_count=4,
                monthly_cost=4800.00,
                cost_centre="CC-OAS01",
                created_at="2025-06-01T00:00:00Z",
                updated_at="2026-04-01T00:00:00Z",
            ),
            Workspace(
                id="ws-ei-juris",
                name="EI Jurisprudence",
                name_fr="Jurisprudence de l'AE",
                description="Protected B workspace for Employment Insurance tribunal decisions with citation graphs and court hierarchy ranking.",
                description_fr="Espace de travail Protege B pour les decisions du tribunal de l'assurance-emploi avec graphes de citations et classement hierarchique des tribunaux.",
                type="case_law",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_b",
                document_capacity=15,
                document_count=6,
                monthly_cost=3200.00,
                cost_centre="CC-EIJ01",
                created_at="2025-07-15T00:00:00Z",
                updated_at="2026-03-20T00:00:00Z",
            ),
            Workspace(
                id="ws-bdm-km",
                name="BDM Knowledge Management",
                name_fr="Gestion des connaissances BPM",
                description="Protected A workspace for Benefits Delivery Modernization document search, Q&A, and topic modelling.",
                description_fr="Espace de travail Protege A pour la recherche de documents, questions-reponses et modelisation de sujets de la Modernisation de la prestation des prestations.",
                type="knowledge_mgmt",
                status="active",
                owner_id="demo-carol",
                data_classification="protected_a",
                document_capacity=20,
                document_count=12,
                monthly_cost=2000.00,
                cost_centre="CC-BDM01",
                created_at="2025-08-01T00:00:00Z",
                updated_at="2026-04-05T00:00:00Z",
            ),
            Workspace(
                id="ws-faq",
                name="General FAQ",
                name_fr="FAQ generale",
                description="Unclassified workspace for general Q&A, basic analytics, and export tools.",
                description_fr="Espace de travail non classifie pour questions-reponses generales, analytique de base et outils d'exportation.",
                type="faq",
                status="active",
                owner_id="demo-carol",
                data_classification="unclassified",
                document_capacity=25,
                document_count=1,
                monthly_cost=1200.00,
                cost_centre="CC-FAQ01",
                created_at="2025-09-01T00:00:00Z",
                updated_at="2026-04-10T00:00:00Z",
            ),
            Workspace(
                id="ws-sandbox",
                name="Sandbox / Training",
                name_fr="Bac a sable / Formation",
                description="Unclassified sandbox workspace for experimentation and training. All features enabled, no SLA.",
                description_fr="Espace bac a sable non classifie pour l'experimentation et la formation. Toutes les fonctionnalites activees, pas d'ENS.",
                type="sandbox",
                status="active",
                owner_id="demo-carol",
                data_classification="unclassified",
                document_capacity=50,
                document_count=3,
                monthly_cost=0.00,
                cost_centre="CC-SBX01",
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
