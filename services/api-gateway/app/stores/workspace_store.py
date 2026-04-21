"""In-memory workspace store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import Workspace

# ---------------------------------------------------------------------------
# Per-workspace business prompts (seed data)
# ---------------------------------------------------------------------------

_BUSINESS_PROMPTS: dict[str, str] = {
    "ws-oas-act": (
        "You are assisting policy analysts navigating the Old Age Security Act "
        "(R.S.C., 1985, c. O-9) and its regulations. Users need precise section "
        "references. When citing eligibility criteria, always reference the specific "
        "subsection (e.g., s. 3(1), s. 3(2)). Distinguish between full pension "
        "(40+ years residency) and partial pension (10-39 years, pro-rata "
        'calculation). When discussing residency, specify "after age 18" as '
        "required by the Act. Cross-reference the OAS Regulations (C.R.C., c. 1246) "
        "for evidence requirements."
    ),
    "ws-ei-juris": (
        "You are assisting Employment Insurance officers finding tribunal decisions "
        "relevant to specific claim scenarios. Prioritize the highest court level "
        "when multiple decisions address the same issue. Map each case to the "
        "relevant Employment Insurance Act provision (e.g., s. 7 qualifying period, "
        "s. 14 benefit rate). When multiple decisions conflict, surface the most "
        "recent from the highest authority. Use proper citation format: [YYYY] SST "
        "docket number for Social Security Tribunal decisions. Identify the ratio "
        "decidendi (key legal reasoning) in each case."
    ),
    "ws-bdm-km": (
        "You are assisting the Benefits Delivery Modernization team with knowledge "
        "management. Help users find relevant policies, procedures, and guidelines "
        "across the BDM document repository. Summarize key points concisely. Flag "
        "any documents that reference outdated processes or superseded policies."
    ),
    "ws-faq": (
        "You are a general FAQ assistant for AIA Domain Assistant. Answer common "
        "questions about workspace features, supported file types, booking "
        "processes, and team management. Keep answers clear and concise. Direct "
        "users to appropriate help resources when needed."
    ),
    "ws-sandbox": (
        "You are a training assistant in the AIA sandbox environment. Help users "
        "learn how to use the platform by answering questions about features, best "
        "practices, and workflows. This is a safe space for experimentation — "
        "encourage exploration."
    ),
}


# ---------------------------------------------------------------------------
# Shared Azure infrastructure config (MarcoSub real resources)
# ---------------------------------------------------------------------------

_INFRASTRUCTURE: dict[str, str] = {
    "search_service": "msub-aia-dev-search",
    "search_endpoint": "https://msub-aia-dev-search.search.windows.net",
    "storage_account": "msubevasharedaihbyya73s",
    "cosmos_account": "msub-sandbox-cosmos-free",
    "openai_service": "msub-aia-dev-openai",
    "openai_deployment": "chat-default",
    "embedding_deployment": "embeddings-default",
    "container_environment": "msub-sandbox-env",
    "key_vault": "msubsandkv202603031449",
    "container_registry": "msubsandacr202603031449",
    "resource_group": "AIA-Sandbox-dev",
    "location": "canadacentral",
}


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
                description=(
                    "sensitive workspace for Old Age Security Act legislative analysis "
                    "with hierarchical chunking and cross-references."
                ),
                description_fr=(
                    "Espace de travail Protege B pour l'analyse legislative de la Loi "
                    "sur la securite de la vieillesse avec decoupage hierarchique et "
                    "references croisees."
                ),
                type="legislation",
                status="active",
                owner_id="demo-carol",
                data_classification="sensitive",
                document_capacity=10,
                document_count=4,
                monthly_cost=4800.00,
                cost_centre="CC-OAS01",
                infrastructure=_INFRASTRUCTURE,
                created_at="2025-06-01T00:00:00Z",
                updated_at="2026-04-01T00:00:00Z",
            ),
            Workspace(
                id="ws-ei-juris",
                name="EI Jurisprudence",
                name_fr="Jurisprudence de l'AE",
                description=(
                    "sensitive workspace for Employment Insurance tribunal decisions "
                    "with citation graphs and court hierarchy ranking."
                ),
                description_fr=(
                    "Espace de travail Protege B pour les decisions du tribunal de "
                    "l'assurance-emploi avec graphes de citations et classement "
                    "hierarchique des tribunaux."
                ),
                type="case_law",
                status="active",
                owner_id="demo-carol",
                data_classification="sensitive",
                document_capacity=15,
                document_count=6,
                monthly_cost=3200.00,
                cost_centre="CC-EIJ01",
                infrastructure=_INFRASTRUCTURE,
                created_at="2025-07-15T00:00:00Z",
                updated_at="2026-03-20T00:00:00Z",
            ),
            Workspace(
                id="ws-bdm-km",
                name="BDM Knowledge Management",
                name_fr="Gestion des connaissances BPM",
                description=(
                    "restricted workspace for Benefits Delivery Modernization document "
                    "search, Q&A, and topic modelling."
                ),
                description_fr=(
                    "Espace de travail Protege A pour la recherche de documents, "
                    "questions-reponses et modelisation de sujets de la Modernisation "
                    "de la prestation des prestations."
                ),
                type="knowledge_mgmt",
                status="active",
                owner_id="demo-carol",
                data_classification="restricted",
                document_capacity=20,
                document_count=12,
                monthly_cost=2000.00,
                cost_centre="CC-BDM01",
                infrastructure=_INFRASTRUCTURE,
                created_at="2025-08-01T00:00:00Z",
                updated_at="2026-04-05T00:00:00Z",
            ),
            Workspace(
                id="ws-faq",
                name="General FAQ",
                name_fr="FAQ generale",
                description=(
                    "Unclassified workspace for general Q&A, basic analytics, and export tools."
                ),
                description_fr=(
                    "Espace de travail non classifie pour questions-reponses generales, "
                    "analytique de base et outils d'exportation."
                ),
                type="faq",
                status="active",
                owner_id="demo-carol",
                data_classification="unclassified",
                document_capacity=25,
                document_count=1,
                monthly_cost=1200.00,
                cost_centre="CC-FAQ01",
                infrastructure=_INFRASTRUCTURE,
                created_at="2025-09-01T00:00:00Z",
                updated_at="2026-04-10T00:00:00Z",
            ),
            Workspace(
                id="ws-sandbox",
                name="Sandbox / Training",
                name_fr="Bac a sable / Formation",
                description=(
                    "Unclassified sandbox workspace for experimentation and training. "
                    "All features enabled, no SLA."
                ),
                description_fr=(
                    "Espace bac a sable non classifie pour l'experimentation et la formation. "
                    "Toutes les fonctionnalites activees, pas d'ENS."
                ),
                type="sandbox",
                status="active",
                owner_id="demo-carol",
                data_classification="unclassified",
                document_capacity=50,
                document_count=3,
                monthly_cost=0.00,
                cost_centre="CC-SBX01",
                infrastructure=_INFRASTRUCTURE,
                created_at="2025-03-01T00:00:00Z",
                updated_at="2026-03-15T00:00:00Z",
            ),
        ]
        for ws in seed:
            # Attach business prompt and initial history entry
            bp = _BUSINESS_PROMPTS.get(ws.id, "")
            ws_data = ws.model_dump()
            ws_data["business_prompt"] = bp
            ws_data["business_prompt_version"] = 1
            ws_data["business_prompt_history"] = (
                [
                    {
                        "version": 1,
                        "content": bp,
                        "author": "system",
                        "rationale": "Initial workspace business prompt",
                        "created_at": ws.created_at,
                    },
                ]
                if bp
                else []
            )
            self._workspaces[ws.id] = Workspace(**ws_data)

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
