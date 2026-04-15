"""Singleton store instances (module-level globals).

In production these will be replaced by Cosmos DB-backed adapters
with the same interface.
"""

from .booking_store import BookingStore
from .client_store import ClientStore
from .model_registry_store import ModelRegistryStore
from .prompt_store import PromptStore
from .survey_store import SurveyStore
from .team_store import TeamStore
from .telemetry_store import TelemetryStore
from .workspace_store import WorkspaceStore

workspace_store = WorkspaceStore()
booking_store = BookingStore()
team_store = TeamStore()
survey_store = SurveyStore()
client_store = ClientStore()
model_registry_store = ModelRegistryStore()
prompt_store = PromptStore()
telemetry_store = TelemetryStore()

__all__ = [
    "workspace_store",
    "booking_store",
    "team_store",
    "survey_store",
    "client_store",
    "model_registry_store",
    "prompt_store",
    "telemetry_store",
    "WorkspaceStore",
    "BookingStore",
    "TeamStore",
    "SurveyStore",
    "ClientStore",
    "ModelRegistryStore",
    "PromptStore",
    "TelemetryStore",
]
