"""Store singletons — in-memory (api_mock=true) or Azure-backed (api_mock=false).

The api_mock toggle is read from EVA_API_MOCK environment variable.
When true (default): all stores are in-memory with seed data.
When false: Cosmos DB for CRUD, Azure AI Search for vectors.

Azure-backed stores are async — routers that call them must await.
In-memory stores remain synchronous for backward compatibility, but
the router layer wraps calls uniformly via ``stores.compat.aio()``.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, cast

from ..config import get_settings
from ..guardrails.degradation import DegradationManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Determine mode
# ---------------------------------------------------------------------------

_settings = get_settings()
API_MOCK = _settings.api_mock

logger.info("Store mode: %s", "IN-MEMORY (mock)" if API_MOCK else "AZURE (Cosmos DB + AI Search)")

# ---------------------------------------------------------------------------
# Circuit breaker / degradation manager (used in both modes)
# ---------------------------------------------------------------------------

degradation_manager = DegradationManager()
degradation_manager.register("search", failure_threshold=5, reset_timeout=60)
degradation_manager.register("openai", failure_threshold=3, reset_timeout=120)
degradation_manager.register("cosmos", failure_threshold=5, reset_timeout=60)

# ---------------------------------------------------------------------------
# Type re-exports — MUST come before store variable assignments because
# importing submodules causes Python to bind the submodule as a package
# attribute, which we then overwrite with the actual store instances below.
# ---------------------------------------------------------------------------

from ..pipeline.document_store import DocumentStore as DocumentStore  # noqa: E402
from .booking_store import BookingStore as BookingStore  # noqa: E402
from .chat_store import ChatStore as ChatStore  # noqa: E402
from .client_store import ClientStore as ClientStore  # noqa: E402
from .model_registry_store import ModelRegistryStore as ModelRegistryStore  # noqa: E402
from .prompt_store import PromptStore as PromptStore  # noqa: E402
from .survey_store import SurveyStore as SurveyStore  # noqa: E402
from .team_store import TeamStore as TeamStore  # noqa: E402
from .telemetry_store import TelemetryStore as TelemetryStore  # noqa: E402
from .vector_store import VectorStore as VectorStore  # noqa: E402
from .workspace_store import WorkspaceStore as WorkspaceStore  # noqa: E402

# ---------------------------------------------------------------------------
# Lazy proxy for Azure-mode stores
# ---------------------------------------------------------------------------


class _LazyStore:
    """Proxy that delegates to a real store once it's set during startup.

    This lets module-level ``from ..stores import X`` work in Azure mode
    even though the real stores are initialized asynchronously.
    """

    def __init__(self, name: str) -> None:
        object.__setattr__(self, "_name", name)
        object.__setattr__(self, "_real", None)

    def _set(self, real) -> None:
        object.__setattr__(self, "_real", real)

    def __getattr__(self, attr):
        real = object.__getattribute__(self, "_real")
        if real is None:
            name = object.__getattribute__(self, "_name")
            raise RuntimeError(
                f"Store '{name}' not initialized. "
                f"Call initialize_azure_stores() during startup first."
            )
        return getattr(real, attr)


# ---------------------------------------------------------------------------
# Store instantiation — AFTER re-exports so these assignments win
# ---------------------------------------------------------------------------

cosmos_manager = None  # CosmosClientManager — only set when api_mock=false

# Type declarations for static analysis. At runtime each name is bound below
# to either a concrete store (mock mode) or a _LazyStore proxy (Azure mode);
# both satisfy the concrete store's interface via duck typing / __getattr__.
if TYPE_CHECKING:
    workspace_store: WorkspaceStore
    booking_store: BookingStore
    team_store: TeamStore
    survey_store: SurveyStore
    client_store: ClientStore
    model_registry_store: ModelRegistryStore
    prompt_store: PromptStore
    telemetry_store: TelemetryStore
    vector_store: VectorStore
    document_store: DocumentStore
    chat_store: ChatStore
elif API_MOCK:
    workspace_store = WorkspaceStore()
    booking_store = BookingStore()
    team_store = TeamStore()
    survey_store = SurveyStore()
    client_store = ClientStore()
    model_registry_store = ModelRegistryStore()
    prompt_store = PromptStore()
    telemetry_store = TelemetryStore()
    vector_store = VectorStore()
    document_store = DocumentStore()
    chat_store = ChatStore()
else:
    workspace_store = _LazyStore("workspace_store")
    booking_store = _LazyStore("booking_store")
    team_store = _LazyStore("team_store")
    survey_store = _LazyStore("survey_store")
    client_store = _LazyStore("client_store")
    model_registry_store = _LazyStore("model_registry_store")
    prompt_store = _LazyStore("prompt_store")
    telemetry_store = _LazyStore("telemetry_store")
    vector_store = _LazyStore("vector_store")
    document_store = _LazyStore("document_store")
    chat_store = _LazyStore("chat_store")


async def initialize_azure_stores() -> None:
    """Initialize Azure-backed stores. Called during FastAPI startup."""
    global cosmos_manager

    if API_MOCK:
        return

    settings = get_settings()

    from .azure.booking_store import CosmosBookingStore
    from .azure.chat_store import CosmosChatStore
    from .azure.client_store import CosmosClientStore
    from .azure.cosmos_client import CosmosClientManager
    from .azure.document_store import CosmosDocumentStore
    from .azure.model_registry_store import CosmosModelRegistryStore
    from .azure.prompt_store import CosmosPromptStore
    from .azure.survey_store import CosmosSurveyStore
    from .azure.team_store import CosmosTeamStore
    from .azure.telemetry_store import CosmosTelemetryStore
    from .azure.workspace_store import CosmosWorkspaceStore

    cosmos_manager = CosmosClientManager(
        endpoint=settings.cosmos_endpoint,
        key=settings.cosmos_key,
    )
    await cosmos_manager.initialize()
    logger.info("Cosmos DB client initialized — all databases and containers ready")

    # In Azure mode these are _LazyStore proxies; cast so pyright allows _set().
    cast(_LazyStore, workspace_store)._set(CosmosWorkspaceStore(cosmos_manager))
    cast(_LazyStore, booking_store)._set(CosmosBookingStore(cosmos_manager))
    cast(_LazyStore, team_store)._set(CosmosTeamStore(cosmos_manager))
    cast(_LazyStore, survey_store)._set(CosmosSurveyStore(cosmos_manager))
    cast(_LazyStore, client_store)._set(CosmosClientStore(cosmos_manager))
    cast(_LazyStore, model_registry_store)._set(CosmosModelRegistryStore(cosmos_manager))
    cast(_LazyStore, prompt_store)._set(CosmosPromptStore(cosmos_manager))
    cast(_LazyStore, telemetry_store)._set(CosmosTelemetryStore(cosmos_manager))
    cast(_LazyStore, document_store)._set(CosmosDocumentStore(cosmos_manager))
    cast(_LazyStore, chat_store)._set(CosmosChatStore(cosmos_manager))

    from .azure.search_store import AzureSearchVectorStore

    cast(_LazyStore, vector_store)._set(
        AzureSearchVectorStore(
            endpoint=settings.azure_search_endpoint,
            api_key=settings.azure_search_api_key,
            index_prefix=settings.azure_search_index_prefix,
        )
    )
    logger.info(
        "Azure AI Search vector store initialized (prefix: %s)", settings.azure_search_index_prefix
    )


__all__ = [
    "API_MOCK",
    "workspace_store",
    "booking_store",
    "team_store",
    "survey_store",
    "client_store",
    "model_registry_store",
    "prompt_store",
    "telemetry_store",
    "vector_store",
    "document_store",
    "chat_store",
    "degradation_manager",
    "cosmos_manager",
    "initialize_azure_stores",
    "WorkspaceStore",
    "BookingStore",
    "ChatStore",
    "TeamStore",
    "SurveyStore",
    "ClientStore",
    "ModelRegistryStore",
    "PromptStore",
    "TelemetryStore",
    "VectorStore",
    "DocumentStore",
    "DegradationManager",
]
