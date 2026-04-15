"""Singleton store instances (module-level globals).

In production these will be replaced by Cosmos DB-backed adapters
with the same interface.
"""

from .booking_store import BookingStore
from .chat_store import ChatStore
from .client_store import ClientStore
from .model_registry_store import ModelRegistryStore
from .prompt_store import PromptStore
from .survey_store import SurveyStore
from .team_store import TeamStore
from .telemetry_store import TelemetryStore
from .vector_store import VectorStore
from .workspace_store import WorkspaceStore
from ..guardrails.degradation import DegradationManager
from ..pipeline.document_store import DocumentStore

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

# Circuit breaker / degradation manager singleton
degradation_manager = DegradationManager()
degradation_manager.register("search", failure_threshold=5, reset_timeout=60)
degradation_manager.register("openai", failure_threshold=3, reset_timeout=120)
degradation_manager.register("cosmos", failure_threshold=5, reset_timeout=60)

__all__ = [
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
