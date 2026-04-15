"""Singleton store instances (module-level globals).

In production these will be replaced by Cosmos DB-backed adapters
with the same interface.
"""

from .booking_store import BookingStore
from .survey_store import SurveyStore
from .team_store import TeamStore
from .workspace_store import WorkspaceStore

workspace_store = WorkspaceStore()
booking_store = BookingStore()
team_store = TeamStore()
survey_store = SurveyStore()

__all__ = [
    "workspace_store",
    "booking_store",
    "team_store",
    "survey_store",
    "WorkspaceStore",
    "BookingStore",
    "TeamStore",
    "SurveyStore",
]
